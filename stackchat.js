'use strict';
const jsdom = require('jsdom');
const request  = require('request');

const log = require('./logging').log;


/**
 * A crude interface for Stack Exchange chat.
 * 
 * Requires Stack Exchange OpenID login credentials, and an account on Security.SE.
 */
class Chat {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    
    this.cookieJar = request.jar();
    
    this.connected = new Promise(resolve => {
      this.resolveConnected_ = resolve;
    });
  }
  
  /**
   * Issues a request() with the given opts and pipes the response through jsdom.
   */
  requestDom(opts) {
    const fullOpts = Object.assign({
      url: null,
      method: 'GET',
      jar: this.cookieJar
    }, opts, {
      
    });
    
    log(`${fullOpts.method} ${fullOpts.url} ${
      fullOpts.qs ? JSON.stringify(fullOpts.qs) : ''}`);
    
    return new Promise((resolve, reject) => {
      request(fullOpts, (error, response, body) => {
        if (error) {
          reject(error);
          return;
        }
        
        jsdom.env({
          html: body,
          url: fullOpts.url,
          features: {
            QuerySelector: true
          },
          done: (error, window) => {
            if (error) {
              reject(error);
              return;
            }
            
            resolve(window);
          }
        })
      });
    });
  }
  
  /**
   * Attempts to send a message to the specified room. (No rate-limiting or whatever.)
   */
  sendMessage(roomId, body) {
    return this.requestDom({
      url: `https://chat.stackexchange.com/chats/${roomId}/messages/new`,
      method: 'POST',
      form: {
        text: body,
        fkey: this.chatFkey
      }
    });
  }
  
  /**
   * Connects to chat, gets everything going.
   * 
   * Don't call twice please.
   */
  connect(projectName) {
    this.projectName = projectName;
    this.chatFkey = null;
    this.userId = null;

    log("Connecting to chat...");
    
    const loginFkey =
      this.requestDom({
        url: 'https://security.stackexchange.com/users/login'
      }).then(window => {
        const loginFkey = window.document.querySelector('[name=fkey]').value;
        log(`Got Stack Exchange fkey.`);
        return loginFkey;
      });
    
    const authed = loginFkey.then(loginFkey =>
      this.requestDom({
        url: 'https://security.stackexchange.com/users/login',
        method: 'POST',
        form: {
          fkey: loginFkey,
          email: this.email,
          password: this.password,
          ssrc: '',
          oauth_version: '',
          oauth_server: '',
          openid_username: '',
          openid_identifier: ''
        }
      }).then(window => {
        if (window.document.querySelector('#confirm-submit')) {
          throw new Error('Account not active on Security.SE -- please manually create.');
        } else {
          log(`Logged in via Security.SE.`);
          return window;
        }
      }));
    
    const connected = authed.then(() => {
      return this.requestDom({
        url: 'https://chat.stackexchange.com/',
      }).then(window => {
        log("Authenticated to chat. Reading fkey.");
        this.chatFkey = window.document.querySelector('[name=fkey]').value;
        this.userId = Number(window.document.querySelector('.topbar-menu-links a').getAttribute('href').split('/')[2]);
        
        if (!this.userId) {
          throw new Error("Unable to identify own chat user id.");
        }
        
        if (!this.chatFkey) {
          throw new Error("Could not find chat fkey");
        }
      });
    });
    
    this.resolveConnected_(connected);
  }
  
  /**
   * Returns the messages in a page of search results.
   */
  search(text, roomId, userId, page, pagesize, sort) {
    const qs = Object.assign({}, {
      q: text,
      room: roomId || '',
      user: userId || '',
      page: page || 1,
      pagesize: pagesize || 100,
      sort: sort || 'newest'
    });
    
    return this.requestDom({
      url: 'https://chat.stackexchange.com/search',
      qs: qs
    }).then(window => this.scrapeMessages(window.document));
  }
  
  /**
   * Returns the latest messages from the specified room's transcript.
   */
  transcript(roomId) {
    return this.requestDom({
      url: `https://chat.stackexchange.com/transcript/${roomId}`
    }).then(window => this.scrapeMessages(window.document));
  }
  
  /**
   * Returns an array of all messages in the specified DOM tree.
   */
  scrapeMessages(dom) {
    const messages = [];
    
    for (const monologue of Array.from(dom.querySelectorAll('.monologue'))) {
      const signature = monologue.querySelector('.signature .username a');
      const userName = signature.textContent;
      const userId = Number(signature.getAttribute('href').split('/')[2]);
      
      for (const message of Array.from(monologue.querySelectorAll('.message'))) {
        const messageId = Number(message.id.split('-')[1]);
        const roomId = Number(message.querySelector('a').getAttribute('href').split('/')[2].split('?')[0]);
        const parentInfo = message.querySelector('.reply-info');
        const parentId = parentInfo && Number(parentInfo.href.split('#')[1]);
        const content = message.querySelector('.content');
        const textContent = content.textContent.trim();
        const domContent = content;
        
        messages.push(new Message(
          roomId,
          messageId,
          parentId,
          domContent,
          textContent,
          userId,
          userName));
      }
    }
    
    return messages;
  }
}


class Message {
  constructor(roomId, messageId, parentId, domContent, textContent, userId, userName) {
    this.roomId = roomId || null;
    this.messageId = messageId || null;
    this.parentId = parentId || null;
    this.domContent = domContent || null;
    this.textContent = textContent || '';
    this.userId = userId || null;
    this.userName = userName || null;
  }
}

module.exports = {Chat};

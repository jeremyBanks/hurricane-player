'use strict';
const log = require('./logging').log;

/**
 * The bot's own behaviour and state, on top of a connected Chat interface.
 */
class Bot {
  constructor(name, chat) {
    this.name = name;
    this.chat = chat;
   
    this.stateUrlPrefix = `https://${name}.hyperdev.space/?_?`;

    log("Bot waiting for connection to initialize.");
  
    this.initialized = chat.connected.then(() => {
      log("Chat connected, so initializing bot.");
      return this.initialize_()
    });
    
    this.initialized.then(() => {
      log("Bot initialized.");
    }, error => {
      log("Failed to initialize bot: " + error);
    });

    this.roomStates = null;
    this.mentionPollInterval = 30 * 1000;
    this.mentionPollIntervalId = null;
  }
  
  signState(roomId) {
    const oldState = this.roomStates.get(roomId) || {};
    const state = Object.assign({}, oldState, {
      t: Date.now(),
      dt: Date.now() - (oldState.t || 0)
    });
    
    const prefix = oldState.previousStateMessageId ? `:${oldState.previousStateMessageId} ` : '';
    
    this.roomStates.set(roomId, state);
    
    return this.chat.sendMessage(
      roomId,
      `${prefix}!${this.stateUrlPrefix}${encodeURIComponent(JSON.stringify(state))}`);
  }
 
  initialize_() {
    log("Initializing bot.");
    
    this.roomStates = new Map();
    
    log("Attempting to load state.");
    this.stateLoaded = Promise.resolve().then(() => {
      return this.chat.search(
        'img',
        null,
        this.chat.userId,
        1,
        100,
        'newest'
      ).then(messages => {
        log(`State search returned ${messages.length} messages.`);

        for (const message of messages) {
          if (this.roomStates.has(message.roomId)) {
            continue;
          }
          const imageLink = message.domContent.querySelector('.ob-image a');
          const imageUrl = imageLink && imageLink.href || '';
          if (imageUrl.startsWith(this.stateUrlPrefix)) {
            try {
              const stateRaw = imageUrl.slice(this.stateUrlPrefix.length);
              const stateText = decodeURIComponent(stateRaw);
              const stateData = JSON.parse(stateText);
              
              stateData.previousStateMessageId = message.messageId;
              
              log(`Found state for ${message.roomId}: ${stateText}`);
              this.roomStates.set(message.roomId, stateData);
            } catch (error) {
              log(`Error parsing state from ${imageLink}: ${error}.`);
            }
          }
        }
      });
    });
    
    this.stateLoaded.then(() => {
      for (const roomId of this.roomStates.keys()) {
        const state = this.roomStates.get(roomId) || {};
        
        if (state.keepAlive) {
          const sigAge = Date.now() - state.t;
          const maxAge = 1000 * 60 * 60 * 4;

          if (sigAge > maxAge) {
            log(`Triggering keep-alive for room ${roomId} because last signature was ${sigAge} > ${maxAge} ms ago.`);
            this.signState(roomId);  
          } else {
            log(`No keep-alive currently neccessary in room ${roomId}.`);
          }
        }
      }
    });
    
    return this.stateLoaded;
  }
}

module.exports = {Bot};

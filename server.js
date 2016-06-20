'use strict';
const express = require('express');
const request = require('request');

const stackchat = require('./stackchat');
const Bot = require('./bot').Bot;
const HTML = require('./html').HTML;
const log = require('./logging').log;
const getLogSvg = require('./logging').getLogSvg;


const app = express();

let nameProject_;
let projectName = null;
const projectNamed = new Promise(resolve => {
  nameProject_ = name => {
    if (name && projectName == null) {
      resolve(name);
      projectName = name;
    }
  };
}).then(name => {
  log(`Learned project name: ${name}`);
  return name;
});

// Initialize chat and bot
let chat;
let bot = null;
if (process.env.SE_USERNAME && process.env.SE_PASSWORD) {
  projectNamed.then(name => {
    chat = new stackchat.Chat(
      process.env.SE_USERNAME,
      process.env.SE_PASSWORD
    );

    bot = new Bot(name, chat);

    const delaySeconds = 12;
    log(`Got name -- connecting to chat in ${delaySeconds} seconds.`);
    setTimeout(() => {
      chat.connected.then(result => {
        log("Connected to chat.");
      }, error => {
        log("Failed to connect to chat: " + error);
      });
      
      chat.connect(name);
    }, delaySeconds * 1000);
  }).then(null, error => {
    log("Error initializing chat: " + error);
    throw error;
  });
} else {
  log("No SE_USERNAME and SE_PASSWORD found -- unable to chat.");
  chat = null;
}

app.use((request, response, next) => {
  nameProject_(
    request.headers.host.match(/\.hyperdev\./) && 
    (request.headers.host || '').split('.')[0]);
  
  const referer = request.headers.referer || '';
  const roomId = +[].concat(referer.match(/^https?:\/\/chat\.stackexchange\.com\/rooms\/(\d+)/)).map(Number)[1] || null;
  
  if (roomId) {
    log(HTML`Request to ${request.path} via <a href="https://chat.stackexchange.com/rooms/${roomId}">room ${roomId}</a>.`);
  } else if (referer) {
    log(`Request to ${request.path} via ${referer}.`);
  } else {
    log(`Request to ${request.path}.`);
  }
  
  next();
});


app.get('/favicon.ico', (request, response) => response.status(404).end());


/**
 * Serves a transparent pixel.
 */
app.get('/.png', (request, response) => {
  response.redirect('https://cdn.hyperdev.com/us-east-1%3Af5641323-74ec-49b7-a124-58c71eaab2db%2Fping.png');
});


/**
 * An RSS feed with a single item representing the project.
 * This isn't meant to be updated, but used as an occassional keep-alive mechanism.
 */
app.get('/feed', (request, response) => {
  const ip = (request.headers['x-forwarded-for'] || request.connection.remoteAddress).split(',')[0];
  log(HTML`Serving feed to <a href="http://${ip}"><code>${ip}</code></a>.`);
  response.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.set('Content-Type', 'application/rss+xml');
  response.end(
    HTML`<?xml version="1.0" encoding="utf-8"?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>${projectName}</title>
      <description></description>
    	<atom:link rel="self" href="https://${projectName}.hyperdev.space/feed" type="application/rss+xml" />
    	<link>https://${projectName}.hyperdev.space/</link>
      <item>
    		<title>${projectName}</title>
        <guid>https://${projectName}.hyperdev.space/feed</guid>
        <link>https://${projectName}.hyperdev.space/</link>
    		<description>${projectName}</description>
    	</item>
    </channel>
    </rss>`.toString()
  );
});

/**
 * An SVG/HTML image displaying the latest log messages.
 */
app.get('/log', (request, response) => {
  response.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.set('Content-Type', 'image/svg+xml');
  response.set('Refresh', '6');
  response.end(
    HTML`<?xml version="1.0" encoding="utf-8"?>
    ${getLogSvg(projectName)}`.toString());
});

/**
 * An image just displaying the project name, redirecting to project source code.
 */
app.get('/*', (request, response) => {
  response.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.set('Content-Type', 'image/svg+xml');
  response.set('Refresh', `0;URL=https://hyperdev.com/#!/project/${projectName}`);
  response.end(
    HTML`<?xml version="1.0" encoding="utf-8"?>
    <svg
      version="1.1"
      baseProfile="full"
      xmlns="http://www.w3.org/2000/svg"
      width="300"
      height="18"
    >
      <text
        x="296"
        y="12"
        style="
          font-style: italic;
          text-anchor: end;
          fill: #366fb3;
          font-size: 10px;
          font-family: Verdana, Arial, sans-serif;
        "
      >
        ${projectName} on HyperDev
      </text>
    </svg>`.toString());
});

log(`Attempting to listen on :${process.env.PORT}.`);
const listener = app.listen(process.env.PORT, () => {
  log(`Listening on :${listener.address().port}.`);
  
  log('Testing log: ]]>-->`\'"></script><script src=//xss.fyi></script>');
  
  log(HTML`Testing log: <span style="
    font-weight: bold;
    color: black;
    background: linear-gradient(to right, cyan, red);
    padding: 0 1em;
  ">hello world</span>`);
});

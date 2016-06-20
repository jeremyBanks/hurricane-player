'use strict';
const HTML = require('./html').HTML;

let logItems = [];


const log = msg => {
  const limit = 128;
  const msgStr = String(msg);
  const msgHtml = HTML`${msg}`;

  console.log(msgStr);
  
  // Replace duplicates
  logItems = logItems.filter(item => item.msgStr != msgStr);
  
  logItems.push({
    time: new Date().toISOString().slice(11, 19),
    msgStr,
    msgHtml
  });
  
  while (logItems.length > 20) {
    logItems.shift();
  }
};


const getLogSvg = projectName =>
  HTML`<svg
    version="1.1"
    baseProfile="full"
    xmlns="http://www.w3.org/2000/svg"
    width="300"
    height="300"
  >
    <style>
      a {
        color: yellow;
      }
      #main {
        position: absolute;
        bottom: 2px;
        left: 0px;
        right: 2px;
        top: 2px;
        font: 12px monospace;
        border-radius: 5px;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        background: #222;
        color: white;
        border: 2px solid white;
      }
      #header {
        position: absolute;
        z-index: 100;
        top: 0;
        left: 1px;
        right: 0;
        background: #246;
        font-weight: bold;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        border-bottom: 1px solid white;
        padding: 1px 2px;
      }
      #contents {
        position: absolute;
        bottom: 3px;
        right: 2px;
        left: 0;
      }
      #contents > div {
        margin: 0;
        padding-left: 0.5em;
        text-indent: -0.5em;
        margin-top: 2px;
      }
      #contents > div + div {
        border-top: 1px solid #444;
      }
      #contents > div code {
        white-space: pre-wrap;
      }
      #contents > div .time {
        display: inline-block;
        vertical-align: 1px;
        margin-left: 10px;
        opacity: 0.75;
        font-size: 8px;
      }
    </style>
    <foreignObject x="0" y="0" width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" id="main">
        <div id="header">
          Log for <a href="https://hyperdev.com/#!/project/${projectName}">${projectName}</a>
        </div>
        <div id="contents">
          ${logItems.map(l => HTML`<div>
            <span class="time">${l.time}</span>
            <code>${l.msgHtml}</code>
          </div>`)}
        </div>
      </div>
    </foreignObject>
  </svg>`;

module.exports = {log, getLogSvg};

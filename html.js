'use strict';
const escapeHtml = require('escape-html');

/**
 * A template string tag function for HTML. All interpolated values will be
 * escaped unless they are already HTMLStrings. Returns an HTMLString object,
 * whose raw value is available by .toString().
 */
const HTML = function(statics, var_dynamics) {
  const dynamics = Array.from(arguments).slice(1);
  
  const escapedDynamics = dynamics.map(s => flatten([s]).map(
    s => s instanceof HTMLString ? s.toString() : escapeHtml(String(s))).join(''));
  
  const pieces = [];
  
  for (let i = 0; i < statics.length; i++) {
    pieces.push(statics[i], escapedDynamics[i] || '');
  }
  
  return new HTMLString(pieces.join(''));
};

module.exports = {
  HTML
};


const flatten = root => {
  const results = [];
  const get = value => {
    if (Array.isArray(value)) {
      for (const item of value) {
        get(item);
      }
    } else {
      results.push(value);
    }
  }
  get(root);
  return results;
}

class HTMLString {
  constructor(value) {
    this.value = value;
  }
  
  toString() {
    return this.value;
  }
}

// Simple test case
const actual = HTML`Hello <b>world</b>, ${ HTML`${'Jack'} &em; ${'Ha><'}` }`.toString();
const expected = 'Hello <b>world</b>, Jack &em; Ha&gt;&lt;';
if (actual != expected) {
  console.error("HTML`` producing unexpected results.");
}

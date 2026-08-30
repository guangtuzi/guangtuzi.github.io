'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const language = require('../themes/terminal-canvas/source/js/language-core.js');

const routerSource = fs.readFileSync(
  path.join(__dirname, '../themes/terminal-canvas/source/js/language-router.js'),
  'utf8'
);

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    value(key) {
      return values.get(key);
    }
  };
}

function createHarness(options = {}) {
  const listeners = {};
  const replacements = [];
  let fetchCalls = 0;
  const localStorage = createStorage(options.localStorage);
  const sessionStorage = createStorage(options.sessionStorage);
  const current = options.current || 'en';
  const target = options.target || 'zh-CN';
  const href = options.href || 'https://www.poppinglab.com/zh/';
  const location = {
    href: options.locationHref || 'https://www.poppinglab.com/',
    origin: 'https://www.poppinglab.com',
    hostname: options.hostname || 'www.poppinglab.com',
    replace(value) {
      replacements.push(String(value));
    }
  };
  const languageSwitch = {
    href,
    hreflang: target,
    getAttribute(name) {
      return {
        'data-language-current': current,
        'data-language-target': target,
        'data-language-auto': options.automatic === false ? 'false' : 'true'
      }[name] || '';
    },
    addEventListener(name, callback) {
      listeners[name] = callback;
    }
  };
  const document = {
    readyState: 'complete',
    documentElement: { lang: current },
    querySelector(selector) {
      return selector === '[data-language-switch]' ? languageSwitch : null;
    },
    addEventListener() {}
  };
  const fetch = options.fetch || (() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ country: options.country || 'US' })
  }));
  const window = {
    TerminalLanguage: language,
    localStorage,
    sessionStorage,
    location,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch(...args) {
      fetchCalls += 1;
      return fetch(...args);
    }
  };

  vm.runInNewContext(routerSource, {
    window,
    document,
    URL,
    Promise,
    Error
  });

  return {
    localStorage,
    sessionStorage,
    replacements,
    listeners,
    fetchCalls: () => fetchCalls
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test('redirects the canonical English home to Chinese for a Chinese-region IP', async () => {
  const harness = createHarness({ country: 'CN' });
  await flush();

  assert.deepEqual(harness.replacements, ['https://www.poppinglab.com/zh/']);
  assert.equal(harness.sessionStorage.value('terminal-canvas-geo-language'), 'zh-CN');
});

test('keeps English for other countries and for lookup failures', async () => {
  const otherCountry = createHarness({ country: 'US' });
  const failedLookup = createHarness({ fetch: () => Promise.reject(new Error('offline')) });
  await flush();

  assert.deepEqual(otherCountry.replacements, []);
  assert.deepEqual(failedLookup.replacements, []);
  assert.equal(failedLookup.sessionStorage.value('terminal-canvas-geo-language'), 'en');
});

test('manual preference wins and avoids the country request', async () => {
  const chinese = createHarness({ localStorage: { 'terminal-canvas-language': 'zh-CN' } });
  const english = createHarness({
    country: 'CN',
    localStorage: { 'terminal-canvas-language': 'en' }
  });
  await flush();

  assert.deepEqual(chinese.replacements, ['https://www.poppinglab.com/zh/']);
  assert.equal(chinese.fetchCalls(), 0);
  assert.deepEqual(english.replacements, []);
  assert.equal(english.fetchCalls(), 0);
});

test('non-home pages do not perform automatic detection', async () => {
  const harness = createHarness({ automatic: false, country: 'CN' });
  await flush();

  assert.equal(harness.fetchCalls(), 0);
  assert.deepEqual(harness.replacements, []);
});

test('manual language switch stores the selected target language', () => {
  const harness = createHarness({ automatic: false });
  harness.listeners.click();

  assert.equal(harness.localStorage.value('terminal-canvas-language'), 'zh-CN');
});

test('a manual choice made during lookup wins the async race', async () => {
  let finishLookup;
  const harness = createHarness({
    fetch: () => new Promise((resolve) => {
      finishLookup = resolve;
    })
  });

  harness.listeners.click();
  finishLookup({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ country: 'US' })
  });
  await flush();

  assert.deepEqual(harness.replacements, ['https://www.poppinglab.com/zh/']);
});

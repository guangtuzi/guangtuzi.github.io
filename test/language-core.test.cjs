'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const language = require('../themes/terminal-canvas/source/js/language-core.js');

test('normalizes supported English and Chinese language tags', () => {
  assert.equal(language.normalizeLanguage(' en_US '), 'en');
  assert.equal(language.normalizeLanguage('en-GB'), 'en');
  assert.equal(language.normalizeLanguage('zh_TW'), 'zh-CN');
  assert.equal(language.normalizeLanguage('zh-Hans'), 'zh-CN');
  assert.equal(language.normalizeLanguage('fr'), '');
  assert.equal(language.normalizeLanguage(''), '');
});

test('parses ISO country codes from supported response shapes', () => {
  assert.equal(language.parseCountry({ country: 'cn' }), 'CN');
  assert.equal(language.parseCountry({ country_code: ' hk ' }), 'HK');
  assert.equal(language.parseCountry('tw'), 'TW');
  assert.equal(language.parseCountry({ country: 'CHN' }), '');
  assert.equal(language.parseCountry(null), '');
});

test('maps Chinese regions to Chinese and every other result to English', () => {
  ['CN', 'HK', 'MO', 'TW'].forEach((country) => {
    assert.equal(language.languageForCountry(country), 'zh-CN');
  });

  ['US', 'DE', 'SG', 'XX', '', null].forEach((country) => {
    assert.equal(language.languageForCountry(country), 'en');
  });
});

test('uses a valid manual preference before IP country detection', () => {
  assert.equal(language.resolveLanguage('en', 'CN'), 'en');
  assert.equal(language.resolveLanguage('zh-CN', 'US'), 'zh-CN');
  assert.equal(language.resolveLanguage('fr', 'CN'), 'zh-CN');
  assert.equal(language.resolveLanguage('', ''), 'en');
});

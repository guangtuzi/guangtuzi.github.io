'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const searchCore = require('../themes/terminal-canvas/source/js/search-core.js');

const items = [
  {
    title: '让 Hexo 发布变得可复现',
    url: '/posts/hexo/',
    lang: 'zh-CN',
    date: '2026-08-27T11:30:00.000Z',
    description: '用 GitHub Actions 建立稳定的发布流水线。',
    content: '从本地命令到可审计的自动化部署。',
    tags: ['Hexo', '工程化'],
    categories: ['Web 工程']
  },
  {
    title: 'Reproducible Hexo Deployment',
    url: '/en/posts/hexo/',
    lang: 'en',
    date: '2026-08-27T11:30:00.000Z',
    description: 'Build a stable publishing pipeline with GitHub Actions.',
    content: 'Keep deployments auditable and independent of one workstation.',
    tags: ['Hexo', 'Automation'],
    categories: ['Web Engineering']
  },
  {
    title: 'A deployment field note',
    url: '/en/posts/field-note/',
    lang: 'en-US',
    date: '2026-08-30T10:00:00.000Z',
    description: 'A recent field note.',
    content: 'The body briefly mentions Hexo deployment and GitHub Actions.',
    tags: [],
    categories: []
  },
  {
    title: '用证据驱动排障',
    url: '/posts/debugging/',
    lang: 'zh-CN',
    date: '2026-08-25T13:10:00.000Z',
    description: '从可能性走向可验证的结论。',
    content: '建立时间线，缩小变量，设计反证。',
    tags: ['排障'],
    categories: ['软件工程']
  }
];

test('normalizes full-width Latin text, case, and whitespace with NFKC', () => {
  assert.equal(searchCore.normalize('  Ｈｅｘｏ\nＤＥＰＬＯＹ  '), 'hexo deploy');
  assert.deepEqual(searchCore.tokenize('  Hexo   GitHub '), ['hexo', 'github']);
});

test('finds continuous Chinese phrases and English text', () => {
  assert.equal(searchCore.search(items, '证据驱动', { language: 'zh-CN' })[0].url, '/posts/debugging/');
  assert.equal(searchCore.search(items, 'reproducible', { language: 'en' })[0].url, '/en/posts/hexo/');
});

test('uses AND semantics for space-separated terms', () => {
  const results = searchCore.search(items, 'Hexo GitHub', { language: 'en', allLanguages: true });
  assert.deepEqual(
    new Set(results.slice(0, 2).map((item) => item.url)),
    new Set(['/en/posts/hexo/', '/posts/hexo/'])
  );
  assert.equal(results[2].url, '/en/posts/field-note/');
  assert.deepEqual(searchCore.search(items, 'Hexo missing-term', { allLanguages: true }), []);
});

test('filters to the current language unless allLanguages is enabled', () => {
  const englishOnly = searchCore.search(items, 'Hexo', { language: 'en-US' });
  assert.ok(englishOnly.length > 0);
  assert.ok(englishOnly.every((item) => item.lang.startsWith('en')));

  const allLanguages = searchCore.search(items, 'Hexo', {
    language: 'en',
    allLanguages: true
  });
  assert.ok(allLanguages.some((item) => item.lang === 'zh-CN'));
});

test('ranks a title match above newer body-only matches', () => {
  const results = searchCore.search(items, 'Hexo deployment', {
    language: 'en',
    limit: 2
  });
  assert.equal(results[0].url, '/en/posts/hexo/');
  assert.equal(results[1].url, '/en/posts/field-note/');
});

test('supports full-width queries, limits results, and handles empty searches', () => {
  assert.equal(searchCore.search(items, 'ＨＥＸＯ', { allLanguages: true, limit: 1 }).length, 1);
  assert.deepEqual(searchCore.search(items, '   ', { allLanguages: true }), []);
  assert.deepEqual(searchCore.search(items, 'not-present-anywhere', { allLanguages: true }), []);
});

test('breaks equal scores by date and keeps source order when dates also tie', () => {
  const ties = [
    { title: 'Search note', url: '/old/', lang: 'en', date: '2025-01-01' },
    { title: 'Search note', url: '/new-a/', lang: 'en', date: '2026-01-01' },
    { title: 'Search note', url: '/new-b/', lang: 'en', date: '2026-01-01' }
  ];

  assert.deepEqual(
    searchCore.search(ties, 'search', { language: 'en' }).map((item) => item.url),
    ['/new-a/', '/new-b/', '/old/']
  );
});

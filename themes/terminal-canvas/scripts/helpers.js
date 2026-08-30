'use strict';

function stripMarkup(input) {
  return String(input || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(content) {
  var text = stripMarkup(content);
  var cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || [];
  var latinText = text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g, ' ');
  var latin = latinText.match(/[A-Za-z0-9][A-Za-z0-9'_+-]*/g) || [];
  return { cjk: cjk.length, latin: latin.length, total: cjk.length + latin.length };
}

function localeFor(config, page) {
  var pagePath = page ? String(page.path || '') : '';
  var language;
  if (/^en(?:\/|$)/i.test(pagePath)) language = 'en';
  else if (/^(?:zh|archives|categories|tags)(?:\/|$)/i.test(pagePath)) language = 'zh-CN';
  else language = page && page.lang;
  if (!language) language = config && config.language;
  if (Array.isArray(language)) language = language[0];
  if (!language) return 'zh-CN';
  return String(language).replace('_', '-');
}

function currentPage(context) {
  return context && context.page ? context.page : {};
}

hexo.extend.helper.register('reading_time', function (content) {
  var counts = countWords(content);
  var minutes = counts.cjk / 300 + counts.latin / 220;
  return Math.max(1, Math.ceil(minutes));
});

hexo.extend.helper.register('word_count', function (content) {
  return countWords(content).total;
});

hexo.extend.helper.register('format_date', function (value, style) {
  var date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  var options;
  if (style === 'short') {
    options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  } else if (style === 'month') {
    options = { year: 'numeric', month: 'long' };
  } else {
    options = { year: 'numeric', month: 'long', day: 'numeric' };
  }

  try {
    return new Intl.DateTimeFormat(localeFor(this.config, currentPage(this)), options).format(date);
  } catch (_) {
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
  }
});

hexo.extend.helper.register('plain_excerpt', function (post, limit) {
  var item = post || {};
  var source = item.description || item.excerpt || item.content || '';
  var text = stripMarkup(source);
  var max = Number(limit) || 140;
  if (text.length <= max) return text;
  return text.slice(0, Math.max(1, max - 1)).trim() + '…';
});

hexo.extend.helper.register('meta_description', function (page) {
  var item = page || {};
  var fallback = this.is_english()
    ? (this.config.description_en || this.config.description || 'Notes on technology, engineering, and creative work.')
    : (this.config.description || '技术、工程与创造力的长期记录。');
  return stripMarkup(item.description || item.excerpt || fallback).slice(0, 180);
});

hexo.extend.helper.register('absolute_url', function (path) {
  var value = String(path || '');
  if (/^(?:https?:)?\/\//i.test(value)) return value;
  if (this.config.pretty_urls && this.config.pretty_urls.trailing_index === false) {
    value = value.replace(/(^|\/)index\.html$/i, '$1');
  }
  var base = String(this.config.url || '').replace(/\/$/, '');
  var root = String(this.config.root || '/');
  var cleanRoot = '/' + root.replace(/^\/+|\/+$/g, '');
  if (cleanRoot === '/') cleanRoot = '';
  var cleanPath = '/' + value.replace(/^\/+/, '');
  return base + cleanRoot + cleanPath;
});

hexo.extend.helper.register('nav_active', function (target, current) {
  var href = String(target || '');
  if (/^(?:https?:)?\/\//i.test(href) || /^mailto:/i.test(href)) return false;
  var targetPath = href.replace(/^\/+|\/+$/g, '');
  var currentPath = String(current || '').replace(/^\/+|\/+$/g, '').replace(/index\.html$/, '');
  if (!targetPath) return !currentPath || /^page\/\d+\/?$/.test(currentPath);
  return currentPath === targetPath || currentPath.indexOf(targetPath + '/') === 0;
});

hexo.extend.helper.register('site_language', function () {
  return localeFor(this.config, currentPage(this));
});

hexo.extend.helper.register('is_english', function () {
  return /^en(?:-|$)/i.test(localeFor(this.config, currentPage(this)));
});


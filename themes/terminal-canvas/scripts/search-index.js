'use strict';

var NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’'
};

function decodeEntity(_, entity) {
  var value = String(entity || '');
  var code;

  if (value.charAt(0) === '#') {
    code = /^#x/i.test(value)
      ? parseInt(value.slice(2), 16)
      : parseInt(value.slice(1), 10);

    if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
      try {
        return String.fromCodePoint(code);
      } catch (_) {
        return ' ';
      }
    }

    return ' ';
  }

  return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, value.toLowerCase())
    ? NAMED_ENTITIES[value.toLowerCase()]
    : ' ';
}

function cleanText(input) {
  return String(input || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, decodeEntity)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectionToArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === 'function') return collection.toArray();

  var values = [];
  if (typeof collection.forEach === 'function') {
    collection.forEach(function (item) {
      values.push(item);
    });
  }
  return values;
}

function taxonomyNames(value) {
  var values = collectionToArray(value);
  if (!values.length && typeof value === 'string') values = [value];

  return values
    .map(function (item) {
      return cleanText(item && typeof item === 'object' ? item.name : item);
    })
    .filter(Boolean);
}

function isEnglish(language) {
  return /^en(?:[-_]|$)/i.test(String(language || ''));
}

function itemLanguage(item) {
  return isEnglish(item && item.lang) ? 'en' : 'zh-CN';
}

function itemDate(value) {
  if (!value) return '';

  try {
    var date = value instanceof Date ? value : new Date(value.valueOf ? value.valueOf() : value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  } catch (_) {
    // Invalid dates are represented by an empty string and sort last.
  }

  return '';
}

function itemUrl(item, config) {
  var hasLocalPath = Boolean(item && item.path);
  var path = String((item && (hasLocalPath ? item.path : item.permalink)) || '');
  var absoluteMatch = path.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  if (absoluteMatch) path = absoluteMatch[1] || '/';

  path = path.replace(/[?#].*$/, '').replace(/^\/+/, '');

  var pretty = (config && config.pretty_urls) || {};
  if (pretty.trailing_index === false) {
    path = path.replace(/(^|\/)index\.html$/i, '$1');
  }
  if (pretty.trailing_html === false) {
    path = path.replace(/\.html$/i, '');
  }

  var root = String((config && config.root) || '/');
  root = '/' + root.replace(/^\/+|\/+$/g, '');
  if (root === '/') root = '';

  // A fallback absolute permalink already contains the configured root.
  // Local Hexo paths do not, so only strip it for the permalink fallback.
  var rootPath = root.replace(/^\//, '');
  if (!hasLocalPath && rootPath && (path === rootPath || path.indexOf(rootPath + '/') === 0)) {
    path = path.slice(rootPath.length).replace(/^\/+/, '');
  }

  var url = root + '/' + path;
  url = url.replace(/\/{2,}/g, '/');
  return url || '/';
}

function isSearchable(item) {
  return Boolean(item) && item.published !== false && item.search !== false;
}

function serializeItem(item, config) {
  return {
    title: cleanText(item.title),
    url: itemUrl(item, config),
    lang: itemLanguage(item),
    date: itemDate(item.date || item.updated),
    description: cleanText(item.description || item.excerpt),
    content: cleanText(item.content || item._content),
    tags: taxonomyNames(item.tags),
    categories: taxonomyNames(item.categories)
  };
}

hexo.extend.generator.register('terminal_search_index', function (locals) {
  var chinesePosts = collectionToArray(locals.posts).filter(function (item) {
    return isSearchable(item) && !isEnglish(item.lang);
  });
  var englishPages = collectionToArray(locals.pages).filter(function (item) {
    return isSearchable(item) && item.type === 'english-post';
  });
  var byUrl = new Map();

  chinesePosts.concat(englishPages).forEach(function (item) {
    var serialized = serializeItem(item, hexo.config);
    if (!serialized.title || !serialized.url) return;
    if (!byUrl.has(serialized.url)) byUrl.set(serialized.url, serialized);
  });

  var items = Array.from(byUrl.values()).sort(function (left, right) {
    var rightDate = right.date ? Date.parse(right.date) : 0;
    var leftDate = left.date ? Date.parse(left.date) : 0;
    var dateDifference = rightDate - leftDate;
    if (dateDifference) return dateDifference;
    if (left.url < right.url) return -1;
    if (left.url > right.url) return 1;
    return 0;
  });

  return {
    path: 'search.json',
    data: JSON.stringify({ version: 1, items: items })
  };
});

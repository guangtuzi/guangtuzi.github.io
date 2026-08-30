(function () {
  'use strict';

  var DEBOUNCE_DELAY = 130;
  var RESULT_LIMIT = 8;

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function compactText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncate(value, maximum) {
    var characters = Array.from(compactText(value));
    return characters.length > maximum
      ? characters.slice(0, maximum).join('') + '…'
      : characters.join('');
  }

  function languageFamily(value) {
    var language = String(value || '').toLowerCase();
    if (language.indexOf('zh') === 0) return 'zh';
    if (language.indexOf('en') === 0) return 'en';
    return language;
  }

  function itemLanguage(item) {
    return item && (item.lang || item.language) || '';
  }

  function unwrapResult(result) {
    if (!result || typeof result !== 'object') return result;
    if (result.item && typeof result.item === 'object') return result.item;
    if (result.document && typeof result.document === 'object') return result.document;
    if (result.record && typeof result.record === 'object') return result.record;
    return result;
  }

  function resultArray(output) {
    if (Array.isArray(output)) return output;
    if (output && Array.isArray(output.results)) return output.results;
    if (output && Array.isArray(output.items)) return output.items;
    return [];
  }

  function safeUrl(value) {
    try {
      var parsed = new URL(String(value || ''), window.location.href);
      return /^(?:https?:)$/.test(parsed.protocol) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    var tagName = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' ||
      target.isContentEditable || Boolean(target.closest('[contenteditable="true"]'));
  }

  function createController(form) {
    var input = form.querySelector('[data-search-input]');
    var clearButton = form.querySelector('[data-search-clear]');
    var resultsPanel = form.querySelector('[data-search-results]');
    var status = form.querySelector('[data-search-status]');
    var list = form.querySelector('[data-search-list]');
    var allLanguages = form.querySelector('[data-search-all-languages]');

    if (!input || !clearButton || !resultsPanel || !status || !list || !allLanguages) return null;

    var indexUrl = form.getAttribute('data-search-index') || '/search.json';
    var currentLanguage = form.getAttribute('data-search-language') || document.documentElement.lang || 'en';
    var english = languageFamily(currentLanguage) === 'en';
    var indexPromise = null;
    var debounceTimer = null;
    var searchVersion = 0;
    var composing = false;
    var latestResults = [];

    var messages = english ? {
      loading: 'Loading articles…',
      none: 'No matching articles.',
      error: 'Search is temporarily unavailable.',
      untitled: 'Untitled article',
      one: '1 result',
      many: function (count) { return count + ' results'; },
      english: 'English',
      chinese: 'Chinese'
    } : {
      loading: '正在载入文章…',
      none: '没有找到相关文章。',
      error: '搜索暂时不可用，请稍后重试。',
      untitled: '未命名文章',
      one: '找到 1 篇文章',
      many: function (count) { return '找到 ' + count + ' 篇文章'; },
      english: '英文',
      chinese: '中文'
    };

    function openResults() {
      resultsPanel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function closeResults() {
      resultsPanel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function dismissResults() {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
      searchVersion += 1;
      closeResults();
    }

    function syncClearButton() {
      clearButton.hidden = input.value.length === 0;
    }

    function resetSearch() {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
      searchVersion += 1;
      latestResults = [];
      clearNode(list);
      status.textContent = '';
      closeResults();
      syncClearButton();
    }

    function loadIndex() {
      if (!indexPromise) {
        indexPromise = window.fetch(indexUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        }).then(function (response) {
          if (!response.ok) throw new Error('Search index request failed: ' + response.status);
          return response.json();
        }).then(function (payload) {
          if (Array.isArray(payload)) return payload;
          if (payload && Array.isArray(payload.items)) return payload.items;
          throw new Error('Invalid search index');
        }).catch(function (error) {
          indexPromise = null;
          throw error;
        });
      }
      return indexPromise;
    }

    function formatDate(value) {
      if (!value) return '';
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      try {
        return new Intl.DateTimeFormat(english ? 'en' : 'zh-CN', {
          year: 'numeric',
          month: english ? 'short' : 'numeric',
          day: 'numeric'
        }).format(date);
      } catch (_) {
        return date.toISOString().slice(0, 10);
      }
    }

    function formatLanguage(value) {
      var family = languageFamily(value);
      if (family === 'en') return messages.english;
      if (family === 'zh') return messages.chinese;
      return compactText(value).toUpperCase();
    }

    function renderResults(items) {
      clearNode(list);
      var fragment = document.createDocumentFragment();

      items.forEach(function (rawItem) {
        var item = unwrapResult(rawItem);
        if (!item || typeof item !== 'object') return;

        var destination = safeUrl(item.url || item.path);
        if (!destination) return;

        var listItem = document.createElement('li');
        listItem.className = 'search-result-item';

        var link = document.createElement('a');
        link.className = 'search-result-link';
        link.href = destination;

        var title = document.createElement('span');
        title.className = 'search-result-title';
        title.textContent = compactText(item.title) || messages.untitled;
        link.appendChild(title);

        var excerptText = truncate(item.description || item.excerpt || item.summary || item.content, 150);
        if (excerptText) {
          var excerpt = document.createElement('span');
          excerpt.className = 'search-result-excerpt';
          excerpt.textContent = excerptText;
          link.appendChild(excerpt);
        }

        var metaParts = [formatDate(item.date), formatLanguage(itemLanguage(item))].filter(Boolean);
        if (metaParts.length) {
          var meta = document.createElement('span');
          meta.className = 'search-result-meta';
          meta.textContent = metaParts.join(' · ');
          link.appendChild(meta);
        }

        listItem.appendChild(link);
        fragment.appendChild(listItem);
      });

      list.appendChild(fragment);
      latestResults = Array.prototype.slice.call(list.querySelectorAll('.search-result-link'));

      if (!latestResults.length) status.textContent = messages.none;
      else status.textContent = latestResults.length === 1 ? messages.one : messages.many(latestResults.length);
      openResults();
    }

    function runSearch(version) {
      var query = input.value.trim();
      if (!query) {
        resetSearch();
        return Promise.resolve([]);
      }

      status.textContent = messages.loading;
      clearNode(list);
      latestResults = [];
      openResults();

      return loadIndex().then(function (items) {
        if (version !== searchVersion) return [];

        var candidates = items;
        if (!allLanguages.checked) {
          var family = languageFamily(currentLanguage);
          candidates = items.filter(function (item) {
            return languageFamily(itemLanguage(item)) === family;
          });
        }

        var api = window.TerminalSearch;
        if (!api || typeof api.search !== 'function') throw new Error('Search engine unavailable');

        var output = api.search(candidates, query, {
          language: allLanguages.checked ? null : currentLanguage,
          lang: allLanguages.checked ? null : currentLanguage,
          allLanguages: allLanguages.checked,
          limit: RESULT_LIMIT
        });
        var matched = resultArray(output).slice(0, RESULT_LIMIT);

        if (version !== searchVersion) return [];
        renderResults(matched);
        return matched;
      }).catch(function () {
        if (version !== searchVersion) return [];
        clearNode(list);
        latestResults = [];
        status.textContent = messages.error;
        openResults();
        return [];
      });
    }

    function scheduleSearch(delay) {
      window.clearTimeout(debounceTimer);
      var version = ++searchVersion;
      debounceTimer = window.setTimeout(function () {
        debounceTimer = null;
        runSearch(version);
      }, typeof delay === 'number' ? delay : DEBOUNCE_DELAY);
    }

    input.addEventListener('input', function () {
      syncClearButton();
      if (composing) return;
      if (!input.value.trim()) resetSearch();
      else scheduleSearch();
    });

    input.addEventListener('compositionstart', function () {
      composing = true;
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
      searchVersion += 1;
    });

    input.addEventListener('compositionend', function () {
      composing = false;
      syncClearButton();
      if (!input.value.trim()) resetSearch();
      else scheduleSearch();
    });

    input.addEventListener('keydown', function (event) {
      if (composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'ArrowDown' && !resultsPanel.hidden) {
        var firstLink = list.querySelector('.search-result-link');
        if (firstLink) {
          event.preventDefault();
          firstLink.focus();
        }
      }
    });

    form.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (composing || event.isComposing || event.keyCode === 229) return;

      if (!resultsPanel.hidden) {
        event.preventDefault();
        event.stopPropagation();
        dismissResults();
        input.focus();
      } else if (input.value) {
        event.preventDefault();
        event.stopPropagation();
        input.value = '';
        resetSearch();
        input.focus();
      }
    }, true);

    clearButton.addEventListener('click', function () {
      input.value = '';
      resetSearch();
      input.focus();
    });

    allLanguages.addEventListener('change', function () {
      if (!input.value.trim()) {
        resetSearch();
        return;
      }
      window.clearTimeout(debounceTimer);
      var version = ++searchVersion;
      runSearch(version);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (composing) return;
      if (!input.value.trim()) return;

      window.clearTimeout(debounceTimer);
      var version = ++searchVersion;
      runSearch(version).then(function () {
        if (version !== searchVersion || !latestResults.length) return;
        window.location.assign(latestResults[0].href);
      });
    });

    document.addEventListener('click', function (event) {
      if (!form.contains(event.target) && !resultsPanel.hidden) dismissResults();
    });

    syncClearButton();

    return {
      focusFromShortcut: function () {
        var navButton = document.querySelector('[data-nav-toggle]');
        var narrow = window.matchMedia && window.matchMedia('(max-width: 1100px)').matches;

        if (narrow && navButton && navButton.getAttribute('aria-expanded') !== 'true') {
          navButton.click();
          window.requestAnimationFrame(function () { input.focus(); });
        } else {
          input.focus();
        }
      }
    };
  }

  var controllers = Array.prototype.map.call(
    document.querySelectorAll('[data-site-search]'),
    createController
  ).filter(Boolean);

  if (controllers.length) {
    document.addEventListener('keydown', function (event) {
      if (event.key !== '/' || event.defaultPrevented || event.repeat) return;
      if (event.isComposing || event.keyCode === 229) return;
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      controllers[0].focusFromShortcut();
    });
  }
}());

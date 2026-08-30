(function () {
  'use strict';

  var PREFERENCE_KEY = 'terminal-canvas-language';
  var SESSION_LANGUAGE_KEY = 'terminal-canvas-geo-language';
  var GEO_ENDPOINT = 'https://api.country.is/';
  var GEO_TIMEOUT = 2000;

  function readStorage(storage, key) {
    try {
      return storage ? storage.getItem(key) || '' : '';
    } catch (_) {
      return '';
    }
  }

  function writeStorage(storage, key, value) {
    try {
      if (storage) storage.setItem(key, value);
    } catch (_) {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  function fetchCountry(api) {
    if (typeof window.fetch !== 'function') return Promise.reject(new Error('fetch unavailable'));

    return new Promise(function (resolve, reject) {
      var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
      var settled = false;
      var timer = window.setTimeout(function () {
        if (controller) controller.abort();
        if (!settled) {
          settled = true;
          reject(new Error('country lookup timed out'));
        }
      }, GEO_TIMEOUT);

      function finish(callback, value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        callback(value);
      }

      var options = {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      };
      if (controller) options.signal = controller.signal;

      window.fetch(GEO_ENDPOINT, options).then(function (response) {
        if (!response.ok) throw new Error('country lookup failed: ' + response.status);
        return response.json();
      }).then(function (payload) {
        var country = api.parseCountry(payload);
        if (!country || country === 'XX') throw new Error('country unavailable');
        finish(resolve, country);
      }).catch(function (error) {
        finish(reject, error);
      });
    });
  }

  function start() {
    var api = window.TerminalLanguage;
    var languageSwitch = document.querySelector('[data-language-switch]');
    if (!api || !languageSwitch) return;

    var currentLanguage = api.normalizeLanguage(
      languageSwitch.getAttribute('data-language-current') || document.documentElement.lang
    );
    var targetLanguage = api.normalizeLanguage(
      languageSwitch.getAttribute('data-language-target') || languageSwitch.hreflang
    );
    var automatic = languageSwitch.getAttribute('data-language-auto') === 'true';

    languageSwitch.addEventListener('click', function () {
      if (targetLanguage) writeStorage(window.localStorage, PREFERENCE_KEY, targetLanguage);
    });

    if (!automatic || !currentLanguage || !targetLanguage) return;

    function redirect(language) {
      var resolved = api.normalizeLanguage(language);
      if (!resolved || resolved === currentLanguage || resolved !== targetLanguage) return;

      try {
        var destination = new URL(languageSwitch.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (destination.href !== window.location.href) window.location.replace(destination.href);
      } catch (_) {
        // An invalid destination leaves the current English page in place.
      }
    }

    var preference = api.normalizeLanguage(readStorage(window.localStorage, PREFERENCE_KEY));
    if (preference) {
      redirect(preference);
      return;
    }

    var sessionLanguage = api.normalizeLanguage(readStorage(window.sessionStorage, SESSION_LANGUAGE_KEY));
    if (sessionLanguage) {
      redirect(sessionLanguage);
      return;
    }

    if (/^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)) return;

    function applyDetectedLanguage(language) {
      var resolved = api.normalizeLanguage(language) || 'en';
      writeStorage(window.sessionStorage, SESSION_LANGUAGE_KEY, resolved);

      // A click made while the lookup was pending must always win.
      var latestPreference = api.normalizeLanguage(readStorage(window.localStorage, PREFERENCE_KEY));
      redirect(latestPreference || resolved);
    }

    fetchCountry(api).then(function (country) {
      applyDetectedLanguage(api.languageForCountry(country));
    }).catch(function () {
      applyDetectedLanguage('en');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());

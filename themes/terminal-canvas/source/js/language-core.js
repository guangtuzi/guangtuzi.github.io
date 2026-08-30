(function (root, factory) {
  'use strict';

  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TerminalLanguage = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var CHINESE_REGIONS = {
    CN: true,
    HK: true,
    MO: true,
    TW: true
  };

  function normalizedText(value) {
    var text = String(value == null ? '' : value).trim();
    if (typeof text.normalize === 'function') text = text.normalize('NFKC');
    return text;
  }

  function normalizeLanguage(value) {
    var language = normalizedText(value).replace(/_/g, '-').toLowerCase();
    if (/^en(?:-|$)/.test(language)) return 'en';
    if (/^zh(?:-|$)/.test(language)) return 'zh-CN';
    return '';
  }

  function parseCountry(value) {
    var candidate = value;
    if (value && typeof value === 'object') {
      candidate = value.country || value.country_code || '';
    }

    var country = normalizedText(candidate).toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? country : '';
  }

  function languageForCountry(value) {
    return CHINESE_REGIONS[parseCountry(value)] ? 'zh-CN' : 'en';
  }

  function resolveLanguage(preference, country) {
    return normalizeLanguage(preference) || languageForCountry(country);
  }

  return {
    normalizeLanguage: normalizeLanguage,
    parseCountry: parseCountry,
    languageForCountry: languageForCountry,
    resolveLanguage: resolveLanguage
  };
});

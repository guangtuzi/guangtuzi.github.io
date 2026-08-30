(function (root, factory) {
  'use strict';

  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TerminalSearch = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var FIELD_WEIGHTS = {
    title: 120,
    tags: 72,
    categories: 64,
    description: 36,
    content: 12
  };

  function normalize(value) {
    var text = String(value == null ? '' : value);
    if (typeof text.normalize === 'function') text = text.normalize('NFKC');
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function tokenize(query) {
    var normalized = normalize(query);
    return normalized ? normalized.split(' ').filter(Boolean) : [];
  }

  function fieldText(value) {
    return normalize(Array.isArray(value) ? value.join(' ') : value);
  }

  function languageFamily(language) {
    return normalize(language).replace(/_/g, '-').split('-')[0];
  }

  function dateValue(value) {
    var parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function matchScore(text, term, weight) {
    var position = text.indexOf(term);
    if (position === -1) return 0;

    var score = weight;
    if (text === term) score += weight * 0.4;
    else if (position === 0) score += weight * 0.18;

    score += weight * 0.08 * (1 - Math.min(position, 120) / 120);
    return score;
  }

  function prepareItem(item, index) {
    var source = item || {};
    return {
      source: source,
      index: index,
      date: dateValue(source.date),
      language: languageFamily(source.lang),
      fields: {
        title: fieldText(source.title),
        tags: fieldText(source.tags),
        categories: fieldText(source.categories),
        description: fieldText(source.description),
        content: fieldText(source.content)
      }
    };
  }

  function scorePreparedItem(prepared, terms, normalizedQuery) {
    var total = 0;
    var fields = prepared.fields;

    for (var termIndex = 0; termIndex < terms.length; termIndex += 1) {
      var term = terms[termIndex];
      var bestFieldScore = 0;

      Object.keys(FIELD_WEIGHTS).forEach(function (field) {
        bestFieldScore = Math.max(
          bestFieldScore,
          matchScore(fields[field], term, FIELD_WEIGHTS[field])
        );
      });

      // Every term must occur. This also keeps unspaced Chinese phrases as
      // continuous substring matches, while spaced queries use AND semantics.
      if (!bestFieldScore) return 0;
      total += bestFieldScore;
    }

    if (fields.title === normalizedQuery) total += 100;
    else if (fields.title.indexOf(normalizedQuery) === 0) total += 45;
    else if (fields.title.indexOf(normalizedQuery) !== -1) total += 24;

    if (fields.description.indexOf(normalizedQuery) !== -1) total += 8;
    return total;
  }

  function search(items, query, options) {
    var settings = options || {};
    var terms = tokenize(query);
    if (!terms.length) return [];

    var normalizedQuery = terms.join(' ');
    var requestedLanguage = languageFamily(settings.language);
    var limit = Number(settings.limit);
    if (!Number.isFinite(limit) || limit <= 0) limit = 10;
    limit = Math.floor(limit);

    return (Array.isArray(items) ? items : [])
      .map(prepareItem)
      .filter(function (prepared) {
        return settings.allLanguages || !requestedLanguage || prepared.language === requestedLanguage;
      })
      .map(function (prepared) {
        return {
          item: prepared.source,
          score: scorePreparedItem(prepared, terms, normalizedQuery),
          date: prepared.date,
          index: prepared.index
        };
      })
      .filter(function (result) {
        return result.score > 0;
      })
      .sort(function (left, right) {
        return right.score - left.score || right.date - left.date || left.index - right.index;
      })
      .slice(0, limit)
      .map(function (result) {
        return result.item;
      });
  }

  return {
    normalize: normalize,
    tokenize: tokenize,
    search: search
  };
});

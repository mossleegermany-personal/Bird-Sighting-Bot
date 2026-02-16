/**
 * Tests for src/utils/speciesCodes.js
 * Covers: toSpeciesCode, getSpeciesName, searchSpecies, getPopularSpecies, speciesMap
 */
const {
  toSpeciesCode,
  getSpeciesName,
  searchSpecies,
  getPopularSpecies,
  speciesMap
} = require('../../src/utils/speciesCodes');

describe('speciesCodes utilities', () => {
  // ─── toSpeciesCode ──────────────────────────────────────

  describe('toSpeciesCode()', () => {
    test('maps "house sparrow" to "houspa"', () => {
      expect(toSpeciesCode('house sparrow')).toBe('houspa');
    });

    test('maps "House Sparrow" (case insensitive) to "houspa"', () => {
      expect(toSpeciesCode('House Sparrow')).toBe('houspa');
    });

    test('returns input for partial name with no exact match', () => {
      // "sparrow" alone doesn't have a direct mapping — only "house sparrow" does
      expect(toSpeciesCode('sparrow')).toBe('sparrow');
    });

    test('maps "common myna" to "commyn"', () => {
      expect(toSpeciesCode('common myna')).toBe('commyn');
    });

    test('returns input for alternate spelling not in map', () => {
      // "mynah" is not in the map — only "common myna" is
      expect(toSpeciesCode('mynah')).toBe('mynah');
    });

    test('returns short codes as-is (looks like existing code)', () => {
      expect(toSpeciesCode('houspa')).toBe('houspa');
    });

    test('returns null/undefined as-is', () => {
      expect(toSpeciesCode(null)).toBeNull();
      expect(toSpeciesCode(undefined)).toBeUndefined();
    });

    test('trims whitespace', () => {
      // "eagle" alone has no exact map entry; toSpeciesCode lowercases & trims
      expect(toSpeciesCode('  eagle  ')).toBe('eagle');
    });

    test('partial match: "red-tailed" maps (starts with)', () => {
      expect(toSpeciesCode('red-tailed hawk')).toBe('rethaw');
    });

    test('returns normalized input for unknown species', () => {
      expect(toSpeciesCode('purple unicorn bird')).toBe('purple unicorn bird');
    });
  });

  // ─── getSpeciesName ─────────────────────────────────────

  describe('getSpeciesName()', () => {
    test('reverse maps "houspa" to a capitalized name containing "sparrow"', () => {
      const name = getSpeciesName('houspa');
      expect(name.toLowerCase()).toContain('sparrow');
    });

    test('reverse maps "commyn" to a name containing "myna"', () => {
      const name = getSpeciesName('commyn');
      expect(name.toLowerCase()).toContain('myna');
    });

    test('returns uppercased input for unknown code', () => {
      expect(getSpeciesName('zzzzzz')).toBe('ZZZZZZ');
    });

    test('returns input as-is for null/undefined', () => {
      expect(getSpeciesName(null)).toBeNull();
      expect(getSpeciesName(undefined)).toBeUndefined();
    });
  });

  // ─── searchSpecies ──────────────────────────────────────

  describe('searchSpecies()', () => {
    test('finds species matching "eagle"', () => {
      const results = searchSpecies('eagle');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.name.toLowerCase()).toContain('eagle');
      });
    });

    test('returns unique codes (no duplicate species codes)', () => {
      const results = searchSpecies('hawk');
      const codes = results.map(r => r.code);
      const uniqueCodes = [...new Set(codes)];
      expect(codes).toEqual(uniqueCodes);
    });

    test('returns at most 10 results', () => {
      const results = searchSpecies('a'); // broad query
      expect(results.length).toBeLessThanOrEqual(10);
    });

    test('returns empty array for null query', () => {
      expect(searchSpecies(null)).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      expect(searchSpecies('')).toEqual([]);
    });

    test('each result has name and code properties', () => {
      const results = searchSpecies('owl');
      results.forEach(r => {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('code');
        expect(typeof r.name).toBe('string');
        expect(typeof r.code).toBe('string');
      });
    });
  });

  // ─── getPopularSpecies ──────────────────────────────────

  describe('getPopularSpecies()', () => {
    test('returns a non-empty formatted string', () => {
      const result = getPopularSpecies();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('includes hawk reference', () => {
      expect(getPopularSpecies()).toContain('hawk');
    });

    test('includes owl reference', () => {
      expect(getPopularSpecies()).toContain('owl');
    });
  });

  // ─── speciesMap ─────────────────────────────────────────

  describe('speciesMap', () => {
    test('contains at least 100 entries', () => {
      expect(Object.keys(speciesMap).length).toBeGreaterThanOrEqual(100);
    });

    test('all keys are lowercase', () => {
      for (const key of Object.keys(speciesMap)) {
        expect(key).toBe(key.toLowerCase());
      }
    });

    test('all values are non-empty strings', () => {
      for (const value of Object.values(speciesMap)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });

    test('covers Asian species', () => {
      expect(speciesMap).toHaveProperty('asian koel');
      expect(speciesMap).toHaveProperty('javan myna');
      expect(speciesMap).toHaveProperty('olive-backed sunbird');
    });

    test('covers European species', () => {
      expect(speciesMap).toHaveProperty('european robin');
      expect(speciesMap).toHaveProperty('great tit');
      expect(speciesMap).toHaveProperty('eurasian magpie');
    });

    test('covers Australian species', () => {
      expect(speciesMap).toHaveProperty('laughing kookaburra');
      expect(speciesMap).toHaveProperty('rainbow lorikeet');
      expect(speciesMap).toHaveProperty('galah');
    });
  });

  describe('toSpeciesCode partial match branch', () => {
    test('matches when input is a prefix of a species name (name.startsWith(normalized))', () => {
      // 'house spar' is a prefix of 'house sparrow' → should return 'houspa'
      expect(toSpeciesCode('house spar')).toBe('houspa');
    });

    test('matches when input starts with a species name (normalized.startsWith(name))', () => {
      // 'house sparrow extra text' starts with 'house sparrow' → should return 'houspa'
      expect(toSpeciesCode('house sparrow extra text')).toBe('houspa');
    });

    test('partial match is case insensitive', () => {
      expect(toSpeciesCode('House Sparrow Extra')).toBe('houspa');
    });
  });
});

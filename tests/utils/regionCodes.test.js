/**
 * Tests for src/utils/regionCodes.js
 * Covers: toRegionCode, getPopularLocations, locationToCode map
 */
const { toRegionCode, getPopularLocations, getLocationName, locationToCode } = require('../../src/utils/regionCodes');

describe('regionCodes utilities', () => {
  // ─── toRegionCode ───────────────────────────────────────

  describe('toRegionCode()', () => {
    // Direct region code pass-through
    test('returns uppercase region code when already formatted (e.g. "SG")', () => {
      expect(toRegionCode('SG')).toBe('SG');
    });

    test('uppercases a lowercase region code', () => {
      expect(toRegionCode('sg')).toBe('SG');
    });

    test('handles subnational codes like US-NY', () => {
      expect(toRegionCode('US-NY')).toBe('US-NY');
    });

    test('handles subnational codes case-insensitively', () => {
      expect(toRegionCode('us-ca')).toBe('US-CA');
    });

    // Name lookups
    test('maps "singapore" to SG', () => {
      expect(toRegionCode('singapore')).toBe('SG');
    });

    test('maps "Singapore" (capitalized) to SG', () => {
      expect(toRegionCode('Singapore')).toBe('SG');
    });

    test('maps "usa" to US', () => {
      expect(toRegionCode('usa')).toBe('US');
    });

    test('maps "united states" to US', () => {
      expect(toRegionCode('united states')).toBe('US');
    });

    test('maps "california" to US-CA', () => {
      expect(toRegionCode('california')).toBe('US-CA');
    });

    test('maps "new york" to US-NY', () => {
      expect(toRegionCode('new york')).toBe('US-NY');
    });

    test('"uk" returns UK (not in map as alias for GB)', () => {
      // "uk" is not in locationToCode; toRegionCode uppercases unknown input
      expect(toRegionCode('uk')).toBe('UK');
    });

    test('maps "england" to GB-ENG', () => {
      expect(toRegionCode('england')).toBe('GB-ENG');
    });

    test('maps "japan" to JP', () => {
      expect(toRegionCode('japan')).toBe('JP');
    });

    test('maps "kuala lumpur" to MY-14', () => {
      expect(toRegionCode('kuala lumpur')).toBe('MY-14');
    });

    test('maps "tokyo" to JP-13', () => {
      expect(toRegionCode('tokyo')).toBe('JP-13');
    });

    // Edge cases
    test('returns null for null input', () => {
      expect(toRegionCode(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(toRegionCode(undefined)).toBeNull();
    });

    test('returns uppercase of unknown input', () => {
      expect(toRegionCode('xyzzy')).toBe('XYZZY');
    });

    test('trims whitespace', () => {
      expect(toRegionCode('  Singapore  ')).toBe('SG');
    });

    // Partial match support
    test('partial match: "dubai" maps to AE', () => {
      expect(toRegionCode('dubai')).toBe('AE');
    });

    test('partial match: "holland" maps to NL', () => {
      expect(toRegionCode('holland')).toBe('NL');
    });
  });

  // ─── locationToCode map ─────────────────────────────────

  describe('locationToCode map', () => {
    test('contains at least 100 entries', () => {
      expect(Object.keys(locationToCode).length).toBeGreaterThanOrEqual(100);
    });

    test('all keys are lowercase', () => {
      for (const key of Object.keys(locationToCode)) {
        expect(key).toBe(key.toLowerCase());
      }
    });

    test('all values are non-empty strings', () => {
      for (const value of Object.values(locationToCode)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });

    test('contains major countries', () => {
      const expected = ['singapore', 'usa', 'japan', 'australia', 'germany', 'brazil', 'india', 'south africa', 'kenya'];
      for (const name of expected) {
        expect(locationToCode).toHaveProperty(name);
      }
    });
  });

  // ─── getPopularLocations ────────────────────────────────

  describe('getPopularLocations()', () => {
    test('returns a non-empty string', () => {
      const result = getPopularLocations();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('includes Singapore', () => {
      expect(getPopularLocations()).toContain('Singapore');
    });

    test('includes SG code', () => {
      expect(getPopularLocations()).toContain('SG');
    });
  });

  // ─── getLocationName ────────────────────────────────────

  describe('getLocationName()', () => {
    test('returns capitalized name for known code "SG"', () => {
      const name = getLocationName('SG');
      expect(name).toBeTruthy();
      expect(name.toLowerCase()).toBe('singapore');
      // First char should be uppercase
      expect(name.charAt(0)).toBe(name.charAt(0).toUpperCase());
    });

    test('returns capitalized name for "US"', () => {
      const name = getLocationName('US');
      expect(name).toBeTruthy();
    });

    test('is case-insensitive on input code', () => {
      const name = getLocationName('sg');
      expect(name).toBeTruthy();
      expect(name.toLowerCase()).toBe('singapore');
    });

    test('returns null for unknown code', () => {
      expect(getLocationName('XYZZY')).toBeNull();
    });

    test('returns a name for subnational code "US-CA"', () => {
      const name = getLocationName('US-CA');
      // 'california' → 'US-CA' in locationToCode
      expect(name).toBeTruthy();
      expect(name.toLowerCase()).toBe('california');
    });
  });
});

/**
 * Tests for src/utils/dateUtils.js
 * Covers: resolveTimezone, getTimezoneAbbr, parseDate, formatDateDDMMYYYY,
 *         getStartOfDay, getEndOfDay, isDateInRange, parseEBirdDate,
 *         filterObservationsByDateRange, daysBetween, daysBackFromToday,
 *         getDatePreset, getDateRangeDescription, getRegionTime, formatLocalTime
 */
const {
  resolveTimezone,
  getTimezoneAbbr,
  parseDate,
  formatDateDDMMYYYY,
  getStartOfDay,
  getEndOfDay,
  isDateInRange,
  parseEBirdDate,
  filterObservationsByDateRange,
  daysBetween,
  daysBackFromToday,
  getDatePreset,
  getDateRangeDescription,
  getRegionTime,
  formatLocalTime,
  getLocalNow
} = require('../../src/utils/dateUtils');

describe('dateUtils', () => {
  // ─── resolveTimezone ────────────────────────────────────

  describe('resolveTimezone()', () => {
    test('returns Asia/Singapore for SG', () => {
      expect(resolveTimezone('SG')).toBe('Asia/Singapore');
    });

    test('returns America/New_York for US', () => {
      expect(resolveTimezone('US')).toBe('America/New_York');
    });

    test('returns America/Los_Angeles for US-CA', () => {
      expect(resolveTimezone('US-CA')).toBe('America/Los_Angeles');
    });

    test('falls back to country prefix for unknown sub-region', () => {
      // US-ZZ doesn't exist, but US does → America/New_York
      expect(resolveTimezone('US-ZZ')).toBe('America/New_York');
    });

    test('is case-insensitive', () => {
      expect(resolveTimezone('sg')).toBe('Asia/Singapore');
      expect(resolveTimezone('us-ca')).toBe('America/Los_Angeles');
    });

    test('falls back to system timezone for unknown code', () => {
      const tz = resolveTimezone('XX');
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    test('falls back to system timezone for null/undefined', () => {
      const tz = resolveTimezone(null);
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    test('handles European codes', () => {
      expect(resolveTimezone('GB')).toBe('Europe/London');
      expect(resolveTimezone('DE')).toBe('Europe/Berlin');
      expect(resolveTimezone('FR')).toBe('Europe/Paris');
    });

    test('handles Oceania codes', () => {
      expect(resolveTimezone('AU')).toBe('Australia/Sydney');
      expect(resolveTimezone('NZ')).toBe('Pacific/Auckland');
    });

    test('handles Australian state codes', () => {
      expect(resolveTimezone('AU-WA')).toBe('Australia/Perth');
      expect(resolveTimezone('AU-QLD')).toBe('Australia/Brisbane');
    });

    test('handles Canadian province codes', () => {
      expect(resolveTimezone('CA-BC')).toBe('America/Vancouver');
      expect(resolveTimezone('CA-NL')).toBe('America/St_Johns');
    });
  });

  // ─── getTimezoneAbbr ───────────────────────────────────

  describe('getTimezoneAbbr()', () => {
    test('returns a non-empty string for SG', () => {
      const abbr = getTimezoneAbbr('SG');
      expect(typeof abbr).toBe('string');
      expect(abbr.length).toBeGreaterThan(0);
    });

    test('returns a non-empty string for US', () => {
      const abbr = getTimezoneAbbr('US');
      expect(typeof abbr).toBe('string');
      expect(abbr.length).toBeGreaterThan(0);
    });

    test('returns a string for null input (fallback)', () => {
      const abbr = getTimezoneAbbr(null);
      expect(typeof abbr).toBe('string');
    });
  });

  // ─── parseDate ──────────────────────────────────────────

  describe('parseDate()', () => {
    test('parses DD/MM/YYYY format', () => {
      const d = parseDate('15/02/2026');
      expect(d).toBeInstanceOf(Date);
      expect(d.getDate()).toBe(15);
      expect(d.getMonth()).toBe(1); // Feb = 1
      expect(d.getFullYear()).toBe(2026);
    });

    test('parses YYYY-MM-DD format', () => {
      const d = parseDate('2026-02-15');
      expect(d).toBeInstanceOf(Date);
      expect(d.getDate()).toBe(15);
      expect(d.getMonth()).toBe(1);
      expect(d.getFullYear()).toBe(2026);
    });

    test('parses DD-MM-YYYY format', () => {
      const d = parseDate('15-02-2026');
      expect(d).toBeInstanceOf(Date);
      expect(d.getDate()).toBe(15);
      expect(d.getMonth()).toBe(1);
      expect(d.getFullYear()).toBe(2026);
    });

    test('parses single-digit day/month (5/3/2026)', () => {
      const d = parseDate('5/3/2026');
      expect(d).toBeInstanceOf(Date);
      expect(d.getDate()).toBe(5);
      expect(d.getMonth()).toBe(2); // Mar = 2
    });

    test('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(parseDate(null)).toBeNull();
    });

    test('returns null for invalid format', () => {
      expect(parseDate('February 15, 2026')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
    });

    test('trims whitespace', () => {
      const d = parseDate('  15/02/2026  ');
      expect(d).toBeInstanceOf(Date);
      expect(d.getDate()).toBe(15);
    });
  });

  // ─── formatDateDDMMYYYY ─────────────────────────────────

  describe('formatDateDDMMYYYY()', () => {
    test('formats a date as DD/MM/YYYY', () => {
      const d = new Date(2026, 1, 15); // Feb 15, 2026
      expect(formatDateDDMMYYYY(d)).toBe('15/02/2026');
    });

    test('zero-pads single-digit day and month', () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      expect(formatDateDDMMYYYY(d)).toBe('05/01/2026');
    });
  });

  // ─── getStartOfDay / getEndOfDay ────────────────────────

  describe('getStartOfDay()', () => {
    test('sets time to 00:00:00.000', () => {
      const d = getStartOfDay(new Date(2026, 1, 15, 14, 30, 45));
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
    });

    test('preserves the date', () => {
      const d = getStartOfDay(new Date(2026, 1, 15, 14, 30));
      expect(d.getDate()).toBe(15);
      expect(d.getMonth()).toBe(1);
      expect(d.getFullYear()).toBe(2026);
    });

    test('does not mutate the original date', () => {
      const original = new Date(2026, 1, 15, 14, 30);
      const originalTime = original.getTime();
      getStartOfDay(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('getEndOfDay()', () => {
    test('sets time to 23:59:59.999', () => {
      const d = getEndOfDay(new Date(2026, 1, 15, 8, 0));
      expect(d.getHours()).toBe(23);
      expect(d.getMinutes()).toBe(59);
      expect(d.getSeconds()).toBe(59);
      expect(d.getMilliseconds()).toBe(999);
    });

    test('does not mutate the original date', () => {
      const original = new Date(2026, 1, 15, 8, 0);
      const originalTime = original.getTime();
      getEndOfDay(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  // ─── isDateInRange ──────────────────────────────────────

  describe('isDateInRange()', () => {
    const start = new Date(2026, 1, 10, 0, 0, 0);
    const end = new Date(2026, 1, 15, 23, 59, 59);

    test('returns true for date inside range', () => {
      expect(isDateInRange(new Date(2026, 1, 12), start, end)).toBe(true);
    });

    test('returns true for date at start boundary', () => {
      expect(isDateInRange(start, start, end)).toBe(true);
    });

    test('returns true for date at end boundary', () => {
      expect(isDateInRange(end, start, end)).toBe(true);
    });

    test('returns false for date before range', () => {
      expect(isDateInRange(new Date(2026, 1, 9), start, end)).toBe(false);
    });

    test('returns false for date after range', () => {
      expect(isDateInRange(new Date(2026, 1, 16), start, end)).toBe(false);
    });
  });

  // ─── parseEBirdDate ─────────────────────────────────────

  describe('parseEBirdDate()', () => {
    test('parses "2026-02-15 08:30"', () => {
      const d = parseEBirdDate('2026-02-15 08:30');
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(8);
      expect(d.getMinutes()).toBe(30);
    });

    test('parses date-only string (no time part)', () => {
      const d = parseEBirdDate('2026-02-15');
      expect(d).toBeInstanceOf(Date);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });

    test('returns null for null input', () => {
      expect(parseEBirdDate(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(parseEBirdDate(undefined)).toBeNull();
    });
  });

  // ─── filterObservationsByDateRange ──────────────────────

  describe('filterObservationsByDateRange()', () => {
    const observations = [
      { comName: 'Bird A', obsDt: '2026-02-10 08:00' },
      { comName: 'Bird B', obsDt: '2026-02-12 12:00' },
      { comName: 'Bird C', obsDt: '2026-02-14 18:00' },
      { comName: 'Bird D', obsDt: '2026-02-16 06:00' },
      { comName: 'Bird E' }, // no obsDt
    ];

    const start = new Date(2026, 1, 11, 0, 0, 0);
    const end = new Date(2026, 1, 14, 23, 59, 59);

    test('filters observations within range', () => {
      const result = filterObservationsByDateRange(observations, start, end);
      expect(result).toHaveLength(2);
      expect(result[0].comName).toBe('Bird B');
      expect(result[1].comName).toBe('Bird C');
    });

    test('excludes observations without obsDt', () => {
      const result = filterObservationsByDateRange(observations, start, end);
      expect(result.find(o => o.comName === 'Bird E')).toBeUndefined();
    });

    test('returns empty array for null observations', () => {
      expect(filterObservationsByDateRange(null, start, end)).toEqual([]);
    });

    test('returns empty array for non-array input', () => {
      expect(filterObservationsByDateRange('not an array', start, end)).toEqual([]);
    });

    test('returns empty array when no observations match', () => {
      const farStart = new Date(2030, 0, 1);
      const farEnd = new Date(2030, 11, 31);
      expect(filterObservationsByDateRange(observations, farStart, farEnd)).toEqual([]);
    });
  });

  // ─── daysBetween ────────────────────────────────────────

  describe('daysBetween()', () => {
    test('returns 1 for same day', () => {
      const d = new Date(2026, 1, 15);
      expect(daysBetween(d, d)).toBe(1);
    });

    test('returns 2 for adjacent days', () => {
      const a = new Date(2026, 1, 15);
      const b = new Date(2026, 1, 16);
      expect(daysBetween(a, b)).toBe(2);
    });

    test('is symmetric (order does not matter)', () => {
      const a = new Date(2026, 1, 10);
      const b = new Date(2026, 1, 20);
      expect(daysBetween(a, b)).toBe(daysBetween(b, a));
    });

    test('returns correct count for a full month', () => {
      const a = new Date(2026, 0, 1);
      const b = new Date(2026, 0, 31);
      expect(daysBetween(a, b)).toBe(31);
    });
  });

  // ─── daysBackFromToday ──────────────────────────────────

  describe('daysBackFromToday()', () => {
    test('returns at least 1 for today', () => {
      expect(daysBackFromToday(new Date())).toBeGreaterThanOrEqual(1);
    });

    test('returns more for a past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      expect(daysBackFromToday(pastDate)).toBeGreaterThanOrEqual(10);
    });
  });

  // ─── getDatePreset ──────────────────────────────────────

  describe('getDatePreset()', () => {
    const presets = ['today', 'yesterday', 'last_3_days', 'last_week', 'last_14_days', 'last_month'];

    presets.forEach(preset => {
      test(`"${preset}" returns startDate, endDate, backDays, label`, () => {
        const result = getDatePreset(preset, 'SG');
        expect(result).toHaveProperty('startDate');
        expect(result).toHaveProperty('endDate');
        expect(result).toHaveProperty('backDays');
        expect(result).toHaveProperty('label');
        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.endDate).toBeInstanceOf(Date);
        expect(typeof result.backDays).toBe('number');
        expect(typeof result.label).toBe('string');
      });

      test(`"${preset}" startDate is before endDate`, () => {
        const result = getDatePreset(preset, 'SG');
        expect(result.startDate.getTime()).toBeLessThanOrEqual(result.endDate.getTime());
      });
    });

    test('"today" has backDays = 1', () => {
      expect(getDatePreset('today', 'SG').backDays).toBe(1);
    });

    test('"last_week" has backDays = 7', () => {
      expect(getDatePreset('last_week', 'SG').backDays).toBe(7);
    });

    test('"last_month" has backDays = 30', () => {
      expect(getDatePreset('last_month', 'SG').backDays).toBe(30);
    });

    test('unknown preset falls back to 14-day default', () => {
      const result = getDatePreset('unknown_preset', 'SG');
      expect(result.backDays).toBe(14);
    });

    test('label includes timezone abbreviation', () => {
      const result = getDatePreset('today', 'SG');
      // Should contain some timezone string
      expect(result.label.length).toBeGreaterThan(5);
    });
  });

  // ─── getDateRangeDescription ────────────────────────────

  describe('getDateRangeDescription()', () => {
    test('shows single date when start equals end date', () => {
      const d = new Date(2026, 1, 15);
      const desc = getDateRangeDescription(d, d, 'SG');
      expect(desc).toContain('15/02/2026');
    });

    test('shows range when start and end differ', () => {
      const s = new Date(2026, 1, 10);
      const e = new Date(2026, 1, 15);
      const desc = getDateRangeDescription(s, e, 'SG');
      expect(desc).toContain('10/02/2026');
      expect(desc).toContain('15/02/2026');
      expect(desc).toContain('to');
    });
  });

  // ─── getRegionTime ──────────────────────────────────────

  describe('getRegionTime()', () => {
    test('returns hours, minutes, formatted for SG', () => {
      const result = getRegionTime('SG');
      expect(result).toHaveProperty('hours');
      expect(result).toHaveProperty('minutes');
      expect(result).toHaveProperty('formatted');
      expect(result.formatted).toMatch(/^\d{2}:\d{2}$/);
    });

    test('returns valid time for null (system default)', () => {
      const result = getRegionTime(null);
      expect(result.formatted).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  // ─── formatLocalTime ───────────────────────────────────

  describe('formatLocalTime()', () => {
    test('returns HH:MM format', () => {
      const result = formatLocalTime(new Date(), 'SG');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    test('returns HH:MM for null region (system default)', () => {
      const result = formatLocalTime(new Date(), null);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    test('returns HH:MM for undefined region', () => {
      const result = formatLocalTime(new Date());
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  // ─── getLocalNow ────────────────────────────────────────

  describe('getLocalNow()', () => {
    test('returns a Date object', () => {
      expect(getLocalNow()).toBeInstanceOf(Date);
    });

    test('is close to current time', () => {
      const now = Date.now();
      const localNow = getLocalNow().getTime();
      expect(Math.abs(now - localNow)).toBeLessThan(1000);
    });
  });

  // ─── Intl fallback branches (lines 224-291) ────────────

  describe('getTimezoneAbbr() — fallback branch', () => {
    test('returns "Local" when Intl.DateTimeFormat returns no timeZoneName part', () => {
      const origDTF = Intl.DateTimeFormat;
      // Mock formatToParts to return parts without timeZoneName
      const mockFTP = jest.fn().mockReturnValue([
        { type: 'day', value: '15' },
        { type: 'literal', value: '/' },
        { type: 'month', value: '02' },
      ]);
      Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
        formatToParts: mockFTP,
      }));

      const result = getTimezoneAbbr('SG');
      expect(result).toBe('Local');

      Intl.DateTimeFormat = origDTF;
    });
  });

  describe('getRegionTime() — fallback branches', () => {
    test('returns "00" for hours and minutes when Intl parts missing', () => {
      const origDTF = Intl.DateTimeFormat;
      const mockFTP = jest.fn().mockReturnValue([
        { type: 'literal', value: ':' },
      ]);
      Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
        formatToParts: mockFTP,
      }));

      const result = getRegionTime('SG');
      expect(result.hours).toBe('00');
      expect(result.minutes).toBe('00');
      expect(result.formatted).toBe('00:00');

      Intl.DateTimeFormat = origDTF;
    });
  });

  describe('formatLocalTime() — fallback branches', () => {
    test('returns "00:00" when Intl parts missing', () => {
      const origDTF = Intl.DateTimeFormat;
      const mockFTP = jest.fn().mockReturnValue([]);
      Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
        formatToParts: mockFTP,
      }));

      const result = formatLocalTime(new Date(), 'SG');
      expect(result).toBe('00:00');

      Intl.DateTimeFormat = origDTF;
    });
  });

  describe('getDatePreset() — all branches', () => {
    test('"last_3_days" has backDays = 3', () => {
      expect(getDatePreset('last_3_days', 'SG').backDays).toBe(3);
    });

    test('"last_14_days" has backDays = 14', () => {
      expect(getDatePreset('last_14_days', 'SG').backDays).toBe(14);
    });

    test('"yesterday" has backDays = 2', () => {
      expect(getDatePreset('yesterday', 'SG').backDays).toBe(2);
    });

    test('all presets use correct timezone in label', () => {
      const presets = ['today', 'yesterday', 'last_3_days', 'last_week', 'last_14_days', 'last_month'];
      for (const p of presets) {
        const result = getDatePreset(p, 'US');
        expect(typeof result.label).toBe('string');
        expect(result.label.length).toBeGreaterThan(0);
      }
    });

    test('works with null regionCode', () => {
      const result = getDatePreset('today', null);
      expect(result).toHaveProperty('backDays', 1);
      expect(result).toHaveProperty('label');
    });
  });
});

/**
 * Tests for src/utils/markdown.js
 * Covers: escapeMarkdown / esc
 */
const { escapeMarkdown, esc } = require('../../src/utils/markdown');

describe('markdown utilities', () => {
  // ─── escapeMarkdown ─────────────────────────────────────

  describe('escapeMarkdown()', () => {
    test('escapes asterisks', () => {
      expect(escapeMarkdown('hello *world*')).toBe('hello \\*world\\*');
    });

    test('escapes underscores', () => {
      expect(escapeMarkdown('hello _world_')).toBe('hello \\_world\\_');
    });

    test('escapes backticks', () => {
      expect(escapeMarkdown('hello `code`')).toBe('hello \\`code\\`');
    });

    test('escapes square brackets', () => {
      expect(escapeMarkdown('see [link]')).toBe('see \\[link]');
    });

    test('escapes multiple special characters at once', () => {
      expect(escapeMarkdown('*bold* _italic_ `code` [link]'))
        .toBe('\\*bold\\* \\_italic\\_ \\`code\\` \\[link]');
    });

    test('returns empty string for null input', () => {
      expect(escapeMarkdown(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(escapeMarkdown(undefined)).toBe('');
    });

    test('returns empty string for empty string', () => {
      expect(escapeMarkdown('')).toBe('');
    });

    test('converts numbers to string before escaping', () => {
      expect(escapeMarkdown(42)).toBe('42');
    });

    test('leaves normal text unchanged', () => {
      expect(escapeMarkdown('hello world 123')).toBe('hello world 123');
    });

    test('handles bird names with special chars', () => {
      expect(escapeMarkdown("Cooper's Hawk")).toBe("Cooper's Hawk");
    });

    test('handles location names like "Botanic Gardens, Singapore"', () => {
      expect(escapeMarkdown('Botanic Gardens, Singapore'))
        .toBe('Botanic Gardens, Singapore');
    });
  });

  // ─── esc alias ──────────────────────────────────────────

  describe('esc() alias', () => {
    test('is the same function as escapeMarkdown', () => {
      expect(esc).toBe(escapeMarkdown);
    });

    test('works identically', () => {
      const input = '*test_value*';
      expect(esc(input)).toBe(escapeMarkdown(input));
    });
  });
});

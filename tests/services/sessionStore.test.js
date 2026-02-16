/**
 * Tests for src/services/sessionStore.js
 * Uses real file system with a temp directory.
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// We can't easily mock the SESSION_FILE constant, so we test the
// SessionStore class behaviour by creating a fresh instance each time.

describe('SessionStore', () => {
  // We'll test using the actual module which is a singleton.
  // We need to be careful to reset between tests.
  let sessionStore;
  const SESSION_FILE = path.resolve(__dirname, '../../.sessions.json');

  beforeEach(() => {
    jest.resetModules();
    // Clean up any leftover session file
    try { fs.unlinkSync(SESSION_FILE); } catch { /* ignore */ }
    sessionStore = require('../../src/services/sessionStore');
    sessionStore.stopAutoSave();
  });

  afterEach(() => {
    sessionStore.stopAutoSave();
    try { fs.unlinkSync(SESSION_FILE); } catch { /* ignore */ }
  });

  // ─── save() ─────────────────────────────────────────────

  describe('save()', () => {
    test('creates .sessions.json file', () => {
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.save(bot);

      expect(fs.existsSync(SESSION_FILE)).toBe(true);
    });

    test('writes valid JSON with expected structure', () => {
      const bot = {
        userStates: new Map([['123', { action: 'awaiting_region_sightings' }]]),
        lastPrompts: new Map([['123', { message: 'Enter location' }]]),
      };
      sessionStore.save(bot);

      const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      expect(raw).toHaveProperty('savedAt');
      expect(raw).toHaveProperty('userStates');
      expect(raw).toHaveProperty('lastPrompts');
      expect(raw.userStates).toHaveProperty('123');
      expect(raw.userStates['123'].action).toBe('awaiting_region_sightings');
    });

    test('includes ISO timestamp', () => {
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.save(bot);

      const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      expect(raw.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ─── restore() ──────────────────────────────────────────

  describe('restore()', () => {
    test('restores userStates and lastPrompts from file', () => {
      // First, save some state
      const botSave = {
        userStates: new Map([['456', { action: 'date_selection' }]]),
        lastPrompts: new Map([['456', { message: 'Pick a date' }]]),
      };
      sessionStore.save(botSave);

      // Now restore into a fresh bot
      const botRestore = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(botRestore);

      expect(botRestore.userStates.get('456')).toEqual({ action: 'date_selection' });
      expect(botRestore.lastPrompts.get('456')).toEqual({ message: 'Pick a date' });
    });

    test('does nothing when no session file exists', () => {
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(bot);
      expect(bot.userStates.size).toBe(0);
    });

    test('discards sessions older than 1 hour', () => {
      // Write a stale session file
      const staleData = {
        savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        userStates: { '789': { action: 'test' } },
        lastPrompts: {},
      };
      fs.writeFileSync(SESSION_FILE, JSON.stringify(staleData), 'utf-8');

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(bot);

      // Should discard stale data
      expect(bot.userStates.size).toBe(0);
      // File should be cleaned up
      expect(fs.existsSync(SESSION_FILE)).toBe(false);
    });

    test('handles corrupt JSON gracefully', () => {
      fs.writeFileSync(SESSION_FILE, 'NOT VALID JSON!!!', 'utf-8');

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      // Should not throw
      expect(() => sessionStore.restore(bot)).not.toThrow();
      expect(bot.userStates.size).toBe(0);
    });
  });

  // ─── startAutoSave / stopAutoSave ──────────────────────

  describe('startAutoSave() / stopAutoSave()', () => {
    test('starts a timer (no error)', () => {
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      expect(() => sessionStore.startAutoSave(bot)).not.toThrow();
      sessionStore.stopAutoSave();
    });

    test('stopAutoSave clears the timer', () => {
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.startAutoSave(bot);
      sessionStore.stopAutoSave();
      expect(sessionStore._timer).toBeNull();
    });

    test('stopAutoSave is safe to call with no timer', () => {
      sessionStore._timer = null;
      expect(() => sessionStore.stopAutoSave()).not.toThrow();
    });
  });

  describe('save() error handling', () => {
    test('logs error when fs.writeFileSync throws', () => {
      const logger = require('../../src/utils/logger');
      const origWriteFileSync = fs.writeFileSync;

      // Temporarily replace writeFileSync to throw
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('disk full');
      });

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      // Should not throw
      expect(() => sessionStore.save(bot)).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save sessions',
        expect.objectContaining({ error: 'disk full' })
      );

      // Restore original
      fs.writeFileSync = origWriteFileSync;
    });
  });

  // ─── round-trip ─────────────────────────────────────────

  describe('round-trip save → restore', () => {
    test('preserves multiple users', () => {
      const botSave = {
        userStates: new Map([
          ['111', { action: 'a1' }],
          ['222', { action: 'a2' }],
          ['333', { action: 'a3' }],
        ]),
        lastPrompts: new Map([
          ['111', { message: 'm1' }],
        ]),
      };
      sessionStore.save(botSave);

      const botRestore = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(botRestore);

      expect(botRestore.userStates.size).toBe(3);
      expect(botRestore.lastPrompts.size).toBe(1);
      expect(botRestore.userStates.get('222')).toEqual({ action: 'a2' });
    });
  });

  describe('restore — partial session data', () => {
    test('restores gracefully when session file has no userStates', () => {
      const data = {
        savedAt: new Date().toISOString(),
        lastPrompts: { '123': { message: 'hello' } },
      };
      fs.writeFileSync(SESSION_FILE, JSON.stringify(data), 'utf-8');

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(bot);

      expect(bot.userStates.size).toBe(0);
      expect(bot.lastPrompts.size).toBe(1);
    });

    test('restores gracefully when session file has no lastPrompts', () => {
      const data = {
        savedAt: new Date().toISOString(),
        userStates: { '456': { action: 'test' } },
      };
      fs.writeFileSync(SESSION_FILE, JSON.stringify(data), 'utf-8');

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.restore(bot);

      expect(bot.userStates.size).toBe(1);
      expect(bot.lastPrompts.size).toBe(0);
    });
  });

  describe('startAutoSave — timer.unref branch', () => {
    test('works even if timer lacks unref method', () => {
      const origSetInterval = global.setInterval;
      // Return a timer-like object without .unref
      global.setInterval = jest.fn(() => ({ ref: jest.fn() }));

      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.startAutoSave(bot);

      // Should not throw
      expect(global.setInterval).toHaveBeenCalled();

      // Cleanup: restore and stop
      global.setInterval = origSetInterval;
      sessionStore._timer = null;
    });
  });

  describe('_cleanup — branch coverage', () => {
    test('does nothing when session file does not exist', () => {
      // Ensure no session file exists
      try { fs.unlinkSync(SESSION_FILE); } catch {}
      
      // Should not throw
      expect(() => sessionStore._cleanup()).not.toThrow();
    });

    test('handles error from unlinkSync gracefully', () => {
      // Create a session file first
      fs.writeFileSync(SESSION_FILE, '{}', 'utf-8');
      
      const origUnlink = fs.unlinkSync;
      fs.unlinkSync = jest.fn(() => { throw new Error('permission denied'); });
      
      // Should not throw (silently caught)
      expect(() => sessionStore._cleanup()).not.toThrow();
      
      fs.unlinkSync = origUnlink;
    });
  });

  describe('stopAutoSave — branch coverage', () => {
    test('handles stopAutoSave when no timer is running', () => {
      sessionStore._timer = null;
      expect(() => sessionStore.stopAutoSave()).not.toThrow();
    });
  });

  describe('startAutoSave — timer callback fires', () => {
    test('setInterval callback calls save(bot)', () => {
      jest.useFakeTimers();
      const bot = { userStates: new Map(), lastPrompts: new Map() };
      sessionStore.startAutoSave(bot);

      // Fast-forward time to trigger the callback
      jest.advanceTimersByTime(30000);

      // The save method should have been called via the timer callback
      // Check that the session file was written (save creates it)
      expect(fs.existsSync(SESSION_FILE)).toBe(true);

      sessionStore.stopAutoSave();
      jest.useRealTimers();
    });
  });
});

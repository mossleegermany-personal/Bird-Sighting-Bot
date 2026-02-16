/**
 * Session Store — persists user states to a local JSON file so they survive restarts.
 *
 * Saves userStates, lastPrompts, and observationsCache periodically (every 30 s)
 * and on graceful shutdown.  On boot the bot reloads the last-saved snapshot.
 *
 * File-based storage is intentional: it's fast, has zero external dependencies,
 * and the data is inherently short-lived (mid-flow conversation state).
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SESSION_FILE = path.resolve(__dirname, '../../.sessions.json');
const SAVE_INTERVAL = 30 * 1000; // auto-save every 30 seconds

class SessionStore {
  constructor() {
    this._timer = null;
  }

  /**
   * Start periodic auto-save.
   * @param {BirdBot} bot - the bot instance whose Maps we persist
   */
  startAutoSave(bot) {
    this._timer = setInterval(() => this.save(bot), SAVE_INTERVAL);
    // Don't prevent the process from exiting
    if (this._timer.unref) this._timer.unref();
    logger.debug('Session auto-save started', { intervalSec: SAVE_INTERVAL / 1000 });
  }

  stopAutoSave() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Persist bot state Maps to disk.
   */
  save(bot) {
    try {
      const data = {
        savedAt: new Date().toISOString(),
        userStates: _mapToObj(bot.userStates),
        lastPrompts: _mapToObj(bot.lastPrompts),
        // observationsCache can be large; only save metadata (not full obs arrays)
        // so we don't bloat the file — users will just re-fetch if needed
      };

      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug('Sessions saved', { users: bot.userStates.size });
    } catch (error) {
      logger.error('Failed to save sessions', { error: error.message });
    }
  }

  /**
   * Restore bot state Maps from disk.  Call once during construction.
   */
  restore(bot) {
    try {
      if (!fs.existsSync(SESSION_FILE)) return;

      const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
      const data = JSON.parse(raw);

      // Discard sessions older than 1 hour — they're stale
      const savedAt = new Date(data.savedAt);
      const ageMs = Date.now() - savedAt.getTime();
      if (ageMs > 60 * 60 * 1000) {
        logger.info('Discarded stale session file', { ageMin: Math.round(ageMs / 60000) });
        this._cleanup();
        return;
      }

      if (data.userStates) {
        _objToMap(data.userStates, bot.userStates);
      }
      if (data.lastPrompts) {
        _objToMap(data.lastPrompts, bot.lastPrompts);
      }

      logger.info('Sessions restored', {
        users: bot.userStates.size,
        savedAt: data.savedAt
      });
    } catch (error) {
      logger.error('Failed to restore sessions', { error: error.message });
      this._cleanup();
    }
  }

  /** Remove the session file (e.g. after stale / corrupt). */
  _cleanup() {
    try {
      if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    } catch { /* ignore */ }
  }
}

/* ── helpers ────────────────────────────────────────────── */

function _mapToObj(map) {
  const obj = {};
  for (const [k, v] of map) {
    obj[String(k)] = v;
  }
  return obj;
}

function _objToMap(obj, map) {
  for (const [k, v] of Object.entries(obj)) {
    map.set(k, v);
  }
}

// Singleton
module.exports = new SessionStore();

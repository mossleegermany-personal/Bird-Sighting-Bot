/**
 * BirdBot — Telegram Bird Sighting Bot (main class).
 *
 * This file defines the class shell (constructor, bot init, setup)
 * and mixes in handler methods from src/bot/handlers/*.
 * Each handler group lives in its own module for maintainability.
 */
const TelegramBot = require('node-telegram-bot-api');
const EBirdService = require('../services/ebirdService');
const logger = require('../utils/logger');
const sessionStore = require('../services/sessionStore');

// Import all handler groups
const {
  commandHandlers,
  sightingsHandlers,
  notableHandlers,
  nearbyHandlers,
  hotspotHandlers,
  speciesHandlers,
  displayHandlers,
  callbackHandlers,
  messageHandler
} = require('./handlers');

class BirdBot {
  constructor(telegramToken, ebirdApiKey, options = {}) {
    this.telegramToken = telegramToken;
    this.ebirdApiKey = ebirdApiKey;
    this.useWebhook = options.useWebhook || false;
    
    this._initBot();
    
    this.ebirdService = new EBirdService(ebirdApiKey);
    this.userStates = new Map(); // Track user conversation states
    this.userNames = new Map();  // Track Telegram usernames (separate from state)
    this.observationsCache = new Map(); // Cache observations for pagination
    this.lastPrompts = new Map(); // Store last prompt messages for error recovery
    this.ITEMS_PER_PAGE = 5; // Number of observations per page

    // ── Rate limiting ────────────────────────────────────────
    this.rateLimits = new Map();          // chatId → { count, resetTime }
    this.RATE_LIMIT_MAX = 15;             // max requests per window
    this.RATE_LIMIT_WINDOW = 60 * 1000;   // 60-second rolling window

    // ── Session persistence ──────────────────────────────────
    sessionStore.restore(this);           // reload user states from last run
    sessionStore.startAutoSave(this);     // auto-save every 30 s
    
    this.setupCommands();
    this.setupHandlers();
  }

  /**
   * Create the underlying TelegramBot instance.
   * Webhook for Azure production, polling for local development.
   */
  _initBot() {
    if (this.useWebhook) {
      this.bot = new TelegramBot(this.telegramToken, { webHook: true });
    } else {
      this.bot = new TelegramBot(this.telegramToken, {
        polling: { autoStart: true, params: { timeout: 30 } }
      });
    }

    this.bot.on('polling_error', (err) => {
      logger.error('Polling error', { error: err.message || String(err) });
    });
    this.bot.on('error', (err) => {
      logger.error('Bot error', { error: err.message || String(err) });
    });
  }

  // Process incoming webhook updates
  processUpdate(update) {
    this.bot.processUpdate(update);
  }

  setupCommands() {
    // Set up bot commands for the menu
    this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot and see welcome message' },
      { command: 'help', description: 'Show all available commands' },
      { command: 'sightings', description: 'Search by LOCATION - see all birds in an area' },
      { command: 'species', description: 'Search by SPECIES - find where a bird was seen' },
      { command: 'notable', description: 'Get notable/rare bird sightings' },
      { command: 'nearby', description: 'Get sightings near your location' },
      { command: 'hotspots', description: 'Find birding hotspots' },
      { command: 'regions', description: 'Learn about region codes' }
    ]);
  }

  setupHandlers() {
    // Wrap async handlers so no error ever crashes the process.
    // Also sends a friendly error message to the user.
    const safe = (fn) => async (...args) => {
      try {
        // ── Rate limit check ──────────────────────────────
        const arg = args[0];
        const chatId = arg?.chat?.id || arg?.message?.chat?.id || null;
        if (chatId && this._isRateLimited(chatId)) {
          logger.warn('Rate limited', { chatId });
          await this.sendMessage(chatId, '⏳ You\'re sending requests too fast. Please wait a moment and try again.');
          return;
        }
        await fn(...args);
      } catch (err) {
        logger.error('Unhandled handler error', { error: err.message, stack: err.stack });
        // Try to notify the user — extract chatId from the first argument
        try {
          const arg = args[0];
          const chatId = arg?.chat?.id            // msg objects
            || arg?.message?.chat?.id              // callback_query objects
            || null;
          if (chatId) {
            await this.sendMessage(chatId,
              '⚠️ Something went wrong. Please try again or send /start to restart.',
              {
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🔄 Try Again', callback_data: 'new_search' },
                    { text: '🏠 Start Over', callback_data: 'cmd_start' }
                  ]]
                }
              }
            );
          }
        } catch (_) { /* ignore send errors */ }
      }
    };

    // Command handlers
    this.bot.onText(/\/start/, safe((msg) => this.handleStart(msg)));
    this.bot.onText(/\/help/, safe((msg) => this.handleHelp(msg)));
    this.bot.onText(/\/sightings(.*)/, safe((msg, match) => this.handleSightings(msg, match)));
    this.bot.onText(/\/notable(.*)/, safe((msg, match) => this.handleNotable(msg, match)));
    this.bot.onText(/\/nearby/, safe((msg) => this.handleNearby(msg)));
    this.bot.onText(/\/hotspots(.*)/, safe((msg, match) => this.handleHotspots(msg, match)));
    this.bot.onText(/\/species(.*)/, safe((msg, match) => this.handleSpecies(msg, match)));
    this.bot.onText(/\/regions/, safe((msg) => this.handleRegions(msg)));

    // Handle location sharing
    this.bot.on('location', safe((msg) => this.handleLocation(msg)));

    // Handle callback queries (button presses)
    this.bot.on('callback_query', safe((callbackQuery) => this.handleCallback(callbackQuery)));

    // Handle text messages for conversation flow
    this.bot.on('message', safe((msg) => this.handleMessage(msg)));

    logger.info('Bird Sighting Bot handlers registered');
  }

  // ── Shared utility methods ──────────────────────────────────

  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      logger.error('Error sending message', { chatId, error: error.message });
      // Try sending without markdown if there's a parse error
      if (error.message.includes('parse')) {
        return await this.bot.sendMessage(chatId, text.replace(/[*_`]/g, ''), options);
      }
    }
  }

  /**
   * Delete a message silently (ignore errors if already deleted)
   */
  async deleteMsg(chatId, messageId) {
    if (!messageId) return;
    try {
      await this.bot.deleteMessage(chatId, messageId);
    } catch (_) { /* ignore */ }
  }

  getBot() {
    return this.bot;
  }

  /**
   * Check and enforce per-user rate limiting.
   * Returns true if the user has exceeded the limit.
   */
  _isRateLimited(chatId) {
    const now = Date.now();
    const entry = this.rateLimits.get(chatId);

    if (!entry || now > entry.resetTime) {
      // New window
      this.rateLimits.set(chatId, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      return false;
    }

    entry.count++;
    if (entry.count > this.RATE_LIMIT_MAX) {
      return true;
    }
    return false;
  }
}

// ── Mix handler methods into BirdBot prototype ───────────────
// This allows each handler file to use `this` as the bot instance.
Object.assign(BirdBot.prototype,
  commandHandlers,
  sightingsHandlers,
  notableHandlers,
  nearbyHandlers,
  hotspotHandlers,
  speciesHandlers,
  displayHandlers,
  callbackHandlers,
  messageHandler
);

module.exports = BirdBot;

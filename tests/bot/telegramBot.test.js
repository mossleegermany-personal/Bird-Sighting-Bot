/**
 * Tests for BirdBot class — constructor, rate limiting, safe wrapper, sendMessage
 * Mocks Telegram bot API and external services.
 */

// Mock TelegramBot
jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    onText: jest.fn(),
    setMyCommands: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
    deleteMessage: jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue(true),
    processUpdate: jest.fn(),
  }));
});

// Mock services
jest.mock('../../src/services/ebirdService', () => {
  return jest.fn().mockImplementation(() => ({
    preloadTaxonomy: jest.fn(),
    getRecentObservations: jest.fn(),
    formatObservation: jest.fn().mockReturnValue('formatted obs'),
  }));
});

jest.mock('../../src/services/sessionStore', () => ({
  restore: jest.fn(),
  startAutoSave: jest.fn(),
  stopAutoSave: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const BirdBot = require('../../src/bot/telegramBot');
const loggerMock = require('../../src/utils/logger');

describe('BirdBot', () => {
  let bot;

  beforeEach(() => {
    jest.clearAllMocks();
    bot = new BirdBot('test-token', 'test-ebird-key');
  });

  // ─── Constructor ────────────────────────────────────────

  describe('constructor', () => {
    test('initializes userStates as an empty Map', () => {
      expect(bot.userStates).toBeInstanceOf(Map);
      expect(bot.userStates.size).toBe(0);
    });

    test('initializes userNames as an empty Map', () => {
      expect(bot.userNames).toBeInstanceOf(Map);
      expect(bot.userNames.size).toBe(0);
    });

    test('initializes observationsCache as an empty Map', () => {
      expect(bot.observationsCache).toBeInstanceOf(Map);
    });

    test('initializes lastPrompts as an empty Map', () => {
      expect(bot.lastPrompts).toBeInstanceOf(Map);
    });

    test('sets ITEMS_PER_PAGE to 5', () => {
      expect(bot.ITEMS_PER_PAGE).toBe(5);
    });

    test('sets rate limit constants', () => {
      expect(bot.RATE_LIMIT_MAX).toBe(15);
      expect(bot.RATE_LIMIT_WINDOW).toBe(60000);
    });

    test('calls sessionStore.restore on construction', () => {
      const sessionStore = require('../../src/services/sessionStore');
      expect(sessionStore.restore).toHaveBeenCalled();
    });

    test('calls sessionStore.startAutoSave on construction', () => {
      const sessionStore = require('../../src/services/sessionStore');
      expect(sessionStore.startAutoSave).toHaveBeenCalled();
    });
  });

  // ─── Rate Limiting ──────────────────────────────────────

  describe('_isRateLimited()', () => {
    test('returns false for first request', () => {
      expect(bot._isRateLimited(12345)).toBe(false);
    });

    test('returns false for requests under the limit', () => {
      for (let i = 0; i < 14; i++) {
        bot._isRateLimited(12345);
      }
      expect(bot._isRateLimited(12345)).toBe(false);
    });

    test('returns true after exceeding RATE_LIMIT_MAX', () => {
      const chatId = 99999;
      // Fill up the limit
      for (let i = 0; i < bot.RATE_LIMIT_MAX; i++) {
        bot._isRateLimited(chatId);
      }
      // Next one should be rate limited
      expect(bot._isRateLimited(chatId)).toBe(true);
    });

    test('different users have independent limits', () => {
      const chatA = 1001;
      const chatB = 1002;

      // Exhaust limit for chatA
      for (let i = 0; i < bot.RATE_LIMIT_MAX; i++) {
        bot._isRateLimited(chatA);
      }
      expect(bot._isRateLimited(chatA)).toBe(true);
      // chatB should still be fine
      expect(bot._isRateLimited(chatB)).toBe(false);
    });

    test('resets after the window expires', () => {
      const chatId = 2001;

      // Fill limit
      for (let i = 0; i < bot.RATE_LIMIT_MAX; i++) {
        bot._isRateLimited(chatId);
      }
      expect(bot._isRateLimited(chatId)).toBe(true);

      // Simulate window expiration by manipulating the entry
      const entry = bot.rateLimits.get(chatId);
      entry.resetTime = Date.now() - 1; // expired

      // Should reset and allow
      expect(bot._isRateLimited(chatId)).toBe(false);
    });
  });

  // ─── sendMessage ────────────────────────────────────────

  describe('sendMessage()', () => {
    test('sends message with Markdown parse mode', async () => {
      await bot.sendMessage(12345, 'Hello');
      expect(bot.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        'Hello',
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    test('merges custom options', async () => {
      await bot.sendMessage(12345, 'Hello', { disable_notification: true });
      expect(bot.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        'Hello',
        expect.objectContaining({
          parse_mode: 'Markdown',
          disable_notification: true,
        })
      );
    });

    test('returns the sent message object', async () => {
      const result = await bot.sendMessage(12345, 'Hello');
      expect(result).toHaveProperty('message_id', 1);
    });

    test('retries without markdown on parse error', async () => {
      bot.bot.sendMessage
        .mockRejectedValueOnce(new Error('parse error'))
        .mockResolvedValueOnce({ message_id: 2 });

      const result = await bot.sendMessage(12345, '*bold*');
      // Second call should strip markdown
      expect(bot.bot.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  // ─── deleteMsg ──────────────────────────────────────────

  describe('deleteMsg()', () => {
    test('calls deleteMessage with correct params', async () => {
      await bot.deleteMsg(12345, 999);
      expect(bot.bot.deleteMessage).toHaveBeenCalledWith(12345, 999);
    });

    test('silently ignores errors', async () => {
      bot.bot.deleteMessage.mockRejectedValue(new Error('message not found'));
      await expect(bot.deleteMsg(12345, 999)).resolves.toBeUndefined();
    });

    test('does nothing when messageId is null', async () => {
      await bot.deleteMsg(12345, null);
      expect(bot.bot.deleteMessage).not.toHaveBeenCalled();
    });

    test('does nothing when messageId is undefined', async () => {
      await bot.deleteMsg(12345, undefined);
      expect(bot.bot.deleteMessage).not.toHaveBeenCalled();
    });
  });

  // ─── getBot ─────────────────────────────────────────────

  describe('getBot()', () => {
    test('returns the underlying TelegramBot instance', () => {
      expect(bot.getBot()).toBe(bot.bot);
    });
  });

  // ─── processUpdate ──────────────────────────────────────

  describe('processUpdate()', () => {
    test('delegates to bot.processUpdate', () => {
      const update = { update_id: 1 };
      bot.processUpdate(update);
      expect(bot.bot.processUpdate).toHaveBeenCalledWith(update);
    });
  });

  // ─── Webhook vs Polling ─────────────────────────────────

  describe('webhook mode', () => {
    test('creates bot with webHook option when useWebhook=true', () => {
      const TelegramBot = require('node-telegram-bot-api');
      TelegramBot.mockClear();

      const webhookBot = new BirdBot('token', 'key', { useWebhook: true });
      expect(TelegramBot).toHaveBeenCalledWith('token', { webHook: true });
    });

    test('creates bot with polling when useWebhook=false', () => {
      const TelegramBot = require('node-telegram-bot-api');
      TelegramBot.mockClear();

      const pollingBot = new BirdBot('token', 'key', { useWebhook: false });
      expect(TelegramBot).toHaveBeenCalledWith('token', {
        polling: { autoStart: true, params: { timeout: 30 } },
      });
    });
  });

  // ─── Event handlers (polling_error, error) ──────────────

  describe('bot event handlers', () => {
    test('registers polling_error handler that logs errors', () => {
      // Find the polling_error handler registered via bot.on
      const onCalls = bot.bot.on.mock.calls;
      const pollingErrorCall = onCalls.find(c => c[0] === 'polling_error');
      expect(pollingErrorCall).toBeTruthy();

      // Invoke the handler
      pollingErrorCall[1](new Error('poll fail'));
      expect(loggerMock.error).toHaveBeenCalledWith('Polling error', expect.objectContaining({ error: 'poll fail' }));
    });

    test('registers error handler that logs errors', () => {
      const onCalls = bot.bot.on.mock.calls;
      const errorCall = onCalls.find(c => c[0] === 'error');
      expect(errorCall).toBeTruthy();

      errorCall[1](new Error('bot crash'));
      expect(loggerMock.error).toHaveBeenCalledWith('Bot error', expect.objectContaining({ error: 'bot crash' }));
    });

    test('polling_error handler uses String(err) when no message', () => {
      const onCalls = bot.bot.on.mock.calls;
      const pollingErrorCall = onCalls.find(c => c[0] === 'polling_error');
      pollingErrorCall[1]('string error');
      expect(loggerMock.error).toHaveBeenCalledWith('Polling error', { error: 'string error' });
    });

    test('error handler uses String(err) when no message', () => {
      const onCalls = bot.bot.on.mock.calls;
      const errorCall = onCalls.find(c => c[0] === 'error');
      errorCall[1]({ toString: () => 'raw object' });
      expect(loggerMock.error).toHaveBeenCalledWith('Bot error', { error: 'raw object' });
    });
  });

  // ─── safe() wrapper — rate limiting & error handling ────

  describe('safe() wrapper', () => {
    test('rate-limited user gets throttle message', async () => {
      // Exhaust the rate limit
      for (let i = 0; i < bot.RATE_LIMIT_MAX; i++) {
        bot._isRateLimited(5555);
      }

      // Trigger a command handler through the actual registered onText
      // We need to find the safe-wrapped handler and call it
      const onTextCalls = bot.bot.onText.mock.calls;
      // /start handler is the first onText registration
      const startHandler = onTextCalls.find(c => c[0].toString().includes('start'));
      expect(startHandler).toBeTruthy();

      // Call the safe-wrapped handler with a rate-limited chatId
      const msg = { chat: { id: 5555 }, from: { first_name: 'Test' } };
      await startHandler[1](msg);

      // Should send rate limit message
      expect(bot.bot.sendMessage).toHaveBeenCalledWith(
        5555, expect.stringContaining('too fast'), expect.any(Object)
      );
    });

    test('unhandled error in handler sends fallback message to user', async () => {
      // Override handleStart to throw, which safe() should catch
      bot.handleStart = jest.fn().mockRejectedValue(new Error('unexpected'));

      const onTextCalls = bot.bot.onText.mock.calls;
      const startHandler = onTextCalls.find(c => c[0].toString().includes('start'));
      const msg = { chat: { id: 7777 }, from: { first_name: 'Test' } };

      // Should not throw — safe() catches it
      await expect(startHandler[1](msg)).resolves.toBeUndefined();

      // Should have attempted the error-recovery message
      expect(bot.bot.sendMessage).toHaveBeenCalledWith(
        7777, expect.stringContaining('Something went wrong'), expect.any(Object)
      );
    });

    test('safe wrapper handles callback_query chatId extraction', async () => {
      // Exhaust rate limit for this user
      for (let i = 0; i < bot.RATE_LIMIT_MAX; i++) {
        bot._isRateLimited(8888);
      }

      // Find the callback_query handler
      const onCalls = bot.bot.on.mock.calls;
      const cbHandler = onCalls.find(c => c[0] === 'callback_query');
      expect(cbHandler).toBeTruthy();

      const cbQuery = { message: { chat: { id: 8888 } }, data: 'cmd_start' };
      await cbHandler[1](cbQuery);

      expect(bot.bot.sendMessage).toHaveBeenCalledWith(
        8888, expect.stringContaining('too fast'), expect.any(Object)
      );
    });

    test('safe wrapper ignores send errors during error recovery', async () => {
      // Make handler throw AND sendMessage fail during recovery
      bot.handleStart = jest.fn().mockRejectedValue(new Error('handler boom'));
      bot.bot.sendMessage.mockRejectedValue(new Error('everything broken'));

      const onTextCalls = bot.bot.onText.mock.calls;
      const startHandler = onTextCalls.find(c => c[0].toString().includes('start'));
      const msg = { chat: { id: 9999 }, from: { first_name: 'Test' } };

      // Should still not throw even when error recovery fails
      await expect(startHandler[1](msg)).resolves.toBeUndefined();
    });

    test('safe wrapper skips rate-limit when chatId is null (no chat.id)', async () => {
      const onTextCalls = bot.bot.onText.mock.calls;
      const startHandler = onTextCalls.find(c => c[0].toString().includes('start'));

      // Pass arg with no chat.id — chatId becomes null
      const msg = { from: { first_name: 'Test' } };
      // Should not throw — safe() skips rate limit when chatId is null
      await expect(startHandler[1](msg)).resolves.toBeUndefined();
    });

    test('safe wrapper skips error-recovery send when chatId is null', async () => {
      bot.handleStart = jest.fn().mockRejectedValue(new Error('crash'));

      const onTextCalls = bot.bot.onText.mock.calls;
      const startHandler = onTextCalls.find(c => c[0].toString().includes('start'));

      // Pass arg with no chat.id — error recovery can't send message
      const msg = { from: { first_name: 'Test' } };
      await expect(startHandler[1](msg)).resolves.toBeUndefined();

      // sendMessage should NOT be called (no chatId to send to)
      expect(bot.bot.sendMessage).not.toHaveBeenCalled();
    });
  });

  // ─── setupCommands ──────────────────────────────────────

  describe('setupCommands()', () => {
    test('registers all 8 bot commands', () => {
      expect(bot.bot.setMyCommands).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'start' }),
          expect.objectContaining({ command: 'help' }),
          expect.objectContaining({ command: 'sightings' }),
          expect.objectContaining({ command: 'species' }),
          expect.objectContaining({ command: 'notable' }),
          expect.objectContaining({ command: 'nearby' }),
          expect.objectContaining({ command: 'hotspots' }),
          expect.objectContaining({ command: 'regions' }),
        ])
      );
    });
  });

  // ─── setupHandlers ─────────────────────────────────────

  describe('setupHandlers()', () => {
    test('registers onText handlers for all commands', () => {
      const patterns = bot.bot.onText.mock.calls.map(c => c[0].toString());
      expect(patterns).toEqual(expect.arrayContaining([
        expect.stringContaining('start'),
        expect.stringContaining('help'),
        expect.stringContaining('sightings'),
        expect.stringContaining('notable'),
        expect.stringContaining('nearby'),
        expect.stringContaining('hotspots'),
        expect.stringContaining('species'),
        expect.stringContaining('regions'),
      ]));
    });

    test('registers location, callback_query, and message handlers', () => {
      const events = bot.bot.on.mock.calls.map(c => c[0]);
      expect(events).toContain('location');
      expect(events).toContain('callback_query');
      expect(events).toContain('message');
    });

    test('logs handler registration', () => {
      expect(loggerMock.info).toHaveBeenCalledWith('Bird Sighting Bot handlers registered');
    });
  });

  // ─── sendMessage edge cases ─────────────────────────────

  describe('sendMessage() edge cases', () => {
    test('does not retry for non-parse errors', async () => {
      bot.bot.sendMessage.mockRejectedValueOnce(new Error('network timeout'));

      const result = await bot.sendMessage(12345, 'Hello');
      // Only one call — no retry
      expect(bot.bot.sendMessage).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    test('logs error on send failure', async () => {
      bot.bot.sendMessage.mockRejectedValueOnce(new Error('network timeout'));

      await bot.sendMessage(12345, 'Hello');
      expect(loggerMock.error).toHaveBeenCalledWith('Error sending message', expect.objectContaining({ chatId: 12345 }));
    });
  });

  // ─── Inner handler delegation (fn coverage) ─────────────
  // Each safe-wrapped handler contains an inner arrow function
  // (e.g. `(msg) => this.handleStart(msg)`) that gets counted
  // as a separate function by Istanbul. These tests invoke each
  // so the inner `fn` body executes at least once.

  describe('handler delegation through safe()', () => {
    const msg = { chat: { id: 11111 }, from: { first_name: 'T' }, text: '' };

    test('/start delegates to handleStart', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('start'));
      await handler[1](msg);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/help delegates to handleHelp', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('help'));
      await handler[1](msg);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/sightings delegates to handleSightings', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('sightings'));
      await handler[1](msg, [null, '']);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/notable delegates to handleNotable', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('notable'));
      await handler[1](msg, [null, '']);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/nearby delegates to handleNearby', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('nearby'));
      await handler[1](msg);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/hotspots delegates to handleHotspots', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('hotspots'));
      await handler[1](msg, [null, '']);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/species delegates to handleSpecies', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('species'));
      await handler[1](msg, [null, '']);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('/regions delegates to handleRegions', async () => {
      const handler = bot.bot.onText.mock.calls.find(c => c[0].toString().includes('regions'));
      await handler[1](msg);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('location event delegates to handleLocation', async () => {
      const onCalls = bot.bot.on.mock.calls;
      const handler = onCalls.find(c => c[0] === 'location');
      const locMsg = { chat: { id: 11111 }, from: { first_name: 'T' }, location: { latitude: 1.35, longitude: 103.82 } };
      await handler[1](locMsg);
      expect(bot.bot.sendMessage).toHaveBeenCalled();
    });

    test('callback_query event delegates to handleCallback', async () => {
      const onCalls = bot.bot.on.mock.calls;
      const handler = onCalls.find(c => c[0] === 'callback_query');
      const cbQuery = { id: 'cb1', message: { chat: { id: 11111 } }, data: 'done' };
      await handler[1](cbQuery);
    });

    test('message event delegates to handleMessage', async () => {
      const onCalls = bot.bot.on.mock.calls;
      const handler = onCalls.find(c => c[0] === 'message');
      // No user state → ignored, but fn is still invoked
      await handler[1](msg);
    });
  });
});

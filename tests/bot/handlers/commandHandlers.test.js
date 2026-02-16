/**
 * Tests for commandHandlers — /start, /help, /regions
 */
const commandHandlers = require('../../../src/bot/handlers/commandHandlers');

describe('commandHandlers', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
    };
  });

  // ─── handleStart ────────────────────────────────────────

  describe('handleStart()', () => {
    test('sends welcome message to the chat', async () => {
      const msg = { chat: { id: 123 }, from: { first_name: 'Alice' } };
      await commandHandlers.handleStart.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledTimes(1);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Welcome to the Bird Sighting Bot')
      );
    });

    test('includes the user first name in the greeting', async () => {
      const msg = { chat: { id: 123 }, from: { first_name: 'Bob' } };
      await commandHandlers.handleStart.call(ctx, msg);

      const sentText = ctx.sendMessage.mock.calls[0][1];
      expect(sentText).toContain('Bob');
    });

    test('falls back to "Birder" when first_name is empty', async () => {
      const msg = { chat: { id: 123 }, from: {} };
      await commandHandlers.handleStart.call(ctx, msg);

      const sentText = ctx.sendMessage.mock.calls[0][1];
      expect(sentText).toContain('Birder');
    });

    test('mentions /sightings and /species commands', async () => {
      const msg = { chat: { id: 1 }, from: { first_name: 'X' } };
      await commandHandlers.handleStart.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];
      expect(sentText).toContain('/sightings');
      expect(sentText).toContain('/species');
    });

    test('mentions /notable, /nearby, /hotspots', async () => {
      const msg = { chat: { id: 1 }, from: { first_name: 'X' } };
      await commandHandlers.handleStart.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];
      expect(sentText).toContain('/notable');
      expect(sentText).toContain('/nearby');
      expect(sentText).toContain('/hotspots');
    });

    test('escapes markdown special chars in first_name', async () => {
      const msg = { chat: { id: 1 }, from: { first_name: 'Mr_Under[score]' } };
      await commandHandlers.handleStart.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];
      // The esc function should have escaped _ and [ ]
      expect(sentText).not.toContain('Mr_Under[');
    });
  });

  // ─── handleHelp ─────────────────────────────────────────

  describe('handleHelp()', () => {
    test('sends a help message', async () => {
      const msg = { chat: { id: 456 } };
      await commandHandlers.handleHelp.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledTimes(1);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        456,
        expect.stringContaining('Help')
      );
    });

    test('lists available commands', async () => {
      const msg = { chat: { id: 456 } };
      await commandHandlers.handleHelp.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];

      expect(sentText).toContain('/sightings');
      expect(sentText).toContain('/species');
      expect(sentText).toContain('/notable');
      expect(sentText).toContain('/nearby');
      expect(sentText).toContain('/hotspots');
      expect(sentText).toContain('/regions');
    });

    test('includes usage examples', async () => {
      const msg = { chat: { id: 456 } };
      await commandHandlers.handleHelp.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];
      expect(sentText).toMatch(/Singapore|New York|House Sparrow/);
    });
  });

  // ─── handleRegions ──────────────────────────────────────

  describe('handleRegions()', () => {
    test('sends regions message', async () => {
      const msg = { chat: { id: 789 } };
      await commandHandlers.handleRegions.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledTimes(1);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        789,
        expect.stringContaining('Region Codes')
      );
    });

    test('includes format examples (XX, XX-YY, XX-YY-ZZZ)', async () => {
      const msg = { chat: { id: 789 } };
      await commandHandlers.handleRegions.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];

      expect(sentText).toContain('XX');
      expect(sentText).toContain('XX-YY');
    });

    test('includes country examples', async () => {
      const msg = { chat: { id: 789 } };
      await commandHandlers.handleRegions.call(ctx, msg);
      const sentText = ctx.sendMessage.mock.calls[0][1];

      expect(sentText).toContain('US');
      expect(sentText).toContain('GB');
      expect(sentText).toContain('CA');
      expect(sentText).toContain('AU');
      expect(sentText).toContain('DE');
    });
  });
});

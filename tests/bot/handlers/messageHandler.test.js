/**
 * Tests for messageHandler — routes free-text based on conversation state.
 */
const messageHandler = require('../../../src/bot/handlers/messageHandler');

describe('messageHandler', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      userStates: new Map(),
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
      showDateSelection: jest.fn().mockResolvedValue(),
      handlePlaceSearch: jest.fn().mockResolvedValue(),
      handleCustomDateInput: jest.fn().mockResolvedValue(),
      handleHotspots: jest.fn().mockResolvedValue(),
      searchSpeciesGlobally: jest.fn().mockResolvedValue(),
      processSpeciesWithLocation: jest.fn().mockResolvedValue(),
      showSpeciesDateSelection: jest.fn().mockResolvedValue(),
      sendPaginatedObservations: jest.fn().mockResolvedValue(),
      observationsCache: new Map(),
    };
  });

  // ─── Basic routing ──────────────────────────────────────

  test('ignores command messages', async () => {
    const msg = { text: '/help', chat: { id: 1 } };
    ctx.userStates.set(1, { action: 'awaiting_region_sightings' });

    await messageHandler.handleMessage.call(ctx, msg);
    expect(ctx.showDateSelection).not.toHaveBeenCalled();
  });

  test('ignores location messages', async () => {
    const msg = { location: { latitude: 1, longitude: 2 }, chat: { id: 1 } };
    ctx.userStates.set(1, { action: 'awaiting_region_sightings' });

    await messageHandler.handleMessage.call(ctx, msg);
    expect(ctx.showDateSelection).not.toHaveBeenCalled();
  });

  test('ignores messages without user state', async () => {
    const msg = { text: 'hello', chat: { id: 1 } };
    await messageHandler.handleMessage.call(ctx, msg);
    expect(ctx.showDateSelection).not.toHaveBeenCalled();
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  test('ignores messages with empty text', async () => {
    const msg = { text: '   ', chat: { id: 1 } };
    ctx.userStates.set(1, { action: 'awaiting_region_sightings' });
    await messageHandler.handleMessage.call(ctx, msg);
    expect(ctx.showDateSelection).not.toHaveBeenCalled();
  });

  test('ignores messages with no text property', async () => {
    const msg = { chat: { id: 1 } };
    ctx.userStates.set(1, { action: 'awaiting_region_sightings' });
    await messageHandler.handleMessage.call(ctx, msg);
    expect(ctx.showDateSelection).not.toHaveBeenCalled();
  });

  // ─── awaiting_region_sightings ──────────────────────────

  describe('awaiting_region_sightings', () => {
    test('routes plain region name to showDateSelection', async () => {
      ctx.userStates.set(1, { action: 'awaiting_region_sightings' });
      const msg = { text: 'Singapore', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(
        1,
        expect.any(String), // resolved region code
        'Singapore',
        'sightings'
      );
      // State should be deleted
      expect(ctx.userStates.has(1)).toBe(false);
    });

    test('routes comma-separated input to handlePlaceSearch', async () => {
      ctx.userStates.set(1, { action: 'awaiting_region_sightings' });
      const msg = { text: 'Central Park, New York', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.handlePlaceSearch).toHaveBeenCalledWith(
        1,
        'Central Park, New York',
        'sightings'
      );
    });
  });

  // ─── awaiting_region_notable ────────────────────────────

  describe('awaiting_region_notable', () => {
    test('routes to showDateSelection for notable', async () => {
      ctx.userStates.set(1, { action: 'awaiting_region_notable' });
      const msg = { text: 'Malaysia', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(
        1,
        expect.any(String),
        'Malaysia',
        'notable'
      );
    });

    test('routes comma input to handlePlaceSearch for notable', async () => {
      ctx.userStates.set(1, { action: 'awaiting_region_notable' });
      const msg = { text: 'Botanic Gardens, Singapore', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.handlePlaceSearch).toHaveBeenCalledWith(
        1,
        'Botanic Gardens, Singapore',
        'notable'
      );
    });
  });

  // ─── awaiting_custom_date ───────────────────────────────

  describe('awaiting_custom_date', () => {
    test('delegates to handleCustomDateInput', async () => {
      const state = { action: 'awaiting_custom_date', regionCode: 'SG' };
      ctx.userStates.set(1, state);
      const msg = { text: '01/01/2026', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.handleCustomDateInput).toHaveBeenCalledWith(1, '01/01/2026', state);
    });
  });

  // ─── awaiting_region_hotspots ───────────────────────────

  describe('awaiting_region_hotspots', () => {
    test('delegates to handleHotspots', async () => {
      ctx.userStates.set(1, { action: 'awaiting_region_hotspots' });
      const msg = { text: 'Singapore', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.handleHotspots).toHaveBeenCalledWith(
        { chat: { id: 1 } },
        [null, ' Singapore']
      );
      expect(ctx.userStates.has(1)).toBe(false);
    });
  });

  // ─── awaiting_species_name ──────────────────────────────

  describe('awaiting_species_name', () => {
    test('plain text routes to searchSpeciesGlobally', async () => {
      ctx.userStates.set(1, { action: 'awaiting_species_name' });
      const msg = { text: 'House Sparrow', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.searchSpeciesGlobally).toHaveBeenCalledWith(1, 'House Sparrow');
    });

    test('comma input routes to processSpeciesWithLocation', async () => {
      ctx.userStates.set(1, { action: 'awaiting_species_name' });
      const msg = { text: 'Common Myna, Singapore', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.processSpeciesWithLocation).toHaveBeenCalledWith(
        1,
        'Common Myna, Singapore'
      );
    });
  });

  // ─── awaiting_species_location ──────────────────────────

  describe('awaiting_species_location', () => {
    test('routes to showSpeciesDateSelection', async () => {
      const species = { commonName: 'Sparrow', code: 'houspa' };
      ctx.userStates.set(1, { action: 'awaiting_species_location', species });
      const msg = { text: 'Singapore', chat: { id: 1 } };

      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.showSpeciesDateSelection).toHaveBeenCalledWith(1, 'Singapore', species);
    });
  });

  // ─── awaiting_jump_page ─────────────────────────────────

  describe('awaiting_jump_page', () => {
    test('valid page number sends paginated observations', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_jump_page',
        type: 'sightings',
        totalPages: 5,
        messageId: 99,
      });
      ctx.observationsCache.set('sightings_1', {
        observations: Array(25).fill({ species: 'test' }),
        displayName: 'Singapore',
        regionCode: 'SG',
      });

      const msg = { text: '3', chat: { id: 1 } };
      await messageHandler.handleMessage.call(ctx, msg);

      // Page 3 → index 2
      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        'Singapore',
        'sightings',
        2, // 0-indexed
        null,
        'SG'
      );
    });

    test('invalid page number shows error', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_jump_page',
        type: 'sightings',
        totalPages: 5,
        messageId: 99,
      });

      const msg = { text: '10', chat: { id: 1 } };
      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Invalid page number')
      );
    });

    test('non-numeric input shows error', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_jump_page',
        type: 'sightings',
        totalPages: 5,
        messageId: 99,
      });

      const msg = { text: 'abc', chat: { id: 1 } };
      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Invalid page number')
      );
    });

    test('page 0 shows error', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_jump_page',
        type: 'sightings',
        totalPages: 5,
        messageId: 99,
      });

      const msg = { text: '0', chat: { id: 1 } };
      await messageHandler.handleMessage.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Invalid page number')
      );
    });

    test('valid page number but cache missing does nothing extra', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_jump_page',
        type: 'sightings',
        totalPages: 5,
        messageId: 100,
      });
      // observationsCache is empty — no 'sightings_1' key
      const msg = { text: '3', chat: { id: 1 } };
      await messageHandler.handleMessage.call(ctx, msg);
      expect(ctx.sendPaginatedObservations).not.toHaveBeenCalled();
    });
  });
});

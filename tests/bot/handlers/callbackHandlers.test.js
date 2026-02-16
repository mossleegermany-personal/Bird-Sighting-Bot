/**
 * Tests for callbackHandlers — button press routing, date selection, custom date input.
 */
const callbackHandlers = require('../../../src/bot/handlers/callbackHandlers');

describe('callbackHandlers', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      bot: {
        answerCallbackQuery: jest.fn().mockResolvedValue(true),
      },
      userStates: new Map(),
      observationsCache: new Map(),
      lastPrompts: new Map(),
      ITEMS_PER_PAGE: 5,
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
      deleteMsg: jest.fn().mockResolvedValue(),
      showDateSelection: jest.fn().mockResolvedValue(),
      handleNearby: jest.fn().mockResolvedValue(),
      handleHelp: jest.fn().mockResolvedValue(),
      handleSightings: jest.fn().mockResolvedValue(),
      handleSpecies: jest.fn().mockResolvedValue(),
      handleNotable: jest.fn().mockResolvedValue(),
      handleHotspots: jest.fn().mockResolvedValue(),
      handleStart: jest.fn().mockResolvedValue(),
      fetchNearbySightings: jest.fn().mockResolvedValue(),
      fetchAndSendSightings: jest.fn().mockResolvedValue(),
      fetchAndSendNotable: jest.fn().mockResolvedValue(),
      fetchSpeciesInLocation: jest.fn().mockResolvedValue(),
      handlePlaceSearch: jest.fn().mockResolvedValue(),
      sendPaginatedObservations: jest.fn().mockResolvedValue(),
      sendSummaryMessage: jest.fn().mockResolvedValue(),
      sendFullListMessage: jest.fn().mockResolvedValue(),
      sendForwardableMessage: jest.fn().mockResolvedValue(),
      handleDateCallback: jest.fn().mockResolvedValue(),
      fetchSpeciesInLocation: jest.fn().mockResolvedValue(),
    };
  });

  function makeCallbackQuery(data, chatId = 1, messageId = 100) {
    return {
      id: 'cb_' + Date.now(),
      message: { chat: { id: chatId }, message_id: messageId },
      data,
    };
  }

  // ─── Acknowledge ────────────────────────────────────────

  test('always acknowledges the callback', async () => {
    const query = makeCallbackQuery('done');
    await callbackHandlers.handleCallback.call(ctx, query);
    expect(ctx.bot.answerCallbackQuery).toHaveBeenCalledWith(query.id);
  });

  // ─── Pagination ─────────────────────────────────────────

  describe('pagination (page_*)', () => {
    test('page_sightings_2 sends paginated observations', async () => {
      ctx.observationsCache.set('sightings_1', {
        observations: Array(15).fill({ species: 'test' }),
        displayName: 'Singapore',
        regionCode: 'SG',
      });

      const query = makeCallbackQuery('page_sightings_2', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        'Singapore',
        'sightings',
        2,
        100, // messageId for in-place edit
        'SG'
      );
    });

    test('page_notable_0 fetches notable cache', async () => {
      ctx.observationsCache.set('notable_1', {
        observations: [{ species: 'rare' }],
        displayName: 'NY',
        regionCode: 'US-NY',
      });

      const query = makeCallbackQuery('page_notable_0', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1,
        expect.any(Array),
        'NY',
        'notable',
        0,
        100,
        'US-NY'
      );
    });

    test('does nothing if cache is missing', async () => {
      const query = makeCallbackQuery('page_sightings_0', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.sendPaginatedObservations).not.toHaveBeenCalled();
    });
  });

  // ─── page_info ──────────────────────────────────────────

  test('page_info does nothing', async () => {
    const query = makeCallbackQuery('page_info', 1);
    await callbackHandlers.handleCallback.call(ctx, query);
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  // ─── Jump to page ───────────────────────────────────────

  describe('jump_*', () => {
    test('sets awaiting_jump_page state and sends prompt', async () => {
      ctx.observationsCache.set('sightings_1', {
        observations: Array(25).fill({ species: 'test' }),
        displayName: 'SG',
        regionCode: 'SG',
      });

      const query = makeCallbackQuery('jump_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('awaiting_jump_page');
      expect(state.type).toBe('sightings');
      expect(state.totalPages).toBe(5); // 25 items / 5 per page
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Enter a page number')
      );
    });
  });

  // ─── Summary ────────────────────────────────────────────

  describe('specsummary_*', () => {
    test('sends summary when cache exists', async () => {
      ctx.observationsCache.set('sightings_1', {
        observations: [{ species: 'x' }],
        displayName: 'SG',
        regionCode: 'SG',
      });

      const query = makeCallbackQuery('specsummary_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendSummaryMessage).toHaveBeenCalled();
    });

    test('shows error when cache is empty', async () => {
      const query = makeCallbackQuery('specsummary_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('No cached results')
      );
    });
  });

  // ─── Full List ──────────────────────────────────────────

  describe('fulllist_*', () => {
    test('sends full list when cache exists', async () => {
      ctx.observationsCache.set('notable_1', {
        observations: [{ species: 'y' }],
        displayName: 'NY',
        regionCode: 'US-NY',
      });

      const query = makeCallbackQuery('fulllist_notable', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendFullListMessage).toHaveBeenCalled();
    });
  });

  // ─── Share ──────────────────────────────────────────────

  describe('share_*', () => {
    test('shows share options when cache exists', async () => {
      ctx.observationsCache.set('sightings_1', {
        observations: [{ species: 'z' }],
        displayName: 'SG',
        regionCode: 'SG',
      });

      const query = makeCallbackQuery('share_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Share Bird Sightings'),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      );
    });

    test('shows error when no cache', async () => {
      const query = makeCallbackQuery('share_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Unable to share')
      );
    });
  });

  describe('generate_share_*', () => {
    test('generates shareable list', async () => {
      ctx.observationsCache.set('sightings_1', {
        observations: [{ species: 'z' }],
        displayName: 'SG',
        regionCode: 'SG',
      });

      const query = makeCallbackQuery('generate_share_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendForwardableMessage).toHaveBeenCalled();
    });
  });

  test('cancel_share sends confirmation', async () => {
    const query = makeCallbackQuery('cancel_share', 1);
    await callbackHandlers.handleCallback.call(ctx, query);
    expect(ctx.sendMessage).toHaveBeenCalledWith(
      1,
      expect.stringContaining('Share cancelled')
    );
  });

  // ─── Navigation shortcuts ──────────────────────────────

  describe('navigation callbacks', () => {
    test('sightings_{regionCode} shows date selection', async () => {
      const query = makeCallbackQuery('sightings_SG', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.showDateSelection).toHaveBeenCalledWith(1, 'SG', 'SG', 'sightings');
    });

    test('notable_{regionCode} shows date selection', async () => {
      const query = makeCallbackQuery('notable_US-NY', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.showDateSelection).toHaveBeenCalledWith(1, 'US-NY', 'US-NY', 'notable');
    });

    test('request_location calls handleNearby', async () => {
      const query = makeCallbackQuery('request_location', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleNearby).toHaveBeenCalledWith({ chat: { id: 1 } });
    });

    test('help calls handleHelp', async () => {
      const query = makeCallbackQuery('help', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleHelp).toHaveBeenCalledWith({ chat: { id: 1 } });
    });
  });

  // ─── Nearby distance ───────────────────────────────────

  describe('nearby_dist_*', () => {
    test('fetches nearby sightings with selected distance', async () => {
      ctx.userStates.set(1, {
        action: 'awaiting_nearby_distance',
        latitude: 1.3521,
        longitude: 103.8198,
      });

      const query = makeCallbackQuery('nearby_dist_25', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.fetchNearbySightings).toHaveBeenCalledWith(1, 1.3521, 103.8198, 25);
      expect(ctx.userStates.has(1)).toBe(false);
    });

    test('shows error if state is missing', async () => {
      const query = makeCallbackQuery('nearby_dist_10', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('share your location again')
      );
    });
  });

  // ─── New Search ─────────────────────────────────────────

  describe('new_search', () => {
    test('clears state and shows search options', async () => {
      ctx.userStates.set(1, { action: 'some_action' });

      const query = makeCallbackQuery('new_search', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.userStates.has(1)).toBe(false);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('What would you like to search'),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      );
    });
  });

  // ─── Command shortcuts ─────────────────────────────────

  describe('cmd_* shortcuts', () => {
    test('cmd_sightings calls handleSightings', async () => {
      const query = makeCallbackQuery('cmd_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleSightings).toHaveBeenCalled();
    });

    test('cmd_species calls handleSpecies', async () => {
      const query = makeCallbackQuery('cmd_species', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleSpecies).toHaveBeenCalled();
    });

    test('cmd_notable calls handleNotable', async () => {
      const query = makeCallbackQuery('cmd_notable', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleNotable).toHaveBeenCalled();
    });

    test('cmd_nearby calls handleNearby', async () => {
      const query = makeCallbackQuery('cmd_nearby', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleNearby).toHaveBeenCalled();
    });

    test('cmd_hotspots calls handleHotspots', async () => {
      const query = makeCallbackQuery('cmd_hotspots', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleHotspots).toHaveBeenCalled();
    });

    test('cmd_start calls handleStart', async () => {
      const query = makeCallbackQuery('cmd_start', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.handleStart).toHaveBeenCalled();
    });
  });

  // ─── Done ───────────────────────────────────────────────

  describe('done', () => {
    test('sends happy birding message and clears state', async () => {
      ctx.userStates.set(1, { action: 'something' });

      const query = makeCallbackQuery('done', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Happy birding')
      );
      expect(ctx.userStates.has(1)).toBe(false);
    });
  });

  // ─── Hotspot selection ──────────────────────────────────

  describe('hotspot_*', () => {
    test('shows date selection for a hotspot with stored details', async () => {
      const hotspot = { locId: 'L12345', locName: 'Bukit Timah' };
      ctx.userStates.set(1, { hotspots: [hotspot] });

      const query = makeCallbackQuery('hotspot_sightings_L12345', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(
        1,
        'L12345',
        'Bukit Timah',
        'sightings',
        expect.objectContaining({ isHotspot: true, hotspotData: hotspot })
      );
    });

    test('falls back to locId as display name when hotspot not found', async () => {
      ctx.userStates.set(1, { hotspots: [] });

      const query = makeCallbackQuery('hotspot_notable_L99999', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(
        1,
        'L99999',
        'L99999',
        'notable',
        expect.objectContaining({ isHotspot: true })
      );
    });
  });

  // ─── handleDateCallback ─────────────────────────────────

  describe('handleDateCallback()', () => {
    test('today preset fetches sightings', async () => {
      ctx.userStates.set(1, { displayName: 'Singapore' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_today_SG', 100);

      expect(ctx.fetchAndSendSightings).toHaveBeenCalledWith(
        1,
        'SG',
        'Singapore',
        0,
        expect.any(Object),
        false
      );
    });

    test('yesterday preset fetches sightings', async () => {
      ctx.userStates.set(1, { displayName: 'Singapore' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_yesterday_SG', 100);
      expect(ctx.fetchAndSendSightings).toHaveBeenCalled();
    });

    test('last_week preset fetches notable', async () => {
      ctx.userStates.set(1, { displayName: 'New York' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_notable_last_week_US-NY', 100);
      expect(ctx.fetchAndSendNotable).toHaveBeenCalled();
    });

    test('last_3_days preset parses correctly', async () => {
      ctx.userStates.set(1, { displayName: 'Test' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_last_3_days_SG', 100);
      expect(ctx.fetchAndSendSightings).toHaveBeenCalled();
    });

    test('last_14_days preset parses correctly', async () => {
      ctx.userStates.set(1, { displayName: 'Test' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_last_14_days_SG', 100);
      expect(ctx.fetchAndSendSightings).toHaveBeenCalled();
    });

    test('custom preset sets awaiting_custom_date state', async () => {
      ctx.userStates.set(1, { displayName: 'Singapore' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_custom_SG', 100);

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('awaiting_custom_date');
      expect(state.regionCode).toBe('SG');
      expect(state.type).toBe('sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Enter custom date')
      );
    });

    test('species type fetches species with correct params', async () => {
      ctx.userStates.set(1, {
        displayName: 'Singapore',
        species: { commonName: 'House Sparrow', code: 'houspa' },
      });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_species_today_SG', 100);

      expect(ctx.fetchSpeciesInLocation).toHaveBeenCalledWith(
        1,
        'Singapore',
        'House Sparrow',
        'houspa',
        expect.any(Object)
      );
    });
  });

  // ─── handleCustomDateInput ──────────────────────────────

  describe('handleCustomDateInput()', () => {
    test('valid single date calls fetchAndSendSightings', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;

      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'sightings',
      };

      await callbackHandlers.handleCustomDateInput.call(ctx, 1, dateStr, userState);

      expect(ctx.fetchAndSendSightings).toHaveBeenCalledWith(
        1,
        'SG',
        'Singapore',
        0,
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          backDays: expect.any(Number),
        }),
        false
      );
      expect(ctx.userStates.has(1)).toBe(false);
    });

    test('valid date range calls fetchAndSendSightings', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const fmt = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };

      const text = `${fmt(yesterday)} to ${fmt(today)}`;
      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'sightings',
      };

      await callbackHandlers.handleCustomDateInput.call(ctx, 1, text, userState);

      expect(ctx.fetchAndSendSightings).toHaveBeenCalled();
    });

    test('invalid date shows error', async () => {
      const userState = { regionCode: 'SG', displayName: 'Singapore', type: 'sightings' };
      await callbackHandlers.handleCustomDateInput.call(ctx, 1, 'not-a-date', userState);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Invalid date format')
      );
    });

    test('date older than 30 days shows warning', async () => {
      const userState = { regionCode: 'SG', displayName: 'Singapore', type: 'sightings' };
      await callbackHandlers.handleCustomDateInput.call(ctx, 1, '01/01/2020', userState);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('last 30 days')
      );
    });

    test('notable type calls fetchAndSendNotable', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();

      const userState = {
        regionCode: 'US',
        displayName: 'United States',
        type: 'notable',
      };

      await callbackHandlers.handleCustomDateInput.call(ctx, 1, `${dd}/${mm}/${yyyy}`, userState);

      expect(ctx.fetchAndSendNotable).toHaveBeenCalled();
    });

    test('species type calls fetchSpeciesInLocation', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();

      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'species',
        species: { commonName: 'Common Myna', code: 'commyn' },
      };

      await callbackHandlers.handleCustomDateInput.call(ctx, 1, `${dd}/${mm}/${yyyy}`, userState);

      expect(ctx.fetchSpeciesInLocation).toHaveBeenCalledWith(
        1,
        'Singapore',
        'Common Myna',
        'commyn',
        expect.any(Object)
      );
    });

    test('reversed date range gets auto-swapped', async () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const fmt = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };

      // Input in reverse order: today to 3 days ago
      const text = `${fmt(today)} to ${fmt(threeDaysAgo)}`;
      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'sightings',
      };

      await callbackHandlers.handleCustomDateInput.call(ctx, 1, text, userState);

      // Should still succeed (auto-swapped)
      expect(ctx.fetchAndSendSightings).toHaveBeenCalled();
    });

    test('invalid date range (one date bad) shows error', async () => {
      const userState = {
        regionCode: 'SG', displayName: 'Singapore', type: 'sightings',
      };
      await callbackHandlers.handleCustomDateInput.call(ctx, 1, 'bad to 01/01/2026', userState);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Invalid date format')
      );
    });
  });

  // ─── Additional coverage: paths exercised through handleCallback ──

  describe('handleCallback — date_ routing', () => {
    test('date_ callback routes through handleCallback (lines 26-27)', async () => {
      ctx.userStates.set(1, { displayName: 'Singapore' });
      const query = makeCallbackQuery('date_sightings_today_SG', 1);
      await callbackHandlers.handleCallback.call(ctx, query);

      expect(ctx.handleDateCallback).toHaveBeenCalledWith(1, 'date_sightings_today_SG', 100);
    });
  });

  describe('handleCallback — fulllist with no cache', () => {
    test('shows "No cached results" when fulllist cache is empty', async () => {
      const query = makeCallbackQuery('fulllist_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No cached results')
      );
    });
  });

  describe('handleCallback — page_info', () => {
    test('page_info callback acknowledges and returns without action', async () => {
      const query = makeCallbackQuery('page_info', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.bot.answerCallbackQuery).toHaveBeenCalledWith(query.id);
      expect(ctx.sendPaginatedObservations).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback — generate_share with no cache', () => {
    test('shows "Unable to share" when generate_share cache is empty', async () => {
      const query = makeCallbackQuery('generate_share_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Unable to share')
      );
    });
  });

  describe('handleCallback — jump_ with no cache', () => {
    test('jump_ with empty cache does not prompt for page', async () => {
      const query = makeCallbackQuery('jump_sightings', 1);
      await callbackHandlers.handleCallback.call(ctx, query);
      // No cache → no prompt sent, just returns
      expect(ctx.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleDateCallback — branch coverage', () => {
    test('uses regionCode as displayName when userState is missing', async () => {
      // No userState set for chatId 1
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_sightings_today_SG', 100);
      expect(ctx.fetchAndSendSightings).toHaveBeenCalledWith(
        1, 'SG', 'SG', 0, expect.any(Object), false
      );
    });

    test('species type date preset calls fetchSpeciesInLocation', async () => {
      ctx.userStates.set(1, {
        displayName: 'Singapore',
        species: { commonName: 'House Sparrow', code: 'houspa' },
        isHotspot: false,
      });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_species_today_SG', 100);
      expect(ctx.fetchSpeciesInLocation).toHaveBeenCalledWith(
        1, 'Singapore', 'House Sparrow', 'houspa', expect.any(Object)
      );
    });

    test('species type with no species info does nothing', async () => {
      ctx.userStates.set(1, {
        displayName: 'Singapore',
        // no species property
      });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_species_today_SG', 100);
      expect(ctx.fetchSpeciesInLocation).not.toHaveBeenCalled();
    });

    test('species type with no userState at all does nothing', async () => {
      // No userState set → userState is undefined → userState?.species is undefined
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_species_today_SG', 100);
      expect(ctx.fetchSpeciesInLocation).not.toHaveBeenCalled();
    });

    test('unknown type falls through all conditions', async () => {
      ctx.userStates.set(1, { displayName: 'Singapore' });
      await callbackHandlers.handleDateCallback.call(ctx, 1, 'date_unknown_today_SG', 100);
      // No handler matched — neither sightings, notable, nor species
      expect(ctx.fetchAndSendSightings).not.toHaveBeenCalled();
      expect(ctx.fetchAndSendNotable).not.toHaveBeenCalled();
      expect(ctx.fetchSpeciesInLocation).not.toHaveBeenCalled();
    });
  });

  describe('handleCustomDateInput — species type', () => {
    test('species custom date calls fetchSpeciesInLocation', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;

      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'species',
        species: { commonName: 'House Sparrow', code: 'houspa' },
      };
      await callbackHandlers.handleCustomDateInput.call(ctx, 1, dateStr, userState);
      expect(ctx.fetchSpeciesInLocation).toHaveBeenCalledWith(
        1, 'Singapore', 'House Sparrow', 'houspa', expect.objectContaining({ label: expect.any(String) })
      );
    });

    test('species custom date without species info does nothing', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;

      const userState = {
        regionCode: 'SG',
        displayName: 'Singapore',
        type: 'species',
        // no species property
      };
      await callbackHandlers.handleCustomDateInput.call(ctx, 1, dateStr, userState);
      expect(ctx.fetchSpeciesInLocation).not.toHaveBeenCalled();
    });
  });
});

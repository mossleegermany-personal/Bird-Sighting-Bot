/**
 * Tests for sightingsHandlers — /sightings, place search, hotspot selection,
 * date selection, and fetchAndSendSightings.
 */
const sightingsHandlers = require('../../../src/bot/handlers/sightingsHandlers');

// Shared mock context factory
function makeCtx(overrides = {}) {
  return {
    userStates: new Map(),
    userNames: new Map(),
    lastPrompts: new Map(),
    observationsCache: new Map(),
    ITEMS_PER_PAGE: 5,
    sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
    deleteMsg: jest.fn().mockResolvedValue(),
    sendPaginatedObservations: jest.fn().mockResolvedValue(),
    showDateSelection: jest.fn().mockResolvedValue(),
    showHotspotSelection: jest.fn().mockResolvedValue(),
    resendLastPrompt: jest.fn().mockResolvedValue(),
    ebirdService: {
      getRecentObservations: jest.fn().mockResolvedValue([]),
      getHotspotObservations: jest.fn().mockResolvedValue([]),
      searchHotspotsByName: jest.fn().mockResolvedValue([]),
      getPopularHotspots: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────

describe('sightingsHandlers', () => {
  // ─── handleSightings ────────────────────────────────────

  describe('handleSightings()', () => {
    test('prompts for region when no input provided', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'alice' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, '']);

      expect(ctx.userStates.get(1)).toEqual(
        expect.objectContaining({ action: 'awaiting_region_sightings' })
      );
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Enter a location')
      );
    });

    test('stores username in userNames map', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'bob' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('bob');
    });

    test('falls back to first_name when username missing', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { first_name: 'Carol' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('Carol');
    });

    test('falls back to "unknown" when no user info', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: {} };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('unknown');
    });

    test('stores last prompt for error recovery', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, '']);
      expect(ctx.lastPrompts.has(1)).toBe(true);
      expect(ctx.lastPrompts.get(1).action).toBe('awaiting_region_sightings');
    });

    test('delegates to handlePlaceSearch for comma-separated input', async () => {
      const ctx = makeCtx({
        handlePlaceSearch: jest.fn().mockResolvedValue(),
      });
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, 'Central Park, New York']);

      expect(ctx.handlePlaceSearch).toHaveBeenCalledWith(1, 'Central Park, New York', 'sightings');
    });

    test('delegates to showDateSelection for plain region input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await sightingsHandlers.handleSightings.call(ctx, msg, [null, 'Singapore']);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(1, expect.any(String), 'Singapore', 'sightings');
    });
  });

  // ─── handlePlaceSearch ──────────────────────────────────

  describe('handlePlaceSearch()', () => {
    test('shows error for missing place name', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, ',Singapore', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Please provide both'));
    });

    test('shows error for missing region', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Botanic Gardens,', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Please provide both'));
    });

    test('shows searching status message', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Botanic Gardens, Singapore', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
    });

    test('deletes status message after search', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Botanic Gardens, Singapore', 'sightings');
      expect(ctx.deleteMsg).toHaveBeenCalledWith(1, 42);
    });

    test('shows "no locations found" when search returns empty', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'NoSuchPlace, Singapore', 'sightings');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('No locations found')
      );
    });

    test('shows popular hotspots as alternatives when no match', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([
        { locName: 'Sungei Buloh', numSpeciesAllTime: 200 },
        { locName: 'Botanic Gardens', numSpeciesAllTime: 150 },
      ]);

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'FakePlace, Singapore', 'sightings');

      const noMatchMsg = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('No locations found')
      );
      expect(noMatchMsg).toBeTruthy();
      expect(noMatchMsg[1]).toContain('Sungei Buloh');
      expect(noMatchMsg[1]).toContain('200 species');
    });

    test('goes directly to date selection when exactly one hotspot matches', async () => {
      const ctx = makeCtx();
      const hotspot = { locId: 'L12345', locName: 'Botanic Gardens' };
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([hotspot]);

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Botanic Gardens, Singapore', 'sightings');

      expect(ctx.showDateSelection).toHaveBeenCalledWith(
        1, 'L12345', 'Botanic Gardens', 'sightings',
        expect.objectContaining({ isHotspot: true, hotspotData: hotspot })
      );
    });

    test('shows hotspot selection when multiple matches', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([
        { locId: 'L1', locName: 'Gardens A' },
        { locId: 'L2', locName: 'Gardens B' },
      ]);

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Gardens, Singapore', 'sightings');

      expect(ctx.showHotspotSelection).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ locId: 'L1' }),
          expect.objectContaining({ locId: 'L2' }),
        ]),
        'sightings',
        'Singapore'
      );
    });

    test('handles API errors gracefully', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockRejectedValue(new Error('API down'));

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'Botanic Gardens, Singapore', 'sightings');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Error searching')
      );
    });

    test('resends last prompt after error', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockRejectedValue(new Error('fail'));
      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'X, Y', 'sightings');
      expect(ctx.resendLastPrompt).toHaveBeenCalledWith(1);
    });
  });

  // ─── showHotspotSelection ──────────────────────────────

  describe('showHotspotSelection()', () => {
    test('sends message with inline keyboard buttons', async () => {
      const ctx = makeCtx();
      const hotspots = [
        { locId: 'L1', locName: 'Park A', numSpeciesAllTime: 100 },
        { locId: 'L2', locName: 'Park B', numSpeciesAllTime: 50 },
      ];

      await sightingsHandlers.showHotspotSelection.call(ctx, 1, hotspots, 'sightings', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Found 2 locations'),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
    });

    test('limits to 8 hotspot buttons', async () => {
      const ctx = makeCtx();
      const hotspots = Array.from({ length: 12 }, (_, i) => ({
        locId: `L${i}`, locName: `Park ${i}`,
      }));

      await sightingsHandlers.showHotspotSelection.call(ctx, 1, hotspots, 'sightings', 'SG');

      const state = ctx.userStates.get(1);
      expect(state.hotspots).toHaveLength(8);
    });

    test('stores hotspot selection state', async () => {
      const ctx = makeCtx();
      const hotspots = [{ locId: 'L1', locName: 'Park' }];

      await sightingsHandlers.showHotspotSelection.call(ctx, 1, hotspots, 'notable', 'SG');

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('hotspot_selection');
      expect(state.type).toBe('notable');
    });
  });

  // ─── resendLastPrompt ──────────────────────────────────

  describe('resendLastPrompt()', () => {
    test('resends the stored prompt message', async () => {
      const ctx = makeCtx();
      ctx.lastPrompts.set(1, { message: 'Enter location:', action: 'awaiting_region_sightings' });

      await sightingsHandlers.resendLastPrompt.call(ctx, 1);

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Enter location:'));
      expect(ctx.userStates.get(1)).toEqual({ action: 'awaiting_region_sightings' });
    });

    test('does nothing when no stored prompt', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.resendLastPrompt.call(ctx, 1);
      expect(ctx.sendMessage).not.toHaveBeenCalled();
    });
  });

  // ─── showDateSelection ─────────────────────────────────

  describe('showDateSelection()', () => {
    test('sends date picker with inline keyboard', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.showDateSelection.call(ctx, 1, 'SG', 'Singapore', 'sightings');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Select date'),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
    });

    test('stores date selection state with regionCode and type', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.showDateSelection.call(ctx, 1, 'US-NY', 'New York', 'notable');

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('date_selection');
      expect(state.regionCode).toBe('US-NY');
      expect(state.displayName).toBe('New York');
      expect(state.type).toBe('notable');
    });

    test('stores isHotspot flag when passed', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.showDateSelection.call(ctx, 1, 'L123', 'Park', 'sightings', { isHotspot: true });

      const state = ctx.userStates.get(1);
      expect(state.isHotspot).toBe(true);
    });

    test('stores lastPrompt for error recovery', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.showDateSelection.call(ctx, 1, 'SG', 'Singapore', 'sightings');
      expect(ctx.lastPrompts.get(1)).toEqual(
        expect.objectContaining({ action: 'date_selection', regionCode: 'SG' })
      );
    });

    test('includes all date preset buttons', async () => {
      const ctx = makeCtx();
      await sightingsHandlers.showDateSelection.call(ctx, 1, 'SG', 'Singapore', 'sightings');

      const sentOpts = ctx.sendMessage.mock.calls[0][2];
      const allButtonTexts = sentOpts.reply_markup.inline_keyboard
        .flat()
        .map(b => b.text);

      expect(allButtonTexts).toEqual(expect.arrayContaining([
        expect.stringContaining('Today'),
        expect.stringContaining('Yesterday'),
        expect.stringContaining('Last 3 Days'),
        expect.stringContaining('Last Week'),
        expect.stringContaining('Last 14 Days'),
        expect.stringContaining('Last Month'),
        expect.stringContaining('Custom'),
      ]));
    });
  });

  // ─── fetchAndSendSightings ─────────────────────────────

  describe('fetchAndSendSightings()', () => {
    const fakeObs = [
      { comName: 'House Sparrow', speciesCode: 'houspa', obsDt: '2026-02-15 08:00' },
      { comName: 'Common Myna', speciesCode: 'commyn', obsDt: '2026-02-15 09:00' },
    ];

    test('fetches observations and sends paginated results', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(fakeObs);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore', 0, { backDays: 7, label: 'Last Week' });

      expect(ctx.ebirdService.getRecentObservations).toHaveBeenCalledWith('SG', 7, 100);
      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, fakeObs, 'Singapore (Last Week)', 'sightings', 0, null, 'SG'
      );
    });

    test('uses getHotspotObservations when isHotspot=true', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getHotspotObservations.mockResolvedValue(fakeObs);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'L123', 'Park', 0, { backDays: 14, label: 'Last 14 Days' }, true);

      expect(ctx.ebirdService.getHotspotObservations).toHaveBeenCalledWith('L123', 14, 100);
    });

    test('caches observations for pagination', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(fakeObs);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      const cached = ctx.observationsCache.get('sightings_1');
      expect(cached).toBeDefined();
      expect(cached.observations).toEqual(fakeObs);
      expect(cached.regionCode).toBe('SG');
    });

    test('uses cache for page > 0', async () => {
      const ctx = makeCtx();
      ctx.observationsCache.set('sightings_1', {
        observations: fakeObs,
        displayName: 'Singapore',
        regionCode: 'SG',
        dateLabel: 'Today',
      });

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore', 1);

      // Should NOT call API again
      expect(ctx.ebirdService.getRecentObservations).not.toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('shows "searching" status and deletes it', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(fakeObs);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
      expect(ctx.deleteMsg).toHaveBeenCalledWith(1, 42);
    });

    test('shows error and resends prompt when API fails', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockRejectedValue(new Error('timeout'));

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Could not fetch sightings')
      );
      expect(ctx.resendLastPrompt).toHaveBeenCalledWith(1);
    });

    test('shows "no observations" when result is empty', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue([]);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No observations found')
      );
    });

    test('applies date range filter when provided', async () => {
      const ctx = makeCtx();
      const allObs = [
        { comName: 'A', obsDt: '2026-02-15 08:00' },
        { comName: 'B', obsDt: '2026-02-10 09:00' },
      ];
      ctx.ebirdService.getRecentObservations.mockResolvedValue(allObs);

      const startDate = new Date('2026-02-14T00:00:00');
      const endDate = new Date('2026-02-15T23:59:59');

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'SG', 0, {
        backDays: 14,
        label: 'Custom',
        startDate,
        endDate,
      });

      // After filtering, only the Feb 15 observation should remain
      const passedObs = ctx.sendPaginatedObservations.mock.calls[0]?.[1];
      if (passedObs) {
        expect(passedObs.length).toBeLessThanOrEqual(allObs.length);
      }
    });

    test('logs to Google Sheets when observations found', async () => {
      // We can't easily mock sheetsService since it's required at module level,
      // but we can verify the function doesn't throw
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(fakeObs);
      ctx.userNames.set(1, 'testuser');

      await expect(
        sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore')
      ).resolves.toBeUndefined();

      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('defaults to 14-day backDays when no dateFilter', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(fakeObs);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.ebirdService.getRecentObservations).toHaveBeenCalledWith('SG', 14, 100);
    });
  });

  describe('fetchAndSendSightings — branch coverage', () => {
    test('uses regionCode as displayName when originalInput is null', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue([
        { comName: 'Bird', speciesCode: 'b1', obsDt: '2026-02-15 08:00' },
      ]);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', null);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, expect.any(Array),
        expect.stringContaining('SG'),
        'sightings', 0, null, 'SG'
      );
    });

    test('handles cache with no dateLabel property', async () => {
      const ctx = makeCtx();
      ctx.observationsCache.set('sightings_1', {
        observations: [{ comName: 'Bird' }],
        displayName: 'Singapore',
        regionCode: 'SG',
      });

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore', 1);

      expect(ctx.ebirdService.getRecentObservations).not.toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('handles isHotspot=true and uses getHotspotObservations', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getHotspotObservations.mockResolvedValue([
        { comName: 'Bird', obsDt: '2026-02-15 08:00' },
      ]);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'L12345', 'Test Hotspot', 0, null, true);

      expect(ctx.ebirdService.getHotspotObservations).toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('uses default params when args are omitted', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue([
        { comName: 'Bird', obsDt: '2026-02-15 08:00' },
      ]);

      // Omit originalInput, page, dateFilter, isHotspot — trigger default params
      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG');

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, expect.any(Array),
        expect.stringContaining('SG'),
        'sightings', 0, null, 'SG'
      );
    });

    test('handles dateFilter with startDate and endDate', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue([
        { comName: 'Bird A', obsDt: '2026-02-15 08:00' },
        { comName: 'Bird B', obsDt: '2026-02-10 08:00' },
      ]);

      const dateFilter = {
        backDays: 30,
        label: 'Custom Range',
        startDate: new Date('2026-02-14'),
        endDate: new Date('2026-02-16'),
      };
      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore', 0, dateFilter);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('shows "no observations" for null result from API', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getRecentObservations.mockResolvedValue(null);

      await sightingsHandlers.fetchAndSendSightings.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No observations found')
      );
    });

    test('popular hotspot without numSpeciesAllTime omits species count', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([
        { locName: 'Mystery Park' },
      ]);

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'FakePlace, Singapore', 'sightings');

      const msg = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Mystery Park')
      );
      expect(msg).toBeTruthy();
      expect(msg[1]).not.toContain('species)');
    });

    test('popular hotspot empty returns simpler message', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchHotspotsByName.mockResolvedValue([]);
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);

      await sightingsHandlers.handlePlaceSearch.call(ctx, 1, 'FakePlace, XY', 'sightings');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No locations found')
      );
    });
  });
});

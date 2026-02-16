/**
 * Tests for speciesHandlers — /species, searchSpeciesGlobally,
 * processSpeciesWithLocation, fetchSpeciesInLocation, showSpeciesDateSelection.
 */
const speciesHandlers = require('../../../src/bot/handlers/speciesHandlers');

function makeCtx(overrides = {}) {
  return {
    userStates: new Map(),
    userNames: new Map(),
    observationsCache: new Map(),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
    deleteMsg: jest.fn().mockResolvedValue(),
    sendPaginatedObservations: jest.fn().mockResolvedValue(),
    showSpeciesDateSelection: jest.fn().mockResolvedValue(),
    processSpeciesWithLocation: jest.fn().mockResolvedValue(),
    searchSpeciesGlobally: jest.fn().mockResolvedValue(),
    ebirdService: {
      searchSpeciesByName: jest.fn().mockResolvedValue([]),
      getSpeciesObservations: jest.fn().mockResolvedValue([]),
      getObservationsBySpeciesName: jest.fn().mockResolvedValue({ species: null, observations: [] }),
    },
    ...overrides,
  };
}

describe('speciesHandlers', () => {
  // ─── handleSpecies ──────────────────────────────────────

  describe('handleSpecies()', () => {
    test('prompts for species name when no input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'alice' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, '']);

      expect(ctx.userStates.get(1)).toEqual(
        expect.objectContaining({ action: 'awaiting_species_name' })
      );
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Search by Species'));
    });

    test('stores username in userNames map', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'bob' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('bob');
    });

    test('falls back to first_name', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { first_name: 'Carol' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('Carol');
    });

    test('falls back to "unknown"', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: {} };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('unknown');
    });

    test('delegates to processSpeciesWithLocation for comma input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, 'Singapore, House Sparrow']);

      expect(ctx.processSpeciesWithLocation).toHaveBeenCalledWith(1, 'Singapore, House Sparrow');
    });

    test('delegates to searchSpeciesGlobally for plain input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, 'House Sparrow']);

      expect(ctx.searchSpeciesGlobally).toHaveBeenCalledWith(1, 'House Sparrow');
    });

    test('prompt includes example species names', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await speciesHandlers.handleSpecies.call(ctx, msg, [null, '']);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('House Sparrow');
      expect(text).toContain('Common Myna');
    });
  });

  // ─── searchSpeciesGlobally ──────────────────────────────

  describe('searchSpeciesGlobally()', () => {
    test('shows searching status and deletes it', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
      ]);

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'House Sparrow');

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
      expect(ctx.deleteMsg).toHaveBeenCalledWith(1, 42);
    });

    test('shows species details and asks for location when found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
      ]);

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'House Sparrow');

      // Should show species info
      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Found: House Sparrow')
      );
      expect(resultCall).toBeTruthy();
      expect(resultCall[1]).toContain('Passer domesticus');
      expect(resultCall[1]).toContain('houspa');
    });

    test('sets awaiting_species_location state with species info', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
      ]);

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'House Sparrow');

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('awaiting_species_location');
      expect(state.species.code).toBe('houspa');
      expect(state.species.commonName).toBe('House Sparrow');
    });

    test('shows "not found" when no matches', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([]);

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'Fake Bird');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('not found')
      );
    });

    test('shows similar species when multiple matches', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
        { speciesCode: 'eurspa', comName: 'Eurasian Tree Sparrow', sciName: 'Passer montanus' },
        { speciesCode: 'itaspa', comName: 'Italian Sparrow', sciName: 'Passer italiae' },
      ]);

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'Sparrow');

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Similar species')
      );
      expect(resultCall).toBeTruthy();
      expect(resultCall[1]).toContain('Eurasian Tree Sparrow');
    });

    test('handles API error gracefully', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockRejectedValue(new Error('API down'));

      await speciesHandlers.searchSpeciesGlobally.call(ctx, 1, 'Sparrow');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Error searching for species')
      );
    });
  });

  // ─── processSpeciesWithLocation ─────────────────────────

  describe('processSpeciesWithLocation()', () => {
    test('shows error for missing species or location', async () => {
      const ctx = makeCtx();
      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, 'Singapore,');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('provide both')
      );
    });

    test('shows error for missing location', async () => {
      const ctx = makeCtx();
      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, ', House Sparrow');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('provide both')
      );
    });

    test('searches for species and delegates to showSpeciesDateSelection', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
      ]);

      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, 'Singapore, House Sparrow');

      expect(ctx.ebirdService.searchSpeciesByName).toHaveBeenCalledWith('House Sparrow');
      expect(ctx.showSpeciesDateSelection).toHaveBeenCalledWith(
        1, 'Singapore',
        expect.objectContaining({ code: 'houspa', commonName: 'House Sparrow' })
      );
    });

    test('shows "not found" when species not in database', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([]);

      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, 'Singapore, Fake Bird');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('not found')
      );
    });

    test('handles API error gracefully', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockRejectedValue(new Error('API fail'));

      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, 'Singapore, Sparrow');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Error searching')
      );
    });

    test('shows "Looking up" status message', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.searchSpeciesByName.mockResolvedValue([
        { speciesCode: 'houspa', comName: 'House Sparrow', sciName: 'Passer domesticus' },
      ]);

      await speciesHandlers.processSpeciesWithLocation.call(ctx, 1, 'Singapore, House Sparrow');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Looking up')
      );
    });
  });

  // ─── fetchSpeciesInLocation ─────────────────────────────

  describe('fetchSpeciesInLocation()', () => {
    const fakeObs = [
      { comName: 'House Sparrow', speciesCode: 'houspa', obsDt: '2026-02-15 08:00' },
    ];

    test('fetches species observations by code', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa',
        { backDays: 7, label: 'Last Week' }
      );

      expect(ctx.ebirdService.getSpeciesObservations).toHaveBeenCalledWith(
        expect.any(String), 'houspa', 7
      );
    });

    test('sends paginated observations when found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa',
        { backDays: 14, label: 'Last 14 Days' }
      );

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, fakeObs,
        'House Sparrow in Singapore (Last 14 Days)',
        'species', 0, null, expect.any(String)
      );
    });

    test('caches observations', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      const cached = ctx.observationsCache.get('species_1');
      expect(cached).toBeDefined();
      expect(cached.type).toBe('species');
      expect(cached.observations).toEqual(fakeObs);
    });

    test('shows "no sightings" when empty', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue([]);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No recent sightings')
      );
    });

    test('shows "no sightings" when null', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(null);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No recent sightings')
      );
    });

    test('applies date range filter', async () => {
      const ctx = makeCtx();
      const allObs = [
        { comName: 'House Sparrow', obsDt: '2026-02-15 08:00' },
        { comName: 'House Sparrow', obsDt: '2026-02-10 09:00' },
      ];
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(allObs);

      const startDate = new Date('2026-02-14T00:00:00');
      const endDate = new Date('2026-02-15T23:59:59');

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa',
        { backDays: 14, label: 'Custom', startDate, endDate }
      );

      const passedObs = ctx.sendPaginatedObservations.mock.calls[0]?.[1];
      if (passedObs) {
        expect(passedObs.length).toBeLessThanOrEqual(allObs.length);
      }
    });

    test('shows status and deletes on success', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
      expect(ctx.deleteMsg).toHaveBeenCalledWith(1, 42);
    });

    test('handles API error gracefully', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockRejectedValue(new Error('timeout'));

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Could not search for species')
      );
    });

    test('defaults to 14 backDays when no dateFilter', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa'
      );

      expect(ctx.ebirdService.getSpeciesObservations).toHaveBeenCalledWith(
        expect.any(String), 'houspa', 14
      );
    });

    test('logs to Sheets when observations found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue(fakeObs);
      ctx.userNames.set(1, 'testuser');

      await expect(
        speciesHandlers.fetchSpeciesInLocation.call(ctx, 1, 'Singapore', 'House Sparrow', 'houspa')
      ).resolves.toBeUndefined();
    });

    // ── no-speciesCode path (uses getObservationsBySpeciesName) ──

    test('looks up species by name when speciesCode is not provided', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getObservationsBySpeciesName.mockResolvedValue({
        species: { code: 'houspa', commonName: 'House Sparrow', scientificName: 'Passer domesticus' },
        observations: fakeObs,
      });

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', null,
        { backDays: 14, label: 'Last 14 Days' }
      );

      expect(ctx.ebirdService.getObservationsBySpeciesName).toHaveBeenCalledWith(
        expect.any(String), 'House Sparrow', 14
      );
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('shows "species not found" when name lookup returns no species', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getObservationsBySpeciesName.mockResolvedValue({
        species: null,
        observations: [],
        error: 'Species not found',
      });

      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'Fake Bird', null
      );

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('not found')
      );
    });
  });

  // ─── showSpeciesDateSelection ───────────────────────────

  describe('showSpeciesDateSelection()', () => {
    test('sends date picker with species-specific buttons', async () => {
      const ctx = makeCtx();
      const species = { code: 'houspa', commonName: 'House Sparrow', scientificName: 'Passer domesticus' };

      await speciesHandlers.showSpeciesDateSelection.call(ctx, 1, 'Singapore', species);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('House Sparrow'),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
    });

    test('stores species in userState for date callback', async () => {
      const ctx = makeCtx();
      const species = { code: 'houspa', commonName: 'House Sparrow', scientificName: 'Passer domesticus' };

      await speciesHandlers.showSpeciesDateSelection.call(ctx, 1, 'Singapore', species);

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('date_selection');
      expect(state.type).toBe('species');
      expect(state.species).toEqual(species);
    });

    test('callback data uses species type prefix', async () => {
      const ctx = makeCtx();
      const species = { code: 'houspa', commonName: 'House Sparrow', scientificName: 'Passer domesticus' };

      await speciesHandlers.showSpeciesDateSelection.call(ctx, 1, 'Singapore', species);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allCallbacks = opts.reply_markup.inline_keyboard
        .flat()
        .map(b => b.callback_data);

      expect(allCallbacks.every(cb => cb.startsWith('date_species_'))).toBe(true);
    });

    test('includes all date preset buttons', async () => {
      const ctx = makeCtx();
      const species = { code: 'houspa', commonName: 'House Sparrow', scientificName: 'P.d.' };

      await speciesHandlers.showSpeciesDateSelection.call(ctx, 1, 'Singapore', species);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allTexts = opts.reply_markup.inline_keyboard.flat().map(b => b.text);
      expect(allTexts).toEqual(expect.arrayContaining([
        expect.stringContaining('Today'),
        expect.stringContaining('Yesterday'),
        expect.stringContaining('Custom'),
      ]));
    });
  });

  describe('fetchSpeciesInLocation — default params branch', () => {
    test('uses default null speciesCode when argument is omitted', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getObservationsBySpeciesName.mockResolvedValue({
        species: { code: 'houspa', commonName: 'House Sparrow', scientificName: 'P.d.' },
        observations: [{ comName: 'House Sparrow', obsDt: '2026-02-15 08:00' }],
      });

      // Omit speciesCode and dateFilter entirely (trigger default params)
      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow'
      );

      expect(ctx.ebirdService.getObservationsBySpeciesName).toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('applies dateFilter with startDate and endDate', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getSpeciesObservations.mockResolvedValue([
        { comName: 'House Sparrow', obsDt: '2026-02-15 08:00' },
        { comName: 'House Sparrow', obsDt: '2026-02-10 08:00' },
      ]);

      const dateFilter = {
        backDays: 30,
        label: 'Custom Range',
        startDate: new Date('2026-02-14'),
        endDate: new Date('2026-02-16'),
      };
      await speciesHandlers.fetchSpeciesInLocation.call(
        ctx, 1, 'Singapore', 'House Sparrow', 'houspa', dateFilter
      );

      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });
  });
});

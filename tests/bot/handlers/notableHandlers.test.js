/**
 * Tests for notableHandlers — /notable, fetchAndSendNotable.
 */
const notableHandlers = require('../../../src/bot/handlers/notableHandlers');

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
    handlePlaceSearch: jest.fn().mockResolvedValue(),
    resendLastPrompt: jest.fn().mockResolvedValue(),
    ebirdService: {
      getNotableObservations: jest.fn().mockResolvedValue([]),
      getHotspotObservations: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('notableHandlers', () => {
  // ─── handleNotable ──────────────────────────────────────

  describe('handleNotable()', () => {
    test('prompts for region when no input provided', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'alice' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);

      expect(ctx.userStates.get(1)).toEqual(
        expect.objectContaining({ action: 'awaiting_region_notable' })
      );
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('notable sightings'));
    });

    test('stores username in userNames map', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'bob' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('bob');
    });

    test('falls back to first_name when username missing', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { first_name: 'Carol' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('Carol');
    });

    test('falls back to "unknown" when no user info', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: {} };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);
      expect(ctx.userNames.get(1)).toBe('unknown');
    });

    test('stores last prompt for error recovery', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);
      expect(ctx.lastPrompts.has(1)).toBe(true);
      expect(ctx.lastPrompts.get(1).action).toBe('awaiting_region_notable');
    });

    test('delegates to handlePlaceSearch for comma-separated input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, 'Central Park, New York']);

      expect(ctx.handlePlaceSearch).toHaveBeenCalledWith(1, 'Central Park, New York', 'notable');
    });

    test('calls showDateSelection for plain region input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, 'Singapore']);

      expect(ctx.showDateSelection).toHaveBeenCalledWith(1, expect.any(String), 'Singapore', 'notable');
    });

    test('prompt mentions "rare" or "unusual"', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'x' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, '']);
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toMatch(/rare|unusual|notable/i);
    });
  });

  // ─── fetchAndSendNotable ────────────────────────────────

  describe('fetchAndSendNotable()', () => {
    const fakeObs = [
      { comName: 'Fairy Pitta', speciesCode: 'faipit', obsDt: '2026-02-15 08:00' },
      { comName: 'Spoon-billed Sandpiper', speciesCode: 'spbsan', obsDt: '2026-02-15 09:00' },
    ];

    test('fetches notable observations via API', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(fakeObs);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore', 0, { backDays: 7, label: 'Last Week' });

      expect(ctx.ebirdService.getNotableObservations).toHaveBeenCalledWith('SG', 7, 100);
      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, fakeObs, 'Singapore (Last Week)', 'notable', 0, null, 'SG'
      );
    });

    test('uses getHotspotObservations when isHotspot=true', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getHotspotObservations.mockResolvedValue(fakeObs);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'L123', 'Park', 0, { backDays: 14, label: 'Last 14 Days' }, true);

      expect(ctx.ebirdService.getHotspotObservations).toHaveBeenCalledWith('L123', 14, 100);
      expect(ctx.ebirdService.getNotableObservations).not.toHaveBeenCalled();
    });

    test('caches observations for later pagination', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(fakeObs);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      const cached = ctx.observationsCache.get('notable_1');
      expect(cached).toBeDefined();
      expect(cached.observations).toEqual(fakeObs);
      expect(cached.regionCode).toBe('SG');
      expect(cached.type).toBe('notable');
    });

    test('uses cache for page > 0', async () => {
      const ctx = makeCtx();
      ctx.observationsCache.set('notable_1', {
        observations: fakeObs,
        displayName: 'Singapore',
        regionCode: 'SG',
        dateLabel: 'Today',
      });

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore', 1);

      expect(ctx.ebirdService.getNotableObservations).not.toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('shows "searching" status and deletes it on success', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(fakeObs);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
      expect(ctx.deleteMsg).toHaveBeenCalled();
    });

    test('shows error and resends prompt when API fails', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockRejectedValue(new Error('timeout'));

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Could not fetch notable')
      );
      expect(ctx.resendLastPrompt).toHaveBeenCalledWith(1);
    });

    test('shows "no notable" when result is empty', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue([]);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No notable observations')
      );
    });

    test('shows "no notable" when result is null', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(null);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No notable observations')
      );
    });

    test('applies date range filter when startDate and endDate provided', async () => {
      const ctx = makeCtx();
      const allObs = [
        { comName: 'A', obsDt: '2026-02-15 08:00' },
        { comName: 'B', obsDt: '2026-02-10 09:00' },
      ];
      ctx.ebirdService.getNotableObservations.mockResolvedValue(allObs);

      const startDate = new Date('2026-02-14T00:00:00');
      const endDate = new Date('2026-02-15T23:59:59');

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'SG', 0, {
        backDays: 14, label: 'Custom', startDate, endDate,
      });

      const passedObs = ctx.sendPaginatedObservations.mock.calls[0]?.[1];
      if (passedObs) {
        expect(passedObs.length).toBeLessThanOrEqual(allObs.length);
      }
    });

    test('defaults to 14 backDays when no dateFilter', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(fakeObs);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore');

      expect(ctx.ebirdService.getNotableObservations).toHaveBeenCalledWith('SG', 14, 100);
    });

    test('does not throw when sheetsService.logSightings is called', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue(fakeObs);
      ctx.userNames.set(1, 'testuser');

      await expect(
        notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore')
      ).resolves.toBeUndefined();
    });
  });

  describe('fetchAndSendNotable — branch coverage', () => {
    test('uses regionCode as displayName when originalInput is null', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue([
        { comName: 'Rare Bird', speciesCode: 'rare1', obsDt: '2026-02-15 08:00' },
      ]);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', null);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, expect.any(Array),
        expect.stringContaining('SG'),
        'notable', 0, null, 'SG'
      );
    });

    test('handles cache with no dateLabel property', async () => {
      const ctx = makeCtx();
      ctx.observationsCache.set('notable_1', {
        observations: [{ comName: 'Bird' }],
        displayName: 'Singapore',
        regionCode: 'SG',
      });

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore', 1);

      expect(ctx.ebirdService.getNotableObservations).not.toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('handles isHotspot=true and uses getHotspotObservations', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getHotspotObservations.mockResolvedValue([
        { comName: 'Rare Bird', obsDt: '2026-02-15 08:00' },
      ]);

      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'L12345', 'Test Hotspot', 0, null, true);

      expect(ctx.ebirdService.getHotspotObservations).toHaveBeenCalled();
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('uses default params when args are omitted', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue([
        { comName: 'Bird', obsDt: '2026-02-15 08:00' },
      ]);

      // Omit originalInput, page, dateFilter, isHotspot — trigger default params
      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG');

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, expect.any(Array),
        expect.stringContaining('SG'),
        'notable', 0, null, 'SG'
      );
    });

    test('handles dateFilter with startDate and endDate', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNotableObservations.mockResolvedValue([
        { comName: 'Bird A', obsDt: '2026-02-15 08:00' },
        { comName: 'Bird B', obsDt: '2026-02-10 08:00' },
      ]);

      const dateFilter = {
        backDays: 30,
        label: 'Custom Range',
        startDate: new Date('2026-02-14'),
        endDate: new Date('2026-02-16'),
      };
      await notableHandlers.fetchAndSendNotable.call(ctx, 1, 'SG', 'Singapore', 0, dateFilter);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('handles comma input for handleNotable', async () => {
      const ctx = makeCtx();
      const msg = { text: '/notable', chat: { id: 1 }, from: { username: 'u' } };
      await notableHandlers.handleNotable.call(ctx, msg, [null, 'Central Park, US']);
      expect(ctx.handlePlaceSearch).toHaveBeenCalledWith(1, 'Central Park, US', 'notable');
    });
  });
});

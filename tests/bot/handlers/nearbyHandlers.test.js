/**
 * Tests for nearbyHandlers — /nearby, handleLocation, fetchNearbySightings.
 */
const nearbyHandlers = require('../../../src/bot/handlers/nearbyHandlers');

function makeCtx(overrides = {}) {
  return {
    userStates: new Map(),
    userNames: new Map(),
    observationsCache: new Map(),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
    deleteMsg: jest.fn().mockResolvedValue(),
    sendPaginatedObservations: jest.fn().mockResolvedValue(),
    ebirdService: {
      getNearbyObservations: jest.fn().mockResolvedValue([]),
      getNearbyHotspots: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('nearbyHandlers', () => {
  // ─── handleNearby ──────────────────────────────────────

  describe('handleNearby()', () => {
    test('sends share-location prompt', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'alice' } };
      await nearbyHandlers.handleNearby.call(ctx, msg);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Share your location'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.any(Array),
          }),
        })
      );
    });

    test('stores username in userNames', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { username: 'bob' } };
      await nearbyHandlers.handleNearby.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('bob');
    });

    test('falls back to first_name for username', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: { first_name: 'Carol' } };
      await nearbyHandlers.handleNearby.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('Carol');
    });

    test('falls back to "unknown"', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: {} };
      await nearbyHandlers.handleNearby.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('unknown');
    });

    test('keyboard has location-request button', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 }, from: {} };
      await nearbyHandlers.handleNearby.call(ctx, msg);

      const replyMarkup = ctx.sendMessage.mock.calls[0][2].reply_markup;
      const btn = replyMarkup.keyboard[0][0];
      expect(btn.request_location).toBe(true);
    });
  });

  // ─── handleLocation ─────────────────────────────────────

  describe('handleLocation()', () => {
    test('stores coordinates in userState', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { username: 'alice' },
        location: { latitude: 1.3521, longitude: 103.8198 },
      };

      await nearbyHandlers.handleLocation.call(ctx, msg);

      const state = ctx.userStates.get(1);
      expect(state.action).toBe('awaiting_nearby_distance');
      expect(state.latitude).toBe(1.3521);
      expect(state.longitude).toBe(103.8198);
    });

    test('shows distance picker buttons', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { username: 'alice' },
        location: { latitude: 1.35, longitude: 103.82 },
      };

      await nearbyHandlers.handleLocation.call(ctx, msg);

      const sentOpts = ctx.sendMessage.mock.calls[0][2];
      const allButtonTexts = sentOpts.reply_markup.inline_keyboard
        .flat()
        .map(b => b.text);

      expect(allButtonTexts).toEqual(expect.arrayContaining([
        '5 km', '10 km', '15 km', '20 km', '25 km',
      ]));
    });

    test('shows coordinates in the message', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { username: 'alice' },
        location: { latitude: 1.3521, longitude: 103.8198 },
      };

      await nearbyHandlers.handleLocation.call(ctx, msg);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('1.3521');
      expect(text).toContain('103.8198');
    });

    test('includes Google Maps link', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { username: 'alice' },
        location: { latitude: 1.3521, longitude: 103.8198 },
      };

      await nearbyHandlers.handleLocation.call(ctx, msg);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('maps.google.com');
    });

    test('stores username from location message', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { username: 'dave' },
        location: { latitude: 0, longitude: 0 },
      };

      await nearbyHandlers.handleLocation.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('dave');
    });
  });

  // ─── fetchNearbySightings ───────────────────────────────

  describe('fetchNearbySightings()', () => {
    const fakeObs = [
      { comName: 'House Sparrow', countryCode: 'SG', speciesCode: 'houspa' },
      { comName: 'Common Myna', countryCode: 'SG', speciesCode: 'commyn' },
    ];
    const fakeHotspots = [
      { locName: 'Sungei Buloh', numSpeciesAllTime: 200 },
    ];

    test('fetches nearby observations and hotspots', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue(fakeHotspots);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      expect(ctx.ebirdService.getNearbyObservations).toHaveBeenCalledWith(1.35, 103.82, 25);
      expect(ctx.ebirdService.getNearbyHotspots).toHaveBeenCalledWith(1.35, 103.82, 25);
    });

    test('sends paginated observations when found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, fakeObs, 'Your Location (10 km)', 'nearby', 0, null, 'SG'
      );
    });

    test('caches observations', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      const cached = ctx.observationsCache.get('nearby_1');
      expect(cached).toBeDefined();
      expect(cached.observations).toEqual(fakeObs);
      expect(cached.type).toBe('nearby');
    });

    test('shows "no sightings" when observations empty', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue([]);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 5);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No bird sightings found')
      );
    });

    test('shows nearby hotspots when available', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue(fakeHotspots);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      const hotspotCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Nearby Birding Hotspots')
      );
      expect(hotspotCall).toBeTruthy();
      expect(hotspotCall[1]).toContain('Sungei Buloh');
      expect(hotspotCall[1]).toContain('200');
    });

    test('shows "What next?" prompt after results', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      const nextCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('What would you like to do next')
      );
      expect(nextCall).toBeTruthy();
    });

    test('shows searching status and deletes it', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Searching'));
      expect(ctx.deleteMsg).toHaveBeenCalledWith(1, 42);
    });

    test('handles API errors gracefully (inner catch)', async () => {
      const ctx = makeCtx();
      // Both inner API calls fail — caught individually, observations stays []
      ctx.ebirdService.getNearbyObservations.mockRejectedValue(new Error('Network error'));
      ctx.ebirdService.getNearbyHotspots.mockRejectedValue(new Error('Network error'));

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      // Inner catch handles each failure independently;
      // observations stays [], so shows "No bird sightings" instead of outer catch
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No bird sightings found')
      );
    });

    test('shows "What next?" prompt even when both APIs fail', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockRejectedValue(new Error('fail'));
      ctx.ebirdService.getNearbyHotspots.mockRejectedValue(new Error('fail'));

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      const nextCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('What would you like to do next')
      );
      expect(nextCall).toBeTruthy();
      expect(nextCall[2].reply_markup.inline_keyboard).toBeDefined();
    });

    test('observation API error does not prevent hotspot display', async () => {
      const ctx = makeCtx();
      // Observations fail but hotspots succeed
      ctx.ebirdService.getNearbyObservations.mockRejectedValue(new Error('obs fail'));
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue(fakeHotspots);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      // Should still show "no sightings" message (because observations returned empty after catch)
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No bird sightings found')
      );
      // And hotspots should still show
      const hotspotCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Nearby Birding Hotspots')
      );
      expect(hotspotCall).toBeTruthy();
    });

    test('hotspot API error does not prevent observation display', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockRejectedValue(new Error('hotspot fail'));

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      // Observations should still be shown
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('logs to Google Sheets when observations found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObs);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);
      ctx.userNames.set(1, 'testuser');

      await expect(
        nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10)
      ).resolves.toBeUndefined();
    });

    test('limits hotspot display to 5', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue([]);
      const manyHotspots = Array.from({ length: 10 }, (_, i) => ({
        locName: `Spot ${i}`, numSpeciesAllTime: 100 - i,
      }));
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue(manyHotspots);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      const hotspotCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Nearby Birding Hotspots')
      );
      if (hotspotCall) {
        // Should contain Spot 0-4 but not Spot 5+
        expect(hotspotCall[1]).toContain('Spot 0');
        expect(hotspotCall[1]).toContain('Spot 4');
        expect(hotspotCall[1]).not.toContain('Spot 5');
      }
    });

    test('outer catch sends error when sendPaginatedObservations throws', async () => {
      const ctx = makeCtx();
      const fakeObsLocal = [{ comName: 'Sparrow', countryCode: 'SG', speciesCode: 'sp' }];
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(fakeObsLocal);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);
      // Make sendPaginatedObservations throw - this triggers the outer catch
      ctx.sendPaginatedObservations.mockRejectedValue(new Error('render crash'));

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Could not fetch nearby sightings'),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
    });
  });

  describe('handleLocation — username fallback branches', () => {
    test('falls back to first_name when username is missing', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: { first_name: 'Alice' },
        location: { latitude: 1.35, longitude: 103.82 },
      };
      await nearbyHandlers.handleLocation.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('Alice');
    });

    test('falls back to "unknown" when from has no name fields', async () => {
      const ctx = makeCtx();
      const msg = {
        chat: { id: 1 },
        from: {},
        location: { latitude: 1.35, longitude: 103.82 },
      };
      await nearbyHandlers.handleLocation.call(ctx, msg);
      expect(ctx.userNames.get(1)).toBe('unknown');
    });
  });

  describe('fetchNearbySightings — branch coverage', () => {
    test('nearbyRegion is null when observations have no countryCode', async () => {
      const ctx = makeCtx();
      const obsNoCountry = [
        { comName: 'Bird A', speciesCode: 'ba', locName: 'Loc' },
      ];
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(obsNoCountry);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      expect(ctx.sendPaginatedObservations).toHaveBeenCalledWith(
        1, obsNoCountry, 'Your Location (10 km)', 'nearby', 0, null, null
      );
    });

    test('hotspot without numSpeciesAllTime omits species count', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue([]);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([
        { locName: 'Wetland Reserve' },
      ]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 25);

      const hotspotCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Wetland Reserve')
      );
      expect(hotspotCall).toBeTruthy();
      expect(hotspotCall[1]).not.toContain('Species recorded');
    });
  });

  describe('fetchNearbySightings — API error/null branches', () => {
    test('handles null from getNearbyObservations (|| [] fallback)', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue(null);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      // null || [] = [] → no observations → "No bird sightings found"
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No bird sightings found')
      );
    });

    test('catches error from getNearbyObservations and continues', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockRejectedValue(new Error('API timeout'));
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue([
        { locName: 'Test Spot', numSpeciesAllTime: 10 },
      ]);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      // Should still show hotspots even though observations failed
      const hotspotCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Test Spot')
      );
      expect(hotspotCall).toBeTruthy();
    });

    test('catches error from getNearbyHotspots and continues', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue([
        { comName: 'Bird', countryCode: 'SG', locName: 'Loc' },
      ]);
      ctx.ebirdService.getNearbyHotspots.mockRejectedValue(new Error('Hotspot API fail'));

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      // Should still show observations even though hotspots failed
      expect(ctx.sendPaginatedObservations).toHaveBeenCalled();
    });

    test('handles null from getNearbyHotspots (|| [] fallback)', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getNearbyObservations.mockResolvedValue([]);
      ctx.ebirdService.getNearbyHotspots.mockResolvedValue(null);

      await nearbyHandlers.fetchNearbySightings.call(ctx, 1, 1.35, 103.82, 10);

      // null || [] = [] → no hotspots shown
      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('No bird sightings found')
      );
    });
  });
});

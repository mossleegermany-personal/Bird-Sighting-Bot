/**
 * Tests for hotspotHandlers — /hotspots search flow.
 */
const hotspotHandlers = require('../../../src/bot/handlers/hotspotHandlers');

function makeCtx(overrides = {}) {
  return {
    userStates: new Map(),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
    ebirdService: {
      getPopularHotspots: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('hotspotHandlers', () => {
  describe('handleHotspots()', () => {
    test('prompts for region when no input', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, '']);

      expect(ctx.userStates.get(1)).toEqual(
        expect.objectContaining({ action: 'awaiting_region_hotspots' })
      );
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('Enter a region'));
    });

    test('prompt mentions /sightings for follow-up', async () => {
      const ctx = makeCtx();
      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, '']);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('/sightings');
    });

    test('fetches popular hotspots for given region', async () => {
      const ctx = makeCtx();
      const hotspots = [
        { locId: 'L1', locName: 'Sungei Buloh', numSpeciesAllTime: 300 },
        { locId: 'L2', locName: 'Botanic Gardens', numSpeciesAllTime: 200 },
      ];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      expect(ctx.ebirdService.getPopularHotspots).toHaveBeenCalledWith(expect.any(String), 15);
    });

    test('shows hotspot list with species counts', async () => {
      const ctx = makeCtx();
      const hotspots = [
        { locId: 'L1', locName: 'Sungei Buloh', numSpeciesAllTime: 300 },
        { locId: 'L2', locName: 'Botanic Gardens', numSpeciesAllTime: 200 },
      ];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Popular Birding Hotspots')
      );
      expect(resultCall).toBeTruthy();
      expect(resultCall[1]).toContain('Sungei Buloh');
      expect(resultCall[1]).toContain('300');
      expect(resultCall[1]).toContain('Botanic Gardens');
    });

    test('shows inline keyboard buttons for top 5 hotspots', async () => {
      const ctx = makeCtx();
      const hotspots = Array.from({ length: 8 }, (_, i) => ({
        locId: `L${i}`, locName: `Park ${i}`, numSpeciesAllTime: 100 - i,
      }));
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => c[2] && c[2].reply_markup
      );
      expect(resultCall).toBeTruthy();
      const buttons = resultCall[2].reply_markup.inline_keyboard;
      // Should have 5 buttons (top 5 hotspots)
      expect(buttons.length).toBe(5);
    });

    test('shows "no hotspots" when none found', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' FakeRegion']);

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('No hotspots'));
    });

    test('shows "no hotspots" when API returns null', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(null);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' FakeRegion']);

      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('No hotspots'));
    });

    test('handles API error gracefully', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getPopularHotspots.mockRejectedValue(new Error('Network error'));

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Could not fetch hotspots')
      );
    });

    test('shows searching status message', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.getPopularHotspots.mockResolvedValue([]);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      expect(ctx.sendMessage).toHaveBeenCalledWith(
        1, expect.stringContaining('Finding popular birding hotspots')
      );
    });

    test('limits displayed hotspots to 10', async () => {
      const ctx = makeCtx();
      const hotspots = Array.from({ length: 15 }, (_, i) => ({
        locId: `L${i}`, locName: `Park ${i}`, numSpeciesAllTime: 100 - i,
      }));
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Popular Birding Hotspots')
      );
      // Park 0 through Park 9 should be present, Park 10+ should not
      expect(resultCall[1]).toContain('Park 0');
      expect(resultCall[1]).toContain('Park 9');
      expect(resultCall[1]).not.toContain('Park 10');
    });

    test('includes tip about searching specific locations', async () => {
      const ctx = makeCtx();
      const hotspots = [{ locId: 'L1', locName: 'Sungei Buloh', numSpeciesAllTime: 300 }];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' Singapore']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('To search a specific location')
      );
      expect(resultCall).toBeTruthy();
    });

    test('truncates long hotspot names in buttons', async () => {
      const ctx = makeCtx();
      const hotspots = [{
        locId: 'L1',
        locName: 'This Is A Very Long Hotspot Name That Exceeds Thirty Five Characters Easily',
        numSpeciesAllTime: 100,
      }];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' SG']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => c[2] && c[2].reply_markup
      );
      const btnText = resultCall[2].reply_markup.inline_keyboard[0][0].text;
      expect(btnText).toContain('...');
    });

    test('button callback_data uses hotspot_sightings_{locId}', async () => {
      const ctx = makeCtx();
      const hotspots = [{ locId: 'L12345', locName: 'Test Park', numSpeciesAllTime: 50 }];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);

      const msg = { chat: { id: 1 } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' SG']);

      const resultCall = ctx.sendMessage.mock.calls.find(
        c => c[2] && c[2].reply_markup
      );
      const cbData = resultCall[2].reply_markup.inline_keyboard[0][0].callback_data;
      expect(cbData).toBe('hotspot_sightings_L12345');
    });
  });

  describe('handleHotspots — branch coverage', () => {
    test('displays hotspot without numSpeciesAllTime', async () => {
      const ctx = makeCtx();
      const hotspots = [
        { locId: 'L1', locName: 'Mystery Marsh', numSpeciesAllTime: 0 },
      ];
      ctx.ebirdService.getPopularHotspots.mockResolvedValue(hotspots);
      const msg = { chat: { id: 1 }, from: { username: 'u' } };
      await hotspotHandlers.handleHotspots.call(ctx, msg, [null, ' SG']);
      const resultCall = ctx.sendMessage.mock.calls.find(
        c => typeof c[1] === 'string' && c[1].includes('Mystery Marsh')
      );
      expect(resultCall).toBeTruthy();
      // Header contains "species recorded" but specific entry should NOT include "🐦" count
      expect(resultCall[1]).not.toContain('🐦 0 species recorded');
    });
  });
});

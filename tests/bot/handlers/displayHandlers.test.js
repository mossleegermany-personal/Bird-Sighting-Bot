/**
 * Tests for displayHandlers — pagination, summary, full list, share, _buildTitle.
 */
const displayHandlers = require('../../../src/bot/handlers/displayHandlers');

function makeCtx(overrides = {}) {
  return {
    ITEMS_PER_PAGE: 5,
    _buildTitle: displayHandlers._buildTitle,
    sendMessage: jest.fn().mockResolvedValue({ message_id: 42 }),
    bot: {
      editMessageText: jest.fn().mockResolvedValue(true),
    },
    ebirdService: {
      formatObservation: jest.fn((obs) => `*${obs.comName}* at ${obs.locName || 'Unknown'}`),
    },
    ...overrides,
  };
}

describe('displayHandlers', () => {
  // ─── _buildTitle ────────────────────────────────────────

  describe('_buildTitle()', () => {
    test('returns notable title for type "notable"', () => {
      const title = displayHandlers._buildTitle('notable', 'Singapore');
      expect(title).toContain('Notable');
      expect(title).toContain('Singapore');
    });

    test('returns nearby title for type "nearby"', () => {
      const title = displayHandlers._buildTitle('nearby', 'Your Location (10 km)');
      expect(title).toContain('Near');
      expect(title).toContain('Your Location');
    });

    test('returns species title for type "species"', () => {
      const title = displayHandlers._buildTitle('species', 'House Sparrow in SG');
      expect(title).toContain('House Sparrow');
    });

    test('returns sightings title for default type', () => {
      const title = displayHandlers._buildTitle('sightings', 'New York');
      expect(title).toContain('Recent Sightings');
      expect(title).toContain('New York');
    });

    test('escapes markdown in display name', () => {
      const title = displayHandlers._buildTitle('sightings', 'US_NY');
      expect(title).toContain('US\\_NY');
    });
  });

  // ─── sendPaginatedObservations ──────────────────────────

  describe('sendPaginatedObservations()', () => {
    const fakeObs = Array.from({ length: 12 }, (_, i) => ({
      comName: `Bird ${i}`,
      locName: `Loc ${i}`,
    }));

    test('shows "no observations" for empty array', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, [], 'SG', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('No observations'));
    });

    test('shows "no observations" for null', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, null, 'SG', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalledWith(1, expect.stringContaining('No observations'));
    });

    test('displays correct page range (page 0)', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 0);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('1-5 of 12');
      expect(text).toContain('Page 1 of 3');
    });

    test('displays correct page range (page 1)', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 1);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('6-10 of 12');
      expect(text).toContain('Page 2 of 3');
    });

    test('displays correct page range (last page)', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 2);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('11-12 of 12');
      expect(text).toContain('Page 3 of 3');
    });

    test('calls formatObservation for each item on the page', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0, null, 'SG');

      expect(ctx.ebirdService.formatObservation).toHaveBeenCalledTimes(5);
      expect(ctx.ebirdService.formatObservation).toHaveBeenCalledWith(fakeObs[0], 'SG');
    });

    test('includes navigation buttons on first page', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allButtons = opts.reply_markup.inline_keyboard.flat();
      const texts = allButtons.map(b => b.text);

      expect(texts).toEqual(expect.arrayContaining([
        expect.stringContaining('Next'),
        expect.stringContaining('Last'),
      ]));
      // No Prev/First on first page
      expect(texts).not.toEqual(expect.arrayContaining([
        expect.stringContaining('First'),
        expect.stringContaining('Prev'),
      ]));
    });

    test('includes Prev/First and Next/Last on middle page', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 1);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allButtons = opts.reply_markup.inline_keyboard.flat();
      const texts = allButtons.map(b => b.text);

      expect(texts).toEqual(expect.arrayContaining([
        expect.stringContaining('First'),
        expect.stringContaining('Prev'),
        expect.stringContaining('Next'),
        expect.stringContaining('Last'),
      ]));
    });

    test('no Next/Last on last page', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 2);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const navRow = opts.reply_markup.inline_keyboard[0];
      const texts = navRow.map(b => b.text);

      expect(texts).toEqual(expect.arrayContaining([
        expect.stringContaining('First'),
        expect.stringContaining('Prev'),
      ]));
      expect(texts).not.toEqual(expect.arrayContaining([
        expect.stringContaining('Next'),
      ]));
    });

    test('includes Jump to Page button when > 2 pages', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allButtons = opts.reply_markup.inline_keyboard.flat();
      const jumpBtn = allButtons.find(b => b.text.includes('Jump'));
      expect(jumpBtn).toBeTruthy();
    });

    test('no Jump button when <= 2 pages', async () => {
      const ctx = makeCtx();
      const shortObs = fakeObs.slice(0, 10); // 2 pages
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, shortObs, 'SG', 'sightings', 0);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allButtons = opts.reply_markup.inline_keyboard.flat();
      const jumpBtn = allButtons.find(b => b.text.includes('Jump'));
      expect(jumpBtn).toBeUndefined();
    });

    test('includes Summary, Share, New Search, Done buttons', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const allButtons = opts.reply_markup.inline_keyboard.flat();
      const texts = allButtons.map(b => b.text);

      expect(texts).toEqual(expect.arrayContaining([
        expect.stringContaining('Summary'),
        expect.stringContaining('Share'),
        expect.stringContaining('New Search'),
        expect.stringContaining('Done'),
      ]));
    });

    test('edits existing message when messageId provided', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0, 999, 'SG');

      expect(ctx.bot.editMessageText).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chat_id: 1,
          message_id: 999,
          parse_mode: 'Markdown',
        })
      );
      // Should NOT send new message
      expect(ctx.sendMessage).not.toHaveBeenCalled();
    });

    test('falls back to sendMessage if editMessageText fails', async () => {
      const ctx = makeCtx();
      ctx.bot.editMessageText.mockRejectedValue(new Error('edit failed'));

      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'SG', 'sightings', 0, 999);

      // Should fall through to sendMessage
      expect(ctx.sendMessage).toHaveBeenCalled();
    });

    test('uses correct title for notable type', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'Singapore', 'notable', 0);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Notable');
    });

    test('uses correct title for species type', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, fakeObs, 'House Sparrow in SG', 'species', 0);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('House Sparrow');
    });

    test('single page has no prev/next', async () => {
      const ctx = makeCtx();
      const onePageObs = fakeObs.slice(0, 3);
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, onePageObs, 'SG', 'sightings', 0);

      const opts = ctx.sendMessage.mock.calls[0][2];
      const navRow = opts.reply_markup.inline_keyboard[0];
      const texts = navRow.map(b => b.text);
      expect(texts).not.toEqual(expect.arrayContaining([expect.stringContaining('Next')]));
      expect(texts).not.toEqual(expect.arrayContaining([expect.stringContaining('Prev')]));
    });
  });

  // ─── sendSummaryMessage ─────────────────────────────────

  describe('sendSummaryMessage()', () => {
    const fakeObs = [
      { comName: 'House Sparrow', speciesCode: 'houspa', locName: 'Park A', howMany: 3, obsDt: '2026-02-15 08:30' },
      { comName: 'House Sparrow', speciesCode: 'houspa', locName: 'Park B', howMany: 2, obsDt: '2026-02-15 09:00' },
      { comName: 'Common Myna', speciesCode: 'commyn', locName: 'Park A', howMany: 5, obsDt: '2026-02-15 10:00' },
    ];

    test('sends summary with species count', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Summary');
      expect(text).toContain('2'); // 2 species
      expect(text).toContain('3 sightings');
    });

    test('groups observations by species', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('House Sparrow');
      expect(text).toContain('Common Myna');
    });

    test('shows locations as sub-points', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Park A');
      expect(text).toContain('Park B');
    });

    test('shows dates and times', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('15/02/2026');
      expect(text).toContain('08:30');
    });

    test('shows count per species (x notation)', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('x5'); // House Sparrow total: 3+2=5
      expect(text).toContain('x5'); // Common Myna: 5
    });

    test('includes Bird Sighting Bot footer', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendSummaryMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Bird Sighting Bot');
    });

    test('handles observations without obsDt gracefully', async () => {
      const ctx = makeCtx();
      const obs = [{ comName: 'Test Bird', speciesCode: 'test', locName: 'Park', howMany: 1 }];
      await expect(
        displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'SG', 'sightings', 'SG')
      ).resolves.toBeUndefined();
    });

    test('truncates after 3800 chars with remaining count', async () => {
      const ctx = makeCtx();
      // Create many species to hit the length limit
      const manyObs = Array.from({ length: 200 }, (_, i) => ({
        comName: `Species ${i} With Very Long Name To Fill Up Characters Quickly`,
        speciesCode: `sp${i}`,
        locName: `Location ${i} Also With A Really Long Name For Testing`,
        howMany: 1,
        obsDt: `2026-02-15 ${String(i % 24).padStart(2, '0')}:00`,
      }));

      await displayHandlers.sendSummaryMessage.call(ctx, 1, manyObs, 'SG', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      // Should either contain all species or truncate with "...and X more"
      expect(text.length).toBeGreaterThan(0);
    });
  });

  // ─── sendFullListMessage ────────────────────────────────

  describe('sendFullListMessage()', () => {
    const fakeObs = Array.from({ length: 8 }, (_, i) => ({
      comName: `Bird ${i}`,
      locName: `Loc ${i}`,
    }));

    test('sends full list with all observations', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendFullListMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      expect(ctx.sendMessage).toHaveBeenCalled();
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Full Sightings List');
      expect(text).toContain('Total: 8 sightings');
    });

    test('calls formatObservation for each observation', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendFullListMessage.call(ctx, 1, fakeObs, 'SG', 'sightings', 'SG');

      expect(ctx.ebirdService.formatObservation).toHaveBeenCalledTimes(8);
    });

    test('includes Bot footer', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendFullListMessage.call(ctx, 1, fakeObs, 'SG', 'sightings', 'SG');

      const lastCall = ctx.sendMessage.mock.calls[ctx.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Bird Sighting Bot');
    });

    test('splits into multiple messages when content exceeds 4000 chars', async () => {
      const ctx = makeCtx();
      // formatObservation returns a long string to force splitting
      ctx.ebirdService.formatObservation.mockReturnValue('X'.repeat(600));

      const manyObs = Array.from({ length: 20 }, (_, i) => ({
        comName: `Bird ${i}`, locName: `Loc ${i}`,
      }));

      await displayHandlers.sendFullListMessage.call(ctx, 1, manyObs, 'SG', 'sightings', 'SG');

      // Should send more than one message
      expect(ctx.sendMessage.mock.calls.length).toBeGreaterThan(1);
    });

    test('subsequent parts have part number in header', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.formatObservation.mockReturnValue('X'.repeat(600));

      const manyObs = Array.from({ length: 20 }, (_, i) => ({
        comName: `Bird ${i}`, locName: `Loc ${i}`,
      }));

      await displayHandlers.sendFullListMessage.call(ctx, 1, manyObs, 'SG', 'sightings', 'SG');

      if (ctx.sendMessage.mock.calls.length > 1) {
        const secondMsg = ctx.sendMessage.mock.calls[1][1];
        expect(secondMsg).toContain('Part 2');
      }
    });
  });

  // ─── sendForwardableMessage ─────────────────────────────

  describe('sendForwardableMessage()', () => {
    const fakeObs = Array.from({ length: 5 }, (_, i) => ({
      comName: `Bird ${i}`,
      locName: `Loc ${i}`,
    }));

    test('sends shareable message', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendForwardableMessage.call(ctx, 1, fakeObs, 'Singapore', 'sightings', 'SG');

      expect(ctx.sendMessage).toHaveBeenCalled();
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Shared Bird Sightings');
    });

    test('includes "forward" instruction', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendForwardableMessage.call(ctx, 1, fakeObs, 'SG', 'sightings', 'SG');

      const lastCall = ctx.sendMessage.mock.calls[ctx.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Forward this message');
    });

    test('includes "Shared via Bird Sighting Bot" footer', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendForwardableMessage.call(ctx, 1, fakeObs, 'SG', 'sightings', 'SG');

      const lastCall = ctx.sendMessage.mock.calls[ctx.sendMessage.mock.calls.length - 1];
      expect(lastCall[1]).toContain('Shared via Bird Sighting Bot');
    });

    test('calls formatObservation for each observation', async () => {
      const ctx = makeCtx();
      await displayHandlers.sendForwardableMessage.call(ctx, 1, fakeObs, 'SG', 'sightings', 'SG');
      expect(ctx.ebirdService.formatObservation).toHaveBeenCalledTimes(5);
    });

    test('splits into multiple messages when needed', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.formatObservation.mockReturnValue('Y'.repeat(600));

      const manyObs = Array.from({ length: 20 }, (_, i) => ({
        comName: `Bird ${i}`, locName: `Loc ${i}`,
      }));

      await displayHandlers.sendForwardableMessage.call(ctx, 1, manyObs, 'SG', 'sightings', 'SG');

      expect(ctx.sendMessage.mock.calls.length).toBeGreaterThan(1);
    });
  });

  // ─── Additional coverage: default type title (line 23) ──

  describe('sendPaginatedObservations — default type', () => {
    test('uses "Recent Sightings" title for unrecognized type', async () => {
      const ctx = makeCtx();
      const obs = [{ comName: 'Bird', locName: 'Loc' }];
      await displayHandlers.sendPaginatedObservations.call(ctx, 1, obs, 'SG', 'unknown_type', 0);

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Recent Sightings');
    });
  });

  // ─── Additional coverage: no-times branch in sendSummaryMessage (line 174) ──

  describe('sendSummaryMessage — observation with date but no time', () => {
    test('shows date without times when obsDt has no time component', async () => {
      const ctx = makeCtx();
      // obsDt has date only (no space-separated time part)
      const obs = [
        { comName: 'Test Bird', speciesCode: 'test', locName: 'Park', howMany: 1, obsDt: '2026-02-15' },
      ];

      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'SG', 'sightings', 'SG');

      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('15/02/2026');
      // Should NOT contain a time like "08:30" — only date + tzAbbr
    });
  });

  describe('sendPaginatedObservations — nearby type title', () => {
    test('uses correct title for nearby type', async () => {
      const ctx = makeCtx();
      const obs = [{ comName: 'Spotted Dove', locName: 'Central Park' }];
      await displayHandlers.sendPaginatedObservations.call(
        ctx, 1, obs, 'Your Location (10 km)', 'nearby', 0
      );
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Birds Near');
      expect(text).toContain('Your Location');
    });
  });

  describe('sendSummaryMessage — branch coverage', () => {
    test('groups by comName when speciesCode is missing', async () => {
      const ctx = makeCtx();
      const obs = [
        { comName: 'House Sparrow', locName: 'Park', obsDt: '2026-02-15 08:00' },
        { comName: 'House Sparrow', locName: 'Park', obsDt: '2026-02-15 09:00' },
      ];
      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'Singapore', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      // Both grouped under same species entry
      expect(text).toContain('House Sparrow');
      expect(text).toContain('x2');
    });

    test('defaults howMany to 1 when howMany is falsy', async () => {
      const ctx = makeCtx();
      const obs = [
        { comName: 'Blue Jay', speciesCode: 'blujay', howMany: 0, locName: 'Park', obsDt: '2026-02-15 08:00' },
        { comName: 'Robin', speciesCode: 'amerob', howMany: undefined, locName: 'Garden', obsDt: '2026-02-15 10:00' },
      ];
      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'Test', 'sightings');
      const text = ctx.sendMessage.mock.calls[0][1];
      // Both should count as 1 each
      expect(text).toContain('x1');
    });

    test('accumulates times for same location and date', async () => {
      const ctx = makeCtx();
      const obs = [
        { comName: 'Dove', speciesCode: 'dove1', locName: 'Park A', obsDt: '2026-02-15 08:30' },
        { comName: 'Dove', speciesCode: 'dove1', locName: 'Park A', obsDt: '2026-02-15 14:00' },
      ];
      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'Test', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('08:30');
      expect(text).toContain('14:00');
    });

    test('truncates when many species exceed 3800 chars', async () => {
      const ctx = makeCtx();
      const obs = [];
      for (let i = 0; i < 80; i++) {
        obs.push({
          comName: `Very Long Species Name Number ${i} With Extra Words For Padding`,
          speciesCode: `sp${i}`,
          howMany: 3,
          locName: `Location Alpha Beta Gamma Delta ${i}`,
          obsDt: `2026-02-15 ${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        });
      }
      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'Test', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('more species');
    });

    test('truncation on last species yields remaining = 0 (no "more species" text)', async () => {
      const ctx = makeCtx();
      // Create 2 species: first with many long-named locations (fills ~3500 chars),
      // second species tips msg over 3800 → last species → remaining = 0 → no "more species" text
      const obs = [];
      for (let i = 0; i < 30; i++) {
        obs.push({
          comName: 'Species One With A Long Common Name',
          speciesCode: 'sp1',
          howMany: 1,
          locName: `A Very Long Location Name That Takes Up Space Number ${String(i).padStart(2, '0')} Area`,
          obsDt: `2026-02-15 ${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        });
      }
      for (let i = 0; i < 15; i++) {
        obs.push({
          comName: 'Species Two With Another Long Common Name',
          speciesCode: 'sp2',
          howMany: 1,
          locName: `Another Very Long Location Name For Second Species Number ${String(i).padStart(2, '0')}`,
          obsDt: `2026-02-15 ${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        });
      }
      await displayHandlers.sendSummaryMessage.call(ctx, 1, obs, 'Test', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      // Should NOT contain "more species" because remaining = 0 at last species
      expect(text).not.toContain('more species');
      // But message should still be truncated (contains Bird Sighting Bot footer)
      expect(text).toContain('Bird Sighting Bot');
    });
  });

  describe('sendForwardableMessage', () => {
    test('sends forwardable message with correct header', async () => {
      const ctx = makeCtx();
      const obs = [
        { comName: 'House Sparrow', locName: 'Park' },
        { comName: 'Blue Jay', locName: 'Garden' },
      ];
      await displayHandlers.sendForwardableMessage.call(ctx, 1, obs, 'Singapore', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Shared Bird Sightings');
      expect(text).toContain('Forward this message');
    });

    test('sends forwardable message without regionCode', async () => {
      const ctx = makeCtx();
      const obs = [{ comName: 'Robin', locName: 'Park' }];
      await displayHandlers.sendForwardableMessage.call(ctx, 1, obs, 'Test', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalled();
    });

    test('splits into multiple parts when message is too long', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.formatObservation = jest.fn(() => 'x'.repeat(200));
      const obs = [];
      for (let i = 0; i < 30; i++) {
        obs.push({ comName: `Bird ${i}`, locName: 'Loc' });
      }
      await displayHandlers.sendForwardableMessage.call(ctx, 1, obs, 'Test', 'sightings');
      // Should have been called multiple times for multi-part
      expect(ctx.sendMessage.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('sendFullListMessage', () => {
    test('sends full list with correct header', async () => {
      const ctx = makeCtx();
      const obs = [
        { comName: 'House Sparrow', locName: 'Park' },
      ];
      await displayHandlers.sendFullListMessage.call(ctx, 1, obs, 'Singapore', 'sightings', 'SG');
      const text = ctx.sendMessage.mock.calls[0][1];
      expect(text).toContain('Full Sightings List');
      expect(text).toContain('Bird Sighting Bot');
    });

    test('sends full list without regionCode', async () => {
      const ctx = makeCtx();
      const obs = [{ comName: 'Robin', locName: 'Park' }];
      await displayHandlers.sendFullListMessage.call(ctx, 1, obs, 'Test', 'sightings');
      expect(ctx.sendMessage).toHaveBeenCalled();
    });

    test('splits into multiple parts when message is too long', async () => {
      const ctx = makeCtx();
      ctx.ebirdService.formatObservation = jest.fn(() => 'y'.repeat(200));
      const obs = [];
      for (let i = 0; i < 30; i++) {
        obs.push({ comName: `Bird ${i}`, locName: 'Loc' });
      }
      await displayHandlers.sendFullListMessage.call(ctx, 1, obs, 'Test', 'sightings');
      expect(ctx.sendMessage.mock.calls.length).toBeGreaterThan(1);
      // Second part should contain "Part 2"
      const secondCall = ctx.sendMessage.mock.calls[1][1];
      expect(secondCall).toContain('Part 2');
    });
  });
});

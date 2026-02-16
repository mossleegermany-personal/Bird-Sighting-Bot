/**
 * Tests for src/services/sheetsService.js
 * Mocks googleapis so no real Sheets API calls happen.
 */

// Mock googleapis BEFORE requiring sheetsService
jest.mock('googleapis', () => {
  const mockAppend = jest.fn().mockResolvedValue({});
  const mockGet = jest.fn().mockResolvedValue({ data: { values: [] } });
  const mockUpdate = jest.fn().mockResolvedValue({});
  const mockClear = jest.fn().mockResolvedValue({});
  const mockBatchUpdate = jest.fn().mockResolvedValue({});

  return {
    google: {
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getClient: jest.fn().mockResolvedValue({}),
        })),
      },
      sheets: jest.fn(() => ({
        spreadsheets: {
          values: {
            append: mockAppend,
            get: mockGet,
            update: mockUpdate,
            clear: mockClear,
          },
          batchUpdate: mockBatchUpdate,
        },
      })),
    },
    // Expose mocks for assertions
    __mocks: { mockAppend, mockGet, mockUpdate, mockClear, mockBatchUpdate },
  };
});

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Save original env
const originalEnv = { ...process.env };

describe('SheetsService', () => {
  let sheetsService;
  let mocks;

  beforeEach(() => {
    // Reset module registry so we get a fresh singleton
    jest.resetModules();

    process.env.GOOGLE_SHEETS_ID = 'test-sheet-id';
    process.env.GOOGLE_CREDENTIALS_PATH = './fake-creds.json';

    // Re-require to pick up fresh env
    const googleapis = require('googleapis');
    mocks = googleapis.__mocks;

    // Reset mock state
    Object.values(mocks).forEach(m => m.mockClear());

    // Mock headers already match (so _ensureHeaders is happy)
    mocks.mockGet.mockResolvedValue({
      data: {
        values: [['Timestamp', 'Username', 'Command', 'Search Query', 'Region Code', 'Total Sightings', 'Unique Species Count', 'Species List']],
      },
    });

    sheetsService = require('../../src/services/sheetsService');
    // Reset initialized flag so _init runs fresh
    sheetsService.initialized = false;
    sheetsService.sheets = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── logSightings ───────────────────────────────────────

  describe('logSightings()', () => {
    test('writes a single row with correct 8-column structure', async () => {
      mocks.mockAppend.mockResolvedValue({});

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '12345',
        username: 'moseslee',
        searchQuery: 'Singapore',
        regionCode: 'SG',
        observations: [
          { comName: 'House Sparrow' },
          { comName: 'Common Myna' },
          { comName: 'House Sparrow' }, // duplicate
        ],
      });

      expect(mocks.mockAppend).toHaveBeenCalledTimes(1);

      const call = mocks.mockAppend.mock.calls[0][0];
      const row = call.requestBody.values[0];

      // 8 columns
      expect(row).toHaveLength(8);
      // Timestamp (ISO string)
      expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Username
      expect(row[1]).toBe('moseslee');
      // Command
      expect(row[2]).toBe('sightings');
      // Search Query
      expect(row[3]).toBe('Singapore');
      // Region Code
      expect(row[4]).toBe('SG');
      // Total Sightings (count includes duplicates)
      expect(row[5]).toBe(3);
      // Unique Species Count (deduped via Set)
      expect(row[6]).toBe(2);
      // Species List (sorted, comma-separated)
      expect(row[7]).toBe('Common Myna, House Sparrow');
    });

    test('skips logging when observations array is empty', async () => {
      await sheetsService.logSightings({
        command: 'notable',
        chatId: '12345',
        username: 'user',
        searchQuery: 'SG',
        regionCode: 'SG',
        observations: [],
      });

      expect(mocks.mockAppend).not.toHaveBeenCalled();
    });

    test('skips logging when observations is null', async () => {
      await sheetsService.logSightings({
        command: 'notable',
        chatId: '12345',
        username: 'user',
        searchQuery: 'SG',
        regionCode: 'SG',
        observations: null,
      });

      expect(mocks.mockAppend).not.toHaveBeenCalled();
    });

    test('uses "unknown" when username is missing', async () => {
      mocks.mockAppend.mockResolvedValue({});

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '12345',
        username: undefined,
        searchQuery: 'SG',
        regionCode: 'SG',
        observations: [{ comName: 'Test Bird' }],
      });

      const row = mocks.mockAppend.mock.calls[0][0].requestBody.values[0];
      expect(row[1]).toBe('unknown');
    });

    test('does not throw on append error (fire-and-forget)', async () => {
      mocks.mockAppend.mockRejectedValue(new Error('Sheets API down'));

      // Should NOT throw
      await expect(
        sheetsService.logSightings({
          command: 'sightings',
          chatId: '12345',
          username: 'user',
          searchQuery: 'SG',
          regionCode: 'SG',
          observations: [{ comName: 'Bird' }],
        })
      ).resolves.toBeUndefined();
    });

    test('logs different command types correctly', async () => {
      mocks.mockAppend.mockResolvedValue({});

      for (const cmd of ['sightings', 'notable', 'nearby', 'species']) {
        await sheetsService.logSightings({
          command: cmd,
          chatId: '12345',
          username: 'user',
          searchQuery: 'Test',
          regionCode: 'SG',
          observations: [{ comName: 'Bird' }],
        });
      }

      expect(mocks.mockAppend).toHaveBeenCalledTimes(4);
    });
  });

  // ─── Initialization ─────────────────────────────────────

  describe('initialization', () => {
    test('warns and skips when GOOGLE_SHEETS_ID is missing', async () => {
      jest.resetModules();
      delete process.env.GOOGLE_SHEETS_ID;

      const logger = require('../../src/utils/logger');
      const svc = require('../../src/services/sheetsService');
      svc.initialized = false;
      svc.sheets = null;

      await svc.logSightings({
        command: 'test',
        chatId: '1',
        username: 'u',
        searchQuery: 'q',
        regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(logger.warn).toHaveBeenCalled();
    });

    test('successfully initializes and sets initialized = true', async () => {
      const logger = require('../../src/utils/logger');

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '1',
        username: 'u',
        searchQuery: 'q',
        regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(sheetsService.initialized).toBe(true);
      expect(sheetsService.sheets).toBeTruthy();
      expect(logger.info).toHaveBeenCalledWith(
        'Google Sheets service initialized',
        expect.objectContaining({ spreadsheetId: 'test-sheet-id' })
      );
    });

    test('does not re-init once initialized', async () => {
      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      const getCount = mocks.mockGet.mock.calls.length;

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird2' }],
      });

      // _ensureHeaders should NOT run again
      expect(mocks.mockGet.mock.calls.length).toBe(getCount);
    });

    test('_init catches errors and logs them', async () => {
      const logger = require('../../src/utils/logger');
      const { google } = require('googleapis');
      // Make GoogleAuth throw
      google.auth.GoogleAuth.mockImplementation(() => {
        throw new Error('auth broken');
      });

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize Google Sheets',
        expect.objectContaining({ error: 'auth broken' })
      );
    });
  });

  // ─── _ensureHeaders ─────────────────────────────────────

  describe('_ensureHeaders()', () => {
    test('clears and rewrites when headers mismatch', async () => {
      mocks.mockGet.mockResolvedValue({
        data: { values: [['Wrong', 'Headers']] },
      });

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(mocks.mockClear).toHaveBeenCalledWith(
        expect.objectContaining({ range: 'BirdSightings!A:Z' })
      );
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          valueInputOption: 'RAW',
          requestBody: { values: [expect.arrayContaining(['Timestamp', 'Username'])] },
        })
      );
    });

    test('clears and rewrites when header row is empty', async () => {
      mocks.mockGet.mockResolvedValue({ data: { values: [] } });

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(mocks.mockClear).toHaveBeenCalled();
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    test('clears and rewrites when header row is undefined (no data.values)', async () => {
      mocks.mockGet.mockResolvedValue({ data: {} });

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(mocks.mockClear).toHaveBeenCalled();
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    test('creates sheet on "Unable to parse range" error', async () => {
      mocks.mockGet.mockRejectedValue(new Error('Unable to parse range'));

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(mocks.mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [{ addSheet: { properties: { title: 'BirdSightings' } } }],
          },
        })
      );
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    test('logs error when "Unable to parse range" and addSheet fails', async () => {
      const logger = require('../../src/utils/logger');
      mocks.mockGet.mockRejectedValue(new Error('Unable to parse range'));
      mocks.mockBatchUpdate.mockRejectedValue(new Error('Sheet already exists'));

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create BirdSightings sheet',
        expect.objectContaining({ error: 'Sheet already exists' })
      );
    });

    test('logs error for non-parse-range errors', async () => {
      const logger = require('../../src/utils/logger');
      mocks.mockGet.mockRejectedValue(new Error('Permission denied'));

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check headers',
        expect.objectContaining({ error: 'Permission denied' })
      );
    });

    test('logs sheet headers reset message', async () => {
      const logger = require('../../src/utils/logger');
      mocks.mockGet.mockResolvedValue({
        data: { values: [['Old', 'Format']] },
      });

      await sheetsService.logSightings({
        command: 'test', chatId: '1', username: 'u',
        searchQuery: 'q', regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      expect(logger.info).toHaveBeenCalledWith('Sheet headers reset to new format');
    });
  });

  describe('logSightings — branch coverage', () => {
    test('skips observations without comName in species summary', async () => {
      mocks.mockAppend.mockResolvedValue({});

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '12345',
        username: 'user',
        searchQuery: 'SG',
        regionCode: 'SG',
        observations: [
          { comName: 'House Sparrow' },
          { },
          { comName: null },
        ],
      });

      const row = mocks.mockAppend.mock.calls[0][0].requestBody.values[0];
      expect(row[5]).toBe(3);
      expect(row[6]).toBe(1);
      expect(row[7]).toBe('House Sparrow');
    });

    test('uses empty string when searchQuery is null', async () => {
      mocks.mockAppend.mockResolvedValue({});

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '12345',
        username: 'user',
        searchQuery: null,
        regionCode: 'SG',
        observations: [{ comName: 'Bird' }],
      });

      const row = mocks.mockAppend.mock.calls[0][0].requestBody.values[0];
      expect(row[3]).toBe('');
    });

    test('uses empty string when regionCode is null', async () => {
      mocks.mockAppend.mockResolvedValue({});

      await sheetsService.logSightings({
        command: 'sightings',
        chatId: '12345',
        username: 'user',
        searchQuery: 'Test',
        regionCode: null,
        observations: [{ comName: 'Bird' }],
      });

      const row = mocks.mockAppend.mock.calls[0][0].requestBody.values[0];
      expect(row[4]).toBe('');
    });
  });
});

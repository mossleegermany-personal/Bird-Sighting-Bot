/**
 * Tests for src/services/ebirdService.js
 * Uses mocked axios to avoid real API calls.
 */
const axios = require('axios');
jest.mock('axios');

// Mock logger to silence output during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const EBirdService = require('../../src/services/ebirdService');

describe('EBirdService', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    // Create a mock axios client
    mockClient = {
      get: jest.fn(),
    };
    axios.create.mockReturnValue(mockClient);

    service = new EBirdService('test-api-key');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Constructor ────────────────────────────────────────

  describe('constructor', () => {
    test('stores the API key', () => {
      expect(service.apiKey).toBe('test-api-key');
    });

    test('sets the base URL to eBird v2', () => {
      expect(service.baseUrl).toBe('https://api.ebird.org/v2');
    });

    test('initializes empty taxonomy cache', () => {
      expect(service.taxonomyCache).toBeNull();
      expect(service.taxonomyCacheTime).toBeNull();
    });

    test('sets taxonomy cache TTL to 24 hours', () => {
      expect(service.TAXONOMY_CACHE_TTL).toBe(24 * 60 * 60 * 1000);
    });

    test('creates axios client with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.ebird.org/v2',
        headers: { 'X-eBirdApiToken': 'test-api-key' },
      });
    });
  });

  // ─── getRecentObservations ──────────────────────────────

  describe('getRecentObservations()', () => {
    const mockObservations = [
      { comName: 'House Sparrow', speciesCode: 'houspa', locName: 'Park', obsDt: '2026-02-15 08:00' },
      { comName: 'Common Myna', speciesCode: 'commyn', locName: 'Garden', obsDt: '2026-02-15 09:00' },
    ];

    test('calls the correct API endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: mockObservations });
      await service.getRecentObservations('SG', 14, 20);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/SG/recent', {
        params: { back: 14, maxResults: 20 },
      });
    });

    test('uppercases region code', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getRecentObservations('sg');
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/SG/recent', expect.anything());
    });

    test('returns observation data', async () => {
      mockClient.get.mockResolvedValue({ data: mockObservations });
      const result = await service.getRecentObservations('SG');
      expect(result).toEqual(mockObservations);
      expect(result).toHaveLength(2);
    });

    test('uses default params when not provided', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getRecentObservations('US');
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/US/recent', {
        params: { back: 14, maxResults: 20 },
      });
    });

    test('throws on API error', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));
      await expect(service.getRecentObservations('SG')).rejects.toThrow('Network error');
    });
  });

  // ─── getNotableObservations ─────────────────────────────

  describe('getNotableObservations()', () => {
    test('calls notable endpoint with detail=full', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNotableObservations('SG', 14, 20);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/SG/recent/notable', {
        params: { back: 14, maxResults: 20, detail: 'full' },
      });
    });

    test('returns data on success', async () => {
      const mockData = [{ comName: 'Fairy Pitta' }];
      mockClient.get.mockResolvedValue({ data: mockData });
      const result = await service.getNotableObservations('SG');
      expect(result).toEqual(mockData);
    });

    test('throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('API down'));
      await expect(service.getNotableObservations('SG')).rejects.toThrow('API down');
    });
  });

  // ─── getSpeciesObservations ─────────────────────────────

  describe('getSpeciesObservations()', () => {
    test('calls species-specific endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getSpeciesObservations('SG', 'houspa', 7);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/SG/recent/houspa', {
        params: { back: 7 },
      });
    });
  });

  // ─── getNearbyObservations ──────────────────────────────

  describe('getNearbyObservations()', () => {
    test('calls geo endpoint with correct params', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNearbyObservations(1.35, 103.82, 10, 7, 50);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/geo/recent', {
        params: { lat: 1.35, lng: 103.82, dist: 10, back: 7, maxResults: 50 },
      });
    });

    test('uses default dist=25, back=14, maxResults=20', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNearbyObservations(1.35, 103.82);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/geo/recent', {
        params: { lat: 1.35, lng: 103.82, dist: 25, back: 14, maxResults: 20 },
      });
    });
  });

  // ─── getNearbyNotableObservations ───────────────────────

  describe('getNearbyNotableObservations()', () => {
    test('calls geo notable endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNearbyNotableObservations(1.35, 103.82, 15, 10);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/geo/recent/notable', {
        params: { lat: 1.35, lng: 103.82, dist: 15, back: 10, detail: 'full' },
      });
    });
  });

  // ─── getTaxonomy / searchSpeciesByName ──────────────────

  describe('getTaxonomy()', () => {
    test('fetches taxonomy from API on first call', async () => {
      const mockTaxonomy = [{ comName: 'House Sparrow', speciesCode: 'houspa', sciName: 'Passer domesticus' }];
      mockClient.get.mockResolvedValue({ data: mockTaxonomy });

      const result = await service.getTaxonomy();
      expect(result).toEqual(mockTaxonomy);
      expect(mockClient.get).toHaveBeenCalledWith('/ref/taxonomy/ebird', {
        params: { fmt: 'json', cat: 'species' },
      });
    });

    test('returns cached taxonomy on second call', async () => {
      const mockTaxonomy = [{ comName: 'House Sparrow' }];
      mockClient.get.mockResolvedValue({ data: mockTaxonomy });

      await service.getTaxonomy();
      const result = await service.getTaxonomy();
      expect(result).toEqual(mockTaxonomy);
      expect(mockClient.get).toHaveBeenCalledTimes(1); // only one API call
    });
  });

  describe('searchSpeciesByName()', () => {
    beforeEach(() => {
      // Pre-populate taxonomy cache
      service.taxonomyCache = [
        { comName: 'House Sparrow', sciName: 'Passer domesticus', speciesCode: 'houspa' },
        { comName: 'Eurasian Tree Sparrow', sciName: 'Passer montanus', speciesCode: 'eutspa' },
        { comName: 'Common Myna', sciName: 'Acridotheres tristis', speciesCode: 'commyn' },
        { comName: 'Fairy Pitta', sciName: 'Pitta nympha', speciesCode: 'faipit1' },
      ];
      service.taxonomyCacheTime = Date.now();
    });

    test('finds species by common name', async () => {
      const results = await service.searchSpeciesByName('sparrow');
      expect(results.length).toBe(2);
    });

    test('finds species by scientific name', async () => {
      const results = await service.searchSpeciesByName('Passer');
      expect(results.length).toBe(2);
    });

    test('prioritizes exact-start matches', async () => {
      const results = await service.searchSpeciesByName('house');
      expect(results[0].comName).toBe('House Sparrow');
    });

    test('returns at most 10 results', async () => {
      // Fill cache with many items
      service.taxonomyCache = Array.from({ length: 50 }, (_, i) => ({
        comName: `Test Bird ${i}`,
        sciName: `Testus birdus${i}`,
        speciesCode: `test${i}`,
      }));
      const results = await service.searchSpeciesByName('test');
      expect(results.length).toBeLessThanOrEqual(10);
    });

    test('is case-insensitive', async () => {
      const results = await service.searchSpeciesByName('FAIRY PITTA');
      expect(results.length).toBe(1);
      expect(results[0].comName).toBe('Fairy Pitta');
    });
  });

  // ─── getHotspots ────────────────────────────────────────

  describe('getHotspots()', () => {
    test('calls hotspot endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getHotspots('SG');
      expect(mockClient.get).toHaveBeenCalledWith('/ref/hotspot/SG');
    });
  });

  // ─── getPopularHotspots ─────────────────────────────────

  describe('getPopularHotspots()', () => {
    test('sorts by species count descending', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'A', numSpeciesAllTime: 50 },
          { locName: 'B', numSpeciesAllTime: 200 },
          { locName: 'C', numSpeciesAllTime: 100 },
        ],
      });

      const result = await service.getPopularHotspots('SG', 10);
      expect(result[0].locName).toBe('B');
      expect(result[1].locName).toBe('C');
      expect(result[2].locName).toBe('A');
    });

    test('limits results', async () => {
      mockClient.get.mockResolvedValue({
        data: Array.from({ length: 20 }, (_, i) => ({ locName: `Spot ${i}`, numSpeciesAllTime: i })),
      });
      const result = await service.getPopularHotspots('SG', 5);
      expect(result).toHaveLength(5);
    });

    test('returns empty array when no hotspots', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      const result = await service.getPopularHotspots('SG');
      expect(result).toEqual([]);
    });
  });

  // ─── getNearbyHotspots ──────────────────────────────────

  describe('getNearbyHotspots()', () => {
    test('calls geo hotspot endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNearbyHotspots(1.35, 103.82, 10);
      expect(mockClient.get).toHaveBeenCalledWith('/ref/hotspot/geo', {
        params: { lat: 1.35, lng: 103.82, dist: 10 },
      });
    });
  });

  // ─── getHotspotObservations ─────────────────────────────

  describe('getHotspotObservations()', () => {
    test('calls location-specific endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getHotspotObservations('L12345', 7, 50);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/L12345/recent', {
        params: { back: 7, maxResults: 50 },
      });
    });
  });

  // ─── formatDate ─────────────────────────────────────────

  describe('formatDate()', () => {
    test('reformats eBird date to DD/MM/YYYY with time and timezone', () => {
      const result = service.formatDate('2026-02-15 08:30', 'SG');
      expect(result).toContain('15/02/2026');
      expect(result).toContain('08:30');
    });

    test('handles date without time part', () => {
      const result = service.formatDate('2026-02-15', 'SG');
      expect(result).toContain('15/02/2026');
    });

    test('returns "Unknown" for null', () => {
      expect(service.formatDate(null)).toBe('Unknown');
    });

    test('returns "Unknown" for undefined', () => {
      expect(service.formatDate(undefined)).toBe('Unknown');
    });
  });

  // ─── formatObservation ──────────────────────────────────

  describe('formatObservation()', () => {
    const obs = {
      comName: 'House Sparrow',
      sciName: 'Passer domesticus',
      locName: 'Botanic Gardens',
      lat: 1.3138,
      lng: 103.8159,
      obsDt: '2026-02-15 08:30',
      speciesCode: 'houspa',
      subId: 'S123456',
      userDisplayName: 'John Doe',
    };

    test('includes species name', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('House Sparrow');
    });

    test('includes scientific name', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('Passer domesticus');
    });

    test('includes location', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('Botanic Gardens');
    });

    test('includes Google Maps link', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('maps.google.com');
      expect(result).toContain('1.3138');
    });

    test('includes eBird checklist link with species anchor', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('ebird.org/checklist/S123456#houspa');
    });

    test('includes reporter name', () => {
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('John Doe');
    });

    test('omits checklist link when no subId', () => {
      const obsNoSub = { ...obs, subId: undefined };
      const result = service.formatObservation(obsNoSub, 'SG');
      expect(result).not.toContain('ebird.org/checklist');
    });

    test('omits reporter when no userDisplayName', () => {
      const obsNoUser = { ...obs, userDisplayName: undefined };
      const result = service.formatObservation(obsNoUser, 'SG');
      expect(result).not.toContain('Reported by');
    });
  });

  // ─── deduplicateObservations ────────────────────────────

  describe('deduplicateObservations()', () => {
    test('removes duplicate observations', () => {
      const obs = [
        { speciesCode: 'houspa', locId: 'L1', obsDt: '2026-02-15 08:00' },
        { speciesCode: 'houspa', locId: 'L1', obsDt: '2026-02-15 08:00' }, // dup
        { speciesCode: 'commyn', locId: 'L1', obsDt: '2026-02-15 09:00' },
      ];
      expect(service.deduplicateObservations(obs)).toHaveLength(2);
    });

    test('keeps observations with different locations', () => {
      const obs = [
        { speciesCode: 'houspa', locId: 'L1', obsDt: '2026-02-15' },
        { speciesCode: 'houspa', locId: 'L2', obsDt: '2026-02-15' },
      ];
      expect(service.deduplicateObservations(obs)).toHaveLength(2);
    });

    test('returns empty array for null input', () => {
      expect(service.deduplicateObservations(null)).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      expect(service.deduplicateObservations([])).toEqual([]);
    });
  });

  // ─── searchHotspotsByName ───────────────────────────────

  describe('searchHotspotsByName()', () => {
    test('filters hotspots by name match', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'Botanic Gardens', numSpeciesAllTime: 150 },
          { locName: 'Marina Bay', numSpeciesAllTime: 80 },
          { locName: 'Botanical Park', numSpeciesAllTime: 60 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'botanic');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].locName).toBe('Botanic Gardens');
    });

    test('returns empty for no matches', async () => {
      mockClient.get.mockResolvedValue({
        data: [{ locName: 'Central Park' }],
      });
      const results = await service.searchHotspotsByName('US', 'xyzzy');
      expect(results).toEqual([]);
    });
  });

  // ─── preloadTaxonomy ─────────────────────────────────

  describe('preloadTaxonomy()', () => {
    test('fetches taxonomy and caches it', async () => {
      const mockTaxonomy = [{ comName: 'Sparrow', speciesCode: 'spa' }];
      mockClient.get.mockResolvedValue({ data: mockTaxonomy });

      await service.preloadTaxonomy();
      expect(service.taxonomyCache).toEqual(mockTaxonomy);
      expect(service.taxonomyCacheTime).toBeDefined();
      expect(mockClient.get).toHaveBeenCalledWith('/ref/taxonomy/ebird', {
        params: { fmt: 'json', cat: 'species' },
      });
    });

    test('logs species count on success', async () => {
      const logger = require('../../src/utils/logger');
      mockClient.get.mockResolvedValue({ data: [{ comName: 'A' }, { comName: 'B' }] });

      await service.preloadTaxonomy();
      expect(logger.info).toHaveBeenCalledWith('Taxonomy cached', { species: 2 });
    });

    test('warns but does not throw on failure', async () => {
      const logger = require('../../src/utils/logger');
      mockClient.get.mockRejectedValue(new Error('timeout'));

      await expect(service.preloadTaxonomy()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to preload taxonomy'),
        expect.objectContaining({ error: 'timeout' })
      );
    });
  });

  // ─── getObservationsBySpeciesName ───────────────────────

  describe('getObservationsBySpeciesName()', () => {
    beforeEach(() => {
      service.taxonomyCache = [
        { comName: 'House Sparrow', sciName: 'Passer domesticus', speciesCode: 'houspa' },
        { comName: 'Eurasian Tree Sparrow', sciName: 'Passer montanus', speciesCode: 'eutspa' },
      ];
      service.taxonomyCacheTime = Date.now();
    });

    test('returns species info and observations for a match', async () => {
      const mockObs = [{ comName: 'House Sparrow', locName: 'Park' }];
      mockClient.get.mockResolvedValue({ data: mockObs });

      const result = await service.getObservationsBySpeciesName('SG', 'house sparrow');
      expect(result.species).toEqual({
        code: 'houspa',
        commonName: 'House Sparrow',
        scientificName: 'Passer domesticus',
      });
      expect(result.observations).toEqual(mockObs);
    });

    test('returns alternatives from remaining matches', async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      const result = await service.getObservationsBySpeciesName('SG', 'sparrow');
      expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    });

    test('returns error when species not found', async () => {
      const result = await service.getObservationsBySpeciesName('SG', 'xyzzy bird');
      expect(result.species).toBeNull();
      expect(result.observations).toEqual([]);
      expect(result.error).toBe('Species not found');
    });

    test('uses custom back days parameter', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getObservationsBySpeciesName('SG', 'house sparrow', 7);
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/SG/recent/houspa', {
        params: { back: 7 },
      });
    });

    test('throws on API error', async () => {
      mockClient.get.mockRejectedValue(new Error('API fail'));
      await expect(service.getObservationsBySpeciesName('SG', 'house sparrow')).rejects.toThrow('API fail');
    });
  });

  // ─── Error paths for API methods ────────────────────────

  describe('error paths', () => {
    test('getRecentObservations logs response details when available', async () => {
      const logger = require('../../src/utils/logger');
      const err = new Error('Bad Request');
      err.response = { status: 400, data: 'Invalid region' };
      mockClient.get.mockRejectedValue(err);

      await expect(service.getRecentObservations('INVALID')).rejects.toThrow('Bad Request');
      expect(logger.debug).toHaveBeenCalledWith('Response details', { status: 400, data: 'Invalid region' });
    });

    test('getSpeciesObservations throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('species fail'));
      await expect(service.getSpeciesObservations('SG', 'houspa')).rejects.toThrow('species fail');
    });

    test('getNearbyObservations throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('nearby fail'));
      await expect(service.getNearbyObservations(1.35, 103.82)).rejects.toThrow('nearby fail');
    });

    test('getNearbyNotableObservations throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('notable nearby fail'));
      await expect(service.getNearbyNotableObservations(1, 103)).rejects.toThrow('notable nearby fail');
    });

    test('getHotspots throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('hotspot fail'));
      await expect(service.getHotspots('SG')).rejects.toThrow('hotspot fail');
    });

    test('getHotspotObservations throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('obs fail'));
      await expect(service.getHotspotObservations('L123')).rejects.toThrow('obs fail');
    });

    test('getNearbyHotspots throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('geo fail'));
      await expect(service.getNearbyHotspots(1, 103)).rejects.toThrow('geo fail');
    });

    test('getPopularHotspots throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('popular fail'));
      await expect(service.getPopularHotspots('SG')).rejects.toThrow('popular fail');
    });

    test('searchHotspotsByName throws on error', async () => {
      mockClient.get.mockRejectedValue(new Error('search fail'));
      await expect(service.searchHotspotsByName('SG', 'botanic')).rejects.toThrow('search fail');
    });

    test('searchSpeciesByName throws on error when taxonomy fetch fails', async () => {
      // Clear cache so it has to fetch
      service.taxonomyCache = null;
      service.taxonomyCacheTime = null;
      mockClient.get.mockRejectedValue(new Error('taxonomy fail'));
      await expect(service.searchSpeciesByName('sparrow')).rejects.toThrow('taxonomy fail');
    });
  });

  // ─── searchHotspotsByName — additional coverage ─────────

  describe('searchHotspotsByName() — edge cases', () => {
    test('returns empty when hotspots data is empty array', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      const result = await service.searchHotspotsByName('SG', 'botanic');
      expect(result).toEqual([]);
    });

    test('returns empty when hotspots data is not array', async () => {
      mockClient.get.mockResolvedValue({ data: null });
      const result = await service.searchHotspotsByName('SG', 'botanic');
      expect(result).toEqual([]);
    });

    test('matches by partial word overlap', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'Sungei Buloh Wetland Reserve', numSpeciesAllTime: 300 },
          { locName: 'Marina Barrage', numSpeciesAllTime: 50 },
        ],
      });
      const result = await service.searchHotspotsByName('SG', 'sungei buloh');
      expect(result.length).toBe(1);
      expect(result[0].locName).toContain('Sungei Buloh');
    });

    test('sorts exact matches above starts-with above contains', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'Park near Gardens', numSpeciesAllTime: 10 },
          { locName: 'Gardens by the Bay', numSpeciesAllTime: 20 },
          { locName: 'gardens', numSpeciesAllTime: 5 },
        ],
      });
      const result = await service.searchHotspotsByName('SG', 'gardens');
      expect(result[0].locName.toLowerCase()).toBe('gardens');
    });

    test('limits results to maxResults', async () => {
      mockClient.get.mockResolvedValue({
        data: Array.from({ length: 30 }, (_, i) => ({
          locName: `Test Park ${i}`,
          numSpeciesAllTime: i,
        })),
      });
      const result = await service.searchHotspotsByName('SG', 'test park', 3);
      expect(result).toHaveLength(3);
    });

    test('handles apostrophes in names', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: "St Andrew's Cathedral", numSpeciesAllTime: 10 },
        ],
      });
      const result = await service.searchHotspotsByName('SG', "andrew's");
      expect(result.length).toBe(1);
    });
  });

  // ─── formatObservationsList — chunking ──────────────────

  describe('formatObservationsList() — chunking', () => {
    test('splits into multiple chunks when content exceeds 3500 chars', () => {
      // Create observations with long content
      const obs = Array.from({ length: 30 }, (_, i) => ({
        comName: `Really Long Bird Name Number ${i} That Takes Up Space`,
        sciName: `Scientificus longnamicus var${i}`,
        locName: `Some Very Long Location Name Park and Reserve ${i}`,
        lat: 1.3 + i * 0.01,
        lng: 103.8 + i * 0.01,
        obsDt: '2026-02-15 08:00',
        subId: `S${i}`,
        userDisplayName: `Observer ${i}`,
        speciesCode: `bird${i}`,
      }));

      const result = service.formatObservationsList(obs, 'Big List', 'SG');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(1);
    });

    test('includes title and total count in first chunk', () => {
      const obs = [
        { comName: 'Bird A', sciName: 'Sci A', locName: 'Loc', lat: 1, lng: 103, obsDt: '2026-02-15' },
        { comName: 'Bird B', sciName: 'Sci B', locName: 'Loc', lat: 1, lng: 103, obsDt: '2026-02-15' },
      ];
      const result = service.formatObservationsList(obs, 'My Title', 'SG');
      expect(result[0]).toContain('My Title');
      expect(result[0]).toContain('Total: 2');
    });

    test('deduplicates observations before formatting', () => {
      const obs = [
        { comName: 'Bird A', sciName: 'Sci A', speciesCode: 'ba', locId: 'L1', locName: 'Park', lat: 1, lng: 103, obsDt: '2026-02-15' },
        { comName: 'Bird A', sciName: 'Sci A', speciesCode: 'ba', locId: 'L1', locName: 'Park', lat: 1, lng: 103, obsDt: '2026-02-15' },
      ];
      const result = service.formatObservationsList(obs, 'Title');
      expect(result[0]).toContain('Total: 1');
    });
  });

  // ─── getHotspotObservations defaults ────────────────────

  describe('getHotspotObservations() defaults', () => {
    test('uses default back=14 and maxResults=100', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getHotspotObservations('L999');
      expect(mockClient.get).toHaveBeenCalledWith('/data/obs/L999/recent', {
        params: { back: 14, maxResults: 100 },
      });
    });
  });

  // ─── getNearbyHotspots defaults ─────────────────────────

  describe('getNearbyHotspots() defaults', () => {
    test('uses default dist=25', async () => {
      mockClient.get.mockResolvedValue({ data: [] });
      await service.getNearbyHotspots(1.35, 103.82);
      expect(mockClient.get).toHaveBeenCalledWith('/ref/hotspot/geo', {
        params: { lat: 1.35, lng: 103.82, dist: 25 },
      });
    });
  });

  // ─── getTaxonomy cache expiry ───────────────────────────

  describe('getTaxonomy() cache expiry', () => {
    test('refetches when cache has expired', async () => {
      const freshData = [{ comName: 'Fresh Bird' }];
      mockClient.get.mockResolvedValue({ data: freshData });

      // Pre-populate with expired cache
      service.taxonomyCache = [{ comName: 'Stale Bird' }];
      service.taxonomyCacheTime = Date.now() - (25 * 60 * 60 * 1000); // 25h ago

      const result = await service.getTaxonomy();
      expect(result).toEqual(freshData);
      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });
  });

  // ─── searchHotspotsByName — filter returns false ────────

  describe('searchHotspotsByName() — filter false path', () => {
    test('hotspot with no matching criteria returns false in filter', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'Botanic Gardens', numSpeciesAllTime: 150 },
          { locName: 'Completely Unrelated Place', numSpeciesAllTime: 50 },
        ],
      });

      // 'xyznotfound' won't match 'completely unrelated place' via full match,
      // and has no word overlap either
      const results = await service.searchHotspotsByName('SG', 'xyznotfound');
      expect(results).toEqual([]);
    });

    test('filter excludes hotspot where word overlap is below threshold', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locName: 'North Central Wetland Reserve Area', numSpeciesAllTime: 100 },
          { locName: 'South Beach Park and Resort', numSpeciesAllTime: 80 },
        ],
      });

      // Only 1 of 3 search words matches — below 50% threshold
      const results = await service.searchHotspotsByName('SG', 'north east gardens');
      // 'North Central Wetland Reserve Area' has 'north' but not 'east' or 'gardens' → 1/3 < ceil(3/2)=2
      // 'South Beach Park and Resort' has none → 0/3
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  // ─── formatObservationsList — chunk boundary edge case ──

  describe('formatObservationsList() — chunk boundary', () => {
    test('starts new message mid-entry when exceeding 3500 chars', () => {
      // formatObservation returns exactly 350 chars to test precise chunk boundary
      const origFormat = service.formatObservation;
      service.formatObservation = jest.fn().mockReturnValue('X'.repeat(350));

      const obs = Array.from({ length: 15 }, (_, i) => ({
        comName: `Bird${i}`, sciName: `Sci${i}`, locName: `Loc`,
        lat: 1, lng: 103, obsDt: '2026-02-15', speciesCode: `b${i}`,
      }));

      const result = service.formatObservationsList(obs, 'Test', 'SG');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(1);

      // Verify the split happened by checking that a later chunk starts with content (no header)
      if (result.length > 1) {
        expect(result[1].length).toBeGreaterThan(0);
      }

      service.formatObservation = origFormat;
    });

    test('returns error string for null observations', () => {
      const result = service.formatObservationsList(null, 'Title');
      expect(result).toBe('❌ No observations found for this location.');
    });

    test('returns error string for empty observations array', () => {
      const result = service.formatObservationsList([], 'Title');
      expect(result).toBe('❌ No observations found for this location.');
    });
  });

  describe('searchHotspotsByName — empty searchWords after filtering', () => {
    test('returns empty when all search words are stop words', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Unique Place Alpha', numSpeciesAllTime: 100, lat: 1, lng: 103 },
        ],
      });

      // "the a an at in park garden" — all get filtered out → searchWords = []
      const results = await service.searchHotspotsByName('SG', 'the a an');
      expect(results).toEqual([]);
    });
  });

  describe('searchSpeciesByName — branch coverage', () => {
    test('handles species with null comName and sciName', async () => {
      // Mock taxonomy with entries having null names
      mockClient.get.mockResolvedValue({
        data: [
          { speciesCode: 'sp1', comName: null, sciName: null },
          { speciesCode: 'sp2', comName: 'Blue Jay', sciName: 'Cyanocitta cristata' },
          { speciesCode: 'sp3', comName: 'Jay Bird', sciName: null },
        ],
      });
      service._taxonomyCache = null;
      service._taxonomyCacheTime = 0;

      const results = await service.searchSpeciesByName('jay');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const names = results.map(r => r.comName);
      expect(names).toContain('Blue Jay');
    });

    test('sorts startsWith matches before contains matches', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { speciesCode: 'rb', comName: 'Red-billed Blue Magpie', sciName: 'Urocissa' },
          { speciesCode: 'bj', comName: 'Blue Jay', sciName: 'Cyanocitta cristata' },
        ],
      });
      service._taxonomyCache = null;
      service._taxonomyCacheTime = 0;

      const results = await service.searchSpeciesByName('blue');
      // Blue Jay starts with 'blue' → should sort before Red-billed Blue Magpie
      expect(results[0].comName).toBe('Blue Jay');
    });
  });

  describe('searchHotspotsByName — sort branches', () => {
    test('sorts exact match before startsWith match', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Park Gardens', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Park', numSpeciesAllTime: 30, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'park');
      expect(results[0].locName).toBe('Park');
    });

    test('sorts startsWith before contains match', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'East Birding Lake', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Birding Hotspot', numSpeciesAllTime: 30, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'birding');
      expect(results[0].locName).toBe('Birding Hotspot');
    });

    test('handles hotspot with undefined locName in filter', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: undefined, numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Valid Lake', numSpeciesAllTime: 30, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'lake');
      expect(results.length).toBe(1);
      expect(results[0].locName).toBe('Valid Lake');
    });

    test('handles hotspot with null numSpeciesAllTime in sort', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Park Alpha', numSpeciesAllTime: undefined, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Park Beta', numSpeciesAllTime: 100, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'alpha beta');
      // Beta has 100 species, Alpha has 0 (fallback) → Beta first
      const names = results.map(r => r.locName);
      expect(names).toContain('Park Alpha');
      expect(names).toContain('Park Beta');
    });
  });

  describe('formatObservation — branch coverage', () => {
    test('no species anchor when speciesCode is missing', () => {
      const obs = {
        comName: 'Bird', sciName: 'Avis', locName: 'Park',
        lat: 1.35, lng: 103.82, obsDt: '2026-02-15 08:00',
        subId: 'S12345',
        // no speciesCode
      };
      const result = service.formatObservation(obs, 'SG');
      expect(result).toContain('https://ebird.org/checklist/S12345');
      expect(result).not.toContain('#');
    });
  });

  describe('getPopularHotspots — numSpeciesAllTime fallback', () => {
    test('sorts hotspots with undefined numSpeciesAllTime to end', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Low', numSpeciesAllTime: undefined, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'High', numSpeciesAllTime: 200, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'Mid', numSpeciesAllTime: 50, lat: 1, lng: 103 },
        ],
      });

      const results = await service.getPopularHotspots('SG', 10);
      expect(results[0].locName).toBe('High');
      expect(results[results.length - 1].locName).toBe('Low');
    });

    test('sorts two hotspots where both have null numSpeciesAllTime', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Spot A', numSpeciesAllTime: null, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Spot B', numSpeciesAllTime: 0, lat: 1, lng: 103 },
        ],
      });
      const results = await service.getPopularHotspots('SG', 10);
      expect(results).toHaveLength(2);
    });
  });

  // ─── searchSpeciesByName — comprehensive sort branches ──

  describe('searchSpeciesByName — all sort comparator branches', () => {
    test('covers !aStarts && bStarts branch with 3 species', async () => {
      // Order matters for V8 insertion sort: put startsWith items first,
      // so the non-starting item is inserted last and compared against a starting item
      mockClient.get.mockResolvedValue({
        data: [
          { speciesCode: 'bj', comName: 'Blue Jay', sciName: 'Sci2' },
          { speciesCode: 'bh', comName: 'Blue Heron', sciName: 'Sci3' },
          { speciesCode: 'pf', comName: 'Pacific Blue Flycatcher', sciName: 'Sci1' },
        ],
      });

      const results = await service.searchSpeciesByName('blue');
      // Both "Blue Jay" and "Blue Heron" start with 'blue', should come before 'Pacific Blue Flycatcher'
      expect(results[0].comName).toMatch(/^Blue/);
      expect(results[1].comName).toMatch(/^Blue/);
      expect(results[2].comName).toBe('Pacific Blue Flycatcher');
    });

    test('covers localeCompare when both species start with query', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { speciesCode: 'bz', comName: 'Blue Zebra Finch', sciName: 'Sci1' },
          { speciesCode: 'ba', comName: 'Blue Albatross', sciName: 'Sci2' },
        ],
      });
      const results = await service.searchSpeciesByName('blue');
      // Both start with 'blue' → fallback to localeCompare → alphabetical
      expect(results[0].comName).toBe('Blue Albatross');
      expect(results[1].comName).toBe('Blue Zebra Finch');
    });

    test('covers localeCompare when neither species starts with query', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { speciesCode: 'rf', comName: 'Red Blue Finch', sciName: 'Sci1' },
          { speciesCode: 'ga', comName: 'Great Blue Albatross', sciName: 'Sci2' },
        ],
      });
      const results = await service.searchSpeciesByName('blue');
      // Neither starts with 'blue' → fallback to localeCompare
      expect(results[0].comName).toBe('Great Blue Albatross');
      expect(results[1].comName).toBe('Red Blue Finch');
    });
  });

  // ─── searchHotspotsByName — comprehensive sort branches ──

  describe('searchHotspotsByName — all sort tiers', () => {
    test('exercises all sort tiers: exact, startsWith, contains, speciesCount', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'East Park Gardens', numSpeciesAllTime: 100, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'park', numSpeciesAllTime: 10, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'Park Avenue', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L4', locName: 'Big Park Area', numSpeciesAllTime: 200, lat: 1, lng: 103 },
          { locId: 'L5', locName: 'National Park Reserve', numSpeciesAllTime: null, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'park');
      // Exact: 'park' (L2)
      // StartsWith: 'Park Avenue' (L3)
      // Contains: 'East Park Gardens' (L1), 'Big Park Area' (L4), 'National Park Reserve' (L5)
      // Among contains, sort by species count: L4 (200), L1 (100), L5 (0)
      expect(results[0].locName.toLowerCase()).toBe('park');
      expect(results[1].locName).toBe('Park Avenue');
    });

    test('covers !aExact && bExact branch in sort', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Lake Shore Park', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'lake', numSpeciesAllTime: 5, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'Lake Garden', numSpeciesAllTime: 80, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'lake');
      // 'lake' is exact match → first
      expect(results[0].locName.toLowerCase()).toBe('lake');
    });

    test('covers !aStarts && bStarts branch in sort', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Great Lake View', numSpeciesAllTime: 100, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Lake Garden East', numSpeciesAllTime: 20, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'Beautiful Lake', numSpeciesAllTime: 30, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'lake');
      // 'Lake Garden East' starts with 'lake' → should come before 'Great Lake View' and 'Beautiful Lake'
      expect(results[0].locName).toBe('Lake Garden East');
    });

    test('covers !aContains && bContains branch in sort', async () => {
      // Need items where one matches via includes and another via word overlap only.
      // Order [includes, word-overlap, includes] ensures insertion sort compares both (word,includes) and (includes,word).
      // "forest river" search:
      // "Old Forest River" → includes("forest river") = true (substring match)
      // "River Near Forest" → includes("forest river") = false → word overlap: both "forest" and "river" match
      // "Beautiful Forest River Area" → includes("forest river") = true (substring match)
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Old Forest River', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'River Near Forest', numSpeciesAllTime: 80, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Beautiful Forest River Area', numSpeciesAllTime: 30, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'forest river');
      // Items with includes match should come before word-overlap match
      expect(results.length).toBe(3);
      // "River Near Forest" (word-overlap only) should be last among the 3
      expect(results[results.length - 1].locName).toBe('River Near Forest');
    });

    test('sort fallback to numSpeciesAllTime when both contain query', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: 'Nice River Park', numSpeciesAllTime: 30, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Old River Garden', numSpeciesAllTime: 150, lat: 1, lng: 103 },
          { locId: 'L3', locName: 'Big River Spot', numSpeciesAllTime: undefined, lat: 1, lng: 103 },
        ],
      });

      const results = await service.searchHotspotsByName('SG', 'river');
      // All contain 'river', none exact, none startsWith → sort by species count
      expect(results[0].locName).toBe('Old River Garden');
      expect(results[results.length - 1].locName).toBe('Big River Spot');
    });

    test('handles hotspots with null locName in sort comparator', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { locId: 'L1', locName: null, numSpeciesAllTime: 100, lat: 1, lng: 103 },
          { locId: 'L2', locName: 'Wetland Reserve', numSpeciesAllTime: 50, lat: 1, lng: 103 },
          { locId: 'L3', locName: null, numSpeciesAllTime: 200, lat: 1, lng: 103 },
        ],
      });

      // null locName won't match the search, so only 'Wetland Reserve' matches
      const results = await service.searchHotspotsByName('SG', 'wetland');
      expect(results).toHaveLength(1);
      expect(results[0].locName).toBe('Wetland Reserve');
    });
  });

  // ─── formatObservationsList — default parameters ────────

  describe('formatObservationsList — default parameters', () => {
    test('uses default title when omitted', () => {
      const obs = [
        { comName: 'Robin', sciName: 'Turdus', locName: 'Park', lat: 1, lng: 103, obsDt: '2026-02-15' },
      ];
      const result = service.formatObservationsList(obs);
      expect(result[0]).toContain('Recent Bird Sightings');
    });

    test('uses null regionCode when omitted', () => {
      const obs = [
        { comName: 'Robin', sciName: 'Turdus', locName: 'Park', lat: 1, lng: 103, obsDt: '2026-02-15' },
      ];
      const result = service.formatObservationsList(obs, 'Title');
      expect(result).toBeDefined();
      expect(result[0]).toContain('Title');
    });
  });
});

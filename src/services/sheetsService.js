/**
 * Google Sheets Service — persists search history to a Google Spreadsheet.
 *
 * Each search command logs ONE row with a summary: who searched, what command,
 * how many results, and the full species list.
 *
 * The service is fire-and-forget: logging errors are swallowed so they never
 * block or break the bot's main flow.
 */
const { google } = require('googleapis');
const logger = require('../utils/logger');
const path = require('path');

class SheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.sheetName = 'BirdSightings';
    this.initialized = false;
  }

  /**
   * Lazy-init: authenticate and ensure the header row exists.
   */
  async _init() {
    if (this.initialized) return;
    if (!this.spreadsheetId || !process.env.GOOGLE_CREDENTIALS_PATH) {
      logger.warn('Google Sheets not configured — history will not be saved');
      return;
    }

    try {
      const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH);
      const auth = new google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const client = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: client });

      await this._ensureHeaders();
      this.initialized = true;
      logger.info('Google Sheets service initialized', { spreadsheetId: this.spreadsheetId });
    } catch (error) {
      logger.error('Failed to initialize Google Sheets', { error: error.message });
    }
  }

  /**
   * Create the BirdSightings sheet (if it doesn't exist) and write headers.
   */
  async _ensureHeaders() {
    const headers = [
      'Timestamp',              // A — when the search was made
      'Username',               // B — Telegram user who searched
      'Command',                // C — sightings / notable / nearby / species
      'Search Query',           // D — what the user typed
      'Region Code',            // E — eBird region code
      'Total Sightings',        // F — number of observations returned
      'Unique Species Count',   // G — distinct species in results
      'Species List',           // H — comma-separated common names
    ];

    const colRange = 'A1:H1';

    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:Z1`
      });

      const existing = res.data.values?.[0] || [];
      const headersMatch = headers.length === existing.length &&
        headers.every((h, i) => h === existing[i]);

      if (!headersMatch) {
        // Clear the entire sheet and rewrite headers
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A:Z`
        });
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!${colRange}`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] }
        });
        logger.info('Sheet headers reset to new format');
      }
    } catch (error) {
      if (error.message?.includes('Unable to parse range')) {
        try {
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: { properties: { title: this.sheetName } }
              }]
            }
          });
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!${colRange}`,
            valueInputOption: 'RAW',
            requestBody: { values: [headers] }
          });
        } catch (innerErr) {
          logger.error('Failed to create BirdSightings sheet', { error: innerErr.message });
        }
      } else {
        logger.error('Failed to check headers', { error: error.message });
      }
    }
  }

  /**
   * Log a search to the spreadsheet — one row per command. Fire-and-forget.
   *
   * @param {Object} opts
   * @param {string} opts.command       — sightings | notable | nearby | species
   * @param {number|string} opts.chatId
   * @param {string} opts.username      — Telegram username of searcher
   * @param {string} opts.searchQuery   — the user's original input
   * @param {string} opts.regionCode    — eBird region code
   * @param {Array}  opts.observations  — array of eBird observation objects
   */
  async logSightings({ command, chatId, username, searchQuery, regionCode, observations }) {
    try {
      await this._init();
      if (!this.sheets) return;
      if (!observations || observations.length === 0) return;

      // Build species summary
      const speciesSet = new Set();
      for (const obs of observations) {
        if (obs.comName) speciesSet.add(obs.comName);
      }
      const speciesList = [...speciesSet].sort().join(', ');

      const row = [
        new Date().toISOString(),         // Timestamp
        username || 'unknown',            // Username
        command,                          // Command
        searchQuery || '',                // Search Query
        regionCode || '',                 // Region Code
        observations.length,              // Total Sightings
        speciesSet.size,                  // Unique Species Count
        speciesList,                      // Species List
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });

      logger.debug('Search logged to Google Sheets', {
        command, species: speciesSet.size, total: observations.length
      });
    } catch (error) {
      logger.error('Failed to log search to Sheets', { error: error.message });
    }
  }
}

// Singleton
module.exports = new SheetsService();

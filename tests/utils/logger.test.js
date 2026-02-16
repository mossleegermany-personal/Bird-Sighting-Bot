/**
 * Tests for src/utils/logger.js
 * Covers: production vs development format branch.
 */

describe('logger', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('creates a logger in dev mode (no WEBSITE_HOSTNAME)', () => {
    delete process.env.WEBSITE_HOSTNAME;
    const logger = require('../../src/utils/logger');
    expect(logger).toBeTruthy();
    expect(logger.level).toBe('debug');
  });

  test('creates a logger in production mode (WEBSITE_HOSTNAME set)', () => {
    process.env.WEBSITE_HOSTNAME = 'myapp.azurewebsites.net';
    const logger = require('../../src/utils/logger');
    expect(logger).toBeTruthy();
    expect(logger.level).toBe('info');
  });

  test('respects LOG_LEVEL override', () => {
    process.env.LOG_LEVEL = 'warn';
    const logger = require('../../src/utils/logger');
    expect(logger.level).toBe('warn');
  });

  test('logger has expected methods', () => {
    const logger = require('../../src/utils/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});

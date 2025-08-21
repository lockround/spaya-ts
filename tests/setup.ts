/**
 * Jest test setup file
 */

import fs from 'fs';
import path from 'path';

// Load environment variables from repository .env (if present) so tests pick them up.
// We avoid adding a dependency on 'dotenv' by parsing the file ourselves.
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, { encoding: 'utf8' });
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equals = trimmed.indexOf('=');
      if (equals === -1) continue;
      const key = trimmed.slice(0, equals).trim();
      let val = trimmed.slice(equals + 1).trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
} catch (err) {
  // Non-fatal: continue without loaded env vars
}

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock console.warn and console.error to avoid noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
declare global {
  var testUtils: {
    mockSmiles: string[];
    mockToken: string;
    mockUrl: string;
  };
}

global.testUtils = {
  mockSmiles: ['O=C1CCCCO1', 'O=C1CCCNN1', 'c1ccn2nccc2c1'],
  mockToken: 'mock-bearer-token-12345',
  mockUrl: 'https://test.spaya.ai'
};

// Export to make this file a module
export {};
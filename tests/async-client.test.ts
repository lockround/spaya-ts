/**
 * Integration tests for SpayaClientAsync (uses real API)
 */

import { SpayaClientAsync } from '../src/async-client';
import { BearerToken } from '../src/authorization';

const TOKEN = process.env.SPAYA_TOKEN;
const BASE_URL = process.env.SPAYA_BASE_URL;
if (!TOKEN || !BASE_URL) {
  throw new Error('Integration tests require SPAYA_TOKEN and SPAYA_BASE_URL environment variables');
}

describe('SpayaClientAsync (integration)', () => {
  let client: SpayaClientAsync;

  beforeAll(() => {
    client = new SpayaClientAsync({ url: BASE_URL, authorization: new BearerToken(TOKEN) });
  });

  it('getStatus should return a Status object (queueSize may be undefined)', async () => {
    const status = await client.getStatus();
    expect(status).toBeDefined();
    if (status.queueSize !== undefined && status.queueSize !== null) {
      expect(typeof status.queueSize).toBe('number');
    }
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch (e) {
      // best-effort close
    }
  });
});

describe('SpayaClientAsync (unit: startRetrosynthesis & getRoutes)', () => {
  it('startRetrosynthesis registers SMILES and getRoutes returns simulated routes', async () => {
    const { SpayaClientAsync } = require('../src/async-client');
    const { BearerToken } = require('../src/authorization');
    const { StatusCode } = require('../src/types');

    const client = new SpayaClientAsync({ url: BASE_URL, authorization: new BearerToken(TOKEN) });

    // Monkeypatch sendSmiles to register SMILES in smilesLeft
    (client as any).sendSmiles = async (smiles: string[]) => {
      for (const s of smiles) {
        (client as any).smilesLeft.set(s, { status: StatusCode.SUBMITTED, progress: 0 });
      }
    };

    // Simulate receiving a finished message via waitForMessage on first call
    let invoked = false;
    (client as any).waitForMessage = async () => {
      if (invoked) return null;
      invoked = true;
      return { smiles: 'O=C1CCCCO1', rscore: 0.7, nb_steps: 2, status: StatusCode.DONE, progress: 100 };
    };

    // start and wait for result processing
    const smiles = 'O=C1CCCCO1';
    await client.startRetrosynthesis([smiles]);
    await client.waitResult();

    expect((client as any).smilesDone.has(smiles)).toBe(true);

    // Monkeypatch sendWithRetry to simulate /routes response
    (client as any).sendWithRetry = async (method: 'GET'|'POST', endpoint: string, data?: any) => {
      if (endpoint === '/routes') {
        return { routes: [{ root_smiles: smiles, rscore: 0.7, nb_steps: 2, tree: {} }] };
      }
      return {};
    };

    const routes = await (client as any).getRoutes(smiles);
    expect(Array.isArray(routes[smiles])).toBe(true);
    try { await client.close(); } catch {}
  });
});

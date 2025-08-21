/**
 * Integration tests for SpayaClientREST (uses real API)
 */

import { SpayaClientREST } from '../src/rest-client';
import { BearerToken } from '../src/authorization';

const TOKEN = process.env.SPAYA_TOKEN;
const BASE_URL = process.env.SPAYA_BASE_URL;
if (!TOKEN || !BASE_URL) {
  throw new Error('Integration tests require SPAYA_TOKEN and SPAYA_BASE_URL environment variables');
}

describe('SpayaClientREST (integration)', () => {
  let client: SpayaClientREST;

  beforeAll(() => {
    client = new SpayaClientREST({ url: BASE_URL, authorization: new BearerToken(TOKEN) });
  });

  it('getStatus should return a Status object', async () => {
    const status = await client.getStatus();
    expect(status).toBeDefined();
    if (status.queueSize !== undefined && status.queueSize !== null) {
      expect(typeof status.queueSize).toBe('number');
    }
  });

  afterAll(async () => {
    // nothing to close for REST client
  });
});

describe('SpayaClientREST (unit: startRetrosynthesis & getRoutes)', () => {
  it('startRetrosynthesis registers SMILES and getRoutes returns simulated routes', async () => {
    const { SpayaClientREST } = require('../src/rest-client');
    const { BearerToken } = require('../src/authorization');
    const { StatusCode } = require('../src/types');

    const client = new SpayaClientREST({ url: BASE_URL, authorization: new BearerToken(TOKEN) });

    // Monkeypatch private sendEntry method on instance to register smiles
    (client as any).sendEntry = async (smiles: string[]) => {
      for (const s of smiles) {
        (client as any).smilesLeft.set(s, { status: StatusCode.SUBMITTED, progress: 0 });
      }
    };

    const smiles = 'O=C1CCCCO1';
    await client.startRetrosynthesis([smiles]);
    expect((client as any).smilesLeft.has(smiles)).toBe(true);

    // Simulate that the SMILES finished
    (client as any).smilesLeft.delete(smiles);
    (client as any).smilesDone.set(smiles, { status: StatusCode.DONE, progress: 100, rscore: 0.5, nbSteps: 2 });

    // Monkeypatch sendWithRetry to return a routes response
    (client as any).sendWithRetry = async (method: string, endpoint: string, data?: any) => {
      if (endpoint === '/routes') {
        return { routes: [{ root_smiles: smiles, rscore: 0.5, nb_steps: 2, tree: {} }] };
      }
      return {};
    };

    const routes = await client.getRoutes(smiles);
    expect(Array.isArray(routes[smiles])).toBe(true);
  });
});

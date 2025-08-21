/**
 * Integration tests for SpayaClientCallback (uses real API)
 */

import { SpayaClientCallback } from '../src/callback-client';
import { BearerToken } from '../src/authorization';

const TOKEN = process.env.SPAYA_TOKEN;
const BASE_URL = process.env.SPAYA_BASE_URL;
if (!TOKEN || !BASE_URL) {
  throw new Error('Integration tests require SPAYA_TOKEN and SPAYA_BASE_URL environment variables');
}

// describe('SpayaClientCallback (integration)', () => {
//   let client: SpayaClientCallback;

//   beforeAll(async () => {
//     client = new SpayaClientCallback({
//       url: BASE_URL,
//       authorization: new BearerToken(TOKEN),
//       resultCallback: async () => {
//         // noop for integration smoke
//       }
//     });

//     // connect will start callback loop
//     await client.connect();
//   });

// //   it('startCallback and stopCallback should be callable', async () => {
// //     await client.startCallback();
// //     await client.stopCallback();
// //     expect(true).toBe(true);
// //   });

//   afterAll(async () => {
//     try {
//       await client.close();
//     } catch (e) {
//       // best-effort close
//     }
//   });
// });

// describe('SpayaClientCallback (unit: startRetrosynthesis & getRoutes)', () => {
//   it('startRetrosynthesis registers SMILES and getRoutes returns simulated routes', async () => {
//     const TestCallback = require('../src/callback-client').SpayaClientCallback;
//     const { BearerToken } = require('../src/authorization');
//     const { StatusCode } = require('../src/types');

//     const client = new TestCallback({ url: BASE_URL, authorization: new BearerToken(TOKEN), resultCallback: async () => {} });

//     // Monkeypatch sendSmiles to register SMILES
//     (client as any).sendSmiles = async (smiles: string[]) => {
//       for (const s of smiles) {
//         (client as any).smilesLeft.set(s, { status: StatusCode.SUBMITTED, progress: 0 });
//       }
//     };

//     // Monkeypatch waitForMessage to simulate a finished message
//     (client as any).waitForMessage = async () => ({ smiles: 'c1ccn2nccc2c1', rscore: 0.4, nb_steps: 1, status: StatusCode.DONE, progress: 100 });

//     const smiles = 'c1ccn2nccc2c1';
//     await client.startCallback();
//     await client.startRetrosynthesis([smiles]);

//     // Allow a short time for callback loop to process our simulated message
//     await new Promise((r) => setTimeout(r, 50));

//     // Ensure it was processed into smilesDone
//     (client as any).smilesLeft.delete(smiles);
//     (client as any).smilesDone.set(smiles, { status: StatusCode.DONE, progress: 100, rscore: 0.4, nbSteps: 1 });

//     // Monkeypatch sendWithRetry for routes
//     (client as any).sendWithRetry = async (method: string, endpoint: string, data?: any) => {
//       if (endpoint === '/routes') {
//         return { routes: [{ root_smiles: smiles, rscore: 0.4, nb_steps: 1, tree: {} }] };
//       }
//       return {};
//     };

//     const routes = await (client as any).getRoutes(smiles);
//     expect(Array.isArray(routes[smiles])).toBe(true);

//     await client.stopCallback();
//     try { await client.close(); } catch {}
//   });
// });

/**
 * @fileoverview Spaya TypeScript Client Library
 * 
 * A comprehensive TypeScript client for the Spaya retrosynthesis-scoring API,
 * providing REST, async WebSocket, and callback-based interaction patterns.
 * 
 * @example REST Client
 * ```typescript
 * import { SpayaClientREST, BearerToken } from 'spaya-ts';
 * 
 * const client = new SpayaClientREST({
 *   url: 'https://spaya.ai',
 *   authorization: new BearerToken('your-token')
 * });
 * 
 * const results = await client.scoreSmiles(['O=C1CCCCO1', 'O=C1CCCNN1']);
 * for (const [smiles, result] of Object.entries(results)) {
 *   console.log(`${smiles}: ${result.rscore}/${result.nbSteps}`);
 * }
 * ```
 * 
 * @example Async Client
 * ```typescript
 * import { SpayaClientAsync, BearerToken } from 'spaya-ts';
 * 
 * const client = new SpayaClientAsync({
 *   url: 'https://spaya.ai',
 *   authorization: new BearerToken('your-token')
 * });
 * 
 * await client.connect();
 * await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);
 * 
 * for await (const [smiles, result] of client.consume()) {
 *   console.log(`${smiles}: ${result.rscore}/${result.nbSteps}`);
 * }
 * 
 * await client.close();
 * ```
 * 
 * @example Callback Client
 * ```typescript
 * import { SpayaClientCallback, BearerToken } from 'spaya-ts';
 * 
 * const client = new SpayaClientCallback({
 *   url: 'https://spaya.ai',
 *   authorization: new BearerToken('your-token'),
 *   resultCallback: async (smiles, result) => {
 *     console.log(`${smiles}: ${result.rscore}/${result.nbSteps}`);
 *   }
 * });
 * 
 * await client.connect();
 * await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);
 * await client.waitResult();
 * await client.close();
 * ```
 * 
 * @packageDocumentation
 */

// Export authorization classes
export { 
  Authorization, 
  BearerToken, 
  CustomBearerToken 
} from './authorization';

// Export client classes
export { SpayaClient } from './base-client';
export { SpayaClientREST } from './rest-client';
export { SpayaClientAsync } from './async-client';
export { SpayaClientCallback } from './callback-client';

// Export all types and interfaces
export {
  // Core types
  StatusCode,
  Catalog,
  
  // Configuration interfaces
  Settings,
  SettingsREST,
  SettingsAsync,
  SettingsCallback,
  RetrosynthesisParameters,
  
  // Result interfaces
  RetrosynthesisResult,
  Status,
  Route,
  CommercialCompound,
  Cluster,
  ClusteringResult,
  
  // Error classes
  SpayaError,
  SpayaConnectionError,
  
  // Utility types
  SmilesInput,
  ProgressCallback,
  ResultCallback,
  ErrorCallback,
  
  // Utility functions
  StatusUtils
} from './types';

// Package version and metadata
export const VERSION = '1.0.0';
export const PACKAGE_NAME = 'spaya-ts';

/**
 * Package information
 */
export const PackageInfo = {
  name: PACKAGE_NAME,
  version: VERSION,
  description: 'TypeScript client for Spaya retrosynthesis-scoring API',
  author: 'Iktos',
  license: 'MIT'
} as const;

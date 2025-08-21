/**
 * @fileoverview Async WebSocket client for real-time Spaya API interactions
 */

// WebSocket type definitions for Node.js and Browser compatibility
interface WebSocketLike {
  readyState: number;
  OPEN: number;
  CLOSED: number;
  send(data: string): void;
  close(): void;
  once(event: string, callback: (data?: any) => void): void;
  addEventListener?(event: string, callback: (event: any) => void): void;
}

// WebSocket adapter that provides consistent 'once' behavior across environments
class WebSocketAdapter implements WebSocketLike {
  private ws: any;
  private eventListeners: Map<string, Set<(data?: any) => void>> = new Map();

  constructor(ws: any) {
    this.ws = ws;
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  get OPEN(): number {
    return this.ws.OPEN || 1;
  }

  get CLOSED(): number {
    return this.ws.CLOSED || 3;
  }

  send(data: string): void {
    this.ws.send(data);
  }

  close(): void {
    this.ws.close();
  }

  once(event: string, callback: (data?: any) => void): void {
    if (typeof this.ws.once === 'function') {
      // Node.js ws module has 'once' method
      this.ws.once(event, callback);
    } else if (typeof this.ws.addEventListener === 'function') {
      // Browser WebSocket uses addEventListener
      const wrappedCallback = (eventData: any) => {
        this.ws.removeEventListener(event, wrappedCallback);
        callback(eventData);
      };
      this.ws.addEventListener(event, wrappedCallback);
    } else {
      throw new Error(`WebSocket implementation doesn't support event handling for: ${event}`);
    }
  }

  addEventListener(event: string, callback: (event: any) => void): void {
    if (typeof this.ws.addEventListener === 'function') {
      this.ws.addEventListener(event, callback);
    } else if (typeof this.ws.on === 'function') {
      // Node.js ws module uses 'on' for persistent listeners
      this.ws.on(event, callback);
    } else {
      throw new Error(`WebSocket implementation doesn't support addEventListener for: ${event}`);
    }
  }
}

// Use globalThis.WebSocket if available (browser), otherwise dynamic import for ws (Node.js)
let WebSocketClass: any;
try {
  WebSocketClass = globalThis.WebSocket;
  if (!WebSocketClass && typeof window === 'undefined') {
    // Node.js environment - use dynamic import
    WebSocketClass = eval('require')('ws');
  }
} catch {
  // Fallback for environments without WebSocket support
  WebSocketClass = class {
    constructor() {
      throw new Error('WebSocket not available in this environment');
    }
  };
}
import { SpayaClient } from './base-client';
import {
  Authorization,
  RetrosynthesisParameters,
  SettingsAsync,
  SmilesInput,
  RetrosynthesisResult,
  ProgressCallback,
  Status,
  CommercialCompound,
  Route,
  ClusteringResult,
  Catalog,
  StatusUtils,
  SpayaConnectionError
} from './types';

/**
 * Default settings for Async client
 */
const DEFAULT_ASYNC_SETTINGS: SettingsAsync = {
  maxSmilesPerRequest: 1000,
  verifyTls: true,
  maxRetry: 2,
  retrySleep: 10
};

/**
 * Asynchronous WebSocket client for Spaya API
 * 
 * @example
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
 *   console.log(`${smiles}: ${result.rscore}`);
 * }
 * 
 * await client.close();
 * ```
 */
export class SpayaClientAsync extends SpayaClient {
  private websocketUrl: string;
  private websocket: WebSocketLike | null = null;
  private isConnecting = false;
  private isStopped = false;
  private connectionLock: Promise<void> | null = null;

  /**
   * Create a new async client
   * @param config - Client configuration
   */
  constructor(config: {
    url: string;
    authorization: Authorization;
    parameters?: RetrosynthesisParameters;
    settings?: Partial<SettingsAsync>;
  }) {
    const settings = { ...DEFAULT_ASYNC_SETTINGS, ...config.settings };
    super(config.url, config.authorization, config.parameters, settings);
    this.websocketUrl = this.parseWebSocketUrl(config.url);
  }

  /**
   * Connect to WebSocket (auto-connects when needed)
   */
  async connect(): Promise<void> {
    const OPEN = 1; // WebSocket.OPEN constant
    if (this.websocket?.readyState === OPEN) {
      return;
    }

    if (this.connectionLock) {
      await this.connectionLock;
      return;
    }

    this.connectionLock = this.doConnect();
    await this.connectionLock;
    this.connectionLock = null;
  }

  /**
   * Close WebSocket connection and stop all operations
   */
  async close(): Promise<void> {
    const OPEN = 1; // WebSocket.OPEN constant
    const CLOSED = 3; // WebSocket.CLOSED constant
    
    this.isStopped = true;
    
    if (this.websocket) {
      if (this.websocket.readyState === OPEN) {
        this.websocket.close();
      }
      
      // Wait for close event
      await new Promise<void>((resolve) => {
        if (this.websocket?.readyState === CLOSED) {
          resolve();
          return;
        }
        
        const timeout = setTimeout(resolve, 5000); // 5s timeout
        this.websocket?.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  /**
   * Get API status
   */
  async getStatus(): Promise<Status> {
    return super.getStatus();
  }

  /**
   * Get available commercial compounds providers
   */
  async getCommercialCompoundsProviders(): Promise<string[]> {
    return super.getCommercialCompoundsProviders();
  }

  /**
   * Get commercial compounds for SMILES
   */
  async getCommercialCompounds(
    smiles: SmilesInput,
    options: {
      provider?: string[];
      catalog?: Catalog[];
      packagingGMin?: number;
      packagingGMax?: number;
      pricePerGMin?: number;
      pricePerGMax?: number;
      deliveryDateMaxDay?: number;
      deliveryIncluded?: boolean;
    } = {}
  ): Promise<Record<string, CommercialCompound[]>> {
    return super.getCommercialCompounds(smiles, options);
  }

  /**
   * Get available name reactions
   */
  async getNameReactions(filter?: string): Promise<string[]> {
    return super.getNameReactions(filter);
  }

  /**
   * Get retrosynthesis quota
   */
  async getRetrosynthesisQuota(): Promise<number | null> {
    return super.getRetrosynthesisQuota();
  }

  /**
   * Start retrosynthesis for SMILES
   * @param smiles - SMILES to process
   */
  async startRetrosynthesis(smiles: SmilesInput): Promise<void> {
    const smilesArray = this.extractSmilesArray(smiles);
    await this.connect();
    await this.sendSmiles(smilesArray);

    // Wait until all SMILES are at least submitted
    const pendingSmiles = [...smilesArray];
    while (pendingSmiles.length > 0 && !this.isStopped) {
      try {
        await this.connect();
        
        const messagePromise = this.waitForMessage();
        const timeoutPromise = this.sleep(5000); // 5s timeout
        
        const result = await Promise.race([messagePromise, timeoutPromise]);
        
        if (result) {
          const [smiles, resultData] = this.updateResult(result);
          
          if (StatusUtils.needsRetry(resultData.status)) {
            console.log('Queue full, resending...');
            await this.sleep(100);
            await this.sendSmiles([smiles]);
          } else {
            const index = pendingSmiles.indexOf(smiles);
            if (index !== -1) {
              pendingSmiles.splice(index, 1);
            }
          }
        }
      } catch (error) {
        console.warn('Connection error during submission:', error);
        await this.sleep(200);
      }
    }
  }

  /**
   * Wait for all retrosynthesis results
   * @param progressCallback - Optional progress callback
   */
  async waitResult(progressCallback?: ProgressCallback): Promise<void> {
    while (this.smilesLeft.size > 0 && !this.isStopped) {
      try {
        await this.connect();
        
        if (progressCallback) {
          if (progressCallback.constructor.name === 'AsyncFunction') {
            await (progressCallback as any)(this.progression);
          } else {
            (progressCallback as any)(this.progression);
          }
        }

        const messagePromise = this.waitForMessage();
        const timeoutPromise = this.sleep(5000);
        
        const result = await Promise.race([messagePromise, timeoutPromise]);
        
        if (result) {
          this.updateResult(result);
        }
      } catch (error) {
        console.warn('Connection error during wait:', error);
        await this.sleep(200);
      }
    }
  }

  /**
   * Consume finished results as they arrive
   * @returns Async generator of SMILES and results
   */
  async* consume(): AsyncGenerator<[string, RetrosynthesisResult], void, unknown> {
    while ((this.smilesLeft.size > 0 || this.smilesDone.size > 0) && !this.isStopped) {
      try {
        await this.connect();

        // Yield any finished results
        while (this.smilesDone.size > 0) {
          const entries = Array.from(this.smilesDone.entries());
          if (entries.length > 0) {
            const [smiles, result] = entries[0];
            this.smilesDone.delete(smiles);
            yield [smiles, result];
          } else {
            break;
          }
        }

        if (this.smilesLeft.size === 0) {
          break;
        }

        const messagePromise = this.waitForMessage();
        const timeoutPromise = this.sleep(500);
        
        const result = await Promise.race([messagePromise, timeoutPromise]);
        
        if (result) {
          this.updateResult(result);
        }
      } catch (error) {
        console.warn('Connection error during consume:', error);
        await this.sleep(500);
      }
    }

    // Yield any remaining finished results
    while (this.smilesDone.size > 0) {
      const entries = Array.from(this.smilesDone.entries());
      if (entries.length > 0) {
        const [smiles, result] = entries[0];
        this.smilesDone.delete(smiles);
        yield [smiles, result];
      } else {
        break;
      }
    }
  }

  /**
   * Get routes for finished SMILES
   */
  async getRoutes(
    smiles: SmilesInput,
    topKRoutes?: number
  ): Promise<Record<string, Route[]>> {
    const smilesArray = this.extractSmilesArray(smiles);
    
    // Check all SMILES are finished
    for (const smilesStr of smilesArray) {
      if (this.smilesLeft.has(smilesStr)) {
        throw new Error(`SMILES ${smilesStr} is not finished yet`);
      }
    }

    const entry = {
      batch: this.createEntry(smilesArray),
      ...(topKRoutes && { top_k_routes: topKRoutes })
    };

    const response = await this.sendWithRetry('POST', '/routes', entry);
    const result: Record<string, Route[]> = {};

    for (const routeData of response.routes || []) {
      const rootSmiles = routeData.root_smiles;
      const route: Route = {
        rscore: routeData.rscore,
        nbSteps: routeData.nb_steps,
        tree: routeData.tree
      };

      if (!result[rootSmiles]) {
        result[rootSmiles] = [];
      }
      result[rootSmiles].push(route);
    }

    return result;
  }

  /**
   * Get clustering results for SMILES
   */
  async getClustering(
    smiles: SmilesInput,
    options: {
      minRelativeSize?: number;
      maxCluster?: number;
      maxCoverage?: number;
      alpha?: number;
      minRouteRscore?: number;
      extraSmiles?: Array<{
        parameters: RetrosynthesisParameters;
        smiles: string[];
      }>;
    } = {}
  ): Promise<ClusteringResult> {
    const smilesArray = this.extractSmilesArray(smiles);
    const batches = [{ parameters: this.parameters, smiles: smilesArray }];
    
    if (options.extraSmiles) {
      batches.push(...options.extraSmiles);
    }

    // Split large batches
    const processedBatches: any[] = [];
    const maxPerRequest = this.settings.maxSmilesPerRequest;

    for (const batch of batches) {
      if (batch.smiles.length > maxPerRequest) {
        for (let i = 0; i < batch.smiles.length; i += maxPerRequest) {
          processedBatches.push({
            ...this.createEntry(batch.smiles.slice(i, i + maxPerRequest))
          });
        }
      } else if (batch.smiles.length > 0) {
        processedBatches.push({
          ...this.createEntry(batch.smiles)
        });
      }
    }

    const clusteringEntry = {
      batches: processedBatches,
      ...(options.minRelativeSize !== undefined && { min_relative_size: options.minRelativeSize }),
      ...(options.maxCluster !== undefined && { max_cluster: options.maxCluster }),
      ...(options.maxCoverage !== undefined && { max_coverage: options.maxCoverage }),
      ...(options.alpha !== undefined && { alpha: options.alpha }),
      ...(options.minRouteRscore !== undefined && { min_route_rscore: options.minRouteRscore })
    };

    // Poll until clustering is finished
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.sendWithRetry('POST', '/clustering', clusteringEntry);
      
      if (StatusUtils.isFinished(response.status)) {
        return {
          clusters: response.clusters?.map((cluster: any) => ({
            key: cluster.key,
            smiles: cluster.smiles,
            meanDepths: cluster.mean_depths,
            meanMaxScore: cluster.mean_max_score
          })) || [],
          status: response.status
        };
      }

      await this.sleep(1000);
    }
  }

  /**
   * Parse HTTP URL to WebSocket URL, adding auth parameters for browser environments
   */
  private parseWebSocketUrl(url: string): string {
    // Simple URL parsing without relying on Node.js URL class
    let protocol: string;
    let host: string;
    let pathname: string;
    let search: string = '';

    try {
      const urlObj = new globalThis.URL(url);
      protocol = urlObj.protocol;
      host = urlObj.host;
      pathname = urlObj.pathname;
      search = urlObj.search;
    } catch {
      // Fallback manual parsing
      const match = url.match(/^(https?|wss?):\/\/([^/]+)(\/.*)?$/);
      if (!match) {
        throw new Error(`Invalid URL: ${url}`);
      }
      protocol = match[1] + ':';
      host = match[2];
      pathname = match[3] || '/';
    }
    
    if (!protocol.startsWith('http') && !protocol.startsWith('ws')) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const endpoint = `${SpayaClient.ROOT}/ws${SpayaClient.VERSION}/batch-smiles`;
    
    let path = pathname;
    if (!path.endsWith(endpoint)) {
      path = path.endsWith('/') ? path.slice(0, -1) : path;
      path = `${path}${endpoint}`;
    }

    const wsProtocol = protocol.startsWith('https') || protocol.startsWith('wss') ? 'wss' : 'ws';
    
    // For browser environments, add auth params to URL since headers aren't supported
    let authParams = '';
    if (typeof globalThis !== 'undefined' && globalThis.WebSocket) {
      const headers = this.authorization.headers();
      const urlParams = new URLSearchParams();
      
      for (const [key, value] of Object.entries(headers)) {
        // Convert common header names to URL-safe parameter names
        const paramName = key.toLowerCase().replace(/[-\s]/g, '_');
        urlParams.append(paramName, value);
      }
      
      if (urlParams.toString()) {
        authParams = search ? `&${urlParams.toString()}` : `?${urlParams.toString()}`;
      }
    }
    
    return `${wsProtocol}://${host}${path}${search}${authParams}`;
  }

  /**
   * Establish WebSocket connection
   */
  private async doConnect(): Promise<void> {
    const OPEN = 1; // WebSocket.OPEN constant
    if (this.isConnecting || this.websocket?.readyState === OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      // Create WebSocket with appropriate options
      let rawWebSocket: any;
      if (typeof globalThis !== 'undefined' && globalThis.WebSocket) {
        // Browser environment
        rawWebSocket = new globalThis.WebSocket(this.websocketUrl);
      } else {
        // Node.js environment - pass headers for authentication
        rawWebSocket = new WebSocketClass(this.websocketUrl, {
          headers: this.authorization.headers()
        });
      }
      
      // Wrap the raw WebSocket in our adapter for consistent API
      this.websocket = new WebSocketAdapter(rawWebSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new SpayaConnectionError('Connection timeout'));
        }, 10000); // 10s timeout

        this.websocket!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.websocket!.once('error', (error: Error) => {
          clearTimeout(timeout);
          reject(new SpayaConnectionError(`Connection failed: ${error.message}`));
        });
      });

      // Resend any pending SMILES
      if (this.smilesLeft.size > 0) {
        await this.sendSmiles(Array.from(this.smilesLeft.keys()));
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Send SMILES via WebSocket
   */
  private async sendSmiles(smiles: string[]): Promise<void> {
    const OPEN = 1; // WebSocket.OPEN constant
    if (!this.websocket || this.websocket.readyState !== OPEN) {
      throw new SpayaConnectionError('WebSocket not connected');
    }

    const maxPerRequest = this.settings.maxSmilesPerRequest;
    for (let i = 0; i < smiles.length; i += maxPerRequest) {
      const batch = smiles.slice(i, i + maxPerRequest);
      const entry = this.createEntry(batch);
      
      // WebSocket send is synchronous in most implementations
      try {
        this.websocket.send(JSON.stringify(entry));
      } catch (error) {
        throw new SpayaConnectionError(`Send failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Wait for next WebSocket message
   */
  private async waitForMessage(): Promise<any> {
    const OPEN = 1; // WebSocket.OPEN constant
    if (!this.websocket || this.websocket.readyState !== OPEN) {
      throw new SpayaConnectionError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 30000); // 30s timeout

      const messageHandler = (data: any) => {
        clearTimeout(timeout);
        try {
          // Handle both Node.js ws and browser WebSocket message formats
          const messageData = data.data || data;
          const messageText = typeof messageData === 'string' ? messageData : messageData.toString();
          const parsed = JSON.parse(messageText);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse message: ${error}`));
        }
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        reject(new SpayaConnectionError(`WebSocket error: ${error.message}`));
      };

      this.websocket!.once('message', messageHandler);
      this.websocket!.once('error', errorHandler);
    });
  }
}

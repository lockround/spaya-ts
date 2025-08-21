/**
 * @fileoverview REST client for synchronous Spaya API interactions
 */

import { SpayaClient } from './base-client';
import {
  Authorization,
  RetrosynthesisParameters,
  SettingsREST,
  SmilesInput,
  RetrosynthesisResult,
  ProgressCallback,
  Status,
  CommercialCompound,
  Route,
  ClusteringResult,
  Catalog,
  StatusUtils
} from './types';

/**
 * Default settings for REST client
 */
const DEFAULT_REST_SETTINGS: SettingsREST = {
  maxSmilesPerRequest: 1000,
  verifyTls: true,
  maxRetry: 2,
  retrySleep: 10,
  minimumUpdatePeriod: 2
};

/**
 * Synchronous REST client for Spaya API
 * 
 * @example
 * ```typescript
 * import { SpayaClientREST, BearerToken } from 'spaya-ts';
 * 
 * const client = new SpayaClientREST({
 *   url: 'https://spaya.ai',
 *   authorization: new BearerToken('your-token')
 * });
 * 
 * const results = await client.scoreSmiles(['O=C1CCCCO1', 'O=C1CCCNN1']);
 * ```
 */
export class SpayaClientREST extends SpayaClient {
  private lastUpdate: Date = new Date(0);
  private readonly restSettings: SettingsREST;

  /**
   * Create a new REST client
   * @param config - Client configuration
   */
  constructor(config: {
    url: string;
    authorization: Authorization;
    parameters?: RetrosynthesisParameters;
    settings?: Partial<SettingsREST>;
  }) {
    const settings = { ...DEFAULT_REST_SETTINGS, ...config.settings };
    
    if (settings.minimumUpdatePeriod < 1) {
      throw new Error('minimumUpdatePeriod must be >= 1');
    }

    super(config.url, config.authorization, config.parameters, settings);
    this.restSettings = settings;
  }

  /**
   * Get current progression with automatic update
   */
  get progression(): number {
    this.updateIfNeeded();
    return super.progression;
  }

  /**
   * Check if retrosynthesis is finished with automatic update
   */
  get isRetroFinished(): boolean {
    this.updateIfNeeded();
    return super.isRetroFinished;
  }

  /**
   * Get API status
   */
  async getStatus(): Promise<Status> {
    return await super.getStatus();
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
   * Score SMILES and wait for results
   * @param smiles - SMILES to score
   * @param progressCallback - Optional progress callback
   * @returns Map of SMILES to results
   */
  async scoreSmiles(
    smiles: SmilesInput,
    progressCallback?: ProgressCallback
  ): Promise<Record<string, RetrosynthesisResult>> {
    await this.startRetrosynthesis(smiles);
    await this.waitResult(progressCallback);
    
    const results = Object.fromEntries(this.smilesDone);
    this.smilesDone.clear();
    return results;
  }

  /**
   * Start retrosynthesis for SMILES
   * @param smiles - SMILES to process
   */
  async startRetrosynthesis(smiles: SmilesInput): Promise<void> {
    const smilesArray = this.extractSmilesArray(smiles);
    const maxPerRequest = this.settings.maxSmilesPerRequest;

    for (let i = 0; i < smilesArray.length; i += maxPerRequest) {
      const batch = smilesArray.slice(i, i + maxPerRequest);
      await this.sendEntry(batch);
    }
  }

  /**
   * Wait for all retrosynthesis results
   * @param progressCallback - Optional progress callback
   * @param timeoutMs - Optional timeout in milliseconds
   */
  async waitResult(
    progressCallback?: ProgressCallback,
    timeoutMs?: number
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = timeoutMs ? startTime + timeoutMs : Number.MAX_SAFE_INTEGER;

    while (!this.isRetroFinished && Date.now() < endTime) {
      this.updateIfNeeded();
      
      if (progressCallback) {
        if (progressCallback.constructor.name === 'AsyncFunction') {
          await (progressCallback as any)(this.progression);
        } else {
          (progressCallback as any)(this.progression);
        }
      }

      const remainingTime = endTime - Date.now();
      const sleepTime = Math.min(
        this.restSettings.minimumUpdatePeriod * 1000,
        Math.max(0, remainingTime)
      );

      await this.sleep(sleepTime);
    }
  }

  /**
   * Consume finished results
   * @returns Generator of finished SMILES and results
   */
  async* consume(): AsyncGenerator<[string, RetrosynthesisResult], void, unknown> {
    this.updateIfNeeded();
    
    for (const [smiles, result] of this.smilesDone) {
      yield [smiles, result];
    }
    
    this.smilesDone.clear();
  }

  /**
   * Get routes for finished SMILES
   * @param smiles - SMILES to get routes for
   * @param topKRoutes - Number of top routes to fetch
   * @returns Map of SMILES to routes
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
   * @param smiles - SMILES to cluster
   * @param options - Clustering options
   * @returns Clustering result
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

      await this.sleep(this.restSettings.minimumUpdatePeriod * 1000);
    }
  }

  /**
   * Update results if enough time has passed since last update
   */
  private updateIfNeeded(): void {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.lastUpdate.getTime();
    const minUpdatePeriodMs = this.restSettings.minimumUpdatePeriod * 1000;

    if (timeSinceUpdate < minUpdatePeriodMs) {
      return; // Avoid too frequent updates
    }

    const smilesArray = Array.from(this.smilesLeft.keys())
      .slice(0, this.settings.maxSmilesPerRequest);
    
    if (smilesArray.length > 0) {
      this.sendEntry(smilesArray).catch(() => {
        // Ignore errors during automatic updates
      });
    }
  }

  /**
   * Send SMILES entry to API
   * @param smiles - SMILES array to send
   */
  private async sendEntry(smiles: string[]): Promise<void> {
    if (smiles.length === 0) {
      return;
    }

    const entry = this.createEntry(smiles);
    const response = await this.sendWithRetry('POST', '/batch-smiles', entry);
    this.lastUpdate = new Date();
    this.updateResultBatch(response);
  }
}

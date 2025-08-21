/**
 * @fileoverview Base client class with shared functionality
 */

import { 
  Authorization, 
  Settings, 
  RetrosynthesisParameters, 
  RetrosynthesisResult, 
  StatusCode, 
  SmilesInput,
  Status,
  CommercialCompound,
  Catalog,
  SpayaError,
  StatusUtils
} from './types';

/**
 * HTTP response interface
 */
interface HttpResponse {
  status: number;
  statusText: string;
  data: any;
}

/**
 * Base client class handling storage and shared functionality
 */
export abstract class SpayaClient {
  protected static readonly ROOT = '/retrosynthesis-api';
  protected static readonly VERSION = '/v1';

  protected readonly url: string;
  protected readonly authorization: Authorization;
  protected readonly parameters: RetrosynthesisParameters;
  protected readonly settings: Settings;

  protected smilesLeft: Map<string, RetrosynthesisResult> = new Map();
  protected smilesDone: Map<string, RetrosynthesisResult> = new Map();

  /**
   * Create a new Spaya client
   * @param url - URL to the Spaya API
   * @param authorization - Authorization instance
   * @param parameters - Retrosynthesis algorithm parameters
   * @param settings - Client settings
   */
  constructor(
    url: string,
    authorization: Authorization,
    parameters: RetrosynthesisParameters = {},
    settings: Settings
  ) {
    if (settings.maxRetry < 0) {
      throw new Error('maxRetry must be >= 0');
    }

    this.url = url;
    this.authorization = authorization;
    this.parameters = parameters;
    this.settings = settings;
  }

  /**
   * Get the Spaya URL
   */
  get spayaUrl(): string {
    return this.url;
  }

  /**
   * Get retrosynthesis parameters
   */
  get retrosynthesisParameters(): RetrosynthesisParameters {
    return { ...this.parameters };
  }

  /**
   * Get progression (as percentage) of SMILES processing
   */
  get progression(): number {
    const totalLeft = this.smilesLeft.size;
    const totalDone = this.smilesDone.size;
    const total = totalLeft + totalDone;

    if (total === 0) {
      return 0;
    }

    let progressSum = 0;
    for (const result of this.smilesLeft.values()) {
      progressSum += result.progress;
    }

    return ((100 * totalDone) + progressSum) / total;
  }

  /**
   * Check if all SMILES have been processed
   */
  get isRetroFinished(): boolean {
    return this.smilesLeft.size === 0;
  }

  /**
   * Check if all SMILES have been consumed
   */
  get isEmpty(): boolean {
    return this.isRetroFinished && this.smilesDone.size === 0;
  }

  /**
   * Get all unfinished SMILES
   */
  get unfinishedSmiles(): Record<string, RetrosynthesisResult> {
    return Object.fromEntries(this.smilesLeft);
  }

  /**
   * Get the root version path for API endpoints
   */
  protected get rootVersionPath(): string {
    return `${SpayaClient.ROOT}${SpayaClient.VERSION}`;
  }

  /**
   * Remove a SMILES from the client without removing it from the retrosynthesis queue
   * @param smiles - SMILES to remove
   * @throws Error if SMILES is not found
   */
  remove(smiles: string): void {
    if (!this.contains(smiles)) {
      throw new Error(`SMILES ${smiles} not found in client`);
    }
    this.smilesDone.delete(smiles);
    this.smilesLeft.delete(smiles);
  }

  /**
   * Check if a SMILES is in the client
   * @param smiles - SMILES to check
   */
  contains(smiles: string): boolean {
    return this.smilesDone.has(smiles) || this.smilesLeft.has(smiles);
  }

  /**
   * Get result for a SMILES
   * @param smiles - SMILES to get result for
   * @throws Error if SMILES is not found
   */
  getResult(smiles: string): RetrosynthesisResult {
    if (this.smilesDone.has(smiles)) {
      return this.smilesDone.get(smiles)!;
    }
    if (this.smilesLeft.has(smiles)) {
      return this.smilesLeft.get(smiles)!;
    }
    throw new Error(`SMILES ${smiles} not found in client`);
  }

  /**
   * Remove and return a finished SMILES result
   * @param smiles - SMILES to pop
   * @returns Result if finished, null otherwise
   */
  popFinished(smiles: string): RetrosynthesisResult | null {
    const result = this.getResult(smiles);
    if (StatusUtils.isFinished(result.status)) {
      this.remove(smiles);
      return result;
    }
    return null;
  }

  /**
   * Extract list of SMILES from various input types
   * @param smiles - Input SMILES in various formats
   */
  protected extractSmilesArray(smiles: SmilesInput): string[] {
    if (typeof smiles === 'string') {
      return [smiles];
    }
    if (Array.isArray(smiles)) {
      // Handle array of strings or objects with smiles property
      return smiles.map(item => 
        typeof item === 'string' ? item : item.smiles
      );
    }
    throw new Error('Invalid SMILES input type');
  }

  /**
   * Update result from API response
   * @param responseData - API response data
   */
  protected updateResult(responseData: any): [string, RetrosynthesisResult] {
    const smiles = responseData.smiles;
    const result: RetrosynthesisResult = {
      rscore: responseData.rscore,
      nbSteps: responseData.nb_steps,
      status: responseData.status as StatusCode,
      progress: responseData.progress || 0
    };

    if (this.smilesLeft.has(smiles)) {
      this.smilesLeft.set(smiles, result);
      if (StatusUtils.isFinished(result.status)) {
        this.smilesDone.set(smiles, result);
        this.smilesLeft.delete(smiles);
      }
    } else if (this.smilesDone.has(smiles)) {
      const existing = this.smilesDone.get(smiles)!;
      if (StatusUtils.canBeRetried(existing.status)) {
        if (!StatusUtils.isFinished(result.status)) {
          this.smilesLeft.set(smiles, result);
          this.smilesDone.delete(smiles);
        } else {
          this.smilesDone.set(smiles, result);
        }
      }
    } else {
      // New SMILES
      if (StatusUtils.isFinished(result.status)) {
        this.smilesDone.set(smiles, result);
      } else {
        this.smilesLeft.set(smiles, result);
      }
    }

    return [smiles, result];
  }

  /**
   * Update results from batch API response
   * @param responseData - Batch API response data
   */
  protected updateResultBatch(responseData: any): void {
    if (responseData.smiles && Array.isArray(responseData.smiles)) {
      for (const smilesData of responseData.smiles) {
        this.updateResult(smilesData);
      }
    }
  }

  /**
   * Create API request entry
   * @param smiles - List of SMILES to send
   */
  protected createEntry(smiles: string[]): any {
    const entry = { ...this.parameters };
    // Convert camelCase to snake_case for API
    const apiEntry: any = {
      batch_smiles: smiles
    };

    // Map TypeScript parameter names to API names
    const paramMapping: Record<string, string> = {
      maxDepth: 'max_depth',
      maxNbIterations: 'max_nb_iterations',
      earlyStoppingScore: 'early_stopping_score',
      earlyStoppingTimeout: 'early_stopping_timeout',
      intermediateSmiles: 'intermediate_smiles',
      imposedStructures: 'imposed_structures',
      forbiddenStructures: 'forbidden_structures',
      firstDisconnections: 'first_disconnections',
      ccProviders: 'cc_providers',
      ccMaxPricePerG: 'cc_max_price_per_g',
      ccMaxDeliveryDays: 'cc_max_delivery_days',
      ccCatalog: 'cc_catalog',
      ccExtraCompoundsSmiles: 'cc_extra_compounds_smiles',
      removeChirality: 'remove_chirality',
      nameReactionsOnly: 'name_reactions_only',
      nameReactionsExclude: 'name_reactions_exclude',
      nameReactionsAtLeast: 'name_reactions_at_least',
      filterRegioIssues: 'filter_regio_issues'
    };

    for (const [tsKey, apiKey] of Object.entries(paramMapping)) {
      if (entry[tsKey as keyof RetrosynthesisParameters] !== undefined) {
        apiEntry[apiKey] = entry[tsKey as keyof RetrosynthesisParameters];
      }
    }

    return apiEntry;
  }

  /**
   * Send HTTP request with retry logic
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param data - Request data
   */
  protected async sendWithRetry(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any
  ): Promise<any> {
    const baseUrl = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
    const fullUrl = `${baseUrl}${this.rootVersionPath}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.settings.maxRetry; attempt++) {
      try {
        const response = await this.makeHttpRequest(method, fullUrl, data);

        if (response.status === 200) {
          return response.data;
        }

        throw new SpayaError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.settings.maxRetry) {
          await this.sleep(this.settings.retrySleep * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Make HTTP request using fetch API
   * @param method - HTTP method
   * @param url - Full URL
   * @param data - Request data
   */
  private async makeHttpRequest(
    method: 'GET' | 'POST',
    url: string,
    data?: any
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authorization.headers()
    };

    let fetchUrl = url;
    let body: string | undefined;

    if (method === 'GET' && data) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      fetchUrl = `${url}?${params.toString()}`;
    } else if (method === 'POST' && data) {
      body = JSON.stringify(data);
    }

    const response = await fetch(fetchUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    let responseData: any;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData
    };
  }

  /**
   * Get API status
   */
  protected async getStatus(): Promise<Status> {
    const response = await this.sendWithRetry('GET', '/status');
    return {
      queueSize: response.queue_size
    };
  }

  /**
   * Get commercial compounds providers
   */
  protected async getCommercialCompoundsProviders(): Promise<string[]> {
    const response = await this.sendWithRetry('GET', '/commercial-compounds-providers');
    return response.providers || [];
  }

  /**
   * Get commercial compounds for SMILES
   */
  protected async getCommercialCompounds(
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
    const smilesArray = this.extractSmilesArray(smiles);
    const result: Record<string, CommercialCompound[]> = {};

    for (const smilesStr of smilesArray) {
      const requestData = {
        smiles: smilesStr,
        ...options
      };

      const response = await this.sendWithRetry('GET', '/commercial-compounds', requestData);
      const compounds = response.commercial_compounds?.map((cc: any) => ({
        smiles: cc.smiles || '',
        provider: cc.provider || '',
        url: cc.url,
        reference: cc.reference,
        cas: cc.cas,
        catalog: cc.catalog,
        packagingG: cc.packaging_g,
        pricePerG: cc.price_per_g,
        deliveryDateMinDay: cc.delivery_date_min_day,
        deliveryDateMaxDay: cc.delivery_date_max_day,
        purity: cc.purity,
        chemicalName: cc.chemical_name,
        description: cc.description
      })) || [];

      result[smilesStr] = compounds;
    }

    return result;
  }

  /**
   * Get name reactions
   */
  protected async getNameReactions(filter?: string): Promise<string[]> {
    const data = filter ? { filter_name_reactions: filter } : {};
    const response = await this.sendWithRetry('GET', '/name-reactions', data);
    return response.name_reactions || [];
  }

  /**
   * Get retrosynthesis quota
   */
  protected async getRetrosynthesisQuota(): Promise<number | null> {
    const response = await this.sendWithRetry('GET', '/quota');
    return response.retrosynthesis_left ?? null;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

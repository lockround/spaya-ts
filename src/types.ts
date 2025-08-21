/**
 * @fileoverview TypeScript interfaces and types for Spaya API
 */

// Re-export Authorization from authorization module for convenience
export { Authorization } from './authorization';

/**
 * SMILES retrosynthesis status codes
 */
export enum StatusCode {
  NOT_SENT = 'NOT_SENT',
  SUBMITTED = 'SUBMITTED', 
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  INVALID_SMILES = 'INVALID SMILES',
  ERROR = 'ERROR',
  KILLED = 'KILLED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  QUEUE_FULL = 'QUEUE_FULL'
}

/**
 * Type of compounds catalog
 */
export enum Catalog {
  BUILDING_BLOCK = 'building block',
  SCREENING = 'screening'
}

/**
 * Client settings interface
 */
export interface Settings {
  /** Maximum number of SMILES per request */
  maxSmilesPerRequest: number;
  /** Verify the server's TLS certificate */
  verifyTls: boolean;
  /** Maximum number of request retry before return an error */
  maxRetry: number;
  /** Time to wait between two retry (in seconds) */
  retrySleep: number;
}

/**
 * REST Client specific settings
 */
export interface SettingsREST extends Settings {
  /** Minimum time in seconds between 2 requests to the API; must be >= 1 */
  minimumUpdatePeriod: number;
}

/**
 * Async Client specific settings  
 */
export interface SettingsAsync extends Settings {}

/**
 * Callback Client specific settings
 */
export interface SettingsCallback extends SettingsAsync {}

/**
 * Parameters for a retrosynthesis request
 */
export interface RetrosynthesisParameters {
  /** Spaya's retrosynthesis engine (model) version to use */
  model?: string;
  /** Maximum route depth */
  maxDepth?: number;
  /** Maximum number of steps */
  maxNbIterations?: number;
  /** Score threshold to stop the retrosynthesis of a SMILES */
  earlyStoppingScore?: number;
  /** Timeout to stop the retrosynthesis of a SMILES in minutes */
  earlyStoppingTimeout?: number;
  /** Desired intermediate products (as a list of SMILES) */
  intermediateSmiles?: string[];
  /** Desired imposed substructures (as a list of SMARTS) */
  imposedStructures?: string[];
  /** Desired forbidden substructures (as a list of SMARTS) */
  forbiddenStructures?: string[];
  /** Desired atoms indices to use as 1st disconnections */
  firstDisconnections?: number[];
  /** List of desired commercial compounds providers */
  ccProviders?: string[];
  /** Maximum price per gramme for a commercial compound */
  ccMaxPricePerG?: number;
  /** Maximum delivery time in day */
  ccMaxDeliveryDays?: number;
  /** Select the type of compounds (building block or screening) */
  ccCatalog?: Catalog[];
  /** A list of smiles to add as commercial compounds */
  ccExtraCompoundsSmiles?: string[];
  /** When True, remove the chirality from all inputs */
  removeChirality?: boolean;
  /** List of allowed name reactions */
  nameReactionsOnly?: string[];
  /** List of excluded name reactions */
  nameReactionsExclude?: string[];
  /** List of mandatory name reactions */
  nameReactionsAtLeast?: string[];
  /** When True, disables the regioselectivity */
  filterRegioIssues?: boolean;
}

/**
 * Retrosynthesis result containing score and status information
 */
export interface RetrosynthesisResult {
  /** The RScore metric from Spaya algorithms */
  rscore?: number;
  /** The number of steps in the longest linear sequence */
  nbSteps?: number;
  /** SMILES retrosynthesis status */
  status: StatusCode;
  /** SMILES retrosynthesis progress (as percentage) */
  progress: number;
}

/**
 * Current Spaya API status
 */
export interface Status {
  /** Number of jobs waiting to be processed */
  queueSize?: number;
}

/**
 * A route computed by Spaya
 */
export interface Route {
  /** The RScore metric from Spaya algorithms */
  rscore?: number;
  /** The number of steps in the longest linear sequence */
  nbSteps?: number;
  /** The route tree for a SMILES */
  tree?: Record<string, any>;
}

/**
 * Commercial compound information
 */
export interface CommercialCompound {
  /** The molecule represented as a SMILES */
  smiles: string;
  /** Name of the provider */
  provider: string;
  /** Link to get the compounds */
  url?: string;
  /** Literature reference */
  reference?: string;
  /** CAS number for this compound */
  cas?: string;
  /** The type of compounds (building block / screening / virtual) */
  catalog?: string;
  /** Size of the packaging in gramme */
  packagingG?: number;
  /** Price per gramme */
  pricePerG?: number;
  /** Minimum delivery time in day */
  deliveryDateMinDay?: number;
  /** Maximum delivery time in day */
  deliveryDateMaxDay?: number;
  /** Purity of the compounds */
  purity?: number;
  /** Name of the chemical */
  chemicalName?: string;
  /** Extra informations from the provider */
  description?: string;
}

/**
 * A cluster for a batch of SMILES
 */
export interface Cluster {
  /** The key of the clustering, a SMILES common in all the routes */
  key: string;
  /** SMILES in this cluster */
  smiles: string[];
  /** The average depth of the common intermediate for the routes in the cluster */
  meanDepths: number;
  /** The average of the max scores of the routes to create the SMILES in the cluster */
  meanMaxScore: number;
}

/**
 * Clustering result
 */
export interface ClusteringResult {
  /** List of clusters */
  clusters: Cluster[];
  /** Clustering status */
  status: StatusCode;
}

/**
 * Generic error thrown by Spaya clients
 */
export class SpayaError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'SpayaError';
  }
}

/**
 * Connection error for WebSocket clients
 */
export class SpayaConnectionError extends SpayaError {
  constructor(message: string) {
    super(message);
    this.name = 'SpayaConnectionError';
  }
}

/**
 * Utility type for SMILES input - can be a single SMILES, array of SMILES, or array of objects with SMILES
 */
export type SmilesInput = string | string[] | Array<{ smiles: string; [key: string]: any }>;

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: number) => void | Promise<void>;

/**
 * Result callback function type for callback client
 */
export type ResultCallback = (smiles: string, result: RetrosynthesisResult) => void | Promise<void>;

/**
 * Error callback function type for callback client
 */
export type ErrorCallback = (error: Error) => void | Promise<void>;

/**
 * Utility functions for status checking
 */
export const StatusUtils = {
  /**
   * Check if a status is finished (no longer being processed)
   */
  isFinished(status: StatusCode): boolean {
    return [
      StatusCode.DONE,
      StatusCode.ERROR,
      StatusCode.INVALID_SMILES,
      StatusCode.QUOTA_EXCEEDED
    ].includes(status);
  },

  /**
   * Check if a status can be retried
   */
  canBeRetried(status: StatusCode): boolean {
    return [StatusCode.ERROR, StatusCode.QUOTA_EXCEEDED].includes(status);
  },

  /**
   * Check if a status needs retry
   */
  needsRetry(status: StatusCode): boolean {
    return [StatusCode.QUEUE_FULL].includes(status);
  }
};

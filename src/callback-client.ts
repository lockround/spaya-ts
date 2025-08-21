/**
 * @fileoverview Callback-based client for event-driven Spaya API interactions
 */

import { SpayaClientAsync } from './async-client';
import {
  Authorization,
  RetrosynthesisParameters,
  SettingsCallback,
  SmilesInput,
  ProgressCallback,
  ResultCallback,
  ErrorCallback
} from './types';

/**
 * Default settings for Callback client
 */
const DEFAULT_CALLBACK_SETTINGS: SettingsCallback = {
  maxSmilesPerRequest: 1000,
  verifyTls: true,
  maxRetry: 2,
  retrySleep: 10
};

/**
 * Callback-based client for Spaya API that triggers callbacks when results are available
 * 
 * @example
 * ```typescript
 * import { SpayaClientCallback, BearerToken } from 'spaya-ts';
 * 
 * const resultCallback = async (smiles: string, result: RetrosynthesisResult) => {
 *   console.log(`${smiles}: ${result.rscore}/${result.nbSteps}`);
 * };
 * 
 * const client = new SpayaClientCallback({
 *   url: 'https://spaya.ai',
 *   authorization: new BearerToken('your-token'),
 *   resultCallback
 * });
 * 
 * await client.connect();
 * await client.startCallback();
 * 
 * await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);
 * await client.waitResult();
 * 
 * await client.close();
 * ```
 */
export class SpayaClientCallback extends SpayaClientAsync {
  private readonly resultCallback: ResultCallback;
  private readonly errorCallback?: ErrorCallback;
  private callbackTask: Promise<void> | null = null;
  private isCallbackRunning = false;
  private isClosing = false;

  /**
   * Create a new callback client
   * @param config - Client configuration
   */
  constructor(config: {
    url: string;
    authorization: Authorization;
    resultCallback: ResultCallback;
    parameters?: RetrosynthesisParameters;
    errorCallback?: ErrorCallback;
    settings?: Partial<SettingsCallback>;
  }) {
    const settings = { ...DEFAULT_CALLBACK_SETTINGS, ...config.settings };
    super({
      url: config.url,
      authorization: config.authorization,
      parameters: config.parameters,
      settings
    });

    this.resultCallback = config.resultCallback;
    this.errorCallback = config.errorCallback;
  }

  /**
   * Connect and start callback processing
   */
  async connect(): Promise<void> {
    await super.connect();
    await this.startCallback();
  }

  /**
   * Start the callback task that processes results
   */
  async startCallback(): Promise<void> {
    if (this.callbackTask && this.isCallbackRunning) {
      return;
    }

    await this.stopCallback();
    this.isCallbackRunning = true;
    this.callbackTask = this.callbackLoop();
  }

  /**
   * Stop the callback task
   */
  async stopCallback(): Promise<void> {
    this.isCallbackRunning = false;
    
    if (this.callbackTask) {
      try {
        await this.callbackTask;
      } catch (error) {
        // Task was cancelled or errored, which is expected
      }
      this.callbackTask = null;
    }
  }

  /**
   * Start retrosynthesis for SMILES
   * @param smiles - SMILES to process
   */
  async startRetrosynthesis(smiles: SmilesInput): Promise<void> {
    if (!this.callbackTask || !this.isCallbackRunning) {
      throw new Error('Callback task not started. Call startCallback() first.');
    }

    const smilesArray = this.extractSmilesArray(smiles);
    await super.connect();
    
    // Add SMILES to tracking before sending
    for (const smilesStr of smilesArray) {
      if (!this.smilesLeft.has(smilesStr)) {
        this.smilesLeft.set(smilesStr, {
          status: 'NOT_SENT' as any,
          progress: 0
        });
      }
    }

    await (this as any).sendSmiles(smilesArray);
  }

  /**
   * Wait for all results to be processed
   * @param progressCallback - Optional progress callback
   */
  async waitResult(progressCallback?: ProgressCallback): Promise<void> {
    while (
      this.smilesLeft.size > 0 && 
      this.isCallbackRunning &&
      this.callbackTask &&
!(this as any).isStopped
    ) {
      if (progressCallback) {
        if (progressCallback.constructor.name === 'AsyncFunction') {
          await (progressCallback as any)(this.progression);
        } else {
          (progressCallback as any)(this.progression);
        }
      }
      
      await this.sleep(500);
    }

    await this.ensureCallbackTaskCompletes();
  }

  /**
   * Close the client and stop all operations
   */
  async close(): Promise<void> {
    try {
      // Prevent recursion if user calls close in error callback
      if (!this.isClosing) {
        this.isClosing = true;
        await this.stopCallback();
        await super.close();
      }
    } finally {
      this.isClosing = false;
    }
  }

  /**
   * Main callback processing loop
   */
  private async callbackLoop(): Promise<void> {
    try {
      while (this.isCallbackRunning && !(this as any).isStopped) {
        try {
          await super.connect();

          // Process any completed results
          while (this.smilesDone.size > 0 && this.isCallbackRunning) {
            const entry = this.smilesDone.entries().next().value;
            if (!entry) break;
            const [smiles, result] = entry;
            this.smilesDone.delete(smiles);
            
            try {
              await this.resultCallback(smiles, result);
            } catch (callbackError) {
              console.error('Error in result callback:', callbackError);
              if (this.errorCallback) {
                await this.errorCallback(callbackError instanceof Error ? callbackError : new Error(String(callbackError)));
              }
            }
          }

          if (this.smilesLeft.size === 0 && this.smilesDone.size === 0) {
            await this.sleep(500);
            continue;
          }

          // Wait for new messages
          try {
            const messagePromise = (this as any).waitForMessage();
            const timeoutPromise = this.sleep(500);
            
            const result = await Promise.race([messagePromise, timeoutPromise]);
            
            if (result) {
              this.updateResult(result);
            }
          } catch (messageError) {
            if (this.isCallbackRunning) {
              console.warn('Message error in callback loop:', messageError);
            }
          }
        } catch (connectionError) {
          if (this.isCallbackRunning) {
            console.warn('Connection error in callback loop:', connectionError);
            await this.sleep(500);
          }
        }
      }
    } catch (error) {
      if (this.errorCallback && this.isCallbackRunning) {
        try {
          await this.errorCallback(error instanceof Error ? error : new Error(String(error)));
        } catch (callbackError) {
          console.error('Error in error callback:', callbackError);
        }
      } else if (this.isCallbackRunning) {
        throw error;
      }
    }
  }

  /**
   * Ensure callback task completes properly
   */
  private async ensureCallbackTaskCompletes(): Promise<void> {
    if (this.callbackTask && this.callbackTask !== this.callbackLoop()) {
      try {
        await this.callbackTask;
      } catch (error) {
        if (this.errorCallback) {
          try {
            await this.errorCallback(error instanceof Error ? error : new Error(String(error)));
          } catch (callbackError) {
            console.error('Error in error callback during cleanup:', callbackError);
          }
        } else {
          throw error;
        }
      }
    }
  }






}

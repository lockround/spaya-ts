# Spaya TypeScript Client

[![npm version](https://img.shields.io/npm/v/spaya-ts.svg)](https://www.npmjs.com/package/spaya-ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive TypeScript client library for the Spaya retrosynthesis-scoring API, providing REST, async WebSocket, and callback-based interaction patterns.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Overview](#api-overview)
- [Client Types](#client-types)
  - [REST Client](#rest-client)
  - [Async Client](#async-client)
  - [Callback Client](#callback-client)
- [Authorization](#authorization)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)
- [Contributing](#contributing)

## Installation

```bash
npm install spaya-ts
```

```bash
yarn add spaya-ts
```

## Quick Start

### REST Client (Promise-based)

```typescript
import { SpayaClientREST, BearerToken } from 'spaya-ts';

const client = new SpayaClientREST({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-api-token')
});

// Score SMILES and wait for results
const results = await client.scoreSmiles(['O=C1CCCCO1', 'O=C1CCCNN1']);

for (const [smiles, result] of Object.entries(results)) {
  console.log(`${smiles}: Score=${result.rscore}, Steps=${result.nbSteps}`);
}
```

### Async Client (WebSocket-based)

```typescript
import { SpayaClientAsync, BearerToken } from 'spaya-ts';

const client = new SpayaClientAsync({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-api-token')
});

await client.connect();
await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);

// Process results as they arrive
for await (const [smiles, result] of client.consume()) {
  console.log(`${smiles}: Score=${result.rscore}, Steps=${result.nbSteps}`);
}

await client.close();
```

### Callback Client (Event-driven)

```typescript
import { SpayaClientCallback, BearerToken } from 'spaya-ts';

const client = new SpayaClientCallback({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-api-token'),
  resultCallback: async (smiles, result) => {
    console.log(`${smiles}: Score=${result.rscore}, Steps=${result.nbSteps}`);
  }
});

await client.connect();
await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);
await client.waitResult();
await client.close();
```

## API Overview

### Spaya API

This package provides easy access to score SMILES with the Spaya API, which employs a data-driven AI approach to discover retrosynthetic routes. The retrosynthesis score (RScore) is a metric related to the probability of a disconnection and the confidence the algorithm has in the route.

**Useful Links:**
- [Spaya Public](https://spaya.ai)
- [Spaya API](https://iktos.ai/spaya-api/)
- [REST API Documentation](https://spaya.ai/retrosynthesis-api/redoc)
- [WebSocket API Documentation](https://spaya.ai/retrosynthesis-api/static/asyncapi.html)

### Retrosynthesis Results

Each scored SMILES returns a `RetrosynthesisResult`:

```typescript
interface RetrosynthesisResult {
  rscore?: number;      // Retrosynthesis confidence score
  nbSteps?: number;     // Number of synthetic steps
  status: StatusCode;   // Current processing status
  progress: number;     // Progress percentage
}
```

## Client Types

The library provides three different client implementations to match various use cases:

### REST Client

**Use Case:** Synchronous scoring where you want to submit SMILES and wait for all results.

```typescript
import { SpayaClientREST, BearerToken } from 'spaya-ts';

const client = new SpayaClientREST({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token'),
  settings: {
    minimumUpdatePeriod: 2, // Minimum seconds between API calls
    maxSmilesPerRequest: 1000
  }
});

// Method 1: Score and wait for all results
const results = await client.scoreSmiles([
  'O=C1CCCCO1', 
  'O=C1CCCNN1'
]);

// Method 2: Stream processing
await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);

while (!client.isEmpty) {
  for await (const [smiles, result] of client.consume()) {
    console.log(`${smiles}: ${result.rscore}`);
  }
}
```

### Async Client

**Use Case:** Real-time processing with WebSocket connections and streaming results.

```typescript
import { SpayaClientAsync, BearerToken } from 'spaya-ts';

const client = new SpayaClientAsync({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token'),
  settings: {
    maxRetry: 3,
    retrySleep: 5
  }
});

// Auto-reconnection and real-time results
await client.connect();
await client.startRetrosynthesis(['O=C1CCCCO1', 'O=C1CCCNN1']);

for await (const [smiles, result] of client.consume()) {
  if (result.status === 'DONE') {
    console.log(`Completed: ${smiles} -> ${result.rscore}`);
  }
}

await client.close();
```

### Callback Client

**Use Case:** Event-driven architecture where you want callbacks triggered for each result.

```typescript
import { SpayaClientCallback, BearerToken } from 'spaya-ts';

const client = new SpayaClientCallback({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token'),
  resultCallback: async (smiles, result) => {
    // Process each result as it arrives
    await saveToDatabase(smiles, result);
    console.log(`Processed: ${smiles}`);
  },
  errorCallback: async (error) => {
    console.error('Client error:', error);
  }
});

await client.connect();

// Submit SMILES individually or in batches
for (const smiles of smilesGenerator()) {
  await client.startRetrosynthesis(smiles);
}

await client.waitResult();
await client.close();
```

## Authorization

### Bearer Token (Standard)

```typescript
import { BearerToken } from 'spaya-ts';

const auth = new BearerToken('your-api-token');
// Creates header: { "Authorization": "Bearer your-api-token" }
```

### Custom Bearer Token

```typescript
import { CustomBearerToken } from 'spaya-ts';

const auth = new CustomBearerToken('your-token', 'X-Custom-Auth');
// Creates header: { "X-Custom-Auth": "Bearer your-token" }
```

## Configuration

### Retrosynthesis Parameters

```typescript
const parameters: RetrosynthesisParameters = {
  model: 'latest',
  maxDepth: 10,
  maxNbIterations: 1000,
  earlyStoppingScore: 0.8,
  earlyStoppingTimeout: 30, // minutes
  intermediateSmiles: ['CCO', 'CC(=O)O'], // Force through these intermediates
  imposedStructures: ['c1ccccc1'], // SMARTS patterns to include
  forbiddenStructures: ['[N+](=O)[O-]'], // SMARTS patterns to avoid
  removeChirality: false,
  ccProviders: ['sigma-aldrich', 'molport'], // Commercial compound providers
  ccMaxPricePerG: 100.0,
  ccMaxDeliveryDays: 30
};

const client = new SpayaClientREST({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token'),
  parameters
});
```

### Client Settings

```typescript
// REST Client Settings
const restSettings: SettingsREST = {
  maxSmilesPerRequest: 1000,
  verifyTls: true,
  maxRetry: 2,
  retrySleep: 10,
  minimumUpdatePeriod: 2 // REST-specific: min seconds between requests
};

// Async/Callback Client Settings  
const asyncSettings: SettingsAsync = {
  maxSmilesPerRequest: 1000,
  verifyTls: true,
  maxRetry: 2,
  retrySleep: 10
};
```

## API Reference

### Common Methods (All Clients)

```typescript
// Get API status
const status = await client.getStatus();
console.log(`Queue size: ${status.queueSize}`);

// Get commercial compound providers
const providers = await client.getCommercialCompoundsProviders();

// Find commercial compounds
const compounds = await client.getCommercialCompounds(['CCO'], {
  provider: ['sigma-aldrich'],
  pricePerGMax: 50.0
});

// Get reaction names
const reactions = await client.getNameReactions('suzuki');

// Get routes for completed SMILES
const routes = await client.getRoutes(['O=C1CCCCO1'], 5); // Top 5 routes

// Get clustering analysis
const clustering = await client.getClustering(['O=C1CCCCO1', 'O=C1CCCNN1'], {
  maxCluster: 10,
  minRelativeSize: 0.1
});

// Check quota
const quota = await client.getRetrosynthesisQuota();
console.log(`Remaining retrosyntheses: ${quota}`);
```

### Progress Tracking

```typescript
// REST Client - with progress callback
const results = await client.scoreSmiles(smiles, (progress) => {
  console.log(`Progress: ${progress.toFixed(1)}%`);
});

// Async Client - manual progress checking
await client.startRetrosynthesis(smiles);
await client.waitResult(async (progress) => {
  await updateProgressBar(progress);
});

// Callback Client - progress during wait
await client.waitResult((progress) => {
  console.log(`Overall progress: ${progress}%`);
});
```

## Examples

### Batch Processing with REST Client

```typescript
import { SpayaClientREST, BearerToken } from 'spaya-ts';

async function processSmilesFile(filename: string) {
  const client = new SpayaClientREST({
    url: 'https://spaya.ai',
    authorization: new BearerToken(process.env.SPAYA_TOKEN!)
  });

  const smiles = await readSmilesFromFile(filename);
  
  // Process in chunks
  const chunkSize = 100;
  const results: Record<string, RetrosynthesisResult> = {};
  
  for (let i = 0; i < smiles.length; i += chunkSize) {
    const chunk = smiles.slice(i, i + chunkSize);
    console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1}...`);
    
    const chunkResults = await client.scoreSmiles(chunk, (progress) => {
      console.log(`  Progress: ${progress.toFixed(1)}%`);
    });
    
    Object.assign(results, chunkResults);
  }
  
  return results;
}
```

### Real-time Stream Processing

```typescript
import { SpayaClientAsync, BearerToken } from 'spaya-ts';

async function realTimeProcessor() {
  const client = new SpayaClientAsync({
    url: 'https://spaya.ai',
    authorization: new BearerToken(process.env.SPAYA_TOKEN!)
  });

  await client.connect();

  // Process SMILES as they come from external source
  const smilesStream = createSmilesStream(); // Your stream source
  
  // Start processing
  const processingPromise = (async () => {
    for await (const [smiles, result] of client.consume()) {
      await handleResult(smiles, result);
    }
  })();

  // Feed SMILES to processor
  for await (const smiles of smilesStream) {
    await client.startRetrosynthesis([smiles]);
  }

  await client.waitResult();
  await processingPromise;
  await client.close();
}
```

### Event-driven Architecture

```typescript
import { SpayaClientCallback, BearerToken } from 'spaya-ts';
import { EventEmitter } from 'events';

class SmilesProcessor extends EventEmitter {
  private client: SpayaClientCallback;

  constructor(token: string) {
    super();
    
    this.client = new SpayaClientCallback({
      url: 'https://spaya.ai',
      authorization: new BearerToken(token),
      resultCallback: this.handleResult.bind(this),
      errorCallback: this.handleError.bind(this)
    });
  }

  async start() {
    await this.client.connect();
  }

  async stop() {
    await this.client.close();
  }

  async submitSmiles(smiles: string | string[]) {
    await this.client.startRetrosynthesis(smiles);
  }

  private async handleResult(smiles: string, result: RetrosynthesisResult) {
    this.emit('result', { smiles, result });
    
    if (result.rscore && result.rscore > 0.8) {
      this.emit('highScore', { smiles, result });
    }
  }

  private async handleError(error: Error) {
    this.emit('error', error);
  }
}

// Usage
const processor = new SmilesProcessor(process.env.SPAYA_TOKEN!);

processor.on('result', ({ smiles, result }) => {
  console.log(`${smiles}: ${result.rscore}`);
});

processor.on('highScore', ({ smiles, result }) => {
  console.log(`High score alert: ${smiles} -> ${result.rscore}`);
});

await processor.start();
await processor.submitSmiles(['O=C1CCCCO1', 'O=C1CCCNN1']);
```

## Error Handling

### Error Types

```typescript
import { SpayaError, SpayaConnectionError } from 'spaya-ts';

try {
  const results = await client.scoreSmiles(['invalid-smiles']);
} catch (error) {
  if (error instanceof SpayaConnectionError) {
    console.error('Connection issue:', error.message);
  } else if (error instanceof SpayaError) {
    console.error('API error:', error.message, 'Status:', error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

```typescript
const client = new SpayaClientREST({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token'),
  settings: {
    maxRetry: 3,      // Retry failed requests up to 3 times
    retrySleep: 10    // Wait 10 seconds between retries
  }
});
```

### Connection Resilience (Async/Callback Clients)

```typescript
const client = new SpayaClientAsync({
  url: 'https://spaya.ai',
  authorization: new BearerToken('your-token')
});

// Auto-reconnection is handled internally
await client.connect();

// Even if connection drops, the client will automatically reconnect
// and resume processing when calling methods
for await (const [smiles, result] of client.consume()) {
  // This will continue working even through connection interruptions
  console.log(`${smiles}: ${result.rscore}`);
}
```

## TypeScript Support

This library is written in TypeScript and provides comprehensive type definitions:

```typescript
import { 
  SpayaClientREST, 
  BearerToken, 
  RetrosynthesisResult, 
  StatusCode,
  RetrosynthesisParameters 
} from 'spaya-ts';

// Full type safety
const client: SpayaClientREST = new SpayaClientREST({
  url: 'https://spaya.ai',
  authorization: new BearerToken('token')
});

const results: Record<string, RetrosynthesisResult> = await client.scoreSmiles(['CCO']);

// Type-safe status checking
if (results['CCO'].status === StatusCode.DONE) {
  const score: number | undefined = results['CCO'].rscore;
  const steps: number | undefined = results['CCO'].nbSteps;
}
```

## Building and Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Generate documentation
npm run docs
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions and support:

- 📧 Email: support@iktos.ai
- 🌐 Website: [https://iktos.ai](https://iktos.ai)
- 📖 Documentation: [https://spaya.ai](https://spaya.ai)

---

Made with ❤️ by [Iktos](https://iktos.ai)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added

- Initial release of Spaya TypeScript client library
- REST client (`SpayaClientREST`) for synchronous API interactions
- Async client (`SpayaClientAsync`) for WebSocket-based real-time processing
- Callback client (`SpayaClientCallback`) for event-driven architecture
- Comprehensive TypeScript type definitions and interfaces
- Authorization support with `BearerToken` and `CustomBearerToken`
- Full feature parity with Python pyspaya library including:
  - SMILES scoring and retrosynthesis analysis
  - Commercial compounds lookup
  - Route retrieval and clustering
  - Progress tracking and error handling
  - Configurable retry logic and connection management
- Comprehensive documentation and usage examples
- Unit tests with Jest
- ESLint configuration for code quality
- TypeDoc support for API documentation generation

### Features

- **Multiple Client Types**: Choose the right pattern for your use case
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling with custom error types
- **Auto-reconnection**: Automatic WebSocket reconnection for async clients
- **Progress Tracking**: Real-time progress callbacks for long-running operations
- **Batch Processing**: Efficient handling of large SMILES datasets
- **Configurable Settings**: Customizable retry logic, timeouts, and batch sizes

### API Coverage

- ✅ SMILES scoring and retrosynthesis
- ✅ Commercial compounds search
- ✅ Route retrieval and analysis
- ✅ Clustering analysis
- ✅ API status and quota checking
- ✅ Name reactions lookup
- ✅ Progress tracking
- ✅ Error handling and retry logic

### Client Patterns

- ✅ **REST Client**: Promise-based synchronous operations
- ✅ **Async Client**: WebSocket streaming with async iterators
- ✅ **Callback Client**: Event-driven callbacks for results

[1.0.0]: https://github.com/iktos/spaya-ts/releases/tag/v1.0.0

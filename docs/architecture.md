# Architecture Overview

Frontend:
- React Native
- TypeScript

Backend:
- Azure Functions
- Domain-oriented APIs

Cloud:
- Azure Cosmos DB serverless
- Azure Blob Storage
- Azure OpenAI

Auth:
- Google SSO / Entra-based authentication approach

Principles:
- Backend owns secrets
- No direct AI calls from mobile app
- No generic AI chat in MVP
- Cost-aware design

## Internal Food Product Catalog

FitTrack maintains its own food product catalog in Cosmos DB (`foodProducts` container) rather than querying external APIs at runtime. Products are sourced from Open Food Facts and imported via an offline CLI tool (`tools/off-import/import-to-cosmos.ts`).

Search flow for `GET /api/food-search`:
1. Fan-out: query user's reusable item library **and** the internal catalog in parallel.
2. Library results come first (personalised, higher trust).
3. Catalog results deduped by name against library hits.
4. Both legs are fault-tolerant — one failure does not suppress the other.

Dedicated catalog endpoints: `GET /api/food-products/search?q=` and `GET /api/food-products/{id}`.

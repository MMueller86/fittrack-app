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

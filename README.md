# FitTrack App

Android-first cross-platform nutrition and training app.

## Monorepo Structure

| Folder | Purpose |
|---|---|
| `mobile/` | Expo bare React Native app (Android-first, iOS compatible) |
| `backend/` | Azure Functions v4, TypeScript, Node 24 |
| `infra/` | Bicep Infrastructure-as-Code |
| `shared/` | Shared TypeScript types and DTOs |
| `docs/` | Product specifications and planning documents |

## Prerequisites

Install these once before starting local development:

```powershell
# Node.js 24 (verified with 24.22.1 / npm 12.2.1)
winget install OpenJS.NodeJS.LTS

# Azure Functions Core Tools v4 (npm 12 requires --allow-scripts)
npm install -g --allow-scripts=azure-functions-core-tools azure-functions-core-tools@4.16.0

# Verify
node --version    # v24.x
npm --version     # 12.x
func --version    # 4.16.0
```

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Run backend locally
cd backend && npm start

# See each workspace README for more details
```

## Architecture

- **Frontend:** React Native (Expo bare)
- **Backend:** Azure Functions v4 (TypeScript, Node 24)
- **Database:** Azure Cosmos DB serverless
- **Storage:** Azure Blob Storage (recipe images)
- **AI:** Azure OpenAI gpt-4.1-mini (backend-only, 3 guided workflows)
- **Auth:** Google SSO + JWT (access + refresh token flow)

See `docs/architecture.md` for full details.

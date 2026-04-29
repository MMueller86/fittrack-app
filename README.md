# FitTrack App

Android-first cross-platform nutrition and training app.

## Monorepo Structure

| Folder | Purpose |
|---|---|
| `mobile/` | Expo bare React Native app (Android-first, iOS compatible) |
| `backend/` | Azure Functions v4, TypeScript, Node 20 LTS |
| `infra/` | Bicep Infrastructure-as-Code |
| `shared/` | Shared TypeScript types and DTOs |
| `docs/` | Product specifications and planning documents |

## Prerequisites

Install these once before starting local development:

```powershell
# Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# Azure Functions Core Tools v4
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Verify
node --version    # v20.x
npm --version     # 10.x
func --version    # 4.x
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
- **Backend:** Azure Functions v4 (TypeScript, Node 20)
- **Database:** Azure Cosmos DB serverless
- **Storage:** Azure Blob Storage (recipe images)
- **AI:** Azure OpenAI gpt4o-mini (backend-only, 3 guided workflows)
- **Auth:** Google SSO + JWT (access + refresh token flow)

See `docs/architecture.md` for full details.

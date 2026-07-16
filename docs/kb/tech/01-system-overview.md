# System Overview

## Monorepo Structure

```
fittrack-app/
├── backend/        Azure Functions (Node.js, TypeScript)
├── mobile/         React Native app (Expo, TypeScript)
├── shared/         Shared types + pure calculation library
├── infra/          Bicep IaC for Azure resources
├── tools/          Off-line tooling (Open Food Facts importer)
├── scripts/        Dev-environment scripts (Azurite, Cosmos emulator)
└── _deploy_staging/ Staging area used for production deploys
```

## Subsystems and Their Roles

| Subsystem | Package | Role |
|---|---|---|
| Backend | `backend/` | All business logic, data persistence, AI orchestration, auth validation |
| Mobile | `mobile/` | User interface, navigation, API consumption |
| Shared | `shared/` | Pure types + pure calculation functions used by both sides |
| Infrastructure | `infra/` | Bicep modules defining all Azure resources |
| Import Tool | `tools/off-import/` | One-off CLI to import Open Food Facts data into Cosmos |

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (all packages) |
| Backend runtime | Azure Functions v4, Node.js |
| Mobile framework | React Native (Expo SDK) |
| Database | Azure Cosmos DB for NoSQL, serverless |
| AI | Azure OpenAI (gpt-4o-mini, Structured Outputs) |
| OCR | Azure Document Intelligence |
| Storage | Azure Blob Storage (recipe images) |
| Auth | Entra External ID (CIAM) — OAuth2 PKCE |
| HTTP client | Axios (mobile) |
| Validation | Zod (backend) |
| Test runner | Vitest (backend + shared + mobile) |
| IaC | Bicep |

## Package Dependencies

```
mobile  → @fittrack/shared  (types only)
backend → @fittrack/shared  (types via import type; calculations via relative paths)
shared  → (no internal dependencies)
```

[Rule] `backend` must not use value-imports from `@fittrack/shared` — this causes `require('@fittrack/shared')` in compiled JS, which fails at runtime because `shared/package.json` points `main` to `index.ts`. Use relative paths (`../../../shared/lib/xyz`) for value imports. Use `import type` freely.

## Runtime Environments

### Development

**Purpose:** Fast local development, debugging, feature implementation.

| Component | Where it runs |
|---|---|
| Mobile app | Expo Dev Build on physical device or emulator |
| Backend | Local Azure Functions Core Tools (`func start` in `backend/`) |
| Database | Local Cosmos Emulator (`scripts/start-cosmos-emulator.ps1`) or remote dev Cosmos (`cosmos-fittrack-dev-ppf5sc`) |
| Azure OpenAI | **Shared Azure service** — same instance as Alpha |
| Document Intelligence | **Shared Azure service** — same instance as Alpha |
| Blob Storage | Azurite local emulator (`scripts/start-azurite.mjs`) or remote dev storage |
| Auth (CIAM) | **Shared Azure service** — same tenant as Alpha |

Mobile connects to backend via `EXPO_PUBLIC_API_URL=http://10.0.2.2:7071/api` (emulator) or local IP.

Config: `backend/local.settings.json` (gitignored) + `mobile/.env` (gitignored).

---

### Alpha

**Purpose:** Internal testing, end-to-end validation, near-production verification.

| Component | Where it runs |
|---|---|
| Mobile app | Expo Preview Build (EAS) |
| Backend | Azure Functions — `func-fittrack-alpha-ppf5sc` |
| Database | Dedicated Azure Cosmos DB — `cosmos-fittrack-alpha-ppf5sc` |
| Azure OpenAI | **Shared Azure service** — same instance as Dev |
| Document Intelligence | **Shared Azure service** — same instance as Dev |
| Blob Storage | Dedicated Azure Storage — Alpha environment |
| Auth (CIAM) | **Shared Azure service** — same tenant as Dev |

Config: Azure Function App Application Settings (managed in Azure Portal).

---

### Production

Not yet available. Bicep parameter files exist (`infra/parameters/`) but no resources are deployed.

---

### Intentionally Shared Services

**Azure OpenAI and Azure Document Intelligence are shared across Development and Alpha.**

This is an intentional architectural decision:
- Both services are **stateless** — no user data, no environment-specific state
- Deduplicating them avoids double cost and double quota management
- Model deployments and OCR endpoints are identical across environments

[Rule] Do not create separate OpenAI or Document Intelligence resources per environment. They are shared by design.

---

### Environment Summary

| | Dev | Alpha | Production |
|---|---|---|---|
| Backend | Local (Core Tools) | Azure Functions | Not deployed |
| Database | Local emulator / dev remote | Dedicated Azure Cosmos | Not deployed |
| AI services | **Shared Azure** | **Shared Azure** | — |
| Auth | **Shared CIAM** | **Shared CIAM** | — |
| Mobile build | Dev Build | Preview Build (EAS) | — |
| Config source | `local.settings.json` + `.env` | Azure App Settings + EAS | — |

All Azure resources live in resource group `rg-Michael-Mueller`. New resource groups must not be created. Environments are separated by name prefix: `*-fittrack-dev-*` vs `*-fittrack-alpha-*`.

See [tech/07-infrastructure.md](07-infrastructure.md) for Bicep modules and resource names.

## Inter-service Communication

```
mobile ──HTTP/Bearer──▶ backend (Azure Functions)
backend ──SDK──────────▶ Cosmos DB
backend ──SDK──────────▶ Azure OpenAI
backend ──SDK──────────▶ Azure Document Intelligence
backend ──SDK──────────▶ Azure Blob Storage
```

No direct AI calls from mobile. No API keys in the mobile app. The backend owns all secrets.

## Key Architectural Principles

- **Backend owns secrets** — no keys in mobile, no keys in Cosmos, no keys in Git
- **No generic AI chat** — all AI features are task-specific guided workflows
- **Cost-aware design** — gpt-4o-mini, serverless Cosmos, quota enforcement
- **Cloud-only** — no offline mode, Internet required
- **Reuse-first logging** — users build a personal food library; search suggests it first

## Cross-references

- Backend patterns: [tech/02-backend.md](02-backend.md)
- Auth flow: [tech/05-authentication.md](05-authentication.md)
- Infrastructure detail: [tech/07-infrastructure.md](07-infrastructure.md)
- Import rule rationale: [tech/02-backend.md](02-backend.md#import-rules)

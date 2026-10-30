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
| Language | TypeScript 7 (all packages; native compiler) |
| Backend runtime | Azure Functions v4 (Flex Consumption in Alpha), Node.js 24 |
| Mobile framework | React Native 0.88 on Expo SDK 58 (React 19.3) |
| Database | Azure Cosmos DB for NoSQL, serverless |
| AI | Azure OpenAI (gpt-4.1-mini, Structured Outputs) via `openai` SDK 7.x |
| OCR | Azure Document Intelligence |
| Storage | Azure Blob Storage (recipe images) |
| Auth | Entra External ID (CIAM) — OAuth2 PKCE |
| HTTP client | Axios (mobile) |
| Validation | Zod 4 (backend) |
| Image rendering | `@napi-rs/canvas` (Instagram recipe PNGs) and `sharp` (photo handling) |
| Test runner | Vitest 5 (backend + shared + mobile) |
| IaC | Bicep |

Exact pins and their sources: [Version Pins and Support Matrix](#version-pins-and-support-matrix).

## Version Pins and Support Matrix

State: 2026-10-30, Technology Refresh (plan `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md`). "Resolved" is the version in the lockfile (`npm ls`); manifests are the source for ranges. "Latest" is stated only where a handoff or QA report cites the npm registry on 2026-10-30; the registry moves, so re-check with `npm view` before relying on it.

| Item | Pin / range | Resolved | Source |
|---|---|---|---|
| Node.js | `>=24.22.1 <25`, `.nvmrc` `24.22.1` | 24.22.1 | `package.json`, `backend/package.json`, `_deploy_staging/package.json` `engines`; `.nvmrc` |
| npm | `12.2.1` (`engines`, `packageManager: npm@12.2.1`) | 12.2.1 | root `package.json`; CI installs `npm@12.2.1` |
| TypeScript | `^7.0.2` (backend, shared, mobile, off-import) | 7.0.2 | manifests |
| `@typescript/typescript6` | `~6.0.2` (backend and mobile devDependency; only for the classic AST API in `functions-baseline.mjs` and `nutritionDiaryMutationBoundary.test.ts`) | 6.0.2 | manifests |
| Vitest | `^5.0.5` (backend, shared, mobile; Vite 8) | 5.0.5 | manifests |
| Zod (backend) | `^4.6.7` | 4.6.7 | `backend/package.json` |
| `openai` | `^7.45.1` | 7.45.1 | `backend/package.json` |
| Azure SDKs (backend) | `@azure/cosmos ^4.10.1`, `@azure/functions ^4.17.0`, `@azure/storage-blob ^12.34.0`, `@azure/storage-queue ^12.32.0`, `@azure/ai-form-recognizer ^5.1.0` | as in lockfile | `backend/package.json` |
| `@napi-rs/canvas` | `~1.1.0` | 1.1.0 | `backend/package.json`, `_deploy_staging/package.json` |
| `pixelmatch` (test only) | `~8.0.0` | 8.0.0 | `backend/package.json` |
| Expo SDK | `expo ~58.0.21` | 58.0.21 | `mobile/package.json` |
| React Native / React | `0.88.1` / `19.3.0` | 0.88.1 / 19.3.0 | `mobile/package.json` |
| React Navigation | `native ^7.5.1`, `bottom-tabs` and `native-stack ^7.21.0` | `native` 7.5.1, `core` 7.24.0 | `mobile/package.json`, WP-FE-02 handoff |
| Azure Functions Core Tools | `4.16.0` (CI pin and cache key) | — | `.github/workflows/ci.yml` |
| Cosmos emulator (CI) | `vnext-EN20261019` | — | `.github/workflows/ci.yml` |
| GitHub Actions | `checkout@v7`, `setup-node@v7`, `cache@v6`, `setup-java@v6` | — | `.github/workflows/ci.yml` |
| Bicep resource API versions | see [07-infrastructure.md](07-infrastructure.md#azure-resources-created-by-mainbicep) | — | `infra/` |
| Azure OpenAI | deployment `gpt-4.1-mini`, API version default `2024-10-21` (deployed `2024-08-01-preview`) | — | `backend/src/lib/azureOpenAiConfig.ts`, `infra/` |

`mobile/package.json` pins the native Expo-managed packages to the SDK 58 line (`npx expo install --check` passes, `typescript` is excluded from that check via `expo.install.exclude`). The Android project `mobile/android/` is **gitignored** (not versioned); EAS/prebuild generates the native layer, so a local copy can be stale and is not a source of truth.

### Support status

- Node 24 is the runtime of the Flex Consumption Function App (`functionAppConfig.runtime` `node` / `24`). Microsoft's support/retirement dates for the Node 24 Functions runtime were not retrieved in the refresh work: **[Open]** UNVERIFIED.
- Azure OpenAI `gpt-4.1-mini` is marked deprecated with a retirement date of 2027-04-14 per the 2026-10-29 retrieval in [06-ai-integrations.md](06-ai-integrations.md#platform-lifecycle-retrieved-2026-10-29); not re-verified on 2026-10-30. Follow-up is `[Planned]` there.
- Tools on the operator machine can lag the CI pins. On 2026-10-30 the local Core Tools were 4.9.0 and EAS CLI 21.6.0, while the registry `latest` was Core Tools 4.16.0 and EAS CLI 27.2.0 (WP-INFRA-01). The target EAS CLI version is **[Open]** (plan named 26.x, registry has moved on; Product Owner decides). See `.github/instructions/infra-release.instructions.md`.

### Deferred dependency updates

Expo-managed mobile packages (`react`, `react-test-renderer`, `gesture-handler`, `safe-area-context`, `worklets`) and `@typescript/typescript6` (`~6.0.2`, currently the latest) are intentionally not raised. Reasons, sources, check date 2026-10-30 and reviewer (Product Owner / next Dependabot run) are in the table of the [WP-BE-07 handoff](../../User%20Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-BE-07_Handoff.md).

`@react-native-async-storage/async-storage` is separately pinned to `2.2.0`. Expo SDK 58's `bundledNativeModules.json` maps it to `2.2.0`, and `npx expo install --check` passes. npm has `3.1.1`, but that major version is not established as incompatible; it is simply not the version mapped or validated for this SDK. Revisit it on an Expo SDK upgrade, or after an explicit native build and device validation. Dependabot ignores only its semver-major updates; minor and patch updates remain eligible.

`@types/node` remains on major 24 because the Azure Functions runtime is Node 24. Its major updates are ignored by Dependabot until the supported Functions runtime changes; minor and patch updates remain eligible. The package-specific major-update rules are in [`.github/dependabot.yml`](../../../.github/dependabot.yml).

### Remaining time-limited exceptions

Root `npm audit` on 2026-10-30 reports 12 findings (3 high, 4 moderate, 5 low), all covered by two Product Owner exceptions; the production set (`_deploy_staging`, `npm audit --omit=dev`) reports 0. Both exceptions are re-checked at every upstream release (Dependabot, CI audit step):

| ID | Advisory | Path | Reachability | Status |
|---|---|---|---|---|
| PO-1 (Azurite, time-limited) | GHSA-w5hq-g745-h8pq (`uuid`; propagated to `@azure/ms-rest-js`, `sequelize`, `azurite`; moderate) | `backend` devDependency `azurite@3.37.0` → `@azure/ms-rest-js@2.7.0` / `sequelize@6.37.8` → `uuid@8.3.2` | local storage emulator only; not in `_deploy_staging` | No fix upstream: `azurite 3.37.0` is the latest and declares the affected ranges. No override, no downgrade. |
| PO-2 (Expo build tooling, time-limited) | GHSA-mrhx-c7xc-m3w5 (`zod <4.6.6`, high; surfaces as `zod`, `@expo/cli`, `expo`) and GHSA-gcqx-w48m-w2h4 (`deepmerge >=4.2.0 <=4.3.1`, low; surfaces as `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`) | `mobile` → `expo@58.0.21` → `@expo/cli@58.1.17` → `zod@3.25.76`; `expo` → `@expo/config@58.0.9` → `deepmerge@4.3.1` | build tooling only (not imported in `mobile/src` or `shared`; bundle contents not scanned) | `expo`/`@expo/cli` 58.0.21/58.1.17 were the latest and keep `zod ^3.25.76`; no patched `deepmerge` exists. No override, no downgrade. Expo release notes/issues were not read ([Open]). |

The backend's own `zod 4.6.7` is not affected. One targeted override remains in the root `package.json`: `azurite → @azure/ms-rest-js → form-data 2.5.6` (QA-reviewed, not blanket).

### Upgrade path (Expo)

The app moved from Expo SDK 54 (React Native 0.81) directly to SDK 58 (React Native 0.88.1). Product Owner decision PO-4 = A: the target state SDK 58 is verified; the intermediate SDKs 55–57 were not verified individually. The step was forced by TypeScript 7: `@expo/cli` 54 failed when loading `typescript` (`ts.sys.getCurrentDirectory`), `@expo/cli` 58 does not. Expo's official upgrade notes for SDK 55–58 were not compared online (**[Open]** UNVERIFIED). Because native packages changed, the next mobile release requires a new Dev Build / Preview Build (`Dev Build Required: YES`); device validation of the upgrade (App Link, CIAM login, Health Connect, camera/barcode/label scan, photo crop, Reanimated/bottom sheets, navigation deep links) is `MANUAL VALIDATION REQUIRED` and not yet recorded.

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
| Database | Local Cosmos Emulator (`scripts/start-cosmos-emulator.ps1`) or remote dev Cosmos (`cosmos-fittrack-dev-hlpqe7`) |
| Azure OpenAI | **Shared Azure service** — same instance as Alpha |
| Document Intelligence | **Shared Azure service** — same instance as Alpha |
| Blob Storage | Azurite local emulator (`scripts/storage.mjs`) or remote dev storage. `npm run dev` starts Azurite directly, polls HTTP-readiness on all three ports (2 min window), and only then starts Functions. If Azurite is already running, `dev` detects it and skips the start step. |
| Auth (CIAM) | **Shared Azure service** — same tenant as Alpha |

Mobile connects to backend via `EXPO_PUBLIC_API_URL=http://10.0.2.2:7071/api` (emulator) or local IP. `npm run dev` checks port 7071 before starting its build and local services so duplicate Functions hosts fail early with an actionable message.

Config: `backend/local.settings.json` (gitignored) + `mobile/.env` (gitignored).

---

### Alpha

**Purpose:** Internal testing, end-to-end validation, near-production verification.

| Component | Where it runs |
|---|---|
| Mobile app | Expo Preview Build (EAS) |
| Backend | Azure Functions (Flex Consumption FC1, Node 24) — `func-fittrack-alpha-wcobsd` |
| Database | Dedicated Azure Cosmos DB — `cosmos-fittrack-alpha-wcobsd` (`foodProducts` catalog seeded from Dev; user data migrated once from the legacy Alpha on 2026-10-26) |
| Azure OpenAI | **Shared Azure service** — `oai-fittrack-dev` (`gpt-4.1-mini`, `GlobalStandard`), same instance as Dev |
| Document Intelligence | **Shared Azure service** — `di-fittrack-dev-hlpqe7`, same instance as Dev |
| Blob Storage | Dedicated Azure Storage — `stfittrackalphawcobsd` (one account: blobs, queue, deployment container) |
| Auth (CIAM) | **Shared Azure service** — same tenant as Dev |

Config: Azure Function App Application Settings (managed in Azure Portal).
Mobile build: EAS profile `preview` targets this Alpha. The legacy PRODYNA Alpha is kept unchanged as a backup and is no longer deployed to.

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

Azure subscription `Fittrack` (`germanywestcentral`). Dev resources live in `rg-fittrack-dev`, Alpha resources in `rg-fittrack-alpha` (replaces the former single group `rg-Michael-Mueller`). Do not create further resource groups without a plan. Legacy PRODYNA resources (old Alpha, auth-relay Static Web App) remain for now; the relay is still used by the login callback.

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
- **Cost-aware design** — gpt-4.1-mini, serverless Cosmos, quota enforcement
- **Cloud-only** — no offline mode, Internet required
- **Reuse-first logging** — users build a personal food library; search suggests it first



## FitTrack Data Deletion and Retention

Authenticated `DELETE /api/profile` removes active FitTrack data scoped only to
the verified JWT `sub`. It uses a renewable concurrency lease in the existing
`aiInsights` Cosmos container. `204` confirms the selected steps in that
request finished; work admitted before the lease may still write later. The
deletion flow calls Cosmos DB and Blob Storage, not Microsoft Graph, Azure
OpenAI, or Document Intelligence. Microsoft Entra identity deletion remains
manual.

Published community recipes selected for retention remain usable as ownerless
records in `communityRecipes`, with author `Anonymous` and images at neutral
`community/{recipeId}/{imageId}.{jpg|png}` paths. Personal recipe and product
image blobs under the user's prefix are deleted normally. The endpoint does
not delete the Microsoft Entra identity; any required follow-up is an internal
manual Product Owner task, not an end-user instruction. Existing Health
Connect exports and backups are unchanged; Application Insights logs are not
targeted and use the configured 30-day retention, while Blob Soft Delete may
retain recovery copies for up to seven days. See the full [deletion API
contract](09-api-reference.md#delete-apiprofile).

## Cross-references

- Backend patterns: [tech/02-backend.md](02-backend.md)
- Auth flow: [tech/05-authentication.md](05-authentication.md)
- Infrastructure detail: [tech/07-infrastructure.md](07-infrastructure.md)
- Import rule rationale: [tech/02-backend.md](02-backend.md#import-rules)

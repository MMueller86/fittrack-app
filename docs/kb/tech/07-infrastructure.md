# Infrastructure

## IaC Tool

Bicep. All Azure resources are defined in `infra/`.

## Module Structure

```
infra/
├── main.bicep              Orchestrator — deploys all modules
├── parameters/
│   ├── dev.bicepparam      Dev environment values
│   └── alpha.bicepparam    Alpha (staging) environment values
└── modules/
    ├── cosmos.bicep         Cosmos DB account + database + containers
    ├── storage.bicep        Storage account + blob container
    ├── appinsights.bicep    Log Analytics workspace + Application Insights
    ├── functionapp.bicep    App Service Plan + Function App + App Settings
    ├── documentintelligence.bicep  Azure Document Intelligence resource
    ├── staticwebapp.bicep   Static Web App (Free) for the auth relay / App Links
    └── (Azure OpenAI not in IaC — existing shared resource)
```

## Azure Resources Created by `main.bicep`

| Resource | Module | Notes |
|---|---|---|
| Cosmos DB Account + DB | `cosmos.bicep` | Serverless, 12 containers |
| Storage Account | `storage.bicep` | Blob for recipe images |
| Log Analytics Workspace | `appinsights.bicep` | |
| Application Insights | `appinsights.bicep` | |
| App Service Plan | `functionapp.bicep` | Consumption (serverless) |
| Function App | `functionapp.bicep` | Node.js 22, TypeScript build output |
| Document Intelligence | `documentintelligence.bicep` | F0 for dev, S0 for alpha/prod |
| Static Web App | `staticwebapp.bicep` | Optional (`deployStaticWebApp`); Alpha parameters only; see [Auth Relay Static Web App](#auth-relay-static-web-app) |

For Alpha, the existing Cosmos account and Function App/plan are referenced as
existing resources to avoid What-if changes to provider-returned parent fields.
The Alpha deployment still manages the Cosmos database and containers and the
Function App `config/web`; it does not reconcile the parent resources or app
settings. Dev and other environments continue to create and manage those
parents.

**Not in IaC:**
- Azure OpenAI resource — pre-existing shared resource
- Resource group — must already exist (`rg-Michael-Mueller`)

## Deletion-Relevant Retention

`appinsights.bicep` configures the Log Analytics workspace for 30-day
retention. `storage.bicep` enables Blob Soft Delete for seven days; normal
application deletes can therefore leave platform recovery copies during that
period. Profile deletion does not target Application Insights entries or
Cosmos/Storage backups, and it does not change either retention configuration.
This Bicep module does not declare a Cosmos backup retention period, so none is
asserted here.

The backend also uses a `product-images` Blob container and deletes personal
image blobs under `{verifiedSub}/` during profile deletion. That container is
not declared in the supplied `storage.bicep`; this documentation records the
backend behavior without implying that this module provisions it.

## Cosmos DB Containers

All user-data containers use `/userId` as partition key.

| Container | Partition Key | Notes |
|---|---|---|
| `users` | `/id` | User account documents |
| `nutritionProfiles` | `/userId` | Retained container; the current profile repository uses `profiles` |
| `profiles` | `/userId` | Current user profile document |
| `nutritionDiaryMeals` | `/userId` | Diary meals, DayMeta, and HintState documents |
| `reusableMealItems` | `/userId` | Personal food library |
| `recipes` | `/userId` | User recipes; community listing requires composite index `/updatedAt DESC, /id ASC` |
| `communityRecipes` | `/id` | Ownerless community recipe copies; community listing requires composite index `/updatedAt DESC, /id ASC`; I1 is applied and verified in Dev, not applied in Alpha |
| `weights` | `/userId` | Weight entries |
| `aiUsage` | `/userId` | AI quota usage counters |
| `foodProducts` | `/id` | Open Food Facts catalog (partition key = id) |
| `aiInsights` | `/userId` | Heterogeneous AI documents: Daily cache, Weekly cache, and durable feedback snapshots |
| `userFoodRelations` | `/userId` | Favorites + recents tracking |

As of 2026-10-21, the B1 ownerless community model and its `/id` container and
composite index are implemented; the I1 infrastructure change is deployed and
verified in Dev only. Alpha has not been applied and must receive the
infrastructure change before deploying backend code that depends on the
container. The B1 focused suite (34 tests) and build were reported passing;
Cosmos Emulator contract tests remain **UNVERIFIED** because no emulator was
available. No remote inventory was performed for legacy `users` or
`nutritionProfiles` records, so their existence and contents are unknown.

`aiInsights` is the existing `/userId`-partitioned container for Daily Insight
documents (`_docType: 'dailyInsight'`), Weekly Insight documents
(`_docType: 'weeklyInsight'`), and durable negative-feedback snapshots
(`_docType: 'insightFeedback'`). Repository reads filter these discriminators;
the container is not a separate feedback API surface.

Profile deletion stores its renewable concurrency lease in this same
container as `_docType: 'profileDeletionLock'`, scoped to the verified user
partition. The lease has a five-minute TTL and expiry, is renewed while the
deletion runs, and is removed on completion; it stores no deletion journal,
progress, or resume state. The user-data sweep excludes the active lease so it
can remain held until cleanup finishes.

The container is configured with `defaultTtl: -1` so Daily and Weekly
documents can use per-document TTL values. Feedback documents deliberately
omit both `ttl` and `expiresAt`, so they are not automatically deleted. They
remain available for later analysis until a manual database cleanup, which is
an operational follow-up outside the feature.

### One-off Daily Insight snapshot migration

The Class 3 rename of the persisted weight trend key is handled by the
one-off script `backend/scripts/migrate-insight-weight-trend.mjs`. It requires
`COSMOS_ENDPOINT` and `COSMOS_KEY` from the operator environment and uses
`COSMOS_DATABASE_ID` when supplied, defaulting to `fittrack-db`. No credential
is embedded in the script or repository.

The script pages through Daily and feedback documents in `aiInsights`, patches
the legacy nested trend key to `inputContext.weight.weeklyTrend30d`, and never
deletes and recreates a document. It preserves IDs, partition keys,
discriminators, Daily `ttl`/`expiresAt`, and feedback fields. Weekly documents
are excluded. Documents without the legacy key are counted as skipped. A
document containing both keys with the same value is also skipped; differing
values are reported as conflicts and are never overwritten.

Each run prints `scanned`, `migrated`, `skipped`, `conflict`, and `failed`
counts. A non-zero `conflict` or `failed` count causes a non-zero process exit;
write failures are reported with their document ID. Resolve every conflict
before considering the run successful. The migration is safe to repeat after
the backend with the new field is deployed: migrated documents become
skipped, and a clean repeat has zero writes.

Infrastructure runs and validates the migration against the Dev Cosmos
environment first, then runs it separately against Alpha after the explicit
Alpha release command. Contract coverage uses only the local Cosmos emulator;
the migration must never target a real account during tests. No Bicep,
container, partition-key, or application dual-read/dual-write change is part
of this migration.

The existing authorized administrative/operational direct-read access may read
feedback snapshots directly from this container. This feature introduces no
new application role, permission model, Admin UI, read endpoint, or cleanup
endpoint; it also grants no implicit database access to normal users or
arbitrary JWT admins.

## Auth Relay Static Web App

Hosts the Android App Link verification file and the HTTPS redirect relay pages
used by the mobile sign-in flow (plan
`docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md`, section 10).

| Item | Value |
|---|---|
| Resource | `swa-fittrack-alpha-ppf5sc` (pattern `swa-${namePrefix}-${uniqueSuffix}`) |
| SKU | Free |
| Region | `westeurope` — the resource group region (`northeurope`) has no Free SWA; the module allows only `centralus`, `eastus2`, `westus2`, `westeurope`, `eastasia` |
| Hostname | `blue-hill-03fb3c103.1.azurestaticapps.net` (also the `staticWebAppHostName` output of `main.bicep`; fixed in `relay.js`) |
| Module settings | `stagingEnvironmentPolicy: Disabled`, `allowConfigFileUpdates: true` |

**Parameters** (`main.bicep`): `deployStaticWebApp` (default `false`) and
`staticWebAppLocation` (default `westeurope`). Only `alpha.bicepparam` sets
`deployStaticWebApp = true`; `dev.bicepparam` does not. The single instance is
shared by Dev and Alpha, separated by path: `/auth/callback/alpha` (package
`com.fittrack.app`) and `/auth/callback/dev` (package `com.fittrack.app.dev`).

### Static content: `infra/static/auth-relay/`

- `index.html`, `auth/relay.js`, `auth/relay.css`
- `auth/callback/alpha.html`, `auth/callback/dev.html` — routed via rewrite
  from `/auth/callback/alpha|dev`
- `.well-known/assetlinks.json`
- `staticwebapp.config.json`

`relay.js` takes the variant and package from static page attributes (never
from the URL), keeps only `code`, `state`, `error`, `error_description` from
the query, clears the query from the address bar via `history.replaceState`,
and redirects to an `intent://` URL targeting the matching package. A
fallback "Zurück zu FitTrack" link appears after 2.5 s if the page is still
visible.

**Deployment.** The Bicep module creates only the resource; content is
deployed separately with the SWA CLI using a deployment token fetched at
deploy time via `az staticwebapp secrets list`. The token is never stored in
files. [Open] The exact SWA CLI command is not recorded in the repository.

### `assetlinks.json`

A JSON array of two `delegate_permission/common.handle_all_urls` statements
(`namespace: android_app`), one per package: `com.fittrack.app` (Alpha) and
`com.fittrack.app.dev` (Dev). Each has one `sha256_cert_fingerprints` entry,
read from the built APK's signing certificate. When keystores change, re-read
the fingerprints non-interactively from the built APKs (e.g. `apksigner verify
--print-certs`) and update the file. [Open] Exact re-read command was not
verified against repository files. Credential rotation or Play App Signing
requires **adding** the new fingerprint to the array (keep the old one while
it is still in use), then redeploying the content.

### `staticwebapp.config.json`

- `/.well-known/assetlinks.json`: `Content-Type: application/json`,
  `Cache-Control: public, max-age=300`
- Callback routes and `/auth/relay.js`: `Cache-Control: no-store`
- Global headers: `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, and a CSP of `default-src 'none';
  script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none';
  base-uri 'none'; form-action 'none'; frame-ancestors 'none'`

### Manual Entra step (not in IaC)

On the existing app registration, under platform "Mobile and desktop
applications", add the redirect URIs
`https://blue-hill-03fb3c103.1.azurestaticapps.net/auth/callback/alpha` and
`.../auth/callback/dev`. The existing `fittrack://auth` URI is kept.

### Logging

SWA access logging and diagnostic settings are not configured in Bicep.
[Open] Whether the platform logs URL query strings (which carry the
authorization `code` and `state`) is unverified.

`infra/static/entra-branding/` (contains `fittrack-signin.css`, a dark theme
stylesheet for Entra External ID sign-in per its header comment) is not part of
this change and is not deployed by `main.bicep`.

## Resource Naming Convention

Pattern: `{type}-{projectName}-{env}-{uniqueSuffix}`

Examples:
- `cosmos-fittrack-dev-ppf5sc`
- `func-fittrack-alpha-ppf5sc`
- `st-fittrack-dev-ppf5sc` (storage)

`uniqueSuffix` defaults to a 6-char hash of the resource group ID, ensuring stable names across re-deploys.

## Environments

| Environment | Purpose | Parameters |
|---|---|---|
| `dev` | Local + CI development | `parameters/dev.bicepparam` |
| `alpha` | Staging integration environment | `parameters/alpha.bicepparam` |
| `staging` | (planned) | — |
| `prod` | (planned) | — |

[Rule] All resources stay in `rg-Michael-Mueller`. Never create new resource groups. Environments are separated by name prefix only.

## Deploy Command

```bash
az deployment group create \
  --resource-group rg-Michael-Mueller \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

## Function App Deploy Workflow

**Context:** The Azure Function App runs on **Linux**. Development happens on **Windows** (PowerShell). This combination has caused repeated deployment failures. Follow the steps below exactly.

### Directory Structure

`_deploy_staging/` is a **separate directory** at the repo root — it is NOT a symlink to `backend/dist/`. It has its own `dist/` folder that must be explicitly synced from `backend/dist/` before every deploy.

```
fittrack-app/
├── backend/
│   └── dist/               ← TypeScript compiler output (tsc outDir)
│       ├── backend/src/     ← compiled backend source
│       └── shared/          ← compiled shared library
└── _deploy_staging/
    ├── dist/               ← SEPARATE copy — must be synced manually before deploy
    ├── host.json
  ├── package.json
  └── package-lock.json
```

**Root cause of missing runtime behaviour on Alpha:** A successful upload does not prove that the package contains the current compiled code, renderer assets, or runtime dependencies. Skipping the clean build, asset copy, or `/MIR` sync can produce a successful deployment with stale or incomplete output. Every release must pass the artifact gates below before publishing.

### Azure Functions runtime

The Function App uses Linux Functions runtime v4 with Node 22 LTS. The Bicep
module pins `linuxFxVersion` to `Node|22` and
`WEBSITE_NODE_DEFAULT_VERSION` to `~22`. Microsoft documents Node 22 as the
last Node version supported on Linux Consumption; newer versions such as Node
24 require Flex Consumption. The general Azure runtime listing can still show
Node 24, but it must not be applied to this Y1 app. See Microsoft's
[supported versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions).

Microsoft lists Node 22 support through **30 April 2027** and Linux
Consumption retirement for **30 September 2028**. The Flex migration must be
planned before the Node 22 support date; the later platform retirement is not
the first deadline.

```powershell
az functionapp list-runtimes --os-type linux -o table
```

After every infrastructure deployment, verify that the deployed Function App
still reports `Node|22`; a successful ARM deployment alone is not a runtime
version check. Moving to Node 24 requires the separate Flex migration workflow,
which creates a new Function App rather than changing this Y1 app in place.

`_deploy_staging/package.json` is a production-only Node 22 manifest. It
contains the backend runtime packages and the renderer packages
`satori ~0.33.4`, `@resvg/resvg-js ~2.6.2`, `lucide-static ~1.46.0`,
`@tabler/icons ~3.46.0`, `sharp ^0.35.5`, and `hyphen ^1.14.1` for German
detail-text hyphenation. `pixelmatch`, TypeScript,
Vitest, and type packages remain in the backend workspace for tests and builds;
they are not installed in production staging. The staging lockfile is generated
from this manifest. The standard Windows-to-Linux release uses the Azure Oryx
remote build, which installs the lockfile dependencies on Linux; do not run
`npm ci` for staging on Windows and do not package Windows-native `sharp` or
Resvg modules.

The manifest overrides `fflate` to `0.7.5`, including Satori's declared `0.7.3`
dependency. The staging lock resolves `satori@0.33.5`, `fflate@0.7.5`,
`form-data@4.0.6`, and `sharp@0.35.5` while keeping the declared Satori range
in its existing `~0.33.4` line. The root workspace lock separately retains
`form-data@2.5.5` under `@azure/ms-rest-js`; that dependency is not part of
the standalone staging graph.

### Instagram renderer package and asset gate

The renderer endpoint uses the backend-owned Blob client for a bounded direct
download of the selected recipe image. It does not expose a SAS URL as part of
the render path, so the deployed Function must retain the existing storage
application setting and must not be replaced by a public image fetch.

The production staging package contains exactly the six renderer runtime
packages listed above. `pixelmatch`, TypeScript, Vitest, and type packages stay
outside the production staging dependency set. The deterministic build step
copies exactly ten renderer assets from
`backend/src/lib/instagramRenderer/assets/` to
`backend/dist/backend/src/lib/instagramRenderer/assets/`; the compiled
renderer resolves them through `__dirname/assets`.

Before any release handoff, `npm run build:verify` must pass, the copy step
must reject missing or unexpected files, and the staged tree must contain both
`_deploy_staging/dist/backend/src/functions/instagramRecipe.js` and the full
asset manifest, including
`_deploy_staging/dist/backend/src/lib/instagramRenderer/assets/fonts/LICENSE.txt`.
The native smoke gate is run with Linux Node 22 x64 dependencies from the
staging lockfile. The standard `--build remote` publish performs this install
on Linux, so Windows-native `sharp` or Resvg modules are never used for the
Azure package.

### Step-by-Step (run from repo root)

```powershell
# 1. Clean build and verification — REQUIRED. Incremental build cache silently
#    omits changes. build:verify also copies and validates the renderer assets.
#    Run from repo root.
Remove-Item -Recurse -Force "backend\dist" -ErrorAction SilentlyContinue
Remove-Item -Force "backend\tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue
cd backend
npm run build:verify
cd ..

# `npm run build:verify` runs the deterministic renderer asset copy from
# backend/src/lib/instagramRenderer/assets/ to
# backend/dist/backend/src/lib/instagramRenderer/assets/.

# 2. Sync build output to _deploy_staging/dist/ using robocopy (mirror).
#    robocopy exit codes 0–7 are all SUCCESS (0=nothing to copy, 1=files copied).
#    Do NOT use Copy-Item — it creates nested folders when target exists.
robocopy "backend\dist" "_deploy_staging\dist" /MIR /NFL /NDL /NJH /NJS

# 3. Verify the compiled handler and the complete renderer asset manifest.
#    Every check must return True. Stop if any check fails.
Test-Path "_deploy_staging\dist\backend\src\functions\specialActivity.js"
Test-Path "_deploy_staging\dist\backend\src\functions\instagramRecipe.js"
Test-Path "_deploy_staging\dist\backend\src\lib\instagramRenderer\assets\fonts\LICENSE.txt"
# For renderer releases, also verify all ten files from the asset manifest.

# 4. Deploy — always from _deploy_staging/, never from backend/.
#    Oryx installs production dependencies on Linux; this is required for
#    native packages such as sharp and @resvg/resvg-js.
cd _deploy_staging
func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript
cd ..
```

### Rules

[Rule] Always deploy from `_deploy_staging/` with `--build remote --javascript`. Never deploy from `backend/` directly.

[Rule] Never use `--no-build` in the normal Windows-to-Linux workflow. It is
only valid when the package explicitly contains Linux-compatible production
`node_modules` and a separate gate has verified those native modules.

[Rule] Always include `--javascript`. The `_deploy_staging/` directory has no `local.settings.json`, so the `func` CLI cannot auto-detect the Node.js worker runtime without this flag.

[Rule] Always delete `backend/dist/` and `backend/tsconfig.tsbuildinfo` before building. Incremental TypeScript build cache silently omits changes — this has caused real production bugs.

[Rule] Always sync with `robocopy /MIR` (step 2) before deploying. `_deploy_staging/dist/` is NOT automatically updated by `tsc`. Skipping this step deploys stale code silently.

[Rule] Verify step 3 before deploying. A successful `func publish` (exit 0) does NOT guarantee the new functions are present — it only confirms the upload succeeded. Only the function list in the output or a `Test-Path` check confirms the sync was complete.

### Post-deploy verification

After every Functions deployment:

1. Confirm the function list contains the changed handler and `health`.
2. Confirm `GET /api/health` returns HTTP 200.
3. Confirm a protected route returns HTTP 401 without a token.
4. For an authenticated feature release, execute the relevant user flow once
  and check Application Insights for new `*.failed` events after the deploy.

The Instagram renderer additionally requires the authenticated
`POST /api/recipes/{id}/instagram-render` smoke flow. A `GET` request to this
route is not a valid renderer check because the route only accepts `POST`.

## Application Settings — Local Dev Credentials

**`backend/local.settings.json`** is the only source of credentials for local development.

This file is gitignored and never committed. It contains all secrets needed to run the backend locally: Cosmos connection, OpenAI key, Document Intelligence key, Auth config.

When an agent needs to run or test the backend locally:
- Check `backend/local.settings.json` for all env var values
- If a required key is missing → inform the user to add it to `local.settings.json`
- Never hardcode keys anywhere else — not in code, not in tests, not in documentation

For Alpha (deployed), all Application Settings are configured directly in the Azure Portal on the Function App — never stored locally.

## Azure OpenAI and Document Intelligence — Shared Services

Both services are **intentionally shared across all environments** (Dev and Alpha). They are stateless — no user data, no environment-specific state.

- Azure OpenAI endpoint: `https://oai-fittrackapp-dev.openai.azure.com/`
- Deployment: `gpt-4o-mini` (version `2024-08-01-preview`)
- Document Intelligence: shared F0/S0 instance

[Rule] Do not create separate OpenAI or Document Intelligence resources per environment. Deduplication is intentional.

See [tech/01-system-overview.md](01-system-overview.md#intentionally-shared-services) for the full rationale.

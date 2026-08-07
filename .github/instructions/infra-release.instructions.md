# FitTrack — Infrastructure & Release Agent Instructions

These instructions apply to the **Infrastructure & Release agent** working with `infra/` and `_deploy_staging/`.

Global rules: [`../.github/copilot-instructions.md`](../copilot-instructions.md)  
Primary reference: [`../docs/kb/tech/07-infrastructure.md`](../../docs/kb/tech/07-infrastructure.md)  
Environment overview: [`../docs/kb/tech/01-system-overview.md`](../../docs/kb/tech/01-system-overview.md)

---

## Scope

### Owns

| Area | Details |
|---|---|
| `infra/` — all Bicep files | Running `az deployment group create`; editing all Bicep modules including `cosmos.bicep` |
| `_deploy_staging/` | Build sync, staging area management |
| Azure Functions deploy workflow | Clean-build → robocopy sync → `func publish` |
| EAS builds | `development` and `preview` profiles |
| Release verification | Post-deploy health check and function list confirmation |
| Rollback assessment | Evaluating failure, describing options, escalating to user |

### Does Not Own

| Area | Owner |
|---|---|
| `backend/src/`, `shared/` — application code | Backend |
| `mobile/src/` — mobile code | Frontend |
| Cosmos document schema and migration logic | Backend |
| `backend/src/lib/cosmos.ts` (CONTAINER_DEFS) | Backend |
| Unit tests, contract tests | QA / Backend |

---

## Authentication Policy

**Azure CLI (`az`):** Before running any `az` command, verify the session is active with `az account show`. If the session is invalid or expired, attempt non-interactive re-authentication (e.g. cached credentials, environment-configured service principal). Escalate to the user only if interactive login is required and cannot be avoided. Do not silently assume a session is active.

**EAS CLI:** Same policy. Check session status with `eas whoami`. Attempt non-interactive re-authentication if possible. Escalate only if interactive login is required.

**If escalation is needed:** Report the exact auth error and stop. One retry after the user resolves the session.

---

## Direct Commands (No Planner or Orchestrator Required)

When the user says any of the following — or a semantically equivalent phrase — execute the documented workflow immediately:

| Command | Meaning |
|---|---|
| `New Dev Build` | Expo Dev Build for local development |
| `New Alpha Build` | Full Alpha release: Backend deploy + Expo Preview Build |
| `Deploy to Alpha` | Deploy existing infrastructure and/or backend changes to Alpha (no Expo Preview Build). |

These commands bypass Planner and Orchestrator entirely. Execute directly.

Invoke Planner only if the request requires an **architectural or infrastructure design decision** (e.g. new environment, new Azure resource type, partition key selection). Operational deploys do not require Planner.

---

## New Dev Build Workflow

1. Run the Dev Build Required assessment (see **Dev Build Required Assessment** below).
2. Report the assessment result.
3. Execute the Dev Build immediately: `eas build --profile development --platform android` from `mobile/`.

`New Dev Build` is an explicit build request. The assessment is informational — it does not gate execution. EAS build quota is preserved by never triggering a Dev Build automatically in any other workflow.

---

## New Alpha Build Workflow

Execute phases strictly in order. Each phase must succeed before the next starts.

### Phase 1 — Infrastructure (only if Bicep changes exist)

Check whether `infra/` contains changes not yet applied to Alpha (git diff or user confirmation). If yes:

```powershell
az deployment group create `
  --resource-group rg-Michael-Mueller `
  --template-file infra/main.bicep `
  --parameters infra/parameters/alpha.bicepparam
```

Verify the deployment succeeded (exit code 0, no ARM error in output). If it fails: **stop**. Do not proceed to Phase 2.

### Phase 2 — Backend Deploy (only if backend code changes exist)

```powershell
# 1. Clean build — required; incremental cache silently omits changes
Remove-Item -Recurse -Force "backend\dist" -ErrorAction SilentlyContinue
Remove-Item -Force "backend\tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue

# 2. Compile
cd backend
npx tsc --project tsconfig.json
cd ..

# 3. Sync to _deploy_staging — use robocopy /MIR, never Copy-Item
robocopy "backend\dist" "_deploy_staging\dist" /MIR /NFL /NDL /NJH /NJS

# 4. Verify sync — replace with most recently changed function file
Test-Path "_deploy_staging\dist\backend\src\functions\[recently-changed-file].js"
# Must return True — if False, stop; do not deploy stale code

# 5. Deploy
cd _deploy_staging
func azure functionapp publish func-fittrack-alpha-ppf5sc --no-build --javascript
cd ..
```

If `Test-Path` returns False: **stop**. Deploying stale code is worse than not deploying.  
If `func publish` fails: **stop**. Report the error.

### Phase 3 — Mobile Build (does not block Phases 1–2)

```powershell
cd mobile
eas build --profile preview --platform android --non-interactive
```

Phase 3 runs after Phase 2 completes. An EAS Preview Build failure makes the Alpha Release **partially successful**: the backend deployment stands and is the authoritative release state. The mobile build must be retried separately. Report Phase 3 failure clearly in the Release Report.

### Phase 4 — Release Verification

Run the health check (see **Health Check** below). Report the full Release Report.

---

## Deploy to Alpha Workflow

`Deploy to Alpha` deploys existing infrastructure and/or backend changes to Alpha. It does **not** create an Expo Preview Build. Trigger a Preview Build only when the user explicitly requests it alongside this command.

Determine which phases apply based on what has changed:
- Bicep changes only → Phase 1 only
- Backend code changes only → Phase 2 + Phase 4
- Both → Phase 1 → Phase 2 → Phase 4

Never trigger a Phase 3 (EAS build) for "Deploy to Alpha" unless explicitly requested.

---

## Dev Infrastructure — Auto-Apply Policy

When Backend provides a container spec as a handoff, apply the resulting Bicep change to Dev automatically — no additional user confirmation required.

**Scope:** Additive changes only (new container, new resource). Changes that modify existing resources (throughput, SKU, App Settings) require user confirmation before applying.

### New Cosmos Container from Backend Handoff

When Backend outputs a container spec (name + partitionKey + indexPolicyNote), this agent writes the Bicep resource block in `infra/modules/cosmos.bicep` following the conventions of existing containers, then auto-applies to Dev:

```bicep
resource myNewContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: 'myNewContainer'
  parent: database
  properties: {
    resource: {
      id: 'myNewContainer'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}
```

Add the container to both `dev.bicepparam` and `alpha.bicepparam` if the configuration differs between environments (rare — most containers are identical).

Dev auto-apply command:
```powershell
az deployment group create `
  --resource-group rg-Michael-Mueller `
  --template-file infra/main.bicep `
  --parameters infra/parameters/dev.bicepparam
```

**Alpha is never auto-applied.** Every Alpha change requires an explicit user request.

---

## Health Check

FitTrack has no dedicated `/api/health` endpoint (as of current implementation). Use the following interim check after every Azure Functions deployment:

```powershell
$response = Invoke-WebRequest `
  -Uri "https://func-fittrack-alpha-ppf5sc.azurewebsites.net/api/diary/meals" `
  -UseBasicParsing `
  -ErrorAction SilentlyContinue
Write-Host "Health check: $($response.StatusCode)"
```

**Pass condition:** HTTP 401. A 401 confirms the function app is running, the handler is registered, and the auth middleware is active.  
**Fail condition:** HTTP 5xx, connection refused, or timeout.

A 404 is ambiguous — it may indicate the route is not registered. Treat 404 as a warning; include it in the report and ask the user to verify.

> Note: A dedicated `GET /api/health` (public, no auth required) should be added as a future Backend work package. It will replace this interim check when available.

---

## Dev Build Required Assessment

Run this assessment whenever mobile changes are present (as part of a broader workflow) or when the user asks about build status.

**Dev Build Required: YES if any of the following changed:**

| File / Directory | Why |
|---|---|
| `mobile/app.config.js` or `app.json` | Native configuration — affects compiled native layer |
| `android/` or `ios/` | Direct native code change |
| `mobile/package.json` (native package added/updated) | New native module may require re-link |
| `mobile/eas.json` | Build profile change |

**Dev Build Required: NO if only these changed:**
- `mobile/src/**` (TypeScript / React Native JS code only)
- Assets (`mobile/assets/`)
- Environment variables (`.env`, no native config change)
- `metro.config.js` (bundler config — does not require native rebuild)

Report the assessment as `Dev Build Required: YES | NO` with the specific trigger if YES.

**Never create a Dev Build automatically.** Report the assessment; build only on explicit user request.

---

## Cosmos Emulator

Start `scripts/start-cosmos-emulator.ps1` only when:
- Contract tests are explicitly part of the requested workflow
- Local Cosmos verification is explicitly required

Do not start the emulator proactively as part of a standard build or deploy.

---

## Stop Conditions

| Condition | Action |
|---|---|
| `az deployment` fails | Stop. Do not proceed to backend deploy. Report the ARM error. |
| TypeScript compile errors | Stop. Do not sync or deploy. Report the compiler output. |
| `Test-Path` after robocopy = False | Stop. Sync failed — deploying stale code is worse than not deploying. |
| `func publish` fails | Stop. Describe rollback options (previous version remains active on Azure). |
| Health check returns 5xx | Report as deployment failure. Azure keeps last successful version active. |
| Auth error (az or eas) | Stop. Report the exact error. Do not retry automatically. |

---

## Task Package Workflow

When called from the Orchestrator with a Task Package:
- Follow the declared Goal, Required Repository Context, and Stop Conditions exactly
- Do not supplement the package with independent analysis
- If a declared step fails and cannot be resolved automatically, report to the Orchestrator and stop — do not coordinate directly with Backend or Frontend

When called directly by the user (direct command):
- Execute the documented workflow
- If a step fails: report it clearly, describe the next action, and wait for user direction

---

## Release Report (Required After Every Workflow)

Always produce this report at the end of every workflow execution, regardless of scope:

```
── FitTrack Release Report ──────────────────────────────
Dev Build Required:          YES | NO   [trigger if YES]
Dev infrastructure applied:  YES | NO | N/A
─────────────────────────────────────────────────────────
Azure Functions deployed:    YES | NO | N/A
Health check:                PASS | FAIL | N/A  [HTTP status]
─────────────────────────────────────────────────────────
Alpha infrastructure applied: YES | NO | N/A
Expo Dev Build created:       YES | NO | N/A
Expo Alpha Build created:     YES | NO | N/A
─────────────────────────────────────────────────────────
Notes: [any warnings, skipped steps, or items requiring follow-up]
```

N/A = step was not part of this workflow.

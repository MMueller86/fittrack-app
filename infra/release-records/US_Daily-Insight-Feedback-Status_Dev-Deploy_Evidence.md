# US Daily Insight Feedback Status - Dev Deploy Evidence

- RecordedAtUtc: 2026-08-21T09:24:51.3024694Z
- OperatorMode: Infrastructure and Release
- TargetEnvironment: dev
- TargetFunctionApp: func-fittrack-dev-ppf5sc

## Scope Guard

- This subtask executed a Development backend deploy only.
- No Alpha deployment command was executed.
- No Alpha data mutation command was executed.

## Required Context Verification

- Deployment staging source used: _deploy_staging/
- Compiled backend artifact source used: backend/dist/
- Host configuration validated from backend/host.json before deploy.

## Deployment Evidence (Dev Only)

### Pre-check

- Command: az account show
- Result: success; active Azure session confirmed for subscription `Microsoft Azure Sponsorship 26/27-1`.

### Dev target discovery

- Command: az functionapp list --resource-group rg-Michael-Mueller --query "[?contains(name, 'func-fittrack-dev')].name" -o tsv
- Result: `func-fittrack-dev-ppf5sc`

### Clean build, sync, and publish

- Deploy start (local timestamp): `2026-08-21T11:20:33.1142171+02:00`
- Deploy end (local timestamp): `2026-08-21T11:24:32.0252630+02:00`
- Commands executed:
  - Remove-Item -Recurse -Force backend/dist
  - Remove-Item -Force backend/tsconfig.tsbuildinfo
  - npx tsc --project tsconfig.json (from backend/)
  - robocopy backend/dist _deploy_staging/dist /MIR /NFL /NDL /NJH /NJS
  - Test-Path _deploy_staging/dist/backend/src/functions/dailyInsightFeedback.js
  - func azure functionapp publish func-fittrack-dev-ppf5sc --no-build --javascript (from _deploy_staging/)

### Exit and verification signals

- Build step (`npx tsc`): success (no non-zero exit observed)
- Robocopy exit: `1` (success class; files copied)
- Sync verification: `SYNC_CHECK_DAILY_INSIGHT_FEEDBACK_JS=True`
- Function publish exit: `FUNC_PUBLISH_EXIT=0`
- Publish output contained:
  - `Deployment completed successfully.`
  - `Functions in func-fittrack-dev-ppf5sc:`
  - `daily-insight-feedback-status - [httpTrigger]`
  - `Invoke url: https://func-fittrack-dev-ppf5sc.azurewebsites.net/api/ai/daily-insight/feedback/status`

## Endpoint Presence Confirmation

- Compiled artifact check (local): backend/dist/backend/src/functions/dailyInsightFeedback.js contains route `ai/daily-insight/feedback/status`.
- Deployed trigger list check (remote): `daily-insight-feedback-status` function is registered in Dev after publish.

## Post-Deploy Health Check (Dev)

- Command: Invoke-WebRequest https://func-fittrack-dev-ppf5sc.azurewebsites.net/api/diary/meals
- Observed status: `401`
- Interpretation: pass (app reachable; auth middleware active).

## Acceptance Mapping

- AC-15: Satisfied for Development deployment evidence.
- Automatic Alpha deployment: not performed.

## UNVERIFIED

- None.

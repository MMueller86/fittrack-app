# US Daily Insight Feedback Status - Alpha Deploy and Closure Evidence

- RecordedAtUtc: 2026-08-21T10:03:52.2336211Z
- OperatorMode: Infrastructure and Release
- TargetEnvironment: alpha
- Outcome: SUCCESS
- EvidenceStatus: VERIFIED
- MutationStatus: UPDATED
- Prior blocked evidence preserved: `infra/release-records/US_Daily-Insight-Feedback-Status_Alpha-Closure_Evidence.md`

## Exact Target Scope

- Resource group: `rg-Michael-Mueller`
- Alpha Function App: `func-fittrack-alpha-ppf5sc`
- Cosmos database: `fittrack-db`
- Cosmos container: `aiInsights`
- Cosmos partition key field: `userId`
- Exact `userId`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ`
- Exact `id` / `feedbackId`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ:feedback:563fb0da-9034-4497-a126-de9d1910bac0`
- Required `_docType`: `insightFeedback`
- Approved mutation: `processingStatus = 'Done'`

## Release Gate and Local Artifact

- Approved plan: `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Status_Operations.md`
- Dev deployment evidence: `infra/release-records/US_Daily-Insight-Feedback-Status_Dev-Deploy_Evidence.md`
- Prior Alpha inspection evidence: `infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md`
- Alpha gate: opened by the explicit user command `Deploy to Alpha`.
- Backend changes present: Yes.
- Infrastructure/Bicep changes present: No; Alpha infrastructure deployment was not applicable.
- Host configuration checked: `backend/host.json`.
- Clean build commands:
  - `Remove-Item -Recurse -Force backend\dist -ErrorAction SilentlyContinue`
  - `Remove-Item -Force backend\tsconfig.tsbuildinfo -ErrorAction SilentlyContinue`
  - `npx tsc --project tsconfig.json` from `backend/`
  - `robocopy backend\dist _deploy_staging\dist /MIR /NFL /NDL /NJH /NJS`
- Build result: TypeScript exit `0`.
- Robocopy result: exit `1`, successful file-copy class.
- Staging verification: `Test-Path _deploy_staging\dist\backend\src\functions\dailyInsightFeedback.js` returned `True`.
- No Expo build was run.

## Alpha Deployment

- Azure authentication checks: `az account show` succeeded before each Azure CLI operation; active subscription was confirmed enabled.
- Alpha settings retrieval: `az functionapp config appsettings list --resource-group rg-Michael-Mueller --name func-fittrack-alpha-ppf5sc`; required Cosmos settings were present, and no secret values were recorded.
- Publish command: `func azure functionapp publish func-fittrack-alpha-ppf5sc --no-build --javascript` from `_deploy_staging/`.
- Publish start signal: `2026-08-21T09:57:25.363Z`.
- Publish completion signal: `Deployment completed successfully.`
- Trigger sync signal: `2026-08-21T10:01:13.069Z`.
- Publish result: `FUNC_PUBLISH_EXIT=0`.
- Required trigger present after publish: `daily-insight-feedback-status` at `/api/ai/daily-insight/feedback/status`.

## Alpha Health Check

- Command: `Invoke-WebRequest -Uri https://func-fittrack-alpha-ppf5sc.azurewebsites.net/api/diary/meals -UseBasicParsing`
- Observed HTTP status: `401`.
- Result: PASS. The Alpha app was reachable and authentication middleware was active.

## Exact-Target Pre-check

- Access path: controlled Cosmos SDK fallback using Alpha Function App settings; no authorized CIAM Admin bearer session was available for the deployed status endpoint.
- Operation: point read only through `aiInsights.item(exactId, exactUserId).read()`; no query or broad scan was issued.
- Pre-check timestamp: `2026-08-21T10:03:25.510Z`.
- Target found: `True`.
- Exact id match: `True`.
- Exact userId/partition match: `True`.
- `_docType` match: `True`.
- Raw `processingStatus`: undefined.
- Effective current status under the approved legacy compatibility rule: `Open`.
- Status value recognized: `True`.

## Mutation

- Mutation timestamp: `2026-08-21T10:03:36.973Z`.
- Conditional point operation: set only `/processingStatus` to `Done` on the exact partition/id.
- Write condition: exact document discriminator `insightFeedback` and current status undefined or `Open`.
- Mutation result: `UPDATED`.
- Mutated fields: `processingStatus` only.
- No other document, partition, or field was changed.

## Post-check

- Post-check timestamp: `2026-08-21T10:03:43.314Z`.
- Exact partition/id read: found.
- Exact id match: `True`.
- Exact userId/partition match: `True`.
- `_docType`: `insightFeedback`.
- Persisted `processingStatus`: `Done`.
- Post-check result: `POSTCHECK_PASS=True`.

## Sanitization and Scope Statement

- No secrets, tokens, connection strings, raw credentials, or raw document contents are included in this record.
- No broad Cosmos query or update was issued.
- No application source, tests, mobile files, plans, or `docs/qa/findings.md` files were changed by this release workflow.
- The earlier blocked evidence record remains unchanged to preserve its historical gate outcome.
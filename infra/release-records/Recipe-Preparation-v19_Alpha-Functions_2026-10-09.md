# Alpha Azure Functions Deployment - Recipe Preparation v19

Date: 2026-10-09
Authorization: Explicit user request to deploy Azure Functions after notification of the existing QA FAIL. Deployment execution is not feature acceptance.
Target: func-fittrack-alpha-ppf5sc in rg-Michael-Mueller
Deployment completed: 2026-10-09T13:45:57.215Z (trigger synchronization started)

## Release Report

| Field | Result |
|---|---|
| Dev Build Required | NO; backend-only changes |
| Dev infrastructure applied | N/A |
| Azure Functions deployed | YES |
| Health check | PASS; public /api/health HTTP200, protected /api/diary/meals HTTP401 |
| Alpha infrastructure applied | N/A |
| Expo Dev Build created | N/A |
| Expo Alpha Build created | N/A |

## Executed Workflow

- Azure CLI session active; subscription enabled. Alpha Linux runtime verified as Node|22.
- Generated backend/dist and backend/tsconfig.tsbuildinfo cleaned. npm run build:verify passed: compilation, ten renderer assets, module resolution and duplicate Function IDs.
- Current dirty working-tree production code was compiled; no source rollback, commit, branch or application-code edit performed. Test-only and documentation files are not runtime changes.
- robocopy backend/dist _deploy_staging/dist /MIR succeeded with exit1. All336 staged artifacts byte-match the build. Required recipe handler, provider, validator and Preparation v4 prompt present; all ten renderer assets present.
- Staging production dependencies and npm lockfile versions match the backend runtime manifest. No local.settings.json or Windows node_modules staged.
- Published from _deploy_staging using func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript. Oryx remote Linux build and publish succeeded with Node22.23.2; triggers synchronized.
- Deployment function list includes health, recipes-prepare-export-view, recipe-analyze, recipes-render-instagram and recipes-share-bundle.
- Post-deploy unauthenticated HTTP probes: public health200 and protected diary401.

## Warnings And Verification Limits

- [Independent v19 QA](../../docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) remains FAIL. Known reference and cooking-semantic failures were not repaired by this deployment. No overall feature or release-quality PASS is claimed.
- Remote npm install reported four vulnerabilities (two moderate, two high). No audit repair or dependency change was authorized or performed.
- Remote npm12.2.0 reported blocked install scripts for sharp0.34.5. Publish and host checks succeeded, but native renderer behavior has not been proven by these HTTP probes.
- Authenticated recipe Preparation/renderer/Share smoke and post-flow Application Insights review were not performed: no authorized authenticated recipe test context was supplied. Run the intended user flow in the existing authenticated app and inspect failures before treating it as end-to-end verified.
- Documentation divergence: role instructions still describe no dedicated health endpoint; the deployed function list and observed HTTP200 confirm health exists. Both the public health and the protected401 check were executed. No unrelated KB correction included.
- No Cosmos migration, infrastructure application, EAS build or private recipe/provider payload capture.

## Local Verification Issues

Terminal output initially omitted some multiline PowerShell command output; direct npm.cmd execution supplied the complete successful build result. A Node -e artifact check failed due Windows quotation forwarding, then PowerShell5.1 rejected the empty npm-lockfile root key. The final read-only Node parser/byte comparison passed. These were local verification-wrapper issues, not publish failures; only one publish was executed.
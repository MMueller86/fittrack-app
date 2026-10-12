# Alpha Azure Functions Deployment - Recipe Step Overflow Logging

Date: 2026-10-09
Authorization: Explicit user request to redeploy Alpha Functions.
Target: func-fittrack-alpha-ppf5sc in rg-Michael-Mueller
Trigger synchronization started: 2026-10-09T14:12:47.279Z
Deployment ID: 71ce64a9-9065-4fef-be06-e296ac91b644
Oryx build operation: f7f4f595a182c13b

## Release Report

| Field | Result |
|---|---|
| Dev Build Required | NO; backend-only release |
| Dev infrastructure applied | N/A |
| Azure Functions deployed | YES |
| Health check | PASS; public /api/health HTTP200, protected /api/diary/meals HTTP401 |
| Alpha infrastructure applied | N/A |
| Expo Dev Build created | N/A |
| Expo Alpha Build created | N/A |

## Executed Workflow

- Azure CLI session active; subscription enabled. Target runtime verified as Node|22.
- Generated backend/dist and backend/tsconfig.tsbuildinfo cleaned. Build verification passed compilation, ten renderer assets, module resolution and duplicate Function ID checks. Direct verification was repeated because initial multiline terminal output was incomplete.
- Current working-tree backend compiled without application-code edits, rollback, commit or branch creation. The preceding implementation verification reported 1439 passing backend unit tests.
- robocopy backend/dist _deploy_staging/dist /MIR succeeded with exit1. All336 staged files byte-match the build; all ten renderer assets are present.
- Compiled instagramRecipe handler contains step_text, step_count, step_layout, step_text_length, step_longest_word_length and step_explicit_line_breaks. The targeted overflow diagnostics are now included in the deployed artifact.
- Staging production dependency manifest matches backend runtime dependency versions and the staging lockfile. No local.settings.json or Windows node_modules staged.
- Published once from _deploy_staging using func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript. Linux remote build succeeded with Node22.23.2 and npm12.2.0; triggers synchronized.
- Published function list includes health, recipes-share-bundle, recipes-render-instagram and recipes-prepare-export-view.
- Post-deploy unauthenticated HTTP probes passed: public health200 and protected diary401.

## Warnings And Verification Limits

- The existing v19 QA FAIL remains unchanged. Deployment does not constitute feature acceptance or fix the underlying recipe step overflow.
- Remote npm install reported four vulnerabilities: two moderate and two high. No dependency remediation was performed.
- npm reported blocked install scripts for sharp0.34.5. Publish and host checks succeeded, but these checks do not prove native renderer behavior.
- No authenticated recipe-render/share smoke or resulting Application Insights review was performed because no authenticated user test context was supplied. Reproduce the share operation in the existing signed-in app to verify the failure event and new text diagnostics end to end.
- Role instructions still describe no public health endpoint; the infrastructure KB, published function list and observed HTTP200 confirm it exists. Both public health and protected401 checks were executed.
- No Bicep deployment, Cosmos migration, EAS build, Application Settings change or private recipe payload retrieval was performed.
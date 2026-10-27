# New Alpha on Flex Consumption (subscription Fittrack) - Migration Record

Date: 2026-10-26
Authorization: Explicit user approval of `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (rev 2026-10-26-NEWSUB-07) and `docs/User Stories/plans/PLAN_Alpha-Datenmigration.md`.
Target: func-fittrack-alpha-wcobsd in rg-fittrack-alpha (subscription Fittrack dd7539ab-c638-44f8-9173-8bcd28cdbae3, germanywestcentral)

## Release Report

| Field | Result |
|---|---|
| Dev Build Required | YES for eas.json change; no Dev Build triggered |
| Dev infrastructure applied | N/A |
| Azure Functions deployed | YES (79 functions) |
| Health check | PASS; /api/health HTTP200, protected /api/diary/meals HTTP401 |
| Alpha infrastructure applied | YES (new resource group rg-fittrack-alpha) |
| Expo Dev Build created | N/A |
| Expo Alpha Build created | YES; build 27151b55-14b4-46bf-94ae-930b8f9c279d (profile was preview-flex, now the renamed profile preview) |

## Resources

- Cosmos `cosmos-fittrack-alpha-wcobsd` (serverless, `fittrack-db`, 12 containers)
- Storage `stfittrackalphawcobsd` (`recipe-images`, `label-scans`, `product-images`, deployment container, queue `reusable-items-enrich`)
- Function App `func-fittrack-alpha-wcobsd` on plan `asp-fittrack-alpha` (FC1, Node 24, maximum instances 5, Always Ready 0, 2048 MB)
- Log Analytics `log-fittrack-alpha`, Application Insights `appi-fittrack-alpha`
- Shared with Dev: Azure OpenAI `oai-fittrack-dev` (`gpt-4.1-mini`, GlobalStandard), Document Intelligence `di-fittrack-dev-hlpqe7`

## Data

- Catalog seed `foodProducts`: 209696 documents copied read-only from Dev; 20 samples identical.
- User data copied once from the legacy Alpha: profiles 3, weights 97, nutritionDiaryMeals 449, reusableMealItems 1, recipes 14, aiUsage 36, userFoodRelations 316, aiInsights 5 (`insightFeedback` only), `recipe-images` 13 blobs / 9492935 bytes. Details: `docs/qa/reports/PLAN_Alpha-Datenmigration.md`.
- The legacy Alpha (rg-Michael-Mueller) stays unchanged as a backup and is no longer deployed to.

## Fingerprint

- Source commit 1fb36a8ee8e9c869a7e9ede534e927fb0c542329 with uncommitted changes
- package-lock.json SHA256 A80F601AF4EB663A729B8A640CACF055F92E69B08A947DDD9B9AC449CC60D55F
- _deploy_staging/dist SHA256 AE0984B8C85C55D43489D47EAE6996E8AC47DD0C6DC9237C2D845321822763F1

## Verification

- QA reports: `docs/qa/reports/PLAN_Node24-Flex-Migration.md` (PASS WITH ISSUES), `docs/qa/reports/PLAN_Alpha-Datenmigration.md` (PASS).
- Known gap: the auth relay Static Web App `swa-fittrack-alpha-ppf5sc` remains in the legacy PRODYNA subscription until its own migration.

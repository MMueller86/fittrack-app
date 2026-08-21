# US Home Screen Insights Weight Trend Rename - Dev Evidence Record

- RecordedAtUtc: 2026-08-21T08:51:01.865Z
- OperatorMode: Infrastructure and Release
- EvidenceType: Sanitized durable operational evidence

## Alpha Daily Insight Feedback Inspection (AC-11)

### Authorized access path
- Azure session validated via `az account show` (active subscription and tenant).
- Alpha app settings read from Function App `func-fittrack-alpha-ppf5sc` in resource group `rg-Michael-Mueller`.
- Cosmos target identifiers:
  - endpointHost: `cosmos-fittrack-alpha-ppf5sc.documents.azure.com`
  - databaseId: `fittrack-db`
  - container: `users`
  - container: `aiInsights`

### Query scope
- Target email: `michi01mueller@googlemail.com`
- User lookup fields queried in `users` container:
  - `id`
  - `email`
  - `normalizedEmail`
  - `signInEmail`
  - `authEmail`
- Feedback lookup filter in `aiInsights` container:
  - `_docType = 'insightFeedback'`
- Feedback projection fields:
  - `id`
  - `userId`
  - `date`
  - `createdAt`
  - `_ts`

### Findings
- `usersCount = 0`
- `targetedUserFieldMatchCount = 0`
- `matchedUserIds = []`
- `feedbackCount = 1`
- Latest feedback document projection:
  - `id`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ:feedback:563fb0da-9034-4497-a126-de9d1910bac0`
  - `userId`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ`
  - `date`: `2026-08-21`
  - `_ts`: `1787267407`

### Outcome
- `UNVERIFIED` for user-specific feedback ownership of `michi01mueller@googlemail.com`.
- Concrete limitation: in the inspected Alpha dataset, `users` contains zero documents and therefore no authoritative email-to-userId mapping is available to correlate the opaque feedback `userId` value to the requested email.

### Manual user confirmation (post-query; provenance-preserving)
- confirmedAtUtc: `2026-08-21T09:04:05.5454186Z`
- confirmationSource: explicit user statement in this session — "Das Feedback können wir als Erfolgreich behandelt sehen und dokumentieren."
- interpretation: the requested Alpha feedback association/status is manually accepted as successful based on user confirmation.
- evidence-boundary: this manual acceptance does not alter the direct-query facts above (`usersCount=0`, no technical email-to-userId mapping, `feedbackCount=1`); it is an explicit non-technical validation decision.
- acceptedStatus: `SUCCESS (manual/user-confirmed)`
- alphaMutationStatus: no Alpha deployment and no Alpha data mutation were performed for this evidence update.

## Dev Migration Evidence (AC-12, AC-13)

### Migration utility
- Script: `backend/scripts/migrate-insight-weight-trend.mjs`
- Dev target identifiers:
  - endpointHost: `cosmos-fittrack-dev-ppf5sc.documents.azure.com`
  - databaseId: `fittrack-db`
  - container: `aiInsights`

### First run
- startedUtc: `2026-08-21T08:50:44.0457948Z`
- endedUtc: `2026-08-21T08:50:45.3568965Z`
- exitCode: `0`
- observed output:
  - `Migration counts: scanned=26 migrated=0 skipped=26 conflict=0 failed=0`

### Immediate repeat run
- startedUtc: `2026-08-21T08:50:45.3568965Z`
- endedUtc: `2026-08-21T08:50:46.3414246Z`
- exitCode: `0`
- observed output:
  - `Migration counts: scanned=26 migrated=0 skipped=26 conflict=0 failed=0`

## Data integrity statement
- All counts and outcomes above are direct command observations captured during this session.
- No counts or results were inferred or invented.

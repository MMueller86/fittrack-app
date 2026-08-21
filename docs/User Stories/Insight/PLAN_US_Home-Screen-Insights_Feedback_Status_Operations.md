# PLAN - Daily Insight Feedback Processing Status and Operational Closure

**User Story Context:** `US_Home-Screen-Insights_Feedback_Review.md` (follow-up operational hardening)  
**Planner:** FitTrack Planner  
**Date:** 2026-08-21  
**Status:** Revised Draft - PO-1 resolved, pending fresh approval  
**Classification:** Accept as proposed (implementation-ready)
**Infrastructure Impact: Alpha**  
**Mobile Build Impact: None**

## Product Owner Decisions (Resolved)

**PO-1 (Resolved by Product Owner): `Done` and `Rejected` are terminal states in v1.**

Decision details:
- Terminal states may not be reopened or retargeted in v1.
- Repeating a write with the same already-persisted state is allowed as an idempotent no-op.
- A transition from `Done -> Rejected`, `Rejected -> Done`, or either terminal state back to `Open` must be rejected.

## 1. Requirement Assessment

- User problem: feedback snapshots are durable and currently lack a persisted handling lifecycle marker, so operational searches repeatedly return already-processed records.
- Solution fit: adding a persisted processing status to each `insightFeedback` document directly addresses repeat-processing risk without changing existing mobile feedback UX.
- Product alignment: consistent with existing architecture where operational/admin direct-read access exists and backend owns authorization.
- Security alignment: no secrets in source/docs; no mobile secret exposure; no unbounded admin access.
- Cross-feature impact: none on weight-trend rename contract or daily insight generation contract.

## 2. Feature Summary

Introduce a persisted processing status on Daily Insight feedback documents and a controlled operational write path so feedback can be marked handled (`Done`) or explicitly dismissed (`Rejected`). Define unresolved search filters so handled records are excluded by default. Execute one explicit Alpha mutation for the known feedback document only after approval and authorization.

## 3. Current Behaviour

- Feedback documents are stored as `_docType: 'insightFeedback'` in container `aiInsights` partitioned by `/userId`.
- Documents are durable (no `ttl`/`expiresAt`) and can be found repeatedly by administrative queries.
- There is no persisted processing/review lifecycle field.
- Existing API `POST /api/ai/daily-insight/feedback` creates snapshots and supports idempotency by `submissionId`.
- Existing evidence record confirms one Alpha feedback document and manual user confirmation, but no Alpha data mutation was performed.

## 4. Desired Behaviour

- Each `insightFeedback` document has a persisted operational processing state.
- Operational searches for actionable items exclude already handled feedback by default.
- A secured backend operational write path updates status with strict scope and authorization.
- The concrete Alpha feedback document is set to `Done` through the approved operational path, not by documentation-only confirmation.

## 5. Scope

- Shared/backend type extension for feedback processing status.
- Backend repository updates for read compatibility and status update method.
- Authenticated admin/operational status update endpoint.
- Operational query contract for unresolved-only search.
- One explicit Alpha status update for the known document after gate.
- Tests for validation, authorization, idempotency/concurrency, legacy compatibility, and concrete Done update flow.

## 6. Out of Scope

- No mobile UI changes.
- No new end-user feedback read endpoint.
- No broad admin data browsing endpoint.
- No changes to weight-trend rename behavior or contracts.
- No automatic Alpha deployment or automatic Alpha mutation.

## 7. Canonical Status Model

**Canonical field name:** `processingStatus`  
Rationale: avoids collision with existing `response.status`, `feedbackScore`, and generic `status` fields used elsewhere.

**Allowed persisted values (enum):**
- `Open`
- `Done`
- `Rejected`

**Initial state decision:** required and explicit: `Open` is the initial/unresolved state.

**Legacy compatibility rule:** existing documents without `processingStatus` are treated as `Open` by read/search logic.

**Semantics:**
- `Open`: unhandled feedback requiring operational triage.
- `Done`: reviewed and successfully handled.
- `Rejected`: reviewed and not accepted for action (invalid/non-actionable/out-of-scope).

**Terminal-state transition rules (v1):**
- Allowed: `Open -> Done`, `Open -> Rejected`.
- Allowed idempotent no-op: `Open -> Open`, `Done -> Done`, `Rejected -> Rejected`.
- Rejected transitions: `Done -> Rejected`, `Rejected -> Done`, `Done -> Open`, `Rejected -> Open`.

## 8. Operational Search Rules

Default unresolved search predicate (Cosmos SQL pattern):

```sql
SELECT * FROM c
WHERE c._docType = 'insightFeedback'
  AND (
    NOT IS_DEFINED(c.processingStatus)
    OR c.processingStatus = 'Open'
  )
```

Handled-only search predicate:

```sql
SELECT * FROM c
WHERE c._docType = 'insightFeedback'
  AND IS_DEFINED(c.processingStatus)
  AND c.processingStatus IN ('Done', 'Rejected')
```

This preserves backward compatibility and prevents legacy documents from being skipped unintentionally.

## 9. Write Path Assessment

### Option A - Authenticated Backend Operational Endpoint (Recommended Primary)

- Add a dedicated authenticated endpoint for status update (PATCH semantics).
- Require `requireUser()` plus explicit admin authorization (`isAdmin === true` from validated Entra role claim).
- Input must include exact `userId`, `feedbackId`, and target status.
- Endpoint must verify document identity and discriminator (`_docType: 'insightFeedback'`) before patching.
- Endpoint must return deterministic outcomes for idempotent same-state writes and conflicts.

### Option B - Controlled One-off Operational Script (Recommended Secondary/Fallback)

- Narrow script for approved one-off mutation with exact target identifiers.
- Uses environment credentials only (no hardcoded secrets).
- Enforces same validations as endpoint path: target exists, partition/id match, doc type matches.

### Decision

- Plan includes **both**: endpoint for durable governance and script as fallback for time-critical operational correction.
- Script execution remains gated and explicit; it is not a replacement for the governed endpoint path.

## 10. Persistence Impact

**Persistence Impact:** additive optional field on existing `InsightFeedbackDocument` (`processingStatus`) with read default `Open` for missing field - **Class 1 (read compatibility)** under `cosmos-data-model-and-migration`.

- Container change required: **No** (reuse existing `aiInsights`).
- Partition key change required: **No** (keep `/userId`).
- `backend/src/lib/cosmos.ts` `CONTAINER_DEFS` change required: **No**.
- `infra/modules/cosmos.bicep` change required: **No**.
- Index policy change required: **No** (point updates and discriminator/status filters supported by default indexing).
- Explicit migration script required for baseline compatibility: **No**.
- Backward compatibility: legacy feedback docs without field remain queryable and treated as `Open`.

## 11. Confirmed Facts

- Prior evidence record: `infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md`.
- Known Alpha feedback identity from evidence:
  - `userId`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ`
  - `id`: `TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ:feedback:563fb0da-9034-4497-a126-de9d1910bac0`
  - `date`: `2026-08-21`
- Prior outcome was manual confirmation only; Alpha data was not mutated.

## 12. Assumptions

- Existing Entra `Admin` app role assignment process is available for authorized operators.
- Operational owner can provide explicit approval for Alpha mutation when release gate is reached.
- Existing direct-read operational access to `aiInsights` remains available for search verification.

## 13. Proposed Technical Solution

1. Extend shared type contract for feedback docs with optional `processingStatus` and status enum.
2. On feedback creation (`POST /api/ai/daily-insight/feedback`), persist `processingStatus: 'Open'`.
3. Add repository helpers:
   - normalize/read helper that treats missing status as `Open`
   - patch/update method for status using exact partition/id and `_docType` guard
4. Add admin-only backend endpoint for status updates.
5. Define deterministic API outcomes:
   - `200` for successful change
   - `200` idempotent no-op when requested status already set
   - `400` invalid payload/status
   - `401`/`403` unauthorized/non-admin
   - `404` exact document not found in specified partition
  - `409` identity/type mismatch or forbidden terminal-state transition
6. Add targeted one-off script for explicit Alpha correction fallback.
7. Execute Alpha `Done` update only after explicit operational approval and credentials.

## 14. Backend Work Package

**Agent:** Backend

**Goal:** Implement persisted feedback processing status model, admin-authorized status write path, and compatibility-safe repository behavior.

### Subtask B1 - Schema and Repository Foundations

**Required Knowledge Base:**
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/07-infrastructure.md

**Required Repository Context:**
- shared/types/insight.ts
- backend/src/functions/dailyInsightFeedback.ts
- backend/src/lib/repositories/insightRepository.ts
- backend/src/lib/repositories/insightRepository.test.ts
- backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-4
- AC-8
- AC-20

**Dependencies:**
- None

**Expected Handoff:**
- Updated shared feedback status type contract
- Repository status read/write compatibility behavior
- Contract-level persistence notes (no migration, no infra schema changes)

### Subtask B2 - Admin Update Endpoint

**Required Knowledge Base:**
- docs/kb/tech/02-backend.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- backend/src/lib/auth.ts
- backend/src/lib/http.ts
- backend/src/functions/dailyInsightFeedback.ts
- backend/src/index.ts
- backend/src/lib/registrations.test.ts

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-5
- AC-6
- AC-7
- AC-9
- AC-20

**Dependencies:**
- Subtask B1 handoff

**Expected Handoff:**
- New admin status-update API handler and route registration
- Request/response validation and authorization behavior

### Subtask B3 - Automated Test Coverage

**Required Knowledge Base:**
- docs/kb/tech/08-testing.md
- docs/kb/tech/02-backend.md

**Required Repository Context:**
- backend/src/functions/dailyInsightFeedback.test.ts
- backend/src/lib/repositories/insightRepository.test.ts
- backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts
- backend/vitest.config.mts
- backend/vitest.contract.config.mts

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-10
- AC-11
- AC-12
- AC-13
- AC-14
- AC-20

**Dependencies:**
- Subtask B1 handoff
- Subtask B2 handoff

**Expected Handoff:**
- Passing unit and contract tests for status model, auth, concurrency/idempotency, legacy compatibility
- Evidence note for concrete known feedback identity test fixture coverage

## 15. Infrastructure and Release Work Package

**Agent:** Infrastructure

**Goal:** Execute deployment and controlled operational mutation steps in strict gate order without broadening environment scope.

### Subtask I1 - Deploy Backend Change to Dev

**Required Knowledge Base:**
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

**Required Repository Context:**
- _deploy_staging/
- backend/dist/
- backend/host.json

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-15

**Dependencies:**
- Backend subtasks B1-B3 complete

**Expected Handoff:**
- Dev deployment evidence for status update surface

### Subtask I2 - Alpha Deploy Gate (No Auto-Run)

**Required Knowledge Base:**
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

**Required Repository Context:**
- infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-16

**Dependencies:**
- QA PASS on Dev
- Explicit user command `Deploy to Alpha`

**Expected Handoff:**
- Alpha deployment evidence (or explicit not-executed record if gate not opened)

### Subtask I3 - Concrete Alpha Status Mutation for Known Feedback Document

**Required Knowledge Base:**
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/05-authentication.md

**Required Repository Context:**
- infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-17
- AC-18
- AC-19
- AC-20

**Dependencies:**
- Subtask I2 complete
- Explicit operational approval to mutate Alpha data
- Valid authorized credentials/session

**Expected Handoff:**
- Durable Alpha evidence record showing exact target mutation to `Done`
- If blocked, durable `UNVERIFIED/BLOCKED` evidence stating reason (target not found, auth unavailable, or credentials unavailable)

## 16. QA Work Package

**Agent:** QA

**Goal:** Verify status lifecycle, admin authorization, compatibility behavior, and concrete operational Alpha closure evidence.

**Required Knowledge Base:**
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/07-infrastructure.md

**Required Repository Context:**
- backend/src/functions/dailyInsightFeedback.ts
- backend/src/functions/dailyInsightFeedback.test.ts
- backend/src/lib/repositories/insightRepository.ts
- backend/src/lib/repositories/insightRepository.test.ts
- backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts
- infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-13
- AC-14
- AC-15
- AC-16
- AC-17
- AC-18
- AC-19

**Dependencies:**
- Backend subtasks B1-B3 complete
- Infrastructure subtask I1 complete
- Infrastructure subtasks I2-I3 when Alpha gate is opened

**Expected Handoff:**
- QA report in docs/qa/reports/ with verdict and full AC matrix
- Explicit marking of any unverified Alpha mutation prerequisites when gate not opened

## 17. Documentation Updates

- Update docs/kb/tech/09-api-reference.md with the new admin status-update endpoint and behavior.
- Update docs/kb/domain/07-ai-features.md feedback section with persisted operational status semantics.
- Add/extend release evidence record for Alpha `Done` mutation outcome.

## 18. Test Strategy

- Unit tests:
  - Status enum validation and defaulting (`undefined -> Open`).
  - Endpoint payload validation and transition validation.
  - `401/403` authorization paths.
  - Idempotent same-state update behavior.
- Contract tests (Cosmos emulator):
  - Legacy feedback document without `processingStatus` read as `Open`.
  - Patch update writes `Done`/`Rejected` only on exact partition/id and correct doc type.
  - Concurrency: repeated write with same target state remains deterministic.
  - Query filters for unresolved/handled semantics.
- Operational verification test note:
  - Narrow execution evidence for known Alpha document update to `Done` using exact `userId` + `id` only.

## 19. Acceptance Criteria

- **AC-1** A new persisted field `processingStatus` exists on `insightFeedback` documents with allowed values `Open | Done | Rejected`.
- **AC-2** Newly created feedback documents are persisted with `processingStatus = 'Open'`.
- **AC-3** Legacy feedback documents without `processingStatus` are treated as `Open` in backend logic.
- **AC-4** No container, partition key, or Bicep schema change is required for this feature.
- **AC-5** A dedicated authenticated backend operational write path exists to update feedback `processingStatus`.
- **AC-6** Only authorized admin users (validated backend auth context) can update feedback status; non-admin users are rejected.
- **AC-7** Status update requires exact `userId` and `feedbackId` identity match and `_docType = 'insightFeedback'` validation.
- **AC-8** Operational unresolved-search semantics exclude handled records by default (`Done` and `Rejected` excluded).
- **AC-9** Status update operation is idempotent for same-state retries and deterministic under concurrent retries.
- **AC-10** Unit tests cover status validation, transition constraints, authorization, and idempotency behavior.
- **AC-11** Contract tests cover legacy docs without status, exact-partition patch behavior, and query filtering behavior.
- **AC-12** Test coverage verifies that updates do not affect unrelated document types in `aiInsights`.
- **AC-13** QA evidence includes pass/fail for unresolved vs handled search behavior.
- **AC-14** QA evidence includes explicit verification limits where credentials or environments are unavailable.
- **AC-15** Dev deployment evidence exists for backend changes (no auto Alpha deploy in this workflow).
- **AC-16** Alpha deployment occurs only after explicit gate/command and is recorded; otherwise remains explicitly not executed.
- **AC-17** The exact known Alpha feedback document (`userId` and `id` from evidence) is the only targeted mutation candidate for this operational closure.
- **AC-18** When prerequisites are met, the exact known Alpha feedback document is persisted as `processingStatus = 'Done'` and evidence is recorded.
- **AC-19** If target resolution or authorized credentials are unavailable, no mutation is performed and outcome is recorded as blocked/unverified with reason.
- **AC-20** Terminal-state semantics are enforced: `Done` and `Rejected` cannot transition to each other or back to `Open`; same-state retries are accepted as idempotent no-op.

## 20. Risks and Edge Cases

- Legacy docs missing status must not be accidentally treated as handled.
- Admin endpoint must avoid becoming a broad read surface.
- Alpha mutation can fail due to missing auth/session/credentials; must fail closed and record reason.

## 21. Dependencies

- Entra `Admin` app-role assignment for operational actors.
- Existing operational access process for Alpha release gates.
- Availability of backend deployment path and audit/evidence recording.

## 22. Expected Handoff (Orchestrator)

- Approved plan artifact path under `docs/User Stories/Insight/`.
- Sequential execution across Backend -> Infrastructure -> QA with no parallel routing.
- Explicit Alpha mutation gate requiring user command and operational approval.

## 23. Recommended Execution Order (Strictly Sequential)

1. Backend Subtask B1 - Schema and Repository Foundations.
2. Backend Subtask B2 - Admin Update Endpoint.
3. Backend Subtask B3 - Automated Test Coverage.
4. Infrastructure Subtask I1 - Deploy Backend Change to Dev.
5. QA Work Package - Dev verification and report.
6. Infrastructure Subtask I2 - Alpha Deploy Gate (only after explicit `Deploy to Alpha`).
7. Infrastructure Subtask I3 - Concrete Alpha status mutation for exact known feedback document.
8. QA targeted re-check of Alpha operational evidence (if steps 6-7 executed).

## 24. Operational Prerequisite for Concrete Alpha Done Update

Before mutating Alpha data, all of the following are required:

- Explicit operator approval to mutate Alpha data for this exact document.
- Authorized admin identity and valid session/credentials.
- Positive pre-check that the target exists exactly as:
  - `userId = TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ`
  - `id = TFp_OTVIglIstrEidILcoFu_arTJgLrjnH6QGRwVCnQ:feedback:563fb0da-9034-4497-a126-de9d1910bac0`
  - `_docType = 'insightFeedback'`

If any prerequisite fails (target not resolvable, not authorized, credentials unavailable), stop without mutation and record a durable blocked/unverified evidence entry.

## 25. Approval Gate

Plan revised after PO-1 resolution. Previous approval state is invalidated by this revision.

Type **APPROVE** to begin implementation orchestration from this revised plan, or provide additional changes.

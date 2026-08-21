# REVISED PLAN - Home Screen Insight Weight Trend Rename

User Story: US_Home-Screen-Insights_Feedback_Review.md  
Planner: FitTrack Planner  
Date: 2026-08-21  
Status: Previous approval invalidated by repository contradiction. New plan required. Execution must not proceed until fresh explicit APPROVE.  
Classification: Accept with modifications
Infrastructure Impact: Dev
Mobile Build Impact: None
Persistence Impact: Existing nested field rename in InsightInputContext snapshots (Class 3 explicit migration in-place; no new container, no partition-key change).

## 1) Requirement Assessment

Requested outcome remains valid:
- inspect Alpha Daily Insight feedback for michi01mueller@googlemail.com,
- align Daily Insight trend classification with the weight chart 30-day regression,
- rename trend7d to weeklyTrend30d cleanly without aliases,
- keep mobile 14-entry local trend logic separate,
- complete orchestration queue with QA and explicit Deploy to Alpha gate.

Plan correction is required because the prior approved plan asserted completed handoffs that are not present in current source.

## 2) Verified Repository State (Current vs Missing)

### Implemented now

- shared/lib/weightTrend.ts already implements 30-day regression projected to weekly change.
- mobile/src/shared/components/TrendStatsRow.tsx already uses shared/lib/weightTrend.ts.
- mobile/src/modules/home/computeWeightTrend.ts remains separate local 14-entry assessment logic.
- backend/scripts/migrate-insight-weight-trend.mjs already defines OLD_TREND_KEY=trend7d and NEW_TREND_KEY=weeklyTrend30d.
- backend/src/lib/repositories/cosmosInsightMigration.contract.test.ts already covers migration scenarios.

### Missing now (must be implemented)

- shared/types/insight.ts still defines InsightWeightContext.trend7d (not weeklyTrend30d).
- backend/src/lib/dailyInsightContext.ts still computes computeWeightTrend7d and writes weight.trend7d.
- backend/src/lib/repositories/insightRepository.ts still hashes trend7d.
- Active prompt stack is still v11, not v14:
  - backend/src/lib/prompts/dailyInsightV10.ts exports DAILY_INSIGHT_PROMPT_VERSION = v11.
  - backend/src/lib/prompts/dailyInsight.eval.test.ts guard is v11.
- Active fixtures/tests still contain trend7d in multiple live files (for example dailyInsight.eval.fixtures.ts and validation/openai tests).

### Contradiction explicitly resolved

- Previous retained claims B1/B2/B4/Frontend are unverified and invalid.
- Current source confirms the rename and v14 work is not complete.
- Existing generated artifacts reflect current old source contract; generated artifact refresh is not a source fix and must happen only after source changes.

## 3) Knowledge Base vs Implementation Drift

- docs/kb/tech/09-api-reference.md currently describes v14 and weeklyTrend30d.
- docs/kb/domain/07-ai-features.md and docs/kb/tech/06-ai-integrations.md still describe v11.
- Source of truth for current runtime behavior is implementation; KB docs are inconsistent and must be reconciled in the same flow.

## 4) Desired Behavior Contract

- Live runtime field name is weeklyTrend30d only.
- No compatibility alias, no dual-read, no dual-write, no fallback in application runtime.
- Bounded exception allowed only in one-off migration source-key detection.
- Daily Insight trend classification must use the shared 30-day regression direction signal (weekly projection) from shared/lib/weightTrend.ts.
- Immutable historical prompt archives remain unchanged and explicitly excluded from active contract checks.
- Mobile computeWeightTrend boundary remains unchanged (separate 14-entry function).

## 5) Scope

In scope:
- shared/backend live contract rename and deterministic trend wiring.
- active prompt/fixtures/eval guard update to v14.
- documentation reconciliation for daily prompt version and trend field semantics.
- clean build and staged mirror refresh after source changes.
- authorized Dev migration execution evidence (or explicit UNVERIFIED limitation).
- QA validation and final gate before any Alpha deployment.

Out of scope:
- planner-side code/test/infra execution,
- backward compatibility in runtime,
- changes to mobile computeWeightTrend logic,
- rewriting immutable historical prompt archive files,
- automatic Deploy to Alpha without explicit user command.

## 6) Environment Limitations

- Alpha feedback data for michi01mueller@googlemail.com is not available in repository files; inspection requires authorized runtime access to Alpha Cosmos data.
- No migration counts or environment results are assumed in this plan.

## 7) Work Packages

### WP-B1 - Shared and backend runtime rename to weeklyTrend30d

Agent: Backend

Goal:
- replace live trend7d contract with weeklyTrend30d across shared types and backend runtime,
- remove computeWeightTrend7d local runtime path,
- use shared 30-day regression classification as the backend trend signal.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/04-shared-library.md
- docs/kb/domain/05-weight-tracking.md

Required Repository Context:
- shared/types/insight.ts
- shared/lib/weightTrend.ts
- backend/src/lib/dailyInsightContext.ts
- backend/src/lib/repositories/insightRepository.ts
- backend/src/lib/insightFeedback.ts
- backend/src/functions/dailyInsight.test.ts
- backend/src/lib/dailyInsightValidation.test.ts
- backend/src/lib/openai.daily.test.ts
- backend/src/lib/repositories/insightRepository.test.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1 Rename is clean in live runtime code.
- AC-2 Daily trend signal aligns with chart 30-day regression direction.
- AC-3 No runtime alias/dual-read/dual-write.
- AC-4 Mobile 14-entry boundary remains unchanged.

Dependencies:
- None

Expected Handoff:
- Runtime source and tests use weeklyTrend30d only in live paths.
- Daily backend context trend value is derived from shared 30-day regression classification.
- List of intentionally retained old-token files (migration source-key handling only; immutable prompt archives only).
- Command outcomes for affected test/typecheck suites and build verification.

### WP-B2 - Active prompt contract bump to v14 with live fixture/test alignment

Agent: Backend

Goal:
- bump active Daily prompt contract from v11 to v14,
- update active prompt user-context references to weeklyTrend30d,
- align eval/test guards and active fixtures without changing immutable historical prompt archives.

Required Knowledge Base:
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/prompts/dailyInsightV10.ts
- backend/src/lib/prompts/promptWeight.ts
- backend/src/lib/prompts/sharedTone.ts
- backend/src/lib/prompts/dailyInsight.eval.fixtures.ts
- backend/src/lib/prompts/dailyInsight.eval.test.ts
- backend/src/lib/prompts/dailyInsightPrompt.test.ts
- backend/src/lib/openai.ts

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-5 Active prompt version and eval guard are v14.
- AC-6 Active prompt context uses weeklyTrend30d.
- AC-7 Historical prompt archive immutability preserved.

Dependencies:
- WP-B1

Expected Handoff:
- Active prompt/version wiring is v14.
- Active fixtures/eval guards match v14 and weeklyTrend30d.
- Explicit list of unchanged historical archive files.
- Eval command result or explicit UNVERIFIED with reason (for missing Azure credentials).

### WP-B3 - Documentation reconciliation for current contract

Agent: Backend

Goal:
- reconcile KB/API docs so prompt version and trend field semantics match implemented runtime.

Required Knowledge Base:
- docs/kb/README.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/05-weight-tracking.md

Required Repository Context:
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/05-weight-tracking.md
- backend/src/lib/prompts/dailyInsightV10.ts
- shared/types/insight.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-8 KB/API reflect implemented prompt version and trend naming consistently.

Dependencies:
- WP-B1
- WP-B2

Expected Handoff:
- KB/API docs no longer contradict source for this feature.
- Explicit note of any remaining unrelated KB drift, if found.

### WP-I1 - Generated artifact rebuild and staging mirror refresh

Agent: Infrastructure

Goal:
- perform clean backend build,
- mirror backend/dist to _deploy_staging/dist,
- run path-aware active-contract audit proving generated artifacts match updated live source contract.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- backend/dist/
- _deploy_staging/dist/
- backend/src/lib/dailyInsightContext.ts
- backend/src/lib/repositories/insightRepository.ts
- backend/src/lib/prompts/dailyInsightV10.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-9 Generated artifacts rebuilt from source (no manual dist edits).
- AC-10 Active generated runtime files contain weeklyTrend30d and v14; no active trend7d/computeWeightTrend7d.

Dependencies:
- WP-B1
- WP-B2

Expected Handoff:
- Clean build command log with exit code.
- Mirror command log with exit code and file/hash parity summary.
- Path-aware audit report separating active runtime files vs immutable archive exceptions.

### WP-I2 - Alpha feedback inspection and Dev migration evidence

Agent: Infrastructure

Goal:
- inspect Alpha Daily Insight feedback for michi01mueller@googlemail.com (authorized access only),
- execute Dev migration utility and immediate repeat run,
- persist sanitized durable evidence record.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- backend/scripts/migrate-insight-weight-trend.mjs
- backend/src/lib/repositories/cosmosInsightMigration.contract.test.ts
- infra/release-records/

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-11 Alpha feedback inspection outcome is recorded (or UNVERIFIED with concrete access limitation).
- AC-12 Dev migration first run and repeat run evidence captured with true observed counts.
- AC-13 No invented counts/results.

Dependencies:
- WP-I1

Expected Handoff:
- Sanitized evidence artifact at infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md.
- Alpha inspection subsection with query scope and findings or UNVERIFIED reason.
- Dev migration subsection containing first-run and immediate repeat-run counts, exit codes, UTC timestamps, and target identifiers (non-secret).

### WP-QA - End-to-end verification against this revised plan

Agent: QA

Goal:
- verify all acceptance criteria and queue outputs,
- confirm no runtime alias and no boundary regression,
- publish durable QA report.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/05-weight-tracking.md
- docs/kb/domain/07-ai-features.md

Required Repository Context:
- backend/src/lib/dailyInsightContext.ts
- backend/src/lib/repositories/insightRepository.ts
- backend/src/lib/prompts/dailyInsightV10.ts
- backend/src/lib/prompts/dailyInsight.eval.test.ts
- shared/types/insight.ts
- shared/lib/weightTrend.ts
- mobile/src/modules/home/computeWeightTrend.ts
- docs/qa/reports/

Required Skills:
- azure-openai-feature-integration
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1 through AC-13

Dependencies:
- WP-B1
- WP-B2
- WP-B3
- WP-I1
- WP-I2

Expected Handoff:
- QA report: docs/qa/reports/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md
- Verdict with explicit evidence matrix for AC-1..AC-13.

## 8) Acceptance Criteria

AC-1: Live shared/backend contract field is weeklyTrend30d; live trend7d removed.  
AC-2: Daily Insight trend classification uses shared 30-day regression direction semantics.  
AC-3: Runtime has no alias, dual-read, dual-write, or fallback for trend7d.  
AC-4: mobile/src/modules/home/computeWeightTrend.ts remains separate 14-entry logic and unchanged in behavior.  
AC-5: Active Daily prompt version is v14.  
AC-6: Active prompt user context references weeklyTrend30d, not trend7d.  
AC-7: Immutable historical prompt archives remain unchanged; exclusions are explicit.  
AC-8: KB/API docs are internally consistent and aligned to implemented contract.  
AC-9: backend/dist and _deploy_staging/dist are rebuilt from current source (no manual edits).  
AC-10: Active generated runtime files contain weeklyTrend30d and v14; no active trend7d or computeWeightTrend7d tokens.  
AC-11: Alpha feedback inspection for michi01mueller@googlemail.com is recorded with evidence or explicit UNVERIFIED limitation.  
AC-12: Dev migration evidence includes first run and immediate repeat run with true observed counts and exit codes.  
AC-13: No fabricated migration/test/deployment outcomes in any handoff.

## 9) Risks and Edge Cases

- Rename misses in tests/fixtures can leave false green paths.
- Prompt version bump without eval guard updates will fail QA.
- Dist token scans can produce false positives if historical archives are not path-scoped.
- Missing environment credentials can block Alpha inspection or eval; must be reported as UNVERIFIED, not guessed.

## 10) Recommended Execution Order (Sequential Only)

1. WP-B1  
2. WP-B2  
3. WP-B3  
4. WP-I1  
5. WP-I2  
6. WP-QA

## 11) Deploy to Alpha Gate

Deploy to Alpha is explicitly out of automatic execution scope for this plan.

It may only be triggered after all are true:
- WP-QA verdict is PASS (or PASS WITH ISSUES with explicit user acceptance of every issue),
- user gives explicit deploy instruction,
- Infrastructure runs direct command Deploy to Alpha in the separate operational step.

## 12) Fresh Approval Gate

Previous approval is invalidated.  
A fresh explicit APPROVE is required before any implementation or operational execution resumes.

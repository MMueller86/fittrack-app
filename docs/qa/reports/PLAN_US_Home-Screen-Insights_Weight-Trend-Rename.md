# QA Report: Home Screen Insights Weight Trend Rename

- Format: fittrack-qa-v1
- Plan reference: [docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md](docs/User%20Stories/Insight/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md)
- Verdict: PASS

## Scope

Reviewed all completed work packages WP-B1, WP-B2, WP-B3, WP-I1, and WP-I2 against AC-1 through AC-13. Verification covered runtime source, prompt/eval contract, generated artifacts in backend and staging dist trees, documentation alignment, and the sanitized Dev migration/Alpha inspection evidence record.

Out of scope for this QA run: deployment execution, direct Alpha data mutation, and writing the central findings register.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Live shared/backend contract uses weeklyTrend30d in [shared/types/insight.ts](shared/types/insight.ts), [backend/src/lib/dailyInsightContext.ts](backend/src/lib/dailyInsightContext.ts), and [backend/src/lib/repositories/insightRepository.ts](backend/src/lib/repositories/insightRepository.ts). |
| AC-2 | PASS | Daily trend signal is derived via shared 30-day regression helpers in [shared/lib/weightTrend.ts](shared/lib/weightTrend.ts) and consumed in [backend/src/lib/dailyInsightContext.ts](backend/src/lib/dailyInsightContext.ts). |
| AC-3 | PASS | Active runtime old-name scan shows no trend7d or computeWeightTrend7d references outside approved exceptions; hash/persistence path uses weeklyTrend30d in [backend/src/lib/repositories/insightRepository.ts](backend/src/lib/repositories/insightRepository.ts). |
| AC-4 | PASS | Mobile local 14-entry logic remains separate in [mobile/src/modules/home/computeWeightTrend.ts](mobile/src/modules/home/computeWeightTrend.ts). Change is isolated to chart-aligned consumer usage in [mobile/src/shared/components/TrendStatsRow.tsx](mobile/src/shared/components/TrendStatsRow.tsx). |
| AC-5 | PASS | Active prompt version is v14 in [backend/src/lib/prompts/dailyInsightV10.ts](backend/src/lib/prompts/dailyInsightV10.ts) and eval guard is v14 in [backend/src/lib/prompts/dailyInsight.eval.test.ts](backend/src/lib/prompts/dailyInsight.eval.test.ts). |
| AC-6 | PASS | Active prompt fixtures/context use weeklyTrend30d in [backend/src/lib/prompts/dailyInsight.eval.fixtures.ts](backend/src/lib/prompts/dailyInsight.eval.fixtures.ts). |
| AC-7 | PASS | Legacy trend tokens are confined to immutable prompt archives [backend/src/lib/prompts/dailyInsight.ts](backend/src/lib/prompts/dailyInsight.ts), [backend/src/lib/prompts/dailyInsightV6.ts](backend/src/lib/prompts/dailyInsightV6.ts), [backend/src/lib/prompts/dailyInsightV7.ts](backend/src/lib/prompts/dailyInsightV7.ts), [backend/src/lib/prompts/dailyInsightV8.ts](backend/src/lib/prompts/dailyInsightV8.ts), [backend/src/lib/prompts/dailyInsightV9.ts](backend/src/lib/prompts/dailyInsightV9.ts), and migration contract coverage in [backend/src/lib/repositories/cosmosInsightMigration.contract.test.ts](backend/src/lib/repositories/cosmosInsightMigration.contract.test.ts). |
| AC-8 | PASS | KB/API documents align on v14 and weeklyTrend30d semantics in [docs/kb/domain/05-weight-tracking.md](docs/kb/domain/05-weight-tracking.md), [docs/kb/domain/07-ai-features.md](docs/kb/domain/07-ai-features.md), [docs/kb/tech/06-ai-integrations.md](docs/kb/tech/06-ai-integrations.md), [docs/kb/tech/09-api-reference.md](docs/kb/tech/09-api-reference.md), and [docs/kb/tech/07-infrastructure.md](docs/kb/tech/07-infrastructure.md). |
| AC-9 | PASS | Generated artifacts are consistent and mirrored: SOURCE_FILES=254, STAGING_FILES=254, MISSING=0, EXTRA=0, HASH_MISMATCH=0 from backend/dist to _deploy_staging/dist. |
| AC-10 | PASS | Path-aware generated audit reports SRC_ACTIVE_LEGACY_TOKENS=0 and STG_ACTIVE_LEGACY_TOKENS=0, with archive-only legacy occurrences and v14 present in active prompt file [backend/dist/backend/src/lib/prompts/dailyInsightV10.js](backend/dist/backend/src/lib/prompts/dailyInsightV10.js) and [_deploy_staging/dist/backend/src/lib/prompts/dailyInsightV10.js](_deploy_staging/dist/backend/src/lib/prompts/dailyInsightV10.js). |
| AC-11 | PASS | Alpha feedback inspection preserves the direct-query limitation (`usersCount=0`, `targetedUserFieldMatchCount=0`, `matchedUserIds=[]`, `feedbackCount=1`) and additionally records explicit manual user confirmation at `2026-08-21T09:04:05.5454186Z` accepting the feedback as successfully identified/handled in [infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md](infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md). |
| AC-12 | PASS | Dev migration first run and immediate repeat run counts, UTC timestamps, and exit codes are present in [infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md](infra/release-records/US_Home-Screen-Insights_Weight-Trend-Rename_Dev.md). |
| AC-13 | PASS | No contradictory or fabricated evidence detected in reviewed handoffs; command outcomes and release-record counts are internally consistent across QA execution and durable records. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| cd shared && npx tsc --noEmit | 0 | PASS |
| cd shared && npx vitest run | 0 | PASS, 9 files and 442 tests |
| cd backend && npx tsc --noEmit | 0 | PASS |
| cd backend && npx vitest run | 0 | PASS, 43 files and 881 tests |
| cd backend && npm run build:verify | 0 | PASS |
| cd backend && npx vitest run --config vitest.contract.config.mts | 1 | UNVERIFIED, emulator unavailable at http://127.0.0.1:18081; 8 suites failed bootstrap, 60 tests skipped |
| cd backend && npm run test:eval | 0 | PASS, 4 files and 26 tests |
| cd mobile && npx tsc --noEmit | 0 | PASS |
| cd mobile && npx vitest run | 0 | PASS, 32 files and 384 tests |
| npm run check:encoding | 0 | PASS |
| node --check backend/scripts/migrate-insight-weight-trend.mjs | 0 | PASS |
| git diff --check | 0 | PASS |

## Verification Notes

- State: UNVERIFIED
- Reason: Local Cosmos emulator is not reachable at http://127.0.0.1:18081, so contract tests (including migration contract suite) cannot execute in this environment.
- Manual action: Start emulator with backend instructions, rerun cd backend && npx vitest run --config vitest.contract.config.mts, expected result: contract suites pass and migration contract tests assert rename/idempotency behavior.

- State: MANUAL USER-CONFIRMED
- Reason: Direct Alpha query limitation remains unchanged (`usersCount=0`, no authoritative technical email-to-userId mapping), but the durable evidence record now includes explicit user confirmation at `2026-08-21T09:04:05.5454186Z` that the feedback should be treated and documented as successfully handled.
- Manual action: None pending for this criterion in the current review scope; provenance distinction between direct-query limits and manual acceptance is retained in the durable release record.

## Findings

No actionable findings.
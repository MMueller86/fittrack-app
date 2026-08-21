# QA Report: Daily Insight Prompt Provenance Correction

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md](docs/User%20Stories/Insight/PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md)
- Verdict: `PASS`

## Scope

Reviewed the approved Daily Insight prompt-provenance correction across the active composition root, Strict Structured Output schema, release manifest and offline guard, cache identity and regeneration logic, Daily handler, feedback traceability, shared types, Knowledge Base updates, CI wiring, and the prescribed unit, type, build, contract, encoding, diff, and eval checks. All Acceptance Criteria AC-1 through AC-15 were assessed.

The worktree was already dirty as described by the plan. QA changed only this durable report and did not modify source, tests, the plan, Knowledge Base files, or `docs/qa/findings.md`. No public API, Mobile UI/native, Cosmos container, partition-key, Bicep, or migration change was introduced by this correction scope.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Active runtime composition uses [backend/src/lib/prompts/dailyInsightPrompt.ts](backend/src/lib/prompts/dailyInsightPrompt.ts); [backend/src/lib/openai.ts](backend/src/lib/openai.ts), [backend/src/functions/dailyInsight.ts](backend/src/functions/dailyInsight.ts), and the prompt eval/test paths use the new root. The active reference audit found no `dailyInsightV10.ts` import. The v3-v9 and unreferenced v3 archive exports remain historical and inactive. |
| AC-2 | PASS | The composition root includes shared tone, output contract, all six intent mappings, guard texts and policy thresholds, assembly version, and [backend/src/lib/dailyInsightSchema.ts](backend/src/lib/dailyInsightSchema.ts). [backend/src/lib/openai.daily.test.ts](backend/src/lib/openai.daily.test.ts) verifies strict structured output and that the exact builder snapshot is sent verbatim to the provider. |
| AC-3 | PASS | [backend/src/lib/prompts/dailyInsightPrompt.test.ts](backend/src/lib/prompts/dailyInsightPrompt.test.ts) covers deterministic canonical JSON and mutations for shared tone, output contract, activity, general, morning, nutrition, both weight intent mappings, guard text, guard policy, assembly version, and schema. The focused prompt/manifest run passed 35/35 tests. |
| AC-4 | PASS | [backend/src/lib/prompts/dailyInsightPromptManifest.ts](backend/src/lib/prompts/dailyInsightPromptManifest.ts) contains the append-only v14 lock with the approved fingerprint `sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a`. [backend/scripts/verify-daily-insight-prompt.mjs](backend/scripts/verify-daily-insight-prompt.mjs) tracks all provider-visible prompt, schema, and validation inputs; its tests cover missing manifest changes, required appended releases, historical edits, and validation-only changes. The CI workflow runs the guard with full Git history. |
| AC-5 | PASS | [backend/src/lib/repositories/insightRepository.ts](backend/src/lib/repositories/insightRepository.ts) includes `promptVersion`, `promptFingerprint`, and the concrete system-prompt hash in `computeInputHash()`. [backend/src/functions/dailyInsight.ts](backend/src/functions/dailyInsight.ts) computes the exact snapshot/hash before cache selection, and repository tests cover fingerprint and system-hash changes. |
| AC-6 | PASS | [backend/src/functions/dailyInsight.ts](backend/src/functions/dailyInsight.ts) persists server-owned version, global fingerprint, system hash, intent, exact snapshot, input context, and input hash. [backend/src/functions/dailyInsightFeedback.ts](backend/src/functions/dailyInsightFeedback.ts) copies provenance from the stored Daily instance only. [shared/types/insight.ts](shared/types/insight.ts) keeps the additive identity fields optional for legacy reads. |
| AC-7 | PASS | `shouldRegenerate()` compares active version, fingerprint, system hash, expected intent, and exact system/user snapshot before input-hash and rate-limit decisions. Handler regression tests cover intent, system-snapshot, and user-snapshot mismatches under both recent-cache and max-generation conditions, plus the unchanged complete-identity cache hit. |
| AC-8 | PASS | [backend/src/lib/repositories/insightRepository.ts](backend/src/lib/repositories/insightRepository.ts) preserves semantic calorie and protein boundary buckets, including non-finite values as unknown and `-0` as zero. [backend/src/lib/repositories/insightRepository.test.ts](backend/src/lib/repositories/insightRepository.test.ts) distinguishes `-0.01`, `0`, `0.01`, `19.99`, `20`, and `20.01` while retaining rounding stability. |
| AC-9 | PASS | [backend/src/functions/dailyInsightFeedback.ts](backend/src/functions/dailyInsightFeedback.ts) copies the exact Daily fingerprint and system hash without accepting client provenance. Feedback unit tests cover authentication, exact generation binding, idempotent retry, conflict, expiry-safe retry, legacy snapshot rejection, and existing request/response contracts. |
| AC-10 | PASS | Optional legacy-compatible fields and read paths remain in [shared/types/insight.ts](shared/types/insight.ts) and [backend/src/lib/repositories/insightRepository.ts](backend/src/lib/repositories/insightRepository.ts). Unit and contract test definitions cover legacy Daily and Feedback reads without prompt identities, no backfill, hard refresh of incomplete Daily provenance, and rejection of legacy Daily as new feedback provenance. Cosmos execution is environment-limited as recorded below. |
| AC-11 | PASS | The active root has no partial static prompt export, and [backend/src/lib/openai.ts](backend/src/lib/openai.ts) does not import or re-export `DAILY_INSIGHT_SYSTEM_PROMPT`; it re-exports only the central schema and active identity values. Remaining occurrences are confined to inactive historical prompt archives. |
| AC-12 | PASS | [shared/types/insight.ts](shared/types/insight.ts) leaves the public Daily response and Feedback request unchanged; `promptFingerprint` and `systemPromptHash` do not occur in `mobile/src`. Handler tests preserve authentication, quota-before-provider ordering, post-success usage tracking, friendly HTTP 200 failure behavior, and feedback idempotency. No infrastructure or Mobile/native change is in the reviewed correction scope. |
| AC-13 | UNVERIFIED | Offline guard, shared/backend/mobile typechecks, shared/backend unit tests, build verification, encoding check, diff check, and live prompt evals passed. The Cosmos contract command exited 1 during emulator initialization with all 65 contract tests skipped; this is an environment limitation, not an implementation finding. |
| AC-14 | PASS | [docs/kb/domain/07-ai-features.md](docs/kb/domain/07-ai-features.md), [docs/kb/tech/06-ai-integrations.md](docs/kb/tech/06-ai-integrations.md), and [docs/kb/tech/08-testing.md](docs/kb/tech/08-testing.md) point to the new root and document dual identity, canonical fingerprinting, hard invalidation, semantic buckets, Class 0 legacy behavior, release guard, and eval checks. The KB matches the corrected intent/snapshot comparison. |
| AC-15 | PASS | [backend/src/functions/dailyInsight.ts](backend/src/functions/dailyInsight.ts) sets `feedbackAvailable: false` when persistence fails, leaves no incomplete in-memory write, emits the structured `ai.daily-insight.cache_write_failed` event, and still tracks successful provider usage. [backend/src/functions/dailyInsight.test.ts](backend/src/functions/dailyInsight.test.ts) verifies this failure path and quota behavior. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run verify:daily-insight-prompt --workspace=backend` | 0 | PASS; 7 offline Node guard tests and 2 manifest Vitest tests. Current v14 fingerprint verified. |
| `npx vitest run src/lib/prompts/dailyInsightPrompt.test.ts src/lib/prompts/dailyInsightPromptManifest.test.ts` | 0 | PASS; 2 files and 35 tests. |
| `npm run typecheck --workspace=shared` | 0 | PASS. |
| `npm run typecheck --workspace=backend` | 0 | PASS. |
| `npm run typecheck --workspace=mobile` | 0 | PASS. |
| `npm test --workspace=shared` | 0 | PASS; 9 files and 442 tests. |
| `npm test --workspace=backend` | 0 | PASS; 44 files and 934 tests. |
| `npm run build:verify --workspace=backend` | 0 | PASS; module-resolution and duplicate-function checks passed, with only expected Azure Functions test-mode warnings. |
| `npm run test:contract --workspace=backend` | 1 | UNVERIFIED; local Cosmos emulator was not reachable at `http://127.0.0.1:18081`; 8 suites failed during setup and 65 tests were skipped. |
| `npm run test:eval --workspace=backend` | 0 | PASS; 4 eval files and 26 live assertions, including all 13 Daily Insight fixtures. |
| `npm run check:encoding` | 0 | PASS. |
| `git diff --check` | 0 | PASS; only normal CRLF normalization warnings were reported. |

## UNVERIFIED

- Cosmos contract execution is unverified because the local emulator was not reachable at `http://127.0.0.1:18081`. This is an environment limitation, not an actionable finding.
- Required follow-up: start the local emulator with `npm run emulator:start --workspace=backend`, then rerun `npm run test:contract --workspace=backend`. Expected coverage includes Daily and Feedback fingerprint roundtrips, legacy reads, `_docType` and partition filters, and TTL/no-TTL behavior.

## MANUAL VALIDATION REQUIRED

- During the planned Dev verification, observe a new Daily document with server-owned fingerprint and exact snapshot, a cache hit for identical identity, and regeneration after identity change. Confirm that no new Cosmos container, partition-key change, TTL policy change, migration, or Mobile/native build is introduced.
- Alpha deployment is outside this plan and remains a separate explicit operational action.

## Findings

No actionable findings.

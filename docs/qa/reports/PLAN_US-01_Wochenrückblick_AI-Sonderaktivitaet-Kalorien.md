# QA Report: US-01 Weekly Insight special-activity calories

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md](../../User%20Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md)
- Verdict: `FAIL`

## Scope

Reviewed the complete approved plan, the WP-B-DIAG-WRITE and WP-B-DIAG-RUN artifacts, the weekly calculation and provider path, the semantic validator, the eval runner, and the required backend tests. The diagnostic implementation is test/eval-only: no production backend, Shared, Mobile, infrastructure, API, persistence, or active prompt version file was changed. Conditional correction packages and Development release were correctly not activated because no qualifying Red Gate exists.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | The plan documents the full path from `setSpecialActivityHandler()` and `setDayTypeHandler()` through `weeklyInsightHandler()`, `resolveWeeklyTarget()`, `calculateWeeklyNutritionReview()`, `toPromptDay()`, `buildWeeklyInsightPromptContext()`, and `generateWeeklyInsight()`. The focused handler test executes the actual handler/provider boundary. Evidence: [plan](../../User%20Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md), [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts), [weeklyInsight.ts](../../backend/src/lib/weeklyInsight.ts). |
| AC-2 | PASS | Both deterministic cases pass with base `2300`, bonus `1300`, effective target `3600`, and target percentages `83.33333333333333` for `3000` consumed and `100` for `3600` consumed. Evidence: [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts), diagnostic manifest. |
| AC-3 | PASS | The test parses `messages[1].content` from the mocked provider call and checks all five numeric fields. It also rejects meal names, item text, user ID, macros, cache fields, and prompt metadata. Evidence: [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts), [openai.weekly.test.ts](../../backend/src/lib/openai.weekly.test.ts). |
| AC-4 | PASS | The focused test verifies one included day and totals of `3000/3600/83.33333333333333` and `3600/3600/100` for consumed/target/overall percentage. Evidence: [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts), diagnostic manifest. |
| AC-5 | PASS | Both payload cases are `PASS`; no first divergent path exists and the stored gate is `UNVERIFIED`, not `RED_CONFIRMED_A`. The manifest unit tests also cover the required Red-Gate classification behavior. Evidence: diagnostic manifest, [weeklyInsightEvalSemantics.test.ts](../../backend/src/test-utils/weeklyInsightEvalSemantics.test.ts). |
| AC-6 | PASS | The stored baseline did not claim `RED_CONFIRMED_B`: the second judge result lacked exact in-text evidence and was conservatively `UNVERIFIED`. A fresh QA eval produced exact evidence and classified both cases `CORRECT`, with aggregate `C / VERIFIED / NO_RED`. Evidence: diagnostic manifest, [weeklyInsight.special-activity.diagnostic.eval.test.ts](../../backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts). |
| AC-7 | PASS | The existing formal/`forbiddenPhrases` eval remains intact. The diagnostic adds dedicated fixtures, a structured judge/local validator, targeted runner forwarding, and tests for each. Evidence: [weeklyInsight.eval.test.ts](../../backend/src/lib/prompts/weeklyInsight.eval.test.ts), [weeklyInsight.eval.fixtures.ts](../../backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts), [weeklyInsightEvalSemantics.ts](../../backend/src/test-utils/weeklyInsightEvalSemantics.ts), [run-eval.mjs](../../backend/scripts/run-eval.mjs), [run-eval.test.mjs](../../backend/scripts/run-eval.test.mjs). |
| AC-8 | PASS | The data-correction branch was correctly not activated because the deterministic payload gate passed. No calculator, mapping, handler, or production regression correction was made. Evidence: worktree scope check, diagnostic manifest. |
| AC-9 | PASS | The prompt-correction branch was correctly not activated because no credentialed semantically evidenced incorrect output was found. The active prompt remains `v2`; no `v3` or field-contract production change was introduced. Evidence: [weeklyInsightV2.ts](../../backend/src/lib/prompts/weeklyInsightV2.ts), diagnostic manifest. |
| AC-10 | PASS | No prompt-version bump was made without a confirmed AI contract error. Existing cache/version regression coverage remains green. Evidence: [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts), [weeklyInsightV2.ts](../../backend/src/lib/prompts/weeklyInsightV2.ts). |
| AC-11 | PASS | Focused and full backend tests preserve strict Structured Outputs, `additionalProperties: false`, text validation, sanitization, quota ordering, post-success usage tracking, neutral failures, and cache behavior. Evidence: [openai.ts](../../backend/src/lib/openai.ts), [openai.weekly.test.ts](../../backend/src/lib/openai.weekly.test.ts), [weeklyInsight.test.ts](../../backend/src/functions/weeklyInsight.test.ts). |
| AC-12 | PASS | No qualifying Red Gate exists, no production correction or prompt version change was made, and the handoff contains the complete payload and live-eval diagnosis. Evidence: diagnostic manifest and worktree status. |
| AC-13 | PASS | The deterministic payload result was not treated as proof of an AI defect. The stored ambiguous evidence is `C / UNVERIFIED`; the fresh correct live output is `C / VERIFIED / NO_RED`. Neither result authorizes correction. Evidence: diagnostic manifest, live diagnostic eval output, [weeklyInsightEvalSemantics.ts](../../backend/src/test-utils/weeklyInsightEvalSemantics.ts). |
| AC-14 | PASS | The required deterministic command was run first and passed both cases; the targeted live eval was then run. No correction or release package ran before these checks. Evidence: Tests table and diagnostic manifest. |
| AC-15 | PASS | This report is written at the exact expected path with the `fittrack-qa-v1` format, one AC-1 through AC-17 matrix, test exit codes, separate verification-state sections, and structured findings. Evidence: this report. |
| AC-16 | PASS | The stored machine-readable manifest includes the required diagnosis/status/gate, exact commands and exit codes, payload values, per-case evidence, first divergent path, root cause, and `productionCorrectionMade: false`. Its gate is not a correction-authorizing `RED_CONFIRMED_*` value. Evidence: [diagnostic-manifest.json](PLAN_US-01_Wochenrueckblick_AI-Sonderaktivitaet-Kalorien.diagnostic-manifest.json). |
| AC-17 | PASS | No qualifying Red Gate occurred, so the conditional direct-correction and Red-to-Green packages were correctly skipped; no second approval was requested and no Development release was attempted. Evidence: diagnostic manifest and worktree scope check. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend; npx vitest run src/functions/weeklyInsight.test.ts -t "RED-GATE: special activity uses effective weekly target in provider context"` | 0 | 2 passed, 14 skipped; both exact special-activity cases passed. |
| `cd backend; npx vitest run src/test-utils/weeklyInsightEvalSemantics.test.ts` | 0 | 10 passed; correct, incorrect, ambiguous, invalid-evidence, and manifest gate cases covered. |
| `cd backend; node --test scripts/run-eval.test.mjs` | 0 | 3 passed; targeted file forwarding and credential-safe environment handling passed. |
| `cd backend; npx vitest run src/functions/weeklyInsight.test.ts src/lib/weeklyInsight.test.ts src/lib/openai.weekly.test.ts` | 0 | 3 files and 39 tests passed. |
| `cd backend; npx vitest run` | 0 | 45 files and 946 tests passed. |
| `cd backend; npm run build:verify` | 2 | Failed in unchanged `backend/src/lib/prompts/dailyInsightV10.ts` with TypeScript syntax errors; see Finding `BUILD-BASELINE-DAILYINSIGHTV10`. |
| `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` (fresh QA run) | 0 | 3 tests passed; both cases `CORRECT`, aggregate `C / VERIFIED / NO_RED`, gate `NO_RED`, prompt `v2`, deployment `gpt-4o-mini`. |

## UNVERIFIED

- The stored WP-B-DIAG-RUN manifest records `diagnosis: C`, `status: UNVERIFIED`, and `gate: UNVERIFIED`. Its second live judge output was structurally correct but its evidence was not an exact substring of that generated text, so the local validator correctly refused to call it `CORRECT`. This is conservative evidence handling, not proof of an AI defect, and it did not route a correction.
- The fresh QA eval generated different text for the same fixture and supplied exact evidence for both cases, producing `C / VERIFIED / NO_RED`. The two records are retained as separate runs; neither authorizes a correction.

## MANUAL VALIDATION REQUIRED

None for this diagnostic-only backend scope. Azure credentials were available for the fresh eval, and Mobile, device, Alpha, and Development release validation were explicitly out of scope because no production correction was made.

## Findings

Finding key: `BUILD-BASELINE-DAILYINSIGHTV10`
Plan reference: [docs/User Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md](../../User%20Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md)
Acceptance criterion: N/A (QA Work Package build verification)
Description: `npm run build:verify` exits with code 2 before the emitted-build verification step. TypeScript reports syntax errors beginning at line 2 of the tracked [dailyInsightV10.ts](../../backend/src/lib/prompts/dailyInsightV10.ts), whose current contents begin with raw prompt prose and a closing backtick rather than a valid TypeScript declaration. The file is unchanged in this worktree and is outside the approved diagnostic scope, but it prevents a clean backend build.
Criticality: Blocking
Owner: Backend
Evidence: `cd backend; npm run build:verify` exit code 2; `git status --short -- backend/src/lib/prompts/dailyInsightV10.ts` reports no change; [dailyInsightV10.ts](../../backend/src/lib/prompts/dailyInsightV10.ts).
Recommendation: Repair or restore the pre-existing `dailyInsightV10.ts` syntax in a separate Backend task, then rerun `cd backend; npm run build:verify`. Do not mix that unrelated repair with an unqualified Weekly Insight correction.
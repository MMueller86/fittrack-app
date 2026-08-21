# QA Report: US-01 Weekly Insight exceedance correction

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/startpage/PLAN_US-01_Wochenrückblick_Ueberschreitungs-Korrektur.md](../../User%20Stories/startpage/PLAN_US-01_Wochenr%C3%BCckblick_Ueberschreitungs-Korrektur.md)
- Verdict: `PASS`

## Scope

Reviewed the approved Weekly Insight correction across the v3 prompt contract,
training-day fixture, eval version guards, server-side exceedance validator,
OpenAI integration, cache regression coverage, related Knowledge Base updates,
and backend regression checks. Mobile, Cosmos schema, Alpha, and Development
deployment were outside this QA run. The central findings register was not
modified.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `WEEKLY_INSIGHT_PROMPT_VERSION` is `v3` in [weeklyInsightV2.ts](../../backend/src/lib/prompts/weeklyInsightV2.ts). |
| AC-2 | PASS | The system prompt defines `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories`, and `targetPercent` in its field contract. |
| AC-3 | PASS | The prompt states that exceedance applies only when `targetPercent > 100` and prohibits exceedance wording at `targetPercent <= 100`. |
| AC-4 | PASS | The prompt explicitly forbids using `baseTargetCalories` as the exceedance reference when an effective target exists. |
| AC-5 | PASS | [weeklyInsight.eval.fixtures.ts](../../backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts) contains `training-day-activitybonus-under-target` with three training days, positive bonuses, 99/90/81%, and all six required forbidden phrases. The credentialed fixture eval passed. |
| AC-6 | PASS | [weeklyInsight.eval.test.ts](../../backend/src/lib/prompts/weeklyInsight.eval.test.ts) guards `TESTED_PROMPT_VERSION` at `v3`. |
| AC-7 | PASS | [weeklyInsight.special-activity.diagnostic.eval.test.ts](../../backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts) guards `TESTED_PROMPT_VERSION` at `v3`; the repeated credentialed diagnostic run passed both cases. |
| AC-8 | PASS | [weeklyInsightValidation.test.ts](../../backend/src/lib/weeklyInsightValidation.test.ts) verifies exceedance language is valid when a day is at 101%; the direct runtime probe also passed the expected valid path. |
| AC-9 | PASS | The validator rejects German exceedance wording for 99/90/81% days, both in the unit test and direct runtime probe. |
| AC-10 | PASS | Four validator unit tests cover neutral below-target text, invalid exceedance wording, a real exceedance day, and null percentages. |
| AC-11 | PASS | [openai.ts](../../backend/src/lib/openai.ts) calls `validateWeeklyInsightExceedanceClaims()` after structured-response schema validation and throws on an invalid result. |
| AC-12 | PASS | `cd backend; npm run build:verify` exited 0; TypeScript compilation and both build checks passed. |
| AC-13 | PASS | `cd backend; npx vitest run` exited 0 with 46 files and 950 tests, exceeding the recorded pre-change total of 946. |
| AC-14 | PASS | `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.eval.test.ts` exited 0 with all four tests passed, including the new training-day fixture. The full eval suite also exited 0 with 5 files and 30 tests passed. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend; npx vitest run src/lib/weeklyInsightValidation.test.ts` | 0 | 1 file and 4 tests passed. |
| `cd backend; npx vitest run --config vitest.eval.config.mts src/lib/prompts/weeklyInsight.eval.test.ts` | 0 | Version guard passed; live cases were skipped because this direct invocation did not load local settings. |
| `cd backend; npx vitest run src/lib/prompts/weeklyInsight.eval.test.ts` | 1 | Default unit config reported no test files because it excludes `*.eval.test.ts`; the dedicated eval config and repository wrapper passed. |
| `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.eval.test.ts` | 0 | 1 file and 4 tests passed, including live AI evaluation of the new fixture. |
| `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` | 1, then 0 on repeat | The first live judge returned `UNVERIFIED` for one semantically correct output; the repeat passed both cases and produced `C / VERIFIED / NO_RED`. |
| `cd backend; npm run test:eval` | 0 | 5 files and 30 credentialed eval tests passed. |
| `cd backend; npx vitest run` | 0 | 46 files and 950 tests passed. |
| `cd backend; npm run build:verify` | 0 | TypeScript build and duplicate-function verification passed. |
| `cd backend; npm run test:startup` | 0 | 16 startup, storage, readiness, and eval-runner tests passed. |
| `cd backend; npm run verify:daily-insight-prompt` | 0 | Daily Insight v14 release guard passed; the active prompt identity was unchanged. |
| `git diff --check` | 0 | No whitespace errors. |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed. |

## UNVERIFIED

- The first isolated special-activity live eval run was unverified for one
  provider/judge output and exited 1. A repeat run and the complete credentialed
  eval suite passed, so no acceptance criterion remains unverified.

## MANUAL VALIDATION REQUIRED

- Development deployment was not executed in this QA scope. After deployment,
  exercise `GET /api/ai/weekly-insight` with the approved training-day fixture
  and confirm the response uses prompt version `v3` and does not claim an
  exceedance for the 99/90/81% days. Result: pending deployment.

## Findings

No actionable findings.
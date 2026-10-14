# QA Report: Macro Target Ranges and Visualization

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/PLAN_US_Makro-Zielbereiche-und-Visualisierung.md`
- Verdict: `PASS`

## Scope

This is the targeted follow-up for `FT-QA-2026-123` / `QA-MR-02`. The full cross-package acceptance evidence below is carried forward from the prior independent review; this follow-up rechecked the current approved plan and corrected Daily Insight fixture. No application code, `docs/qa/findings.md`, infrastructure, or dependencies were changed by this QA run. No deployment or remote Cosmos access was attempted.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `shared/lib/profileCalculator.test.ts` verifies separate rest/training ranges and preserved scalar targets; `backend/src/functions/profile.test.ts` covers Profile GET/POST/PUT/preview. |
| AC-2 | PASS | `shared/lib/profileCalculator.test.ts` covers protein-first rounding, carb bounds, zero clamp, and each day's own calories/fat. |
| AC-3 | PASS | `backend/src/functions/diary.ts` selects the profile day and changes only effective calories for hints; `backend/src/lib/dailyInsightContext.test.ts` verifies unchanged selected ranges with a bonus; Mobile tests keep the bonus separate from macro ranges. |
| AC-4 | PASS | `shared/lib/profileCalculator.test.ts` checks existing scalar calculations; `backend/src/functions/specialActivity.test.ts` covers bonus calculation; `mobile/src/modules/home/DayNutritionCard.test.tsx` verifies the effective calorie target and ring remain unchanged. |
| AC-5 | PASS | `backend/src/functions/profile.test.ts` covers all four Profile responses and legacy in-memory derivation without changing scalar values. The Cosmos read/no-write contract exists but is `UNVERIFIED` because no local emulator is listening. |
| AC-6 | PASS | `shared/lib/profileCalculator.test.ts` covers inclusive 1.5/2.0 and 2.2 g/kg boundaries; `backend/src/lib/hintEngine.test.ts` covers the 2.2 coaching threshold and cooldown; `backend/src/lib/dailyInsightValidation.test.ts` covers the 20 g recommendation lock. |
| AC-7 | PASS | `backend/src/lib/hintEngine.test.ts` covers range-aware macro hints; the live v18 eval passed both below-range and above-range carbohydrate fixtures. |
| AC-8 | PASS | Backend context, cache identity, validation, prompt, and live eval checks pass; `mobile/src/modules/home/getDayHint.test.ts` and `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx` cover range-based coaching and today's Profile API target selection. |
| AC-9 | PASS | `backend/src/lib/dailyInsightContext.test.ts` covers historical target provenance; `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx` and `mobile/src/shared/components/DayStoryCard.test.tsx` verify historical days do not receive current macro targets. |
| AC-10 | PASS | `mobile/src/modules/profile/ProfileWizardScreen.test.tsx` and `ProfileDetailsScreen.test.tsx` show both day ranges; `DiaryScreen.f2.test.tsx` verifies today's selected day and historical target absence; `DayStoryCard.test.tsx` covers ranges and breakdown. Diary GET source omits targets, but the explicit API absence assertion is tracked under AC-13. |
| AC-11 | PASS | `mobile/src/modules/home/dayNutritionTrackGeometry.test.ts` verifies the 2/3 reference, 150% scale, range hatch, fixed markers, zero intake, and render-only clamping; `DayNutritionCard.test.tsx` verifies accessible exact values, aligned markers, unchanged colors, and no status/percentage text. |
| AC-12 | PASS | `dayNutritionTrackGeometry.test.ts` covers zero-consumption visibility and the bonus's independent 100% scale; `DayNutritionCard.test.tsx` verifies the separate kcal row, activity accent, and accessible kcal values. |
| AC-13 | PASS | Profile contracts remain additive and legacy scalar meanings are preserved. `backend/src/functions/diary.ts` omits `targets` and `macroRanges`, and `shared/types/diary.ts` excludes them. Handler tests serialize and parse real `jsonBody` values and assert both top-level fields are absent for ordinary and special-activity days; both focused regressions pass. |
| AC-14 | PASS | Existing full-review evidence remains recorded below. Follow-up: the legacy scalar-target activity fixture in `backend/src/lib/prompts/dailyInsightPrompt.test.ts` uses `satisfies InsightInputContext`, and its focused test file passes 42/42. The test-source typecheck reports no diagnostic in that file; 46 remain elsewhere and are outside QA-MR-02. Cosmos and physical-device checks are separately disclosed below. |

## Tests

Full-suite, production-typecheck, build, offline prompt guard, live-eval, and environment-limit evidence below is carried forward from the prior independent review and was not rerun in this targeted follow-up. This follow-up independently reran the focused prompt test and supplemental test-source typecheck.

| Command | Exit code | Result |
|---|---:|---|
| `npx vitest run src/functions/diary.test.ts -t 'serializes an ordinary-day response|serializes a special-activity-day response' --reporter=dot --no-color --silent` (cwd `backend/`) | 0 | 2 passed; 64 skipped (66 tests in file). |
| `npx vitest run src/lib/prompts/dailyInsightPrompt.test.ts --reporter=dot --no-color --silent` (cwd `backend/`) | 0 | 1 file; 42 tests passed, including the corrected legacy scalar-target activity fixture. |
| `npx vitest run --reporter=dot --no-color --silent` (cwd `backend/`) | 0 | 70 files; 1,742 tests passed (carried forward; not rerun in this follow-up). |
| `npx vitest run --reporter=dot --no-color` (cwd `shared/`) | 0 | 10 files; 461 tests passed (previous report; unchanged). |
| `npx vitest run --reporter=dot --no-color --silent` (cwd `mobile/`) | 0 | 80 files; 773 tests passed (previous report; unchanged). |
| `npx tsc --noEmit` (cwd `backend/`) | 0 | Production typecheck passed in the prior review; not rerun in this follow-up. |
| `npx tsc --noEmit` (cwd `shared/`) | 0 | Typecheck passed (previous report; unchanged). |
| `npx tsc --noEmit` (cwd `mobile/`) | 0 | Typecheck passed (previous report; unchanged). |
| `npx tsc --noEmit -p tsconfig.test.json` (cwd `backend/`, supplemental) | 2 | 46 TypeScript diagnostics across 30 file/code groups in test sources; zero in `dailyInsightPrompt.test.ts`. The remaining diagnostics are outside the corrected finding; this is not the prescribed production typecheck. |
| `npm run build:verify --workspace=backend` | 0 | Backend build and shared-import verification passed in the prior review; not rerun in this follow-up. |
| `npm run verify:daily-insight-prompt --workspace=backend` | 0 | Offline release guard passed; manifest and active v18 fingerprint verified (previous report; unchanged). |
| `npm run test:eval --workspace=backend -- --reporter=dot --no-color` | 0 | 5 eval files; 51/51 assertions passed (previous report; WP-B2 prompt/eval inputs unchanged). |
| `npx vitest run --config vitest.contract.config.mts` (cwd `backend/`) | N/A | Not run; the local Cosmos emulator was unavailable. See Verification Notes. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: `127.0.0.1:18081` (local emulator mapping) and `127.0.0.1:8081` both refused TCP connections. No contract tests were run and no remote Cosmos environment was used.
- Manual action: Start the local Cosmos emulator, then run `npx vitest run --config vitest.contract.config.mts` from `backend/`. Expected result: reading a seeded legacy profile derives both day ranges without writing `macroRanges` back to storage. Result: `NOT RUN`.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: Physical-device viewport, enlarged-font, and screen-reader checks were not performed.
- Manual action: On a small and a large supported device viewport, inspect profile, today's diary, and Home with larger text; verify the four macro bars, over-range values, and the activity row at zero and positive consumption. Use VoiceOver or TalkBack to confirm exact macro range/value and bonus kcal labels. Expected result: no overlap, aligned markers, unclipped actual/accessibility values, and no macro semantics on the bonus row. Result: `NOT PERFORMED`.

## Follow-up Status

- Work item: `FT-QA-2026-123`
- Finding: `QA-MR-02`
- Result: **Verified closed.** The current legacy activity fixture in `backend/src/lib/prompts/dailyInsightPrompt.test.ts` uses `satisfies InsightInputContext`, retains the legacy scalar targets, and omits `macroRanges`. The focused prompt suite passes 42/42, and the test-source typecheck reports no diagnostics in that file.
- Remaining type diagnostics: The supplemental test-source typecheck still exits 2 with 46 diagnostics across unrelated test files; the prior report recorded 47, including the corrected diagnostic. These remaining errors are outside QA-MR-02 and do not fail the prescribed production typecheck or the previously passing Backend suite/build. No new actionable finding is raised in this targeted follow-up.
- Verdict change: The overall verdict changes to `PASS` because QA-MR-02 was the only actionable finding in the prior report and its correction is verified. Cosmos and physical-device limitations remain separately recorded above.

## Findings

No actionable findings.
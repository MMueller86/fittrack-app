# QA Report: US-03 Dynamische KI-Begrüßung mit FitTrack Insight (Revision 2)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md`
- Verdict: `FAIL`

Review: Q-1 independent review, 2026-10-20, against the 16 acceptance criteria of `docs/User Stories/startpage/US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md`. No report path was supplied; the plan-file-stem path was used. The earlier report `docs/qa/reports/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md` belongs to the first plan (v23 lineage) and is not replaced.

## Scope

Reviewed: backend context/intent/prompt/validator/eval/manifest, `backend/src/lib/openai.ts`, shared types, mobile Home (`HomeScreen.tsx`, `CoachingHeroCard.tsx`, `InsightCard.tsx`, `insightService.ts`), KB (`domain/09-daily-insight.md`, index, cross references, archive), the B-1 and F-1 handoffs and the plan/story status documents.

Out of scope: Weekly Insight, deployment, infrastructure, Cosmos emulator contract tests, unrelated uncommitted worktree changes (for example `ProgressHeroCard`), Recipe/Preparation KB sections.

Context for the review: B-1 was accepted by user decision on 2026-10-20 on reduced criteria (the runtime validator was reduced to schema, CTA pairing, greeting/short-insight structure, and supplied calorie numbers; the Daily live eval asserts structure and supplied numbers only). That decision is recorded in the first plan and the B-1 handoff, not in the v2 plan or story. This report measures the implementation against the v2 criteria as written and reports the result.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | One Structured Output call carries greeting, `shortInsight`, title, summary (`backend/src/lib/openai.ts`, `backend/src/lib/dailyInsightSchema.ts`); `backend/src/lib/openai.daily.test.ts` pins schema and single call. |
| AC-2 | PASS | Format/length limits 120/240/40/5,000 and one-sentence structure in `backend/src/lib/dailyInsightValidation.ts`; boundary tests in `backend/src/lib/dailyInsightValidation.test.ts` (240/241, 5,000/5,001, sentence cases). |
| AC-3 | UNVERIFIED | Server supplies goal, effective target and `remainingCalories`; the "within target is not too much / over target is stated supportively" behavior exists only as prompt text (`backend/src/lib/prompts/sharedTone.ts`). No deterministic or eval check covers it. See finding F1. |
| AC-4 | PASS | Server classification 1.5/2.0/2.5 g/kg and unknown on missing/stale weight (`backend/src/lib/dailyInsightContext.ts`, tests in `backend/src/lib/dailyInsightContext.test.ts`); prompt separates protein status from meal permission (`promptNutrition.ts`). Prompt has no guidance for `above_range`/`at_or_above_2_5_g_per_kg` (optional, see F5). |
| AC-5 | FAIL | `mealAdviceAllowed` is computed correctly (three typed meals with items, at least 300 kcal; `dailyInsightContext.test.ts`), but nothing enforces it on the model output: no runtime reference outside the prompt (`grep mealAdviceAllowed backend/src`). The plan requires a server-side, non-bypassable limit (plan sections 6.6 and 12). See F1. |
| AC-6 | FAIL | Prompt makes fueling hints mandatory for "long or intensive" activity without the 180-minute threshold (`backend/src/lib/prompts/promptActivity.ts`), and the rulebook documents that requirement. The story requires optional hints for activities of at least 180 minutes only. See F2. |
| AC-7 | PASS | Past activity completed; today completed only at local hours 22-23, otherwise `unknown` (`resolveDailyInsightActivityStatus`; tests for 21/22 and past/future dates in `dailyInsightContext.test.ts`). |
| AC-8 | UNVERIFIED | Server supplies `weeklyTrend30d`, `daysSinceLastMeasurement`; stale-weight and no-invented-trend behavior are prompt text only (`sharedTone.ts`, `promptWeight.ts`) with no deterministic or eval check. See F1. |
| AC-9 | UNVERIFIED | Data is no longer suppressed by intent (provider projection keeps nutrition for weight intents), but the fixed six-intent routing and "Verbindlicher Intent" prompt section remain (`backend/src/lib/dailyInsightIntent.ts`, `dailyInsightPrompt.ts`). Whether outputs combine signals is not verified. See F4. |
| AC-10 | PASS | `HomeScreen.insight.test.tsx` and `CoachingHeroCard.test.tsx`: `null`, `unavailable`, `quota_exceeded`, missing/blank/over-length fields show only the static greeting without short text or "Mehr lesen"; no extra request. |
| AC-11 | PASS | `CoachingHeroCard.test.tsx` and `HomeScreen.insight.test.tsx`: detail opens from a local snapshot, refresh does not swap it, no request on open; CTA and feedback paths in `InsightCard.test.tsx`. |
| AC-12 | PASS | `HomeScreen.tsx` no longer imports or renders `InsightCard`; `HomeScreen.layout.test.ts` asserts it; selector stays in the hero card row (`CoachingHeroCard.test.tsx`). |
| AC-13 | UNVERIFIED | Device matrix (320/360 dp, font scale 1.0/1.3, TalkBack, Safe Area, Android back) not executable here; see manual checklist. Unit tests cover 48 dp `minHeight`, no `numberOfLines` on the short insight, 120/240 limits. |
| AC-14 | FAIL | Covered: format/limits, 300 kcal and three-meal rule, protein boundaries, activity 21:59/22:00, past activity. Not covered by any deterministic test: calories within/at/over target, contradictory remainder, weight day 14/15 and missing 30-day trend. See F1. |
| AC-15 | UNVERIFIED | B-1 handoff records 10 consecutive Daily-only runs on v28 (`docs/User Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md`), source hashes of three files match the current files; the run logs are stored outside the repository and cannot be independently confirmed. QA ran the full `npm run test:eval` once (exit 0). The runs assert structure only. See F3. |
| AC-16 | PASS | `docs/kb/domain/09-daily-insight.md` exists, is indexed in `docs/kb/README.md`, and the Daily sections of `domain/02-diary.md`, `domain/07-ai-features.md`, `tech/04-shared-library.md`, `tech/06-ai-integrations.md`, `tech/08-testing.md`, `tech/09-api-reference.md` reference it; historical text moved to `docs/kb/archive/daily-insight-history-2026-10.md`; identity v28 / prompt v27 / assembly v12 matches `dailyInsightPromptManifest.ts`. The rulebook itself repeats the F2 deviation. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run` | 0 | 71 test files passed |
| `cd backend && npx tsc --noEmit -p tsconfig.json` | 0 | no errors |
| `cd backend && npm run build:verify` | 0 | all checks passed |
| `cd backend && npm run verify:daily-insight-prompt` | 0 | v28 `sha256:73525f3f417265ff42f9069b2d4bb6394ef6edef0757ad9417be6c886041ca2c`, 5 base releases, provider input changed |
| `cd backend && npm run test:eval` | 0 | 5 test files passed (live, structure/number assertions only) |
| `cd shared && npx vitest run` | 0 | 10 test files passed |
| `npm run typecheck --workspace=@fittrack/shared` | 0 | no errors |
| `cd mobile && npx vitest run` | 0 | 89 test files passed |
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | no errors |
| `node scripts/check-encoding.mjs` | 0 | passed |

Prompt eval verification: `TESTED_PROMPT_VERSION` in `backend/src/lib/prompts/dailyInsight.eval.test.ts` is `v27` and matches `DAILY_INSIGHT_PROMPT_VERSION`; the eval was run and passed.

## Verification Notes

- State: `MANUAL VALIDATION REQUIRED` (AC-13)
- Reason: no physical Android device, TalkBack, or viewport tooling in this environment.
- Manual action: on a physical Android device, for widths 320 and 360 dp and font scale 1.0 and 1.3, open Home with (a) a 120-character greeting plus 240-character short insight and (b) a long display name. Expected: no overlap with the day-type selector, no horizontal scroll, no truncated sentences, "Mehr lesen" and selector at least 48 dp, "Mehr lesen" opens the full 5,000-character summary scrollable, Android back/backdrop closes it, TalkBack reads greeting, short insight and actions in order, Safe Area respected. Result: ______
- State: `UNVERIFIED` (generated content quality)
- Reason: the validator no longer checks wording and the live eval asserts no wording, so no automated evidence exists that the model follows the prompt rules for AC-3, AC-6, AC-8, AC-9.
- Manual action: review the saved `backend/output/daily-insight-v27-*.json` artifacts of a fresh run against the story rules. Result: ______
- State: `UNVERIFIED` (persistence)
- Reason: Cosmos emulator contract tests were excluded by the user and not run; no real Cosmos round trip is proven.
- Out of scope observation: four links to `tech/06-ai-integrations.md#preparation-feedback-loop-current-r3-qa-r1` (Recipe/Preparation) do not resolve; this predates the change.

## Findings

Finding key: F1-hard-limits-prompt-only
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (sections 6.6, 11, 12)
Acceptance criterion: AC-3, AC-5, AC-8, AC-14
Description: The plan requires hard, data-based server limits (meal advice only with three maintained meals and at least 300 kcal "not bypassable on the server", calorie relation, no stale/invented weight claims) and offline tests for them. The runtime validator now checks only schema, CTA pairing, greeting/short-insight structure and supplied calorie numbers, and the live eval asserts no behavior. `mealAdviceAllowed` is only a prompt instruction, so a model response can recommend food when the server denied it, and no test or eval detects that. The reduction was a user decision recorded in the first plan and the B-1 handoff, not in the v2 plan or story acceptance criteria.
Criticality: Blocking
Owner: Planner (decision), then Backend
Evidence: `backend/src/lib/dailyInsightValidation.ts` (no content rules); `grep mealAdviceAllowed backend/src` shows no runtime use outside prompts; `backend/src/lib/prompts/dailyInsight.eval.test.ts` (no content assertions); `docs/kb/domain/09-daily-insight.md` section "Server Validation Scope".
Recommendation: Either amend the v2 plan and story criteria (AC-3, AC-5, AC-8, AC-14 and plan sections 6.6/12) to the accepted reduced scope, or add minimal deterministic, non-lexical enforcement (for example the server removes `recommendation`/`cta` when `mealAdviceAllowed` is false) with offline tests for calorie relation, 299/300 kcal, and weight day 14/15.

Finding key: F2-activity-hints-mandatory
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (section 4, story 4.5)
Acceptance criterion: AC-6
Description: The story allows optional energy/fluid/recovery hints for special activities of at least 180 minutes and states there is no obligation. The prompt makes the three hints mandatory for any "long or intensive" activity and explicitly forbids deriving a numeric threshold; no 180-minute threshold exists in context or prompt. The rulebook documents the mandatory behavior.
Criticality: Blocking
Owner: Backend
Evidence: `backend/src/lib/prompts/promptActivity.ts` (lines on "Fueling-Hinweis verpflichtend" and "keine neue numerische Schwelle"); `docs/kb/domain/09-daily-insight.md` section "Activity and Weight".
Recommendation: Change the activity module to optional hints gated by a server-supplied 180-minute flag, limited to special activities, and update the rulebook; this is a prompt change and requires a new release identity.

Finding key: F3-gate-evidence
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (sections 7 and 11)
Acceptance criterion: AC-15
Description: The ten-run series is referenced by log files outside the repository, so QA cannot independently confirm run identity, count, or pass state. The recorded hashes cover three source files only (not `backend/src/lib/openai.ts` or the prompt sources). The series asserts only structure and supplied numbers, so it no longer evidences the story's behavioral boundaries.
Criticality: Non-blocking
Owner: Documentation
Evidence: `docs/User Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md` (first section); `backend/src/lib/prompts/dailyInsight.eval.test.ts`.
Recommendation: Record per-run results, timestamps, and the full source/fixture hash set in the repository (for example a JSON evidence file under `backend/output/` referenced by the handoff) and state explicitly in the plan that the gate measures format only.

Finding key: F4-intent-routing-remains
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (sections 4 and 6.4)
Acceptance criterion: AC-9
Description: The story states there is no exclusive intent ranking. The code still selects exactly one of six intents in a fixed priority order, and the prompt contains a "Verbindlicher Intent" section and intent-specific modules with guards (for example `phase_progress` open-day text). Data is no longer removed by intent, but the routing and priority semantics remain.
Criticality: Non-blocking
Owner: Planner
Evidence: `backend/src/lib/dailyInsightIntent.ts`; `backend/src/lib/prompts/dailyInsightPrompt.ts` (`## Verbindlicher Intent`, `phaseProgressOpenDay`).
Recommendation: Decide whether the retained intent focus meets the criterion; if not, create a Backend task to replace intent modules with one combined module.

Finding key: F5-protein-high-guidance
Plan reference: `docs/User Stories/startpage/US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (4.3)
Acceptance criterion: AC-4
Description: The server provides `above_range` and `at_or_above_2_5_g_per_kg`, but the prompt modules give no guidance for them (optional non-alarmist note at 2.5 g/kg and above, no warning between 2.0 and 2.5), and no eval fixture uses these states.
Criticality: Suggestion
Owner: Backend
Evidence: `backend/src/lib/prompts/promptNutrition.ts`, `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`.
Recommendation: Add short prompt guidance and one fixture each for `above_range` and `at_or_above_2_5_g_per_kg`.

Finding key: F6-plan-status-inconsistency
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md`, `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md`
Acceptance criterion: N/A
Description: The plan documents contradict each other. The v2 plan and story are `DRAFT` with "no implementation release" while B-1 and F-1 were executed. The first plan's header still says "F-1 not started; B-1 open/not accepted" although a later section of the same file records the 2026-10-20 acceptance; its acceptance criteria (AC-1..8, v23 lineage) differ from the 16 v2 criteria; the v2 plan requires a strict 10/10 gate while the accepted gate is reduced. The B-1 handoff keeps many dated sections with older "NOT ACCEPTED" statuses.
Criticality: Non-blocking
Owner: Planner
Evidence: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` line 3; `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md` line 3 versus its "Backend Gate Update (2026-10-20, user decision, current)" section; `docs/User Stories/startpage/US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` line 3.
Recommendation: Decide which plan is authoritative, update its status and acceptance criteria to the accepted reduced scope, and mark the other as superseded.

Finding key: F7-loading-flicker
Plan reference: `docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md` (F-1)
Acceptance criterion: AC-10
Description: On every focus and pull-to-refresh `HomeScreen` resets the insight to `null` before the request returns, so the coaching card switches from the AI greeting to the static greeting and back, and the short insight disappears while loading. A test asserts this behavior.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/home/HomeScreen.tsx` (`setInsight(null)` in `load`); `mobile/src/modules/home/HomeScreen.insight.test.tsx` ("ignores an older overlapping response ...").
Recommendation: Keep the previous valid pair until the new response arrives (the open detail already uses a snapshot), after confirming this is consistent with the acceptance criteria.

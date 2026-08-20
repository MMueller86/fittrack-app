# QA Report: Home-Screen Insights and Feedback Correction Review

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- Verdict: `PASS`

## Scope

This is the dedicated correction review for the Home-Screen Daily Insight and
feedback feature. The review covers the baseline behaviour, the timezone and
TTL correction, the stale-weight validator/generator/handler regression, the
real `InsightCard` component test, the API/Cosmos contract, the Knowledge Base
handoff, and the four prior correction findings.

QA did not edit production code, the plan, or `docs/qa/findings.md`. Only this
expected QA report was updated. The local Cosmos emulator and a native Mobile
device or preview were unavailable; those checks are recorded separately and
do not represent actionable product findings.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Deterministic outlier context, goal-aware trend handling, tone validation, and the live `weight-outlier-context` scenario pass. |
| AC-2 | PASS | The direct validator keeps the 14-day boundary, rejects stale-as-current weight language after 14 days, and the stale live fixture passes. |
| AC-3 | PASS | Effective activity targets and remaining budget are covered by context tests and the complete live evaluation. |
| AC-4 | PASS | Snapshot-first historical target resolution is covered by Daily context tests and the historical-effective-target evaluation case. |
| AC-5 | PASS | Zero-kcal MealItems are distinguished from missing MealItems in Daily context and shared calculation tests. |
| AC-6 | PASS | Planned, likely-completed, unknown, invalid-hour, historical-date, and 19/20 boundary behaviour is covered by context tests and evaluations. |
| AC-7 | PASS | Activity prompt modules and semantic validation enforce planned/unknown language and uncertainty for likely-completed activity; the activity evaluations pass. |
| AC-8 | PASS | The intensive-endurance evaluation verifies qualitative energy/fueling, fluid, and recovery language; domain approval remains a manual Alpha gate. |
| AC-9 | PASS | Budget, nearly-complete protein, and open protein-gap scenarios pass the complete live evaluation and server semantic validation. |
| AC-10 | PASS | Empty-morning intent and historical orientation are covered without treating an empty current day as a deficit. |
| AC-11 | PASS | Outlier, stale-weight, activity, budget, forbidden-language, and tone assertions pass in unit tests and the complete evaluation. |
| AC-12 | PASS | Intent priority and activity precedence are deterministic in unit tests and reflected in the live fixtures. |
| AC-13 | PASS | Daily generation uses strict `json_schema` output with `strict: true`, required nullable provider fields, and closed objects. |
| AC-14 | PASS | Provider failure, malformed JSON, schema failure, filtering/truncation, and semantic rejection are tested; invalid output is unavailable, not persisted, and not tracked. |
| AC-15 | PASS | Handler tests cover authentication, quota-before-generation, HTTP 200 failure responses, persistence, and post-persistence usage tracking. |
| AC-16 | PASS | Input hashing, prompt/version invalidation, local-time buckets, activity markers, and cache semantics pass; the old offset divergence is corrected. |
| AC-17 | PASS | Daily persistence includes discriminator, context, response, intent, prompt snapshot, model, hash, tokens, and intelligence version. |
| AC-18 | PASS | Unit repository tests cover legacy reads and Daily/feedback discriminator isolation; live Cosmos execution is separately `UNVERIFIED`. |
| AC-19 | PASS | Feedback handler tests cover JWT enforcement, real dates, canonical timestamps, UUIDs, strict request bodies, trimming, and 1/500-character limits. |
| AC-20 | PASS | Feedback tests cover missing Insight, generation mismatch, and incomplete feedback provenance responses. |
| AC-21 | PASS | Lookup-before-Daily-read, identical retry idempotency, changed-body conflict, and repository conflict behaviour are tested. |
| AC-22 | PASS | Independent submission IDs create separate negative snapshots and no positive feedback path is stored. |
| AC-23 | PASS | Feedback snapshot tests verify the trimmed comment, exact response and prompts, versions, intent, context, hash, model, tokens, identity, and server timestamp. |
| AC-24 | PASS | Unit tests and documentation preserve Daily TTL while feedback has no `ttl` or `expiresAt`; live Cosmos execution is separately `UNVERIFIED`. |
| AC-25 | PASS | Server-owned feedback capability is true only for complete fresh/cached instances and false for legacy, unavailable, quota, or incomplete instances. |
| AC-26 | PASS | The actual `InsightCard.test.tsx` render/interaction matrix executes successfully; native device/preview validation remains manual. |
| AC-27 | PASS | Backend, shared, and Mobile regressions, typechecks, build verification, encoding, route registration, and Knowledge Base handoff pass; release operations remain manual. |
| AC-28 | PASS | Handler normalization accepts only integer offsets in `-840..840`, uses local-minus-UTC direction, maps invalid/missing input to `null`, and does not clamp or return a sole 400. |
| AC-29 | PASS | Handler and repository tests calculate local date from backend `now + offset`, cover local/UTC boundaries and `-840/840`, and gate Activity status on the current local date. |
| AC-30 | PASS | Missing and invalid offsets use the tolerant UTC fallback and cannot create an unsupported local completion assertion. |
| AC-31 | PASS | Local-midnight `expiresAt` and upward TTL agree for valid offsets; invalid/missing offsets use UTC fallback and feedback remains without TTL fields. |
| AC-32 | PASS | The normalized offset is part of the input hash and a changed offset invalidates a prior cache instance. |
| AC-33 | PASS | API, AI, and domain Knowledge Base documents now describe offset direction/range, fallback, Current-Day handling, and local-midnight TTL without the former divergence. |
| AC-34 | PASS | Credential-free direct validation rejects current weight/trend wording for stale context and accepts explicit stale markers, with the 14/15 boundary covered. |
| AC-35 | PASS | Credential-free `generateDailyInsight()` tests inject mocked provider responses for both stale cases and exercise strict output plus semantic validation together. |
| AC-36 | PASS | Handler regression tests prove HTTP 200 `unavailable`, no Daily persistence, and no usage tracking for rejected stale output; accepted stale-marked output persists and tracks normally. |
| AC-37 | PASS | The stale fixture uses `phase_progress` and the weight module; the global stale guard is included in every v11 intent snapshot, the bad/provider-marked cases are explicit, and the v11 eval guard passes without loosening validation. |
| AC-38 | PASS | `mobile/src/modules/home/InsightCard.test.tsx` is included by Mobile Vitest and executed directly: 1 file and 16 tests passed. |
| AC-39 | PASS | The component matrix verifies trigger visibility for fresh/cached/provenanced instances and invisibility for skeleton, quota, unavailable, missing date, and false provenance. |
| AC-40 | PASS | The component matrix verifies sheet opening, trimming and length limits, pending lock, stable retry ID, changed-comment ID rotation, success closure/callback, and `created: false`; HomeScreen maps the callback to the existing Success Snackbar. |
| AC-41 | PASS | The component matrix verifies all four required 404/409 error paths, comment retention, retry rules, and absence of a success callback on failure. |
| AC-42 | PASS | The persisted plan has `[Correction Approved]`, approval traceability and interpretation, the baseline remains present, and the document ends with the correction handoff. |
| AC-43 | UNVERIFIED | QA evidence and this report are complete. Dev deployment/release validation and the final Infrastructure decision were not executed in this local review; the required manual gate is listed below. |

## Regression Evidence

### Stale-weight safety path

- The stale fixture selects `phase_progress`, which maps to
  `DAILY_INSIGHT_WEIGHT_MODULE` through `backend/src/lib/prompts/dailyInsightV10.ts`.
- `DAILY_INSIGHT_SHARED_TONE` applies the stale guard globally, including the
  `nutrition_guidance` intent. The active prompt version is `v11`, and the
  eval version guard also requires `v11`.
- The direct validator rejects a stale context with current wording such as
  `Dein Gewicht ist heute klar gesunken.` and accepts an explicit marker such
  as `Der Trend deines Gewichts ist nicht aktuell.`.
- The mocked-provider generator test exercises both responses through strict
  Structured Outputs, JSON parsing, schema validation, and semantic
  validation without Azure credentials.
- The handler test returns HTTP 200 with `status: unavailable` for rejected
  stale output, verifies no Daily document and no `trackUsage()` call, and
  separately verifies normal persistence and tracking for an accepted stale-
  marked response.
- The full live evaluation also passed its stale fixture. This live result is
  supplementary; the credential-free tests provide the deterministic safety
  proof.

### Timezone, TTL, and cache path

- Normalization tests cover `-840`, `0`, `840`, missing, fractional,
  non-numeric, and out-of-range values without clamping.
- Current-day tests cover UTC-boundary transitions, extreme offsets, past and
  future dates, and invalid/missing fallback behaviour.
- Handler tests verify local-midnight expiry, upward TTL rounding, UTC fallback,
  and offset-driven cache invalidation.
- Repository hash tests prove invalid offsets are normalized before hashing and
  valid offset changes produce a different cache key.

### Component path

The direct command `cd mobile && npx vitest run
src/modules/home/InsightCard.test.tsx` executed the real component render and
interaction path. All 16 tests passed. The full Mobile suite also discovered
and passed this `.test.tsx` file.

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/dailyInsightValidation.test.ts src/lib/openai.daily.test.ts src/functions/dailyInsight.test.ts` | 0 | 3 files passed, 45 tests passed; direct stale, mocked generator, offset, handler, persistence, and tracking regressions passed. |
| `cd backend && npx vitest run --reporter=dot --silent` | 0 | 43 files passed, 881 tests passed. |
| `cd shared && npx vitest run` | 0 | 8 files passed, 437 tests passed. |
| `cd mobile && npx vitest run src/modules/home/InsightCard.test.tsx` | 0 | 1 file passed, 16 tests passed. |
| `cd mobile && npx vitest run --reporter=dot --silent` | 0 | 32 files passed, 384 tests passed. |
| `cd backend && npx tsc --noEmit` | 0 | No TypeScript errors. |
| `cd shared && npx tsc --noEmit` | 0 | No TypeScript errors. |
| `cd mobile && npx tsc --noEmit` | 0 | No TypeScript errors. |
| `cd backend && npm run build:verify` | 0 | TypeScript build, module-resolution check, and duplicate Azure Function ID check passed. |
| `cd backend && npm run test:eval` | 0 | 4 eval files passed, 26/26 scenarios passed, including the stale-weight fixture. |
| `cd backend && npx vitest run --config vitest.contract.config.mts` | 1 | 7 suites failed during setup and 58 tests were skipped because the local Cosmos emulator was unavailable at `127.0.0.1:18081`; see Verification Notes. |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed. |
| `git diff --check` | 2 | Trailing whitespace was reported in already modified plan lines. QA did not edit the plan; no runtime or acceptance defect was identified from this hygiene-only result. |

## Verification Notes

- State: `UNVERIFIED`
  Reason: The local Cosmos emulator was not reachable at
  `http://127.0.0.1:18081`; all contract suites stopped during setup.
  Manual action: Start the approved emulator with
  `backend/scripts/start-cosmos-emulator.ps1`, then run
  `cd backend && npx vitest run --config vitest.contract.config.mts`.
  Expected result: discriminator isolation, user isolation, feedback no-TTL,
  idempotency/conflict, and Daily expiry-preservation contract tests pass.

- State: `MANUAL VALIDATION REQUIRED`
  Reason: No React Native device or preview runtime was available.
  Manual action: Exercise fresh/cached, skeleton, quota, unavailable, legacy,
  404, 409, retry, changed-comment, keyboard, accessibility, Snackbar, and
  Activity/Health Connect regression flows in a Mobile dev or preview build.
  Expected result: the rendered feedback state machine matches the executable
  component matrix and the existing HomeScreen Snackbar appears once on
  successful submission.

- State: `MANUAL VALIDATION REQUIRED`
  Reason: Domain gates and deployed release operations were not part of this
  local QA run.
  Manual action: Obtain domain approval for the activity heuristic and
  wording, endurance fueling/recovery language, and weight/calorie/motivation
  phrasing; run the documented Dev release checks and confirm the final
  Infrastructure decision is `Dev Build Required: NO`. Do not deploy Alpha
  without the existing operational Auftrag and the remaining gates.

## Finding Reconciliation

These are recommendations to the Orchestrator. The central findings register
was not edited by QA.

| Finding | Verified correction evidence | Recommendation |
|---|---|---|
| FT-QA-2026-012 | Offset normalization, local Current-Day/TTL tests, cache invalidation tests, and updated API/AI/domain documentation pass. | Close the finding after recording this evidence. |
| FT-QA-2026-013 | The real `InsightCard` render/interactions execute in 16 passing tests and `.test.tsx` is included in the full Mobile run. | Close the finding after recording this evidence; retain native preview checks as manual validation. |
| FT-QA-2026-014 | The persisted plan contains the corrected approval status, traceability, baseline, and correction handoff. | Close the finding through the normal Planner/Orchestrator process. |
| FT-QA-2026-015 | The prior runtime-log conflict is addressed by passing direct validator, mocked generator, handler no-persist/no-track, accepted-persist/track, and full live-eval evidence. | Retain or restore `Closed` after attaching this deterministic evidence and the prior-runtime-log reconciliation. |

## Findings

No actionable findings.
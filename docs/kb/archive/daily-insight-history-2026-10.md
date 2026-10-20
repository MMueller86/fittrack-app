# Daily Insight History Archive (2026-10)

Status: Historical record. This file holds Daily Insight evidence and contract text
moved out of the current Knowledge Base pages on 2026-10-20. Nothing here describes
current behavior; the current rules are in
[domain/09-daily-insight.md](../domain/09-daily-insight.md). Texts are verbatim; they
mention validator rules, gates, and results of earlier prompt releases (v17 to v23)
that no longer apply.

## domain/07-ai-features.md - Daily Insight

### Block 1

[Historical] Q1 correction attempt1 uses v23/assembly v6. Runtime rejects the exact
Q1 protein-increase/reach advice, weight-focus nutrition side topics, unknown
current meal space and contradictory stable-weight claims. Activity completion
is checked locally in short/full claims, including historical participation;
recorded activity alone is not completion evidence. Correct intake/remainder
compound clauses pass while swapped values still reject. The eight original
payloads and unchanged fixtures have permanent regressions. These are bounded
language checks, not a complete German semantic parser or content certification.
Current units1925 Backend/466 Shared, typechecks/build/guard pass. Required full
live fails68/8,exit1,0 skipped/todo. New stale-weight/midday/historical completion
and inconsistent-budget outputs still fail safely; an accepted meal-planning
variant under protein lock remains unsafe. FT135-138 are not fully corrected;
FT139 is corrected pending independent verification. No reroll or release.
See the [current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
for exact outputs, independent-rubric false positives and candidate hashes.
API/context/cache/quota/feedback/storage remain unchanged; emulator excluded.

[Historical] The v23/v5 residual repair distinguishes the recorded protein
planning denial and direct eating denial from advice, without accepting their
actual positive counterparts. Negative budgets with inconsistent input arithmetic
retain their lock; unsupported current calorie numbers reject. Prompt context
requests uncertainty rather than a fabricated calculation, and final weight focus
repeats the abstract-phrase prohibition. Independent fixtures/rubric remain intact.
Current gates: **1899 Backend / 466 Shared**, typechecks/build/guard PASS;
one complete live **69 pass / 1 fail**, exit1, no skipped/todo. Budget still invents
`1500 above 2000`, correctly rejected. Formal phase PASS is not semantic success:
it recommends `Proteinaufnahme zu erhöhen` at gap20, an existing validator/rubric
coverage hole confirmed by offline replay. That advice remains prohibited and
is not accepted. After three repair cycles B-1/F-1 remain blocked; no reroll.
See the [current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
for candidate binding and exact outstanding boundaries. API/cache/quota/feedback/
storage remain unchanged; emulator is excluded/UNVERIFIED, not itself a blocker.
The following results are historical.

[Historical] The earlier v23 follow-up fixes the recorded false positive for
`keine zusätzliche proteinreiche Mahlzeit nötig`. Only directly negated
protein-meal need at a sentence end is excluded from positive-action matching;
each other match and field remains checked. Genuine/mixed/following advice,
20-g lock and calorie/action limits are unchanged. Original payload replay and
counterexamples pass; 1879 Backend / 466 Shared units, typechecks, build and
release guard pass. Complete new live is **67 pass / 3 fail / 0 skipped**,
exit 1; `current-effective-activity-budget` passes. Other fixtures fail for a
different negation construction, prohibited `positive Entwicklung`, and the
budget lock (negative wording plus contradictory generated calorie arithmetic).
Exact artifacts are in the handoff; no general prompt/judge recalibration or
acceptance waiver. F-1 remains blocked by this gate, not the excluded emulator.
The following recovery result is historical. Prompt identity, API, cache and
persistence do not change.

[Partial] US-03 B-1 continues on the user-confirmed leading v23 sources,
with newly executed source-bound gates recorded in the handoff. Current
v23/assembly-v4 recovery: 1862 Backend and 466 Shared units, typechecks,
build and release guard pass; full live is 69 passed / 1 failed / 0 skipped.
The validator over-rejects negated protein-meal wording in
`current-effective-activity-budget`; B-1 acceptance/F-1 dependency release
remain blocked. Safe fallback is not successful generation. Historical
v18/v20/v21/v22 results and old external v23 claims are not reused as acceptance.
Emulator persistence is **UNVERIFIED / vom User aus Prüfauftrag ausgenommen**;
no contract run, installation, remote Cosmos write test or deployment is part of
this task. This exclusion alone does not block B-1, F-1 or completion after Q-1.
Real Cosmos serialization, partition isolation and TTL remain a residual risk.
See the [B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).

[Historical] The bounded continuation reproduces ten original r10/r11 outputs with their
original context definitions and no live provider dependency. It corrects
historical reference inheritance across an explicit tomorrow transition while
retaining explicit historical comparisons and source restrictions. Unknown or
planned activities cannot be described as having `wahrscheinlich stattgefunden`;
only `likely_completed` supports probabilistic completion. Meal/snack
`Spielraum` advice, including plural wording, is rejected at the unchanged
20-g protein lock. The recorded protein recommendation and completed open-day
wording remain rejected, without persistence or usage. Safe fallback is not
successful generation. Remaining generated defects, strict negative-wording
rejections, unreliable semantic judgments and the unavailable local emulator
are historical findings, not the current gate verdict. Shared/API,
Class 0 storage, cache rules and the v14 exception remain unchanged.

### Block 2

### [Historical] Macro-range context (v18)

For current-day nutrition, the backend selects `restDay` or `trainingDay` from
the stored day type (defaulting to `restDay`) and carries that profile day's
`macroRanges` into the Daily Insight context. A special-activity bonus changes
only the effective calorie target; it does not change those ranges or allocate
bonus calories to a macro.

When current intake and a usable protein range exist, `remainingProteinG` is
the non-negative rounded distance from consumed protein to the range's lower
bound. `proteinCoachingBand` uses actual protein per kilogram when usable body
weight is available: below `1.5 g/kg` is `below_range`, `1.5–2.0 g/kg`
inclusive is `in_range`, above `2.0` through `2.2 g/kg` inclusive is
`above_range`, and above `2.2 g/kg` is `above_coaching_threshold`. If weight
is unavailable or stale, the rounded range bounds are used; missing usable
intake or ranges produce an unknown band. The `2.2 g/kg` threshold is a
non-medical coaching parameter, not a safety limit. The existing 20 g stop for
additional protein recommendations is measured against the rounded protein
lower bound.

The v18 prompt and provider projection use the ranges and server-computed
coaching signals, never legacy scalar `proteinG` or `carbsG` values, to assess
protein or carbohydrates. The carbohydrate range is guidance only: values
outside it are not described as too low or too high and do not justify a
negative correction. Historical days do not receive current macro targets.
Weekly Insight remains calorie-based and receives no profile macro ranges.

### Block 3

### v23 prompt, output, and failure contract

`DAILY_INSIGHT_PROMPT_VERSION = 'v23'`. The selected focused module is combined
with the shared German tone/output contract. The backend stores the exact
`promptSnapshot.system` and serialized `promptSnapshot.user` sent to Azure
OpenAI. Strict Structured Outputs use `json_schema`, `strict: true`, required
properties, nullable optional values, and `additionalProperties: false`.

### Block 4

v14 fingerprint `sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a`
and the historical v15 fingerprint
`sha256:cc443460df1cac7b4475c56d469ec0bebcf3bbb8a2669505147fc50f45694264`.
The historical v16 fingerprint remains
`sha256:3e68d4dd0b6e49003936a278f3e65d693645ebfb41ee5ced3ea7daa3efa70893`.
The historical v17 fingerprint is
`sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386`
with assembly version `v2`. The historical v18 fingerprint is
`sha256:853697f9be7a8234443ff6ac89470485bb5e45a528539425a48b0f0e54f2ddae`,
also with assembly version `v2`. Historical v19 appends
`sha256:ffa03211d84678dcb2e587815d1132938486bf0985005641d546cef393f43c8b`
with assembly version `v2`. Historical v20 appends
`sha256:3d592bf92d7cf4b756097522686e2476211110c66dd1c58313831995ddc19239`,
assembly `v2`; historical v21 appends
`sha256:4d3fec770559a95634d806a94ff50e921024c21c3a5a9c2552a669e3732f6240`,
assembly `v3`. Historical v22 retains
`sha256:6cebf99f33c21220dfc02ff6741e03b15329b5ba93af1ff72bf32903d27714b9`.
The historical v23/assembly-v5 fingerprint is
`sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`,
retained as historical evidence. Historical v23/assembly-v6 fingerprint is
`sha256:41167bc280fab7a131763f47b5a830b3f236ad70d4179c2c4ea2515befd80f75`,
not rebound to later results. Historical v23/assembly-v7 fingerprint is
`sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db`.
[Historical] Final QA correction attempt2 adds source-derived claim grounding and provider-only
topic projection: no nutrition in weight intents, only uncertainty status for
inconsistent negative-budget nutrition, historical activity registration rather
than raw completion cues, and no historical numeric profile-fallback targets.
Stored inputContext remains complete and immutable; no API/storage/schema,
threshold, cache/quota/feedback/TTL or generation-count change. Runtime rejects
the exact R1 plural meal advice and historical equality/fallback originals;
recent-day comparisons apply source and exact relation checks without a new
approximate range. The explicit-yesterday eval false positive is corrected, but
recent-days attribution remains incomplete. Sole full live78/3,exit1, despite
1942/466 units and typechecks/build/guard PASS. Accepted locked eating advice and
weight-focus side topics remain; historical equality generation recurs and safely
rejects. FT139 is preserved, not reopened. Final automatic attempt2 is exhausted;
no further correction/reroll or Backend acceptance follows. Exact evidence and
owner limits are in the B-1 handoff. FT141's pending consumer statement below is
unchanged. A final weight-intent closing
rule preserves the existing weight-only focus after generic macro guidance;
it prevents nutrition side-topics from displacing stale-weight uncertainty.
The self-run pre-repair 69/70 live FAIL remains historical evidence, not PASS.
Historical macro values are omitted only from the provider
projection, not the server/persisted context. Current macro assessment must
explicitly start with `Heute` after historical copy. Morning copy with an
unusable historical target also omits today's numeric target rather than
offering it as a substitute. Runtime validation and all cache rules are unchanged.
The append-only historical records are
unchanged. The WP-B2 handoff records passing focused tests and live evaluations
for v18; earlier v17 evaluation results remain historical.

### Block 5

The following Q-21/CORR1 findings describe historical v17 evaluation evidence,
not the active contract. (The strict validator rules mentioned below were removed on
2026-10-20; see the Server Validation Scope.) The separate Q-21 Daily fix removes a
shared-tone contradiction that asked for
below-target wording despite the open-day prohibition. A positive remainder
now permits only forward-looking open-room wording, subject to stricter intent
rules; the four forbidden completed-day phrases remain prohibited. The actual
`stale-weight` fixture selects `phase_progress` with 500 kcal still open.
Its unchanged strict validator rejection is regression-tested; CORR1 stale-weight
passes but unknown-activity fails. V17 removes the shared-tone permission to
describe rest budget for activity_focus and appends that intent's existing
open-day rule after the output contract, independently of protein gap/local
hour. Unknown completion remains neutral; fueling/liquids/recovery stay
conditional. Exact unknown-activity fixture and strict rejection regressions
are offline, not invented raw provider output. G evidence contains no raw Daily
text; exact causal wording and new live success remain unverified. This is not
a Preparation/Import/Weekly-caused bug; Weekly does not consume sharedTone.

### Block 6

The active v28 activity-focus contract allows exact current intake, effective target,
and remaining calories. A named Special Activity bonus is already included in
the effective target and may be stated only as that bonus, never as activity
calorie expenditure. Current provider projection withholds the expenditure
fields above while retaining qualitative context. Unknown activity status is
also protected against being described as planned. The targeted live activity
v21 eval passed 5/5 after these fixes. The earlier 66/70 full live result predates
them and is not reclassified; the three non-activity failures have not been
rerun.

### Block 7

The stale-weight safety contract introduced in v15 remains global because the shared tone guard is
included in every selected intent, not only the weight-focused modules. For
`daysSinceLastMeasurement > 14`, weight or trend language is allowed only with
an explicit stale marker such as `veraltet` or `nicht aktuell`; day 14 remains
current and day 15 is stale. A stale-as-current sentence such as
`Dein Gewicht ist heute klar gesunken.` is rejected, while explicit stale
wording such as `Der Trend deines Gewichts ist nicht aktuell.` is accepted.
The runtime root cause was that the stale rules had previously existed only in
`promptWeight`, while deterministic `nutrition_guidance` selected
`promptNutrition`; the fix introduced in v11 remains active in v18 and applies the shared guard to that path and all other
intents. Server-side validation remains strict and was not weakened.

### Block 8

[Historical v23] Positive `remainingCalories` is an unfinished target budget, not
evidence of an achieved energy deficit or completed energy balance. In
`activity_focus`, current intake, the effective target, and the exact remainder
may be stated as supplied; (historical: the validator then rejected achieved deficit/surplus
claims; removed 2026-10-20). In `phase_progress`, the open-day guard keeps the narrative based on
weight signals, does not present the remainder as an eating budget, and does
not base an eating recommendation/CTA on using it. Historical target comparisons use that date's resolved effective target and
consumed calories;
missing nutrition, an unavailable/ambiguous source, a contradictory comparison
direction, or a profile fallback presented as a then-stored target is rejected.
`morning_orientation` is valid only before local hour 10 with no current
MealItem; a missing prior-day MealItem remains unknown, not zero intake.

## tech/06-ai-integrations.md - Daily Insight

### Block 1

[Historical] Final automatic Q1 correction attempt2 is v23/assembly v7, fingerprint
`sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db`.
Provider-only projection omits nutrition for weight intents, replaces inconsistent
negative-budget nutrition with uncertainty status, projects historical activity
as registration/unknown completion, and withholds profile-fallback historical
target numbers. A source-derived grounding block carries exact weight direction,
historical relation/source and unchanged meal/action locks. Server context,
fixtures, output schema, one-call400-token/temperature0, cache/quota/feedback/TTL
and public contract are unchanged. Runtime adds plural meal advice recognition
and recent-day historical provenance/exact-equality checks; eval fixes the exact
explicit-yesterday attribution without waiving invented-current negatives.
Backend1942/Shared466 and typechecks/build/guard pass. Sole full live78/3,exit1,
0 skipped/todo: Daily48/50 plus unchanged Weekly diagnostic2/3. Accepted locked
eating advice and weight-focus side-topic remain; historical equality generation
recurs and rejects, and recent-days temporal attribution remains incomplete.
FT139's independently confirmed numeric boundary remains covered. No fourth
local cycle, third automatic correction, reroll or acceptance. See the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
for exact source/report hashes and stable findings. Emulator excluded/UNVERIFIED;
FT140/141 decisions remain untouched.

[Historical] Q1 correction attempt1 was v23/assembly v6, fingerprint
`sha256:41167bc280fab7a131763f47b5a830b3f236ad70d4179c2c4ea2515befd80f75`.
Runtime/eval content checks now cover the exact locked-protein advice, weight
focus, null current-budget grounding, contradictory weight stability and local
current/historical activity certainty. Reverse remainder matchers cannot span
an intake verb/conjunction; correct compound numbers pass, swapped ones reject.
Negative-rest prompt instructions require arithmetic consistency before claiming
overage, with bounded uncertainty guidance for contradictory inputs. Context,
fixture bytes, schema, one-call400-token/temperature0 generation and all public,
cache/quota/feedback/persistence contracts are unchanged. No retries or repair.
All eight Q1 originals reject with exact-payload regressions; this is not universal
semantic safety. Units1925/466, both typechecks, build and guard pass; one full
live run fails68/8,exit1,0 skipped/todo. Historical participation, midday stable
weight, stale-weight nutrition and budget contradictions recur and reject.
An accepted locked meal-planning variant and a historical target claim remain
known unsafe; the empty-morning rubric also misattributes an explicit yesterday
number. FT135-138 remain open, FT139 corrected pending independent verification.
No self-approval, reroll, deployment, emulator or remote write. Exact commands,
hashes and original/new replays are in the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).

[Historical] The preceding three-cycle residual repair was v23/assembly v5, fingerprint
`sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`.
Direct `keine ... proteinreiche Mahlzeit einplanen musst` and the exact negative
eating denial are distinguished from advice. Future exceptions are clause/field
scoped. Inconsistent negative-budget contexts reject unsupported current calorie
numbers; exact supplied remainder-only wording remains allowed. A conditional
prompt guard requests uncertainty instead of numeric arithmetic; final weight
focus repeats the existing abstract-phrase ban. Fixtures/rubric/judge, safety
thresholds, one-call schema, API, cache and persistence are unchanged.
New units: **1899 Backend / 466 Shared**, typechecks, build and guard PASS.
One complete live: **69 pass / 1 fail / 0 skipped/todo**, exit1. Budget still
generates `1500 ... above ... 2000`, correctly rejected. Phase formally passes
but actually recommends increasing protein at gap20 (`Proteinaufnahme zu erhöhen`),
missed by the existing action pattern and eval rubric; offline replay proves
acceptance. This unsafe coverage gap is outstanding, not approved advice.
Three cycles exhausted; no reroll or fourth repair. B-1/F-1 not accepted.
Exact source/report/artifact binding and limits are in the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
The following v4 results are historical; emulator remains explicitly excluded.

[Historical] The earlier local follow-up corrects the proven v23 protein-negation
over-rejection without changing provider input or the v23/assembly-v4
fingerprint. A directly negated protein-rich meal need at a sentence end is
not positive advice; matches are checked individually within each field.
Positive/mixed/later advice and existing meal, calorie, action-field and 20-g
locks remain rejected. Original provider replay and 17 new unit regressions
pass; full candidate units are 1879 Backend / 466 Shared, both typechecks,
build and release guard PASS. Complete new live: **67 passed / 3 failed / 0
skipped**, exit 1; repaired `current-effective-activity-budget` passes. Failures:
different `keine ... einplanen musst` negation in `personal-neutral-greeting`,
forbidden `positive Entwicklung` in `phase-progress-open-day`, and `budget-lock`
(denial over-rejected plus contradictory generated calorie arithmetic).
No broad prompt/judge calibration or lock relaxation follows. F-1 remains
blocked by this required gate, not by the explicitly excluded emulator.
Exact commands, byte binding and historical failures are in the B-1 handoff.
The recovery results in the next paragraph are historical, not the current run.

[Partial] US-03 B-1 uses the user-confirmed leading v23 development basis.
Runtime, assembly v4, manifest and eval guard are bound to the current sources.
Handoff recovery ran 1862 Backend and 466 Shared units successfully; both
typechecks, build and release guard pass. The complete current live gate is
69 passed / 1 failed / 0 skipped: `current-effective-activity-budget` is
over-rejected for negated protein-meal wording. B-1 acceptance and F-1's
successful dependency handoff remain blocked; no safety check was relaxed.
Earlier v20/v21/v22 results and external v23 claims are historical, not current
acceptance. Emulator persistence is **UNVERIFIED / vom User aus Prüfauftrag
ausgenommen**: no contract invocation, installation or remote Cosmos test is
authorized. This excluded boundary alone does not block B-1, F-1 or Q-1;
actual Cosmos serialization, partition and TTL behavior remains unverified.
See the [B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).

### Block 2

- **[Historical] macro-range contract (v18):** the then-current context selected the
	stored profile-day ranges (`trainingDay` only for an explicit training day,
	otherwise `restDay`). A special-activity bonus changes the effective calorie
	target only; it does not change protein or carbohydrate ranges. The context
	carries `remainingProteinG` to the rounded protein lower bound and the
	server-computed `proteinCoachingBand`. With usable weight, bands use actual
	g/kg: `<1.5` below range, `1.5–2.0` inclusive in range, `(2.0,2.2]` above
	range without the high-protein coaching hint, and `>2.2` above the coaching
	threshold. Without usable weight the rounded bounds are used; missing range
	or intake is unknown. The provider projection removes legacy scalar
	`proteinG` and `carbsG`; the active prompt evaluates only ranges and the
	server-computed signals. Carbohydrate values outside their range are not
	negative judgments. Weekly Insight remains calorie-based and receives no
	personal macro ranges. This is internal context only: public response,
	Structured Output, and quota contracts are unchanged.

**[Historical] v24 prompt and validation contract (assembly v9):**
- The provider projection uses current B1.1 fields, including
	`dailyInsightProteinStatus`, `mealAdviceAllowed`, and `dailyActivityStatus`.
	The obsolete `remainingProteinG <= 20` lock and its deterministic fallback
	are removed. Protein interpretation follows the server-derived status;
	concrete meal advice is allowed only when `mealAdviceAllowed` is true.
- Intent prioritizes its topic but does not suppress other relevant supplied
	signals. Activity completion uses only `completed` / `unknown`; unknown
	cannot be described as planned or completed.
- Summary is non-empty with no minimum word count and a hard maximum of 1,500
	characters. Historical target-source checks, exact calorie arithmetic,
	stale-weight safety, and no-invented-facts validation remain active.
- At the v24 review, the active prompt release was v25 / prompt v24 / assembly v9.
	Its fingerprint was bound in the append-only manifest. Ten consecutive
	complete Evals on that exact candidate were required before handoff.

**[Historical] v23 prompt and validation contract:**
- Current assembly v8 removes current intake, effective calorie targets,
	remaining calorie budget, and completed meal history from the provider-only
	projection when `nutrition_guidance` has an open calorie budget and
	`remainingProteinG <= 20`. The server-computed protein gap remains available
	for a neutral status; unrelated weight, goal, and progress-intelligence cues
	are also omitted, while action fields remain null and the original context is
	unchanged. This prevents unrelated planning cues from overriding the protein lock.
	For every known `remainingProteinG <= 20` lock, the provider projection also
	omits current protein intake, the protein range, remaining gap, and coaching
	band; calorie values remain available when needed for a budget explanation.
	The public prompt version remains v23; the append-only manifest records this
	as release v24 / assembly v8.
- Runtime validation also requires a six-hour-or-longer alpine hike to mention
	energy or carbohydrates, fluids, and recovery. A bounded semantic correction receives
	the missing aspects explicitly; invalid output remains rejected if correction
	fails. No public response, quota, cache, or persistence contract changes.
- Weight-stability corrections restate the server-derived measurement direction
	(`lower`, `higher`, or `equal`); unequal current/previous readings never
	authorize stable wording.
- Morning orientation rejects use of today's `profile_fallback` calorie target
	as a historical comparison or current numeric target; resolved historical
	snapshot comparisons remain valid.
- Daily Insight validation requires direct user address, matching the existing
	live-eval rubric.
- If the single correction remains invalid for a nearly-complete protein action,
	a contradictory weight-stability claim, or the midday empty-diary stability
	case, the backend uses a narrow neutral fallback and runs it through the same
	semantic validators. Protein-locked summaries also enforce the eval's
	45-word minimum. Other semantic failures remain terminal.
- Historical v21 activity verification (2026-10-16): the focused live set passed
	5/5; backend units passed 1856/1856; `build:verify` and the prompt release
	guard passed. Prompt and validation suites passed 53/53 and 90/90.
	The previous full v21 live run was 66/70 before final activity fixes;
	only the five activity cases were rerun. The three non-activity failures
	listed above remain unverified and are outside this change.
- Historical v20 full-gate results remain unchanged: the recorded follow-up
	was 56 passed / 10 Daily failures / 0 skipped, with all 31 non-Daily cases
	passing; earlier r11 57/9 is also historical. These are not v21 results.
- Deterministic r10/r11 replay regressions retain their original hash-bound
	fixture contexts and do not require live provider calls.
- The effective target is `nutrition.targets.calories`: an explicit normal
	training day uses its `trainingDay` target; a Special Activity uses the
	server-resolved target with its bonus included exactly once. Current
	intake is `nutrition.today.calories`, and `remainingCalories` is the
	exact target-minus-intake value. `activity_focus` may state those exact
	values and the named bonus, but cannot add the bonus again, estimate
	activity expenditure, or claim achieved energy balance. Its provider
	projection keeps qualitative activity signals and target/bonus while
	omitting `activityCalories`, `estimatedMet`, and
	`alreadyAccountedCalories`. Unknown status cannot be described as
	planned or completed; planned cannot be described as completed.
- Historical reference inheritance now ends at an explicit future transition
	(`morgen`, `übermorgen`, `am nächsten Tag`) only when that sentence has no
	explicit historical day or recent-days reference. Explicit/mixed historical
	macro claims remain forbidden, including a return to yesterday after tomorrow.
	The original r11 personal greeting's tomorrow sentence no longer receives a
	false historical-macro rejection; runtime acceptance is not semantic approval.
- [Historical, removed 2026-10-20] The v21 activity validator rejected unknown status described as planned or
	completed; planned status cannot be described as completed. Only
	`likely_completed` permits uncertain completion wording. The protein
	lock additionally rejects meal/snack
	`Spielraum für ...` wording, singular and plural, only at the unchanged
	`remainingProteinG <= 20` boundary. Existing protein, open-day, stale-weight,
	budget and historical-source checks are not relaxed. In particular the exact
	r10 protein advice and r11 completed open-day claim remain rejected.
- Historical v20 live evidence still includes generation defects and strict rejections
	of negated meal wording. Seven semantic assertion failures remain separate:
	the unchanged judge still misreads authoritative signals (including 30 g as
	below 20 g). Twelve passing controls do not establish general semantic
	capability. No rubric calibration, new model, manual substitute or waiver was
	introduced. See the bounded-repair section of the B-1 handoff for exact gates.
- `DAILY_INSIGHT_PROMPT_VERSION` is `'v23'`. The selected intent module is
	combined with the shared German tone/output contract and the exact system
	prompt plus serialized user message are persisted as `promptSnapshot`.
- The active composition root is
	`backend/src/lib/prompts/dailyInsightPrompt.ts`; its append-only release
	history is in `backend/src/lib/prompts/dailyInsightPromptManifest.ts`.
	The append-only manifest preserves v14 fingerprint
	`sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a`
	and historical v15 fingerprint
	`sha256:cc443460df1cac7b4475c56d469ec0bebcf3bbb8a2669505147fc50f45694264`
	unchanged. The historical v16 fingerprint remains
	`sha256:3e68d4dd0b6e49003936a278f3e65d693645ebfb41ee5ced3ea7daa3efa70893`
	and the historical v17 fingerprint is
	`sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386`
	with assembly version `v2`; the historical v18 fingerprint is
	`sha256:853697f9be7a8234443ff6ac89470485bb5e45a528539425a48b0f0e54f2ddae`
	with assembly version `v2`. Historical v19 appends
	`sha256:ffa03211d84678dcb2e587815d1132938486bf0985005641d546cef393f43c8b`
	with the same assembly version. Historical v20 appends
	`sha256:3d592bf92d7cf4b756097522686e2476211110c66dd1c58313831995ddc19239`,
	assembly `v2`; historical v21 appends
	`sha256:4d3fec770559a95634d806a94ff50e921024c21c3a5a9c2552a669e3732f6240`,
	assembly `v3`. Historical v22 retains
	`sha256:6cebf99f33c21220dfc02ff6741e03b15329b5ba93af1ff72bf32903d27714b9`.
	The historical v23/assembly-v5 bundle fingerprint is
	`sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`.
	The historical v23/assembly-v6 bundle fingerprint is
	`sha256:41167bc280fab7a131763f47b5a830b3f236ad70d4179c2c4ea2515befd80f75`.
	Historical v23/assembly-v7 is
	`sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db`.
	Historical v23/assembly-v8 is release v24 with fingerprint
	`sha256:a3d601ae4a68d4257af49d14e84b66993293507c590125e2504cc51720bcaa96`.
	The source-bound B-1 handoff records its new gates; no historical identity is changed.
	V23 continues to omit historical
	protein/carbohydrate/fat values only from the provider projection, preserving
	the complete server/persistence context. The final guard requires explicit
	`Heute` transitions back to current assessment and omits today's numeric
	target in morning copy when the historical target is unusable. Existing
	validators remain strict; no safety or cache policy changes accompany this fix.
	`promptVersion` plus `promptFingerprint` form the release identity.
	`systemPromptHash` additionally hashes the exact context-dependent
	`promptSnapshot.system` sent for the selected intent.
- The self-run v23 pre-repair live suite failed 69/70 because the generic
	macro closing rule overrode weight focus in `stale-weight`, causing protein
	advice under the existing lock. The final weight-only closing rule now follows
	that macro guard for `weight_signal` and `phase_progress`: no current calorie,
	remainder or protein side-topic; stale data remains explicitly uncertain.
	Two Red/Green prompt regressions cover the order and unchanged source context.
	The validator, schema, fixtures, model, one-call/400-token budget and cache
	policy are unchanged; final live acceptance is recorded separately in the handoff.

### Block 3

	response and rejects provider truncation/content filtering, empty or invalid
	JSON, CTA/target mismatches, budget/protein contradictions, definitive
	activity claims, stale-as-current weight claims, unsupported historical target
	comparisons, unsupported nutrition claims for unlogged historical days, invalid
	morning-source use, and forbidden technical wording.

### Block 4

	asks for a complete German sentence grounded only in server context,
	consistent with the full text and without new advice/facts. The current eval
	uses fixture concept checks and deterministic local policy assertions rather
	than a model-based judge.
	The historical judge-based live rubric failed, including calibration problems; it did not
	establish semantic acceptance. The historical 2026-10-16 follow-up separated grammar,
	grounding, full-text agreement and emoji into four independent test-only
	judge calls, with fixed positive and negative controls. The authorized next
	follow-up isolates each criterion's input and supplies independently computed,
	unit-tested historical arithmetic evidence to grounding. All twelve fixed
	controls pass in the focused r6 run; this does not substitute for the full gate.
	Historical r11 retains 12/12 passing fixed controls but the complete gate fails:
	57 pass / 9 fail / 0 skipped. Generated-output judgments still contain
	wrong arithmetic or signal interpretation; calibration is insufficient.
	Three Daily validator rejections and six semantic assertion failures remain;
	exact synthetic provider outputs are captured only in test artifacts via the
	existing test-client hook. No production logging/call-count change is made.
	All 31 non-Daily evals pass; local-emulator persistence remains UNVERIFIED
	(0 executed / 15 setup-skipped). Earlier 54/12 is historical evidence only.
	The historical full v20 eval on 2026-10-16 passed 31/34 tests; three
	activity-focus outputs still disclosed current intake or remaining-calorie
	details and remain failures.
	Exact commands, report hashes and failures are in the
	[B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md#follow-up-evidence-2026-10-16).
	The current generator uses temperature `0`, one Strict Structured Output call,
	and the unchanged 400-token budget. Earlier runs produced no
	observed truncation in these runs and was not increased; no retries/calls were added.

### Block 5

- Existing text-aggregating safety checks also inspect `shortInsight`.
	Historical short/full narratives have separate time-reference state;
	activity uncertainty and stale-weight markers must hold independently in
	the short sentence, not merely in the full text. Name/emoji greeting cannot
	carry extra prose. Invalid/missing/partial new provider fields fail before
	persistence and usage tracking; no client-side summary or repair is generated.

### Block 6

- The stale-weight contract introduced in v15 remains global: the shared tone guard is included
	in every selected intent, including `activity_focus`, `nutrition_guidance`,
	`morning_orientation`, and `general`, not only the weight-focused modules.
	For `daysSinceLastMeasurement > 14`, weight or trend data is stale; day 14
	remains current and day 15 is stale. A stale reference may be omitted or
	must use an explicit marker such as `veraltet` or `nicht aktuell`. A current
	claim such as `Dein Gewicht ist heute klar gesunken.` is rejected, while an
	explicit stale notice such as `Der Trend deines Gewichts ist nicht aktuell.`
	is accepted.
- The runtime root cause was corrected in v11 and remains active in v21: stale-weight rules had been
	present only in `promptWeight`, while deterministic `nutrition_guidance`
	routing selected `promptNutrition`. The shared guard now covers that path
	and all other intents; server-side validation remains strict and was not
	weakened.
- A positive or negative current-day `remainingCalories` is only the difference
	between logged intake and the effective target, not a measured energy balance.
	The shared prompt contract permits only target-relative wording. The prompt
	forbids affirmative achieved deficit/surplus claims in title,
	summary, recommendation, and CTA while allowing explicit denials (the former
	deterministic validator rule was removed on 2026-10-20). A positive
	value is an open target budget; in v21, `activity_focus` may state exact
	current intake, effective target, remaining amount, and named activity bonus
	as target-relative facts. The bonus is already included once; do not add it
	again or describe it as activity expenditure. The provider projection omits
	`activityCalories`, `estimatedMet`, and `alreadyAccountedCalories`. The
	`phase_progress` guard leaves assessment
	to weight signals, never presents the remainder as an eating budget, and does
	not base an eating recommendation or CTA on using it. Independent
	non-nutrition guidance remains possible. Historical comparisons use the
	date's resolved effective target,
	require logged nutrition and a reliable source, and reject a direction that
	contradicts that target. A read-only `profile_fallback` cannot be called the
	target stored for that past day. `morning_orientation` requires local hour
	`0..9` and no current MealItem; a missing prior-day item is not zero intake.
- The following Q-21/CORR1 results are historical v17 evaluation evidence, not
	the active contract. The validator rules named in these historical entries were
	removed on 2026-10-20. The WP-B2 handoff records passing focused tests
	and live evaluations for v18; earlier v17 results remain historical.
- Q-21's separate Daily v16 fix removes the shared-tone instruction to use
	below-target wording when the current day is open, without weakening the
	strict open-day validator. Regression uses the actual `stale-weight`
	`phase_progress` source (500 kcal open, 20-day-old weight), not an invented
	raw provider transcript. New live G remains pending independent QA.
- CORR1 stale-weight passes, but unknown-activity fails the strict open-day
	validator. Final correction v17 removes shared-tone rest-budget wording for
	activity_focus and appends its existing open-day rule after the output
	contract for positive remainingCalories, regardless of protein gap/local
	hour. Unknown completion stays neutral and endurance advice conditional.
	Exact fixture composition and strict negatives are offline-tested. Raw
	Daily text is unavailable: exact phrase/causal attribution is unverified.
	Validator/provider/schema stay unchanged; Weekly has no sharedTone consumer.

## tech/08-testing.md - Daily Insight

### Block 1

[Historical] Final automatic Q1 correction attempt2 adds17 Backend units (validator6,
generator2,prompt9) and five provider-free eval tests. Exact R1 accepted plural
meal advice and recent-day equality/source payloads now reject. Exact explicit
yesterday attribution passes; invented-current negatives and FT139 compound,
separated and swapped controls remain. Current Backend1942/Shared466 units,
both typechecks/build/guard7+4 pass,0 skipped/todo. Sole full live78 pass/3 fail,
exit1,0 skipped/todo,5 files; Daily48/50 and unchanged Weekly diagnostic2/3.
The Weekly diagnostic is a separate feature check, is not a US-03 failure, and
is excluded from the current story acceptance gate.
All22 Daily artifacts finish stop and bind v23/v7 fingerprint
`sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db`.
291 source rows match before/after gates. Replay binds10 embedded originals,
22 R1 and22 current outputs; shared runtime/helper guards are not independent
semantic assurance. Manual pass-output inspection still finds locked eating
advice and weight-focus nutrition copy. Recent-day equality generation safely
rejects; helper temporal parsing still misattributes a recent-days number.
Three local cycles exhausted; no post-live repair, third automatic attempt or
reroll. Exact command exits/counts/skips/hashes and preserved boundaries are in
the [current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
and `backend/output/b1-q1-c2-evidence.json`. Emulator USER EXCLUDED/UNVERIFIED,
nonblocking by itself. No Backend PASS follows from green offline gates.

Historical Q1 correction attempt1 adds26 unit cases (validator14/generator8/prompt4) and
six local eval controls. Eight exact Q1 originals are embedded in generator
tests and field-for-field bound to original artifact bytes in the durable replay.
Tests cover correct compound versus separated calorie clauses, genuinely swapped
values, locked protein increase/reach advice, weight-focus nutrition, null current
budget, unequal weights, current/historical activity certainty and unrelated
qualifier negatives. Fixtures remain byte-identical. The eval helper additionally
runs actual runtime content checks; reuse is not independent semantic validation.
Current focused235/235; Backend1925/1925,71 files; Shared466/466,10 files;
both typechecks/build/PromptGuard7+4 pass. All have0 failed/skipped/todo.
One complete live invocation returns68 pass/8 fail/0 skipped/todo,exit1;
Daily37/45, other evals31/31. The six added local controls explain76 versus70
assertions, not additional Daily provider calls. All22 Daily artifacts bind
v23/v6 fingerprint
`sha256:41167bc280fab7a131763f47b5a830b3f236ad70d4179c2c4ea2515befd80f75`.
All291 source hashes match pre/post gates. Known accepted meal-planning and
historical target defects remain explicit despite formal passes; runtime-safe
rejections do not make generation pass. Empty-morning current-number attribution
is a remaining rubric false positive, not waived. Exact command exits/timestamps,
logs, all-original/new-output replays and hashes are in the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
and `backend/output/b1-q1-c1-evidence.json`. No reroll or new acceptance claim.
Emulator remains excluded/UNVERIFIED, not an independent blocker.

The historical v5 residual repair adds 20 tests (13 validator/4 generator/3 prompt), with
unchanged independent live fixtures/rubric. Red/Green covers the exact second
protein denial, positive/mixed/separate-field advice, eating denial versus
contradictory numbers, future-clause isolation and abstract phrases. Final focused
suite: **209/209**. Full Backend **1899/1899,71 files**, Shared **466/466,10 files**;
typechecks, BuildVerify and PromptGuard (7+4) PASS. One complete live
**69 pass / 1 fail / 0 skipped/todo**, exit1: Daily38/39, Analyze21/21, Scale3/3,
Weekly4/4, diagnostic3/3. Budget is correctly rejected for contradictory generated
arithmetic. Phase formally passes but contains real protein-increase advice at
gap20 that existing validation/rubric miss; offline replay proves ACCEPTED. This
coverage gap prevents acceptance despite the fixture's formal PASS.
Three targeted repair cycles exhausted; no fourth repair or pass-seeking reroll.
All 22 Daily artifacts bind v23/v5 fingerprint
`sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`.
The 291-file pre/post source aggregate is identical; exact commands, exitcodes,
counts/hashes and residual defects are in the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
and `backend/output/b1-v23-residual-evidence-2026-10-16.json`.
Emulator explicitly excluded/UNVERIFIED, not itself a blocker. B-1/F-1 not accepted.

The historical v23/v4 negation follow-up adds 15 validator and 2 generator tests.
They reproduce the exact recorded `current-effective-activity-budget` denial
in short/full text, retain rejection of positive/mixed/later/separate-field
advice, and replay the original provider payload without local artifact reads.
Existing 19.99/20/20.01-g and other safety boundaries remain unchanged.
Red: 101 pass / 5 fail; first repair: 105 pass / 1 test-setup failure;
after restoring the test's activity-target title: 106/106. Generator+validator:
127/127; focused: 402/402; complete Backend: 1879/1879, 71 files; Shared:
466/466, 10 files. All completed Green runs have 0 failed/skipped/todo.
Both typechecks, build:verify and release guard (7 + 4 tests) pass. Full live
replacement completes **67 pass / 3 fail / 0 skipped/todo**, exit 1, 5 files:
Daily 36/39, Recipe Analyze 21/21, Scale 3/3, Weekly 4/4, diagnostic 3/3.
The repaired activity-budget fixture passes. Remaining failures are
`personal-neutral-greeting` (different negation), `phase-progress-open-day`
(forbidden phrase) and `budget-lock` (negative wording rejection plus
contradictory generated calorie arithmetic). No prompt/judge recalibration,
test deletion or safety relaxation; F-1 remains blocked by this full gate.
Initial live invocation has no final JSON and is UNVERIFIED, not PASS.
The complete report is
`backend/output/b1-v23-negation-final-full-eval-r2-2026-10-16.json`;
22 distinct Daily artifacts bind the unchanged v23/v4 identity. The 291-file
source aggregate is identical before/after full gates. Exact commands,
reports, source hashes and final
status belong to the [current B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
Earlier 1862-unit/69-of-70 recovery evidence below remains historical.
Emulator/contract remains UNVERIFIED / explicitly excluded by the user,
not a blocker by itself; no remote Cosmos write or deployment is authorized.

### Block 2

[Historical, removed 2026-10-20] The former semantic validation tests covered historical comparisons against the
resolved target for that date, missing or ambiguous evidence, contradictory
comparison direction, unsupported nutrition claims on unlogged prior days,
and morning intent/source constraints. Context fixtures keep the historical
2,250 kcal snapshot distinct from the current 2,000 kcal target. Handler tests
also prove that a complete unexpired same-date v14 cache entry is returned
unchanged until expiry, while the repository status-operation test constrains
the read projection to status metadata and the patch to `/processingStatus`.

### Block 3

Q-21's separate Daily regression uses the real `stale-weight` fixture's open
`phase_progress` context and rejects all four completed-day phrases with the
unchanged validator error. Prompt tests reproduce/remove contradictory
below-target instructions; no validation relaxation or expected-failure bypass
is added. Attempt 2 also uses exact unknown-activity inputs (activity_focus,
unknown local hour, 500 calories remaining, 40 g protein gap) to check the final
activity open-day guard and unchanged strict rejection of all four phrases.
Conditional fueling/liquids/recovery and stale-weight regressions remain.
Offline tests are not a successful new live G execution.

The v23 activity regressions verify the effective target for a normal training
day (2400 kcal target, 900 kcal intake, 1500 kcal remaining, zero activity
bonus) and Special Activity handling with its bonus included exactly once.
Activity-focus provider projection omits `activityCalories`, `estimatedMet`,
and `alreadyAccountedCalories`; unknown status cannot be described as planned
or completed. Exact calorie-role regressions reject a target used as remainder
and invented activity burn. Five intake-verb regressions ensure a valid intake
and remainder in the same sentence do not trigger a false rejection. Prompt
tests cover server-selected closing rules, the one-sentence stale-data example,
and today's general focus. The Daily call test pins temperature `0` while
preserving the exact snapshot and single generation.

The earlier KB claim of 1870 v23 units and 70/70 live evals was external,
not a newly verified source-bound result. The 2026-10-16 B-1 continuation
accepts the user's leading v23 sources, recalculates the complete bundle and
runs its own gates. Before the targeted weight-focus repair, the complete live
report had 69 passed / 1 failed / 0 skipped: `stale-weight` recommended protein
despite the existing lock. That FAIL is retained, not reclassified. A final
intent-specific closing guard now preserves weight focus after generic macro
rules; two test-first regressions cover `weight_signal` and `phase_progress`.
The earlier 1859-unit result binds the preceding v3 candidate, not current v4.

## tech/09-api-reference.md - Daily Insight

### Block 1

[Historical] Final automatic Q1 correction attempt2 uses v23/assembly v7 without
changing this API/storage contract. Source-grounding/provider projection and
bounded validation/eval corrections preserve single-call generation, unavailable
without pair/write/usage,401/400, cache/quota/feedback/TTL and legacy field-gap
behavior. Backend1942/Shared466, typechecks/build/guard pass; sole full live78/3,
exit1,0 skipped/todo. Accepted locked eating advice and weight-focus side topics
remain, and historical equality generation safely rejects. No Backend PASS or
third automatic correction; exact stable finding outcomes and source/report
hashes are in the [current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
Emulator remains USER EXCLUDED/UNVERIFIED. FT140/141's pending decisions and
the three FT141 statements are not changed by this correction.
[Historical] Q1 correction attempt1 on v23/assembly v6 changes no API or storage
shape. Runtime rejects the exact unsafe Q1 originals and preserves correct
compound calorie attribution without accepting swapped values. Validation
failure still returns200 unavailable without compact pair/write/usage. Auth,
parameters, cache/quota/feedback/TTL and optional legacy fields are unchanged.
Current Backend1925/Shared466, typechecks/build/guard pass; full live fails68/8,
exit1,0 skipped/todo. Known accepted meal-planning/historical-target gaps remain;
safe rejection of renewed bad model text is not generation success or backend
content approval. Exact source-bound limits and FT135-139 outcomes are in the
[current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
Emulator is excluded/UNVERIFIED. FT141's separate documentation decisions remain
outside this correction; this paragraph does not accept or resolve them.
[Historical] The v23/assembly-v5 residual repairs preserve this API and its
fallback/cache/quota/feedback/TTL contract. The two recorded direct denials are
distinguished from positive advice; inconsistent negative-budget numeric claims
reject rather than persist or consume usage. Prompt guards request uncertainty
for that context and repeat the existing weight-phrase prohibition. Shared
types/request/response schemas and storage shapes are unchanged by this repair.
Current gates: **1899 Backend / 466 Shared**, both typechecks/build/guard PASS;
one complete live **69 pass / 1 fail**, exit1, no skipped/todo. Budget arithmetic
still fails correctly. Additionally, formally passing Phase emits prohibited
protein-increase advice at gap20 which existing validator/rubric miss, confirmed
by offline replay. No acceptance or F-1 release follows. Three cycles exhausted,
no reroll; emulator excluded/UNVERIFIED and not itself a blocker. Exact binding
and follow-up limits are in the [current handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
The following v4 results are historical, not current acceptance evidence.

[Historical] The earlier local v23 follow-up corrects only direct protein-meal
negation matching, with original provider replay and positive/mixed/following
counterexamples. Existing 20-g, calorie and action-field locks remain enforced.
1879 Backend / 466 Shared units, both typechecks, build and release guard pass;
the complete new live gate fails **67 pass / 3 fail / 0 skipped**, exit 1.
The repaired activity-budget fixture passes; other fixtures still fail for a
different protein negation, prohibited wording, and a calorie-lock rejection
whose output also contains contradictory arithmetic. Exact artifacts/results
are in the handoff. F-1 dependency release remains blocked by the required live
gate, not by the excluded emulator. The recovery result below is historical.
Shared/API/fallback/cache/feedback/TTL and v23/v4 prompt identity are unchanged.
[Historical] Earlier B-1 recovery used v23/assembly v4 with newly executed gates: 1862
Backend units, 466 Shared units, both typechecks, build and release guard pass.
Full live is 69 passed / 1 failed / 0 skipped; negated protein-meal wording in
`current-effective-activity-budget` is over-rejected by the existing validator.
B-1 acceptance/F-1 dependency release remain blocked; API behavior is unchanged.
The exact source-bound results and final status are in the handoff. Historical
v20 failures and old external v23 claims are not current acceptance evidence.
Emulator persistence is **UNVERIFIED / vom User aus Prüfauftrag ausgenommen**,
not PASS and not a blocker by itself. No contract run or remote Cosmos write
test is authorized; actual Cosmos serialization, partition and TTL behavior
remains a residual risk. API/fallback/security rules were not relaxed. See the
[handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
The bounded repair changes validation only: future sentence transitions no
longer inherit an unrelated historical reference; explicit historical macro
claims remain forbidden. Unknown/planned `hat ... stattgefunden` claims and
meal/snack-budget wording under the existing protein lock are rejected.
Those failures retain HTTP `200 unavailable`, no compact fields, no persistence
and no usage. Ten original r10/r11 responses have deterministic generator
replays; replay acceptance is not full semantic certification. No public type,
provider schema, prompt identity, cache trigger or legacy exception changed.

### Block 2

The active v26 prompt and server validator apply the stale-weight guard to all
intents: day 14 remains current, day 15 is stale, stale-as-current wording is
rejected, and explicit markers such as `veraltet` or `nicht aktuell` are
accepted. Context, provider, truncation/content-filter, or validation failures


## tech/08-testing.md - Daily Insight (additional block)

Handoff recovery on v23/assembly v4, fingerprint
`sha256:f2d30507da7e5f9bc88a538d003b6472c666a6ab93ad7568fdaf0da86b992df4`,
passes 1862/1862 Backend units in 71 files (prompt 58/58), and 466/466 Shared
units in 10 files, with zero skips. Both typechecks, build and release guard
(7 script + 4 manifest tests) pass. The complete current live run fails:
69 passed / 1 failed / 0 skipped, exit 1, across all five suites. Daily is
38/39; the other suites total 31/31. The failure is
`current-effective-activity-budget`: negated `keine zusätzliche proteinreiche
Mahlzeit nötig` matches the existing protein-action regex. This over-rejection
remains a failed gate, not an unsafe recommendation or expected PASS.
All 22 Daily provider artifacts bind the current fingerprint and finish `stop`.
The initial recovery live invocation has no completion report and is
UNVERIFIED; the sequential full run is the conclusive current FAIL.
Reports: `backend/output/b1-v23-v4-handoff-backend-units-2026-10-16.json`,
`backend/output/b1-v23-v4-handoff-shared-units-2026-10-16.json`, and
`backend/output/b1-v23-v4-handoff-full-eval-r2-2026-10-16.json`.

## domain/07-ai-features.md - Daily Insight (additional blocks)

### Judge-based verification history

Independent live fixture verification is required; the current self-run verdict is in the
handoff. Historical judge-based verification failed with unresolved rubric
calibration and generated-output safety rejections. That historical follow-up used four
independent test-only judge calls with fixed positive/negative controls.
The authorized next follow-up isolates criterion inputs and supplies
unit-tested historical arithmetic evidence independently of the production
prompt. All twelve fixed controls pass in focused r6; full live acceptance
is still required and is not inferred from that calibration result.
Final r11 passes all twelve controls but still fails three Daily runtime
validations and six generated-output semantic assertions. Exact synthetic
outputs now distinguish generation/validation failures from incorrect rubric
reasons; no general semantic acceptance follows. The mandatory emulator gate
still executes no bodies (15 setup-skipped), so persistence is UNVERIFIED.
The current task requires all non-emulator gates; only emulator persistence
is excluded by the user, never reported PASS.

### Former runtime validation list and protein-gap cache buckets (removed 2026-10-20)

The server validates the parsed response and rejects provider truncation or
content filtering, empty/invalid/schema-invalid responses, CTA/target
mismatches, budget/protein contradictions, definitive activity claims,
stale-as-current weight claims, prior-day or recent-day claims, invalid
current-moment phrasing, invalid morning-source use, the prohibited calorie-
surplus term, and forbidden technical wording. Stale-weight markers must appear
independently in each field that mentions weight.

Negative calorie budget is authoritative. A `remainingProteinG` value of
`null` is unknown; a value at most 20 is treated as nearly complete. Neither
state creates an additional protein action, and a negative calorie budget
blocks further same-day food recommendations. `remainingProteinG` was bucketed
as `unknown`, `nearly_complete_below` (below 20), `nearly_complete_at` (exactly
20), and `gap` (above 20) in the cache hash, distinguishing `19.99`, `20`, and
`20.01`. The current code has no protein-gap bucket (see the cache-hash section
of `domain/07-ai-features.md`).
B-1 acceptance and F-1 dependency release remain blocked by this live result,
not by the excluded emulator. Exact commands, timestamps, source/report hashes
and counts are recorded in the
[B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md).
No fixture, expected rejection, safety rule or model was relaxed to pass a gate.

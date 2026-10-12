# Q21 Corrections: Local Completion Handoff

Date: 2026-10-10. Status: LOCAL HANDOFF RECOVERED; FINAL GATE EVIDENCE INCOMPLETE; NOT QA-PASS; NO DEPLOY.

Manifest: [MANIFEST_Q21_Corrections_2026-10-10.json](MANIFEST_Q21_Corrections_2026-10-10.json).

## Scope And Versions

This completion preserves the existing approved v21 candidate and changes no feature code. Only this handoff and its manifest are created. No delegation, deployment, register change, QA/report/history edit, gate rerun or live repetition occurs in this completion.

Verified from current constants: Preparation `v10` (initial creation and full-draft correction); Import `v16`; active Daily `v16`, assembly `v2`. Text-only correction uses the shared `RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT`; it has no separate version constant. Historical Daily v3/v4/... files are not the active composition root.

## Preparation

### FT086 / Q21-20261010-OVEN-ENDPOINT

Root cause: accepted v9 oven outputs preserved 40 minutes but lost the source condition that potatoes must be cooked. Structural/reference/geometry validation cannot establish cooking fidelity; manual-tagged oven does not run the live independent cooking assertion.

Existing correction: v10 explicitly preserves source cooking endpoints in initial creation, full-draft correction and text-only shortening. Duration is not a substitute for doneness; optional resting/serving may be omitted to retain the endpoint. No semantic production validator or layout relaxation was added.

Files: `backend/src/lib/prompts/recipeAnalyze.ts`, `backend/src/lib/recipePreparation.test.ts`, `backend/src/lib/recipeAnalyzeValidation.test.ts`; fixture/eval coverage in `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts` and `recipeAnalyze.eval.test.ts`.

Regressions visible in current code: both full-output prompts must contain endpoint protection; text-only prompt must preserve it; the mocked full-draft oven correction retains 180C/40 minutes and doneness through the existing bounded loop. The oven fixture remains `manualExportReview: true`. Visible test code is not evidence that these regressions executed successfully after correction. Human review: NOT PERFORMED / MANUAL VALIDATION REQUIRED.

### FT087 / Q21-20261010-PREP-METADATA

Root cause: v9 allowed reliably derived totals but did not sufficiently disambiguate total duration from individual component times. Natural outputs guessed rice 42/35, oven 50 and pasta 35 despite untimed preparation and unspecified overlap.

Existing correction: v10 permits an explicit source total or a completely timed, explicitly sequential workflow; otherwise `totalTimeMinutes` must be null. No guessed preparation/preheat/rest additions or blind component sums. Independent metadata assertions execute before the oven manual-review branch; they do not turn manual oven fidelity into an automated PASS.

Files: `backend/src/lib/prompts/recipeAnalyze.ts`, `backend/src/lib/recipePreparation.test.ts`, `backend/src/lib/recipeAnalyzeValidation.test.ts`, `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`, `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`.

Regressions visible in current code: null expected for unchanged rice/oven/pasta/forced-dough sources; unsupported rice 42/35, oven 50/40 and pasta 35/25 rejected by the independent rubric; reviewed supported-total positives and wrong/null negatives retained. These are test/eval provenance assertions, not a new runtime provenance parser. Successful post-correction execution is UNVERIFIED without its record.

## Daily

### FT088 / Q21-20261010-DAILY-OVERALL

Root cause: the actual `stale-weight` fixture selects `phase_progress` with positive remainingCalories (500). Shared tone told the model to describe intake as above or below target while the strict open-day contract prohibited completed-day/below-target judgment. Historical G failed with `DailyInsightValidationError: Daily insight judges an open day as completed`.

Existing correction: shared tone only describes still-open budget for positive remainder; above-target judgment is restricted to negative remainder. Active Daily is v16; assembly remains v2. The strict validator is unchanged. Release manifest preserves v14/v15 entries and appends v16 fingerprint `sha256:3e68d4dd0b6e49003936a278f3e65d693645ebfb41ee5ced3ea7daa3efa70893`.

Files: `backend/src/lib/prompts/sharedTone.ts`, `dailyInsightPrompt.ts`, `dailyInsightPrompt.test.ts`, `dailyInsightPromptManifest.ts`, `dailyInsightPromptManifest.test.ts`, `dailyInsight.eval.fixtures.ts`, `dailyInsight.eval.test.ts`; related current tests/cache-version references in `backend/src/functions/dailyInsight.test.ts`, `backend/src/lib/dailyInsightValidation.test.ts`, `backend/src/lib/repositories/insightRepository.ts` are changed since the QA baseline. That baseline alone cannot attribute every edit to this correction.

Regression visible in current code: build the exact stale-weight phase snapshot, reject the contradictory instruction, retain open-budget and phase-progress guards, preserve input unchanged; version/manifest locks reflect v16. No successful final live G is evidenced. Historical Daily failure is not closed.

## Knowledge Base

### FT089 / Q21-AC10-DOC-01

Root cause: current-contract v6 sections coexisted with v9 paragraphs during original Q21 QA.

Existing correction: current Preparation contracts now describe actual v10, Import remains v16; active Daily sections describe v16. Do not relabel current contract as v9 merely because the finding originated against v9. Current candidate is explicitly partial/not accepted.

Files: `docs/kb/domain/06-recipes.md`, `docs/kb/domain/07-ai-features.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/06-ai-integrations.md`, `docs/kb/tech/08-testing.md`, `docs/kb/tech/09-api-reference.md`.

Current version references were read directly. Dated historical v4/v6/v9/B-19/B-2 sections are still present in inspected documentation; byte-exact preservation of every historical paragraph is UNVERIFIED because the available pre-correction baseline stores whole-file hashes, not KB text. No historical section is edited by this completion.

## Existing Execution Evidence

The following saved records are original Q21 QA for Preparation v9, not post-correction certification. Exact native argv, UTC intervals and output hashes remain in `docs/qa/reports/Q21-2026-10-10-<stage>.json`, with transcripts and assertion reports alongside. No records are rewritten here.

| Command (readable equivalent; exact args in record) | Exit | Executed Result | Stage |
| --- | ---: | --- | --- |
| `npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts src/test-utils/weeklyInsightEvalSemantics.test.ts --silent` | 0 | 463 passed / 0 failed / 0 skipped | focused |
| `npm run test --workspace=backend -- --silent` | 0 | 1611 passed / 0 failed / 0 skipped; 67 files per saved QA report | units |
| `npm run typecheck --workspace=backend` | 0 | No test count | typecheck |
| `npm run build:verify --workspace=backend` | 0 | No test count; not a deployment | build |
| `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` | 0 | 5 passed / 0 failed / 9 intentionally skipped | F |
| `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts` | 0 | 14 passed / 0 failed / 0 skipped | R |
| `npm run test:eval --workspace=backend` | 1 | 41 passed / 1 failed (Daily stale-weight) / 0 skipped | G |

Historical discovery probes: listPreparation/listRecipe/listPreparationSilent exited 1 due to reporter console interception; listPreparationDirect/listRecipeDirect with `--disableConsoleIntercept` exited 0. These were selection probes, not live gates. A HEAD-based Import comparison was invalid (HEAD v11 versus current v16); it cannot prove preservation of the current Import body.

Missing post-correction records: the interrupted update reported 1629/1629 backend tests in 67 files, successful typecheck/build and three guards with 29 live cases excluded. No corresponding durable correction record was found in the requested handoff directory, Q21-named records, local output directories or Q21 temp files. These counts and final unit/typecheck/build exits remain UNVERIFIED, not replaced with original 1611 evidence. The supplied terminal context confirms exit 0 for `npm exec --workspace=backend -- vitest run --config vitest.eval.config.mts src/lib/prompts/recipeAnalyze.eval.test.ts src/lib/prompts/dailyInsight.eval.test.ts --testNamePattern 'prompt version matches fixture expectations' --silent --reporter=dot`; its exact test counts are UNVERIFIED without output/report. A versions-only filter is NOT a livegate. Red-before-green evidence for the new regressions is also UNVERIFIED.

## Live Calls And Limits

This local completion: zero provider/live calls, zero gate repetitions. No final-candidate F/R/G is performed or claimed. Original Q21 F/R/G did make real provider calls: each has 5 Preparation SDK operations / 6 logical calls, including forced dough's mocked first draft; this is not the total SDK count across Import/Daily/other live domains. Cross-domain total calls and any pre-completion correction-session live calls are UNVERIFIED from available records. The saved QA report states no live gate repetition during its review. Do not infer zero historical calls from a filtered versions check.

Independent QA must remain separate; human oven approval remains manual. Required final liveeval verification is outstanding under the AI skill and is not waived by the user's prohibition on live repetition in this completion. No QA-PASS, Finding closure, overall-gate PASS or deployment authorization is issued.

## Protected Boundaries And Preservation

Read-only SHA-256 comparison against `docs/qa/reports/Q21-2026-10-10-baseline.json`: 1010 files checked, none missing, 25 changed since original pre-report QA capture. This is not a correction-session baseline. Provider `openai.ts`, Preparation loop `recipePreparation.ts`, API handler `recipes.ts`, sharing handler `instagramRecipe.ts`, validators `recipeAnalyzeValidation.ts`/`dailyInsightValidation.ts`, quota/quotaConfig and Weekly test helper matched their baseline hashes. Thus the protected runtime implementations are byte-identical to that baseline; this is not fresh behavior execution for API/quota/3-call/noWrites. Import's current version constant is v16, but exact unchanged Import prompt-body provenance is UNVERIFIED (its shared prompt file changed).

The original QA report and `docs/qa/findings.md` differ from the original QA baseline, alongside the intended source/test/KB files. The report difference is expected from original report publication, but this completion cannot establish full attribution or pre-correction register preservation. All existing differences are retained. Historical QA/Plan/Story/Evidence files not in the 25-file changed list match that available baseline; this does not establish preservation of files added later or every historical KB paragraph.

Completion-only command: PowerShell inline JavaScript here-string piped to `node`, exit 0. JSON and seven historical record/transcript hash assertions passed. Category hash checks: renderer 44/44 unchanged; Weekly 16/16 unchanged; API/provider/quota/loop/shared-types 38/38 unchanged. Of 318 QA/Story history files, 316 match and only the already differing report/register above do not. This is local artifact validation, not an implementation gate.

UTF-8 fatal decoding and replacement-character checks passed for 25 files (23 current candidate source/test/KB files plus these two completion artifacts). The same 25 contain none of the configured `AZURE_*KEY`/`AZURE_*ENDPOINT` values longer than eight characters from local settings. This is a scoped configured-value check, not a universal secret audit or repository-wide encoding gate. No secret or endpoint values are printed or copied. Existing credential configuration is not an output artifact. Detailed counts are in manifest completionValidation.

## Process Blocker And Handoff

Missing durable post-correction gate output is the concrete process/evidence blocker. Do not reconstruct success, rerun gates solely to populate this handoff, or close findings. Current implementation and regressions exist; final execution claims remain partially UNVERIFIED. QA/register/history are left untouched by this completion. The next authorized owner must use genuine retained execution evidence or obtain separate authorization for outstanding verification; no such execution is started here.
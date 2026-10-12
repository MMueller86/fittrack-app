# QA Report: Q-19 Recipe Export Preparation Simplification

- Format: `fittrack-qa-v1`
- Date: 2026-10-09
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Verdict: `FAIL`
- Decision boundary: STOP FOR ORCHESTRATOR DECISION. No repair, retry, new candidate, deployment or release approval is authorized by this review.

## Scope

Independent review of the complete approved plan, especially sections 4/5/6/9/10/11, and [original US-10](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md). Reviewed all B-19 own code/test hunks, the compact backend-only operation, saved-source authority, tests/evals, renderer boundaries, and all five D-19 KB documents. Preparation is frozen at v4; Import stays v16. This is a selective useful summary, not first-five selection, exactly-five padding or exhaustive optional-detail retention.

Inputs: [B-19 handoff](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Handoff_2026-10-09.md), [manifest](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Manifest_2026-10-09.json), [own delta](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_EigenerDiff_2026-10-09.patch), [offline evidence](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_OfflineEvidence_2026-10-09.json), [live evidence](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_LiveEvidence_2026-10-09.json), [D-19 handoff](../../User%20Stories/Reciepe/D-19_Recipe-Preparation_Handoff_2026-10-09.md), and [v18 follow-up](PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Nachpruefung.md). Upstream results were read, not substituted for independent gates. The archived helper was not executed.

Only this fresh report is written by Q-19. Existing dirty files, historical artifacts, registry, plan, KB, renderer tests, product code and tests are preserved. No new resources, dependencies, persistence methods or API/mobile/shared changes. No credential values, endpoint, private recipe or real Cosmos data are included here. The only real service calls are the three authorized live gates. Quota/storage/repository in those handler tests are mocked or in-memory; provider/SDK are real.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [openai.ts](../../../backend/src/lib/openai.ts#L522): dedicated compact output/schema/operation, closed top-level and nested objects; no import normalization or full-output wrapper in Preparation. Import remains single-argument `analyzeRecipeText(text)` with original schema/normalization. SDK request tests pass. |
| AC-2 | PASS | [context builder](../../../backend/src/functions/recipes.ts#L704), [v4 prompt](../../../backend/src/lib/prompts/recipeAnalyze.ts): complete reduced recipe context and all original steps, no private IDs, no truncation/sorting; untrusted data and Shared-derived 1..5/90/96/10080 rules. Unsuitable source order is not silently repaired. |
| AC-3 | PASS | [validator tests](../../../backend/src/lib/recipeAnalyzeValidation.test.ts), [real-font renderer tests](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts): positive 1/5/90/96/null/bounded time, negative 0/6/91/97/blank/bad metadata/unknown fields; 140 validator and 34 renderer tests pass, including PNG 1080x1350 and 1..5 steps. No visual human sign-off claimed. |
| AC-4 | PASS | [validator](../../../backend/src/lib/recipeAnalyzeValidation.ts#L99) and passing validator/handler tests: saved positive unique ascending authority, contiguous export order, known nonempty internally ascending groups, global unique refs, increasing FIRST ref only. `[1,4,6],[5]` accepted only for Preparation; reversed group starts, duplicates, unknown/internal reverse rejected; import flattened monotonic trace unchanged. No source/output sorting, filling or mutation. |
| AC-5 | FAIL | Original saved eight-step rice fixture unchanged. Own F/R reject invalid starts `[1,2],[3,4],[6],[5],[8]` with 422/usage0. Own G accepts valid refs but replaces source-6 finish cooking/lower heat with continuous frying, 200/usage1; final semantic assertion fails. Q19-01/Q19-02. |
| AC-6 | FAIL | Both added, presourced fixtures and flexible-count offline rubrics exist. Pasta passes all three own live gates with independent sauce and pasta cooking. Oven duplicates source3 in every own gate and reverses group starts in F/G, so never achieves validated success. No source-backed baking-temperature invention observed; final oven semantic assertion was not reached. Q19-02. |
| AC-7 | PASS | [handler](../../../backend/src/functions/recipes.ts#L751), 105 passing handler tests, 78 AI tests and live counters: auth/owner/optional ETag before quota, 429/502/422, empty cooking basis 422 before quota/provider/usage, one SDK operation, temperature0.2/max_tokens2048, usage once only after structural validation, no writes, unchanged record/ETag, V2 stripped refs. Save/Share/fingerprint contracts untouched. G rice demonstrates the documented distinction between structural validation and cooking semantics. |
| AC-8 | PASS | Own focused 357/357, complete backend 1437/1437, typecheck/build verification exit0. FT-072 positive/negative core/contradiction regressions pass. Import schema/normalization/ordered trace and original fixtures preserved. Direct compact tests cover current provider contract; older full-fixture adapters are test-only. Residual ingredient-oriented handler test labels are a suggestion, not runtime coupling (Q19-05). |
| AC-9 | FAIL | Own F then R then G each executed exactly once, all three Preparation cases each time. Counts/exits and nine raw outputs below; all gates exit1. No all-skipped, missing-credential or later-pass substitution. Import/Daily failures and one timeout are separated. Q19-01..04. |
| AC-10 | PASS WITH ISSUES | All 75 B-19 hunks reviewed below; dedicated small operation, no strategy/service wrapper or generic framework. All five required KB documents accurately describe the compact current contract, policy, versions and B-19 failed gates. No foreign rollback or release claim. Q19-05 suggests truthful names for obsolete test scenarios; no production simplification defect found beyond live results. |
| US-10 AC-15 | FAIL | Interpreted under approved v19 selective summary: <=5 meaningful steps or controlled block, not first five/exactly five. F/R/oven controlled blocks are protective; G rice is accepted but semantically incorrect, and required real rice/oven successes are absent. |
| US-10 AC-16 | FAIL | Interpreted under approved v19 component grouping and optional-detail omission, not exhaustive retention. Main cooking and substantial separate side/sauce must remain source-faithful. G rice loses lower-heat finishing transition and changes 4 minutes per side + 6 finishing minutes into 14 minutes frying. Human review remains separately required. |

## Tests

All commands are workspace-root equivalents. Backend Vitest is 2.1.9. F/R use the official [runner](../../../backend/scripts/run-eval.mjs); its private local-settings load and exit are preserved. G uses the package's existing npm script. Node `spawnSync` with explicit argument arrays captured native exits without PowerShell regex piping or stderr promotion. `--reporter=default` changes reporting only. Captures remained in memory until summarized here; no QA helper/capture files were created.

| Command | Exit code | Result |
|---|---:|---|
| `npm.cmd exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts --reporter=dot --silent` | 0 | Own focused: 4 files, executed357/pass357/fail0/skip0; validator140, handlers105, AI78, renderer34. 82.42s, local start15:15:55. |
| `npm.cmd run test --workspace=backend -- --reporter=dot --silent` | 0 | Own complete backend: 66 files, executed1437/pass1437/fail0/skip0; 77.67s, local start15:17:40. |
| `npm.cmd run typecheck --workspace=backend` | 0 | Own backend typecheck passed. |
| `npm run build:verify --workspace=backend` | 0 | Own actual native build exit captured via Node/npm-cli: compilation, 10 renderer assets, module resolution and duplicate Function IDs pass. Expected Functions test-mode/register warnings only; no deployment. |
| F: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation" --reporter=default` | 1 | Own executed4/pass2/fail2/skip9. Exactly3 Preparation cases + v4 version guard. Nine skips are intentional import/other guard exclusions. |
| R: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --reporter=default` | 1 | Own executed13/pass10/fail3/skip0. Preparation1/3, Import7/8, both version guards pass. |
| G: `npm run test:eval --workspace=backend -- --reporter=default` | 1 | Own executed41/pass36/fail5/skip0, 5 files (3 pass/2 fail). Preparation1/3, Import7/8; remaining failed tests are two Daily cases, one timed out. 201.32s Vitest duration. |
| `git diff --check` | 0 | No whitespace errors. Existing CRLF-to-LF notices only; no rewrite. |

The first PowerShell-wrapped build attempt was interrupted by `NativeCommandError` on a native warning before reliable exit assignment. That shell attempt exited1; it is not a product build failure or success. The separate offline direct native build above actually exited0. No live gate was repeated for this wrapper issue.

UTC intervals: F `2026-10-09T13:21:04.472Z` to `13:21:14.621Z`; R `13:21:28.883Z` to `13:22:59.457Z`; G `13:23:16.858Z` to `13:26:48.868Z`. Each real Preparation case used model `gpt-4o-mini`, configured API `2024-08-01-preview`, temperature0.2, max_tokens2048, one Preparation invocation, one SDK operation and finish reason `stop`. The unchanged lazy client default is `2024-07-01`; no setting or dependency was changed. An SDK operation counter is not a claim about internal transport retry behavior.

## Independent Live Evidence

Aliases below refer to exact synthetic fixtures in [eval fixtures](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts): Rice = `synthetic-saved-eight-steps-rice-serving`; Oven = `synthetic-saved-oven-seven-steps`; Pasta = `synthetic-saved-pasta-essential-sauce`. No private original was substituted.

| Gate/case | Source/export | Description lengths | HTTP/usage | Writes update/replace/create | Unchanged | Raw ID | Actual outcome |
|---|---|---|---|---|---|---|---|
| F Rice | 8/5 | 66,73,56,65,47 | 422/0 | 0/0/0 | true | FR-rice | FAIL: first refs 1,3,6,5,8. |
| F Oven | 7/5 | 71,64,59,72,46 | 422/0 | 0/0/0 | true | F-oven | FAIL: duplicate3; first refs1,3,2,6,7. |
| F Pasta | 7/4 | 66,67,47,55 | 200/1 | 0/0/0 | true | FR-pasta | PASS including final semantics. |
| R Rice | 8/5 | 66,73,56,65,47 | 422/0 | 0/0/0 | true | FR-rice | FAIL: first-ref order. |
| R Oven | 7/4 | 81,64,66,46 | 422/0 | 0/0/0 | true | R-oven | FAIL: duplicate3. |
| R Pasta | 7/4 | 66,67,47,55 | 200/1 | 0/0/0 | true | FR-pasta | PASS including final semantics. |
| G Rice | 8/4 | 66,65,57,60 | 200/1 | 0/0/0 | true | G-rice | FAIL: source6 finish-cooking semantics despite valid refs. |
| G Oven | 7/5 | 71,64,59,72,46 | 422/0 | 0/0/0 | true | G-oven | FAIL: duplicate3 + first-ref order. |
| G Pasta | 7/4 | 66,67,58,55 | 200/1 | 0/0/0 | true | G-pasta | PASS including final semantics. |

### Actual Small Outputs

These are complete actual compact outputs, with Unicode JSON escapes preserving exact text. FR-rice and FR-pasta are each identical in both own F/R captures; reused IDs are not inferred or golden outputs. Each remaining ID denotes its one actual capture.

FR-rice:
```json
{"version":1,"teaser":"Ein einfaches Rezept f\u00fcr eine leckere H\u00e4hnchenpfanne mit Reis.","totalTimeMinutes":30,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide das H\u00e4hnchen in W\u00fcrfel und w\u00fcrze es mit Salz und Pfeffer.","sourceStepOrders":[1,2]},{"order":2,"description":"Erhitze Oliven\u00f6l in der Pfanne und brate das H\u00e4hnchen 4 Minuten je Seite.","sourceStepOrders":[3,4]},{"order":3,"description":"Senke die Hitze und gare das H\u00e4hnchen weitere 6 Minuten.","sourceStepOrders":[6]},{"order":4,"description":"Koche den Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","sourceStepOrders":[5]},{"order":5,"description":"Serviere das H\u00e4hnchen mit dem Reis als Beilage.","sourceStepOrders":[8]}]}
```

F-oven:
```json
{"version":1,"teaser":"Ein einfacher und leckerer Kartoffelauflauf f\u00fcr jeden Anlass.","totalTimeMinutes":50,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide die Kartoffeln in d\u00fcnne Scheiben und schichte sie in die Form.","sourceStepOrders":[1,3]},{"order":2,"description":"Gie\u00dfe die Sahne \u00fcber die Kartoffeln und streue den K\u00e4se dar\u00fcber.","sourceStepOrders":[3,4]},{"order":3,"description":"Fette die Auflaufform ein und heize den Ofen auf 180\u00b0C vor.","sourceStepOrders":[2,5]},{"order":4,"description":"Backe den Auflauf bei 180\u00b0C f\u00fcr 40 Minuten, bis die Kartoffeln gar sind.","sourceStepOrders":[6]},{"order":5,"description":"Lasse den Auflauf kurz ruhen und serviere ihn.","sourceStepOrders":[7]}]}
```

FR-pasta:
```json
{"version":1,"teaser":"Ein einfaches Rezept f\u00fcr Pasta mit frischer Tomatensauce.","totalTimeMinutes":35,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide die Zwiebel klein und brate sie in erhitztem Oliven\u00f6l an.","sourceStepOrders":[1,2,3]},{"order":2,"description":"Gib die Tomaten zur Zwiebel und lasse die Sauce 15 Minuten k\u00f6cheln.","sourceStepOrders":[4]},{"order":3,"description":"Koche die Pasta in Salzwasser und gie\u00dfe sie ab.","sourceStepOrders":[5,6]},{"order":4,"description":"Mische die Pasta mit der Tomatensauce und serviere sie.","sourceStepOrders":[7]}]}
```

R-oven:
```json
{"version":1,"teaser":"Ein k\u00f6stlicher Kartoffelauflauf f\u00fcr jeden Anlass.","totalTimeMinutes":50,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide die Kartoffeln in d\u00fcnne Scheiben und schichte sie in die gefettete Form.","sourceStepOrders":[1,2,3]},{"order":2,"description":"Gie\u00dfe die Sahne \u00fcber die Kartoffeln und streue den K\u00e4se dar\u00fcber.","sourceStepOrders":[3,4]},{"order":3,"description":"Heize den Ofen auf 180\u00b0C vor und backe den Auflauf f\u00fcr 40 Minuten.","sourceStepOrders":[5,6]},{"order":4,"description":"Lasse den Auflauf kurz ruhen und serviere ihn.","sourceStepOrders":[7]}]}
```

G-rice:
```json
{"version":1,"teaser":"Ein einfaches und schmackhaftes Gericht mit H\u00e4hnchen und Reis.","totalTimeMinutes":35,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide das H\u00e4hnchen in W\u00fcrfel und w\u00fcrze es mit Salz und Pfeffer.","sourceStepOrders":[1,2]},{"order":2,"description":"Erhitze Oliven\u00f6l in der Pfanne und brate das H\u00e4hnchen 14 Minuten.","sourceStepOrders":[3,4,6]},{"order":3,"description":"Koche den Reis 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","sourceStepOrders":[5]},{"order":4,"description":"Lasse das H\u00e4hnchen 3 Minuten ruhen und serviere es mit Reis.","sourceStepOrders":[7,8]}]}
```

G-oven:
```json
{"version":1,"teaser":"Ein einfacher und leckerer Kartoffelauflauf f\u00fcr jeden Anlass.","totalTimeMinutes":40,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide die Kartoffeln in d\u00fcnne Scheiben und schichte sie in die Form.","sourceStepOrders":[1,3]},{"order":2,"description":"Gie\u00dfe die Sahne \u00fcber die Kartoffeln und streue den K\u00e4se dar\u00fcber.","sourceStepOrders":[3,4]},{"order":3,"description":"Fette die Auflaufform ein und heize den Ofen auf 180\u00b0C vor.","sourceStepOrders":[2,5]},{"order":4,"description":"Backe den Auflauf bei 180\u00b0C f\u00fcr 40 Minuten, bis die Kartoffeln gar sind.","sourceStepOrders":[6]},{"order":5,"description":"Lasse den Auflauf kurz ruhen und serviere ihn.","sourceStepOrders":[7]}]}
```

G-pasta:
```json
{"version":1,"teaser":"Ein einfaches Rezept f\u00fcr Pasta mit frischer Tomatensauce.","totalTimeMinutes":35,"difficulty":"einfach","steps":[{"order":1,"description":"Schneide die Zwiebel klein und brate sie in erhitztem Oliven\u00f6l an.","sourceStepOrders":[1,2,3]},{"order":2,"description":"Gib die Tomaten zur Zwiebel und lasse die Sauce 15 Minuten k\u00f6cheln.","sourceStepOrders":[4]},{"order":3,"description":"Koche die Pasta in Salzwasser 10 Minuten und gie\u00dfe sie ab.","sourceStepOrders":[5,6]},{"order":4,"description":"Mische die Pasta mit der Tomatensauce und serviere sie.","sourceStepOrders":[7]}]}
```

### Source and Core Matrix

The exact saved-source descriptions remain in the frozen fixture file; the live captures checked unchanged source against those fixtures. This matrix records the source facts, required cores and independent AI/read-only content assessment, not a claimed human review. Optional omissions are allowed. Neither five steps nor one group per action is required.

| Source | Original source facts by order | Required core | Own content assessment |
|---|---|---|---|
| Rice | 1 cut chicken cubes; 2 salt/pepper; 3 heat olive oil in pan; 4 fry chicken medium heat 4min each side; 5 separately cook rice12min in salted water/drain; 6 lower heat, finish chicken another6min; 7 remove/covered rest3min; 8 serve chicken with rice side. | 1 prepare; 4 fry; 5 actual separate rice cooking; 6 finish cooking after frying. Optional2/3/7/8 may be omitted or grouped without changing core. | F/R text shows all four cores, but invalid group starts reject it; this is not a demonstrated core-loss fix. G has correct source6 ref but no lower heat/finishing action, instead 14min continuous frying. Side cooking remains present. |
| Oven | 1 thin potato slices; 2 grease form; 3 layer potatoes/pour cream; 4 cheese; 5 preheat180C; 6 oven bake180C40min until potatoes cooked; 7 rest/serve. | 1 cut; 3 assemble with cream; 6 actual oven baking. Optional2/4/5/7 may be omitted or grouped. | Baking180C40min and core ingredients visible in F/R/G; source3 is split/duplicated between groups. F/G additionally instruct greasing after filling. All are structurally rejected; final core assertions not reached. No validated oven success. |
| Pasta | 1 cut onion; 2 heat olive oil; 3 fry onion; 4 add tomatoes, sauce simmer15min; 5 separately boil pasta in salted pot10min; 6 drain; 7 mix sauce/pasta and serve. | 1 cut; 3 fry onion; 4 cook substantial sauce; 5 separately cook pasta. Optional2/6/7 may be omitted or grouped. | All three preserve onion,15min sauce and actual separate pasta cooking before mixing. F/R omit optional explicit pasta duration without inventing another; G retains source-backed10min. No component swap, invented temperature or contradictory cooking duration observed. All final semantic assertions pass. |

F/R Rice/Oven and G Oven execute request binding, compact schema/parameters, one SDK call, quota-before-provider, source equality, no-write and unchanged-record checks, then fail at [validation assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L367). Later success/status200/usage1/V2/private-ID and final semantic assertions are NOT reached. Their observed 422/usage0 counters are evidence, not success assertions.

F/R Pasta and G Rice/Pasta execute the success protection marker: V2 body, quota/usage order, no writes, unchanged saved source, compact schema, SDK1/usage1. The marker is emitted BEFORE [final semantic assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L397). Thus G Rice's marker does not imply semantic success. G Rice fails source6's finish-cooking assertion; all Pasta markers are followed by an actual passing test. Structural validity does not certify arbitrary cooking semantics.

### Foreign Gate Failures

R Import `indeterminate-spray-oil-stays-food`: actual `amountGrams=0.01`, expected null for unmeasurable spray oil; failure at [amount assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L77). G Import `mixed-food-seasoning`: actual flattened trace `[1,2,3,4,5,5]`; duplicate source5 used for mixing and garnish, expected unique complete six-source trace; [trace assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L224). These are unchanged Import v16 failures, not evidence that Preparation edits altered Import.

G Daily `phase-progress-open-day`: `DailyInsightValidationError: Daily insight judges an open day as completed`. G Daily `protein-gap-with-budget`: `Test timed out in 30000ms`; the assertion outcome is UNVERIFIED, not an established protein-content defect. G still has five failed tests including that timeout; none were rerun. No Root-cause claim connects foreign failures to v19.

## Upstream Reconciliation

All nine archived B-19 synthetic raw outputs, source/core matrices, counts and assertion boundaries were reviewed from the nested `gates[].reconciledRecords[].data` UTF-8 records. B-19's F executed4/pass2/fail2/skip9, R13/10/3/0, G41/35/6/0 all exit1; each executes three Preparation cases. These remain failed historical gates, not Q-19 gates.

| B-19 gate | Rice | Oven | Pasta | Foreign failures |
|---|---|---|---|---|
| F | 5 steps; refs `[1,2],[3,4],[6],[5],[8]`; time25; 422/usage0. Core text visible, starts invalid. | 4 steps; refs `[1,2,3],[3,4],[5,6],[7]`; time50; 422/usage0, duplicate3. | 4 steps; refs `[1,2,3],[4],[5,6],[7]`; time35; source-backed10min pasta; 200/usage1/pass. | Nine intentional excluded tests only. |
| R | Same invalid groups, time30; 422/usage0. | Same duplicate3 groups, time40; 422/usage0. | Same valid groups, time35 and10min pasta; 200/usage1/pass. | `no-lost-or-invented-ingredients`, flattened `[4,3]` reversal. |
| G | Same invalid groups, time30; 422/usage0. | Same duplicate3 groups, time40; 422/usage0. | Same valid groups, time35, pasta duration omitted; 200/usage1/pass. | Daily `phase-progress-open-day`, `protein-nearly-complete`, `midday-empty-day-not-morning`, `stale-weight`; Import8/8 passed. |

Archived rice teaser wording varies in G; full actual texts remain in the linked immutable LiveEvidence, not a recreated capture. Every archived case reports one call, zero writes and unchanged source; only Pasta reaches final success/semantic assertions. B-19 helper exit0 means capture completion, not gate success. Independent G now adds directly observed accepted rice core loss; that does not retroactively change archived outcomes.

Offline B-19 red351/348/3 is upstream chronology, not independently rerun red. Its earlier focus356 predates the added final single-group Pasta regression; Q-19 final focus357 is consistent with the frozen final test file. Q-19 verifies regression existence/result, not test-first chronology. D-19 ran documentation only and did not claim live acceptance.

## Full Own-Hunk Review

H numbers are file-local hunks in the linked B-19 own delta, not cumulative dirty HEAD diff. All 75 hunks were read with current owning implementations and nearby tests. Historical renderer edits are not attributed to B-19.

| File | Every own hunk and review disposition |
|---|---|
| [openai.ts](../../../backend/src/lib/openai.ts) | H1 Shared bounds import; H2 compact type/strict schema/dedicated SDK operation and removal of optional Preparation branch from import. Small backend-only operation, existing client, no normalization/persistence coupling. AC-1/2/7. |
| [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | H1 v4 compact prompt/Shared interpolation/untrusted saved input/component-first-ref grouping; import v16 body unchanged. No first-five/exact-five rule. Live deficiencies recorded rather than hidden. AC-1/2/4/5/6. |
| [recipeAnalyzeValidation.ts](../../../backend/src/lib/recipeAnalyzeValidation.ts) | H1 Shared bounds import; H2 compact/saved-source schema and types; H3 bounded diagnostics typing; H4 saved authority, nonempty known unique refs and first-ref policy; H5 removal of obsolete Preparation label option in import trace helper. Reuses low-level step schema only; import flattened policy remains distinct. AC-3/4/7. |
| [recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) | H1 test-only old-fixture adapter plus direct compact bounds/ref/no-mutation tests, three synthetic rubric regressions and one-group Pasta; H2 old required-source test adapted to unknown refs; H3 compact semantic helper input; H4 diagnostic paths switched to compact shape/known-source authority. FT-072 substantive tests retained. No production full-output adapter. AC-3/4/6/8. |
| [recipes.ts](../../../backend/src/functions/recipes.ts) | H1 dedicated provider import; H2 empty basis guard before quota; H3 new operation call; H4 validate compact output against saved steps, no AI source authority; H5 small result extraction. Context/auth/owner/ETag/quota/usage/V2/save/share remain intact; no repository changes. AC-2/4/7. |
| [recipes.test.ts](../../../backend/src/functions/recipes.test.ts) | H1-H3 mocks/import/reset use new provider; H4-H5 compact helper; H6-H7 versioned before/after no-mutation assertions; H8 empty-source/full-input regressions; H9 preserved original source; H10 compact happy-path and call order; H11-H14 adapt old ingredient-match scenarios; H15-H16 stale-ETag/provider use; H17-H26 provider/error/ingredient/no-resolution setups use compact operation; H27-H28 private-log test removes full-output mutations and validates exact saved authority; H29-H30 real known refs; H31-H33 allowed interleaving; H34-H36 AI-only refs/no writes; H37-H38 quota/provider failure; H39 rejects obsolete ingredients instead of full-output unknown-key branch; H40-H41 auth/foreign-owner protections. All41 accounted for; cosmetic duplicate ingredient-oriented scenario titles are Q19-05. AC-2/3/4/7/8. |
| [ai.test.ts](../../../backend/src/functions/ai.test.ts) | H1-H2 types/new provider imports; H3 compact/full union confined to mock client; H4-H6 mock adaptation and import request checks retained; H7 dedicated compact SDK request assertion, no wrapper/full output. Fixed onecall/parameters/context verified. AC-1/2/7/8. |
| [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | H1 type/provider imports; H2 v4 guard; H3 Preparation spy; H4 compact raw capture; H5 SDK binding/current schema; H6 source/core/handler capture aligned compact output; H7 validator against saved source and compact counts; H8 success protection marker/current semantic helper. Eight original import cases unchanged. Early-failure boundaries and marker-before-semantics explicitly accounted for. AC-5/6/7/9. |
| [recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts) | H1 narrows semantic helper structural input; H2 adds two source fixtures, presourced core/optional constraints and compact Preparation semantic helper, no exact-five/golden output. Original eight import fixtures and original saved eight-source rice fixture unchanged. AC-5/6/8. |

Six archived unchanged invariants reconciled with own delta/current code: import prompt, import version, import schema, original import fixtures, original rice source fixture, and import kitchenAmountText normalization. Removing only the optional import Preparation branch is deliberate, not a change to import ingredient interpretation. All production call sites use `analyzeRecipeText(text)` for Import or `prepareRecipeExport(context)` for Preparation; no obsolete runtime mode wrapper remains. Schema reuse and test-only compatibility adapter are proportionate, not new runtime abstractions.

### Documentation Review

Formal evidence completion (2026-10-09), within the same Q-19 handoff: the original table recorded four D-19 required documents plus `tech/08-testing.md`, omitting `domain/06-recipes.md`. The original blanket claim that all five D-19 documents had been reviewed was therefore not fully evidenced; prior review of the omitted document cannot be established from this report. The table below corrects that evidence gap, not the candidate or gate outcome.

A narrow read-only comparison now covers exactly the five documents required by [approved v19 section 8](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md#L175), using the [D-19 exact edit list and AC-10 summary](../../User%20Stories/Reciepe/D-19_Recipe-Preparation_Handoff_2026-10-09.md#L36) against each current Preparation section. The missing recipe-domain check is completed now; the other four entries are confirmed against D-19/current text, without claiming a new implementation review or rerunning any gate.

| D-19 Required KB (exactly five) | D-19 handoff / current-document reconciliation |
|---|---|
| [docs/kb/domain/06-recipes.md](../../kb/domain/06-recipes.md#L182) | Previously omitted evidence; checked now. Transient Export-View Preparation documents separate v4 small strict output versus unchanged v16 Import, complete ID-free saved input, saved-source authority and FIRST-reference grouping, unchanged V2/transience, no general semantic guarantee, and B-19 failed gates with rice/oven assertions not reached. Matches D-19's recipe-domain edit purpose and AC-10 summary. |
| [docs/kb/domain/07-ai-features.md](../../kb/domain/07-ai-features.md#L202) | Prior table entry confirmed now: separate v4 Preparation/v16 Import, compact output, source-backed selective workflow, FIRST-reference policy, no ingredient remapping or semantic safety guarantee, and failed B-19 evidence match D-19. |
| [docs/kb/tech/02-backend.md](../../kb/tech/02-backend.md#L242) | Prior table entry confirmed now: dedicated operation/schema, separate saved-source validation, fixed single-call parameters, auth/ETag/quota/usage order, stripped refs and unchanged confirmation/concurrency boundaries match D-19; B-19 remains not accepted. |
| [docs/kb/tech/06-ai-integrations.md](../../kb/tech/06-ai-integrations.md#L106) | Prior table entry confirmed now: v4/v16 path separation, compact strict output, same client/deployment/API version and fixed parameters, FIRST-reference policy, runtime semantic limits and exact upstream failed F/R/G counts/assertion boundaries match D-19. Historical evidence is not converted to PASS. |
| [docs/kb/tech/09-api-reference.md](../../kb/tech/09-api-reference.md#L400) | Prior table entry confirmed now: unchanged strict public V2 request/plain response, internal refs stripped, empty-source422 before quota/provider, transient preview/no writes, separate provider contract and B-19 failed evidence match D-19. |

Preserved prior supplementary Q-19 review entry, not part of the five D-19 documents: [testing](../../kb/tech/08-testing.md) recorded that the three Preparation fixtures, offline/real-font/live gates and failed B-19 status were accurately distinguished. Section 9 requires this testing document for Q-19, but it cannot replace the recipe-domain document in D-19's required set; that supplementary entry was not newly rechecked here.

This formal completion makes no new test, build, live or provider call and changes only this existing report. All earlier commands, gate counts/exits, raw outputs, findings, historical evidence and decision boundaries remain unchanged. Verdict remains FAIL; no finding or historical entry is closed.

No KB/implementation contradiction found for the v19 contract. Historical user-story UI language and older exhaustive trace assumptions are interpreted through the explicit approved v19 clarification, not silently redesigned. KB reports B-19 history, not this new Q-19 outcome; it remains untouched under the user's report-only authorization.

### Frozen Candidate

These current SHA-256 values match every B-19 `afterSha256` snapshot. Before report creation, all824 existing tracked/untracked baseline leaf files remained byte-identical. The post-write gate below also protects foreign registry/history/KB files. Gitignored generated build/cache files are outside that tracked/untracked baseline, not product edits.

| Candidate path | SHA-256 |
|---|---|
| [openai.ts](../../../backend/src/lib/openai.ts) | `3fab86522a4e0c8db17e85aad28e52c2415d308b28d48cb209fbc0ba28b656bd` |
| [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | `1de736e90f34df92a60f8b09f3bbe316090a87095ccfd9d8e9bd04f1b20e49a2` |
| [recipeAnalyzeValidation.ts](../../../backend/src/lib/recipeAnalyzeValidation.ts) | `5216fd9f27b2e1197f50b1d64eb15f5e131a1da4519df7d818e04632ca97352c` |
| [recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) | `89ab89897d0e73eea6fe11dc9c7f05053e4a77a24dffbced2d6aa7fb00346e78` |
| [recipes.ts](../../../backend/src/functions/recipes.ts) | `3a94e45299640f98047fdde23cd34ed4310a64a195949ffba1385c4924cffd1e` |
| [recipes.test.ts](../../../backend/src/functions/recipes.test.ts) | `70a9f734e742345969c9a0ef158fb01653634f30c0dffb86dcff3f5ad5eae85f` |
| [ai.test.ts](../../../backend/src/functions/ai.test.ts) | `0ea4adb4cfe48e4c4a96cd16c71b352cf55ce332655627c0afd90271121fbd73` |
| [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | `1781b3e81589d603f63ecf059a2c63c48011bfa79241af3dc779f89278e5938d` |
| [recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts) | `6ff92ce93ef097e88af20afe1341935fb6c069652da49aafe2b70b075112fc50` |

## Verification Notes

These are not actionable-finding criticalities and do not independently lower the verdict.

| State | Prerequisites / reason | Steps | Expected result | Result |
|---|---|---|---|---|
| MANUAL VALIDATION REQUIRED | Actual human reviewer with cooking/domain context; AI review is not human sign-off. | Compare each of the three frozen saved sources against all F/R/G outputs above; assess cores, component grouping, order, metadata, optional omissions and source-backed cooking. | Useful <=5/90 summary; main finish cooking and separate substantial side/sauce preserved, no invented/swapped cooking. | Not performed by a human. Independent AI/read-only assessment and actual assertion results are recorded separately. |
| UNVERIFIED | Historical private original and exact deployed revision unavailable. | Orchestrator supplies authorized historical recipe/revision replay scope before any new call. | Reproducible historical FT-071/FT-076 outcome on identified source/revision. | No private replay, no deployed revision verification, no historical closure. |
| UNVERIFIED | G `protein-gap-with-budget` timed out at30s. | Orchestrator decides separate authorized investigation; no automatic retry. | Completed test and concrete assertion result, with counts/exit preserved. | Failed test entry due timeout; content assertion unverified. |
| MANUAL VALIDATION REQUIRED | Real device/Alpha release context and authorization; none supplied. | Only in a separately authorized session inspect unchanged Save/Share confirmation, fingerprint and deployed screen with chosen recipe, if required for release. | Existing contracts remain functional; no automatic save/share or UI regression. | No deployed Alpha/device/Share replay. Local contracts/tests pass; no mobile change. |
| UNVERIFIED | General semantic fidelity and inferred metadata exceed finite synthetic rubrics. | Human assessment above, then any future authorized candidate evaluation against approved source-backed requirements. | No unsupported totals/difficulty, omissions of core actions or component/time/temperature contradictions. | Finite tests are not a universal guarantee. Totals/difficulty here are bounded values, not independently proven metadata correctness. |

No Cosmos contract gate was run: no document, container or repository method changed; handler evals use in-memory repository. No live Cosmos calls occurred. No shared/mobile tests or typechecks were needed because those packages were untouched. No visual screenshot/human layout assessment was claimed; the required real-font PNG renderer gate passed. Encoding is enforced by existing CI, and the new report is ASCII with escaped synthetic Unicode.

## Findings

### Q19-01: Accepted Rice Output Changes Main Cooking

- Finding key: Q19-01
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Acceptance criterion: AC-5, AC-9, US-10 AC-15, US-10 AC-16
- Description: Own G rice output references source6 but says continuous frying14min instead of medium-heat frying4min each side followed by lower-heat finishing6min. It passes structural validation and returns200/usage1 but fails the finish-cooking semantic assertion. This is actual accepted-output core loss/change, not just invalid reference order.
- Criticality: Blocking
- Owner: Backend
- Evidence: Raw G-rice and counters above; [final semantic assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L397), [source/core rubric](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts). G executed41/pass36/fail5/exit1.
- Recommendation: Stop and hand back to Orchestrator for a separately approved Backend correction and QA scope. Preserve the source-backed transition/core assertions; do not equate a source6 ref or HTTP200 with faithful cooking, weaken the rubric, or retry this candidate.

### Q19-02: Required Rice/Oven Live Success Missing

- Finding key: Q19-02
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Acceptance criterion: AC-5, AC-6, AC-9
- Description: Own F/R Rice produces group starts6 before5; all own Oven outputs duplicate source3, and F/G Oven also puts first ref2 after3. The validator correctly returns422/usage0, so mandatory successful saved-rice/oven scenarios are not met. This is not rejection of permitted `[1,4,6],[5]` interleaving; that policy passes offline/handler tests.
- Criticality: Blocking
- Owner: Backend
- Evidence: All nine live rows and exact raw outputs; [validator](../../../backend/src/lib/recipeAnalyzeValidation.ts#L99), [validation assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L367). F2 and R2 Preparation failures; G Oven rejected. Upstream B-19 already showed similar structural failures.
- Recommendation: Orchestrator decides a newly authorized implementation/review scope. Keep known/unique/first-ref validation and fixed single-call parameters; do not silently sort refs, reuse source3, add fallback calls or replace failed gates with a later pass.

### Q19-03: Foreign Import Gate Failures

- Finding key: Q19-03
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Acceptance criterion: AC-9 (overall live gate; defect outside Preparation implementation scope)
- Description: Unchanged Import v16 fails R spray-oil null-quantity constraint with0.01g and G mixed-food-seasoning unique/full ordered trace with duplicate5. The overall gates are not green; no causal attribution to v19 is established.
- Criticality: Blocking
- Owner: Backend
- Evidence: R Import7/8, G Import7/8, concrete assertions in Foreign Gate Failures; [amount assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L77) and [trace assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L224).
- Recommendation: Register/associate read-only observations via Orchestrator and decide separate Import scope; no Import prompt/schema/normalization repair or retry is authorized here.

### Q19-04: Foreign Daily Open-Day Completion Judgment

- Finding key: Q19-04
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Acceptance criterion: AC-9 (overall live gate; defect outside Preparation implementation scope)
- Description: G `phase-progress-open-day` fails validation because Daily insight judges an open day as completed. The separate protein-gap timeout is a verification limitation, not this content finding.
- Criticality: Blocking
- Owner: Backend
- Evidence: G failed test and `DailyInsightValidationError` above; [Daily eval](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L23). No Daily implementation file is changed by B-19 or Q-19.
- Recommendation: Orchestrator determines historical association and separate Daily investigation authorization. Do not repair foreign Daily logic or rerun the overall gate within this review.

### Q19-05: Legacy Handler Test Names Imply Removed Input

- Finding key: Q19-05
- Plan reference: [Approved v19 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
- Acceptance criterion: AC-8, AC-10
- Description: Some migrated test names still refer to unmatched AI ingredient names or separate AI ingredient keys, although their setup now supplies identical compact text-only output without either field. They remain passing no-resolution checks but do not exercise their named ingredient scenarios. This is test clarity/redundancy, not a remaining production full-output dependency.
- Criticality: Suggestion
- Owner: Backend
- Evidence: [legacy-named tests](../../../backend/src/functions/recipes.test.ts#L382), compact `setValidPreparationAnalysis`, B-19 own test hunks H12-H14. Direct unknown-ingredient-field rejection and current compact SDK schema tests separately cover the real contract.
- Recommendation: In a future authorized test-maintenance scope, rename or consolidate only duplicate obsolete scenarios while retaining substantive compact/no-resolution/security coverage. No QA selfpatch is made.

## Historical Follow-Up And Handoff

The registry is read-only for Q-19. FT-071 cannot be recommended closed: F/R fail structurally despite visible finishing text, and own G demonstrates an accepted finish-cooking change/loss. This is synthetic evidence, not replay of the private original or proof of historical cause. FT-072's existing local rubric fix is supported by passing direct positive/negative regressions; it is not undone to achieve green. R spray oil is relevant evidence for FT-073, not a registry state decision. Daily observations may relate to FT-074 but do not close or reclassify historical entries. FT-075's historical capture classification issue remains separate; native gate exits here are used honestly. FT-076's historical source6 import loss is not automatically closed by any current import result. FT-070/v19 implementation and VER-015 historical unverified states remain Orchestrator-owned.

No product, tests, plan, KB, registry, old report or evidence artifact was changed. The only new tracked/untracked path is this report. Post-write report validation checks exactly12 unique criteria rows, one verdict, five complete findings, seven raw-output JSON blocks against actual in-memory F/R/G records, every relative evidence link, all nine candidate hashes, 824 preserved baseline files, and absence of external evidence/secret references.

Handoff: STOP FOR ORCHESTRATOR DECISION. Independent offline gates pass; mandatory real gates do not. No release recommendation, repair, new candidate or additional live calls are made.
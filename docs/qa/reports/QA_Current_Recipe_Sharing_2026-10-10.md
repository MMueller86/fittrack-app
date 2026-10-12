# QA Report: Current Recipe Sharing, 2026-10-10

- Format: `fittrack-qa-v1`
- Plan reference: approved v21 preparation plan and current US-10 sharing overrides, linked below
- Verdict: `FAIL`

## Current Acceptance

The CURRENT saved recipe-sharing feature does not have QA acceptance. This is a new independent assessment, not a replay of the historical Preparation v11 candidate. Fresh F fails required saved-rice success; fresh R loses a source-backed Import finishing action. Independent review also finds an action substitution in R's text-only oven correction. Fresh G passes 48/48, including Daily 18/18; that does not cancel F/R or the observed oven substitution.

Current versions are Preparation **v12**, Import **v16**, Daily **v17**, Daily assembly **v2**. Current fixture guards match. Candidate SHA-256: `01cd0cd18d4f5a3e443dafd9deb5ff7915dd97f1ab5ddc8387907a710f16acd3`. The baseline covers 548 candidate files and preserves 1163 preexisting repository files. All executed gate records report unchanged hashes. Final preservation evidence is emitted by the finish stage after successful report validation.

## Scope And Authority

Approved inputs:

- [../../User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md): AC-1..10; stale version literals are not instructions to revert v12.
- [../../User Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md): US-10 AC-1..29.
- [../../User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md](../../User%20Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md#L2317): original full-share criteria, interpreted under the approved overrides.
- [../../User Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md](../../User%20Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md): AUTO-APPROVED stale/ETag override, seven criteria.
- [../../User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md](../../User%20Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md): AUTO-APPROVED R2 share editor/draft override, fourteen criteria.

Reviewed: current backend/mobile/shared implementation, tests, renderer, auth/ownership, quota, persistence interfaces, prompt/schema/reference policies, runtime prompt strings and KB. Azure OpenAI and Cosmos-model skills applied. Historical Q21 reports, handoffs and register were read-only context. No current v12 hash-bound implementation handoff was established from the supplied/nearby historical handoffs; versions and sources were independently established from the saved candidate. This limits historical change attribution, not the actual new gate results.

Current contract: editor is in Share, not ordinary Create/Edit; stored stale export can be shared; optional supplied `If-Match` is checked but is not mandatory; mobile does not require response `sourceEtag` equality; internal CAS remains. Request-only `exportViewDraft` may render/share without persistence. Only explicit editor Save persists the confirmation pair. Preparation V2 is text-only, without ingredient-resolution requirements. Both images form an atomic pair. Historical stale-blocking, wizard export tab, mandatory ETag and ingredient-mapping requirements are superseded, not current defects. Optional ETag's documented lack of universal stale-client protection is an accepted plan tradeoff, not a new finding.

No feature/test/eval/KB/plan/story/register edits, deployment, EAS, server startup, subdelegation or corrective implementation loop were performed. New files are QA artifacts only. Human oven review and native/device certification are outside actionable findings below.

## Durable Evidence

Aliases used in the criteria matrix:

| Alias | Durable evidence and meaning |
|---|---|
| B | [CURRENT-RECIPE-SHARING-2026-10-10-baseline.json](CURRENT-RECIPE-SHARING-2026-10-10-baseline.json): full candidate manifest, preserved files, runtime prompt strings/hashes and versions |
| Q | [CURRENT-RECIPE-SHARING-2026-10-10-focused-Report.json](CURRENT-RECIPE-SHARING-2026-10-10-focused-Report.json): 733 focused backend tests, handlers, validation, SDK routing, renderer, repositories and Daily/Weekly helpers |
| U | [CURRENT-RECIPE-SHARING-2026-10-10-units-Report.json](CURRENT-RECIPE-SHARING-2026-10-10-units-Report.json): backend 1641/1641, including registrations |
| S | [CURRENT-RECIPE-SHARING-2026-10-10-shared-Report.json](CURRENT-RECIPE-SHARING-2026-10-10-shared-Report.json): shared 450/450 |
| M | [CURRENT-RECIPE-SHARING-2026-10-10-mobile-Report.json](CURRENT-RECIPE-SHARING-2026-10-10-mobile-Report.json): focused mobile 261/261 |
| MA | [CURRENT-RECIPE-SHARING-2026-10-10-mobileAll-Report.json](CURRENT-RECIPE-SHARING-2026-10-10-mobileAll-Report.json): full mobile 640/640, including native one-call adapter tests |
| F | [CURRENT-RECIPE-SHARING-2026-10-10-F.json](CURRENT-RECIPE-SHARING-2026-10-10-F.json): fresh filtered Preparation; complete safe requests, attempts, original source, raw outputs, probes, counts and reached markers |
| R | [CURRENT-RECIPE-SHARING-2026-10-10-R.json](CURRENT-RECIPE-SHARING-2026-10-10-R.json): fresh Recipe; same Preparation evidence plus Import source/export comparisons |
| G | [CURRENT-RECIPE-SHARING-2026-10-10-G.json](CURRENT-RECIPE-SHARING-2026-10-10-G.json): fresh Overall, all five suites |
| C | [CURRENT-RECIPE-SHARING-2026-10-10-reconcile.json](CURRENT-RECIPE-SHARING-2026-10-10-reconcile.json): independent exact current prompt/request/context/schema checks, full cooking matrices and executed assertion inventory |
| N | [CURRENT-RECIPE-SHARING-2026-10-10-selectionNames.json](CURRENT-RECIPE-SHARING-2026-10-10-selectionNames.json): exact file-plus-name selection coverage for F/R/G |

Every execution record supplies native executable/argv, cwd, UTC boundaries, native exit, counts, candidate stability, co-located output/report paths and SHA-256 values. Full F/R/G transcripts and JSON reporter results remain alongside these records. C contains all saved-source contexts and complete final descriptions, not merely a renderer-fit conclusion. The QA helper is [CURRENT-RECIPE-SHARING-2026-10-10-verification.mjs](CURRENT-RECIPE-SHARING-2026-10-10-verification.mjs).

## Acceptance Criteria

`PASS` below denotes the specified automated/source verification, not unperformed human/device checks. `PARTIAL` distinguishes actual defects from named verification limitations. All primary and original-share criteria appear exactly once.

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PARTIAL | Q/U/B/C: strict small Preparation, separate full Import, initial/full/text routing verified; R Import core failure CS-02 prevents complete acceptance |
| AC-2 | PARTIAL | Q/C: full ID-free saved context, all ingredients/steps, no first-five fallback, source retained; R text correction substitutes action, CS-03 |
| AC-3 | PASS | S/Q/U: shared 1..5, <=90 chars, null metadata negatives; real fonts/Satori/Resvg/Sharp, actual 1080x1350 PNGs, measurement/overflow boundaries |
| AC-4 | PARTIAL | Q/S: FIRST rule vs Import flattened monotone, immutable source, no padding; F FIRST exhaustion CS-01, validator correctly blocks |
| AC-5 | FAIL | F/C: eight-step rice required success fails after three calls; R/G rice passes do not erase F |
| AC-6 | FAIL; human portion MANUAL VALIDATION REQUIRED | Pasta source/sauce/separate cooking passes F/R/G; oven 180C/40min preserved but R text-only correction changes cheese action, CS-03. Endpoint interpretation and human review separate |
| AC-7 | PASS | Q/U/S/M/MA/C: requireUser/owner, optional ETag, 429/502/422, deadlines, max3 calls, success-only quota, no writes, empty-source rejection, V2/fingerprint/Save/Share |
| AC-8 | PARTIAL | All offline gates pass; current Import regression fails R (CS-02), cooking correction drift CS-03; Weekly semantic helper remains test-only; no automatic old-finding closure |
| AC-9 | FAIL | Exactly one fresh F, R, G; N proves 11/20/48 intended names executed; F10/11, R19/20, G48/48; no retry-until-green |
| AC-10 | PARTIAL | Current KB has v11/current-v12 and mandatory-ETag drift, CS-04; historical paragraphs distinguished from current contracts |
| US-10 AC-1 | PASS under overrides | M/MA: export editor in Share; ordinary wizard unchanged, canonical text controls available |
| US-10 AC-2 | PASS under overrides | M/MA/Q: transient editable draft; explicit Save confirmation pair, not compulsory pre-render confirmation |
| US-10 AC-3 | PARTIAL | Q/U/R/G: Import one full strict call carries export metadata; seven/eight Import cases pass R, CS-02 core failure |
| US-10 AC-4 | PASS under overrides | Q/M/MA: bundle/share/retry invoke no AI; only explicit missing-view preparation initiates AI |
| US-10 AC-5 | PASS automated; Cosmos UNVERIFIED | Q/U/S/M: versioned export, explicit confirmation/fingerprint, read/update roundtrip and CAS tests; real local Cosmos unavailable |
| US-10 AC-6 | PASS automated; Cosmos UNVERIFIED | Q/U/M/MA: legacy documents/recipes readable; missing view controlled, nullable preview, no invented time/difficulty |
| US-10 AC-7 | PASS | M/MA/Q: explicit preparation action, one pending action/duplicate guard; no implicit bundle/retry AI |
| US-10 AC-8 | PASS under overrides | Q/U/M/MA: ordinary source updates preserve export; stale allowed, optional client precondition/internal CAS; 412 reload without merge/retry |
| US-10 AC-9 | PASS automated | Q/U renderer plus source layout: 1..8 single, 9..20 compact, ceil(n/2) split gives9=5/4, max10 per column; real rendering boundary cases |
| US-10 AC-10 | PASS automated | Q/U: quantities/names retained, overflow rejects rather than silently slices; mobile selection validation M/MA |
| US-10 AC-11 | PASS under overrides | Q/U/S/M/MA: max20 own effective recipe IDs, explicit selection, foreign/deleted/duplicate rejection; obsolete Preparation ingredient-resolution requirement not reintroduced |
| US-10 AC-12 | PASS | Q/U: seasoning filtered from ingredient card, permitted in step text |
| US-10 AC-13 | PASS automated | Q/U: large 1..4-step rendering, production font probes and PNG dimensions |
| US-10 AC-14 | PASS automated | Q/U: compact 5-step rendering, 90-character boundary and fit measurements |
| US-10 AC-15 | PARTIAL | F controlled422 demonstrates safe block for >5 source steps; R/G selective rice succeeds. Mandatory v21 rice-success gate still fails F; not an unsafe accepted sixth step |
| US-10 AC-16 | FAIL | R Import omits finish-cooking action/duration6min (CS-02); R oven correction changes cheese action (CS-03). F FIRST order wrong and blocked (CS-01). Source/time/turning-point semantics reviewed, not exact sentence matching |
| US-10 AC-17 | PARTIAL | Q/S/U/C: character/actual layout limits and structural validation pass; valid fit does not detect CS-02/03 semantic loss |
| US-10 AC-18 | PASS automated | Q/U: actual PNG metadata1080x1350, both renderer contracts; no device/gallery certification claimed |
| US-10 AC-19 | PASS | Q/M/MA: field-specific errors, strict invalid inputs, no truncation; controlled422 on exhaustion |
| US-10 AC-20 | PASS under overrides | Q/M/MA: atomic pair from current server recipe plus selected stored/stale or request-only draft, shared canonical metadata; transient render permitted before Save |
| US-10 AC-21 | PASS automated | M/MA: two distinct valid URIs, side-by-side preview, disabled incomplete/failed/pending pair |
| US-10 AC-22 | PASS mocked; device UNVERIFIED | MA/M: two PNGs in FitTrack and exactly one Android Share.open({urls:[uri1,uri2]}), no second-dialog fallback |
| US-10 AC-23 | PASS mocked; device UNVERIFIED | MA/M: cancellation, permissions/canAskAgain, album rollback, pair retry/cleanup, no partial-success state |
| US-10 AC-24 | PASS automated; smoke UNVERIFIED | MA/M/Q/U: legacy bundle omission, crop/tag/highlight ordering, gallery/save/share regressions; no actual Android smoke performed |
| US-10 AC-25 | PARTIAL | Q/U/C: strict outputs, review, quota before provider, success-only usage and no writes. F safe failure, but accepted R content loses actions CS-02/03 |
| US-10 AC-26 | PASS source/unit; Cosmos UNVERIFIED | Q/U/S: legacy read compatibility; existing container model unchanged, no new container required; emulator-backed legacy/CAS roundtrip not run |
| US-10 AC-27 | PARTIAL | Q/U/S/M/MA extensive automated limits/source/canonical metadata/race/pair/negative coverage; F/R semantic gates fail; real Cosmos/device limitations explicit |
| US-10 AC-28 | PARTIAL | CS-04 current-contract KB drift; correct current stale/share-draft rules verified in source, not falsely treated as stale-block bugs |
| US-10 AC-29 | PASS automated; visual review UNVERIFIED | Renderer source motif condition9..14, no motif15..20; Q/U actual8/9/14/15/20 rendering and fixed PNG regressions; no new human visual approval claimed |

Approved override criteria are separately covered; these identifiers do not duplicate the original 39:

| ID | Result | Evidence |
|---|---|---|
| STALE-AC-1 | PASS | M/MA ordinary canonical Create/Edit source unchanged |
| STALE-AC-2 | PASS | Q/M/MA stored stale export shares using current canonical recipe values |
| STALE-AC-3 | PASS | Q/M/MA missing-view controlled error, no bundle AI, atomic pair |
| STALE-AC-4 | PASS | Q/S/M V2 text-only, no ingredient matching/resolution |
| STALE-AC-5 | PASS | Q/U/M optional supplied If-Match checked; internal CAS, 412/reload; documented cross-device tradeoff preserved |
| STALE-AC-6 | PASS automated | Q/U/M/MA auth/owner and pair/negative regression suite |
| STALE-AC-7 | PASS interpretation | Historic ingredient-resolution FT037 scope not resurrected; no register rewrite or blanket historical closure |
| R2-AC-1 | PASS | M/MA unified options/text editor, no pre-confirmation barrier |
| R2-AC-2 | PASS | M/MA/Q title/detail controls and server facts, single time field; difficulty omitted on detail image |
| R2-AC-3 | PASS automated | M/MA/Q paired side-by-side preview and atomic post-Save rerender,1080x1350 |
| R2-AC-4 | PASS | Q/M/MA request draft render before PUT, no writes, draft precedence |
| R2-AC-5 | PASS | Q/M/MA omitted-draft legacy compatibility and atomic render failures |
| R2-AC-6 | PASS | M/MA provider-only AI spinner, reuse/render states and duplicate action guard |
| R2-AC-7 | PASS | Q/S/M/MA nullable preview, no defaults; valid nonnull Save metadata and field/overflow errors |
| R2-AC-8 | PASS automated | Q/U/M/MA explicit confirmation pair only, save-then-render, unchanged/presentation-only no rewrite, failed PUT no render |
| R2-AC-9 | PASS automated | M/MA transient image sharing without text persistence; pending/missing/duplicate/stale pair disablement |
| R2-AC-10 | PASS | Q/U strict ownership and recipe ID validation before image/download/render, no injected recipeMeta/fingerprint |
| R2-AC-11 | PASS safety; required cooking success fails elsewhere | Q/M/MA preparation quota; bundle/retry no quota/AI; bounded missing recovery, failure no writes/render. CS-01 belongs to required v21 success, not quota safety |
| R2-AC-12 | PASS | Q/U/M/MA optional ETag, stale allowed, 412 reload/no auto merge/retry |
| R2-AC-13 | PASS mocked; device UNVERIFIED | MA/M/Q tags/highlight/crop ordering, rollback/retry, one Android native pair |
| R2-AC-14 | PARTIAL | KB review: current stale/share-draft contracts mostly present, remaining shared-library ETag and prompt version drift CS-04 |

## Commands And Current Counts

All commands ran through the new durable helper unless noted. `vitest` below is the repository-local Vitest executable, not a downloaded package. Test commands add default/JSON reporters and a co-located output file; exact native argv are in their stage JSON records. Cwd is shown explicitly. Counts are current, not copied from Q21.

| Stage / command | Native exit | Current result |
|---|---:|---|
| `node --check docs/qa/reports/CURRENT-RECIPE-SHARING-2026-10-10-verification.mjs` (initial QA helper and first list repair) | 0 / 0 | Two observed syntax checks, no provider calls; later helper edits directly executable-validated |
| `node <QA-helper> baseline` | 0 | 1163 preserved files,548 candidate files, runtime prompts/versions captured |
| backend: `vitest run <16 focused files> --silent` | 0 | Q733 passed,0 failed,0 skipped |
| root: `npm run test --workspace=backend -- --silent` | 0 | U1641 passed,0 failed,0 skipped |
| shared: `vitest run --silent` | 0 | S450 passed,0 failed,0 skipped |
| mobile: `vitest run src/modules/recipes src/shared/api/recipeApi.test.ts src/services/recipeShareMediaService.test.ts --silent` | 0 | M261 passed,0 failed,0 skipped |
| root: `npm run typecheck --workspace=backend` | 0 | Backend typecheck |
| root: `npm run typecheck --workspace=shared` | 0 | Shared typecheck |
| root: `npm run typecheck --workspace=mobile` | 0 | Mobile typecheck |
| root: `npm run build:verify --workspace=backend` | 0 | Built output verifies no bad shared imports |
| root: `npm run verify:daily-insight-prompt --workspace=backend` | 0 | Current Daily release prompt/manifest verification |
| root: `node scripts/check-encoding.mjs` | 0 | Repository encoding check |
| backend: `vitest run --config vitest.eval.config.mts <recipe,daily eval files> --testNamePattern "prompt version matches fixture expectations" --silent` | 0 | 3 guards passed,35 intentionally excluded; not live acceptance |
| backend: original credential-cleared `vitest list` Preparation / Recipe / Overall | 0 / 0 / 0 | Only1/2/22 selections: INVALID complete selections, zero provider calls, preserved evidence, not used to authorize gates |
| backend: corrected credential-present `vitest list` Preparation / Recipe / Overall | 0 / 0 / 0 | Exact11/20/48 selections, zero calls; list does not execute eval tests |
| F root: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"` | 1 | 10 passed,1 failed of11 intended; total20 includes9 intentional Import exclusions |
| R root: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts` | 1 | 19/20 passed,1 failed,0 skipped |
| G root: `npm run test:eval --workspace=backend --` | 0 | 48/48 passed,0 skipped: Recipe20,Daily18,Scale3,Weekly4,Weekly diagnostic3 |
| `node <QA-helper> reconcile` | 0 | Current requests/prompts/context/schema equality, full source/output/probe matrix; zero calls |
| mobile: `vitest run --silent` | 0 | MA640/640 passed,0 skipped; full mobile suite including native candidate |
| `node <QA-helper> emulator` | 0 (probe wrapper) | Loopback fetch ECONNREFUSED, UNVERIFIED;0 contracts run, no server started |
| `node <QA-helper> selectionNames` first execution | 1 | QA helper collision for same-named guards in two G files; no artifact or provider call, no product failure |
| `node <QA-helper> selectionNames` after file+name repair | 0 | N verifies every intended name11/20/48 executed; zero calls |
| Editor diagnostics on QA helper | N/A | No diagnostics reported |
| `node <QA-helper> finish` first verification | 1 | QA report had a forward link to the not-yet-emitted finish record; link removed, no product failure or provider call |
| `node <QA-helper> finish` | See finish record | Report format,39 unique primary/story criteria, finding fields, links, UTF-8, configured endpoint/key absence, preserved files and final candidate stability |

First incomplete lists were a QA harness configuration error, repaired before the first live gate. There was exactly ONE fresh F, ONE fresh R and ONE fresh G; none was rerun. The independent reconciliation/name check makes no AI calls. The naming repair is not an implementation correction loop.

UTC intervals: F `10:26:28.972Z..10:26:53.756Z`; R `10:27:04.027Z..10:28:33.577Z`; G `10:28:43.125Z..10:30:59.897Z`, all 2026-10-10. Hashes stable before/after every execution. Full Mobile was additional offline verification after those immutable gates.

## Provider And Cooking Evidence

### Provider Protection

B captures actual resolved current initial/full-draft/text-only/Import runtime system prompts and hashes, not historical prompt assumptions. C checks EVERY instrumented saved-Preparation SDK request against the exact captured current prompt, schema closure/strictness, actual configured model, temperature0.2, max_tokens2048, maxRetries0, <=20000ms positive timeout, signal and stop finish reason. Actual configured deployment is `gpt-4o-mini`; source API configuration is `2024-08-01-preview`. Initial/full/text routing all occurred. Full-draft corrections use unchanged original context plus latest draft/diagnostics; text-only sends exactly measured target strings/bounds and merges only those strings. Text-only structural immutability is not a semantic guarantee, as CS-03 demonstrates.

The 75000ms aggregate monotonic deadline, technical/validation separation, max2 corrections/3 logical calls, terminal errors and booking after valid probe are additionally verified by Q/U. All twelve handler fixtures retain saved source/ETag and have update/replace/create writes0. The forced dough initial draft is synthetic by design, not a real initial SDK response; its corrections are real SDK calls. Actual handler counts:

| Gate | Fixture | Real SDK / logical calls | HTTP / usage | Final measured fit | Reached assertion state |
|---|---|---|---|---|---|
| F | rice | 3 / 3 | 422 / 0 | true | Protection/metadata/semantic assertions NOT_REACHED after structural failure |
| F | oven | 2 / 2 | 200 / 1 | true | Protection+metadata pass; content MANUAL VALIDATION REQUIRED |
| F | pasta | 1 / 1 | 200 / 1 | true | Protection+metadata+semantic pass |
| F | forced dough | 2 / 3 | 200 / 1 | true | Protection+metadata+semantic pass |
| R | rice | 1 / 1 | 200 / 1 | true | Protection+metadata+semantic pass |
| R | oven | 2 / 2 | 200 / 1 | true | Protection+metadata pass; content manual branch, CS-03 independently observed |
| R | pasta | 1 / 1 | 200 / 1 | true | Protection+metadata+semantic pass |
| R | forced dough | 2 / 3 | 200 / 1 | true | Protection+metadata+semantic pass |
| G | rice | 1 / 1 | 200 / 1 | true | Protection+metadata+semantic pass |
| G | oven | 1 / 1 | 200 / 1 | true | Protection+metadata pass; content MANUAL VALIDATION REQUIRED |
| G | pasta | 1 / 1 | 200 / 1 | true | Protection+metadata+semantic pass |
| G | forced dough | 2 / 3 | 200 / 1 | true | Protection+metadata+semantic pass |

Instrumented saved-source handlers total19 actual SDK calls/22 logical calls (F8/9,R6/7,G5/6). This is NOT the total provider-call count for all evals. Six direct provenance tests per gate, Import, Daily and other suites do not expose equivalent complete raw SDK request instrumentation. Their real executed assertions/status are recorded; their aggregate SDK-call counts and unlogged raw Daily responses remain UNVERIFIED, not invented. Existing Import one-call/current strict-schema caller behavior is source/unit verified; live source/export content is recorded in R/G, not misrepresented as a complete Import raw SDK dump.

### Provenance And Core

All six current direct total-time provenance cases pass independently in F/R/G:18 fresh passed assertions. Saved rice/oven/pasta component-time-only sources expect null; explicit source total with untimed preparation expects50; fully timed explicitly sequential5+10 expects15; two component times without explicit sequence expect null. Null is not failure. Summing numbered steps, component durations or the word 'separat' is not proof of total sequence. All eleven successful handler cases assert null metadata; F rice raw null is observed but its metadata assertion is NOT_REACHED.

Rice source is complete eight steps: dice/season, heat oil, fry4min per side, separately cook/drain rice12min, reduce heat/finish chicken6min, rest3min, serve. F final groups are `[1,2],[3],[4],[6,7],[5]`, FIRST sequence1,3,4,6,5. Rice moves after finishing chicken despite source order. Final text still mentions chicken6min/rest3min and rice12min; this is principally the reference/order-required-success failure, not a claim that separate rice action disappeared. Both FIRST diagnostics are at steps[3]/steps[4]. `CORRECTIONS_EXHAUSTED` after3 calls gives422/usage0/no writes. Renderer fits but validation blocks. R/G Preparation groups `[1,2],[3,4],[5],[6,7],[8]` succeed with essential core; no exactly-five wording rule is inferred.

Current R Import failure is a DIFFERENT chicken-with-potatoes/beans fixture, not the saved rice fixture. Source has eight steps; source6: "Reduziere die Hitze und gare das Hähnchen weitere 6 Minuten fertig." Its export refers only to1,2,3,5,8: cook potatoes18min; beans8min; season chicken; fry chicken4min per side; slice/serve. No other export string contains reduce-heat/finish-cooking6min. R fails "Missing export reference 6: finish cooking chicken after frying". Full source extraction passed before the export assertion. This is substantive action/duration loss, not merely a missing ID or a literal-wording disagreement. G's independent Import pass does not undo R.

Oven source: slice potatoes, grease form, layer/pour cream, sprinkle cheese, preheat180C, bake180C40min until potatoes cooked, rest/serve. All current final groups are `[1,2],[3,4],[5,6],[7]`; final baking text in F/R/G is "Heize den Ofen auf 180°C vor und backe den Auflauf 40 Minuten." All totals null;180C/40min retained. R initial correct string: "Schichte die Kartoffeln in die Form, gieße Sahne darüber und streue Käse darüber." Its measured overflow triggers text-only correction of `steps[1].description`; final string: "Kartoffeln in die Form schichten, Sahne und Käse darüber gießen." Cheese is now poured, not sprinkled. This source-backed action substitution is CS-03; references/time/counts remain structurally valid, final probe fits, handler200/usage1. F/G use separately correct pouring/sprinkling descriptions.

The missing source oven doneness clause is separately a DISPUTED INTERPRETATION / PRODUCT CLARIFICATION. This report does not make the literal phrase "bis es gar ist" an independently conclusive blocking requirement, does not invent a waiver, and does not count unperformed oven content approval as an automated pass. Human source-vs-output review remains required. CS-03 concerns an actually substituted ingredient action, not that contested clause.

Pasta preserves onion preparation/frying, source-backed sauce15min, separately cooked pasta10min/draining and combining; component durations are not swapped or synthesized into total time. F/R/G semantic assertions complete. Dough's forced overflow corrections retain the complete referenced mixing ingredient set (order equivalence allowed), form/bake180C20min/cool and null metadata. C stores all exact source/final strings, source/core matrices, attempts and probes; no ingredient/padding reconstruction or exact-five preference is introduced.

## Current Actionable Findings

Finding key: CS-01-current-preparation-rice-first-order
Plan reference: approved v21 plan linked in Scope
Acceptance criterion: AC-4, AC-5, AC-9; US-10 AC-15/16
Description: Fresh F's current v12 required rice handler exhausts all three calls with FIRST sequence1,3,4,6,5 and returns422. The validator correctly prevents an invalid suggestion, but the specifically required successful fixture has not passed all mandated fresh gates. R/G success does not replace F evidence.
Criticality: Blocking
Owner: Backend
Evidence: F/C, rice fixture, final groups above, two export_source_trace_not_ascending diagnostics, native F exit1, usage0/writes0.
Recommendation: Backend should address bounded successful source-order preservation and retain current protection. Further correction/review needs separately authorized work; do not rerun gates until randomly green.

Finding key: CS-02-current-import-finish-cooking-loss
Plan reference: approved v21 plan and original US-10 under current overrides
Acceptance criterion: AC-1, AC-8, AC-9; US-10 AC-3/16/25
Description: Fresh R's current Import v16 export skips chicken finishing action/source6 and its additional6min. Its final five descriptions contain only fry4min per side before slicing/serving. Original eight-step extraction is retained, so this is export-core loss rather than source extraction or ID-only disagreement.
Criticality: Blocking
Owner: Backend
Evidence: R/C side-dish-and-serving-actions full source/export, missing-reference6 assertion; R19/20, native exit1. Complete current source and output are linked above.
Recommendation: Return current Import source-core preservation to Backend; retain the source-faithful semantic assertion and strict Import reference policy, do not patch eval expectations in QA.

Finding key: CS-03-current-oven-text-correction-action-substitution
Plan reference: approved v21 plan linked in Scope
Acceptance criterion: AC-2, AC-6, AC-8; US-10 AC-16/17/25
Description: R's real v12 text-only overflow correction changes correct 'pour cream and sprinkle cheese' into 'pour cream and cheese'. The server accepts the fit result200 and books usage1. It preserves reference groups and layout, but changes the retained cheese preparation action. This independent source/output observation is not an automated oven semantic failure and is separate from the disputed doneness wording.
Criticality: Blocking
Owner: Backend
Evidence: R/C oven complete original context, initial SDK output, sole steps[1].description overflow diagnostic, strict recipe_text_correction request, raw corrected string and final200; source4 explicitly sprinkles cheese. F/G use correct separate actions.
Recommendation: Backend should preserve component-action relations through shortening, with a separately authorized regression/review. Human oven review still required; do not broaden this to a literal endpoint-clause requirement.

Finding key: CS-04-current-kb-contract-drift
Plan reference: approved v21 plan and R2 share-editor override
Acceptance criterion: AC-10; US-10 AC-28; R2-AC-14
Description: Current-contract KB prose still describes Preparation v11 despite saved code/guards v12; shared-library prose still requires Preparation/confirmation If-Match and response sourceEtag comparison despite approved optional-ETag and current mobile behavior. Explicitly historical v11 sections are not included in this finding.
Criticality: Non-blocking
Owner: Documentation
Evidence: [../../kb/domain/07-ai-features.md](../../kb/domain/07-ai-features.md#L106), current Preparation sections171/203/240/246/254; [../../kb/tech/02-backend.md](../../kb/tech/02-backend.md#L277); [../../kb/tech/09-api-reference.md](../../kb/tech/09-api-reference.md#L404); [../../kb/tech/08-testing.md](../../kb/tech/08-testing.md#L133); [../../kb/tech/04-shared-library.md](../../kb/tech/04-shared-library.md#L109). B versions and current API/mobile behavior checked independently; stale historical narratives are not silently promoted to current rules.
Recommendation: Documentation owner should align only current-contract versions and optional ETag/sourceEtag prose with the saved candidate and approved overrides, preserving history. QA made no KB changes.

## Historical Register Recommendations

Read-only register: [../findings.md](../findings.md). These are recommendations for the Orchestrator, not status changes, user acceptance or blanket closure. No other historical finding is implicitly closed.

| Historical key | Current evidence | Recommendation |
|---|---|---|
| FT-QA-2026-086 | F/R/G retain180C/40min; all omit explicit doneness clause, but automation intentionally stops at manual content branch. User disputes mandatory literal clause. CS-03 is a distinct current substitution | No automatic acceptance or closure; move disputed clause to explicit product/human clarification, not a new literal-phrase blocker. Separate CS-03 |
| FT-QA-2026-087 | All18 direct provenance cases pass;11 successful handler metadata checks pass; F rice metadata NOT_REACHED | Recommend scoped closure of current reproduced total-time-provenance defect on new evidence, not universal semantic certification |
| FT-QA-2026-088 | Fresh G overall48/48 and Daily18/18, including stale-weight case; no current Daily fail | Recommend closure/non-recurrence scoped to this fresh current Daily evidence; do not import historical red into current result |
| FT-QA-2026-089 | Prior v11 alignment closure is historical; current v12/current-ETag drift exists CS-04 | Reevaluate documentation alignment for current candidate; no assertion that all current KB is aligned |
| FT-QA-2026-090 | Current F saved rice FIRST exhaustion422 reproduces required-success/order aspect; R/G Preparation rice succeeds; separate R Import failure CS-02 | Do not close required rice-success/order finding; refine to current observed CS-01, do not repeat unsupported claims of accepted rice-action loss |
| FT-QA-2026-091 | Current unknown-activity Daily case passes in G18/18 | Recommend scoped closure/non-recurrence on current evidence; no raw Daily output claim |
| FT-QA-2026-092 | Current phase-progress-open-day Daily case passes in G18/18 | Recommend scoped closure/non-recurrence on current evidence; no retry-until-green or historical rewrite |

## Verification Notes And Manual Checklist

These are not findings or verdict penalties. Missing environment/human checks are not classified Blocking/Non-blocking/Suggestion. The plan's release prerequisites remain unsatisfied where a manual action is outstanding, independently of the actual blockers above. No deployment was authorized.

| State / check | Prerequisites | Steps | Expected result | Actual result |
|---|---|---|---|---|
| MANUAL VALIDATION REQUIRED: oven semantics | Human reviewer/product owner, complete current F/R/G oven sources and outputs in C | Compare source7 steps with each compact output; assess baking endpoint equivalence without exact wording; review R's changed cheese action; record decision separately | Understandable source-backed cooking,180C/40min retained, no changed component actions; explicit product decision on disputed endpoint requirement | NOT PERFORMED. Current180C/40min and clause omission observed; CS-03 independently observed. No human pass or fabricated waiver |
| UNVERIFIED: actual Android two-image share/gallery | Android emulator/device and installed candidate build; permissions/receiving apps; no build/start authorized here | Save/share both actual1080x1350 PNGs; inspect FitTrack album; receive both in one dialog; cancel/retry/deny/permanently deny; test rollback/cleanup and crop/highlight/tags | Both distinct files, one native dialog, correct pair/no partial success, reusable retry assets and proper cleanup | Only M/MA mocks passed. Device/adb readiness not certified; no EAS/dev server or emulator started |
| UNVERIFIED: real Cosmos legacy/CAS contracts | Local emulator reachable at127.0.0.1:18081, isolated test databases; never Azure Cosmos | Run existing repository recipe contract suite with explicit loopback override and cleanup | Legacy documents read, confirmation roundtrip, CAS race admits only one write, other412, no unrelated loss | Probe ECONNREFUSED. Contracts not run; unit SDK/in-memory cases passed. Evidence [CURRENT-RECIPE-SHARING-2026-10-10-emulator.json](CURRENT-RECIPE-SHARING-2026-10-10-emulator.json) |
| UNVERIFIED: Alpha/private revision visual replay and transport budget | Separately authorized private revision/device access and deployed environment | Replay exact approved private recipe/media; inspect pixels/legibility and measure transport under real mobile conditions | Correct pair, readable uncropped content and acceptable transport size | Synthetic saved sources, bundled real-font PNG rendering and automated layout checks only; no Alpha/deployment assertion |
| UNVERIFIED: complete all-domain raw SDK counts/outputs | Existing or separately authorized safe instrumentation; no eval edits by QA | Capture equivalent evidence for direct provenance, Import/Daily/other suites without secrets or weakened assertions | Accurate domain-specific caller/payload/count audit |19 actual instrumented handler SDK calls documented; other domains' executed assertions known, equivalent raw logs not available. No fabricated aggregate count |

## Preservation And Completion

The new report did not previously exist; no older report was replaced. Candidate/preserved manifests include tracked and preexisting untracked files within the documented boundaries. Build-generated ignored output is a check artifact, not an implementation edit. No unrelated preexisting changes were reverted. QA-added files use the exact required evidence prefix, except this exact required report path. Historical reports, evals, KB, plans/stories and register remain untouched.

Final finish validation checks the report's single overall verdict, all39 unique primary/story rows, structured fields, local links, fatal UTF-8 decoding and absence of the configured Azure OpenAI endpoint/key in all new QA artifacts, and records final candidate/preservation mutations/new foreign files. Report hash and final preservation flags are in the finish record. Any mutation must supersede a stability claim; no stable historical hash is substituted for this candidate.

Current remaining actionable items are CS-01, CS-02, CS-03 and CS-04. Current Daily and provenance regressions are green. Native/Cosmos/human/Alpha limitations and the disputed oven endpoint are explicitly separate. No feature acceptance or release approval follows from G alone.
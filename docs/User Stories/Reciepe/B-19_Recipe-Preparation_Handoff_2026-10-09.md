# B-19 Backend Handoff

Date: 2026-10-09. Approved task package v19 only; full plan not read.
Backend status: implementation delivered in the existing dirty worktree; required live gates FAIL. Not feature completion, QA acceptance, merge or release approval. Candidate frozen at preparation v4 / import v16. No retry, v5, second candidate, import repair or Daily repair.

## Implementation And Boundaries

| Changed file | Symbols / purpose |
|---|---|
| backend/src/lib/openai.ts | `prepareRecipeExport`, backend-only `RecipeExportPreparationOutput`, strict `recipe_export_preparation` schema; same lazy client/deployment/API version, temperature0.2, max_tokens2048, one SDK call. `analyzeRecipeText(text)` now import-only; optional Preparation branch removed. |
| backend/src/lib/prompts/recipeAnalyze.ts | Preparation v4: trusted compact-detail-image target, complete understandable cooking workflow, full input read, action grouping instead of selecting five original steps, Shared limits interpolated, untrusted data boundary, source-only claims/metadata. Import v16 body unchanged. |
| backend/src/lib/recipeAnalyzeValidation.ts | Strict small-output schema plus separate saved source; source-positive/unique/ascending, export1..K, nonempty known locally ascending globally unique references, groups ascending by FIRST reference. Existing import-global-monotone policy unchanged. Safe phase/code/path diagnostics, no repair or mutation. |
| backend/src/functions/recipes.ts | Existing ID-free full context projection retained; only `prepareRecipeExport(context)`; validation against separate `recipe.steps`; empty cooking basis422 before quota/provider; same V2 response/sourceEtag and internal-only references. |
| backend/src/lib/recipeAnalyzeValidation.test.ts | Test-first compact/grouping/boundary regression, three saved-source core/contradiction rubrics, FT072 and full import-source coverage retained. Legacy import-shaped test inputs use a test-only small-output adapter, not a production wrapper. |
| backend/src/functions/recipes.test.ts | Small provider fixtures, actual separate saved-source arguments, unchanged source/input/no-write checks, full8 ingredients/steps context, empty basis, auth/owner/ETag/quota/status/logging retained. |
| backend/src/functions/ai.test.ts | Dedicated small SDK contract/parameters/context tests; import guards and normalization tests retained. |
| backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts | Original eight import fixtures and original saved8-step fixture unchanged. Two synthetic source/rubric definitions added BEFORE production implementation. Shared test-only semantic helper accepts small output plus actual saved source, source-backed time/temperature checks. |
| backend/src/lib/prompts/recipeAnalyze.eval.test.ts | v16/v4 guards; all3 Preparation cases use actual handler, SDK raw small output and saved source. Removed model-source/ingredient/full-recipe roundtrip assertions. |

Exact provider output: `{version:1,teaser:string,totalTimeMinutes:number|null,difficulty:string|null,steps:Array<{order:number,description:string,sourceStepOrders:number[]}>}`. No name/portions/tags/ingredients/source-step/key output; additionalProperties:false at every object. Shared min1/max5/text90/teaser96/time10080 constants; server checks all limits. `[1,4,6],[5]` valid only for Preparation; `[5],[1,4,6]` invalid; gaps valid. No sorting, ID padding, truncation, fallback, renderer payload or extra call.

Auth, owner-scoped lookup and optional ETag remain before quota; quota key `recipe-analyze`, usage exactly once only after valid success. Existing429/502/422 and plain V2 response preserved. Saved ingredients/IDs, recipe persistence, Save/Share, fingerprint, Shared/Mobile/Infra/API/SDK/dependencies unchanged. No KB/QA/registry/deploy edits. D-19 owns KB updates; existing KB still describes v3/full-output/global-monotone Preparation and consequently diverges from this implementation.

## Test-First And Offline Evidence

Genuine chronology: start snapshot -> compact tests -> required first focus RED -> synthetic sources/rubrics defined -> production contract/prompt/policy/handler -> compact GREEN -> local test migrations -> final offline gates -> frozen F/R/G once. No reconstructed or invented live Red. Historical semantic FAIL baseline is the unchanged [v18 QA follow-up](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Nachpruefung.md): v16/v3 loses Preparation finish-cooking; FT072 correction retained; FT076 import failure remains outside scope. That baseline was not rerun.

| Command / checkpoint | Exit | Executed / Pass / Fail / Skip |
|---|---:|---|
| From backend: `npx vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts --reporter=json --outputFile=<snapshot>/red.json --silent` | 1 | 351 / 348 / 3 / 0; new compact positive and min1/max5 positive cases reject old full contract. |
| `npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts --testNamePattern 'B-19 compact Preparation contract' --reporter=json --outputFile=<snapshot>/compact-green.json --silent` | 0 | 24 / 24 / 0 / 112 selection skips. |
| Validator + SDK migration check | 0 | 217 / 217 / 0 / 0. |
| Handler intermediate migration -> same-slice repair | 1 -> 0 | 103 / 98 / 5 / 0 -> 103 / 103 / 0 / 0; obsolete saved-source assertions corrected, no runtime workaround. |
| Required four-file focus, same command with `focus-green.json` | 0 | 356 / 356 / 0 / 0. Production-font renderer34 passes, including1..5 texts,90 chars and PNG1080x1350; renderer implementation/file untouched by B-19. |
| Final validator/rubric suite | 0 | 140 / 140 / 0 / 0; includes subsequently added positive single-group pasta case, no exact5/golden/group-boundary requirement. |
| `npm run test --workspace=backend -- --reporter=json --outputFile=<snapshot>/full-unit-final.json --silent` | 0 | 1437 / 1437 / 0 / 0; prior full checkpoint1436 also passed. |
| `npm run typecheck --workspace=backend` | 0 | Compile gate; no test counts. |
| `npm run build:verify --workspace=backend` | 0 | Compile,10 production assets,module resolution,duplicate Function IDs pass; no deployment. |
| Offline eval config with `--testNamePattern 'prompt version matches fixture expectations'` | 0 | 2 / 2 / 0 / 11 intentional selection skips; no live call. |
| `node scripts/check-encoding.mjs`; `git diff --check` | 0 / 0 | Encoding/whitespace gates pass; CRLF/LF warnings are not errors. |

Compact and synthetic checks include blank/91/97/0/6/bad metadata/unknown fields/references, source duplicate/reversal, export numbering, no mutation, missing core, wrong components, swaps and invented times/temperatures. FT072 positive finish-cooking-plus-serving and eight negatives retained. Ofen core: potato cutting/assembly/actual source-backed baking from7 source steps; optional greasing/preheat/rest/serve. Pasta core: onion prep/frying, essential simmered tomato sauce, independent pasta cooking; optional heating/salting/draining/garnish. Original saved8 core refs1/4/5/6 unchanged; optional rest/serving/details allowed.

## Frozen Live Gates

Executed sequentially once each through the existing official runner. Direct argument arrays prevent PowerShell pipe/regex forwarding problems. F/R use `node backend/scripts/run-eval.mjs`; G is the actual existing `npm run test:eval --workspace=backend`, via existing node/npm CLI. JSON/default reporters are evidence-only arguments. Existing runner loads credentials privately. No missing credentials, exit2, all-skipped or abort here; all3 Preparation cases executed per gate. F's9 skips are intentional selection, not all-skipped PASS.

| Gate / command | Exit | Executed / Pass / Fail / Skip | Preparation |
|---|---:|---|---|
| F: runner + Recipe eval file + `--testNamePattern 'preparation prompt version matches fixture expectations|recipePreparation'` | 1 | 4 / 2 / 2 / 9 | All3 executed: riceFAIL,ovenFAIL,pastaPASS; preparationguardPASS. |
| R: runner + complete Recipe eval file | 1 | 13 / 10 / 3 / 0 | Same Preparation results;7/8 importsPASS; `no-lost-or-invented-ingredients` import trace[4,3]FAIL; both guardsPASS. |
| G: `npm run test:eval --workspace=backend -- --reporter=default --reporter=json --outputFile=<G-report>` | 1 | 41 / 35 / 6 / 0 | Same Preparation results;8/8 importsPASS; four unrelated Daily failures. |

F UTC12:54:13.700..12:54:23.636; R12:54:23.644..12:55:46.474; G12:55:46.477..12:58:07.494. Each fixture uses SDK1/Preparation1,0.2/2048,finish_reason:stop. No claim about cause or general reliability follows.

Concrete blocking findings, identically reproduced in F/R/G:

1. Saved8 recipe: groups `[1,2],[3,4],[6],[5],[8]`; core cutting/frying/rice/finish-cooking appears in text and refs, but group starts6 then5 violate the approved first-reference policy. Actual422,usage0,writes0,unchanged=true; `semantic:export_source_trace_not_ascending@steps`. Not an allowed `[1,4,6],[5]` grouping; no automatic repair.
2. Oven: `[1,2,3],[3,4],[5,6],[7]`; duplicate3 splits saved assembly across two groups. Actual422,usage0,writes0,unchanged=true; `semantic:duplicate_export_source_reference@steps`. Numeric baking180C/40min is source-backed, but duplicate-source output remains invalid.
3. Pasta: `[1,2,3],[4],[5,6],[7]`; actual200,usage1,writes0,unchanged=true. Core/swap/temperature/time checks and V2-body/quota-order/usage-order/no-private-ID/no-write assertions execute and pass in all three gates. G omits the optional numeric pasta time, legitimately.

Important assertion boundary: for rice/oven, request/quota-order/one-call/no-write/saved-source checks execute, then server-validation success assertion fails. Later V2-success-body/usage-order and final semantic assertions are NOT reached for these rejected outputs. usage0 is captured observation, not an executed later success assertion. Post-capture validation confirms both diagnostics, but does not retroactively execute live assertions. Therefore the requested complete success-path proof for all3 cases remains unmet, not PASS. Metadata source derivation (observed25/50/35 minutes and `einfach`) is not independently proven by structural/core assertions; no general semantic validator is claimed.

Outside scope: R's import reversal[4,3]; G Daily `phase-progress-open-day`, `protein-nearly-complete`, `midday-empty-day-not-morning`, `stale-weight`. No Import/Daily repair or historical finding closure. No overallPASS.

## Manifest And Evidence

Exact workspace handoff: `c:\Users\mmueller\OneDrive - PRODYNA SE\fittrack-app\docs\User Stories\Reciepe\B-19_Recipe-Preparation_Handoff_2026-10-09.md`.

- [Manifest](B-19_Recipe-Preparation_Manifest_2026-10-09.json): nonempty exact paths,status,tests,deviations.
- [Own diff](B-19_Recipe-Preparation_EigenerDiff_2026-10-09.patch): ONLY9 implementation/test files against captured pre-B-19 dirty worktree, not cumulative HEAD. Hashes identify before/after; existing edits never reverted.
- [Offline evidence](B-19_Recipe-Preparation_OfflineEvidence_2026-10-09.json): original Red/Green counts/failures, start/end hashes, six exact import/source/normalization invariants,764/764 protected tracked files unchanged; independently rechecked after Live. Existing untracked history was not start-hashed, and was not edited.
- [Live evidence](B-19_Recipe-Preparation_LiveEvidence_2026-10-09.json): exact argv,underlying exits/counts,nine full actual small SDK outputs with actual saved sources,source/core matrices,observations,executed protection markers. `reconciledRecords` recovers ANSI-prefixed transcript records; `postCaptureValidation` is explicitly post-run only. Candidate hashes unchanged after Live.
- [F transcript](B-19_Recipe-Preparation_Live-F-Output_2026-10-09.txt), [R transcript](B-19_Recipe-Preparation_Live-R-Output_2026-10-09.txt), [G transcript](B-19_Recipe-Preparation_Live-G-Output_2026-10-09.txt): complete synthetic outputs and failure evidence, not private recipes.
- [F report](B-19_Recipe-Preparation_Live-F-Report_2026-10-09.json), [R report](B-19_Recipe-Preparation_Live-R-Report_2026-10-09.json), [G report](B-19_Recipe-Preparation_Live-G-Report_2026-10-09.json): all executed/skipped assertion results.
- [Evidence helper](B-19_Recipe-Preparation_Verification_2026-10-09.mjs): task-local capture/evidence utility; no new framework/dependency; refuses a second live run.

Execution deviations: initial protected-path hash command failed on Git-quoted Unicode filename before any code edit; corrected with core.quotepath=false. One SDK/handler migration probe failed because mock name was not yet migrated; full intermediate5FAIL then local repair is recorded. `npm exec ... node` proposed installing node26; rejected with `n`, exit1 before helper/test/SDK start. Existing Node/npm CLI used instead; no installation. ANSI-prefixed records initially absent from JSON index were recovered from unchanged original transcripts without any provider call. Evidence helper exit0 means capture completed, NOT that its underlying exit1 gates passed.

STOP FOR DECISION: live quality gates remain blocked. Further provider/prompt/fixture-policy decisions require a new authorized package. No v5, no rerun-until-green, no contract loosening, no second SDK call, no deployment. D-19 and independent QA are separate packages; their work is not done here.
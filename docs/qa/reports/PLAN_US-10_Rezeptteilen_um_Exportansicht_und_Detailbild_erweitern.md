# QA Report: US-10 Recipe Export View and Detail Image

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md](../../User%20Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md)
- Verdict: `PASS`

## Scope
Targeted re-review for `FT-QA-2026-045` against user-approved revision `US-10-AC11-2026-09-30-R2`. The user approved this exact revision on 2026-10-01; the plan's pending-approval header is stale and was not changed. Review is limited to the AC-28 correction in [docs/kb/tech/04-shared-library.md](../../../docs/kb/tech/04-shared-library.md). I compared the revised description with [shared/types/recipes.ts](../../../shared/types/recipes.ts), [mobile/src/shared/api/recipeApi.ts](../../../mobile/src/shared/api/recipeApi.ts), [backend/src/functions/recipes.ts](../../../backend/src/functions/recipes.ts), and the server-side fingerprint helper in [backend/src/lib/repositories/recipeExport.ts](../../../backend/src/lib/repositories/recipeExport.ts). The stale `[Planned: US-10 Frontend subtasks]` marker is absent from the Shared Library page; the only remaining Markdown mentions are prior finding history in this report and the central register, which was not edited. AC-28 is re-evaluated below. AC-1 through AC-27 and AC-29, their prior Q-1 evidence, prior test results, and prior finding history are retained and were not re-reviewed for this targeted correction. No test suite was run for this documentation-only change. No implementation, plan, central findings register, or unrelated documentation was changed by this QA re-review. Cosmos persistence, Android device/U-1, native share-sheet acceptance, recipient handoff, real transport budgets, build, and deployment remain unverified from prior Q-1 and are outside this review.
### Historical prior-Q-1 scope

Q-1 re-review against user-approved revision `US-10-AC11-2026-09-30-R2`, Android-only scope, and all 29 acceptance criteria. The user explicitly approved the revision on 2026-10-01; that approval overrides the plan's stale pending-approval header, which was not edited. The review covers Backend, Shared, Mobile, renderer/share, API, Knowledge Base, and FT-QA-2026-037 through -044. The scoped Recipe Analyze v11 eval remains the US-10 prompt gate; unrelated aggregate Daily/Weekly evals are outside scope. Only this QA report was edited. No implementation, plan, findings-register, release-record, or render-artifact files were changed. Q-1 is automated/documentary: Cosmos persistence, Android device/U-1, native share-sheet acceptance, recipient handoff, real transport budgets, build, and deployment were not verified.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | The wizard provides editable teaser, time, difficulty, export steps, and food-ingredient selection in [RecipeWizardPreviewPhase.tsx](../../../mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx). |
| AC-2 | PASS | Confirmation is an explicit review action; edits invalidate confirmation, and only the confirmed path creates the request pair in [recipeWizardExportView.ts](../../../mobile/src/modules/recipes/recipeWizardExportView.ts). |
| AC-3 | PASS | Recipe Analyze v11 returns the export suggestion in its structured result; the scoped eval passed. See [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) and [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts). |
| AC-4 | PASS | Sharing uses the render-only bundle path and does not invoke AI. Handler and share-draft tests cover this in [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts) and [recipeShareDraftState.test.ts](../../../mobile/src/modules/recipes/recipeShareDraftState.test.ts). |
| AC-5 | PASS | Versioned handlers return ETags and preserve or replace the export snapshot as specified; handler and repository unit tests pass. Cosmos contract execution is recorded separately as `UNVERIFIED`. |
| AC-6 | PASS | Existing recipes get a local fallback draft with missing metadata left blank and no automatic analysis call. See [recipeWizardEditBootstrap.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.ts) and its tests. |
| AC-7 | PASS | Existing-recipe preparation is an explicit wizard action; the authenticated handler enforces `recipe-analyze` quota before AI and tracks only validated success. [recipes.test.ts](../../../backend/src/functions/recipes.test.ts) covers these paths. |
| AC-8 | PASS | Source fingerprints determine current/stale status; ordinary edits preserve the snapshot, confirmation uses ETag compare-and-replace, and the bundle rejects stale data. See [recipeExport.ts](../../../backend/src/lib/repositories/recipeExport.ts), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts), and [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts). |
| AC-9 | PASS | The renderer uses one column through eight ingredients and a ceil-split two-column layout from nine through twenty. Boundary tests and the in-memory render probe passed. |
| AC-10 | PASS | The detail adapter renders amount and name from server-owned ingredient records and rejects overflow instead of clipping. See [recipeAdapter.ts](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts) and renderer tests. |
| AC-11 | PASS | V2 returns `resolved`, `ambiguous`, and `unmatched` states; ambiguous candidates are recipe-local and are not preselected. The review requires explicit selection or visible exclusion before confirmation. V1 fails closed with a controlled 409 for unresolved or colliding matches. See [recipes.ts](../../../backend/src/functions/recipes.ts), [recipeWizardEditBootstrap.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.ts), [RecipeWizardPreviewPhase.tsx](../../../mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx), and the preparation/UI regression tests. |
| AC-12 | PASS | The detail adapter excludes seasoning ingredients while preserving export steps in [recipeAdapter.ts](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts). |
| AC-13 | PASS | One through four steps use the larger row layout in [recipeDetailsTemplateV3.ts](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts); renderer fixtures pass. |
| AC-14 | PASS | Exactly five steps select the compact layout in [recipeDetailsTemplateV3.ts](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts); the five-step fixture passes. |
| AC-15 | PASS | Server validation enforces export-step limits and source traceability; invalid renderer input is rejected. See [recipeAnalyzeValidation.ts](../../../backend/src/lib/recipeAnalyzeValidation.ts) and renderer tests. |
| AC-16 | PASS | The prompt and validator enforce ordered source-step traceability; all eight scoped Recipe Analyze v11 eval tests passed. |
| AC-17 | PASS | Production-font layout measurement returns a field-specific overflow error; the in-memory probe reproduced `TEMPLATE_FIELD_OVERFLOW` for `description`. |
| AC-18 | PASS | Renderer tests and the in-memory probe produced PNGs at exactly 1080 x 1350. |
| AC-19 | PASS | Invalid template inputs return field-specific errors; the bundle returns a controlled response rather than a partial image pair. See [recipeDetailsTemplate.test.ts](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts) and [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts). |
| AC-20 | PASS | The production detail screen calls the bundle API; both renderers use time and difficulty from the same server-confirmed export view. [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts) verifies canonical metadata. |
| AC-21 | PASS | Preview readiness requires two distinct image URIs and a ready render state in [RecipeInstagramPreview.tsx](../../../mobile/src/modules/recipes/RecipeInstagramPreview.tsx) and its tests. |
| AC-22 | PASS | The media service saves both local PNGs and passes both to one native share call. Automated tests verify this invocation contract; real Android behavior is separately `UNVERIFIED`. |
| AC-23 | PASS | Pair-save rollback, canceled-share retry, saved-pair reuse, and cleanup are covered by [recipeShareMediaService.test.ts](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-24 | PASS | Existing share options and crop flow remain in the production detail screen; mobile component tests pass. |
| AC-25 | PASS | Structured validation, quota ordering, successful-use tracking, and explicit confirmation are covered by backend handler and wizard validation tests. |
| AC-26 | PASS | `exportView` is optional on the existing recipe document and no new container or infrastructure resource was introduced. Legacy Cosmos contract execution is separately `UNVERIFIED`. |
| AC-27 | PASS | Backend, shared, and mobile suites cover export validation, legacy bootstrap, renderer boundaries, image-pair handling, album rollback/retry, and the mocked one-call native adapter. |
| AC-28 | PASS | The corrected entry distinguishes Shared types/constants from Mobile's V2 `{ contractVersion: 2 }` request, loaded `If-Match`, and `contractVersion`/`sourceEtag` response checks, and from Backend strict V1/V2 parsing, confirmation-pair/ETag enforcement, and server-computed fingerprint. These claims match [shared/types/recipes.ts](../../../shared/types/recipes.ts), [mobile/src/shared/api/recipeApi.ts](../../../mobile/src/shared/api/recipeApi.ts), [backend/src/functions/recipes.ts](../../../backend/src/functions/recipes.ts), and [backend/src/lib/repositories/recipeExport.ts](../../../backend/src/lib/repositories/recipeExport.ts). The stale marker is absent from [docs/kb/tech/04-shared-library.md](../../../docs/kb/tech/04-shared-library.md); prior AC-28 note `US10-Q1-F02` is cleared by this targeted verification. |
| AC-29 | PASS | The motif is used only for 9-14 ingredients and omitted for 15-20 in [recipeDetailsTemplateV3.ts](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts); 14/15 boundary fixtures pass. |

## Tests
### Targeted re-review checks

| Command | Exit code | Result |
|---|---:|---|
| `npm run check:encoding` | 0 | Passed on the current worktree. |
| `git diff --check` | 0 | Passed for the tracked documentation change; Git emitted CRLF-to-LF normalization warnings. |
| Test suites | N/A | Not run; this documentation-only re-review explicitly excludes suite reruns. |

The prior Q-1 test results below are retained as historical evidence and were not rerun for this targeted re-review.

### Prior Q-1 test evidence (not rerun)

| Command | Exit code | Result |
|---|---:|---|
| `backend/: npx vitest run --reporter=dot --silent` | 0 | 62 files; 1,127 tests passed. |
| `backend/: npx vitest run src/functions/recipes.test.ts src/lib/recipeValidation.test.ts --reporter=dot --silent` | 0 | 2 files; 86 focused preparation, matching, quota, validation, and confirmation tests passed. |
| `shared/: npx vitest run --reporter=dot --silent` | 0 | 10 files; 450 tests passed. |
| `mobile/: npx vitest run --reporter=dot --silent` | 0 | 49 files; 495 tests passed. |
| `mobile/: npx vitest run src/shared/api/recipeApi.test.ts src/modules/recipes/recipeWizardEditBootstrap.test.ts src/modules/recipes/recipeWizardExportView.test.ts src/modules/recipes/RecipeWizardPreviewPhase.test.tsx --reporter=dot --silent` | 0 | 4 files; 46 focused V2 API, bootstrap, explicit-resolution, and save-gate tests passed. |
| `backend/: npx tsc --noEmit` | 0 | Passed with no diagnostics. |
| `shared/: npx tsc --noEmit` | 0 | Passed with no diagnostics. |
| `npm run typecheck --workspace=mobile` | 0 | Passed with no diagnostics. |
| `backend/: npm run build:verify` | 0 | Build and shared-import verification passed. Azure Functions runtime detection fell back to test mode and skipped host registration calls; `registrations.test.ts` passed in the full Backend suite. |
| `npm run check:encoding` | 0 | Encoding check passed. |
| `git diff --check` | 0 | No whitespace errors. Git emitted CRLF-to-LF conversion warnings for existing modified files. |
| `backend/: npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` | 0 (prior Q-1) | Scoped Recipe Analyze v11 gate passed 8/8. Not rerun: this B-5/F-1 correction did not change the prompt or schema, and the approved plan retains the prior evidence. |
| `backend/: npx vitest run --config vitest.contract.config.mts` | 1 (prior Q-1) | The Cosmos emulator was unavailable at `127.0.0.1:18081`; nine suites stopped during setup and 74 tests were skipped. Not rerun in this re-review; persistence remains `UNVERIFIED`. |
| In-memory Node.js renderer probe | 0 (prior Q-1) | 8, 9, and 20 ingredient layouts rendered 1080 x 1350 PNGs; measured overflow returned `TEMPLATE_FIELD_OVERFLOW`. Renderer behavior was not changed by B-5/F-1; the full Backend suite passed in that Q-1 re-review. |

## Verification Notes

### Cosmos Persistence

- State: `UNVERIFIED`
- Reason: The local emulator was not reachable at `http://127.0.0.1:18081`; no remote Cosmos instance was used.
- Manual action: Start the local emulator using `backend/scripts/start-cosmos-emulator.ps1`, then rerun `cd backend && npx vitest run --config vitest.contract.config.mts`.
- Expected result: Contract suites execute, including old recipe reads without `exportView`, confirmed-view roundtrip, derived stale status, and compare-and-replace conflict behavior.
- Result: Not executed successfully in this environment; nine suites stopped during setup and 74 tests were skipped. This environment limitation does not lower the Q-1 verdict.

### Android Device and Transport

- State: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`
- Reason: No physical Android device, native system share sheet, recipient handoff, or real payload/memory/timeout measurement was performed. The approved plan places U-1 after Q-1; mocked bridge tests verify only the call contract. No native build or deployment was run.
- Manual action: After Q-1, perform U-1 on a real Android test device. Verify two distinct 1080 x 1350 PNGs are saved in `FitTrack`, exactly one `Share.open({ urls: [...] })` receives both local URIs, a multi-image recipient receives the complete pair, retry/rollback behavior is correct, and sharing makes no AI call. Measure Base64 response, decode/parse, memory, and timeout budgets.
- Expected result: Both assets are saved without partial-success messaging and one native invocation carries both; transport remains unchanged unless U-1 records an actual budget failure.
- Result: Not run; scheduled after Q-1. `B-6A` was not triggered because no transport failure was measured.

## Prior Finding Re-review

| Prior key | Current re-review result | Evidence |
|---|---|---|
| FT-QA-2026-037 | Previous first-match defect no longer observed. | V2 exposes ambiguous/unmatched states and all eligible candidates; Mobile leaves ambiguous choices unset and blocks confirmation until explicit resolution or exclusion. V1 returns a controlled 409 unless every resolution is unique. Focused Backend and Mobile regression tests pass. |
| FT-QA-2026-038 | Previous gap no longer observed. | Ordinary edits preserve the export snapshot; confirmation requires the loaded ETag and uses compare-and-replace, with stale-conflict coverage in [recipes.test.ts](../../../backend/src/functions/recipes.test.ts). |
| FT-QA-2026-039 | Previous gap no longer observed. | The bundle rejects stale export status before download or render; regression coverage is in [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts). |
| FT-QA-2026-040 | Previous gap no longer observed. | Preparation enforces quota before the provider and tracks only validated success; handler tests cover quota and failure paths. |
| FT-QA-2026-041 | Previous gap no longer observed in automated flow. | Production uses the bundle API, pair readiness requires distinct PNGs, media tests cover rollback/retry, and the native mock verifies one call with both URIs. Real-device behavior remains unverified above. |
| FT-QA-2026-042 | Previous gap no longer observed. | The bundle derives time and difficulty from the current server-loaded export view and rejects client `recipeMeta`; regression tests pass. |
| FT-QA-2026-043 | Original API/Mobile route and flow gaps are corrected. The status-label mismatch was re-reviewed under FT-QA-2026-045 and is no longer observed; see the retained `US10-Q1-F02` history below. | API/domain/Mobile documentation reflects current behavior; the corrected Shared Library entry and current implementation are verified below. |
| FT-QA-2026-044 | No actionable US-10 finding under the approved re-plan. | The prior scoped Recipe Analyze v11 eval passed 8/8 and remains applicable because B-5/F-1 did not change the prompt or schema. The aggregate diagnostic was not rerun; unrelated Daily/Weekly evals are outside this US-10 gate. |
| FT-QA-2026-045 | AC-28 correction verified; stale status marker no longer labels implemented behavior, and the revised description matches current Shared, Mobile, and Backend responsibilities. | [docs/kb/tech/04-shared-library.md](../../../docs/kb/tech/04-shared-library.md), [shared/types/recipes.ts](../../../shared/types/recipes.ts), [mobile/src/shared/api/recipeApi.ts](../../../mobile/src/shared/api/recipeApi.ts), [backend/src/functions/recipes.ts](../../../backend/src/functions/recipes.ts), and [backend/src/lib/repositories/recipeExport.ts](../../../backend/src/lib/repositories/recipeExport.ts). |

## Prior Finding History

The following actionable finding is retained as recorded in the earlier Q-1 report. It is historical, not actionable in this targeted re-review; FT-QA-2026-045 verified the correction. The central register was not edited.

Finding key: US10-Q1-F02<br>
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`<br>
Acceptance criterion: AC-28<br>
Description: The shared-library Knowledge Base still prefixes the implemented Frontend consumption of the US-10 request/response types and `If-Match` ETag with `[Planned: US-10 Frontend subtasks]`. The Mobile implementation and API documentation show that this behavior is already present, so the status marker misstates the current repository state.<br>
Criticality: Non-blocking<br>
Owner: Documentation<br>
Evidence: [04-shared-library.md](../../../docs/kb/tech/04-shared-library.md); the implemented client and workflow are documented in [03-mobile.md](../../../docs/kb/tech/03-mobile.md) and tested in [recipeApi.test.ts](../../../mobile/src/shared/api/recipeApi.test.ts) and [recipeWizardExportView.test.ts](../../../mobile/src/modules/recipes/recipeWizardExportView.test.ts).<br>
Recommendation: Remove the stale `[Planned: US-10 Frontend subtasks]` marker or revise it to identify only any remaining unimplemented work.

Re-review result: The marker is absent from the Shared Library page and the revised description is accurate against current implementation; the AC-28 note is cleared for this review.

## Findings

No actionable findings remain.
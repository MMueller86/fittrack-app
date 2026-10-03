# QA Report: US-10 Export View Without Stale Gate

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md](../../User%20Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md)
- Verdict: `PASS`

## Scope

Reviewed AC-1 through AC-7 of the auto-approved stale-gate plan. The immutable [original story](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md) was read for context only; its prior stale/reconfirmation requirement is not governing for this focused review. The review covered the recipe handlers, renderer adapter, Mobile API and wizard paths, related regression tests, required Knowledge Base pages, and the existing Cosmos compatibility contract. The broader original US-10 acceptance criteria, AI prompt evaluation, release/deploy, native build, and device behavior were not re-reviewed. Existing worktree changes were preserved; neither plan, the story, nor [docs/qa/findings.md](../findings.md) was edited.

No Cosmos document or container change is part of this focused plan. `exportView` remains optional on `Recipe`; the existing repository contract tests cover historical documents without it, response-only status derivation, and compare-and-replace behavior. Those contract tests could not be executed because the local emulator was unavailable.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Preparation is transient and its response contains export text only; the handler test verifies the stored description, normal steps, ingredients, and ETag remain unchanged. Confirmation tests verify that export steps are saved under `exportView.steps` while normal description, steps, and ingredients remain unchanged. See [recipes.ts](../../../backend/src/functions/recipes.ts), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts), and [recipeWizardEditBootstrap.test.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts). |
| AC-2 | PASS | The share handler checks that `exportView` exists but does not inspect `exportViewStatus`. The stale-share regression changes canonical recipe data, confirms status is stale, then verifies the complete image pair uses current title, portions, nutrition, and ingredient values while teaser and steps come from the stored export view. Mobile gives no stale-specific notice or reconfirmation path. See [instagramRecipe.ts](../../../backend/src/functions/instagramRecipe.ts), [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts), and [recipeShareRenderNotice.test.ts](../../../mobile/src/modules/recipes/recipeShareRenderNotice.test.ts). |
| AC-3 | PASS | A missing export returns `422 MISSING_EXPORT_VIEW` before image download or either renderer. Instagram- and detail-render failures return no partial image pair. Sharing has no AI call path. See [instagramRecipe.ts](../../../backend/src/functions/instagramRecipe.ts) and [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts). |
| AC-4 | PASS | Preparation uses a strict `{ contractVersion: 2 }` schema and maps parse/schema failures to `invalid_export_preparation_request`; tests cover missing, empty, extra-field, and unsupported-version bodies before quota/provider work. The handler returns only teaser, time, difficulty, and plain steps, performs no recipe write, and does not return ingredient IDs, AI keys, or resolution states. Mobile preparation preserves saved ingredient IDs and clears AI-key mappings. See [recipes.ts](../../../backend/src/functions/recipes.ts), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts), [recipeWizardEditBootstrap.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.ts), and [recipeWizardEditBootstrap.test.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts). |
| AC-5 | PASS | Backend preparation and successful export confirmation are tested without a client `If-Match`; writes still call repository `compareAndReplace` with the server-read ETag. A forced CAS loss returns `412 recipe_revision_conflict` and leaves the recipe and ETag unchanged. Mobile sends no ETag, does not require or compare `sourceEtag`, and reloads the current recipe only for the explicit CAS conflict. See [recipes.test.ts](../../../backend/src/functions/recipes.test.ts), [recipeApi.ts](../../../mobile/src/shared/api/recipeApi.ts), [recipeApi.test.ts](../../../mobile/src/shared/api/recipeApi.test.ts), and [RecipeWizardScreen.tsx](../../../mobile/src/modules/recipes/RecipeWizardScreen.tsx). |
| AC-6 | PASS | The handler authenticates, loads the recipe in the authenticated user's partition, selects and downloads a server-owned image, and rejects client `recipeMeta`. Tests cover unauthenticated access and no partial bundle on renderer failure. The Android adapter validates two distinct local PNG URIs and calls `Share.open` exactly once with both; its mocked unit test passes. No native/device behavior is claimed. See [instagramRecipe.ts](../../../backend/src/functions/instagramRecipe.ts), [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts), [nativeShareCandidate.ts](../../../mobile/src/services/nativeShareCandidate.ts), and [nativeShareCandidate.test.ts](../../../mobile/src/services/nativeShareCandidate.test.ts). |
| AC-7 | PASS | FT-QA-2026-037 concerned ambiguous AI-name-to-saved-ingredient-ID resolution during existing-recipe preparation. Under this plan, preparation is strict V2 text-only and neither returns nor maps ingredient identifiers; Mobile preserves the existing saved IDs. The historical ambiguity requirement is therefore not applicable to this focused contract. The current register lists FT-QA-2026-037 as `Closed`; this report re-evaluates its applicability and does not update the register. See [the prior QA report](PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts), and [recipeWizardEditBootstrap.test.ts](../../../mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts). |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `backend/: npx vitest run` | 0 | 62 files and 1,130 tests passed. |
| `backend/: npm run typecheck` | 0 | Passed with no diagnostics. |
| `backend/: npm run build:verify` | 0 | Build, renderer asset copy, shared-import check, and duplicate function-ID check passed. Function-host registration was skipped in test mode; the unit suite's registration test passed. |
| `mobile/: npx vitest run src/shared/api/recipeApi.test.ts src/modules/recipes/recipeWizardEditBootstrap.test.ts src/modules/recipes/recipeWizardExportView.test.ts src/modules/recipes/recipeShareRenderNotice.test.ts src/modules/recipes/RecipeWizardPreviewPhase.test.tsx src/modules/recipes/recipeShareDraftState.test.ts` | 0 | 6 files and 64 tests passed. |
| `mobile/: npx vitest run src/services/nativeShareCandidate.test.ts src/services/recipeShareMediaService.test.ts` | 0 | 2 files and 14 tests passed, including one-call pair handoff and media retry/rollback tests. |
| `mobile/: npx tsc --noEmit` | 0 | Passed with no diagnostics. |
| `Test-NetConnection -ComputerName 127.0.0.1 -Port 18081 -InformationLevel Quiet` | 0 | Returned `False`; no local Cosmos emulator listener. |
| `backend/: npx vitest run --config vitest.contract.config.mts` | N/A | Not run because the local emulator was unavailable. No Azure Cosmos endpoint was used. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: The local Cosmos emulator port `127.0.0.1:18081` was closed. No Azure access was attempted. Existing contract coverage is available in [cosmosRecipesRepository.contract.test.ts](../../../backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts).
- Manual action: Start the local emulator with `backend/scripts/start-cosmos-emulator.ps1`, then run `npx vitest run --config vitest.contract.config.mts` from `backend/`.
- Expected result: Historical recipes without `exportView` remain readable; export status is derived rather than persisted; a lost compare-and-replace does not partially write.
- Result: Not executed in this environment.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: No Android device test or native build was run, as required by this task's scope. Automated tests verify the single-call adapter only.
- Manual action: With a separately authorized compatible Android build and device, share a recipe with two valid local PNGs and inspect the native handoff.
- Expected result: One native share invocation receives both distinct image URIs; there is no single-image or second-dialog fallback.
- Result: Not run.

## Findings

No actionable findings.
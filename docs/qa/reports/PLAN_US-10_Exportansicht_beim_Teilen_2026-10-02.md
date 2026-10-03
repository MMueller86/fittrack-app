# QA Report: Share-triggered Export Review (US-10 Follow-up)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- Verdict: `PASS`

## Scope

Reviewed the approved US-10 export-view-on-share plan, AC-1 through AC-11, and work packages F-1 through F-3 against the Mobile implementation and tests, Backend preparation/confirmation/bundle contracts and focused regressions, downstream media/native-share tests, and the four scoped Knowledge Base pages. All three previously reported blockers were verified resolved. Existing predecessor US-10 renderer/API/native-share work was treated as the plan baseline. No Android device validation or Cosmos execution is claimed; see Verification Notes. This correction changes only this QA report; implementation, Knowledge Base, central findings register, API contracts, and historical artifacts are unchanged.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Wizard preview no longer renders export controls. Real create/edit save-flow tests assert both confirmation fields are absent; create also carries only the transient suggestion to detail. Backend regression confirms an omitted export view is preserved on ordinary update. See [RecipeWizardPreviewPhase.tsx](../../../mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx#L45), [RecipeWizardScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeWizardScreen.test.tsx#L298), [RecipeWizardScreen.tsx](../../../mobile/src/modules/recipes/RecipeWizardScreen.tsx#L840), and [recipes.test.ts](../../../backend/src/functions/recipes.test.ts#L1025). |
| AC-2 | PASS | Share enters a guarded preparation state; the exact AI copy is set only immediately before V2 preparation, while reuse shows the generic message. Tests cover explanatory copy, duplicate taps, and no premature bundle request. See [RecipeDetailScreen.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx#L320), [RecipeInstagramPreview.test.tsx](../../../mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx#L236), and [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L516). |
| AC-3 | PASS | Preflight checks stored `exportView` before cached or navigation-local drafts and ignores `current`/`stale` status. Tests cover both stored statuses, transient reuse, focus-refresh precedence, missing-view preparation, and close/reopen reuse while mounted. Persistence across restart depends on the unchanged stored recipe contract; Cosmos execution is separately `UNVERIFIED`. See [RecipeDetailScreen.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx#L336), [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L377), and [recipeShareExportView.ts](../../../mobile/src/modules/recipes/recipeShareExportView.ts#L15). |
| AC-4 | PASS | Share preview edits teaser, time, difficulty, steps, and included IDs; tag/highlight controls and crop remain separate. Backend confirmation tests preserve ordinary description/steps, and bundle tests verify canonical current recipe fields plus export-only text. See [RecipeInstagramPreview.tsx](../../../mobile/src/modules/recipes/RecipeInstagramPreview.tsx#L145), [RecipeInstagramOptionsSheet.test.tsx](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx#L90), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts#L1040), and [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts#L449). |
| AC-5 | PASS | Shared limits and client validation enforce trimmed 1-96 teaser, integer time 1-10080, non-empty single-line difficulty without an enum/length cap, 1-5 ordered non-empty steps up to 90 characters, and unique valid non-seasoning IDs up to 20. Null AI metadata stays blank; tests cover boundaries and invalid drafts. Text is rejected rather than truncated. The unchanged measured renderer overflow gate was previously verified in the focused detail-image QA pass. See [recipeWizardExportView.ts](../../../mobile/src/modules/recipes/recipeWizardExportView.ts#L115), [recipeShareExportView.test.ts](../../../mobile/src/modules/recipes/recipeShareExportView.test.ts#L189), [recipeShareExportView.test.ts](../../../mobile/src/modules/recipes/recipeShareExportView.test.ts#L288), [recipeValidation.ts](../../../backend/src/lib/recipeValidation.ts#L1), and [the detail-image QA report](PLAN_US-10_Detailbild_Textumbruch_2026-10-02.md#L10). |
| AC-6 | PASS | Create and V2 preparation remain transient; only explicit confirmation sends the existing `exportViewAction: 'confirm'` pair. Unchanged stored values skip PUT; Mobile sends no fingerprint or required ETag, while Backend retains internal compare-and-replace. See [RecipeWizardScreen.tsx](../../../mobile/src/modules/recipes/RecipeWizardScreen.tsx#L840), [recipeApi.test.ts](../../../mobile/src/shared/api/recipeApi.test.ts#L38), [recipes.ts](../../../backend/src/functions/recipes.ts#L351), and [recipes.test.ts](../../../backend/src/functions/recipes.test.ts#L1126). |
| AC-7 | PASS | Confirmation validates the draft and awaits a successful PUT before starting the bundle. Crop confirmation defers its render until the draft is valid, explicitly accepted, and matches the stored view; regressions assert no render before acceptance and PUT-before-render ordering. Backend returns both images only after both renderers succeed. See [RecipeDetailScreen.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx#L666), [RecipeDetailScreen.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx#L702), [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L419), [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L653), and [instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts#L557). |
| AC-8 | PASS | Editing invalidates acceptance and disables sharing until confirmation and a current ready pair. Replacement failure preserves the last pair for display but not sharing; retry uses the existing render controller and does not invoke preparation. See [RecipeInstagramPreview.tsx](../../../mobile/src/modules/recipes/RecipeInstagramPreview.tsx#L96), [recipeShareDraftState.test.ts](../../../mobile/src/modules/recipes/recipeShareDraftState.test.ts#L274), and [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L419). |
| AC-9 | PASS | German retry UI is tested for preparation 429/422/502 and network failure; tests assert no PUT or bundle request before preparation succeeds and the user confirms. A 412 reloads without merge/automatic retry; `MISSING_EXPORT_VIEW` recovers inside Share once without wizard navigation or a loop. Backend verifies strict V2 validation, quota-before-provider ordering, success-only usage tracking, and transient response behavior. See [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L607), [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L697), [RecipeDetailScreen.test.tsx](../../../mobile/src/modules/recipes/RecipeDetailScreen.test.tsx#L735), [recipes.test.ts](../../../backend/src/functions/recipes.test.ts#L295), and [recipes.ts](../../../backend/src/functions/recipes.ts#L633). |
| AC-10 | PASS | Regression coverage retains saved tag order/limit, explicit highlight, crop render/retry, atomic distinct PNGs, exact FitTrack album and rollback behavior, and exactly one Android `Share.open({ urls })` call with both distinct URIs. No Android device pass is claimed. See [RecipeInstagramOptionsSheet.test.tsx](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx#L90), [recipeShareMediaService.test.ts](../../../mobile/src/services/recipeShareMediaService.test.ts#L246), and [nativeShareCandidate.test.ts](../../../mobile/src/services/nativeShareCandidate.test.ts#L28). |
| AC-11 | PASS | All four scoped KB pages describe Share-triggered review, transient versus confirmed data, stale-view reuse, API sequencing, and preserved native constraints; no obsolete wizard export tab or return-to-wizard detour remains. Historical story/plan/QA artifacts were not edited. See [06-recipes.md](../../kb/domain/06-recipes.md#L195), [07-ai-features.md](../../kb/domain/07-ai-features.md#L204), [03-mobile.md](../../kb/tech/03-mobile.md#L161), and [05-ux-patterns.md](../../kb/product/05-ux-patterns.md#L166). |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npx vitest run` (from `mobile/`) | 0 | Full Mobile suite passed: 52 files, 542 tests. |
| `npx tsc --noEmit` (from `mobile/`) | 0 | Mobile typecheck passed with no TypeScript diagnostics. |
| `npx vitest run src/functions/recipes.test.ts src/functions/instagramRecipe.test.ts` (from `backend/`) | 0 | Focused Backend recipe/share suite passed: 2 files, 98 tests. |
| `npx vitest run --config vitest.contract.config.mts` (from `backend/`) | Not run | Local Cosmos emulator unavailable; no exit code or pass is claimed. See Verification Notes. |

## Verification Notes

### Cosmos contract tests

- State: `UNVERIFIED`
- Reason: The local Cosmos emulator was unavailable (`Test-NetConnection -ComputerName 127.0.0.1 -Port 18081 -InformationLevel Quiet` returned `False`); Dev and Alpha Cosmos access was unavailable.
- Prerequisite and action: Start the local emulator with [backend/scripts/start-cosmos-emulator.ps1](../../../backend/scripts/start-cosmos-emulator.ps1), then run `npx vitest run --config vitest.contract.config.mts` from `backend/`.
- Expected result: Recipe repository contracts pass for legacy read compatibility, export-view preservation, and compare-and-replace behavior.
- Result: Not run.

### Android U-1

- State: `MANUAL VALIDATION REQUIRED`
- Reason: Android U-1/device validation is a separate release gate. No Android build or device test was run or claimed.
- Prerequisite and action: On a separately authorized compatible Android build and device, complete the U-1 share flow with a confirmed export and two generated PNGs.
- Expected result: The Android handoff invokes the native share sheet once with both distinct local PNG URIs; there is no single-image fallback.
- Result: Not run.

## Findings

No actionable findings.

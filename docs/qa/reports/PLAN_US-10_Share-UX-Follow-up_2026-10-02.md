# QA Report: US-10 Share UX Follow-up (R2 Final Correction Loop)

- Format: `fittrack-qa-v1`
- Plan reference: [active R2 plan](docs/User%20Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md)
- Verdict: `PASS`

## Scope

Reviewed all 14 R2 acceptance criteria against the current Backend, Mobile, Shared, focused regression tests, the ten required Knowledge Base pages, the active R2 plan, the accepted detail-render QA report, and the Azure OpenAI integration QA checklist. Archived R1 behavior was not treated as current. Rechecked the earlier editor-placement, copy/hint, and unchanged-stale-view checks, plus both correction-loop cases: a 412 reload without a stored `exportView` does not auto-prepare, and the dangling API-reference fragment is absent. No implementation, immutable User Story, historical report, or `docs/qa/findings.md` changes were made by this review. Cosmos contract tests, live AI evaluation, and physical-device acceptance were not run; their scope/status is recorded below.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [RecipeInstagramPreview.tsx](mobile/src/modules/recipes/RecipeInstagramPreview.tsx) and [RecipeInstagramPreview.test.tsx](mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx) verify one `Optionen & Texte bearbeiten` action, one scrollable two-section editor, and no pre-render confirmation control. |
| AC-2 | PASS | The editor test verifies crop, tags, highlight, time, and difficulty under `Titelbild (Instagram)` and teaser, applicable ingredient selection, and ordered steps under `Detailbild`; recipe title/nutrition fields are not editor inputs. The backend adapter continues to source recipe-owned render data from the server-loaded recipe. |
| AC-3 | PASS | Both fixed 1080:1350 preview frames are rendered together. [recipeShareDraftState.ts](mobile/src/modules/recipes/recipeShareDraftState.ts) validates both PNG dimensions and distinct URIs before atomic adoption; [instagramRecipe.test.ts](backend/src/functions/instagramRecipe.test.ts) verifies the handler returns no partial pair. |
| AC-4 | PASS | [RecipeDetailScreen.test.tsx](mobile/src/modules/recipes/RecipeDetailScreen.test.tsx) verifies a transient nullable suggestion is sent before any PUT. Backend bundle tests verify request-draft precedence and no repository write. |
| AC-5 | PASS | Backend tests cover legacy requests with stored current/stale views, the unchanged `MISSING_EXPORT_VIEW` response when neither source exists, and withholding the pair when a renderer fails. |
| AC-6 | PASS | Mobile tests verify the exact AI copy and activity indicator only during provider work, neutral reuse status, separate render activity, ready-only review hint, and duplicate-tap protection. The provider and ready copy also match the Mobile/product Knowledge Base text. |
| AC-7 | PASS | [RecipeShareBundleExportDraftSchema](backend/src/lib/recipeValidation.ts) accepts nullable preview metadata while persisted `RecipeExportViewInputSchema` remains non-null. Schema/mobile tests cover limits; renderer tests cover null-chip omission and controlled overflow without truncation. |
| AC-8 | PASS | [RecipeDetailScreen.tsx](mobile/src/modules/recipes/RecipeDetailScreen.tsx) sends only the explicit confirmation pair, waits for PUT success before rendering the saved view, and skips unchanged values. Tests cover failed-save ordering, transient/presentation-only no-write, and unchanged stale-view no-PUT. |
| AC-9 | PASS | A valid transient pair is shareable without a recipe update. The UI/controller disable sharing for unsaved or stale options and missing/duplicate pairs while retaining the previous complete pair; media tests cover rollback and retry. |
| AC-10 | PASS | [instagramRecipe.ts](backend/src/functions/instagramRecipe.ts) requires authentication and performs the user-scoped read before draft validation; strict schema and ingredient checks run before image download/render. Handler/helper tests cover unknown, duplicate, ambiguous, and seasoning IDs and reject client-owned fields. |
| AC-11 | PASS | [recipes.ts](backend/src/functions/recipes.ts) applies the existing `recipe-analyze` quota before preparation and tracks only validated success. Bundle rendering/retry has no AI or quota path; Mobile tests cover 429/422/502/network failures without render/write and user-triggered retry. |
| AC-12 | PASS | API tests verify no required `If-Match` and no `sourceEtag` prerequisite. The focused regression for a 412 followed by a reload without `exportView` passes: the local draft returns for review, unresolved IDs are removed with a notice, and no preparation, second render, or save retry occurs. |
| AC-13 | PASS | Backend tests preserve stored-tag subset/order and crop/highlight presentation behavior. Media tests verify rollback/retry; [nativeShareCandidate.test.ts](mobile/src/services/nativeShareCandidate.test.ts) asserts one native call with two distinct local PNG URIs. No device pass is claimed. |
| AC-14 | PASS | The six required pages document the R2 flow: [domain/06-recipes.md](docs/kb/domain/06-recipes.md), [domain/07-ai-features.md](docs/kb/domain/07-ai-features.md), [tech/02-backend.md](docs/kb/tech/02-backend.md), [tech/03-mobile.md](docs/kb/tech/03-mobile.md), [tech/09-api-reference.md](docs/kb/tech/09-api-reference.md), and [product/05-ux-patterns.md](docs/kb/product/05-ux-patterns.md). Strict UTF-8 and API-reference assertions confirm the duplicate fragment is absent and the optional `exportViewDraft` contract remains documented. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `backend/: npx vitest run` | 0 | 62 files passed; 1,147 tests passed. |
| `backend/: npx tsc --noEmit` | 0 | TypeScript check passed. |
| `backend/: npm run build:verify` | 0 | Build and compiled-output verification passed. |
| `mobile/: npx vitest run` | 0 | 51 files passed; 548 tests passed. |
| `mobile/: npx tsc --noEmit` | 0 | TypeScript check passed. |
| `shared/: npx vitest run` | 0 | 10 files passed; 450 tests passed. |
| `shared/: npx tsc --noEmit` | 0 | TypeScript check passed. |
| `mobile/: npx vitest run src/modules/recipes/RecipeDetailScreen.test.tsx -t "keeps the edited draft for review after a conflict reload without a stored view"` | 0 | Focused 412 regression passed (1 passed, 16 skipped). |
| `node -e "<strict UTF-8, fragment absence, and API contract assertions>"` | 0 | Strict decode passed; duplicate fragment absent; optional draft/type description present. |
| `git diff --check -- <six R2 Knowledge Base pages>` | 0 | No whitespace errors; Git emitted CRLF-to-LF advisories only. |

## Verification Notes

- State: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`
- Area: Physical Android native sharing and photo-library behavior.
- Reason: No physical device run was performed; automated bridge tests are not device evidence, and the active plan excludes device acceptance.
- Prerequisite: Approved Android build, signed-in user, and a recipe with a renderable image.
- Manual action: Exercise transient Share without text save, explicit export Save, paired image save, and native share cancellation/retry.
- Expected result: Transient text is not persisted; explicit Save is the only export-text write; both distinct images are handled together; media rollback/retry leaves no duplicate assets.
- Result: `UNVERIFIED`; no device pass claimed.

- State: `UNVERIFIED` (not required by R2)
- Area: Live Azure OpenAI evaluation.
- Reason: R2 reuses Recipe Analyze v11 without changing prompt/schema/quota behavior; live provider evaluation is not required by the plan.
- Manual action: None required for R2.
- Result: Not run by scope.

- State: `NOT RUN` (not required by R2)
- Area: Cosmos contract tests.
- Reason: No recipe document shape, repository method, container, or migration changed; Cosmos emulator tests are expressly out of scope.
- Manual action: None required for R2.
- Result: Not run by scope.

## Findings

No actionable findings.
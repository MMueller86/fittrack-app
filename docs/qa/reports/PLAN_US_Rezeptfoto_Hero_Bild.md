# QA Report: US Rezeptfoto fuer optimales Hero-Bild

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md](../../User%20Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md)
- Verdict: `PASS`

## Scope

This re-review uses the complete approved plan, the unchanged user story, the
previous QA report, the current working tree, the required Knowledge Base
documents, and the `cosmos-data-model-and-migration` skill. It covers the
Shared crop contract, Mobile source/editor/draft flows, Backend upload and
metadata routes, Cosmos read compatibility, renderer/EXIF behavior, the exact
`1080 x 1350` PNG contract, documentation, infrastructure scope, and the
targeted correction for `FT-QA-2026-033` /
`Q-US-REZEPTFOTO-AC13-ORIENTATION-001`.

The plan's confirmed runtime frame is `instagram-recipe-v1` at `1080 x 1015`.
The story's illustrative `1080 x 880` reference remains unchanged and is
explicitly superseded for runtime use by the approved plan; the complete
renderer output remains exactly `1080 x 1350`. The QA agent did not modify the
plan, user story, production code, tests, infrastructure, package files, or
`docs/qa/findings.md`; this report is the durable re-review artifact.

Known baseline and environment-limited results are recorded below as
verification limits, not actionable findings: the V1.7 golden-master ratio,
the unrelated Mobile health-platform file-read error, unavailable Cosmos
emulator, unavailable Docker/staging native dependencies, and missing real
device/deployment checks.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [RecipeImageSourcePicker.tsx](../../mobile/src/modules/recipes/RecipeImageSourcePicker.tsx) exposes camera and gallery sources, handles denied camera/gallery permissions, and ignores cancellation without creating a draft. Focused Mobile tests passed. Real-device permission and cancellation behavior remains in manual validation. |
| AC-2 | PASS | [recipeImageSource.ts](../../mobile/src/modules/recipes/recipeImageSource.ts) computes the `1080:1015` frame from the available viewport and safe-area reserves; [RecipeImageSourcePicker.tsx](../../mobile/src/modules/recipes/RecipeImageSourcePicker.tsx) renders dimmed regions outside it. Device visual verification is listed separately. |
| AC-3 | PASS | [RecipeImageSourcePicker.tsx](../../mobile/src/modules/recipes/RecipeImageSourcePicker.tsx) sets `allowsEditing: false` and routes both sources to [RecipeImageHeroCropEditor.tsx](../../mobile/src/modules/recipes/RecipeImageHeroCropEditor.tsx). |
| AC-4 | PASS | [RecipeImageHeroCropEditor.tsx](../../mobile/src/modules/recipes/RecipeImageHeroCropEditor.tsx) uses simultaneous pan/pinch gestures, a cover-minimum clamp, and a lower title/tag safe-area hint; [recipeImageHeroCropMath.ts](../../mobile/src/modules/recipes/recipeImageHeroCropMath.ts) and the focused Mobile suite cover the pure geometry. Gesture and visual behavior require a real-device check. |
| AC-5 | PASS | [recipeImageHeroCrop.ts](../../shared/types/recipeImageHeroCrop.ts) defines the closed version/frame contract and frozen default; `RecipeImageHeroCropSchema` in [recipes.ts](../../backend/src/functions/recipes.ts) enforces finite normalized focus values and `zoom >= 1`. Focused Backend and Shared tests passed. |
| AC-6 | PASS | The editor returns metadata only; [recipeWizardImageMutations.ts](../../mobile/src/modules/recipes/recipeWizardImageMutations.ts) uploads the selected URI once, [storage.ts](../../backend/src/lib/storage.ts) writes one recipe blob, and [recipes.ts](../../backend/src/functions/recipes.ts) persists only `blobName` plus metadata. No second hero-file path exists in the reviewed implementation. |
| AC-7 | PASS | Upload accepts optional validated `heroCrop` and [recipes.ts](../../backend/src/functions/recipes.ts) registers the authenticated `PUT /recipes/{id}/images/{imageId}/hero-crop` route; [recipeApi.ts](../../mobile/src/shared/api/recipeApi.ts) and mutation tests cover upload/update integration. |
| AC-8 | PASS | Upload, crop update, delete, reorder, and render handlers call `requireUser()` and resolve the recipe/image through the user-scoped repository. Focused handler tests cover missing auth, unknown IDs, and a different user's crop update returning `404`. |
| AC-9 | PASS | The strict Zod schema in [recipes.ts](../../backend/src/functions/recipes.ts) rejects unknown frame/version/fields, arbitrary dimensions, non-finite values, out-of-range focus, and `zoom < 1`; focused validation tests passed. |
| AC-10 | UNVERIFIED | [cosmosRecipesRepository.ts](../../backend/src/lib/repositories/cosmosRecipesRepository.ts) and the repository unit path materialize the deterministic legacy default, and [recipes.test.ts](../../backend/src/functions/recipes.test.ts) covers a legacy image in the in-memory repository. The Cosmos contract suite could not initialize because the local emulator was not reachable; no live Cosmos legacy read is claimed. |
| AC-11 | PASS | Delete and reorder preserve the remaining image objects, including `heroCrop`, while filtering the deleted object; [recipes.test.ts](../../backend/src/functions/recipes.test.ts) covers both metadata-preservation paths. |
| AC-12 | PASS | [recipeAdapter.ts](../../backend/src/lib/instagramRenderer/recipeAdapter.ts) starts with the stored/default crop and merges `focusX`, `focusY`, and `zoom` independently. Its focused tests pass and the render request does not write persistence. |
| AC-13 | PASS | [render.ts](../../backend/src/lib/instagramRenderer/render.ts) normalizes non-default EXIF orientation in memory and re-reads oriented dimensions. [photo.ts](../../backend/src/lib/instagramRenderer/photo.ts) uses the oriented dimensions directly for cover placement and applies no additional landscape rotation. [photo.test.ts](../../backend/src/lib/instagramRenderer/__tests__/photo.test.ts) uses deterministic pixel fixtures for EXIF 0/1/90/180/270, asserts exact canonical pixel buffers and normalized metadata, and separately verifies normal portrait and landscape source pixels plus upright layer geometry. The focused renderer check passes 12/12 tests. The historical blocking finding is verified closed below. |
| AC-14 | PASS | [layout.ts](../../backend/src/lib/instagramRenderer/layout.ts) defines `HERO_HEIGHT = 1015`, `CANVAS_WIDTH = 1080`, and `CANVAS_HEIGHT = 1350`; the renderer smoke/output tests assert PNG output at `1080 x 1350`. The old `1080 x 880` value is not used as the runtime frame. |
| AC-15 | PASS | [RecipeImageHeroImage.tsx](../../mobile/src/modules/recipes/RecipeImageHeroImage.tsx) is used by [RecipeDetailScreen.tsx](../../mobile/src/modules/recipes/RecipeDetailScreen.tsx), [RecipeListScreen.tsx](../../mobile/src/modules/recipes/RecipeListScreen.tsx), and the wizard preview, each passing the effective `heroCrop`. |
| AC-16 | PASS | [storage.ts](../../backend/src/lib/storage.ts) bounds downloads to 8 MB and [recipes.ts](../../backend/src/functions/recipes.ts) rejects an oversized upload before `uploadRecipeImage`; [instagramRecipe.ts](../../backend/src/functions/instagramRecipe.ts) returns controlled `422 IMAGE_TOO_LARGE`. Focused Backend tests cover the limit/error path. |
| AC-17 | UNVERIFIED | [mobile/app.config.js](../../mobile/app.config.js) includes recipe photos in the camera rationale and disables microphone permission; `npx expo config --json` exited `0` and emitted the expected `expo-camera` configuration. A plan-specific Infrastructure release record with the final Dev Build decision and route/deployment evidence was not available; the deployment gate remains environment-limited. |
| AC-18 | PASS | `infra/` and package/EAS files are unchanged in the reviewed diff; no prompt, OpenAI, quota, or classification files changed. [infra/modules/cosmos.bicep](../../infra/modules/cosmos.bicep) remains the existing `recipes` container and `/userId` partition model. |
| AC-19 | PASS | [docs/kb/domain/06-recipes.md](../../docs/kb/domain/06-recipes.md), [docs/kb/tech/02-backend.md](../../docs/kb/tech/02-backend.md), [docs/kb/tech/03-mobile.md](../../docs/kb/tech/03-mobile.md), and [docs/kb/tech/09-api-reference.md](../../docs/kb/tech/09-api-reference.md) agree on the crop contract, legacy default, `1080 x 1015` frame, `1080 x 1350` output, EXIF normalization, 8 MB limit, and single-blob model. |
| AC-20 | UNVERIFIED | This report supplies the complete AC-1 through AC-20 matrix, executed test evidence, the automated EXIF evidence, and separate verification-limit/manual sections. Cosmos live evidence, real-device Mobile/accessibility evidence, and Dev/deployment evidence remain explicitly unverified rather than being claimed. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/photo.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts src/lib/instagramRenderer/recipeAdapter.test.ts` | 0 | 3 files, 13 tests passed, including EXIF pixel fixtures, explicit rotation semantics, adapter precedence, and PNG smoke output. |
| `cd backend && npx vitest run src/functions/recipeImageHeroCrop.test.ts src/functions/recipes.test.ts src/functions/instagramRecipe.test.ts src/lib/instagramRenderer/recipeAdapter.test.ts src/lib/instagramRenderer/__tests__/photo.test.ts` | 0 | 5 files, 80 tests passed. |
| `cd mobile && npx vitest run src/modules/recipes/recipeImageHeroCropMath.test.ts src/modules/recipes/recipeImageSource.test.ts src/modules/recipes/recipeWizardEditBootstrap.test.ts src/modules/recipes/recipeWizardImageMutations.test.ts src/shared/api/recipeApi.test.ts` | 0 | 5 files, 25 tests passed. |
| `cd shared && npx vitest run` | 0 | 9 files, 444 tests passed. |
| `cd backend && npx vitest run` | 1 | 58 files ran; 1058 of 1059 tests passed. The only failure is the known V1.7 golden-master ratio `0.5602764060356653` versus the approved maximum `0.03`; the historical fixture still contains the former landscape rotation. |
| `cd mobile && npx vitest run` | 1 | 40 files passed and 403 tests passed; the unrelated `MockHealthPlatformService.test.ts` suite failed during file read with `UNKNOWN: unknown error, read` and ran no tests. |
| `cd backend && npx tsc --noEmit` | 0 | Backend typecheck passed. |
| `cd shared && npx tsc --noEmit` | 0 | Shared typecheck passed. |
| `cd mobile && npx tsc --noEmit` | 0 | Mobile typecheck passed. |
| `cd backend && npm run build:verify` | 0 | Backend build verification passed, including shared-import checks, duplicate function-ID checks, route registration, and copying 9 renderer assets. |
| `cd backend && npx vitest run --config vitest.contract.config.mts` | 1 | All 9 Cosmos contract suites stopped in `beforeAll` because `http://127.0.0.1:18081` was unreachable; 71 contract tests were skipped and no Cosmos pass is claimed. |
| `cd mobile && npx expo config --json` | 0 | Generated Expo configuration successfully; the `expo-camera` rationale contains recipe photos and microphone permission is disabled. |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed. |
| `git diff --check` | 0 | No whitespace errors reported. |
| Scope diff check for `infra/`, package files, EAS files, prompts, and OpenAI files | 0 | No files changed in those excluded scopes. |

## Verification Notes

### UNVERIFIED

- Cosmos legacy-document contract verification requires the local Cosmos emulator at `127.0.0.1:18081` or the CI emulator service. The repository and handler tests provide unit-level evidence, but they are not a substitute for the requested Cosmos contract run.
- No Dev or Alpha deployment, remote route check, or authenticated deployed render was executed in this environment. The plan's Infrastructure Release Gate therefore remains open; no remote status is claimed.
- No Dev or Alpha deployment, remote route check, or authenticated deployed render was executed in this environment. The release gate is not claimed as complete.
- The environment probe found no `_deploy_staging/node_modules` and no Docker executable. WSL is available, but the Linux Node 20 x64 staging dependency gate was not run; Windows native Sharp/Resvg dependencies do not prove the Azure Linux package.

### MANUAL VALIDATION REQUIRED

Prerequisite: a current Development build on at least one iOS and one Android device, with camera/photo permissions reset before testing.

1. Verify allow, deny, retry, settings, and cancel flows for camera and gallery; confirm the wizard remains usable and no empty draft is created.
2. Verify the `1080:1015` frame and dimmed outside area at multiple device widths and safe-area insets; confirm the frame does not jump.
3. Verify camera and gallery enter the same editor; perform pan, pinch, edge clamping, cancel, confirm, and title/tag safe-area checks without spatially rewriting the image.
4. Verify the saved crop is consistent in wizard preview, recipe detail, list thumbnail, and Instagram output, including multiple images and reorder/delete.
5. Verify accessibility labels, focus order, readable error states, and the visible 8 MB rejection on iOS and Android.
6. Render orientation-marked fixtures for EXIF 0/1/90/180/270 and normal
	portrait/landscape sources through the complete deployed renderer; confirm
	the subject is upright and never rotated twice. The automated pixel
	regression closes the code-level AC-13 finding, but this device/deployment
	observation remains manual.

## Findings

No actionable findings remain after the correction review. The known
Golden-master difference, unrelated Mobile file-read error, unavailable
Cosmos emulator, unavailable Linux-native staging dependencies, and missing
manual/deployed checks are verification limits documented above, not new
defects.

### Verified Closure

Finding key: `FT-QA-2026-033` / `Q-US-REZEPTFOTO-AC13-ORIENTATION-001`

Plan reference: [docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md](../../User%20Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md)

Acceptance criterion: AC-13

Description: The previous blocker concerned a second orientation turn after
EXIF normalization and tests that only confirmed the suspect transform
string. The corrected implementation normalizes EXIF orientation once, uses
the oriented dimensions directly for cover placement, and adds deterministic
pixel/fixture regression evidence for EXIF 0/1/90/180/270 plus normal portrait
and landscape sources.

Criticality: Blocking (historical finding; resolved)

Owner: Backend

Evidence: [photo.ts](../../backend/src/lib/instagramRenderer/photo.ts),
[render.ts](../../backend/src/lib/instagramRenderer/render.ts), and
[photo.test.ts](../../backend/src/lib/instagramRenderer/__tests__/photo.test.ts);
focused renderer result 13/13 and focused Backend result 80/80.

Recommendation: Verified closed for this QA re-review. The Orchestrator remains
responsible for updating the central findings register; this QA re-review did
not modify `docs/qa/findings.md`.

Status: VERIFIED CLOSED
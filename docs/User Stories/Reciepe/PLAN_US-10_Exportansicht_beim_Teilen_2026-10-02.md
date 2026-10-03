# US-10 Share UX Follow-up: Combined Editor and Immediate Image Previews

**Status:** AUTO-APPROVED / EXECUTION AUTHORIZED - 2026-10-02  
**Plan Revision:** `US-10-SHARE-UX-2026-10-02-R2`  
Infrastructure Impact: None  
Mobile Build Impact: None  
**Open Product Owner Decisions:** None

The plan is auto-approved as requested. The Orchestrator may execute the
work packages below without another approval prompt.

## Revision History and Supersession

- **R1 - `US-10-SHARE-UX-2026-10-02-R1`:** moved export review into Share,
  retained the existing confirmation-before-first-render flow, and documented
  transient preparation. R2 preserves the Share entry point, paired previews,
  stale-view behavior, export limits, and downstream image-sharing constraints.
- **R2 - this revision:** supersedes R1 only where R1 requires text confirmation
  before the first render, separates text editing from image options, or assumes
  that `share-bundle` only accepts a persisted export view. AI suggestions must
  now render transiently before the user decides whether to save their text.
- The immutable US-10 User Story and the existing QA report remain unchanged.
  R2 requires a new QA report path so the earlier report remains historical
  evidence.

## 1. Requirement Assessment

- **User problem:** Image options and export-text editing are separate actions,
  and a transient AI suggestion currently needs explicit text confirmation and
  persistence before the first image pair can be rendered. This adds a step
  before the user can judge the actual images.
- **Classification:** Accept as proposed. Combine image options and export
  editing under one action, render both images from transient AI text first,
  and keep recipe persistence behind a separate explicit `Speichern` action.
- **Solution fit:** Extend the existing authenticated share-bundle request with
  an optional request-only export draft. This keeps the existing confirmed-view
  path intact for old clients and avoids a new render route or a Cosmos write
  merely to create a preview.
- **AI necessity:** AI remains useful for proposing the teaser and concise
  preparation steps. Reuse the existing Recipe Analyze v11 and
  `recipe-analyze` quota through `POST /recipes/{id}/export-view/prepare`.
  Do not add a prompt, schema, model call, quota feature, or AI call in the
  share-bundle handler.
- **Human review and persistence:** The user sees the generated text in the
  rendered image pair and can still edit it. No AI suggestion is written to
  the recipe by preparation, preview rendering, image-option changes, or
  image sharing. Only the editor's explicit `Speichern` action may persist
  export fields through the existing confirmation pair.
- **Domain and health risk:** No nutrition calculations, calorie claims, or
  health recommendations change. Missing AI metadata remains missing; do not
  invent a time or difficulty.
- **Product Owner decision:** None is required. The user explicitly requests
  the combined editor, first-render behavior, and continued editability. This
  plan specifies the save and transient-share semantics below.

## 2. Recommended Product Behaviour

1. On `Teilen`, reuse a stored confirmed export view (including a stale one),
   a current screen-local suggestion, or call the existing preparation route
   only when neither is available.
2. While the preparation provider call is actually in flight, show an activity
   indicator and this casual German copy:

   > Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide
   > Bilder checken und die Texte noch anpassen.

   When no provider call is needed, do not claim that AI is running. Use a
   neutral status such as `Wir machen deine Bildvorschau fertig ...`.
3. Render and display the Instagram/title image and detail image together,
   side by side, as soon as a transient draft is available. Do not show a
   separate `Texte prüfen` or text-confirmation gate before this first render.
4. After both images are ready, show:

   > Check beide Bilder kurz durch. Die Texte kannst du jederzeit noch
   > anpassen.

5. Replace the separate `Optionen ändern` and `Texte bearbeiten` entry points
   with one action, `Optionen & Texte bearbeiten`. Its single scrollable editor
   has two clearly labeled sections:
   - **Titelbild (Instagram):** selected recipe image and crop action, saved-tag
     selection, the explicit nutrition-highlight toggle, preparation time, and
     difficulty. Preparation time is one field used by both renderers;
     difficulty is shown only by the Instagram renderer, matching current
     renderer behavior.
   - **Detailbild:** teaser, included-ingredient selection when the existing
     selection control applies, and ordered export steps.

   The recipe name, portions, nutrition, and ingredient facts remain
   server-owned and are not editable in this share editor. The teaser is used
   by the detail image. Existing image crop, tags, and highlight remain
   presentation-only values in the local share draft.
6. `Speichern` in the combined editor is the only action that persists a new
   or changed export view. A successful save is followed by a new atomic bundle
   render so both previews reflect the saved values. If only presentation
   options changed, update neither the recipe nor its export view; render both
   images with the changed local options.
7. The final `Bilder speichern & teilen` action may use a valid, current pair
   from either a saved view or an unsaved transient draft. This action saves
   and shares image files only; it does not persist export text. Disable it
   while the editor has unsaved changes or while the pair does not correspond
   to the current draft and image options.

## 3. Feature Summary

This is a focused follow-up to the already approved Share-flow move. It:

- combines text editing and image options into one Share editor;
- retains both side-by-side image previews;
- removes the pre-render text-confirmation step;
- adds a backward-compatible way to render an unconfirmed export draft without
  saving it;
- preserves explicit text-save semantics and rerenders both images after a
  successful save; and
- updates the affected Knowledge Base descriptions and adds Backend, Mobile,
  and QA coverage.

## 4. Current Behaviour

- `RecipeDetailScreen` resolves a stored export view or transient suggestion
  during Share preflight. A missing view may call the existing V2 preparation
  route.
- The share UI separates `RecipeInstagramOptionsSheet` (tags and highlight)
  from `RecipeInstagramPreview` (text editor and paired previews).
- A transient AI or preparation suggestion must first be accepted and written
  through `PUT /recipes/{id}`. Only then does Mobile call `share-bundle`.
- `POST /recipes/{id}/share-bundle` has a strict body that excludes export
  fields, requires `recipe.exportView`, and returns `MISSING_EXPORT_VIEW` before
  rendering if that view is absent.
- `adaptRecipeToDetailsTemplateInput()` reads teaser, time, steps, and
  ingredient IDs from the persisted `recipe.exportView`. The handler reads
  the authenticated recipe once and returns both images only after both
  renderers succeed.
- The two previews already render at once, side by side, and use the same
  `1080 x 1350` output dimensions. This layout must not regress to tabs or a
  single-image switcher.
- A complete stored view is reused regardless of `exportViewStatus`; stale
  views do not trigger AI or block sharing.
- The persisted export contract requires a valid non-null preparation time and
  difficulty. The AI preparation response may return `null` for either value.
  The detail renderer currently requires a time chip, while difficulty is
  intentionally omitted from that image.

## 5. Desired Behaviour

1. One action opens one combined editor containing a `Titelbild (Instagram)`
   section and a `Detailbild` section. The separate options sheet and text-edit
   entry points are removed from this Share flow.
2. Both images remain visible simultaneously, side by side, before and after
   edits. Saving changed export fields causes both images to be regenerated and
   adopted atomically.
3. A transient new-recipe analyzer suggestion or existing-recipe preparation
   result is rendered before any confirmation or persistence. The user can
   inspect that pair and edit the text afterward.
4. A current or stale stored `exportView` remains the first preflight source
   and renders without AI. A transient suggestion already held by the current
   flow is reused. Only a recipe with no stored or locally held draft calls
   the existing preparation endpoint.
5. AI preparation shows the activity indicator and AI-specific copy only while
   the provider request is in flight. Rendering has its own loading state.
   Reuse/cache paths show neutral preparation copy and do not claim an AI call.
6. An unknown `totalTimeMinutes` or `difficulty` may be omitted from the
   transient image preview. It stays blank in the editor and is never
   fabricated. The existing persisted view still requires both values before
   explicit save.
7. A user may share a current transient preview without saving its text to the
   recipe. Explicitly saving text uses the existing confirmation PUT, followed
   by a new bundle render. Editing the ordinary recipe description or steps is
   outside this editor.
8. A failed preparation, save, or render does not produce a partial image pair
   or silently save an AI suggestion. A render retry does not call AI again.

## 6. Scope

- Extend the existing `share-bundle` request with an optional strict,
  request-only export draft suitable for rendering before save.
- Add a shared TypeScript type for the preview-only draft; do not weaken the
  persisted `RecipeExportViewInput` type.
- Adapt both renderers to consume the request draft when present, otherwise
  the authenticated recipe's stored export view.
- Omit unavailable time/difficulty metadata from transient previews without
  inventing values; retain the existing complete persisted rendering behavior.
- Combine existing image options, crop entry point, and export-text editing
  beneath one editor action with separate image sections.
- Add the spinner/copy states, draft lifecycle, explicit Save, post-save pair
  regeneration, retry behavior, and unsaved-edit safeguards.
- Keep the existing user-scoped recipe lookup, stored-image selection,
  selected-tag rules, atomic PNG pair, crop behavior, media save/rollback, and
  native share behavior.
- Update the Knowledge Base pages whose documented Share flow or API contract
  changes.
- Add focused tests and a dedicated QA work package.

## 7. Out of Scope

- No edit to the immutable US-10 User Story or historical QA reports.
- No new route, prompt, Structured Output schema, AI model call, quota feature,
  quota limit, or Mobile-side AI call.
- No recipe/Cosmos document shape, repository method, container, partition
  key, migration, or Bicep change.
- No change to ordinary recipe creation/edit fields or the prior Share-flow
  handoff of a new recipe's transient suggestion.
- No change to accepted stale-view sharing, the existing V2 preparation
  request/response, or the optional ETag behavior.
- No change to recipe image templates except the minimal optional-metadata
  rendering needed for a transient draft with unknown metadata. No new layout,
  text truncation, or partial-image fallback.
- No direct Instagram upload, Google Photos integration, native module,
  config-plugin, `app.config.js`, Expo build, Dev deployment, or Alpha release.
- No iOS or Android device acceptance gate. Preserve the existing automated
  Android native multi-image call assertion; do not claim a device pass.

## 8. Confirmed Facts and Source Conflicts

### Controlling sources

- Repository code is authoritative for current behavior. The share-bundle
  handler requires a saved `exportView`; its adapter cannot construct the
  detail template from an unconfirmed suggestion.
- The 2026-10-01 accepted stale-view decision remains controlling: a present
  current or stale `exportView` can render without AI or forced reconfirmation.
- `docs/kb/domain/07-ai-features.md` requires AI output to remain advisory and
  forbids saving it before explicit user review. R2 preserves that rule: the
  paired images provide review, while `Speichern` remains an explicit write.
- `docs/kb/tech/05-authentication.md` and the existing handlers require
  `requireUser()` and user-scoped repository reads. The new request field does
  not change that boundary.
- Current `docs/kb/tech/03-mobile.md` and
  `docs/kb/product/05-ux-patterns.md` describe the separate options/editor
  actions and pre-render text confirmation. They must be updated after
  implementation.

### Historical conflicts

- R1 and the older KB text require explicit confirmation before the first
  transient-draft render. R2 intentionally supersedes that behavior.
- The existing historical QA report at
  `docs/qa/reports/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md` refers
  to R1 and must not be edited or overwritten. R2 QA uses the new report path
  declared in the QA work package.
- Other accepted US-10 constraints, including the paired layout, stale-view
  allowance, measured detail-image overflow handling, and Android native
  handoff, remain unchanged.

## 9. Persistence, API, Compatibility, and Security

### Persistence impact

**Persistence Impact:** No Cosmos document or repository change. The existing
optional `Recipe.exportView` remains the only persisted export object, written
only by an explicit `PUT /recipes/{id}` request containing
`exportViewAction: 'confirm'` and `exportView`. Preparation, request-only
preview rendering, and saving/sharing PNG files do not persist export text.
No migration class applies because the stored document shape is unchanged; no
`cosmos.ts`, container, or `cosmos.bicep` change is planned.

`cosmos-data-model-and-migration` is not required for these work packages:
there is no document field, entity, repository, or migration change. Backend
and QA must still prove that an unconfirmed bundle render does not call a
recipe write.

### Additive API contract

Extend `POST /api/recipes/{id}/share-bundle` with one optional field:

```json
{
  "imageId": "optional-recipe-image-uuid",
  "presentation": { "focusX": 0.5, "focusY": 0.46, "zoom": 1.0 },
  "selectedTags": ["Schnell", "Salat"],
  "nutritionHighlight": "high-protein",
  "exportViewDraft": {
    "version": 1,
    "teaser": "Goldbraunes Brot",
    "totalTimeMinutes": null,
    "difficulty": null,
    "steps": [{ "order": 1, "description": "Tomaten schneiden." }],
    "includedIngredientIds": ["recipe-ingredient-uuid"]
  }
}
```

The shared `RecipeShareBundleExportDraft` type is request-only and contains
`version`, `teaser`, nullable `totalTimeMinutes`, nullable `difficulty`,
ordered `steps`, and `includedIngredientIds`. It has no `sourceFingerprint`,
recipe metadata, AI keys, or owner fields. The strict request schema rejects
unknown fields, including `recipeMeta` and any client fingerprint.

Selection and compatibility rules:

- If `exportViewDraft` is present, the handler validates and uses it for this
  render only, even if the recipe also has a stored view. It never writes or
  echoes the draft.
- If the field is absent, preserve the existing behavior: use the stored
  `exportView`, whether current or stale; if none exists, return the existing
  `422 MISSING_EXPORT_VIEW` response.
- Existing clients omit the optional field and retain the current request and
  response contracts. The response remains the same atomic Instagram/detail
  PNG pair.
- Non-null preview metadata uses the existing persisted validation limits:
  positive integer time through 10,080 minutes and non-empty single-line
  difficulty. A preview may use `null` for either value only. Teaser, step,
  order, and ingredient-ID limits remain aligned with the existing export
  validation rules.
- Validate every included ID against the current authenticated recipe. It
  must identify exactly one non-seasoning ingredient; reject unknown,
  duplicate, ambiguous, or seasoning IDs before downloading the image or
  invoking either renderer.
- Server recipe name, portions, nutrition, image Blob, and current ingredient
  values remain authoritative. Do not accept client recipe metadata or map
  analyzer keys/names to saved ingredient IDs.
- For a transient preview, omit only unavailable metadata: omit the time chip
  when time is null and the difficulty chip when difficulty is null; always
  retain recipe-owned portions and other existing content. The detail image
  continues to omit difficulty. A persisted export view remains complete and
  renders as before.
- A later explicit text save uses the existing PUT confirmation pair and
  existing server-owned fingerprint. It omits unrelated recipe fields and
  does not send a client fingerprint. The saved-view type/schema remains
  non-null for time and difficulty.

### Authentication, source conflicts, and error behavior

- Keep `requireUser()` on the bundle and preparation routes. Load the recipe
  through the authenticated user's repository partition; never trust a client
  recipe ID as authorization.
- The request-only draft is untrusted input and receives strict structural and
  ingredient-ID validation before render. No AI keys, recipe secrets, client
  image URL, blob name, title, or nutrition value enters a renderer from the
  request.
- `share-bundle` remains render-only: no AI call, quota check, recipe write,
  storage upload, or response cache. The preparation route remains the only
  AI call and retains `recipe-analyze` quota ordering and the current 429,
  422, and 502 behavior.
- Do not introduce a required `If-Match` or `sourceEtag` comparison. Preserve
  the accepted V2 semantics: `sourceEtag` is compatibility metadata; the
  server loads current recipe data and validates draft IDs against it. A
  current/stale stored view remains shareable.
- A `400` invalid draft/ingredient response and any `404`, `422`, or `500`
  render failure returns no PNG pair. Either renderer failing continues to
  suppress both images; renderer errors remain field-specific and sanitized.
- If the explicit PUT returns `412 recipe_revision_conflict`, Mobile reloads
  the current recipe and returns the draft for user review. Do not merge or
  retry the save automatically. Revalidate selected IDs against the reloaded
  recipe before another explicit save.

## 10. Existing Components to Reuse

- `POST /recipes/{id}/export-view/prepare`, its V2 response, Recipe Analyze
  v11, and the existing `recipe-analyze` quota.
- `ShareBundleRequestSchema`, `shareBundleHandler`,
  `adaptRecipeToDetailsTemplateInput()`,
  `adaptRecipeToRenderInput()`, the existing pair of renderers, and current
  image selection/storage logic.
- `RecipeExportViewInputSchema`, `validateRecipeExportIngredients()`, shared
  export limits, and the existing `PUT /recipes/{id}` confirmation contract.
- `RecipeDetailScreen`, `recipeShareDraftState`, `recipeShareExportView`,
  `RecipeInstagramPreview`, `RecipeInstagramOptionsSheet`, the API client, and
  the existing crop/media services. Combine the user entry point and editor;
  do not build a second share flow or global draft cache.
- Existing theme tokens, activity indicator, FitTrack info/error overlay,
  request revision guards, image-pair validation, local media rollback, and
  native multi-image share adapter.

## 11. Proposed Technical Solution

### A. Add a transient bundle-draft contract

1. Add `RecipeShareBundleExportDraft` to `shared/types/recipes.ts` (or the
   established shared recipe-export type module) without changing
   `RecipeExportViewInput`, `RecipeExportViewPersistence`, or `Recipe` storage.
2. Add optional `exportViewDraft` to the strict backend
   `ShareBundleRequestSchema` and the Mobile
   `RecipeShareBundleOptions` contract.
3. Reuse existing export constants and ingredient validation. The preview
   schema allows nullable time/difficulty; the save schema stays unchanged and
   requires valid values.
4. Resolve the effective export input once in `shareBundleHandler`:
   request draft when present, otherwise the stored export view. Preserve
   `MISSING_EXPORT_VIEW` for an absent request draft plus absent stored view.
5. Pass the resolved export input to both adapters. Keep recipe-owned title,
   portions, nutrition, ingredients, and image selection server-side. The
   request draft never reaches Cosmos and the handler does not invoke a write
   method.
6. Update renderer input/metadata composition only enough to omit null time or
   difficulty chips in a transient draft. Preserve complete persisted-view
   pixels and current measured-overflow errors. Add tests for both omission and
   the existing complete metadata output.

### B. Reuse, prepare, and render in Mobile

On every Share entry, resolve sources in this order:

1. Existing `recipe.exportView`, regardless of current/stale status.
2. The current new-recipe analyzer suggestion already carried into the detail
   route, or a valid transient draft kept by the mounted detail screen.
3. One call to `prepareExportView()` when neither stored nor local source is
   available.

The API response's nullable metadata remains blank. Keep the strict
`{ "contractVersion": 2 }` preparation body and do not require a response
ETag. Guard duplicate Share taps, ignore late responses after the flow closes,
and reuse a successful transient preparation while the same detail screen
remains mounted.

For a transient source, map only validated text and saved ingredient IDs into
`exportViewDraft` and call the existing bundle route. New-recipe analyzer keys
are resolved only by the existing unique, user-confirmed Mobile resolver;
never send analysis keys. Existing-recipe V2 preparation returns no ingredient
IDs, so keep its documented legacy default: all non-seasonings when the count
is at most 20; none above 20 until the user selects them.

The first render starts immediately after preflight, without a text-confirm
action. Show the paired preview when both outputs succeed. A prepared transient
draft remains local until explicit editor save or until the screen is
destroyed; closing Share alone must not save it.

### C. Combine the editor and preserve explicit save

- Replace the two separate controls with one `Optionen & Texte bearbeiten`
  entry point. It opens a single scrollable editor with the sections and field
  mapping in Section 2.
- Preserve exact existing constraints: trimmed teaser 1-96 characters;
  positive integer time 1-10,080 for save; non-empty single-line difficulty
  for save; 1-5 ordered, non-empty export steps of at most 90 characters;
  no more than 20 unique included IDs, all current non-seasoning ingredients.
  Keep nullable time/difficulty blank for preview and require the user to fill
  them before saving. Never silently truncate text.
- Editing any export field marks the displayed pair as stale for the edited
  draft and disables image sharing until save-and-rerender succeeds. Keep the
  last complete pair visible during work; do not replace it with one new image
  if the other render fails.
- On explicit `Speichern`, send only
  `{ exportView, exportViewAction: 'confirm' }` through the existing recipe
  update API when the draft is new or changed. Wait for a successful response,
  update the screen's recipe from that response, then call `share-bundle`
  without `exportViewDraft` so the server renders the saved values. Do not call
  the bundle after a failed PUT.
- If the text values are unchanged and already stored, do not rewrite the
  export view. If only tags, highlight, selected image, or crop changed, do
  not send a recipe PUT; render both outputs using those transient options.
- After explicit save, regenerate both previews and atomically adopt the new
  pair. A render failure after the save keeps the saved view, retains the last
  complete pair for display, blocks sharing that stale pair, and offers a
  render retry that does not invoke AI or repeat the PUT.
- `Bilder speichern & teilen` may use the current valid transient pair without
  persisting its export text. Disable the action when the editor has unsaved
  changes, the pair is stale/incomplete, or either local image URI is missing
  or duplicated. A final media/share failure keeps current recipe persistence
  unchanged and uses existing rollback/retry behavior.
- Closing or cancelling the editor before `Speichern` must not write. Keep the
  current local draft available within the mounted screen; on screen teardown,
  discard unpersisted text.

### D. Loading, recovery, and source conflicts

- During a real provider call, show the activity indicator with the AI copy in
  Section 2. While rendering, show the existing render spinner with
  `Deine beiden Bilder werden gerendert ...`. On reuse without AI, show neutral
  preparation copy only; do not add an artificial delay.
- Preparation `429`, `422`, `502`, network failure, or cancellation must not
  call the bundle route or persist a draft. Offer a user-triggered retry; one
  retry means one new preparation call.
- A defensive `MISSING_EXPORT_VIEW` is retried inside Share at most once after
  resolving/preparing a draft. It must not navigate to the wizard or enter a
  retry loop.
- A request draft with invalid/currently unresolved ingredient IDs is rejected
  before renderer work. Show a recoverable German message and let the user
  review the current recipe/selection.
- A PUT `recipe_revision_conflict` reloads the recipe and returns to explicit
  review. Do not auto-merge, re-confirm, or start AI automatically. The
  existing stale confirmed-view sharing rule remains unchanged.
- A renderer overflow or controlled invalid-layout response leaves the last
  complete image pair on screen, blocks image sharing for the newer draft, and
  offers edit/retry. No partial bundle or truncated text is accepted.

## 12. Backend Work Package

### B-1: Add transient draft rendering to the existing bundle API

**Agent:** Backend

**Goal:** Allow the authenticated share-bundle endpoint to render an optional
unconfirmed, request-only export draft while preserving the existing stored
view contract for callers that omit it. Keep AI orchestration, persistence,
and recipe ownership boundaries unchanged.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/functions/instagramRecipe.ts`
- `backend/src/functions/instagramRecipe.test.ts`
- `backend/src/functions/recipes.ts`
- `backend/src/functions/recipes.test.ts`
- `backend/src/lib/recipeValidation.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.ts`
- `backend/src/lib/instagramRenderer/types.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts`
- `shared/types/recipes.ts`
- `shared/types/recipeExport.ts`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/09-api-reference.md`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:** AC-3 through AC-10, AC-12.

**Dependencies:** None. R1 preparation, confirmation, auth, quota, stale-view,
and renderer contracts are inputs; do not alter them beyond the optional
bundle draft and null-metadata preview behavior specified here.

**Expected Handoff:**
- Shared request-only draft type and exact strict request schema.
- Documented precedence: optional request draft for this render; otherwise
  confirmed stored view; otherwise `MISSING_EXPORT_VIEW`.
- Confirmed response and error shape, validation limits, and null-chip behavior
  for both renderers.
- Unit tests proving auth/user scoping, strict validation, current/stale legacy
  request compatibility, request-draft rendering, no persistence, and atomic
  failure behavior.
- Backend typecheck, full unit suite, and `npm run build:verify` results.
- Updated Backend/domain/API documentation matching the implemented request
  draft contract and persistence boundary.
- No prompt evaluation is required because prompt, Structured Output, and
  quota behavior are unchanged. No Cosmos handoff or migration is required.

## 13. Frontend Work Package

### F-1: Combine Share options and text editing; preview transient drafts

**Agent:** Frontend

**Goal:** Remove the extra pre-render text-confirmation step and separate
options sheet. Provide one title/detail editor, render transient AI drafts
before any recipe write, and regenerate the paired previews after an explicit
save.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
- `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx`
- `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`
- `mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx`
- `mobile/src/modules/recipes/RecipeInstagramOptionsSheet.tsx`
- `mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx`
- `mobile/src/modules/recipes/recipeShareDraftState.ts`
- `mobile/src/modules/recipes/recipeShareDraftState.test.ts`
- `mobile/src/modules/recipes/recipeShareExportView.ts`
- `mobile/src/modules/recipes/recipeShareExportView.test.ts`
- `mobile/src/modules/recipes/recipeWizardExportView.ts`
- `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`
- `mobile/src/shared/api/recipeInstagramRenderContract.ts`
- `mobile/src/shared/api/recipeApi.ts`
- `mobile/src/shared/api/recipeApi.test.ts`
- `shared/types/recipes.ts`
- `shared/types/recipeExport.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1 through AC-10, AC-12.

**Dependencies:** B-1 handoff, including the shared draft type, request body,
validation/error contract, and renderer support for nullable preview metadata.
Do not invent a client-only API shape or send persisted recipe fields through
the bundle request.

**Expected Handoff:**
- One `Optionen & Texte bearbeiten` action and one editor with the documented
  `Titelbild (Instagram)` and `Detailbild` sections.
- Both image previews remain side by side and update atomically.
- No text confirmation action before the first transient-draft render.
- AI loading spinner/copy, neutral non-AI preparation state, render state,
  nullable metadata handling, and recoverable errors.
- Explicit export `Speichern` persists only through the existing PUT pair and
  triggers a fresh pair render. Transient preview/share and presentation-only
  changes do not write recipe data.
- Focused tests for preparation source selection, duplicate taps, unified
  editing, field validation, transient bundle request, explicit save ordering,
  render invalidation/retry, conflict recovery, and preserved image sharing.

## 14. Documentation Work Package

### F-2: Update Mobile and product UX Knowledge Base descriptions

**Agent:** Frontend

**Goal:** Replace R1's obsolete Mobile pre-render confirmation and
separate-options descriptions with the implemented R2 workflow. Update only
the Mobile and product UX pages owned by this package.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`
- `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
- `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`
- `mobile/src/shared/api/recipeInstagramRenderContract.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-3, AC-6, AC-7, AC-8, AC-9,
AC-11, AC-13, AC-14.

**Dependencies:** B-1 and F-1 handoffs. Backend owns the recipe/domain/API
documentation updates in B-1. This package updates only Mobile/product pages
and must match the verified F-1 copy and save lifecycle.

**Expected Handoff:** Updated `docs/kb/tech/03-mobile.md` and
`docs/kb/product/05-ux-patterns.md`. They must describe the combined editor,
paired preview, loading copy, explicit text-save lifecycle, transient
no-write preview/share, and remove R1 text-confirm-before-render claims.

## 15. QA Work Package

### QA-1: Verify R2 implementation and documentation

**Agent:** QA

**Goal:** Verify every R2 acceptance criterion, backward compatibility,
explicit save behavior, authentication and validation boundaries, paired image
rendering, and Knowledge Base accuracy.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- Backend B-1 implementation and tests listed in B-1.
- Mobile F-1 implementation and tests listed in F-1.
- `backend/src/functions/recipes.ts` and `backend/src/functions/recipes.test.ts`
  for preparation and explicit confirmation regression coverage.
- `shared/types/recipes.ts` and `shared/types/recipes.test.ts`.
- All Knowledge Base pages listed in F-2.
- `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
  (this R2 plan).
- `docs/qa/reports/PLAN_US-10_Detailbild_Textumbruch_2026-10-02.md` for the
  accepted paired-render and measured-overflow constraints.

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:** AC-1 through AC-14.

**Dependencies:** B-1, F-1, and F-2 are complete. No direct Azure or remote
Cosmos access is allowed. Do not edit the immutable User Story or historical
QA reports. Do not claim the existing Android device gate as passed.

**Expected Handoff:** Durable `fittrack-qa-v1` report at
`docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md`. Include every
AC exactly once in the criteria matrix, test commands with exit codes, findings
with all required fields, and separate `UNVERIFIED` or `MANUAL VALIDATION
REQUIRED` notes for unavailable device/provider environments.

## 16. Shared Package Changes

- Add a request-only `RecipeShareBundleExportDraft` type for rendering. It
  permits nullable time/difficulty and contains no server fingerprint.
- Add the type-level test in `shared/types/recipes.test.ts` as appropriate.
- Do not change `RecipeExportViewInput`, persisted `RecipeExportView`,
  `Recipe`, Cosmos serialization, container definitions, or partition keys.
- Mobile's share-bundle request type adds the optional draft field. The
  response type and existing PUT confirmation type remain unchanged.

## 17. Infrastructure and Runtime Impact

- No Bicep, app setting, container, storage resource, deployment topology, or
  Azure service change is needed. Development uses the local Azure Functions
  host and existing local/remote development data configuration.
- No Infrastructure & Release feature work package is required. No remote
  Azure Functions deployment, Dev Build, Expo build, or Alpha release is part
  of this implementation plan.
- `Infrastructure Impact: None` means no Azure resource/infrastructure action
  is required for the plan. `Mobile Build Impact: None` means the Mobile work
  is JavaScript/TypeScript only and adds no native module or config change.
  Infrastructure & Release retains ownership of any later operational build
  or deployment decision.

## 18. Test Strategy

### Backend and shared

- Extend `instagramRecipe.test.ts` to cover: old request with stored current or
  stale view; missing stored view with no draft; valid transient draft with no
  write; transient draft overriding a stored view for that request; invalid or
  unknown fields; client fingerprint/recipe metadata rejection; unknown,
  duplicate, ambiguous, and seasoning ingredient IDs; null metadata; auth and
  user scoping; selected-tag validation; atomic two-render success/failure;
  no AI call and no repository update on render.
- Extend adapter/renderer tests to verify only missing time/difficulty chips
  are omitted, stored complete views render unchanged, canonical recipe fields
  remain server-owned, and measured overflow still returns no partial pair.
- Keep regression coverage for V2 preparation's strict body, quota ordering,
  nullable suggestion response, and explicit PUT's internal
  compare-and-replace/412 behavior. Do not change or reevaluate the prompt.
- Run `shared` type tests. Cosmos contract tests and migration tests are not
  required because no document shape, repository method, or container changes.

### Mobile

- Replace expectations for two separate actions and `Texte prüfen` with one
  combined editor and assertions that transient suggestions render before any
  PUT.
- Verify both previews remain present at once and update only as a complete
  pair after edits/save.
- Verify source selection, one preparation per user-triggered attempt,
  duplicate-tap guard, spinner and exact German copy, generic non-AI copy,
  screen-local draft reuse, nullable metadata, validation, and no persistence
  on preview or transient image sharing.
- Verify explicit Save sends only the confirmation pair, waits for success,
  then renders the pair; presentation-only changes do not send a PUT; failed
  PUT never calls the bundle route; a 412 reloads for user review without an
  automatic retry.
- Verify render failures keep the last complete pair visible but not
  shareable, retry does not call AI, and both share URIs are still passed in
  exactly one mocked Android `Share.open({ urls: [...] })` call.
- Keep regression coverage for crop, saved tags, highlight, local album,
  rollback, and media retry. No physical Android/iOS pass is claimed.

### Required commands

Run from each package directory:

```text
backend/: npx vitest run
backend/: npx tsc --noEmit
backend/: npm run build:verify
mobile/: npx vitest run
mobile/: npx tsc --noEmit
shared/: npx vitest run
shared/: npx tsc --noEmit
```

Live Azure OpenAI prompt evaluation is not required: no prompt, model schema,
or AI validation behavior changes. Do not access Dev or Alpha Cosmos for this
work. Report any unavailable physical-device validation as `UNVERIFIED` or
`MANUAL VALIDATION REQUIRED`, not as a finding.

## 19. Acceptance Criteria

- **AC-1:** One `Optionen & Texte bearbeiten` action replaces the separate
  `Optionen ändern` and text-edit/confirmation entry points. It opens one
  scrollable editor with distinct `Titelbild (Instagram)` and `Detailbild`
  sections; there is no `Texte prüfen` or equivalent pre-render confirmation.
- **AC-2:** The title section exposes the existing image/crop, saved-tag,
  highlight, time, and difficulty controls. The detail section exposes teaser,
  applicable ingredient selection, and ordered steps. Time is entered once
  and is shared by both renderers; difficulty remains omitted from the detail
  image. Recipe-owned title, portions, nutrition, and ingredient facts are not
  client-editable.
- **AC-3:** Instagram and detail previews are shown simultaneously, side by
  side, each at the existing `1080 x 1350` aspect ratio. No single-image tab or
  switcher replaces the paired layout. A saved text edit renders both again
  and the UI adopts them atomically.
- **AC-4:** A transient new-recipe analyzer suggestion or V2 preparation
  suggestion is sent as optional `exportViewDraft` and can render before any
  recipe PUT. Bundle rendering does not write `Recipe.exportView`, usage, or
  any other recipe field. A request draft takes precedence for that request;
  absent a draft, the handler uses a stored current/stale view; if neither
  exists, the old `MISSING_EXPORT_VIEW` response remains.
- **AC-5:** Existing clients that omit `exportViewDraft` keep the current
  request/response contract. Stored current and stale views render as before.
  The bundle response still contains both PNGs only after both renders
  succeed; neither renderer can cause a partial pair to be returned.
- **AC-6:** When a provider call is in flight, an activity indicator and the
  approved German AI-loading copy from Section 2 are visible. While images
  render, a render activity state is visible. Reuse paths show neutral copy
  and never say AI is running. There is no artificial delay or duplicate
  preparation call from repeated taps.
- **AC-7:** A transient preview draft accepts `null` for time and difficulty
  and omits only those unknown metadata chips; no defaults are fabricated.
  Saving still requires the existing non-null valid values. Teaser, steps, and
  ingredient IDs retain the existing server validation limits and controlled
  renderer overflow behavior; text is never silently truncated.
- **AC-8:** Only explicit editor `Speichern` persists a new/changed export
  view, using exactly `exportViewAction: 'confirm'` plus `exportView` and no
  unrelated recipe fields or client fingerprint. Successful persistence is
  followed by a bundle render from the saved view. A failed PUT starts no
  bundle render. Unchanged stored export fields are not rewritten; changes to
  tags, highlight, image, or crop alone do not write recipe data.
- **AC-9:** A valid current transient pair may be saved/shared as image files
  without persisting its export text. Sharing is disabled while editor changes
  are unsaved or when the image pair is missing, duplicated, stale, or does
  not match current options. No image is saved or shared before both files
  exist and pass the current asset validation.
- **AC-10:** The endpoint remains authenticated through `requireUser()` and
  reads recipe/image/ingredient data within the authenticated user's scope.
  Strict request validation rejects unknown fields and invalid IDs before
  image download/render. It never accepts client recipe title, nutrition,
  owner, blob name, SAS URL, AI key, or fingerprint.
- **AC-11:** Preparation continues to use the existing `recipe-analyze`
  quota; bundle render and render retry do not invoke AI or consume quota.
  Preparation 429/422/502/network failure causes no render or write and offers
  a user-triggered retry. A defensive missing-view recovery cannot loop or
  navigate to the recipe wizard.
- **AC-12:** The accepted source semantics remain: no required client
  `If-Match`/`sourceEtag`; the server loads current recipe data and validates
  IDs; stale confirmed views remain shareable. An explicit-save
  `recipe_revision_conflict` reloads the current recipe, returns to user
  review, and is not automatically merged or retried.
- **AC-13:** Existing downstream behavior remains intact: selected tags stay
  a subset of stored tags and retain server order; highlight and crop remain
  presentation-only; media save/rollback/retry is unchanged; and exactly one
  Android native share call receives both distinct image URIs. No device pass
  is claimed.
- **AC-14:** `docs/kb/domain/06-recipes.md`,
  `docs/kb/domain/07-ai-features.md`, `docs/kb/tech/02-backend.md`,
  `docs/kb/tech/03-mobile.md`, `docs/kb/tech/09-api-reference.md`, and
  `docs/kb/product/05-ux-patterns.md` describe the implemented R2 contract and
  no longer state that transient text must be confirmed before first render.
  The User Story and historical QA report are unchanged.

## 20. Risks and Assumptions

- **Nullable metadata:** A transient image can omit time or difficulty if the
  AI cannot provide it. The persisted export remains invalid until the user
  supplies valid values. Neither UI nor renderer invents defaults.
- **Explicit persistence:** The editor's `Speichern` action persists export
  text; the final image `Bilder speichern & teilen` action does not. A user
  may share the reviewed transient pair without saving export text to the
  recipe. This distinction must be clear in the UI copy and button labels.
- **Source changes:** A request-only draft is validated against the current
  server-loaded recipe. The accepted API does not require source ETag matching.
  Current recipe fields are canonical; stale confirmed export snapshots remain
  shareable by prior decision. An actual PUT race returns 412 and requires
  reload and user review.
- **Render after save:** A renderer/layout failure may occur after the explicit
  PUT has saved the export view. Keep the saved view, retain but disable the
  last old pair, and allow render retry without repeating AI or the PUT.
- **Quota:** Only a real preparation request spends `recipe-analyze` quota.
  Reuse local drafts, prevent duplicate taps, and never auto-reprepare after a
  renderer failure or save conflict.
- **Transient lifetime:** An unpersisted AI suggestion survives only in the
  mounted detail screen. Leaving/destroying it discards the transient draft;
  a later Share may call preparation again. No global cache or Cosmos draft is
  introduced.
- **Layout regressions:** Optional metadata must be measured through the
  production renderer path. Preserve German wrapping, field-specific overflow
  errors, paired output dimensions, and the no-partial-pair rule.
- **Historical validation:** Existing Android device/transport and any remote
  Cosmos checks are not upgraded by this plan. QA records unavailable
  environment checks separately.

## 21. Recommended Execution Order

All work proceeds sequentially:

1. **Backend B-1:** add the shared transient draft type, strict optional bundle
   request field, server validation/selection, optional-metadata rendering,
   handler/renderer tests, and Backend/API/recipe/AI Knowledge Base updates.
2. **Frontend F-1:** implement the combined editor, AI/render loading copy,
   immediate transient paired preview, explicit text save, post-save rerender,
   error/source-conflict handling, and Mobile tests using the B-1 handoff.
3. **Frontend F-2:** update the Mobile and product UX Knowledge Base pages to
   match the verified F-1 behavior and B-1 API contract.
4. **QA QA-1:** run affected package tests/typechecks/build verification,
   evaluate AC-1 through AC-14, review documentation and compatibility, then
   write the R2 report to
   `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md`.

No Cosmos migration, Infrastructure & Release task, native build, remote
deployment, or Alpha release is included.

---

## Archived R1 Plan (Superseded; Preserved Verbatim)

<details>
<summary>Open the full R1 plan text</summary>

# US-10 Follow-up: Move Export Review into the Share Flow

**Status:** AUTO-APPROVED / EXECUTION AUTHORIZED — 2026-10-02  
**Plan Revision:** `US-10-SHARE-UX-2026-10-02-R1`  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None

This is a focused follow-up to US-10. It changes where export fields are
reviewed and when existing-recipe preparation is triggered. It does not modify
the immutable User Story or rewrite earlier US-10 plans and QA records. All
previously approved share, renderer, persistence, and platform constraints
remain in force unless this plan explicitly changes their UX placement.

## 1. Requirement Assessment

- **User problem:** Export fields appear during ordinary recipe review, before
  the user has chosen to share. A recipe without a confirmed export view
  currently reaches a missing-export error and is sent back to the wizard.
- **Classification:** Accept as proposed. Move export review into the Share
  journey; check for available fields on Share, prepare only when needed, and
  keep the values editable before sharing.
- **Product Owner decision:** None required. The user allows generation during
  recipe creation or at Share. This plan reuses a new recipe's existing
  suggestion as an unconfirmed, transient draft and uses the existing
  preparation endpoint for older recipes without one.
- **Auto-approval:** Yes, per the user's instruction. No unresolved product
  decision blocks execution.
- **AI necessity:** AI remains appropriate for proposing a short teaser and
  semantically condensed preparation text. Reuse Recipe Analyze v11 and the
  existing `recipe-analyze` quota. Add no prompt, schema, quota key, or mobile
  AI call. AI text remains advisory until explicit user review and
  confirmation.
- **Domain risk:** No nutrition, calorie, or health recommendation changes.
  If AI cannot provide a reliable time or difficulty, leave it blank and
  require a valid user value. Do not add defaults or a new difficulty
  classification.

## 2. Recommended Product Behaviour

Export fields are absent from the ordinary create/edit recipe preview. When
the user taps `Teilen`, the share flow displays a preparation state, resolves
an available export draft, and then opens the editable share preview. If an
AI call is needed, show this German notice alongside the loading indicator:

> Ich passe die Texte eben an, damit sie auf die Bilder passen. Bitte prüfe,
> ob die Texte passen, bevor du sie teilst.

When no new AI call is needed, show a short generic status such as
`Exportvorschau wird vorbereitet.` Do not claim that AI is running on a cache
hit. Do not add an artificial delay solely to keep the status visible.

For a new recipe, keep the existing Recipe Analyze suggestion transient until
the user reviews it in Share. For an existing recipe without a confirmed
export view, the explicit Share action starts the existing V2 preparation
request. In both cases the user can edit the export fields in the share
preview and must confirm valid values before they are persisted and rendered.

The accepted 2026-10-01 decision remains controlling: a present stale
`exportView` counts as available and can be shared. Its stale status does not
cause an AI call, block the flow, or require reconfirmation. A user edit and
explicit confirmation refreshes the server-owned fingerprint.

## 3. Feature Summary

Move the editable export view from the recipe wizard's `Exportansicht` tab into
the recipe Share preview. Preflight on Share uses, in order:

1. The recipe's existing confirmed `exportView`, whether its status is
   `current` or `stale`.
2. An unconfirmed text-only suggestion retained in local navigation state from
   the current new-recipe analysis, if present.
3. The existing authenticated V2 preparation endpoint when neither source is
   available.

The share preview displays the teaser, time, difficulty, export steps, and
included-ingredient selection as editable fields. After explicit confirmation,
the existing recipe update persists the export view; the existing share-bundle
endpoint then renders the Instagram/detail PNG pair. Subsequent Share actions
reuse the confirmed view and do not call AI again.

## 4. Current Behaviour

- `RecipeWizardPreviewPhase` has separate `Rezeptvorschau` and
  `Exportansicht` tabs. The export tab displays and edits teaser, time,
  difficulty, export steps, and ingredient selection, and exposes explicit
  confirmation.
- `RecipeWizardScreen` retains the Recipe Analyze export suggestion and only
  sends `exportView` with `exportViewAction: 'confirm'` when the export draft
  was explicitly confirmed. An ordinary recipe save can omit both fields.
- Existing recipes without an export view can be prepared from the wizard by
  an explicit action. `POST /api/recipes/{id}/export-view/prepare` uses strict
  request V2, returns transient text fields, uses `recipe-analyze` quota, and
  does not persist the suggestion.
- `RecipeDetailScreen` opens the existing Instagram options sheet on Share.
  Confirming it calls `share-bundle` immediately. The returned image preview
  contains the two PNGs but no editable export fields. `MISSING_EXPORT_VIEW`
  currently displays a notice that navigates back to the wizard.
- The backend confirmation contract and `exportView` persistence already
  exist. The share-bundle endpoint requires a confirmed view, reads recipe and
  image data server-side, permits stale views, and does not call AI.
- The 2026-10-02 detail-image follow-up keeps measured German wrapping,
  `1080 x 1350` dimensions, ingredient/step limits, and field-specific
  overflow failures. Difficulty remains available to the Instagram metadata
  renderer but is omitted from the detail PNG.

## 5. Desired Behaviour

1. No export fields, export tab, or export confirmation action are visible in
   the ordinary recipe create/edit preview.
2. Tapping Share immediately enters a guarded preparation state before the
   share options and editable preview. Double taps do not start duplicate
   preparation or render requests.
3. A complete stored export view is reused without AI, including when stale.
   A new recipe's in-memory analysis suggestion is reused without another AI
   call. An existing recipe with neither source calls V2 preparation once.
4. The preparation state shows an explanatory message rather than a bare
   spinner. The AI-specific copy above is shown only when the provider is
   actually being called.
5. The share preview shows the export text and metadata and allows the user to
   edit them there. The existing tag, highlight, and crop controls remain
   available as separate presentation options.
6. The user explicitly confirms a valid export draft before the bundle is
   rendered. Confirmation persists only the export fields; it never copies
   export teaser/steps over the ordinary recipe description or steps.
7. After successful confirmation, the existing bundle renders the pair
   atomically. A later Share action reuses the stored view. A render retry,
   crop change, or tag/highlight change does not call AI.

## 6. Scope

- Remove the `Exportansicht` tab and its fields/actions from
  `RecipeWizardPreviewPhase`; retain the ordinary recipe preview and save.
- Retain the new-recipe AI suggestion as a transient draft through
  wizard-to-detail navigation. Resolve included analysis keys to saved
  ingredient IDs in Mobile only when the mapping is unique and confirmed.
- Move the export editor and existing export-field validation into the Share
  preview.
- Add Share preflight, preparation/loading/error states, local draft reuse,
  explicit confirmation, and sequencing of existing API calls.
- Keep the existing share-bundle, paired PNG, crop, tag/highlight, local album,
  retry, rollback, and Android native one-call behavior.
- Update Knowledge Base pages that currently describe the export wizard tab
  and old missing-view detour.
- Add focused Mobile tests and QA coverage for the new lifecycle.

## 7. Out of Scope

- No new Backend route, request/response contract, AI prompt, Structured Output
  schema, quota key, or prompt version.
- No change to `RecipeExportViewInput`, the fingerprint algorithm, Cosmos
  document shape, container, or partition key.
- No change to the October 1 no-stale-gate decision, V2 text-only preparation
  contract, or ETag-free client behavior.
- No image-template redesign, PNG persistence, direct Instagram upload,
  Google Photos integration, or local media permission change.
- No native module, config plugin, `app.config.js`, or `react-native-share`
  change. The existing Android U-1 device/transport gate is not repeated or
  claimed as passed by this UX follow-up.
- No iOS acceptance or device gate; the latest approved US-10 scope remains
  Android-only.

## 8. Confirmed Facts and Source Conflicts

### Controlling sources

- Current implementation is authoritative for current behaviour.
- The 2026-10-01 focused plan
  `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md`,
  its QA report
  `docs/qa/reports/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md`,
  the current recipe/API Knowledge Base, and current code control the
  stale-share and ETag semantics.
- The 2026-10-02 detail-image plan and QA pass remain in force for renderer
  constraints; this follow-up does not change them.

### Historical conflicts

- The original User Story and earlier canonical US-10 plan describe export
  editing in the wizard and no AI call on Share. The user's current request
  intentionally changes that UX.
- The original plan still contains a pending-approval header and older
  preparation/ETag/stale-gate wording. Later dated approvals and the current
  implementation supersede those historical statements. The current handler
  accepts stale confirmed views and the V2 preparation client does not require
  or compare `sourceEtag`.
- `docs/kb/tech/03-mobile.md` and
  `docs/kb/product/05-ux-patterns.md` still describe the wizard export tab and
  the `MISSING_EXPORT_VIEW` return-to-wizard path. F-3 must replace those
  descriptions after implementation.
- Do not edit the immutable User Story or rewrite historical QA reports to
  resolve these conflicts. This dated follow-up is the current plan for the
  requested UX delta.

## 9. Persistence, API, and Compatibility

### Persistence impact

The recipe document shape does not change. Existing optional
`Recipe.exportView` remains the only persisted export object. Legacy documents
without it remain readable. There is no backfill, migration, new container,
partition-key change, `cosmos.ts` change, or `cosmos.bicep` change.

New-recipe `exportSuggestion` and existing-recipe preparation results remain
transient until explicit user confirmation. The confirmed export is written
through the existing `PUT /api/recipes/{id}` request pair
`exportViewAction: 'confirm'` plus `exportView`. The server continues to
validate ingredient IDs, compute `sourceFingerprint`, and use internal
compare-and-replace. Ordinary recipe updates that omit the pair continue to
preserve an existing export view.

### API impact

No public API contract changes are required. Use the existing sequence:

- Missing legacy view: `POST /recipes/{id}/export-view/prepare` with exactly
  `{ "contractVersion": 2 }`; review/edit; `PUT /recipes/{id}` with the
  confirmation pair; then `POST /recipes/{id}/share-bundle`.
- Existing confirmed view: review/edit; omit the PUT when unchanged; otherwise
  confirm through the same PUT; then call the same bundle route.
- New recipe with a transient analyzer suggestion: do not persist it in the
  initial create request; review/edit and confirm through the same PUT before
  calling the bundle route.

Mobile does not require `If-Match` or a matching `sourceEtag`. Keep the
accepted internal write-race response `412 recipe_revision_conflict`; do not
merge or automatically retry a confirmation. The bundle continues to reject
missing views, use current recipe fields and server-loaded ingredient IDs, and
return neither image unless both renders succeed.

### Compatibility and security

- Older clients continue using the same API routes and request shapes.
- Mobile passes no title, nutrition, owner, image URL, or client fingerprint
  into the renderer. Backend authentication and user-scoped recipe lookup are
  unchanged.
- The preparation response remains text-only. Do not add ingredient-name or
  AI-key matching for existing recipes. Persisted IDs are validated against
  the current authenticated recipe by the Backend.
- A preparation 429, 422, 502, network failure, or confirmation conflict must
  not start bundle rendering or silently persist an unreviewed suggestion.

## 10. Existing Components to Reuse

- `recipeWizardExportView.ts` and shared `recipeExport.ts` limits for current
  export validation and serialization.
- `recipeWizardEditBootstrap.ts` for text-only preparation mapping and legacy
  ingredient-selection defaults where applicable.
- `recipeApi.prepareExportView`, `recipeApi.update`, and
  `recipeApi.renderShareBundle` without changing their public contracts.
- `RecipeInstagramOptionsSheet`, `RecipeInstagramPreview`,
  `recipeShareDraftState`, and `RecipeDetailScreen` for share options, paired
  preview, revisions, crop, and media handoff.
- App-owned `InfoOverlay`, theme tokens, and existing error/retry patterns.

Do not add a second global cache or a parallel share-bundle implementation.
Keep the pending, unconfirmed suggestion in screen/navigation-local state only;
reuse it while the current detail screen remains mounted. If the screen is
destroyed before confirmation, the suggestion is intentionally discarded and
a future Share action may prepare it again.

## 11. Proposed Technical Solution

### A. Remove wizard export UI without losing the existing suggestion

- Keep the current Recipe Analyze response and its `exportSuggestion` in
  `RecipeWizardScreen` state, but do not render it in ordinary recipe preview
  and do not set `exportDraft.confirmed` implicitly.
- On new-recipe save, omit both `exportView` and `exportViewAction` from
  `POST /recipes`. Pass a compact serializable pending draft to
  `RecipeDetail` navigation state. Include teaser, nullable time/difficulty,
  ordered text steps, and only ingredient IDs that the existing resolver maps
  uniquely to user-confirmed, non-seasoning saved ingredients. Never pass
  `analysisKey`, candidates, or a client fingerprint as persisted/API fields.
- An unresolved or colliding analysis selection remains unselected and must
  be resolved by the ingredient selector in Share; do not choose a first
  match or silently include it.
- Recipe editing continues to omit the confirmation pair. An existing
  confirmed view is preserved by the existing ordinary-update semantics.

### B. Preflight and prepare on Share

- Add a guarded `preparing` state to the `RecipeDetailScreen` share lifecycle.
  The Share action checks the loaded recipe and any transient pending draft
  before opening the existing options/editor flow.
- Treat a present `exportView` as available regardless of
  `exportViewStatus`; a stale view does not trigger preparation.
- If there is no stored view but the current create flow supplied a transient
  pending draft, use that draft without another AI call.
- Otherwise call `recipeApi.prepareExportView(recipe.id)` once for this
  unresolved share draft. Keep the strict V2 body, accept the response without
  an ETag prerequisite, and preserve the V2 text-only response. Prevent
  duplicate taps and ignore late results after the user leaves the share flow.
- If preparation returns `null` time or difficulty, leave that field blank.
  The user must complete it before confirmation; do not invent a value or
  automatically make a second AI call.
- For a legacy recipe without saved ingredient IDs, preserve the documented
  default: select all non-seasoning ingredients when the count is at most 20;
  select none above 20 and require the user to select up to 20. Existing V2
  preparation must not map AI keys or names to those IDs.

### C. Editable Share preview and explicit confirmation

- Move the export editor into the Share preview surface. Show the prepared
  teaser, time, difficulty, ordered export steps, and included-ingredient
  selection there. Keep Instagram/detail image labels and distinct
  `1080:1350` previews. Make the field editor scrollable/responsive so the
  controls remain usable with the images on mobile.
- Keep saved tags, the explicit nutrition-highlight toggle, and crop editing
  as existing presentation options. These values do not become part of
  `exportView`.
- Reuse the existing field rules: trimmed teaser of 1-96 characters; positive
  integer time from 1-10080; non-empty single-line difficulty (no new enum or
  arbitrary length limit); 1-5 non-empty ordered steps of at most 90
  characters each; and at most 20 unique IDs belonging to current
  non-seasoning ingredients. Re-number edited steps contiguously. Keep
  renderer measurement and field-specific overflow rejection as the final
  layout gate; never truncate text or return a partial bundle.
- Do not render or enable `Speichern & teilen` while the draft is invalid or
  has unconfirmed edits. The action that accepts the export draft must be
  labelled to communicate both confirmation and preview creation, for
  example `Texte übernehmen & Vorschau anzeigen`.
- For a new or changed draft, call the existing recipe update with only the
  request-only confirmation pair (no unrelated recipe fields). Wait for
  success before calling `share-bundle`. For an unchanged stored view, do not
  write it again. If the user edits fields after seeing the image pair, mark
  that pair as not ready for sharing until the edited values are confirmed and
  a replacement pair succeeds.
- On a render failure, retain the last complete pair for display but keep
  sharing disabled until a successful render matches the confirmed draft.
  Render retry, crop retry, and presentation-option changes must not call AI.

### D. Loading, failure, and recovery

- Every Share entry shows an explicit preparation state before the editor;
  use `Exportvorschau wird vorbereitet.` when no provider call is needed.
- While `prepareExportView` is in flight, show the AI-specific user notice
  quoted in Section 2 with an activity indicator. Do not show only a spinner.
- A preparation failure keeps the draft unconfirmed and offers an explicit
  retry through app-owned German error UI. A retry is one user-triggered
  preparation request; quota exhaustion remains the existing `recipe-analyze`
  429 contract. Do not render images after preparation failure.
- A `MISSING_EXPORT_VIEW` bundle response is recovered inside Share by
  restarting preflight/preparation once, not by navigating to the wizard.
  Avoid an automatic retry loop.
- A `recipe_revision_conflict` during confirmation reloads the current recipe
  and returns the user to review. Do not merge a stale draft or retry the PUT
  automatically. Keep the existing internal compare-and-replace guard.
- Closing before confirmation does not persist the suggestion. Keep a
  successful unconfirmed preparation in local detail-screen state so reopening
  Share in the same mounted screen does not call AI again. A confirmed view
  naturally survives screen/app restarts in the existing recipe document.

## 12. Frontend Work Package

### F-1: Remove the wizard export tab and retain a transient suggestion

**Agent:** Frontend

**Goal:** Hide export fields from ordinary recipe create/edit review while
preserving any new-recipe analyzer suggestion as a small, unconfirmed
navigation-local draft for the Share flow.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
- `mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx`
- `mobile/src/modules/recipes/recipeWizardExportView.ts`
- `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`
- `mobile/src/modules/recipes/recipeWizardNavigation.ts`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/shared/api/recipeApi.ts`
- `shared/types/recipeExport.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1, AC-3, AC-7

**Dependencies:** None.

**Expected Handoff:** The normal recipe preview has no export tab, export
inputs, or export-confirm button. Recipe save omits the confirmation pair
unless a later Share action explicitly confirms it. A serializable transient
new-recipe suggestion contains no AI keys or client fingerprint, and ordinary
editing continues to preserve an existing saved export view.

### F-2: Add Share preflight, editable export review, and confirmation

**Agent:** Frontend

**Goal:** Resolve or prepare export fields on Share, expose them in the share
preview, preserve validation, explicitly persist edits, and render/share only a
complete bundle for the confirmed draft.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
- `mobile/src/modules/recipes/recipeShareDraftState.ts`
- `mobile/src/modules/recipes/RecipeInstagramOptionsSheet.tsx`
- `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`
- `mobile/src/modules/recipes/recipeShareRenderNotice.ts`
- `mobile/src/modules/recipes/recipeWizardExportView.ts`
- `mobile/src/shared/api/recipeApi.ts`
- `mobile/src/shared/api/recipeInstagramRenderContract.ts`
- `shared/types/recipeExport.ts`
- `mobile/src/shared/components/InfoOverlay.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-2 through AC-9

**Dependencies:** F-1 handoff and its finalized pending-draft/navigation shape.
The API contracts in Section 9 are fixed inputs; no Backend contract change is
expected.

**Expected Handoff:** Share preflight and error states; editable validated
export draft; explicit confirmation before persistence/render; guarded atomic
bundle preview; preserved tag/highlight/crop/media flow; focused Mobile tests.
Report any mismatch with the existing V2 preparation, PUT confirmation, or
share-bundle contracts to the Orchestrator without inventing a new API shape.

### F-3: Update Knowledge Base descriptions

**Agent:** Frontend

**Goal:** Document the implemented Share-triggered review and remove stale
descriptions of the export wizard tab and return-to-wizard missing-view path.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/tech/09-api-reference.md`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1 through AC-9, AC-11

**Dependencies:** F-1 and F-2 handoffs. Document only behavior verified in
those handoffs. The API reference needs no contract edit unless implementation
actually changes a request or response shape; any such deviation returns to
the Orchestrator for replanning.

**Expected Handoff:** Updated recipe, AI-workflow, mobile, and UX-pattern
descriptions that distinguish transient preparation from confirmed
`exportView`, document stale-view reuse, and preserve existing API and
native-share constraints.

## 13. QA Work Package

**Agent:** QA

**Goal:** Verify the complete new share-entry/review/confirmation flow,
backward-compatible recipe editing, existing bundle behavior, and Knowledge
Base accuracy against AC-1 through AC-11.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- Mobile implementation and tests listed in F-1 and F-2
- `backend/src/functions/recipes.ts` and `backend/src/functions/recipes.test.ts`
- `backend/src/functions/instagramRecipe.ts` and `backend/src/functions/instagramRecipe.test.ts`
- `backend/src/lib/recipeValidation.ts`
- `backend/src/lib/repositories/recipeExport.ts`
- `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md`
- `docs/qa/reports/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md`
- `docs/qa/reports/PLAN_US-10_Detailbild_Textumbruch_2026-10-02.md`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:** AC-1 through AC-11

**Dependencies:** F-1, F-2, and F-3 are complete. No direct Azure or remote
Cosmos access is allowed. The existing Android U-1 device gate is not claimed
or re-run by this focused UX review.

**Expected Handoff:** Durable report at
`docs/qa/reports/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md` using
`fittrack-qa-v1`, with every AC in the criteria matrix, exact test commands and
results, and any Cosmos/Android verification limits recorded as
`UNVERIFIED` or `MANUAL VALIDATION REQUIRED`, not as findings.

## 14. Infrastructure and Configuration

- No Bicep, Cosmos container, app setting, Azure Function route, or deployed
  resource change is planned.
- Backend API code and the Android native-share adapter are unchanged.
- `Infrastructure Impact: None` and `Mobile Build Impact: None` apply to this
  follow-up. Infrastructure & Release does not need a feature work package.
- No Dev Build, deployment, or Alpha release is authorized by this plan. The
  existing post-QA Android U-1 gate and its `UNVERIFIED` status remain governed
  by the prior US-10 release handoff.

## 15. Documentation Updates

F-3 updates only documents whose described behavior changes:

- `docs/kb/tech/03-mobile.md`: remove the wizard `Exportansicht` tab behavior;
  describe transient suggestion handoff and Share review.
- `docs/kb/product/05-ux-patterns.md`: replace the options-first/missing-view
  return-to-wizard description with Share preflight, AI status copy, editable
  review, confirmation, and retry behavior. Keep tag/highlight/crop and
  downstream media behavior.
- `docs/kb/domain/06-recipes.md`: document when the existing export view is
  present, missing, stale, or confirmed, and the unchanged V2/PUT/bundle data
  contracts.
- `docs/kb/domain/07-ai-features.md`: clarify that the same analyzer output is
  transient until review and that legacy recipes can invoke the existing
  `recipe-analyze` preparation on explicit Share.
- `docs/kb/tech/09-api-reference.md`: no change unless implementation
  actually changes an API request or response shape.

## 16. Test Strategy

### Mobile

- Replace the wizard-preview test that expects an `Exportansicht` tab with
  assertions that export inputs/actions are absent and ordinary recipe preview
  remains available.
- Cover pending analyzer suggestion reuse, unique ID resolution, unresolved
  selection handling, and omission of export fields from ordinary create/edit
  requests.
- Cover preflight source selection: stored current view, stored stale view,
  transient new-recipe suggestion, and legacy missing-view preparation.
- Cover one V2 preparation call for repeated taps, visible explanatory loading
  state, local reuse after dismissal/reopen while mounted, and no provider call
  for a complete stored view or the transient suggestion.
- Cover editable export fields, existing length/time/step/ingredient
  validation boundaries, nullable AI time/difficulty remaining blank, no
  render or persistence before explicit confirmation, and successful
  confirmation followed by one bundle request.
- Cover AI 429/422/502/network failure, confirmation 412, bundle failure,
  render retry without AI, dirty-preview invalidation, and recovery from a
  missing-view response without navigating to the wizard.
- Retain regression coverage for tags, highlight, crop, atomic distinct PNG
  previews, media retry/rollback, and exactly one mocked Android native
  `Share.open({ urls: [...] })` call with both URIs.

### Backend/API regression

- No Backend implementation or prompt evaluation is planned. Run the existing
  focused `recipes.test.ts` and `instagramRecipe.test.ts` suites to verify the
  V2 prepare, explicit confirmation, quota ordering, stale-share allowance,
  server-owned ingredient IDs, and atomic bundle contracts used by Mobile.
- Do not change Recipe Analyze v11 prompt/schema. The previously passed scoped
  v11 evaluation remains applicable; rerun it only if implementation changes
  the prompt or Structured Output, which is outside this plan.
- If the local Cosmos emulator is available, run the existing repository
  contract suite. If unavailable, report persistence contract execution as
  `UNVERIFIED`; do not access Dev or Alpha Cosmos. No migration test is
  required because the document shape is unchanged.

### Required commands

From the package directories:

```text
mobile/: npx vitest run
mobile/: npx tsc --noEmit
backend/: npx vitest run src/functions/recipes.test.ts src/functions/instagramRecipe.test.ts
backend/: npx vitest run --config vitest.contract.config.mts  (only when local emulator is available)
```

## 17. Acceptance Criteria

- **AC-1:** The normal create/edit recipe preview has no `Exportansicht` tab,
  export text inputs, ingredient export selector, or export-confirm action.
  Its ordinary recipe fields, ingredient/step review, and recipe save remain
  usable. Ordinary save omits both confirmation fields; an existing stored
  `exportView` is preserved by an ordinary update.
- **AC-2:** Every Share tap enters a guarded preparation state before the
  editable share preview. While that state is pending, another Share tap
  cannot start a duplicate request. The state shows explanatory text rather
  than only an activity indicator. If preparation calls AI, the UI displays
  the exact German notice in Section 2; on reuse/cache hit it shows generic
  preparation text and does not claim AI is running.
- **AC-3:** A complete stored `exportView` is reused without preparation,
  regardless of `exportViewStatus`. A transient suggestion from the current
  new-recipe analyzer flow is reused without a second call. A recipe with
  neither a stored view nor a transient suggestion calls the existing V2
  preparation endpoint once. The user can close and reopen Share on the same
  mounted detail screen without another preparation call. A confirmed view is
  reused on later Share actions, including after app restart.
- **AC-4:** The share preview displays editable teaser, total time, difficulty,
  ordered export steps, and included-ingredient selection. Export texts are
  not copied into normal recipe description or steps. Existing tags, highlight,
  crop, and paired-image labels remain available in the share flow.
- **AC-5:** Client validation preserves the established contract: teaser
  1-96 trimmed characters; time is an integer from 1-10080; difficulty is
  non-empty and single-line without a new enum or arbitrary maximum; there are
  1-5 ordered, non-empty steps of at most 90 characters; no more than 20
  unique included IDs; and IDs resolve to current non-seasoning recipe
  ingredients. Null AI time/difficulty values remain blank and block
  confirmation until valid user values are supplied. No text is silently
  truncated, and measured renderer overflow remains a controlled field error.
- **AC-6:** The initial new-recipe export suggestion and existing-recipe
  preparation response are not persisted before review. A valid draft is saved
  only after an explicit confirmation action using the existing PUT pair
  `exportViewAction: 'confirm'` and `exportView`. A stored unchanged view is
  not rewritten. The client sends no `sourceFingerprint` or required
  `If-Match`; the Backend computes the fingerprint and retains its internal
  compare-and-replace guard.
- **AC-7:** No bundle request is issued before a missing/new/edited export draft
  is valid and confirmed. A failed confirmation does not render or share. On
  success the existing share-bundle renders only the confirmed export data
  with current server-loaded recipe fields and returns both images or neither.
- **AC-8:** Editing export values after a rendered pair marks that pair
  ineligible for `Speichern & teilen` until the edited values are explicitly
  confirmed and a successful replacement pair is ready. A render failure
  retains the last complete pair for display but cannot share stale images.
  Render, crop, and presentation-option retries do not invoke AI.
- **AC-9:** Preparation quota/provider/validation errors and confirmation
  conflicts are recoverable in German app-owned UI. A 429/422/502/network
  failure causes no export write or bundle render. A
  `recipe_revision_conflict` reloads the current recipe for review without
  automatic merge/retry. A defensive `MISSING_EXPORT_VIEW` response recovers
  inside Share and does not navigate to the recipe wizard or create a retry
  loop.
- **AC-10:** Existing downstream US-10 behavior is unchanged: tag order and
  limit, explicit highlight, transient crop, atomic Instagram/detail pair,
  `FitTrack` local album behavior, rollback/retry, and one Android native
  multi-image call remain intact. Automated tests assert one mocked
  `Share.open({ urls: [...] })` call with both distinct local URIs. No Android
  device pass is claimed by this plan.
- **AC-11:** Updated Knowledge Base pages describe the implemented Share
  trigger, transient-versus-confirmed data, stale-view reuse, API sequence,
  and preserved native constraints. Historical User Story/QA artifacts remain
  unchanged.

## 18. Risks and Edge Cases

- **Nullable AI metadata:** V2 time and difficulty can be null. Leave them
  blank and require user completion; do not invent values.
- **Ingredient identity:** V2 preparation intentionally returns no ingredient
  keys or IDs. Existing selection uses saved recipe IDs only; new analyzer
  keys may be mapped only through the existing unique,
  user-confirmed Mobile resolver.
- **Transient draft lifetime:** Unconfirmed suggestions are not stored in
  Cosmos. They survive closing/reopening Share only while the detail screen is
  mounted; after process loss, legacy preparation may run again. This
  preserves the no-unreviewed-AI-persistence rule.
- **Quota:** Share-triggered preparation consumes the existing
  `recipe-analyze` quota only on successful validated AI output. Duplicate
  taps and automatic retry loops could spend quota unexpectedly.
- **Stale views:** Reusing stale values is an accepted prior decision. The user
  sees them in the share editor and may explicitly edit/confirm them; do not
  reintroduce a stale gate.
- **Image/text consistency:** A rendered pair must correspond to the exact
  confirmed draft and presentation options. Any edit invalidates readiness
  until the replacement pair succeeds.
- **Historical release evidence:** Cosmos contract execution and real Android
  U-1 behavior remain separately `UNVERIFIED` from prior US-10 work. This
  follow-up does not upgrade either status.

## 19. Recommended Execution Order

All work proceeds sequentially:

1. **Frontend F-1:** Remove the wizard export tab and preserve the transient
   new-recipe suggestion for Share.
2. **Frontend F-2:** Implement Share preflight, editable export review,
   validation, explicit confirmation, render sequencing, and error recovery.
3. **Frontend F-3:** Update the scoped Knowledge Base descriptions to match the
   verified implementation.
4. **QA:** Run the required Mobile tests/typecheck and focused Backend API
   regression tests; review all ACs and documentation; report environment
   limitations without claiming Android device validation.

No Backend implementation, Shared package change, Infrastructure work
package, schema migration, build, or deployment is required for this plan.
</details>
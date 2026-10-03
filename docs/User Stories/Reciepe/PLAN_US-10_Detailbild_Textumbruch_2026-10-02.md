# Focused Plan: US-10 Detail-Image Presentation Follow-up

Status: Standalone detail-PNG follow-up. Existing export simplification and stale-gate plans remain unchanged.

Infrastructure Impact: Dev
Mobile Build Impact: None

## Assessment

- Classification: Accept as requested. No Product Owner decision is needed.
- Hide difficulty only from the detail image. Keep `exportView.difficulty`, its API and adapter flow, and the existing Instagram metadata unchanged.
- Current cause: `recipeDetailsTemplateV3.ts` sets `wordBreak: "break-all"` on title, teaser, ingredient, and preparation text. `render.ts` already probes rendered bounds and fails closed on overflow.
- The lockfile pins Satori 0.33.4 with generic `linebreak`; the repository has no German hyphenation stage. Satori's normal line wrapping can handle word boundaries, but it does not infer German syllable breaks; Resvg rasterizes the SVG after layout. Use normal word wrapping first, then a deterministic German-pattern preprocessing step only for a word that cannot fit intact. Do not hand-roll syllable heuristics. Measure each emitted line with the production font, including the visible `-`; if no valid split fits, return the existing field-specific overflow failure. Add a dependency only if the regression case requires it, and verify its current stable version and license before adoption.

## Backend Work Package

**Agent:** Backend

**Goal:** Omit the difficulty chip from the detail PNG and make all visible text wrap at word boundaries or valid German hyphenation points without clipping or overflow.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts`
- `backend/src/lib/instagramRenderer/render.ts` and `types.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1 through AC-4

**Dependencies:** None

**Expected Handoff:** Renderer change, regression tests, and updates to `docs/kb/tech/02-backend.md` and `docs/kb/domain/06-recipes.md`. No API, persistence, mobile, or Instagram-renderer contract change.

## QA Work Package

**Agent:** QA

**Goal:** Verify AC-1 through AC-4 using focused tests and backend build verification; render and visually inspect renderer fixtures where practical.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/instagramRenderer/`
- `backend/package.json`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1 through AC-4

**Dependencies:** Backend work package complete, including regression tests and Knowledge Base updates.

**Expected Handoff:** QA report with per-criterion evidence, exact commands and results, and any unavailable visual checks clearly noted.

## Acceptance Criteria
## Acceptance Criteria

- **AC-1:** The detail PNG never displays a difficulty chip, whether difficulty is present or absent. Portions, time, and ingredient count remain. The confirmed difficulty value is still persisted and supplied to the existing Instagram metadata renderer.
- **AC-2:** Title, teaser, metadata, ingredient amount/name, preparation text, and other visible text never break inside a word without a valid German hyphenation point. For the reported example, `Vorteig` stays whole or breaks as `Vor-` / `teig`; `Vort` / `eig` is rejected.
- **AC-3:** Any inserted hyphen is included in the production-font line-width measurement. Every text block stays inside its assigned width and height; no clipping, overpainting, or partial image is returned. If no legal break fits, the detail export fails with a field-specific error.
- **AC-4:** Existing output dimensions, ingredient/step capacities, normal recipe data, and Instagram metadata remain unchanged. Regression coverage includes the populated-difficulty case, the reported word-wrap case, a forced German compound break, and measured boundary/overflow cases.

## Verification

From the repository root:

```sh
npm run test --workspace=backend -- src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts src/lib/instagramRenderer/recipeAdapter.test.ts src/lib/instagramRenderer/__tests__/recipe-meta.test.ts
npm run test --workspace=backend
npm run typecheck --workspace=backend
npm run build:verify --workspace=backend
npm run render:gefluegelfrikadellen-details-template --workspace=backend
npm run render:twenty-ingredients-details-template --workspace=backend
```

A local Satori runtime probe was unavailable during planning because backend dependencies are not installed; the first implementation check should confirm natural word wrapping with the production font before adding any hyphenation dependency.
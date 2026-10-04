# Instagram Share Bundle: Long Serving Labels

Status: approved 2026-10-03.
Infrastructure Impact: None.
Mobile Build Impact: None.

Deterministic backend-local bugfix without AI. No unresolved product decisions.

## Findings

- `recipeAdapter.ts` concatenates `inputAmount` and `unit`, producing '3 1 portion (10 g)' (18 chars).
- `render.ts` `validateRecipeDetailsTemplate` rejects amounts exceeding 16 before existing font-based layout validation.
- Prior Alpha observations not re-queried.
- KB describes measured wrapping/overflow but not this preliminary length limit.

## Solution

Remove only fixed 16-character amount rejection, retain full labels and existing width/height checks. No shortening, translation, new rounding or parsing/conversion of label strings. Long labels succeed only when actually fitting; geometric overflow remains field/ingredient-specific error. Empty amounts, line breaks, other field limits, fonts, dimensions unchanged.

## Scope

Amount validation in details renderer, existing adapter/renderer tests, focused KB addition, QA.

Out of scope: mobile, API shapes, nutrition calculation, Cosmos docs/migrations, dependencies, layout redesign. No deployment, EAS build, installation, Azure access/mutation. Preserve unrelated concurrent changes, separate them from handoff.

## Acceptance Criteria

- AC-1: Before production fix add regression with seven ingredients and amount '3 1 portion (10 g)' at index 6, expecting PNG success; demonstrate failure `INVALID_TEMPLATE_INPUT` and record Red.
- AC-2: Same regression passes after fix using real renderer, production fonts, versioned offline image; PNG 1080x1350 without overflow.
- AC-3: Adapter tests preserve full portion labels, ordinary units g/Stück/Dose, decimal formatting, existing grams fallback; recipe/nutrition unchanged.
- AC-4: Tests distinguish fitting label >16 from genuine width/height overflow returning `TEMPLATE_FIELD_OVERFLOW` with ingredient detail; empty/multiline amounts invalid.
- AC-5: Existing details tests including 20-ingredient layout pass, focused tests, backend units and `build:verify` pass.
- AC-6: KB documents full amount labels without 16-char limit, unchanged geometric checks; QA verifies.
- AC-7: No excluded operations or data changes; separate own modifications from concurrent development; unrelated failures reported separately.

## Recommended Execution Order

1. Approved plan persist before orchestration.
2. Backend baseline -> regression/Red -> minimal fix -> focused Green -> KB.
3. QA all criteria/report -> handoff only, no release.

## B-1

Agent: Backend.

Goal: Reproduce AC-1 first then correct only amount-length validation/document.

Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- `backend/src/lib/instagramRenderer/recipeAdapter.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.test.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`

Required Skills: None.

Relevant Acceptance Criteria: AC-1..AC-7.

Dependencies: Approved plan, coordinate overlapping edits before editing.

Expected Handoff: Own files/hunks, Red/Green evidence, commands/exit codes, KB update, unrelated errors separately.

Focused from `backend`:

```sh
npm test -- src/lib/instagramRenderer/recipeAdapter.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts
```

## Q-1

Agent: QA.

Goal: Verify regression, semantics/layout protections, docs/scope against all criteria.

Required Knowledge Base:
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- B-1 files/handoff
- `backend/package.json`
- `docs/qa/reports/README.md`
- `backend/src/functions/instagramRecipe.test.ts` for atomic failure behavior

Required Skills: None.

Relevant Acceptance Criteria: AC-1..AC-7.

Dependencies: B-1 including documented Red; QA need not reenact chronological test-first sequence.

Expected Handoff: Durable `docs/qa/reports/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md` format `fittrack-qa-v1`, criteria matrix/evidence/unique verdict, response manifest path/verdict.

Checks from `backend`: Focused, `npm test`, `npm run build:verify` (local compile only); coordinate conflicts on shared generated outputs and do not overwrite foreign artifacts. Alpha E2E explicitly unverified.
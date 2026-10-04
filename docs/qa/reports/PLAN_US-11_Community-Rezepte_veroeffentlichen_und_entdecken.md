# QA Report: US-11 Community Recipes: Publish and Discover - Correction Re-review

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Reciepe/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`
- Verdict: `PASS`

## Scope

Reviewed all 17 acceptance criteria, the approved Scope and Out of Scope, and the original story. Evidence for unchanged criteria is carried forward from the first Q-1 review; corrections 052 and 054 were checked in their implementation and tests, and correction 053 was checked against the current plan. The approved scope and requirements are unchanged.

The plan now records B-1, B-2, F-1, F-2, and D-1 complete, Q-1's earlier review complete, the correction loop in progress, and I-1 gated/pending. No stale D-1 "next/not started" status remains. The plan's D-1 documentation handoff is present in the listed US-11 API, domain, authentication, and product Knowledge Base documents. No scope expansion was found: recipe copying, public anonymous access, moderation/admin UI, new AI behavior, new Azure resources, and native dependencies remain out of scope. Cosmos data-model review is carried from the first Q-1 review: optional/read-compatible fields use existing containers and `/userId`; no container, partition-key, or migration change is planned. Contract validation remains unverified below.

The active Instagram-renderer worktree changes were not assessed as US-11 and were not modified. QA did not edit `docs/qa/findings.md`.

## Prior Finding Re-review

| Finding | Result | Evidence |
|---|---|---|
| FT-QA-2026-052 | VERIFIED | `QuantityView.tsx` uses `resolveRecipeQuickEntryPortions`; `recipeUtils.test.ts` verifies 450 g becomes 1.5 portions for a 300 g recipe portion, 150 g becomes 0.5 portions using the existing 300 g fallback, and a portion preference is preserved exactly. |
| FT-QA-2026-053 | VERIFIED | The plan records D-1 complete and I-1 gated/pending. A search of the plan found no remaining D-1 "next/not started" status. Approved scope and acceptance criteria are unchanged. |
| FT-QA-2026-054 | VERIFIED | `RecipeDetailScreen.test.tsx` verifies one `Veröffentlichen` action, unchecked-by-default name consent, false/true request values, cancellation without either API request, and consent reset. `ConfirmSheet.test.tsx` verifies accessible checkbox role, label, and checked state. |

The detailed entries for FT-QA-2026-052/053/054 in `docs/qa/findings.md` currently say `Resolved` pending QA, while their index rows still say `Awaiting decision`. QA did not change the register; the index/detail status mismatch is left for its owner to reconcile.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS (carried) | Owner-first tabs and community pagination are covered by `mobile/src/modules/recipes/RecipeListScreen.test.tsx`. |
| AC-2 | PASS (carried) | Owner list/status rendering is covered by `RecipeListScreen.test.tsx`; owner recipe reads remain scoped in `backend/src/functions/recipes.ts`. |
| AC-3 | PASS (carried) | Private-by-default creation and rejection of publication fields on ordinary writes are covered by `backend/src/functions/recipes.test.ts` and `backend/src/lib/repositories/recipesRepository.test.ts`. |
| AC-4 | PASS (carried) | Missing/unknown legacy visibility resolves to private in `backend/src/lib/repositories/recipesRepository.test.ts` and `backend/src/lib/repositories/recipePublication.ts`. Cosmos contract verification remains UNVERIFIED below. |
| AC-5 | PASS (carried) | Owner-only visibility writes, ETag conflicts, and foreign mutation denial are covered by `backend/src/functions/recipes.test.ts`; owner UI conflict recovery is covered by `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx`. |
| AC-6 | PASS (re-reviewed) | `RecipeDetailScreen.test.tsx` verifies the disclosure of texts, ingredients, preparation, and images; one explicit publish action; and no publication request when cancelled. Server confirmation validation is covered by `backend/src/functions/recipes.test.ts` (carried). |
| AC-7 | PASS (re-reviewed) | `RecipeDetailScreen.test.tsx` verifies unchecked-by-default consent and false/true payloads; `ConfirmSheet.test.tsx` verifies accessible checkbox state. Current-profile-name/`Anonymous` projection is covered by `backend/src/functions/communityRecipes.test.ts` (carried). |
| AC-8 | PASS (carried) | Authentication, published-only results, limits, and pagination are covered by `backend/src/functions/communityRecipes.test.ts` and `backend/src/lib/repositories/recipesRepository.test.ts`. |
| AC-9 | PASS (carried) | Safe detail projection and authenticated image-byte route are covered by `backend/src/functions/communityRecipes.test.ts`; rendered detail and authenticated image loading are covered by `mobile/src/modules/recipes/CommunityRecipeDetailScreen.test.tsx`. |
| AC-10 | PASS (carried) | Community detail omits owner controls and displays the author in `CommunityRecipeDetailScreen.test.tsx`; owner-only mutations remain protected in `backend/src/functions/recipes.test.ts`. |
| AC-11 | PASS (carried) | Both provenance notices and the non-verification wording are asserted in `CommunityRecipeDetailScreen.test.tsx`; unknown provenance is retained by `backend/src/lib/repositories/recipeIngredientProvenance.ts`. |
| AC-12 | PASS (carried) | Recipe favorites store a reference without nutrition/image caches and remain removable after revocation in `backend/src/functions/favorites.test.ts`; unavailable-favorite removal is covered by `mobile/src/modules/recipes/RecipeListScreen.test.tsx`. |
| AC-13 | PASS (re-reviewed) | `QuantityView.tsx` uses the corrected conversion helper; `mobile/src/modules/recipes/recipeUtils.test.ts` covers gram conversion, the 300 g fallback, and unchanged portion prefills. Current server values and diary snapshots remain covered by `backend/src/functions/recipes.test.ts` and `backend/src/functions/diary.test.ts` (carried). |
| AC-14 | PASS (carried) | `backend/src/functions/recipes.test.ts` asserts diary snapshots remain unchanged after recipe edit, unpublish, and deletion. |
| AC-15 | PASS (carried) | Revoked detail/image/favorite/log access and denied stale quick-entry writes are covered by `backend/src/functions/communityRecipes.test.ts`, `backend/src/functions/favorites.test.ts`, and `backend/src/functions/diary.test.ts`. |
| AC-16 | PASS (carried) | Authenticated community routes, indistinguishable private/missing detail responses, owner-scoped mutations, and current-access recipe logging are covered by `backend/src/functions/communityRecipes.test.ts` and `backend/src/functions/recipes.test.ts`. |
| AC-17 | PASS (carried) | Community detail exposes no copy/manage action; favorite and logging create only a relation or diary snapshot, with no recipe/food copy path in `backend/src/functions/favorites.ts` and `mobile/src/modules/recipes/CommunityRecipeDetailScreen.tsx`. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd mobile; npx vitest run --silent --reporter=dot src/modules/nutrition/hub/FoodEntryHub.test.ts src/modules/recipes/recipeUtils.test.ts src/modules/recipes/RecipeDetailScreen.test.tsx src/shared/components/ConfirmSheet.test.tsx` | 0 | Re-run: 4 files passed; 56 tests passed. |
| `cd mobile; npx vitest run --silent --reporter=dot` | 0 | Re-run: 55 files passed; 597 tests passed. |
| `cd mobile; npx tsc --noEmit` | 0 | Re-run: no TypeScript diagnostics. |
| `npm test --workspace=backend -- --silent --reporter=dot` | 0 | Carried from first Q-1 review; 64 files and 1,223 tests passed. Not rerun because the corrections under review are mobile/plan changes. |
| `npm test --workspace=shared -- --reporter=dot` | 0 | Carried from first Q-1 review; 10 files and 450 tests passed. Not rerun because shared code was not changed in the correction loop. |
| `npm run typecheck` | 0 | Carried from first Q-1 review; backend, shared, and mobile typechecks passed. Mobile was also rechecked above. |
| `npm run build:verify --workspace=backend` | 0 | Carried from first Q-1 review; build verification passed. Azure Functions runtime was unavailable locally, so the SDK used test mode. |
| `node scripts/check-encoding.mjs` | 0 | Carried from first Q-1 review; encoding check passed. |
| `git diff --check` | 0 | Carried from first Q-1 review; no whitespace errors (Git emitted working-copy CRLF normalization warnings). |
| `cd backend; npx vitest run --config vitest.contract.config.mts` | 1 | Not passed: emulator unavailable; 9 suites failed during setup and 83 tests were skipped. No repository contract assertions executed; see UNVERIFIED. |

## Verification Notes

### UNVERIFIED

- State: `UNVERIFIED`
  Reason: Cosmos contract tests require the local emulator at `http://127.0.0.1:18081`, which was unavailable during the first Q-1 run. No repository contract assertions executed; this gate is not reported as passed.
  Prerequisites: Start the local Cosmos emulator using `backend/scripts/start-cosmos-emulator.ps1`.
  Steps: From `backend/`, run `npx vitest run --config vitest.contract.config.mts`.
  Expected result: Contract suites execute against the local emulator, including legacy-shape and two-user partition assertions, without setup failures.
  Result: Pending.
- State: `UNVERIFIED`
  Reason: No two-user Dev or Alpha E2E was executed. No claim is made about deployed authentication, Cosmos pagination, protected blob delivery, or revocation behavior in those environments. No Alpha release/deployment is claimed; I-1 remains gated/pending.
  Prerequisites: A running Dev/Alpha test deployment and two authenticated FitTrack accounts.
  Steps: Account A creates a private recipe and verify B cannot list/open it; A publishes it; B lists, opens, favorites, and logs it; A edits and then revokes/deletes it; B retries the list, old direct URL, image, favorite reference, and new log. Inspect B's pre-revocation diary snapshot afterward. Repeat in Dev and Alpha and record each result.
  Expected result: Access is available only while explicitly published; all new reads/logs fail after revocation, the favorite remains removable, and the existing diary snapshot is unchanged.
  Result: Pending in Dev and Alpha.

### MANUAL VALIDATION REQUIRED

- State: `MANUAL VALIDATION REQUIRED`
  Reason: Physical-device, screen-reader, and enlarged-viewport validation was not run. HealthConnect physical-device sync was not run.
  Prerequisites: iOS and Android devices or equivalent device builds; small and large viewports; enlarged text; TalkBack/VoiceOver; a HealthConnect-capable device and test account.
  Steps: Verify owner/community navigation and return behavior; inspect the publication disclosure; cancel, publish with consent off, and publish with consent on; load a protected image; exercise community detail, favorite, logging, and revoked-state recovery with enlarged text and a screen reader. Verify HealthConnect sync after a successful recipe log and no sync after a rejected write.
  Expected result: Cancellation sends no publication request; name consent is explicit and accessible; text and controls remain usable without overlap; community users see no owner actions; protected images/revocation behave correctly; HealthConnect sync follows only a successful log.
  Result: Pending.

## Findings

No actionable implementation findings remain from this correction re-review. FT-QA-2026-052, FT-QA-2026-053, and FT-QA-2026-054 were verified as corrected. Environment-limited and manual checks remain explicitly unverified above and are not treated as passed.
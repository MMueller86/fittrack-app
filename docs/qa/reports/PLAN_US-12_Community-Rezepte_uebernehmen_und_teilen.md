# QA Report: US-12 Community Recipe Copy

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Reciepe/PLAN_US-12_Community-Rezepte_uebernehmen_und_teilen.md`
- Story reference: `docs/User Stories/Reciepe/US-12_Community-Rezepte_uebernehmen_und_teilen.md`
- Verdict: `PASS`

## Scope

Independent targeted re-review after Backend correction attempt 1, against the explicitly approved current plan and story. Their Draft headers remain unchanged; the current approval in the review request controls. Reviewed AC-1 through AC-10, corrected backend code/tests, mobile list/detail/API/edit tests, shared recipe types, API/domain documentation, image storage safety, account-deletion admission, and privacy-policy consistency.

No deployment, infrastructure change, native build, legal-policy edit, unrelated weights correction, or central findings-register edit was performed. Existing unrelated worktree changes were left untouched.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/functions/communityRecipes.ts` authenticates before repository work and only creates from a currently published source. `backend/src/functions/communityRecipes.test.ts` covers published/private/missing sources and authentication; `mobile/src/modules/recipes/RecipeListScreen.test.tsx` covers copying an own publication and opening the returned ID, while the detail test covers the same copy action. |
| AC-2 | PASS | Handler tests assert the owner-partition read precedes source lookup, existing copies survive unpublish, and the final owner read resolves a concurrent copy when the source is unavailable. Parallel calls return matching `200`/`201` bodies. The handler proceeds from its already-loaded published snapshot without a second publication lookup. |
| AC-3 | PASS | `backend/src/lib/communityRecipeTransfer.test.ts` covers current export time, missing time, stale export fingerprint, and stale copy-time snapshot; only current time is written and the private snapshot receives its own fingerprint. `backend/src/lib/communityRecipes.test.ts` covers current/stale projection and current ownerless preservation. Mobile list/detail tests display only numeric time and omit null/missing values. Transfer construction is an explicit allowlist; no teaser, difficulty, export steps, or private fingerprint is projected. |
| AC-4 | PASS | Transfer tests assert stored ingredient contributions and aggregate nutrition are preserved. `copyPublishedCommunityRecipe()` does not call catalog repositories, nutrition calculators, or AI; it persists via `createSnapshotCopy()`. The regular PUT path retains its existing amount-based contribution and aggregate recalculation behavior. |
| AC-5 | PASS | `backend/src/lib/communityRecipeTransfer.test.ts` verifies foreign `linkedReusableItemId` removal, canonical `openFoodFacts:<digits>` retention, and removal of private/noncanonical product IDs. The copy path creates only a Recipe snapshot; the community DTO remains allowlisted apart from `totalTimeMinutes`. |
| AC-6 | PASS | `backend/src/functions/recipes.test.ts` now parameterizes copied manual, label-scan, unknown, AI, and canonical OFF ingredients through amount change and normal PUT. Assertions cover changed quantity, recalculated contribution/aggregate, retained provenance and AI flag, and null private links. Copy uses stored OFF nutrition without catalog lookup; `nutritionSource` remains absent from public write schemas and preserved server-side. |
| AC-7 | PASS | `backend/src/functions/communityRecipes.test.ts` sequences first copy, completed owner DELETE, published-source content/time change, and recopy. It asserts the same deterministic ID, new snapshot, and removed old Recipe record; there is no persistent idempotency marker. Existing-copy and concurrent-create behavior are also covered. |
| AC-8 | PASS (code/tests) | `backend/src/lib/storage.ts` uses deterministic owner paths and `If-None-Match: *`; `backend/src/lib/storage.test.ts` verifies matching type/bytes are reused, mismatches fail, and conflict/error paths never delete targets. Handler tests prevent Recipe commit when source image reads fail. Azure Soft Delete same-path recreation remains a separate manual gate. |
| AC-9 | PASS | Copy reads only the JWT-sub owner partition and returns `{ recipeId }`; the snapshot excludes foreign private links and no other community fields are added. Account-deletion selection/flow and the privacy policy are unchanged; ownerless preservation carries only the current time snapshot/fingerprint described by the plan. No policy file was modified. |
| AC-10 | PASS | `backend/src/functions/communityRecipes.test.ts` verifies the normal authentication path returns `409 PROFILE_DELETION_IN_PROGRESS` before owner/source reads or image writes. No deletion lock, lifetime, or late-write behavior changed. |

## Correction Attempt 1

- Resolved `US12-QA-01` / `FT-QA-2026-149` (AC-3): the private-copy transfer table now covers current, absent, stale export-view, and stale copy-time snapshots; the copied time is retained only when current and is fingerprinted against the sanitized private copy. Projection and mobile tests cover shown/hidden values.
- Resolved `US12-QA-02` / `FT-QA-2026-150` (AC-6): the normal PUT regression now covers manual, label-scan, unknown, AI, and canonical OFF provenance after copy-link removal, including amount, contribution, aggregate, provenance, AI flag, and link assertions.
- Resolved `US12-QA-03` / `FT-QA-2026-151` (AC-7): a handler-level test completes DELETE, changes the still-published source, and recopies to the same deterministic ID with the new snapshot.
- `US12-QA-04` / `FT-QA-2026-152` was the unrelated weights suite failure, not a US-12 correction. The exact previously failing test now passes, and the current full Backend unit suite passes. The central finding entry remains `Awaiting decision` as requested; `docs/qa/findings.md` was not changed.

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm exec --workspace=backend -- vitest run src/functions/communityRecipes.test.ts src/lib/communityRecipeTransfer.test.ts src/lib/communityRecipes.test.ts src/functions/recipes.test.ts src/lib/storage.test.ts src/lib/repositories/recipesRepository.test.ts --reporter=dot` | 0 | 6 files passed; 192 tests passed. |
| `npm exec --workspace=backend -- vitest run --silent --reporter=dot` | 0 | Full Backend unit suite passed: 77 files, 1,913 tests. |
| `npm exec --workspace=backend -- vitest run src/functions/weights.test.ts --silent --reporter=dot -t "returns 404 for unknown and other-user IDs without changing the other user entry"` | 0 | Previously failing unrelated case passed; 1 passed, 35 skipped. |
| `npm run build:verify --workspace=backend` | 0 | TypeScript build and all build verification checks passed. |
| `npm exec --workspace=mobile -- vitest run src/modules/recipes/RecipeListScreen.test.tsx src/modules/recipes/CommunityRecipeDetailScreen.test.tsx src/shared/api/recipeApi.test.ts src/modules/recipes/recipeWizardEditBootstrap.test.ts --reporter=dot` | 0 | 4 files passed; 59 tests passed. |
| `npm exec --workspace=mobile -- tsc --noEmit` | 0 | Mobile typecheck passed. |
| `npm exec --workspace=shared -- vitest run --reporter=dot` | 0 | 10 files passed; 466 tests passed. |
| `npm exec --workspace=backend -- vitest run --config vitest.contract.config.mts --reporter=dot` | 1 | Contract suites could not initialize because the local Cosmos emulator was unreachable at `127.0.0.1:18081`. Classified `UNVERIFIED`; no remote Cosmos endpoint was contacted. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: The local Cosmos emulator is unreachable. No remote Cosmos endpoint was contacted.
- Manual action: With the local emulator available, run `cd backend; npx vitest run --config vitest.contract.config.mts`. Expected result: repository contract tests pass, including deterministic snapshot persistence and owner-partition isolation.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: Azure Blob Soft Delete same-path recreation cannot be established by local unit tests; no Alpha deployment or storage smoke test was performed.
- Manual action: After an approved deployment, copy a published recipe with an image, complete DELETE of the private copy, then recopy the still-published source within the seven-day soft-delete window. Verify the same deterministic owner path is active with matching bytes/content type and the copied recipe references it. Result: pending.

## Findings

No current actionable findings.
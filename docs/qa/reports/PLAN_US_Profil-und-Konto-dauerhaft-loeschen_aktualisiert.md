# QA Report: Profil und Konto dauerhaft löschen

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Profile/PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md](docs/User%20Stories/Profile/PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md)
- Verdict: PASS

## Scope

Reviewed the complete approved plan, including Sections 5, 6, 19-22, against the current repository and reported B1, Dev-only I1, B2, F1-R3, D1, and D2 handoffs. The explicit approval and 2026-10-22 scope revision control over superseded historical pending-approval and FAIL passages. The original story remains unchanged and is not authoritative where its copy/local-cleanup wording conflicts with the approved plan. Applied the `privacy-impact-review` and `cosmos-data-model-and-migration` QA checklists.

The D2 corrections resolve both prior review issues: local cleanup is described as an attempt that may fail, and the embedded policy date matches the durable policy. No Graph/Entra operation, Alpha deployment, Expo build, emulator setup, remote Cosmos inventory, actual account deletion, or Health Connect platform operation was performed. The accepted pre-lock late-write and best-effort local-state residuals are not findings. `docs/qa/findings.md` was not edited.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | The existing-profile action opens the confirmation without submitting on open; [ProfileEditScreen.tsx](mobile/src/modules/profile/ProfileEditScreen.tsx) and [ProfileEditScreen.test.tsx](mobile/src/modules/profile/ProfileEditScreen.test.tsx). |
| AC-2 | PASS | The approved title/body are exact; the screen test rejects Entra/internal-process wording and the prior unconditional local-cleanup claim. The separate privacy note describes an attempt, not a guarantee; [ProfileEditScreen.test.tsx](mobile/src/modules/profile/ProfileEditScreen.test.tsx). |
| AC-3 | PASS | Published-recipe choice appears only when relevant, defaults to `Nein` on every open, and uses the exact approved helper text; [ProfileEditScreen.test.tsx](mobile/src/modules/profile/ProfileEditScreen.test.tsx). |
| AC-4 | PASS | Exact uppercase `DELETE` gates submission; cancel, backdrop, and Android Back close without a request; [ProfileEditScreen.test.tsx](mobile/src/modules/profile/ProfileEditScreen.test.tsx). |
| AC-5 | PASS | The handler takes the deletion target from verified auth identity and strictly validates the exact body; repository cleanup is scoped to that user, with no Graph call; [profile.ts](backend/src/functions/profile.ts), [profileDeletionRepository.ts](backend/src/lib/repositories/profileDeletionRepository.ts), and [profile.test.ts](backend/src/functions/profile.test.ts). |
| AC-6 | PASS | Personal blobs use normal idempotent `deleteIfExists`; retained images are copied to neutral community paths before owner data is removed. Existing Blob Soft Delete remains seven days; [storage.ts](backend/src/lib/storage.ts), [communityRecipeTransfer.ts](backend/src/lib/communityRecipeTransfer.ts), [profileDeletion.ts](backend/src/lib/profileDeletion.ts), and [storage.bicep](infra/modules/storage.bicep). Cosmos persistence contracts remain UNVERIFIED. |
| AC-7 | PASS | Transfer sanitizes owner, publication, shared-user, and personal-library references; ownerless community reads project `Anonymous` and neutral image paths; [communityRecipeTransfer.test.ts](backend/src/lib/communityRecipeTransfer.test.ts), [recipesRepository.ts](backend/src/lib/repositories/recipesRepository.ts), and [communityRecipes.ts](backend/src/lib/communityRecipes.ts). Cosmos persistence contracts remain UNVERIFIED. |
| AC-8 | PASS | The selected-delete branch removes ownerless recipe documents and their images; unavailable recipe and image routes return 404, while foreign references are projected as unavailable rather than restoring the recipe; [profileDeletion.ts](backend/src/lib/profileDeletion.ts), [profileDeletion.test.ts](backend/src/lib/profileDeletion.test.ts), and [communityRecipes.ts](backend/src/functions/communityRecipes.ts). |
| AC-9 | PASS | Mobile locks controls, retains the request for retry, resends the identical payload, and leaves local cleanup until server success; backend validates/reports retryable errors. A local cleanup failure cannot issue a second DELETE; [ProfileEditScreen.test.tsx](mobile/src/modules/profile/ProfileEditScreen.test.tsx), [profile.ts](backend/src/functions/profile.ts), and [client.test.ts](mobile/src/shared/api/client.test.ts). |
| AC-10 | PASS | After `204`, all local storage/service cleanup attempts run, both tokens are attempted through logout, the in-process auth state clears, and a detected failure triggers one transient notice without a durable marker/retry or second DELETE; [accountDeletionService.ts](mobile/src/services/accountDeletionService.ts), [authService.ts](mobile/src/services/authService.ts), [LoginScreen.tsx](mobile/src/modules/auth/LoginScreen.tsx), and their tests. |
| AC-11 | PASS | Same verified `sub` has no profile until one is created; the wizard honors a surviving skip flag. On later authenticated activation, surviving queues drain to Health Connect, not FitTrack; [profile.test.ts](backend/src/functions/profile.test.ts), [RootNavigator.tsx](mobile/src/app/navigation/RootNavigator.tsx), [App.tsx](mobile/src/app/App.tsx), and the sync services. Cosmos persistence semantics remain UNVERIFIED. |
| AC-12 | PASS | Application Insights remains 30 days, Blob Soft Delete seven days, and backups/configuration are unchanged; [appinsights.bicep](infra/modules/appinsights.bicep), [storage.bicep](infra/modules/storage.bicep), and [datenschutzerklaerung-alpha.md](docs/legal/datenschutzerklaerung-alpha.md). |
| AC-13 | PASS | The exact transient notice appears once, recommends only Android app-data removal, and makes no uninstall/Health Connect deletion promise. The manifest retains `allowBackup="true"`; [LoginScreen.test.tsx](mobile/src/modules/auth/LoginScreen.test.tsx), [AndroidManifest.xml](mobile/android/app/src/main/AndroidManifest.xml), and the privacy policy. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm --prefix mobile test -- --reporter=dot` | 0 | 96 files passed; 950 tests passed, including profile deletion, legal mirror, cleanup, and warning tests. |
| `npm --prefix mobile run typecheck` | 0 | Mobile TypeScript check passed. |
| `npm --prefix backend test -- --reporter=dot` | 0 | 77 files passed; 1,881 tests passed. |
| `npm --prefix backend run build:verify` | 0 | Backend build and shared-import verification passed. |
| `az bicep build --file infra/main.bicep --stdout` | 0 | Local infrastructure template compilation passed; no deployment was applied. |
| `npx vitest run --config vitest.contract.config.mts` (from `backend/`) | N/A | Not run. Cosmos emulator setup and remote Cosmos testing are excluded; persistence contract verification remains `UNVERIFIED`. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: Cosmos-specific persistence contracts were not run because no emulator is available and setup/remote inventory are explicitly excluded. The reported Dev-only I1 provisioning is accepted; Alpha was not applied. Legacy `users`/`nutritionProfiles` contents were not inventoried. The local Bicep compile verifies template syntax only, not deployed resource state.
- Manual action: None required for this review. No actual deletion, live same-identity sign-in, Health Connect platform operation, Entra/Graph operation, or Alpha release is authorized or a gate. If Cosmos contract verification is separately scheduled later, its prerequisite is a local emulator; run the contract command above and record the result. The accepted pre-lock late-write, force-close, token/queue, and platform-backup residuals remain within the approved plan.

## Findings

No actionable findings. The prior findings `Q2-AC10-01` and `Q2-LEGAL-01` are resolved in the reviewed worktree. Verification limits above are not findings.
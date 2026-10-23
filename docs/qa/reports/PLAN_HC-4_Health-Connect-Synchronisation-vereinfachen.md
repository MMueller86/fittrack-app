# QA Report: HC-4 Health-Connect-Synchronisation vereinfachen

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md](../../User%20Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md)
- Verdict: PASS WITH ISSUES

## Scope

Re-review of all 13 acceptance criteria in the approved HC-4 plan, original story, and Q1-Q4 work packages after the first correction attempt. The review covers the current Backend, Shared, and Mobile implementation, tests, Knowledge Base, and privacy policy, including Class-0 compatibility, JWT partitioning, local-state allowlist, Health Connect permissions, status UI, foreground throttle, account-deletion boundary, and approved policy wording. Only this QA report was changed. The explicit out-of-scope items in plan section 6, including imports, background sync, server tombstones, account-deletion redesign, infrastructure changes, and release execution, were not implemented or tested as HC-4 work.

## Correction Re-review

- **HC4-QA-01:** The blocking full-export defect is corrected in `cosmosDiaryRepository.listAllMeals`: the query permits documents with no `_docType` or `_docType: 'meal'`. Its contract test asserts legacy and explicit Meals are returned and both DayMeta and HintState are excluded. The test could not execute against Cosmos because the local emulator is unavailable; runtime remains `UNVERIFIED`.
- **HC4-QA-02:** The missing `deleteSecondaryNotice` style is present in the current `ProfileDeletionAction.tsx`; the full Mobile typecheck and test suite now pass. The account-deletion service's cleanup and logout calls are unchanged. This separate account-deletion work is not treated as complete or HC-4-owned.
- **HC4-QA-03:** Remains an open non-blocking finding; mock-provider client record IDs are still written to the persistent diagnostic log. No acceptance, deferral, or authorization to correct it is inferred.
- **HC4-QA-04:** Remains open with status **Awaiting decision**. Current Backend and Domain Knowledge Base pages still contain stale HC-4 draft/snapshot-queue wording. No acceptance, deferral, or authorization to correct it is inferred.

## Acceptance Criteria

| ID | Criterion (verbatim) | Result | Evidence |
|---|---|---|---|
| AC-1 | Nach Upgrade enthalten `hc:weight:sync` und `hc:nutrition:sync` keine Gewichts-, Meal- oder Item-Werte. Bestehende Snapshot-Queues werden beim ersten Laden ohne Health-Connect-Aufruf gelöscht. | PASS | Both sync-service suites verify legacy snapshot purge without Health Connect calls and the persisted field allowlist; full Mobile suite passes. See [healthSyncService.test.ts](../../../mobile/src/services/health/healthSyncService.test.ts) and [nutritionSyncService.test.ts](../../../mobile/src/services/health/nutritionSyncService.test.ts). |
| AC-2 | Erfolgreiche Gewicht-/Meal-Erstellung, Änderung und Löschung löst unmittelbar einen asynchronen Sync aus; die FitTrack-Mutation wartet nicht auf Health Connect. Alle Mutationstypen inklusive Move/Copy/Bulk sind erfasst. | PASS | Nutrition facade and mutation-caller tests cover successful mutation triggers, API failures, fire-and-forget behavior, recipe-log ordering, and bulk flows; Progress tests cover weight create/update/delete. Full Mobile suite: 102 files, 958 tests passed. |
| AC-3 | Je aktiviertem Datentyp respektiert der Vordergrundabgleich die persistierte 15-Minuten-Semantik über App-Neustarts hinweg. `lastForegroundAttemptAt` wird als kanonischer UTC-ISO-String gemäß `Date.toISOString()` vor dem Lauf gespeichert; numerische Epoch-Millisekunden sind ungültig und werden nicht konvertiert. Fehlgeschlagene Versuche zählen; ein neuer Lauf ist ab genau 15 Minuten zulässig. Die Zeit ist fix und nicht konfigurierbar; Aktivierungs-/manuelle Voll-Exporte und Mutationstrigger werden nicht gedrosselt und ändern den Timestamp nicht. Kein Hintergrunddienst läuft. | PASS | Both sync-service suites cover canonical ISO attempt timestamps, persisted cold-start throttling, failed attempts, independent datatypes, and just-below/exact/above 15-minute boundaries. [App.tsx](../../../mobile/src/app/App.tsx) has only authenticated startup and active-state triggers, with no background timer. |
| AC-4 | Der Checkpoint wird erst nach vollständigem Delta-Lauf einschließlich aller Seiten und aller Health-Connect-Operationen übernommen. Ohne Delta erfolgen null Health-Connect-Schreibzugriffe. Nach einem Fehler bleibt der frühere Checkpoint bestehen. | PASS | Sync-service tests verify no watermark advance after failed writes or page checkpoint mismatch, and advance only after successful delta completion. The separate full-export document-filter defect is recorded under AC-8/AC-9. |
| AC-5 | Unmittelbar vor jedem Health-Connect-Upsert und -Delete werden Aktivierung, aktuelle Nutzerbindung und passende Schreibberechtigung verifiziert. Fehlende Berechtigung führt zu null Writes, Deaktivierung und einer deutschen Nutzerinformation. | PASS | Both service suites cover permission checks before writes, including denied deletes retaining IDs and issuing no Health Connect delete; denial disables sync. User-facing permission messages are German. |
| AC-6 | Fehlende oder fremde lokale Nutzer-ID führt vor jedem Write zum Verwerfen des betreffenden lokalen Stands und deaktiviert Sync bis zur erneuten Aktivierung. Kein fremder Nutzer erhält Health-Connect-Daten aus einem alten Zustand. | PASS | Both service suites verify missing stored user ID and user mismatch purge local state and prevent writes. Every API call uses the authenticated client; backend handlers derive the partition from `requireUser()`. |
| AC-7 | Persistierte ausstehende Löschungen sind ausschließlich IDs. Erfolgreiche Deletes entfernen IDs, fehlgeschlagene Deletes behalten sie. Keine serverseitigen Lösch-Tombstones oder pro-Gerät-Syncstatus werden angelegt. | PASS | Service tests assert ID-only `pendingDeleteIds`, retention on failed deletes, removal after success, and account-deletion reset behavior. Backend delta APIs create no tombstones or per-device state. |
| AC-8 | Gewichte und Meals unterstützen eine serverbasierte Delta-Abfrage. Neue/aktualisierte Datensätze erhalten UTC-`updatedAt`; Alt-Dokumente ohne Feld bleiben lesbar. Voll-Export berücksichtigt alte Gewichte. DayMeta/HintState werden nicht als Meals exportiert. | PASS | The full-export query at [cosmosDiaryRepository.ts](../../../backend/src/lib/repositories/cosmosDiaryRepository.ts#L554) now selects only legacy documents without `_docType` or explicit Meals. The contract test at [cosmosDiaryRepository.contract.test.ts](../../../backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts#L120) seeds a legacy Meal, explicit Meal, DayMeta, and HintState and asserts only the Meals are returned. Contract runtime is `UNVERIFIED`; see Verification Limits. |
| AC-9 | Aktivierung, Neuinstallation und manueller Voll-Export bleiben vollständige, idempotente Exporte mit stabilen `clientRecordId`s. Aktivierung und Drosselung bleiben je Datentyp lokal; Deaktivierung setzt `enabled=false`, behält Wasserzeichen, Lösch-IDs und Versuchstimestamp und verursacht keine Health-Connect-Aufrufe. Erneute Aktivierung erfordert aktuelle Berechtigungsabfrage und führt den Voll-Export aus. Es gibt keine account-weiten Profil-/API-Felder für diese Zustände. | PASS | The full-export API contracts remain unchanged, and the corrected Cosmos full-export predicate excludes non-Meal documents before Mobile computes the export watermark. Existing Mobile full-export tests and behavior evidence from the original review remain applicable. Emulator execution is `UNVERIFIED`. |
| AC-10 | Queue-basierte Item-Fehlerlisten und veraltete Queue-Begriffe werden aus HealthConnect/`SyncStatusSheet` entfernt. Pro Datentyp zeigt die UI ausschließlich `enabled`, `permissionRevoked`, `pendingDeleteCount` und `lastSuccessfulSyncAt` aus `getSyncStatus()`. Es gibt keinen globalen Status „Abgleich läuft“ oder „letzter Versuch fehlgeschlagen“; diese Werte werden weder in F1 ergänzt noch von F2 abgeleitet. `permissionRevoked: false` wird nicht als bestätigte Berechtigung dargestellt. Keine Ernährungs- oder Gewichts-Eintragsbadges, Emojis oder Fehler-Stacks. | PASS | Focused UI tests verify the four approved fields, German copy/no emoji, no global attempt state, no queue/error/stack payloads, and no Progress badges. Android native rendering and accessibility remain manual checks. |
| AC-11 | Mobile-, Backend-, API- und Domain-KB beschreiben das implementierte Delta-Verfahren und die erlaubten lokalen Daten. D3 ergänzt die Datenschutzerklärung ausschließlich um den in Abschnitt 17 freigegebenen Wortlaut; Q4 bestätigt nach der Änderung die Übereinstimmung mit implementierter Datenverarbeitung und Android-Backup-Einschränkung. | PASS WITH ISSUES | The Mobile/API documentation and approved policy wording are present; the exact policy text remains consistent with the approved text and qualified Android-backup statement. The Backend and Domain KB still contain stale draft/snapshot-queue wording, and the mock diagnostic log still persists client record IDs. See HC4-QA-03 and HC4-QA-04. |
| AC-12 | Unit-Tests decken Fachlogik, Berechtigung einschließlich verweigertem Delete ohne Health-Connect-Aufruf, Nutzerbindung, Delta-Abfragen, Wasserzeichen und Lösch-ID-Liste ab. Direkte manuelle Voll-Exporte und alle Diary-Mutationseinstiege sind durch Tests belegt; Mobile-Tests und Typecheck sind als konkrete Ergebnisse zu übergeben. Contract-Tests validieren Cosmos-Kompatibilität gegen den Emulator; Geräteprüfungen werden separat ausgewiesen. | PASS WITH ISSUES | Backend unit tests pass (1,944/1,944); the Mobile suite and typecheck pass (958 tests; typecheck exit 0). The contract test contains the Meal/DayMeta/HintState assertions but did not reach the emulator, so Cosmos runtime is explicitly `UNVERIFIED`. |
| AC-13 | HC-4 ändert weder den Konto-Löschablauf noch dessen lokale Best-Effort-Cleanup-/Logout-Semantik, API, Retention oder Status. Der separate Konto-Löschplan bleibt unverändert und wird erst nach HC-4 gemäß dessen eigenem Freigabe- und QA-Status fortgesetzt. | PASS | [accountDeletionService.ts](../../../mobile/src/services/accountDeletionService.ts) retains the existing best-effort cleanup calls, including both sync-key resets; sync-service tests cover their reset behavior. No HC-4 change to the account-deletion API or lifecycle was found. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run` | 0 | 77 files, 1,944 tests passed. |
| `cd backend && npx vitest run --config vitest.contract.config.mts src/lib/repositories/cosmosDiaryRepository.contract.test.ts --reporter=dot` | 1 | Correction re-review: the local emulator at `127.0.0.1:18081` was unreachable; all 25 tests were skipped before assertions. Original full contract attempt also failed setup (11 suites; 110 tests skipped). Cosmos runtime remains `UNVERIFIED`. |
| `cd backend && npx tsc --noEmit` | 0 | Backend typecheck passed in the original review; not separately rerun for this correction review. Current `build:verify` passed. |
| `cd backend && npm run build:verify` | 0 | Build and shared-import verification passed. |
| `cd shared && npx vitest run --reporter=dot` | 0 | Original review: 10 files, 466 tests passed. Shared was unchanged and not rerun. |
| `cd shared && npx tsc --noEmit` | 0 | Original review: Shared typecheck passed. Shared was unchanged and not rerun. |
| `cd mobile && npx vitest run --reporter=dot` | 0 | 102 files, 958 tests passed. |
| `cd mobile && npx vitest run src/services/health/healthSyncService.test.ts src/services/health/nutritionSyncService.test.ts src/modules/healthConnect/HealthConnectScreen.test.tsx src/modules/healthConnect/SyncStatusSheet.test.tsx src/modules/healthConnect/healthConnectCopy.test.ts src/modules/progress/ProgressScreen.test.tsx src/services/nutritionDiaryService.test.ts src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx --reporter=dot` | 0 | Original review: 8 files, 79 tests passed across sync services, status UI/copy, Progress, nutrition facade, and mutation callers. The full Mobile suite was rerun in this review. |
| `cd mobile && npx vitest run src/modules/legal/legalTexts.test.ts --reporter=dot` | 0 | Original review: 1 file, 9 tests passed; in-app privacy text matches the approved policy wording. Not rerun in this correction review. |
| `cd mobile && npx tsc --noEmit` | 0 | Full Mobile package typecheck passed after the `deleteSecondaryNotice` style became available in the current workspace. |

## Verification Limits

### Cosmos Contract Tests

- State: `UNVERIFIED`
- Reason: The required local Cosmos emulator was unreachable at `http://127.0.0.1:18081`; the contract suites failed during setup before exercising persistence.
- Manual action: Start the local emulator, then rerun `cd backend && npx vitest run --config vitest.contract.config.mts`. Verify legacy documents without `updatedAt`, inclusive fallback/filter behavior, `/userId` isolation, Meal-only full export, and DayMeta/HintState exclusion. Do not use remote Cosmos.
- Expected result: All affected Weight and Diary contracts execute and pass against the emulator; never run these tests against remote Dev/Alpha Cosmos.
- Result: `UNVERIFIED`.

### Android Provider and Permissions

- State: `MANUAL VALIDATION REQUIRED`
- Prerequisites: Android device with the Health Connect provider installed, an authorized test account, and a permitted preview/test dataset.
- Steps: Enable Weight and Nutrition separately; grant then revoke each write permission; exercise successful and denied upserts/deletes, a deletion retry, and a foreground delta after the throttle interval.
- Expected result: Writes occur only while enabled, user-bound, and currently permitted; denied deletes issue no provider delete and retain their IDs; successful deletes remove only confirmed IDs; no unintended records are written.
- Result: `UNVERIFIED`; no physical Android/provider environment was available.

### Android UI and Accessibility

- State: `MANUAL VALIDATION REQUIRED`
- Prerequisites: The same Android device/provider and a build containing the reviewed UI.
- Steps: Open the Health Connect status sheet; inspect both datatype sections at representative screen/font sizes; dismiss via close, backdrop, and system Back; navigate with TalkBack and verify labels/focus order.
- Expected result: Sheet renders without clipping or overlap, exposes only the four approved status fields per datatype, and closes/accesses correctly. No per-entry badge or global foreground-attempt status appears.
- Result: `UNVERIFIED`; native rendering, TalkBack, and Back behavior were not available in this environment.

### Android Backup Behavior

- State: `MANUAL VALIDATION REQUIRED`
- Reason: The repository confirms `android:allowBackup="true"` and contains no backup-exclusion rule, but cannot establish whether a particular device/provider backs up or restores these AsyncStorage keys.
- Manual action: On a configured Android test device, create sync metadata, clear app data or reinstall, then observe whether backup restoration returns it. Record device, Android version, settings, and backup provider.
- Expected result: Any observed behavior remains consistent with the qualified policy statement; do not infer an unconditional deletion guarantee.
- Result: `UNVERIFIED`.

### Release and deployment

- State: `NOT RUN` (out of scope)
- Reason: The approved plan excludes deployments, EAS builds, and release execution.
- Result: No deployment, EAS build, or remote Cosmos access was performed.

## Re-review History

**HC4-QA-01:** The prior blocking finding is no longer open after source and contract-test inspection. Contract execution remains `UNVERIFIED`, not passed.

**HC4-QA-02:** The prior blocking typecheck finding is no longer open: the style is defined at [ProfileDeletionAction.tsx](../../../mobile/src/modules/profile/ProfileDeletionAction.tsx#L309), the Mobile typecheck exits 0, and all 958 Mobile tests pass. The account-deletion service remains unchanged; this does not mark the separate account-deletion work complete.

## Findings

**HC4-QA-03**
- Finding key: HC4-QA-03
- Plan reference: [docs/User Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md](../../User%20Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md)
- Acceptance criterion: AC-11
- Description: In development and non-Android builds, `MockHealthPlatformService` logs Health Connect client record IDs on upsert and delete. `syncLogger` persists these messages in AsyncStorage, so the local diagnostic log contains stable IDs beyond the approved state allowlist and logger description.
- Criticality: Non-blocking
- Owner: Frontend
- Evidence: [healthPlatformService.ts](../../../mobile/src/services/health/healthPlatformService.ts#L10) selects the mock for development/non-Android; [MockHealthPlatformService.ts](../../../mobile/src/services/health/MockHealthPlatformService.ts#L41) and [MockHealthPlatformService.ts](../../../mobile/src/services/health/MockHealthPlatformService.ts#L45) log IDs; [syncLogger.ts](../../../mobile/src/services/health/syncLogger.ts#L37) persists log entries. The current Mobile KB describes the state allowlist but does not document this extra log content.
- Recommendation: Remove client IDs from mock diagnostic messages and add a regression assertion that persisted logs contain only the approved event/type/time/technical-error information.

**HC4-QA-04**
- Finding key: HC4-QA-04
- Plan reference: [docs/User Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md](../../User%20Stories/HealthConnect/PLAN_HC-4_Health-Connect-Synchronisation-vereinfachen.md)
- Acceptance criterion: AC-11
- Description: The Backend and Domain Knowledge Base still describe HC-4 as an unapproved draft and the local ID-only retry as proposed. `docs/kb/tech/02-backend.md` additionally says Mobile still persists snapshot-based `pendingOperations`, which is stale against the implemented sync services. The plan is approved and F1 has implemented the Mobile-owned retry; the backend no-tombstone boundary remains accurate.
- Criticality: Non-blocking
- Owner: Documentation
- Evidence: [02-backend.md](../../../docs/kb/tech/02-backend.md#L161), [02-diary.md](../../../docs/kb/domain/02-diary.md#L28), and [05-weight-tracking.md](../../../docs/kb/domain/05-weight-tracking.md#L31) contain stale draft/snapshot wording; [03-mobile.md](../../../docs/kb/tech/03-mobile.md#L160) documents the implemented Mobile behavior. Status remains **Awaiting decision**; this review does not infer acceptance or deferral.
- Recommendation: Align the stale Backend and Domain KB statements with the approved plan and implemented Mobile-owned retry while retaining that the backend provides no tombstones or deletion-ID list. Do not treat this report as authorization to make the documentation change.
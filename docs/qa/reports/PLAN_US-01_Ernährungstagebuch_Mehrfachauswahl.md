# QA Report: US-01 Ernährungstagebuch Mehrfachauswahl

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- Verdict: `PASS`

## Scope

Reviewed the original user story and the entire approved plan, reapproved on 2026-10-05: approved Scope and Out of Scope, PO-1/2/3, technical and persistence invariants, work-package completion, test strategy, execution status, documentation requirements, and every AC-1 through AC-19. The plan artifact was read but not changed. The implementation review covered backend, mobile, shared transport types, and Knowledge Base documentation. No infrastructure/container/partition-key/schema/migration/native configuration or dependency change was identified; the shared diary changes are request/response types only.

**Approved Scope (verbatim)**

- Auswahlmodus in `DiaryScreen` für den dargestellten Tag.
- Item-Auswahl, Mahlzeiten-Auswahl, kombinierte Auswahl und klare visuelle/accessibility-relevante Zustände.
- Bestätigtes Bulk-Löschen ausgewählter Items, ohne nicht ausgewählte Items oder Meal-Dokumente zu entfernen.
- Bulk-Verschieben auf eine bestehende Mahlzeit desselben Tages, die von allen Quellmahlzeiten der Auswahl verschieden ist, oder auf eine wie heute neu anzulegende Mahlzeit.
- Bulk-Kopieren auf einen anderen Tag in genau eine explizit vom Nutzer ausgewählte Zielmahlzeit; vorhandene oder über „Mahlzeit anlegen“ neu zu erstellende Zielmahlzeit.
- Backend-Validierung und user-scoped Repository-Mutationen, typed API-Client und Health-Connect-Synchronisation nach erfolgreichem Commit. Delete und Move schreiben keine Usage; Copy schreibt bestätigte, quelltypspezifische Tracking-Nebenwirkungen erst nach erfolgreichem Commit.
- Die bestehenden Einzeleintrags-Flows für Verschieben und Kopieren auf dieselben Backend-Befehle mit einer Referenz umstellen, damit Einzel- und Mehrfachaktionen dieselbe Snapshot-, Mutations- und Tracking-Logik verwenden.

**Out of Scope (verbatim)**

- Freunde, Kontakte, fremde Tagebücher oder Übernahme fremder Einträge.
- Auswahl über mehrere Tage hinweg.
- Löschen, Verschieben oder Kopieren ganzer Meal-Dokumente als neue Aktion.
- Neue Kopier-, Lösch- oder Verschiebelogik außerhalb der Unterstützung der Einzel-/Mehrfachauswahl.
- Änderungen an Ernährungsberechnung, Rezeptauflösung, AI-Flows, Zielen oder Tageszusammenfassungen.
- Neue Cosmos-Entitäten, Container, Partition Keys, Native Modules oder App-Config-/Plugin-Änderungen.

**Approved Decisions and Invariants**

- PO-1: Copy requires exactly one meal explicitly chosen by the user. A new target meal and all copies are created in the same Diary transaction; Mobile does not pre-create it.
- PO-2: Delete, Move, and Copy are all-or-nothing and are never split into partial requests. Invalid references, conflicts, or transaction limits produce no Diary mutation. Failed requests show a concrete error, reload the source day, retain valid selection, and remove stale references during normalization.
- PO-3: Delete and Move do not add, decrement, or reattribute usage and do not change existing source counters/history. Copy records usage after the Diary commit, once per copied referenced item at the target date/type, using the approved legacy source classification; tracking remains best effort.
- All mutations use the authenticated user's context and existing `/userId` partition. Diary document shape, container, partition key, and migration state remain unchanged. Health Connect sync is a separate post-commit Mobile side effect.

The plan remains Approved and records the user's reapproval on 2026-10-05; PO-1/2/3, Scope, Out of Scope, and the full AC wording are unchanged. At the start of this re-review, execution metadata accurately recorded the earlier verification/closure of FT-QA-2026-058/059/060, FT-QA-2026-061 implemented but awaiting QA, 84/84 handler/in-memory tests, and Cosmos runtime as unverified with 17 tests skipped. This report records the result of that pending review. The approved plan and `docs/qa/findings.md` were not edited. No Azure deployment or Alpha release was requested or performed.

## Acceptance Criteria

| ID | Acceptance criterion (approved wording) | Result | Evidence |
|---|---|---|---|
| AC-1 | Im Tagebuch kann der Nutzer den Mehrfachauswahlmodus starten und über eine sichtbare Abbrechen-/Beenden-Aktion verlassen. | PASS | Header start/end control and `clearSelectionMode` in `mobile/src/modules/nutrition/DiaryScreen.tsx`; start, cancel, and route behavior in `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`. |
| AC-2 | Im Auswahlmodus kann jedes Item ein- und abgewählt werden; die Auswahl eines Items öffnet nicht dessen Editieransicht. | PASS | Selection mode routes row presses to the selection toggle, suppresses the edit handler, and bypasses swipe mutation in `mobile/src/modules/nutrition/DiaryScreen.tsx`; toggle coverage in `mobile/src/modules/nutrition/diaryItemUtils.test.ts`. |
| AC-3 | Eine nicht ausgewählte Mahlzeit wählt alle ihre Items aus; eine vollständig ausgewählte Mahlzeit hebt alle ihre Items ab. Teilweise Auswahl ist sichtbar und leere Mahlzeiten erzeugen keine Item-Auswahl. | PASS | Tri-state, select-all/clear-all, and empty-meal guard in `mobile/src/modules/nutrition/diaryItemUtils.ts`; partial/all/empty tests in `mobile/src/modules/nutrition/diaryItemUtils.test.ts`. |
| AC-4 | Items aus mindestens zwei Mahlzeiten desselben dargestellten Tages können gemeinsam ausgewählt werden, auch zusammen mit einer Mahlzeitenauswahl. | PASS | References are `{ mealId, itemId }`; multi-meal selection and complete request assertions in `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`; meal-toggle helpers in `mobile/src/modules/nutrition/diaryItemUtils.ts`. |
| AC-5 | Auswahlanzahl sowie Item-, vollständiger Meal- und partieller Meal-Zustand bleiben visuell und für Accessibility eindeutig erkennbar. | PASS (implementation); device/screen-reader check UNVERIFIED | Count/live-region label, checkbox roles/states, and mixed meal state in `mobile/src/modules/nutrition/DiaryScreen.tsx` and `mobile/src/shared/components/DiaryItemRow.tsx`. Android/TalkBack validation is listed separately. |
| AC-6 | Jede der Aktionen Löschen, Verschieben und Auf anderen Tag kopieren kann genau einmal auf die vollständige aktuelle Auswahl gestartet werden; Löschen zeigt vor dem Commit eine gemeinsame FitTrack-Bestätigung. | PASS | Each action passes the selected reference list through one typed bulk API call; Delete uses one `ConfirmSheet`. Selection-wide request/call-count assertions in `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`; route wrappers in `mobile/src/shared/api/diaryApi.ts`. |
| AC-7 | Nach erfolgreichem Kopieren existieren die Quell-Items unverändert weiter und sämtliche Kopien liegen am vom Nutzer explizit gewählten anderen Tag in genau einer Zielmahlzeit. | PASS (in-memory/handler); Cosmos persistence UNVERIFIED | Stored snapshot cloning and source preservation in `backend/src/lib/repositories/diaryRepository.ts` and `backend/src/lib/repositories/diaryRepository.test.ts`; explicit target date/meal selection in `mobile/src/modules/nutrition/CopyItemSheet.tsx`; Cosmos contract source exists but could not execute. |
| AC-8 | Nach erfolgreichem Verschieben liegen alle ausgewählten Items am gewählten Ziel desselben Tages; nicht ausgewählte Items bleiben in ihren Quellen. Ein vorhandenes Ziel muss von jeder Quellmahlzeit der Auswahl verschieden sein; ein Ziel aus der Quellmenge wird mit `400 invalid_diary_bulk_request` und ohne Diary-Änderung abgelehnt. Eine neu angelegte Mahlzeit desselben Tages ist ein zulässiges Ziel. | PASS; Cosmos runtime UNVERIFIED | New component-level source-target exclusion test in `mobile/src/modules/nutrition/MoveItemSheet.test.tsx`; handler asserts HTTP 400/no day mutation in `backend/src/functions/diary.test.ts`; in-memory test asserts `invalid_diary_bulk_request`/no mutation and new same-day target in `backend/src/lib/repositories/diaryRepository.test.ts`. Cosmos multi-source contract exists in `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts`; emulator was unavailable. |
| AC-9 | Nach erfolgreichem Löschen sind ausschließlich die ausgewählten Items entfernt. Meal-Dokumente und nicht ausgewählte Items bleiben bestehen; auch eine dadurch leere Mahlzeit wird nicht als Ganzes gelöscht. | PASS | Selected-only removals and retained empty source meal assertions in `backend/src/lib/repositories/diaryRepository.test.ts`; mutation updates item arrays without deleting meal documents in `backend/src/lib/repositories/diaryRepository.ts`. |
| AC-10 | Erfolg oder expliziter Abbruch beendet den Auswahlmodus und leert die Auswahl. Bei jedem fehlgeschlagenen atomaren Request bleibt der Auswahlmodus aktiv, die App zeigt einen konkreten Fehler und lädt den angezeigten Quelltag neu; nach dem Reload bleiben gültige ausgewählte Referenzen markiert und nicht mehr vorhandene Referenzen werden entfernt. | PASS | Cancel/success/failure paths and reference normalization in `mobile/src/modules/nutrition/DiaryScreen.tsx`; cancellation, conflict reload, valid-reference retention, stale-reference removal, and route-date reset covered in `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`. |
| AC-11 | Backend-Mutationen sind authentifiziert, prüfen alle Quellen/Ziele im Token-Nutzerkontext und weisen ungültige oder fremde Referenzen ohne Datenänderung zurück. | PASS | Bulk Delete/Move/Copy and single-item Delete call `requireUser()` and pass its `userId` to the repository in `backend/src/functions/diary.ts`; single Move/Copy reuse the bulk handlers with one reference. In-memory source resolution and target lookup are user-scoped, while Cosmos reads each source/target by `(mealId, userId)` in `backend/src/lib/repositories/diaryRepository.ts` and `backend/src/lib/repositories/cosmosDiaryRepository.ts`. The new handler and in-memory tests compare foreign and unknown references, then prove a mixed valid-A/foreign-B delete leaves both Diaries unchanged. The Cosmos contract source asserts the same partition isolation; runtime is UNVERIFIED below. |
| AC-12 | Jede Kopie hat eine neue Item-ID, übernimmt den gespeicherten MealItem-Snapshot und dessen Herkunfts-/Rezept-/AI-Metadaten ohne Live-Neuberechnung; die Kopie lässt sich wie ein normales Tagebuch-Item bearbeiten. | PASS (in-memory/handler); Cosmos persistence UNVERIFIED | Clone spreads the stored `MealItem` and replaces only its ID in `backend/src/lib/repositories/diaryRepository.ts`; equality assertions for snapshot fields and new ID in `backend/src/lib/repositories/diaryRepository.test.ts` and Cosmos contract source. |
| AC-13 | Bulk Delete, Move und Copy sind jeweils all-or-nothing über alle betroffenen Diary-Meals. Ungültige Referenzen, ETag-/Schreibkonflikte und Cosmos-Transaktionsgrenzen führen zu null Diary-Änderungen und einem stabilen dokumentierten Fehlercode; es gibt keine Teilaktionen. | PASS (unit/handler/code); Cosmos runtime UNVERIFIED | Full prevalidation, ETag-protected single-partition Transactional Batch, operation/byte limits, and stable error mapping in `backend/src/lib/repositories/cosmosDiaryRepository.ts` and `backend/src/functions/diary.ts`; unit tests cover invalid refs, conflicts, and limits in `backend/src/lib/repositories/diaryRepository.test.ts`; API errors are documented in `docs/kb/tech/09-api-reference.md`. Contract assertions did not execute. |
| AC-14 | Cosmos-Dokumentform, Partition Key und Container bleiben unverändert; bestehende Dev-/Alpha-Daten benötigen keine Migration und werden von den neuen Lese-/Schreibpfaden unterstützt. | PASS (code/docs); emulator compatibility runtime UNVERIFIED | `shared/types/diary.ts` adds transport types; `Meal`/`MealItem` persistence shape is unchanged. No changes to `backend/src/lib/cosmos.ts` or `infra/modules/cosmos.bicep`; the diary/API Knowledge Base documents existing-document compatibility and no migration. Emulator contract runtime was unavailable. |
| AC-15 | Health-Connect-Synchronisation erfolgt erst nach erfolgreichem Diary-Commit und nur für betroffene Einträge. Ein fehlgeschlagener oder abgelehnter Bulk-Request löst keine Health-Connect-Synchronisation aus. Food Usage wird separat nach AC-17 geprüft. | PASS | `nutritionDiaryService` awaits the API before syncing only returned affected IDs in `mobile/src/services/nutritionDiaryService.ts`; success/failure assertions in `mobile/src/services/nutritionDiaryService.test.ts` and `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`. |
| AC-16 | Wird beim Bulk-Copy über den vorhandenen „Mahlzeit anlegen“-Pfad eine neue Zielmahlzeit gewählt, werden Zielmahlzeit und sämtliche Kopien gemeinsam atomar erstellt. Scheitert die Transaktion, existieren weder Kopien noch ein neu angelegtes leeres Zielmahlzeit-Dokument. | PASS (in-memory/code); Cosmos transaction runtime UNVERIFIED | `CopyItemSheet` submits `newMealType` without a prior create in `mobile/src/modules/nutrition/CopyItemSheet.tsx`; in-memory target/invalid-selection no-write test in `backend/src/lib/repositories/diaryRepository.test.ts`; Cosmos uses one batch Create with all copies and has a failure contract test in `backend/src/lib/repositories/cosmosDiaryRepository.ts` and `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts`. |
| AC-17 | Bulk- und Einzel-Delete sowie Bulk- und Einzel-Move ändern keine bestehende `UserFoodRelation`-Usage, kein `ReusableItem.usageCount` und kein `Recipe.usageCount`; sie erzeugen auch keine neue Usage. Move attribuiert keine frühere Usage um. Frühere Historie bleibt unverändert und wird nicht rückwirkend bereinigt. | PASS | Bulk Delete/Move paths contain no usage writes; handler test snapshots relation history and source counters across catalog, personal, recipe, manual, and AI classes in `backend/src/functions/diary.test.ts`. Single Move uses the same bulk Move endpoint with one reference from Mobile; single delete remains the direct Diary-only handler. |
| AC-18 | Nach erfolgreichem Copy wird für jedes referenzierte kopierte Item genau eine neue `UserFoodRelation`-Usage mit Zieldatum und Zielmahlzeit aufgezeichnet. Persönliche Reusable-Quellen aktualisieren zusätzlich `ReusableItem.usageCount` nur unter den bestehenden Add-Auflösungsbedingungen; Open Food Facts aktualisiert keinen eigenen Produktzähler; Recipes aktualisieren `Recipe.usageCount` beim Eigentümer nur, wenn die bestehende Owner-/Community-Auflösung gelingt. Ein nicht verfügbares Recipe-Snapshot bleibt kopierbar, erzeugt die Relation des kopierenden Nutzers und aktualisiert keinen nicht auflösbaren Eigentümerzähler. Items ohne Food-/Recipe-Referenz erzeugen keinen synthetischen Usage-Datensatz. | PASS (unit/handler); Cosmos persistence UNVERIFIED | Post-commit per-item reference classification and best-effort counters in `backend/src/lib/diaryItemUsage.ts`; handler tests cover personal/catalog/recipe/unreferenced sources, repeats, target date/type, available community and unavailable recipes, and failed commit with no usage in `backend/src/functions/diary.test.ts`. |
| AC-19 | Die Copy-Quellklassifikation funktioniert auch mit bestehenden Diary-Dokumenten, in denen `sourceType` bei normalen Adds nicht durchgängig gespeichert wurde: Recipe wird über `recipeId`, Catalog über das `openFoodFacts:`-Präfix und persönliche Reusable-Quellen über die übrige `sourceId` erkannt. Es werden keine Dokumentfelder, Container oder rückwirkenden Datenkorrekturen benötigt. Für fehlgeschlagene Diary-Commits werden keinerlei Usage-Felder geändert; nach erfolgreichem Commit bleiben Usage-Schreibvorgänge best effort. | PASS (code/unit tests); Cosmos persistence UNVERIFIED | Classifier uses stored `recipeId`/`sourceId`, not `sourceType`, in `backend/src/lib/diaryItemUsage.ts`; handler test inputs deliberately mismatch `sourceType` and persisted references and verify no tracking before a failed commit in `backend/src/functions/diary.test.ts`. No document/schema migration exists. |

## Tests

Commands ran from the repository root using package-scoped npm scripts.

| Command | Exit code | Result |
|---|---:|---|
| `npm test --prefix backend -- --reporter=basic --silent src/functions/diary.test.ts src/lib/repositories/diaryRepository.test.ts` | 0 | Current re-review: 2 files passed; 84 tests passed (59 handler, 25 in-memory repository). |
| `npm test --prefix backend -- --reporter=dot --silent` | 0 | Current re-review: 65 files passed; 1,248 tests passed. |
| `npm run typecheck --workspace=backend` | 0 | Current re-review: no TypeScript diagnostics. |
| `npm run build:verify --workspace=backend` | 0 | Current re-review: build/import verification ended with all checks passed. |
| `npm test --prefix backend -- --config vitest.contract.config.mts --reporter=basic --silent src/lib/repositories/cosmosDiaryRepository.contract.test.ts` | 1 | Current re-review: emulator setup failed before assertions; 17 tests skipped. No Cosmos runtime pass is claimed. |
| `npm test --prefix mobile -- --reporter=basic --silent src/modules/nutrition/MoveItemSheet.test.tsx src/modules/nutrition/DiaryScreen.f2.test.tsx` | 0 | Prior AC-8/AC-10 re-review: 2 files passed; 13 tests passed (MoveItemSheet 1/1, DiaryScreen.f2 12/12). |
| `npm run typecheck --workspace=mobile` | 0 | Prior re-review: no TypeScript diagnostics. |
| `npm test --prefix mobile -- --reporter=dot --silent` | 0 | Prior full review: 59 files passed; 631 tests passed. Not rerun for this backend-only test correction. |
| `npm test --prefix shared -- --reporter=dot --silent` | 0 | Prior full review: 10 files passed; 450 tests passed. Not rerun for this backend-only test correction. |
| `npm run typecheck --workspace=shared` | 0 | Prior full review: no TypeScript diagnostics. Not rerun for this backend-only test correction. |

## Verification Notes

### Cosmos Emulator

- State: `UNVERIFIED`
- Reason: The focused contract run could not reach `http://127.0.0.1:18081`; `createTestDatabase()` failed during emulator setup, all 17 tests were skipped before assertions, and the command exited 1.
- Manual action: Start the local emulator with `backend/scripts/start-cosmos-emulator.ps1`, then rerun the focused command above or `npm test --prefix backend -- --config vitest.contract.config.mts`.
- Expected result: Contract assertions execute and pass for multi-source Move target rejection/no partial commit, same-day new Move target, cross-meal transactions, ETag conflicts, limits, and atomic Copy target creation.
- Result: Not executed in this environment.

### Android Visual and Accessibility Check

- State: `MANUAL VALIDATION REQUIRED`
- Reason: `adb` is unavailable; no Android device/emulator interaction or TalkBack check was performed.
- Prerequisites: Install the current Android Dev Build, run the Dev backend, use a diary day containing at least two meals with items and one empty meal, and enable TalkBack.
- Steps: Start selection mode; toggle individual items; select and clear meals from none/partial/all states; confirm the empty meal has no selection target; inspect the count and fixed action bar; verify edit/swipe/add/meal-delete actions are suppressed; exercise Delete confirmation, Move/Copy target selection, cancellation, and a simulated failed request/reload; traverse item and meal selection controls with TalkBack.
- Expected result: The selected count and checkbox/mixed states are visible and announced accurately, stale references are removed after reload/date change, failed requests retain valid selection, and no controls overlap or trigger an unintended mutation.
- Result: Not run (`adb` unavailable).

No Azure deployment or Alpha release was requested or performed.

## Prior Finding Re-Review

- `FT-QA-2026-058`: Verified. The plan header records approval dated 2026-10-05 and completed implementation status; Section 21 agrees and explicitly preserves PO-1/2/3. No stale approval-pending or execution-paused wording was found. The approved Scope, Out of Scope, and AC-1..AC-19 wording remain unchanged from the prior QA baseline. The plan was not modified.
- `FT-QA-2026-059`: Verified. `mobile/src/modules/nutrition/MoveItemSheet.test.tsx` renders the actual sheet with two selected source meal IDs, asserts neither is offered as an existing target, selects an eligible same-day target, and verifies one `onMove` call with the full reference list. Focused test passed 1/1; mobile typecheck passed.
- `FT-QA-2026-060`: Verified. `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx` uses a stateful route harness, selects an item, changes the route date, verifies a load for the new date, and confirms mode/count disappear and the matching old reference is no longer selected. Focused screen tests passed 12/12; mobile typecheck passed.
- `FT-QA-2026-061`: Verified by this re-review. The handler test seeds user B's meal, submits its reference under user A's authenticated context, compares its response with an unknown reference, and asserts a mixed valid-A/foreign-B request leaves both Diaries unchanged. The in-memory repository test makes the same foreign/unknown and no-mutation assertions. The Cosmos contract source mirrors those assertions using separate user partitions. The focused handler/in-memory tests passed 84/84; Cosmos runtime remains UNVERIFIED because setup failed before the 17 contract assertions. The findings register was not edited.

## Findings

No actionable findings.
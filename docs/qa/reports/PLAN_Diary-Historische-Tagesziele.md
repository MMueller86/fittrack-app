# QA Report: Historische Tagesziele im Ernährungstagebuch

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Diary-Historische-Tagesziele.md`
- Verdict: PASS

## Scope

Geprüft wurden der Diary-GET, die DayMeta-Snapshot-Persistenz, der Shared-Resolver und Response-Typ, die Diary-Karte sowie zugehörige Dokumentation und Tests gegen AC-1 bis AC-7. Der Snapshot bleibt im bestehenden nutzerpartitionierten DayMeta-Dokument; es gibt keine neue Infrastruktur. Die Datenschutzerklärung bleibt entsprechend der Planentscheidung „Policy covered“ unverändert.

Das Arbeitsverzeichnis enthält außerdem separate Kamera-Picker-Änderungen unter `mobile/src/shared/camera/`, `mobile/src/modules/nutrition/hub/` und `docs/kb/product/05-ux-patterns.md`. Diese wurden nicht dem Diary-Plan zugerechnet und waren nicht Gegenstand dieses Reviews. Es wurden keine Dev- oder Alpha-Cosmos-Tests ausgeführt.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/functions/diary.ts` ruft `ensureCalorieTargetSnapshot` nur für `date === localDate` und nur mit aufgelöstem Profil-Snapshot auf. `diary.test.ts` prüft Erstzugriff, erhaltenen Tageskontext, Wiederholungs-GET und Profiländerung; `dayMetaRepository.test.ts` prüft idempotente Erhaltung. Cosmos-Contract-Abdeckung ist vorhanden, aber nicht ausgeführt (siehe Verification Notes). |
| AC-2 | PASS | Der historische GET-Pfad überspringt `ensureCalorieTargetSnapshot`. `diary.test.ts` prüft den Profil-Fallback für einen historischen Read und bestätigt, dass dafür kein DayMeta angelegt wird. |
| AC-3 | PASS | `resolveHistoricalTarget` wird im GET verwendet. `weeklyReviewCalculator.test.ts` prüft Snapshot-Priorität, gespeichertes Sonderaktivitätsziel und `unavailable`; `diary.test.ts` prüft zusätzlich `profile_fallback` und die Response-Felder Basisziel, Effektivziel, Bonus und Quelle. |
| AC-4 | PASS | `DiaryDayResponse.calorieTarget` ist optional und additiv; der Backend-Response liefert es. `diary.test.ts` serialisiert die Response und prüft, dass `targets` und `macroRanges` fehlen. Bei fehlendem Ziel wird `unavailable` mit null Basis-/Effektivziel geliefert; der interne Hint-Fallback wird nicht als Ziel exponiert. |
| AC-5 | PASS | `DiaryScreen.tsx` reicht Profil-Makroziele nur für heute an `DayStoryCard`; historische Kalorien kommen getrennt über `calorieTarget`. Die Karte verwendet nur `day_target_snapshot` und `special_activity_snapshot` als Kalorienziel. Mobile-Tests prüfen Snapshotvergleich und fehlende historische Makroziele. |
| AC-6 | PASS | `DayStoryCard.test.tsx` prüft `profile_fallback` und `unavailable`: kein Zielvergleich und kein angezeigter Zielwert. `DiaryScreen.f2.test.tsx` bestätigt, dass historische Tage keine aktuellen Profil-Makroziele erhalten. |
| AC-7 | PASS | Handler-, Repository-, Shared-Resolver-, API-Vertrags- und Mobile-Tests sind vorhanden. Fokussiert liefen Backend 311/311, Shared 23/23 und Mobile 31/31; die vollständigen Unit-Suiten liefen ebenfalls grün. Contract-Test-Datei vorhanden, Ausführung emulatorbedingt unverifiziert. Der unveränderte Heute-Fall ist durch `DiaryScreen.f2.test.tsx` abgedeckt. |

## Tests

Alle `npx.cmd`-Befehle wurden im jeweils genannten Paketverzeichnis ausgeführt.

| Command | Exit code | Result |
|---|---:|---|
| `backend: npx.cmd vitest run src/functions/diary.test.ts src/lib/repositories/dayMetaRepository.test.ts --reporter=dot --silent` | 0 | PASS, 311 Tests |
| `shared: npx.cmd vitest run lib/weeklyReviewCalculator.test.ts --reporter=dot --silent` | 0 | PASS, 23 Tests |
| `mobile: npx.cmd vitest run src/modules/nutrition/DiaryScreen.f2.test.tsx src/shared/components/DayStoryCard.test.tsx --reporter=dot --silent` | 0 | PASS, 31 Tests |
| `backend: npx.cmd vitest run --reporter=dot --silent` | 0 | PASS, 84 Dateien, 2717 Tests |
| `backend: npm.cmd run build:verify` | 0 | PASS, alle Build-Prüfungen bestanden |
| `backend: npx.cmd tsc --noEmit` | 0 | PASS |
| `shared: npx.cmd vitest run --reporter=dot --silent` | 0 | PASS, 10 Dateien, 466 Tests |
| `shared: npx.cmd tsc --noEmit` | 0 | PASS |
| `mobile: npx.cmd vitest run --reporter=dot --silent` | 0 | PASS, 108 Dateien, 1015 Tests |
| `mobile: npx.cmd tsc --noEmit` | 0 | PASS |
| `git diff --check` für featurebezogene Quell-, Test- und KB-Dateien | 0 | PASS; keine Whitespace-Fehler |
| `backend: npx.cmd vitest run --config vitest.contract.config.mts src/lib/repositories/cosmosDayMetaRepository.contract.test.ts` | N/A | NOT RUN; lokaler Cosmos-Emulator war nicht erreichbar |

## Verification Notes

- State: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`
- Reason: `Test-NetConnection 127.0.0.1:18081` ergab `False` (Prüfstatus 1); der lokale Cosmos-Emulator war nicht verfügbar.
- Manual action: Voraussetzung ist ein gestarteter lokaler Cosmos-Emulator, erreichbar unter `127.0.0.1:18081`. Danach im Verzeichnis `backend/` den Contract-Test mit `npx vitest run --config vitest.contract.config.mts src/lib/repositories/cosmosDayMetaRepository.contract.test.ts` ausführen. Erwartet werden zwei bestandene Fälle: fehlendes DayMeta wird idempotent angelegt, und ein bestehendes DayMeta erhält beim Snapshot-Write seine übrigen Felder. Ergebnis: **Ausstehend; nach Emulatorstart einzutragen.** Nicht gegen Dev oder Alpha ausführen.
- Der Emulator-Contract ist eine Verifikationsgrenze und kein Produktfehler; gemäß QA-Vorgabe senkt sie das Verdict nicht.

## Findings

No actionable findings.
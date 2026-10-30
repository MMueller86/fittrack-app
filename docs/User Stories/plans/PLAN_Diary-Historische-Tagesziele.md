# Plan: Historische Tagesziele im Ernährungstagebuch

## Confirmed Product Decision

**PO-1 — Anzeige bei Legacy-Tagen ohne gespeichertes Ziel (entschieden: A):** Wenn der Resolver `profile_fallback` liefert, zeigt die historische Diary-Karte keinen Kalorien-Zielvergleich und weder das aktuelle Profilziel als historisches Ziel noch als „aktuelles Profilziel“. `unavailable` zeigt ebenfalls keinen Zielvergleich. Die API darf `profile_fallback` weiterhin aus dem bestehenden Resolver liefern; Mobile unterdrückt die Vergleichsdarstellung für diese Quelle.

**Status:** Umsetzungsplan; PO-1 ist entschieden, und keine Produktentscheidung blockiert die geplanten Arbeitspakete.

Infrastructure Impact: None
Mobile Build Impact: None

Keine neue Azure-Ressource, kein Container und keine Bicep-Änderung. Reguläre Codeauslieferung ist nicht Bestandteil dieses Featureplans. Mobile-Änderung ist JavaScript/TypeScript ohne native Konfiguration.

## Requirement Assessment

**Einstufung:** Accept with modifications. Die bestehende historische Auflösung und Snapshot-Persistenz werden wiederverwendet. Für alte Tage ohne Snapshot darf die API den Profil-Fallback weiterhin mit `targetSource: profile_fallback` kennzeichnen; die historische Diary-Karte zeigt dafür gemäß bestätigter Produktentscheidung keinen Zielvergleich und kein Profilziel.

**Problem:** Bei historischen Tagebuchdaten zeigt die Zusammenfassung den Verbrauch, aber kein Ziel. Mobile reicht derzeit nur für heute ein Profilziel an `DayStoryCard` weiter. Die API liefert Tagesmetadaten, aber kein Zielobjekt.

**Zielverhalten:** Für Tage mit gespeichertem Snapshot oder kompatiblem Sonderaktivitätsziel zeigt die mobile Zusammenfassung den Verbrauch im Vergleich zum effektiven Kalorienziel des Tages. Das Backend liefert Basisziel, effektives Ziel, Aktivitätsbonus und Quelle. Fehlende historische Daten werden nicht als rekonstruierte Historie ausgegeben.

## Scope

- Für den ersten Diary-GET des angefragten lokalen aktuellen Tages einen fehlenden Kalorienziel-Snapshot absenzsicher im vorhandenen `DayMeta` anlegen; Tagestyp und Profilziel gemäß bestehender Tageskontextregel verwenden.
- Den existierenden `resolveHistoricalTarget`-Resolver im Diary-GET verwenden und sein Ergebnis als additives `calorieTarget`-Feld ausliefern.
- Shared Response-Typ und Mobile-Verbrauch des neuen Felds aktualisieren.
- Historische Kalorienvergleiche nur für gespeicherte Tages- und Sonderaktivitätsziele rendern. Für `profile_fallback` und `unavailable` keinen Zielvergleich und kein Ziel in der historischen Diary-Karte anzeigen; historische Makroziele nicht ableiten.
- Gezielte Backend-, Repository-/Cosmos-Contract-, Shared-Resolver- und Mobile-Tests.

## Out of Scope

- Massen-Backfill oder automatische Speicherung aktueller Profilwerte für vergangene Tage.
- Rekonstruktion historischer Makroziele, Änderung der Profilberechnung oder des Sonderaktivitätsmodells.
- Neue Cosmos-Container, Bicep-, Infrastruktur- oder native Mobile-Änderungen.
- Änderung der bestehenden expliziten Tagestyp-Schreibsemantik; diese bleibt eine bewusste Benutzeraktion und ist von automatischen historischen Reads zu unterscheiden.

## Confirmed Facts and Existing Components

- `DiaryScreen` setzt `todayTargets` nur für heute; historische Tage erhalten `null`. Ein bestehender Mobile-Test sichert dieses bisherige Verhalten ab.
- `getDiaryHandler` lädt DayMeta und Profil, verwendet Profilziele intern für Hints, liefert aber derzeit kein Tagesziel aus.
- `setDayTypeHandler` speichert bereits einen `calorieTargetSnapshot`; `DayMeta.calorieTargetSnapshot` ist optional und enthält `calories`, `capturedAt`, `source` sowie optional `profileUpdatedAt`.
- Sonderaktivitäten speichern `dailyCalorieTarget` und `activityBonus` in DayMeta.
- `resolveHistoricalTarget` aus `shared/lib/weeklyReviewCalculator.ts` löst Snapshot vor Sonderaktivitätsziel und Profil-Fallback auf. Bei einer Sonderaktivität ohne verwendbares Ziel bleibt das Ziel `unavailable`.
- Die KB erklärt fehlende Legacy-Snapshots für nicht rekonstruierbar; Profil-Fallbacks sind read-only und dürfen nicht als historische Tatsachen gelten.
- DayMeta liegt im vorhandenen `nutritionDiaryMeals`-Container, partitioniert nach `/userId`.

## Proposed Contract and Persistence

Diary-GET ergänzt `calorieTarget` mit genau diesen Feldern: `baseTargetCalories`, `effectiveTargetCalories`, `activityBonusCalories` (jeweils `number | null`) und `targetSource` (`day_target_snapshot | special_activity_snapshot | profile_fallback | unavailable`). Der Backend-Response liefert das Objekt immer; der Shared-Typ darf das additive Feld für Rollout-Kompatibilität optional abbilden. Der bestehende Resolver-Fallback darf API-seitig weiterhin als `profile_fallback` verfügbar sein. Mobile zeigt in der historischen Diary-Karte ausschließlich für `day_target_snapshot` und `special_activity_snapshot` einen Zielvergleich; `profile_fallback` und `unavailable` bleiben ohne Zielvergleich und ohne angezeigten Zielwert. Die bestehenden Felder `targets` und `macroRanges` werden nicht eingeführt.

Der erste GET mit `date === localDate` darf einen Snapshot nur dann anlegen, wenn noch keiner vorhanden ist und ein gültiges Profilziel existiert. Vorhandener Tagestyp, Workout-Typ, Sonderaktivität und Snapshot bleiben erhalten. Wiederholte Reads überschreiben den Snapshot nicht. Für `date !== localDate` schreibt der GET keinen Snapshot und backfilled keine Vergangenheit. Fehlt ein Profilziel, bleibt der Snapshot aus. Die aktuelle Resolver-Quelle wird unverändert ausgegeben.

**Persistence Impact:** Keine Schemaänderung; bestehendes optionales `DayMeta.calorieTargetSnapshot`-Feld, Class 0 / keine Migration. Alte Dokumente ohne Snapshot bleiben lesbar und werden nicht migriert oder nachträglich befüllt. Nutzung des bestehenden Containers und Partition Keys; kein neuer Container, keine Änderung an `cosmos.ts` oder Bicep. Die Repository-Operation für den aktuellen Tag muss „nur falls fehlend“ garantieren und bestehende DayMeta-Felder bewahren.

**Privacy Impact:** Policy covered. Data flow: aus Profil und Tagestyp abgeleitetes Kalorienziel → optionaler Snapshot im bestehenden, nutzerpartitionierten DayMeta-Dokument → Diary-GET an denselben authentifizierten Nutzer. Keine neue Empfängergruppe, kein KI-/Drittanbietertransfer, keine neue Aufbewahrung oder Logging-Daten. DayMeta bleibt von den bestehenden Diary-/Kontolöschregeln umfasst. Policy sections affected: „Welche Daten verarbeiten wir?“, „Wo und womit werden die Daten verarbeitet?“ und „Speicherdauer und Löschen“; diese decken Profil/Ziele, Ernährungstagebuch, Azure-Speicherung und Löschung bereits ab. Proposed text: N/A. Open questions: none.

## Acceptance Criteria

- **AC-1:** Beim Diary-GET für `date === localDate` wird ein gültiges Profilziel einmalig als Snapshot gespeichert, sofern DayMeta noch keinen gültigen Snapshot hat. Vorhandene Tageskontexte bleiben erhalten; Wiederholungs-GETs und spätere Profiländerungen überschreiben den Snapshot nicht.
- **AC-2:** Ein GET für ein anderes Datum führt keine automatische Snapshot-Schreiboperation aus. Insbesondere wird ein heutiger Profilwert nicht durch einen historischen Read als historischer Snapshot gespeichert.
- **AC-3:** Diary-GET liefert `calorieTarget` mit Basisziel, effektivem Ziel, Aktivitätsbonus und Quelle gemäß `resolveHistoricalTarget`. Die Priorität ist Snapshot, kompatibles gespeichertes Sonderaktivitätsziel, Profil-Fallback ohne Sonderaktivität, sonst `unavailable`.
- **AC-4:** Der Diary-Response erhält kein allgemeines `targets`- oder `macroRanges`-Feld. Fehlende Ziele werden als `null`/`unavailable` repräsentiert, nicht als Nullverbrauch oder erfundenes 2000-kcal-Ziel.
- **AC-5:** Mobile vergleicht historische Kalorien nur mit einem verfügbaren effektiven Ziel aus `day_target_snapshot` oder `special_activity_snapshot`. Historische Makroziele werden nicht aus dem aktuellen Profil übernommen; Makroverbrauch bleibt ohne historischen Zielwert.
- **AC-6:** `profile_fallback` und `unavailable` zeigen in der historischen Diary-Karte keinen Zielvergleich. Bei `profile_fallback` wird das aktuelle Profilziel auch nicht als historisches Ziel oder als „aktuelles Profilziel“ angezeigt; die API darf diese Quelle weiterhin liefern.
- **AC-7:** Tests decken aktuellen Erstzugriff, idempotente Snapshot-Erhaltung, historischen Read ohne Write, Resolver-Quellen einschließlich Sonderaktivität/Unavailable, den Response-Vertrag sowie Mobile-Rendering und den unveränderten Heute-Fall ab.

## Backend Work Package

**Agent:** Backend

**Goal:** Shared Diary-Zieltyp ergänzen, aktuellen Tages-Snapshot nur falls fehlend und ohne Verlust vorhandener DayMeta-Felder sicherstellen, Diary-GET über den bestehenden Resolver erweitern und Persistence/API-Tests ergänzen.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/functions/diary.ts`
- `backend/src/functions/diary.test.ts`
- `backend/src/lib/weeklyTargetSnapshot.ts`
- `backend/src/lib/dailyInsightContext.ts`
- `backend/src/lib/repositories/dayMetaRepository.ts`
- `backend/src/lib/repositories/cosmosDayMetaRepository.ts`
- `backend/src/lib/repositories/dayMetaRepository.test.ts`
- `shared/types/diary.ts`
- `shared/types/weeklyReview.ts`
- `shared/lib/weeklyReviewCalculator.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`
- `privacy-impact-review`

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-3, AC-4, AC-7

**Dependencies:** None.

**Expected Handoff:** Shared DTO/API-Feld und dessen Source-Enum; dokumentierte Snapshot-Bedingung; Backend- und Repository-Testresultate; Hinweis, dass `profile_fallback` unverändert mit Quelle ausgeliefert wird.

## Frontend Work Package

**Agent:** Frontend

**Goal:** DiaryScreen und DayStoryCard an `calorieTarget` anbinden. Für historische Tage mit echtem Snapshot oder gespeichertem Sonderaktivitätsziel den effektiven Kalorienzielvergleich anzeigen. Für `profile_fallback` und `unavailable` keinen Zielvergleich und keinen Zielwert darstellen; insbesondere das aktuelle Profilziel nicht als historisches oder aktuelles Profilziel in der historischen Karte anzeigen. Aktuelle Makroziele nicht als historische Ziele einsetzen.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`
- `mobile/src/shared/components/DayStoryCard.tsx`
- `mobile/src/shared/components/DayStoryCard.test.tsx`
- `mobile/src/shared/api/diaryApi.ts`
- `shared/types/diary.ts`

**Required Skills:**
- `privacy-impact-review`

**Relevant Acceptance Criteria:** AC-5, AC-6, AC-7

**Dependencies:** Backend-Handoff mit Shared-Typ und Diary-Response-Vertrag.

**Expected Handoff:** Source-bewusste Darstellung für gespeicherte Tages- und Sonderaktivitätsziele; `profile_fallback` und `unavailable` ohne Zielvergleich oder angezeigten Zielwert. Mobile-Testresultate einschließlich der Prüfung, dass kein aktuelles Profilziel in der historischen Karte erscheint.

## QA Work Package

**Agent:** QA

**Goal:** Gesamten API-, Persistenz- und UI-Vertrag gegen alle ACs prüfen; insbesondere sicherstellen, dass kein heutiges Profilziel durch historische Reads als echte Historie gespeichert oder dargestellt wird und `profile_fallback` sowie `unavailable` in der historischen Diary-Karte keinen Zielvergleich zeigen.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/functions/diary.ts`
- `backend/src/functions/diary.test.ts`
- `backend/src/lib/repositories/dayMetaRepository.ts`
- `backend/src/lib/repositories/cosmosDayMetaRepository.ts`
- `backend/src/lib/repositories/dayMetaRepository.test.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`
- `mobile/src/shared/components/DayStoryCard.test.tsx`
- `docs/legal/datenschutzerklaerung-alpha.md`

**Required Skills:**
- `cosmos-data-model-and-migration`
- `privacy-impact-review`

**Relevant Acceptance Criteria:** AC-1 through AC-7

**Dependencies:** Backend- und Frontend-Handoffs. Cosmos Contract Test gegen Emulator; kein Test gegen Dev- oder Alpha-Cosmos.

**Expected Handoff:** AC-genauer QA-Bericht mit Unit-, Mobile- und Cosmos-Contract-Ergebnissen; expliziter Nachweis, dass `profile_fallback` und `unavailable` ohne Zielvergleich dargestellt werden und kein aktuelles Profilziel in der historischen Karte erscheint.

## Recommended Execution Order

1. **Backend:** Shared Response-Typ zuerst festlegen, dann absenzsichere Snapshot-Erstellung und Diary-GET-Response; Backend-Unit- und Repository-Contract-Tests ergänzen. Das ist der verbindliche API-Handoff an Mobile.
2. **Frontend:** Nach Backend-Handoff den Response-Vertrag anbinden und gespeicherte historische Zielquellen darstellen; `profile_fallback` und `unavailable` ohne Zielvergleich behandeln.
3. **QA:** Backend, Shared, Mobile und Cosmos-Contract gegen AC-1 bis AC-7 prüfen, einschließlich der bestätigten Darstellung für `profile_fallback` und `unavailable`.

## Expected Handoff

- **Backend → Frontend:** `DiaryDayResponse.calorieTarget`-Vertrag, Source-Werte, Snapshot-Timing und Teststatus.
- **Frontend → QA:** Source-spezifische Zielanzeige und Mobile-Teststatus, einschließlich der neutralen Darstellung für `profile_fallback` und `unavailable`.
- **QA → Orchestrator:** AC-basierter Prüfbericht, Cosmos-Contract-Ergebnis und verbliebene Blocker.
- **Plan-Artefakt:** `docs/User Stories/plans/PLAN_Diary-Historische-Tagesziele.md`
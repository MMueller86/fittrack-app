# Plan-Addendum – Copy von gestern nach heute (US-01)

Status: Revision B (Same-Day-Copy) is explicitly approved; B4 Backend, F5 Frontend, and Q5 are complete. Q5 correction re-review: final QA `PASS`; `FT-QA-2026-062` is closed (report: `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl_Addendum_Same-Day-Copy_Revision-B.md`). No additional approval is required.
Revision B verification: Backend focused tests: 87 passed; full unit suite: 1,251 passed. Mobile focused tests: 22 passed; full suite: 639 passed. Backend/mobile typechecks and backend `build:verify` passed. Cosmos AC-SD-3 and AC-SD-7 runtime: `UNVERIFIED` (local emulator unavailable; 21 contract tests skipped before assertions).
Release status: No Azure/Dev deployment or Alpha release occurred.
Yesterday-to-today status: Revision A work packages F4 and Q4 are complete with final QA PASS (report: `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl_Addendum_Same-Day-Copy.md`). That PASS verifies Revision A only; it does not verify same-day copy.
Related approved plan: `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
Infrastructure Impact: Dev
Mobile Build Impact: None

> **Abgrenzung:** Die bestehenden Abschnitte 1–8 dokumentieren Revision A (gestern→heute) und bleiben als historischer QA-Nachweis erhalten. Die damaligen Aussagen „Same-Day out of scope“ und „gleiche Quelle-/Zieldaten werden abgelehnt“ beschreiben ausschließlich den von Q4 geprüften Stand. Revision B hebt diese Einschränkung ausdrücklich auf; der frühere PASS ist kein Nachweis für Revision B.

## 1. Bestätigter Nutzerfall (Revision A – historisch)

Der Nutzer hat klargestellt: Ein gestern gegessener Tagebucheintrag soll in das heutige Tagebuch kopiert werden; „Heute“ ist im Copy-Picker nicht auswählbar.

- Quelle: `sourceDate = gestern`.
- Ziel: `targetDate = heute` (lokales aktuelles Kalenderdatum).
- Damit gilt `sourceDate !== targetDate`. „Auf einen anderen Tag kopieren“ aus AC-7 des genehmigten Plans trifft genau diesen Fall.
- Same-Day-Copy mit `sourceDate === targetDate` war in Revision A nicht angefordert und wurde dort abgelehnt. Diese historische Einschränkung ist durch die explizit genehmigte Revision B in Abschnitt 9 aufgehoben.
- `targetDate === currentDate` ist nicht dasselbe wie `targetDate === sourceDate`; das heutige Zieldatum ist zulässig, wenn die Quelle gestern oder ein anderer Tag ist.

Eine Entscheidung darüber, ob das Ziel dieselbe Meal-ID wie eine Quellmahlzeit haben darf, ist für diesen Fall nicht erforderlich: Ein bestehendes Ziel muss zu `targetDate` gehören, während die ausgewählten Quellen zu `sourceDate` gehören. Bei gestern→heute sind das verschiedene Tage.

## 2. Verifizierte Ursache und Vertrag (Revision A – historisch)

### Backend und Knowledge Base

- `docs/kb/domain/02-diary.md` und `docs/kb/tech/09-api-reference.md` definieren Copy auf ein vom Quelltag verschiedenes Datum. Der API-Vertrag beschränkt das Zieldatum nicht auf vergangene Tage.
- `BulkCopyItemsSchema` validiert `sourceDate` und `targetDate` jeweils als echtes ISO-Datum, ohne sie mit dem heutigen Datum zu vergleichen. Der authentifizierte Handler delegiert anschließend an das Diary-Repository.
- In-Memory- und Cosmos-Repository lehnen ausschließlich `request.sourceDate === request.targetDate` ab. Ein vorhandenes Ziel muss `targetDate` entsprechen; ein neues Ziel wird mit `request.targetDate` angelegt. Daher ist gestern→heute vom bestehenden Backend-Contract erlaubt.
- Route, Request-/Response-Typen, Snapshot-Klon, Atomarität, PO-3-Usage und Health-Connect-Verhalten müssen nicht geändert werden.

### Mobile-Ursache

- `CopyItemSheet` ermittelt `today` über `getLocalIsoDate()`. `buildDateStrip(today)` baut ausschließlich die 14 vorherigen lokalen Kalendertage (`heute - 14` bis `heute - 1`); heute selbst kommt dort nicht vor.
- Die Schnellwahl enthält nur „Gestern“, „Vorgestern“ und „Vor 3 Tagen“. Beide Auswahlpfade filtern `sourceDate` aus. Wenn `sourceDate` gestern ist, wird „Gestern“ als Quelltag entfernt und es gibt keine „Heute“-Option.
- `CopyItemSheet.doCopy()` und `DiaryScreen.handleCopyItems()` blockieren nur `selectedDate === sourceDate` beziehungsweise `targetDate === date`. Für Quelle gestern und Ziel heute sind diese Daten verschieden; die Guards sind nicht die Ursache und bleiben bestehen.
- Die Mobile-KB beschreibt Copy als Ziel auf einen anderen Tag, aber keine Beschränkung auf vergangene Tage. Es gibt keinen KB/API-Konflikt.

**Ursache:** Der mobile Picker bietet das heutige Datum nicht an. Es liegt keine Backend-Sperre für ein anderes Zieldatum vor.

## 3. Scope und Freigabestatus (Revision A – historisch)

Dies ist eine Lücke in der Umsetzung der bestehenden, genehmigten AC-7 („auf einen anderen Tag kopieren“), keine neue Produktanforderung oder Änderung des Domain-/API-Vertrags. Die Freigabe des Ursprungsplans vom 2026-10-05 reicht für diesen konkreten Fix aus. Eine erneute PO-Entscheidung oder Planfreigabe ist nicht erforderlich.

Der dokumentierte QA-PASS des Ursprungsplans bleibt unangetastet; die konkrete Picker-Lücke muss nach dem Frontend-Fix gezielt durch QA geprüft werden. Der genehmigte Ursprungsplan und seine Acceptance Criteria werden nicht geändert.

Die vorherige offene Frage `PO-SC-1` zur Ziel-Meal-ID ist entfernt. Sie entstand aus der falschen Annahme `sourceDate === targetDate` und ist für gestern→heute nicht einschlägig. Es bleibt keine offene Produktentscheidung.

## 4. Gewünschtes Verhalten und Grenzen (Revision A – historisch)

- Wenn das lokale heutige Datum vom Quelltag verschieden ist, bietet der Copy-Datumsdialog „Heute“ als explizite Auswahl an.
- Die Auswahl lädt den Tagebuchtag für exakt das lokale heutige Datum. Der Nutzer wählt danach weiterhin genau eine vorhandene oder atomar neu anzulegende Zielmahlzeit.
- Der bestehende Bulk-Copy-Aufruf sendet unverändert `sourceDate`, `targetDate`, die aktuelle Auswahl und genau einen Zielselektor. Für den bestätigten Fall ist `sourceDate = gestern` und `targetDate = heute`.
- Die Datumsleiste der letzten 14 vergangenen Tage, die bestehenden Vergangenheits-Schnellwahlen und die übrige Datumsreichweite bleiben unverändert. Es werden keine zukünftigen Tage angeboten.
- Die Gleichheitsprüfung `targetDate !== sourceDate` bleibt in Mobile und Backend unverändert. Wenn die Quelle heute ist, bleibt heute als Ziel unzulässig.
- Snapshot-Erhalt, Zielmahlzeitenauswahl, atomare Neuanlage, Usage nach PO-3, Health-Connect-Sync nach Erfolg sowie Move-/Delete-Verhalten bleiben unverändert.

**Out of Scope:** Same-Day-Copy (`sourceDate === targetDate`), Änderungen am Ziel-Meal-/Quell-Meal-Verhältnis für denselben Tag, API-/Shared-Typ-/Backend-/Cosmos-Änderungen, Erweiterung des allgemeinen Datumsbereichs, Move/Delete-Änderungen und Änderungen am genehmigten Ursprungsplan.

## 5. Addendum Acceptance Criteria (Revision A – historisch)

1. **AC-T-1:** Ist `sourceDate` nicht das lokale heutige Datum, zeigt der Copy-Datumsdialog eine explizite, auswählbare Option „Heute“ mit genau dem Wert aus `getLocalIsoDate()`.
2. **AC-T-2:** Bei Quelle gestern und Ziel heute lädt die Auswahl den heutigen Tagebuchtag. Die Auswahl einer vorhandenen oder neu anzulegenden Zielmahlzeit ruft den vorhandenen Copy-Callback genau einmal mit `sourceDate = gestern`, `targetDate = heute`, den vollständigen Item-Referenzen und genau einem Zielselektor auf.
3. **AC-T-3:** Ist `sourceDate` bereits heute, wird heute nicht als auswählbares Copy-Ziel angeboten; bestehende Mobile- und Backend-Ablehnungen für `sourceDate === targetDate` bleiben bestehen.
4. **AC-T-4:** Die vorhandene Auswahlhistorie, Zielmahlzeitenauswahl und Erfolgs-/Fehlerbehandlung bleiben unverändert. Es gibt keine Änderung an Route, Request-/Response-Shape oder Backend-Verhalten.

Diese Kriterien konkretisieren für den bestätigten Picker-Fall das genehmigte Original-AC-7; sie ersetzen es nicht.

## 6. Frontend Work Package F4 (abgeschlossen, Revision A)

Agent: Frontend

Goal: Das lokale heutige Datum als Copy-Ziel anbieten, wenn es vom Quelltag verschieden ist, und den bestehenden Copy-Flow unverändert verwenden.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/modules/nutrition/CopyItemSheet.tsx
- mobile/src/modules/nutrition/CopyItemSheet.test.tsx
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx
- mobile/src/shared/date/localDate.ts
- mobile/src/shared/api/diaryApi.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- Original AC-7
- AC-T-1
- AC-T-2
- AC-T-3
- AC-T-4

Dependencies:
- Keine; der bestehende Copy-API-Handoff und Backend-Contract sind implementiert und verifiziert.

Expected Handoff:
- „Heute“ ist genau dann als lokales Copy-Zieldatum auswählbar, wenn es nicht dem Quelltag entspricht.
- Eine Regressionstest-Abdeckung belegt gestern→heute einschließlich Laden des heutigen Tages und Übergabe von exakt `sourceDate`/`targetDate` mit einem expliziten Ziel.
- Tests oder bestehende Abdeckung bestätigen, dass Quelle heute weiterhin nicht nach heute kopiert werden kann.
- Bestätigung, dass keine API-, Shared-, Backend-, Cosmos-, Infrastruktur- oder Knowledge-Base-Änderung vorgenommen wurde.
- Ergebnis des fokussierten Mobile-Tests und des Mobile-Typechecks.

## 7. QA Work Package Q4 (abgeschlossen, Revision A)

Agent: QA

Goal: Den bestätigten gestern→heute-Ablauf und die unveränderte Ablehnung von Same-Day-Copy gegen AC-T-1 bis AC-T-4 sowie Original-AC-7 prüfen.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/modules/nutrition/CopyItemSheet.tsx
- mobile/src/modules/nutrition/CopyItemSheet.test.tsx
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- Original AC-7
- AC-T-1
- AC-T-2
- AC-T-3
- AC-T-4

Dependencies:
- F4 abgeschlossen; Frontend-Test- und Typecheck-Ergebnisse liegen vor.

Expected Handoff:
- Fokussierter QA-Report mit Ergebnis und Evidenz für jedes relevante AC; Mobile-Testkommando, Exit-Code und Resultat sind aufgeführt.
- Der Report bestätigt, dass gestern→heute im vorhandenen Contract ein anderer Tag ist und dass kein Backend-/API-Fix erforderlich war.
- Same-Day-Copy bleibt explizit außerhalb des Scopes; kein Backend- oder Cosmos-Contract-Testlauf ist erforderlich, sofern Frontend-Änderungen den Vertrag nicht berühren.

## 8. Empfohlene Ausführungsreihenfolge F4/Q4 (abgeschlossen, Revision A)

1. Frontend führt F4 aus und liefert die Regressionstest- und Typecheck-Ergebnisse.
2. QA führt Q4 aus und dokumentiert den fokussierten Verifikationsbericht.

Kein Backend-Arbeitspaket ist vorgesehen. Nur falls eine spätere Verifikation entgegen dem aktuellen Code/API-Vertrag eine Backend-Ablehnung für `sourceDate !== targetDate` und `targetDate === heute` nachweist, ist die Implementierung zu stoppen und die Backend-Sperre dem Planner/Orchestrator als neue Planabweichung zu melden.

Der Planner hat keine Code- oder Testdateien geändert und keine Commands ausgeführt.

## 9. Revision B – Same-Day-Copy (explizit genehmigte Erweiterung)

### 9.1 Freigabe und aktueller Status

Der Nutzer hat Same-Day-Copy ausdrücklich freigegeben und die sofortige Umsetzung des Plans autorisiert. Diese Entscheidung erweitert den bestehenden Copy-Flow; sie ändert weder die bereits geprüften Ergebnisse für gestern→heute noch den genehmigten Ursprungsplan. Es gibt keine offene Product-Owner-Entscheidung und keinen weiteren Approval-Gate.

- Revision A: gestern→heute, F4 und Q4 abgeschlossen, QA PASS. Der PASS gilt weiterhin nur für den damaligen Umfang einschließlich der damals geprüften Gleichheitsablehnung.
- Revision B: Same-Day-Copy, noch nicht implementiert oder geprüft. B4, F5 und Q5 sind die neuen Arbeitspakete.
- `Infrastructure Impact: Dev` bedeutet hier, dass das geänderte Backend-Verhalten in der Development-Laufzeit verfügbar sein muss. Es sind keine Bicep-, Azure-Ressourcen- oder Cosmos-Konfigurationsänderungen vorgesehen.
- `Mobile Build Impact: None`: Es werden keine nativen Module, Config Plugins oder `app.config.js`-Änderungen geplant.

### 9.2 Bestätigtes Same-Day-Verhalten

- `sourceDate === targetDate` ist für Copy zulässig. Die Gleichheit ist kein Fehlerzustand mehr.
- Quelleinträge bleiben erhalten. Jeder Copy erzeugt ein eigenständiges `MealItem` mit einer neuen internen `id`; alle gespeicherten Snapshot- und Herkunftsfelder bleiben erhalten.
- Der Nutzer wählt weiterhin exakt ein Ziel: eine vorhandene Mahlzeit oder eine neu anzulegende Mahlzeit. Ein vorhandenes Ziel darf eine andere Mahlzeit desselben Tages sein oder exakt dieselbe `mealId` wie eine Quellmahlzeit haben.
- Wählt der Nutzer die Quell-Meal-ID selbst, bleibt das vorhandene Meal-Dokument bestehen und die Kopie wird mit neuer Item-ID an dessen `items` angehängt. Originale und nicht ausgewählte Items bleiben unverändert und erscheinen nicht doppelt.
- Wählt der Nutzer eine andere bestehende Mahlzeit desselben Tages, bleiben alle Quell-Meals unverändert; nur das explizite Ziel erhält die neuen Items. Eine neue Zielmahlzeit wird gemeinsam mit den Kopien atomar erstellt.
- Jede erneute, separat ausgelöste Copy-Aktion erzeugt eine weitere eigenständige Kopie mit neuer ID. Es wird keine Deduplizierung und kein Idempotency-Key ergänzt. Die bestehende Ablehnung doppelter identischer `{ mealId, itemId }`-Referenzen innerhalb eines einzelnen Requests bleibt dagegen bestehen.
- PO-2 bleibt unverändert: Diary-Schreibvorgänge sind all-or-nothing. PO-3 bleibt unverändert: referenzierte Usage wird nur nach erfolgreichem Diary-Commit best effort mit `targetMeal.date` und `targetMeal.type` aufgezeichnet; ein Usage-Fehler rollt den Diary-Commit nicht zurück.
- Die bisherige Option gestern→heute bleibt verfügbar. Zusätzlich muss `sourceDate` als explizites Same-Day-Zieldatum auswählbar sein, unabhängig davon, ob das Datum heute oder älter ist. Die Zielmahlzeit wird weiterhin erst nach der Datumsauswahl gewählt.

### 9.3 Verifizierte technische Ausgangslage

**Backend/API**

- `BulkCopyItemsSchema` in `backend/src/functions/diary.ts` validiert `sourceDate` und `targetDate` einzeln als ISO-Datum und validiert weiterhin genau einen Target-Selector. Das Schema vergleicht die Daten nicht miteinander; die Route und Request-/Response-Form müssen nicht geändert werden.
- `bulkCopyItemsHandler` authentifiziert über `requireUser()`, delegiert die Mutation an das Repository und startet `recordCopiedDiaryItemUsages()` erst nach erfolgreichem Repository-Commit.
- Die einzige Gleichheitsablehnung liegt aktuell in `InMemoryDiaryRepository.bulkCopyItems()` und `CosmosDiaryRepository.bulkCopyItems()`. Die vorhandene Handler-Regression erwartet deshalb heute bei gleicher Quelle/Ziel-Datum `400 invalid_diary_bulk_request`.
- Beide Repository-Pfade klonen gespeicherte Snapshots mit neuer Item-ID. Der In-Memory-Pfad kann ein gleiches Source-/Target-Meal im selben Tageszustand ersetzen und dabei Items anhängen. Der Cosmos-Pfad schreibt Copy-seitig nur das Ziel-Meal: bei vorhandenem Ziel genau ein `Replace`, geschützt durch dessen gelesenen ETag; bei neuem Ziel genau ein `Create`.
- Wenn Source- und Target-Meal dieselbe ID haben, enthält der aktuelle Cosmos-Lesepfad dieselbe ID zweimal in `mealIdsToRead` und liest das Dokument doppelt. `recordsById` führt die Ergebnisse später auf eine ID zusammen. B4 muss die Meal-IDs vor dem Lesen deduplizieren, sodass Source-Snapshot, Zielzustand und der für das einzelne `Replace` verwendete ETag garantiert aus demselben Read stammen. Der Same-Meal-Pfad darf keine doppelte Batch-Operation erzeugen.
- `groupDiaryItemReferences()` weist leere beziehungsweise doppelte identische Referenzen zurück. Das bleibt auch bei Same-Day-Copy verpflichtend. Zwei getrennte erfolgreiche Requests für dieselbe Quelle sind dagegen zwei gewünschte Einträge und müssen unterschiedliche IDs erhalten.
- Der bestehende Copy-Handler liest die neu kopierten Items aus den letzten `copiedCount` Items der Zielmahlzeit für PO-3-Tracking. Da Copy die Klone anhängt und nicht sortiert oder dedupliziert, gilt dieselbe Logik auch dann, wenn Source und Target dasselbe Meal-Dokument sind.
- Authentifizierung, `userId`-Partitionierung, Quell-/Zieldatum-Zuordnung, ETag-Konflikte, Batch-Limits und nicht unterscheidende Fremd-/Unbekannt-Referenzfehler bleiben bestehen. Kein Request-Feld wird als `userId`-Autorität eingeführt.

**Mobile**

- `CopyItemSheet` entfernt `sourceDate` aktuell aus Datumsleiste und Schnellwahl; der „Heute“-Schnellzugriff fehlt außerdem, wenn die Quelle heute ist. `doCopy()` und `DiaryScreen.handleCopyItems()` blockieren derzeit `selectedDate === sourceDate` beziehungsweise `targetDate === date`.
- `DiaryScreen` lädt nach erfolgreicher Copy bereits den Quelltag neu und synchronisiert die vom Backend zurückgegebenen kopierten IDs nach erfolgreichem Commit. Bei Same-Day ist das derselbe angezeigte Tag; Route, API-Client und Payload bleiben unverändert.
- Das Zielmenü muss die Quellmahlzeit bei Same-Day nicht ausschließen. Der Nutzer kann dieselbe Meal-ID, eine andere bestehende Mahlzeit desselben Datums oder eine neue Mahlzeit wählen.

**Persistence/API-Kompatibilität**

- Keine Änderung an `shared/types/diary.ts`, Route, HTTP-Methode, Request-/Response-Shape oder Zod-Datumsformat ist erforderlich. Gleichheit wird nur nicht länger als Bulk-Copy-Fehler behandelt.
- Es werden ausschließlich bestehende `Meal`-/`MealItem`-Felder und der vorhandene `nutritionDiaryMeals`-Container mit Partition Key `/userId` verwendet. Keine neue Entität, kein Feld, Container, Partition Key, Migration oder `infra/modules/cosmos.bicep`-Änderung.

### 9.4 Aktueller Scope und Out of Scope

**In Scope**

- Backend-Gleichheitsguards für Copy entfernen und Same-Day in In-Memory- und Cosmos-Mutation unterstützen.
- Den Cosmos-Lesezugriff für die Überschneidung von Source- und Target-Meal-ID auf einen Read mit einem konsistent verwendeten ETag begrenzen.
- Handler-, Repository- und Cosmos-Contract-Tests für gleiches Datum, gleiches Meal, anderes Same-Day-Meal, neue Same-Day-Zielmahlzeit, ETag-Konflikt, neue Item-IDs, Snapshot-Erhalt, doppelte Referenzen und wiederholte Einzelrequests ergänzen oder aktualisieren.
- Im Mobile-Picker `sourceDate` explizit als auswählbares Zieldatum anbieten, beide Gleichheitsguards für Copy entfernen und den existierenden Ein-Ziel-Flow sowie Erfolgs-/Fehlerbehandlung weiterverwenden.
- Regression für gestern→heute erhalten. Den bestehenden API-Client und den bestehenden Bulk-Copy-Contract weiterverwenden.
- Knowledge Base aktualisieren: `docs/kb/domain/02-diary.md` und `docs/kb/tech/09-api-reference.md` durch Backend; `docs/kb/tech/03-mobile.md` durch Frontend. QA läuft erst, wenn Implementierung, Tests und diese KB-Updates vorliegen.

**Out of Scope**

- Änderungen an Move/Delete, Auswahlmodell, anderen Datumsbereichen, zukünftigen Zieldaten, API-/Shared-Typen oder Antwortfeldern.
- Mehrere Zielmahlzeiten pro Request, neue Idempotency-/Deduplizierungssemantik, neue MealItem-Felder, neue Cosmos-Ressourcen oder Datenmigration.
- Änderung an PO-2/PO-3, Tracking-Taxonomie, Authentifizierung, Health-Connect-Vertrag oder dem genehmigten Ursprungsplan.
- Neue Product-Owner-Entscheidung oder zusätzliche Planfreigabe.

### 9.5 Acceptance Criteria der Revision B

- **AC-SD-1:** Ein gültiger authentifizierter Bulk-Copy-Request mit `sourceDate === targetDate` wird für ein existierendes Ziel angenommen. Route, Target-Selector und Request-/Response-Shape bleiben unverändert; ungültige ISO-Daten, unbekannte Felder und fehlende Authentifizierung werden weiterhin abgelehnt.
- **AC-SD-2:** Beim Kopieren in eine andere bestehende Mahlzeit desselben Tages bleiben sämtliche Quell-Meals und deren Items byte-/wertgleich. Jedes Ziel-Item entspricht dem ausgewählten gespeicherten Snapshot außer der neuen, eindeutigen `id`; vorhandene Ziel-Items bleiben erhalten.
- **AC-SD-3:** Wenn Target- und Source-Meal dieselbe ID haben, bleiben alle ursprünglichen Items einschließlich ihrer IDs genau einmal erhalten. Die ausgewählten Items werden mit neuen, untereinander eindeutigen IDs an genau dieses Meal angehängt; nicht ausgewählte Items und andere Meal-Felder bleiben erhalten. Der Cosmos-Pfad führt genau ein `Replace` mit dem ETag desselben gelesenen Meal-Dokuments aus.
- **AC-SD-4:** Eine neu gewählte Zielmahlzeit desselben Tages wird zusammen mit allen Snapshot-Kopien in einer atomaren Mutation angelegt. Ungültige Referenzen, ETag-Konflikte und Batch-Limits lassen weder eine teilweise Kopie noch ein leeres neues Ziel-Meal zurück.
- **AC-SD-5:** Zwei getrennte erfolgreiche Copy-Requests derselben Quelle erzeugen zwei neue Diary-Einträge mit verschiedenen IDs; es gibt keinen serverseitigen Idempotency-Key und keine Deduplizierung über Requests hinweg. Eine doppelte identische Referenz innerhalb eines einzelnen Requests bleibt `400 invalid_diary_bulk_request` und schreibt nichts.
- **AC-SD-6:** Copy akzeptiert weiter genau ein vorhandenes Ziel oder `newMealType`. Quellreferenzen gehören zum authentifizierten Nutzer und `sourceDate`; ein bestehendes Ziel gehört demselben Nutzer und `targetDate`. Fremde/nicht vorhandene Referenzen, ungültige Target-Selector und fehlende Authentifizierung mutieren keine Diary-Meals.
- **AC-SD-7:** Bei konkurrierender Änderung desselben Same-Meal-Zieldokuments führt der stale ETag zu `409 diary_bulk_conflict`; es gibt keine Kopie aus dem abgelehnten Request und keine Usage-Nebenwirkung. Der Backend-Test belegt, dass Source und Target für die gleiche Meal-ID denselben einmal gelesenen Dokumentstand/ETag verwenden und nur eine Batch-Operation entsteht.
- **AC-SD-8:** Copy-Usage wird erst nach erfolgreichem Diary-Commit je kopiertem referenziertem Item mit dem tatsächlichen `targetMeal.date` und `targetMeal.type` angestoßen. Ein abgelehnter/konfligierter Same-Day-Commit erzeugt keine Usage; best-effort-Trackingfehler rollen einen erfolgreichen Commit nicht zurück.
- **AC-SD-9:** Der Mobile-Picker bietet `sourceDate` als klar auswählbares Same-Day-Zieldatum an, auch wenn es heute ist oder nicht in der bisherigen 14-Tage-Leiste liegt. Nach Auswahl lädt er genau diesen Tag und ermöglicht dieselbe Quell-Meal-ID, eine andere bestehende Same-Day-Mahlzeit oder eine neue Zielmahlzeit. Der Copy-Callback/API-Aufruf erfolgt einmal mit `sourceDate === targetDate`, allen ausgewählten Referenzen und genau einem Zielselector. Erfolg lädt den angezeigten Tag neu und synchronisiert ausschließlich die neuen Copy-IDs.
- **AC-SD-10:** Die Regression gestern→heute aus Revision A bleibt grün: „Heute“ ist bei einer von heute verschiedenen Quelle weiter auswählbar, und die bestehende Anfrage verwendet exakt `sourceDate = gestern`, `targetDate = heute` sowie genau ein Ziel. Das frühere AC-T-3 zur Gleichheitsablehnung wird nur als Revision-A-Evidenz geführt und ist kein aktuelles Soll-Verhalten.

### 9.6 Testmatrix und erforderliche Testkommandos

| Bereich | Fälle und erwartete Evidenz |
|---|---|
| Backend Handler | Gleiche Daten werden mit unverändertem Request-Shape angenommen; Auth, ISO-Schema, unbekannte Felder und Zielselector bleiben korrekt validiert. |
| In-Memory Repository | Gleiches Datum mit anderer Ziel-Meal-ID, Source-Meal-ID als Ziel und neuem Ziel; Quelle/Snapshot/IDs erhalten; zwei getrennte Requests erzeugen getrennte IDs; exakte doppelte Referenz bleibt atomar ungültig. |
| Cosmos Contract | Same-Meal-ID erzeugt genau einen ETag-geschützten Replace; Same-Day anderes Ziel und neues Ziel funktionieren; konkurrierender Same-Meal-Write liefert Konflikt ohne Teilmutation. Emulator erforderlich. |
| Usage | Same-Day-Zieldatum/-mahlzeit werden erst nach Commit verwendet; abgelehnter Commit löst keine Usage aus; Tracking bleibt best effort. |
| Mobile | `sourceDate` ist als Same-Day auswählbar; bestehende Quellmahlzeit, anderes Meal und `newMealType` bleiben wählbar; Payload, Reload und Health-Connect-IDs sind korrekt. gestern→heute bleibt Regression. |
| Typen | Backend und Mobile typechecken; Shared-Typen bleiben unverändert. |

Kommandos für Backend-Implementierung und QA:

```text
npm --prefix backend test -- src/functions/diary.test.ts src/lib/repositories/diaryRepository.test.ts
npm --prefix backend test
npm --prefix backend run test:contract -- src/lib/repositories/cosmosDiaryRepository.contract.test.ts
npm --prefix backend run typecheck
```

Kommandos für Frontend-Implementierung und QA:

```text
npm --prefix mobile test -- src/modules/nutrition/CopyItemSheet.test.tsx src/modules/nutrition/DiaryScreen.f2.test.tsx
npm --prefix mobile test
npm --prefix mobile run typecheck
```

Der Cosmos-Contract-Test benötigt den Cosmos-Emulator und darf nicht gegen Azure laufen. Ist der Emulator nicht verfügbar, weist der jeweilige Agent den Contract-Test als `UNVERIFIED` aus; das ist kein PASS. Es gibt keine Shared-Code-Änderung und deshalb keinen Shared-Testlauf. Live-AI-Evals, native Build-Tests und Infrastruktur-Tests sind nicht anwendbar.

### 9.7 Backend Work Package B4 – Same-Day Copy Mutation

Agent: Backend

Goal: Den vorhandenen Bulk-Copy-Contract für `sourceDate === targetDate` freigeben und In-Memory-/Cosmos-Mutationen samt ETag-, Duplikat- und Usage-Verhalten für dasselbe oder ein anderes Same-Day-Ziel absichern. Die API-Form bleibt unverändert.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/lib/repositories/diaryRepository.ts
- backend/src/lib/repositories/diaryRepository.test.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts
- shared/types/diary.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-SD-1
- AC-SD-2
- AC-SD-3
- AC-SD-4
- AC-SD-5
- AC-SD-6
- AC-SD-7
- AC-SD-8

Dependencies:
- Keine; Same-Day-Freigabe ist erteilt. Revision A/F4/Q4 bleibt abgeschlossener Vorgänger und ist kein Same-Day-Implementierungsnachweis.

Expected Handoff:
- Entfernte Gleichheitsablehnung in beiden Diary-Repositories; unverändertes Zod-/API-/Shared-Schema.
- Cosmos liest eine Meal-ID, die zugleich Quell- und Ziel-Meal ist, nur einmal und verwendet diesen Meal-Snapshot/ETag für genau ein atomisches `Replace`.
- Handler-, In-Memory- und Cosmos-Contract-Regressionen für AC-SD-1 bis AC-SD-8 einschließlich Same-Meal-Ziel, doppelter Referenzen, erneuter Requests und ETag-Konflikt.
- `docs/kb/domain/02-diary.md` und `docs/kb/tech/09-api-reference.md` beschreiben Gleichheitszulassung, gleiche-Meal-ID-Semantik, frische IDs, Wiederholungen und unveränderte Atomaritäts-/Usage-Grenzen.
- Ergebnisse der fokussierten Backend-Tests, vollständigen Backend-Unit-Suite, des Cosmos-Contract-Tests und Backend-Typechecks.
- Bestätigung: keine Änderung an Shared-Types, Cosmos-Schema, Container, Partition Key, Migration oder IaC.

### 9.8 Frontend Work Package F5 – Same-Day Copy Picker

Agent: Frontend

Goal: Das Quelltag-Datum als explizites Same-Day-Ziel anbieten und die Mobile-Gleichheitsguards entfernen, während die Auswahl genau einer existierenden oder neu anzulegenden Zielmahlzeit und der bestehende API-/Sync-Flow erhalten bleiben.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/modules/nutrition/CopyItemSheet.tsx
- mobile/src/modules/nutrition/CopyItemSheet.test.tsx
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx
- mobile/src/shared/date/localDate.ts
- mobile/src/shared/api/diaryApi.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-SD-2
- AC-SD-3
- AC-SD-4
- AC-SD-9
- AC-SD-10

Dependencies:
- B4 abgeschlossen; Backend-Handoff und die aktualisierten Diary-/API-KB-Dokumente liegen vor.

Expected Handoff:
- `sourceDate` ist unabhängig von der aktuellen Date-Strip-Reichweite eindeutig als Same-Day-Ziel auswählbar; Auswahl lädt den exakten Quelltag.
- Dieselbe Quellmahlzeit ist im Zielschritt auswählbar; andere bestehende Same-Day-Meals und `newMealType` bleiben verfügbar. Genau ein Selector wird weitergesendet.
- Mobile-Gleichheitsguards blockieren Same-Day nicht; bestehende Copy-API-Shape, Fehler-/Success-Verhalten und Health-Connect-Upsert neuer Item-IDs bleiben erhalten.
- Regressionstests belegen Same-Day mit Source-Meal-ID, anderer Zielmahlzeit und neuem Ziel sowie gestern→heute.
- `docs/kb/tech/03-mobile.md` beschreibt Same-Day-Auswahl und das unveränderte Single-Target-Verhalten.
- Ergebnisse der fokussierten und vollständigen Mobile-Tests sowie des Mobile-Typechecks.

### 9.9 QA Work Package Q5 – Revision B Verification

Agent: QA

Goal: Nach Abschluss von B4/F5 und sämtlichen Source-, Test- und KB-Änderungen Same-Day-Copy gegen AC-SD-1 bis AC-SD-10 prüfen und den Revision-A-QA-PASS klar von der neuen Revision-B-Verifikation trennen.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/lib/repositories/diaryRepository.ts
- backend/src/lib/repositories/diaryRepository.test.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts
- mobile/src/modules/nutrition/CopyItemSheet.tsx
- mobile/src/modules/nutrition/CopyItemSheet.test.tsx
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-SD-1
- AC-SD-2
- AC-SD-3
- AC-SD-4
- AC-SD-5
- AC-SD-6
- AC-SD-7
- AC-SD-8
- AC-SD-9
- AC-SD-10

Dependencies:
- B4 und F5 abgeschlossen; alle Regressionstests und die drei vorgesehenen Knowledge-Base-Updates liegen vor. QA wird nicht vor diesen Änderungen gestartet.

Expected Handoff:
- Separater QA-Report für Revision B mit Ergebnis und konkreter Evidenz je AC-SD-ID; der bestehende Revision-A-Report und dessen PASS werden nicht umgedeutet.
- Testkommandos, Exit-Codes und Resultate aus Backend-Unit-, Cosmos-Contract-, Mobile-Test- und Backend-/Mobile-Typecheck sind aufgeführt.
- Explizite Prüfung des Same-Meal-ID-Falls, der einzelnen ETag-geschützten Cosmos-Mutation, fehlender Teilmutation/Usage bei Konflikt, wiederholter Kopien mit unterschiedlichen IDs und des fortbestehenden gestern→heute-Flows.
- Knowledge-Base-Änderungen zu Diary, API und Mobile sind gegen das implementierte Verhalten geprüft. Fehlender Cosmos-Emulator wird als `UNVERIFIED` dokumentiert und nie als PASS gewertet.

### 9.10 Empfohlene Ausführungsreihenfolge und Freigabe

1. **B4 Backend** – Mutation, Regressionstests und Diary-/API-KB-Updates abschließen.
2. **F5 Frontend** – Same-Day-Picker, Mobile-Regressionstests und Mobile-KB-Update abschließen.
3. **Q5 QA** – erst danach vollständigen Revision-B-Umfang prüfen und separaten QA-Report erstellen.

Revision B ist durch die ausdrückliche Nutzerfreigabe bereits approved. Es ist keine weitere Freigabe durch Product Owner oder Orchestrator erforderlich, bevor B4 beginnt. Revision A bleibt `QA PASS`; Revision B bleibt bis zum Abschluss von Q5 `implementation pending`.

Der Planner hat ausschließlich dieses Plan-Dokument aktualisiert. Es wurden keine Produktionscode-, Test- oder Knowledge-Base-Dateien geändert und keine Commands oder Tests ausgeführt.
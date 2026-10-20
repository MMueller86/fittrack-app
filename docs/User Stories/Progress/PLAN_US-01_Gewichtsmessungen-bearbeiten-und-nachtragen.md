# Technischer Plan: US-01 Gewichtsmessungen bearbeiten und nachtragen

**Story:** [US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md](US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md)  
**Status:** Vom Nutzer automatisch freigegeben; B-1 abgeschlossen und Handoff geliefert; F-1 und Q-1 ausstehend. Keine offenen PO-Entscheidungen.  
Infrastructure Impact: Dev  
Mobile Build Impact: None

## 1. Anforderungsbewertung

**Originalauftrag:**
> "Gefällt mir sehr gut. Wenn man über dne Kalendar einen Tag editiert/nachträgt, sollte geprüft werdne, ob für den Tag schon ein Wert vorliegt, und diese angezeigt werden. So das aus speichern dann ein aktualisieren wird. Setze das um"

Das Ziel ist, bestehende Gewichtsmessungen beim Tagesworkflow zu laden und gezielt zu bearbeiten, statt beim Speichern unbemerkt einen weiteren Datensatz anzulegen. Die Anforderung wird angenommen. Wegen der erlaubten Mehrfachmessungen pro Datum muss die Bearbeitung explizit eine Messungs-ID ansprechen; ein automatisches Update des ersten oder neuesten Tageswerts wäre nicht sicher genug. Keine KI, neue Persistenzentität oder neue native Abhängigkeit ist erforderlich.

## 2. Gewählte Produktempfehlung

- Der Progress-Bereich startet mit dem lokalen heutigen Datum. Ohne heutigen Eintrag bleibt die kompakte kg-Eingabe mit `Speichern` sichtbar.
- Sobald heute mindestens ein Eintrag vorliegt, zeigt die Karte die heutigen Messungen einzeln und blendet die dauerhaften Eingabefelder aus. Jeder Wert öffnet die Bearbeitung genau dieses Eintrags.
- Eine dezente Kalenderaktion öffnet einen Datums-/Tagesdialog. Heute und vergangene Tage sind auswählbar; zukünftige Tage sind deaktiviert.
- Der gewählte Tag zeigt alle vorhandenen Messungen als separate, einzeln adressierbare Zeilen. Ein leerer Tag zeigt die Eingabe mit `Speichern`; bei vorhandenen Einträgen startet `Weitere Messung` ausdrücklich einen neuen Eintrag.
- Beim Bearbeiten ist der bestehende Wert vorausgefüllt und die Aktion heißt `Aktualisieren`. Das Update ändert nur den Wert der ausgewählten ID. Datum, Einheit, ID und `createdAt` bleiben erhalten. Der Edit-Input verwendet die gespeicherte Einheit; neue Eingaben bleiben wie bisher kg.
- Mehrere Einträge desselben Tages werden nie zusammengeführt oder anhand ihrer Reihenfolge implizit ausgewählt. Zeilen und Accessibility-Labels müssen auch gleiche Zahlenwerte einzeln auswählbar machen.

Diese Empfehlung setzt die vom Nutzer bestätigte UX um und löst die Mehrfachmessungsfrage ohne zusätzliche Produktentscheidung.

## 3. Feature und aktuelles Verhalten

`GET /api/weights` liefert die nutzereigene Historie, `POST /api/weights` legt mit neuer UUID eine Messung an und `DELETE /api/weights/{id}` löscht eine ID. Der zuvor fehlende Update-Endpunkt wurde durch B-1 ergänzt: `PUT /api/weights/{id}` ist authentifiziert, adressiert die Messung über `(id, userId)`, ändert ausschließlich `value` und liefert für unbekannte oder fremde IDs `404`. Cosmos verwendet weiterhin den vorhandenen `weights`-Container mit Partition Key `/userId`; die Laufzeitprüfung des Cosmos-Persistenzpfads ist wegen des lokal nicht verfügbaren Emulators `UNVERIFIED` (siehe Teststrategie). Mehrere Messungen pro Tag sind ausdrücklich erlaubt.

`ProgressScreen` lädt die ganze Historie und speichert über `POST` immer einen neuen kg-Eintrag. `ProgressHeroCard` zeigt die Eingabe dauerhaft. Es gibt keinen Gewichtskalender; `HistoryList` zeigt Messungen mit Löschen, aber ohne Bearbeiten. `addWeight` unterstützt bereits ein explizites Datum. Die App hat vorhandene Modal-/Sheet-Muster und lokale Datumsfunktionen, aber keine Kalender-Abhängigkeit im Mobile-Paket.

## 4. Umfang und Nicht-Ziele

**Im Umfang:** gezieltes Backend-Update, Anzeige und Auswahl aller Messungen eines Tages, heutige Kompaktzustände, Kalenderzugang für heute/vergangene Tage, explizites Nachtragen, Tests sowie die betroffenen Knowledge-Base-Dokumente.

**Nicht im Umfang:** Änderung des WeightEntry-Schemas, Zusammenführen/Deduplizieren von Einträgen, Änderung der Gewichtsstatistik oder Diagrammberechnungen, Löschen über den neuen Flow, Import von Health-Connect-Daten, neue native Pakete, Cosmos-Migration, Bicep-/Containeränderung, Alpha-Deployment oder Deploymentfreigabe.

## 5. Bestätigte Fakten und Annahmen

- `WeightEntry` besitzt `id`, `userId`, Datum, Wert, Einheit und `createdAt`; die Einheit ist `kg` oder `lbs`.
- Mobile-Neueinträge werden in kg angelegt. Updates sollen die Einheit des ausgewählten vorhandenen Datensatzes beibehalten; es gibt keine Einheitenumschaltung.
- Die bestehende Weight-API listet die vollständige nutzereigene Historie, daher ist für den ausgewählten Tag kein neuer GET-Endpunkt nötig. Mobile filtert exakt nach `date`.
- Datumswerte werden lokal als `YYYY-MM-DD` behandelt. Der Kalender verwendet `getLocalIsoDate()` und vorhandene lokale Kalenderarithmetik statt UTC-Tagesdifferenzen.
- Kein offener PO-Punkt: der Nutzer hat eine fundierte Empfehlung ausdrücklich freigegeben. Das Kalenderende ist heute; zukünftige Gewichtseinträge werden im UI nicht angeboten.

## 6. Wiederzuverwendende Komponenten

- `ProgressScreen`, `ProgressHeroCard`, `HistoryList` und `weightsService` für bestehende Progress-Daten, Darstellung und Mutation.
- `getLocalIsoDate`, `addLocalDays` und `isValidDateOnly` für datumssichere Navigation.
- Vorhandene Modal-/Sheet- und Theme-Muster, insbesondere die Tagesauswahl in `CopyItemSheet`; Kalenderzellen werden mit vorhandenen React-Native-Primitiven gerendert.
- `healthSyncService.syncWeightUpsert()` auch nach einem Update, damit Health Connect dieselbe Client-ID aktualisiert.

## 7. Technische Lösung

### Backend und API

Ergänze in `backend/src/functions/weights.ts` einen authentifizierten `PUT /api/weights/{id}`-Handler. Der Request ist `{ "value": number }`, validiert mit derselben positiven Gewichtsgrenze wie beim Anlegen. Erfolgreich liefert der Handler `200` und den aktualisierten `WeightEntry`. Ungültiger Body/fehlende ID ergibt `400`; nicht vorhandene oder einem anderen Nutzer gehörende ID ergibt `404 { "error": "Entry not found" }`. `requireUser()`, `parseBody()` und `withHandler()` bleiben die bestehenden Sicherheits- und Handlergrenzen.

Ergänze `WeightsRepository.updateValue(userId, id, value): Promise<WeightEntry | null>`. Die In-Memory-Implementierung aktualisiert exakt diese ID im Nutzerbestand. Die Cosmos-Implementierung adressiert `item(id, userId)` und aktualisiert ausschließlich `/value`; Cosmos-404 wird als `null` zurückgegeben. Der Handler vertraut weder einer clientseitigen userId noch einem clientseitigen Datum. POST und DELETE bleiben unverändert.

### Mobile

Ergänze `updateWeight(id, value)` in `mobile/src/services/weightsService.ts` mit `apiClient.put('/weights/{id}', { value })`. Erstelle einen feature-lokalen `WeightCalendarSheet` unter `mobile/src/modules/progress/`: eine kompakte Monatsauswahl mit Tagesansicht, basierend auf vorhandenen Modal-/Sheet-Mustern und ohne neue Abhängigkeit.

`ProgressScreen` hält das ausgewählte Datum und die ausgewählte Messungs-ID getrennt. Der Tag wird aus der geladenen Historie gefiltert. Die heutige Karte zeigt bei null Einträgen die vorhandene kg-Eingabe; bei einem oder mehreren Einträgen zeigt sie deren Werte einzeln, ohne dauerhafte Eingabefelder. Antippen eines Werts öffnet den Sheet-Editor für genau diese ID. In der Tagesansicht führen leere Tage zu `Speichern`; vorhandene Zeilen bieten je ein `Bearbeiten`, und `Weitere Messung` startet einen separaten POST.

Ein neuer Eintrag sendet immer das explizite ausgewählte Datum. Ein Update sendet nur die ausgewählte ID und den eingegebenen Wert; die gespeicherte Einheit wird in der Edit-Anzeige gezeigt und bleibt serverseitig unverändert. Nach Erfolg ersetzt Mobile genau diese ID in `entries` und ruft `syncWeightUpsert()` mit der zurückgegebenen Messung auf. Bei Fehler bleibt der ursprüngliche Datensatz erhalten und die bestehende Fehlerdarstellung bietet eine verständliche Rückmeldung. Die History-Löschfunktion und bestehenden Statistik-/Diagrammformeln bleiben unverändert.

### Persistence Impact

Keine Änderung der Dokumentform oder des Partition Keys: Es wird nur das bestehende Feld `WeightEntry.value` desselben `weights`-Dokuments geändert. Kein Schema-Evolutionsschritt, keine Migration/Backfill, kein neuer Container, Index, `cosmos.ts`- oder Bicep-Eintrag. Bestehende Dev- und Alpha-Dokumente bleiben kompatibel.

## 8. Backend Work Package — B-1

**Agent:** Backend  
**Goal:** ID-basiertes Gewichtsupdate samt nutzergebundener Repository-Implementierung, Tests und API-/Domain-Dokumentation liefern.
**Status:** Abgeschlossen; B-1-Handoff liegt vor.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**
- `backend/src/functions/weights.ts`
- `backend/src/functions/weights.test.ts`
- `backend/src/lib/repositories/weightsRepository.ts`
- `backend/src/lib/repositories/weightsRepository.test.ts`
- `backend/src/lib/repositories/cosmosWeightsRepository.ts`
- `backend/src/lib/repositories/cosmosWeightsRepository.contract.test.ts`
- `shared/types/weights.ts`

**Required Skills:** `cosmos-data-model-and-migration`.

**Relevant Acceptance Criteria:** AC-4, AC-5, AC-6, AC-8.

**Dependencies:** None.

**Expected Handoff:** Geliefert: authentifizierter `PUT /api/weights/{id}` aktualisiert ausschließlich `value` anhand `(id, userId)` und gibt bei unbekannter/fremder ID `404` zurück. Handler- und In-Memory-Repository-Tests sowie Backend-Unit-Suite (1852/1852) und `build:verify` bestanden. Die Dokumentationsupdates in `tech/02-backend.md`, `tech/09-api-reference.md` und `domain/05-weight-tracking.md` bleiben Teil des B-1-Handoffs und werden durch QA geprüft. Der Cosmos-Contract-Test ist als Code vorhanden, wurde lokal aber mangels Emulator nicht ausgeführt (`ECONNREFUSED 127.0.0.1:18081`; Docker/Podman nicht verfügbar). Sein Lauf ist kein lokales Freigabegate; Status `UNVERIFIED`, Testcode nicht löschen. Backend-Typecheck bleibt ein expliziter QA-Prüfschritt, sofern dafür kein bestandenes Ergebnis vorliegt. Keine echten Datenbank-/Cloud-Schreibtests und kein Deployment.

## 9. Frontend Work Package — F-1

**Agent:** Frontend  
**Goal:** Kalender-/Tageseditor, heutige kompakte Gewichtskarte und gezielte Add-/Update-Aktionen mit bestehendem UI-Muster umsetzen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/progress/ProgressScreen.tsx`
- `mobile/src/modules/progress/progressUtils.ts`
- `mobile/src/shared/components/ProgressHeroCard.tsx`
- `mobile/src/shared/components/ProgressHeroCard.test.ts`
- `mobile/src/shared/components/HistoryList.tsx`
- `mobile/src/modules/nutrition/CopyItemSheet.tsx`
- `mobile/src/services/weightsService.ts`
- `mobile/src/services/weightsService.test.ts`
- `mobile/src/services/health/healthSyncService.ts`
- `mobile/src/shared/date/localDate.ts`
- `shared/types/weights.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-3, AC-5, AC-7, AC-9.

**Dependencies:** B-1 abgeschlossen; Mobile verwendet exakt dessen API-Vertrag.

**Expected Handoff:** Tages- und Edit-Flow mit fokussierten Mobile-Tests, korrektes `POST`/`PUT`-Routing nach Datum bzw. ID, Health-Connect-Upsert derselben ID sowie aktualisierte `docs/kb/tech/03-mobile.md` und `docs/kb/product/03-design-system.md`.

## 10. QA Work Package — Q-1

**Agent:** QA  
**Goal:** Alle Akzeptanzkriterien, Mehrfachmessungen, API-Sicherheit, lokal prüfbares Persistence-Verhalten, UI-Zustände und Knowledge-Base-Änderungen unabhängig prüfen; die nicht verfügbare Cosmos-Emulator-Persistenz transparent als `UNVERIFIED` ausweisen.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- diese Story und dieser Plan
- `backend/src/functions/weights.ts` und `backend/src/functions/weights.test.ts`
- `backend/src/lib/repositories/weightsRepository.ts` und `backend/src/lib/repositories/cosmosWeightsRepository.contract.test.ts`
- `mobile/src/modules/progress/ProgressScreen.tsx` und der Kalender-/Screen-Test
- `mobile/src/shared/components/ProgressHeroCard.tsx` und `ProgressHeroCard.test.ts`
- `mobile/src/services/weightsService.ts` und `weightsService.test.ts`
- geänderte Knowledge-Base-Dokumente

**Required Skills:** `cosmos-data-model-and-migration`.

**Relevant Acceptance Criteria:** AC-1 bis AC-9.

**Dependencies:** B-1 und F-1 samt Dokumentationsupdates abgeschlossen.

**Expected Handoff:** QA-Bericht im `fittrack-qa-v1`-Format unter `docs/qa/reports/` mit AC-Evidenz, ausgeführten Befehlen/Exitcodes, Befunden und separat markierten manuellen oder nicht verfügbaren Prüfungen. Die Cosmos-Emulator-Persistenz ist als `UNVERIFIED` beziehungsweise `MANUAL VALIDATION REQUIRED` außerhalb der Findings zu dokumentieren, mit Voraussetzung, Prüfschritten, erwartetem Ergebnis und Ergebnisfeld; die fehlende lokale Infrastruktur senkt den QA-Verdikt nicht allein. Ein optionaler Follow-up darf den bestehenden Contract-Test nur gegen den lokalen Emulator ausführen, niemals gegen eine echte Cloud-Datenbank. Den konkreten Reportpfad setzt der Orchestrator.

## 11. Shared Package Changes

Keine. `WeightEntry` und der bestehende Response-Typ reichen aus; der Update-Request bleibt im Weight-Service/Backend-Handler lokal typisiert.

## 12. Infrastruktur und Konfiguration

`Infrastructure Impact: Dev` kennzeichnet, dass die neue Backend-Route für eine spätere Dev-Integration bereitgestellt werden muss. Es ist keine Deploymentfreigabe und kein Deploymentauftrag. Alpha-Auslieferung ist nicht Teil dieses Plans. Keine Azure-Ressource, Cosmos-Container, Bicep-Datei oder Konfiguration ändert sich. `Mobile Build Impact: None`: reine TypeScript-/React-Native-JS-Änderung ohne native Abhängigkeit oder App-Config-Änderung. Ein Infrastructure-&-Release-Arbeitspaket ist nicht erforderlich.

## 13. Dokumentationsupdates

- Backend aktualisiert `docs/kb/tech/02-backend.md`, `docs/kb/tech/09-api-reference.md` und `docs/kb/domain/05-weight-tracking.md` für PUT-Vertrag, ID-basierte Aktualisierung und unverändertes Mehrfachmessungsmodell.
- Frontend aktualisiert `docs/kb/tech/03-mobile.md` und `docs/kb/product/03-design-system.md` für heutigen Zustand, Kalender-/Tagesauswahl, gezielte Bearbeitung und `Aktualisieren`.
- QA prüft, dass Dokumentation Implementierung und Scope beschreibt und keine Migration oder Alpha-Freigabe behauptet.

## 14. Teststrategie

- Backend-Handler-Unit-Tests: erfolgreicher Update; ungültiger Wert/Body; fehlende ID; unbekannte und fremde ID; Authentifizierung; Response behält ID, Datum, Einheit und `createdAt`.
- In-Memory-Repository-Tests: bei zwei Messungen desselben Datums ändert sich nur die angeforderte ID.
- Der vorhandene Cosmos-Contract-Test prüft ein persistiertes `updateValue`-Update sowie `null` bei fehlender oder fremder Partition-ID. Er bleibt im Repository, ist aber kein Gate der lokalen Freigabe und muss nicht ausgeführt werden. Auf dieser Maschine ist der Emulator nicht verfügbar (`ECONNREFUSED 127.0.0.1:18081`; Docker/Podman fehlen); die persistierte Cosmos-Wirkung ist daher `UNVERIFIED`. Keine Schreibtests gegen echte Azure-/Cloud-Datenbanken.
- Mobile-Service-Test: `PUT` geht an die codierte ID und sendet nur `{ value }`; `POST` behält das explizite ausgewählte Datum.
- Mobile-UI-/Screen-Tests: heute leer/vorhanden/mehrere Werte; Wert öffnet exakt die gewählte ID; `Speichern` versus `Aktualisieren`; leerer Vergangenheits-Tag; mehrere gleiche Tageswerte; separates `Weitere Messung`; Zukunft gesperrt; Fehler erhält den Ursprungswert; Erfolg aktualisiert nur eine ID und stößt Health-Connect-Upsert mit derselben ID an.
- Kalenderprüfungen verwenden lokale Datumswerte über Monats-/Jahreswechsel, Schaltjahr und DST; keine UTC-Tagesverschiebung.
- Für B-1 sind Handler-/In-Memory-Tests, die vollständige Backend-Unit-Suite (1852/1852) und `build:verify` bereits bestanden. Die verbleibende Implementierung/QA führt betroffene Backend- und Mobile-Tests sowie die vollständigen relevanten Unit-Suiten aus: `cd backend && npx vitest run`, `cd backend && npx tsc --noEmit`, `cd backend && npm run build:verify`, `cd mobile && npx vitest run` und `cd mobile && npx tsc --noEmit`. Der Cosmos-Contract-Test ist ausdrücklich kein lokales Freigabegate. Empfohlener optionaler Follow-up bei verfügbarem lokalem Emulator: `cd backend && npx vitest run --config vitest.contract.config.mts`; dokumentiere Ergebnis und verifiziere ausschließlich gegen den Emulator. Kein Cloud-/Produktivdaten-Schreiben und kein Deployment.
- Manuelle UI-Prüfung bei 320/360 dp sowie Screenreader-Beschriftung für gleiche oder mehrere Messungen. Nicht verfügbare Geräte-/Screenreader-Prüfungen als `MANUAL VALIDATION REQUIRED` dokumentieren.

## 15. Akzeptanzkriterien

1. Beim Öffnen ist heute ausgewählt. Ohne heutigen Eintrag zeigt die Karte die kg-Eingabe; `Speichern` legt per POST einen Eintrag mit dem expliziten lokalen Datum an.
2. Bei mindestens einem heutigen Eintrag blendet die Karte dauerhafte Eingabefelder aus und zeigt alle heutigen Einträge einzeln. Jeder Wert öffnet die Bearbeitung genau dieser Messungs-ID.
3. Die Kalenderauswahl bietet heute und vergangene Tage, keine Zukunft. Für ein gewähltes Datum zeigt sie alle vorhandenen Einträge dieses exakten Datums; ein leeres Datum kann nachgetragen werden.
4. Ein gewählter vorhandener Eintrag ist vorausgefüllt und die Aktion heißt `Aktualisieren`. Mobile ruft `PUT /api/weights/{selectedId}` mit dem neuen Wert auf.
5. Ein erfolgreiches Update ändert dieselbe ID und ausschließlich deren Wert. Datum, Einheit und `createdAt` bleiben erhalten; weder POST noch DELETE wird für dieses Update verwendet. Handler-/In-Memory-Tests und unabhängige Prüfung des Cosmos-Patchs (`item(id, userId)`, ausschließlich `/value`) bleiben verpflichtend. Der Emulator-Persistenz-Roundtrip bleibt lokal `UNVERIFIED` und ist kein Freigabegate; QA weist ihn separat außerhalb der Findings aus.
6. Bei mehreren Tagesmessungen bleibt jede Zeile separat auswählbar. Das Update eines Eintrags verändert oder löscht keinen Geschwistereintrag. `Weitere Messung` legt nur auf ausdrücklichen Tap einen separaten POST-Eintrag an.
7. Die API verlangt Authentifizierung, validiert positive Werte bis 1000 und gibt bei unbekannter/fremder ID 404 zurück; bestehende POST-/DELETE-Verträge bleiben unverändert.
8. Mobile aktualisiert nach Erfolg genau die ausgewählte ID, aktualisiert abhängige Anzeige/Statistik aus der Historie und stößt den Health-Connect-Upsert mit derselben Entry-ID an. Bei Fehler bleibt der vorherige Wert sichtbar und bearbeitbar.
9. UI und Accessibility unterscheiden mehrere Einträge auch bei identischen Zahlenwerten, passen sich an 320/360 dp an und nutzen keine neue native Abhängigkeit. Betroffene Knowledge-Base-Dokumente entsprechen dem implementierten Verhalten.

## 16. Risiken und Randfälle

- Mehrere Messungen mit gleichem Datum und gleichem Wert dürfen nicht durch Wertvergleich statt ID unterschieden werden; Auswahl, Listenkey und Updateziel verwenden immer die ID.
- Ein veralteter Client kann eine inzwischen gelöschte ID bearbeiten wollen. Das Backend liefert 404; Mobile lädt die Historie neu und zeigt eine verständliche Fehlermeldung, statt einen neuen POST auszuführen.
- Kalendernavigation darf bei lokaler Mitternacht, Monats-/Jahreswechsel und DST kein UTC-Datum speichern.
- Ein Update darf `createdAt` nicht auf den Bearbeitungszeitpunkt setzen, da dies Eintragsreihenfolge und Erfassungsmetadaten verändert.
- Health Connect verwendet `WeightEntry.id` als `clientRecordId`; nach Update ist ein Upsert derselben ID erforderlich, kein neues Gewicht mit neuer ID.
- Die Cosmos-Persistenz des `PATCH /value`-Pfads und das Verhalten bei falschem Partition Key wurden lokal nicht durch den Emulator bestätigt. Handler-/In-Memory-Tests und Codeprüfung senken das Risiko, ersetzen aber keinen Persistenz-Roundtrip; Status bleibt `UNVERIFIED`. Ein späterer Lauf des vorhandenen Contract-Tests gegen einen lokalen Emulator ist ein empfohlener, nicht-blockierender Follow-up. Echte Cloud-Schreibtests und Deployment bleiben ausgeschlossen.

## 17. Empfohlene Umsetzungsreihenfolge

1. **B-1 Backend (abgeschlossen):** PUT-Vertrag, Handler, Repository-Update sowie Handler-/In-Memory-Tests, Backend-Unit-Suite (1852/1852) und `build:verify` geliefert. Die vorgesehenen API-/Backend-/Gewichtsdokumentationsupdates bleiben Bestandteil des B-1-Handoffs und werden in QA geprüft. Cosmos-Contract-Test bleibt als Code bestehen; sein lokaler Lauf ist `UNVERIFIED` und kein Gate.
2. **F-1 Frontend:** Kalender-/Tageseditor und heutige Card-Zustände gegen B-1 umsetzen; gezielte Service-/UI-Tests und Mobile-Dokumentation ergänzen.
3. **Q-1 QA:** alle ACs nach Code- und Dokumentationsabschluss unabhängig prüfen, Backend-Typecheck/Build und betroffene Backend-/Mobile-Tests ausführen; Emulator-Persistenz als `UNVERIFIED` außerhalb der Findings ausweisen und manuelle Geräteprüfungen separat markieren. Kein echtes Datenbank-/Cloud-Schreiben und kein Deployment.

Der Plan ist automatisch freigegeben. Keine zusätzliche PO-Rückfrage, Datenmigration, Alpha-Auslieferung oder Deploymentfreigabe wird daraus abgeleitet.

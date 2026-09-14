# Technischer Plan: Geräte-lokale Kalenderdaten und lokale Zeitentscheidungen

**Status:** Ready for implementation handoff  
**User Story:** None — die Anforderung liegt ohne bestehende User-Story-Datei vor.  
**Infrastructure Impact:** Dev  
**Mobile Build Impact:** None  

Mangels passender User-Story wird der Plan nach dem dokumentierten Fallback unter `docs/User Stories/plans/` abgelegt. Diese Planungsrunde ändert keinen Produktionscode, keine Tests und keine Knowledge-Base-Datei.

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications.

### Nutzerproblem und Lösungsfit

Date-only-Werte werden an mehreren Stellen aus `Date#toISOString()` abgeleitet. Diese Methode konvertiert zunächst nach UTC und kann deshalb kurz nach Mitternacht einen anderen Kalendertag liefern als das Gerät des Users. Betroffen sind unter anderem Home, Tagebuch, Tagestyp, Gewicht, Rezept-Logging, Aktivitätslabels, Food-Entry-Hub, Kopieren und lokale Historiengruppen.

Die vorgeschlagene Lösung ist fachlich passend, muss aber als durchgängige Vertragsregel umgesetzt werden: Das Mobile liefert für userbezogene Kalendertage den lokalen Gerätewert. Der Backend-Server leitet für diese Pfade keinen „heutigen“ Kalendertag mehr aus seiner UTC-Uhr ab. Technische Zeitpunkte bleiben dagegen UTC-Instants.

### Domain- und Produktausrichtung

- Das Tagebuch, Gewichtstracking, Tagesziele und Wochenrückblick arbeiten mit date-only-Kalendertagen (`YYYY-MM-DD`).
- `createdAt`, `updatedAt`, `generatedAt`, `lastUsedAt`, `calculatedAt`, `submittedAt` und Logs sind technische Zeitpunkte und bleiben kanonisch UTC.
- Die bestehende lokale Daily-Insight-Unterstützung mit `localHour` und `timezoneOffsetMinutes` wird vervollständigt, nicht durch einen neuen AI-Mechanismus ersetzt.
- Die Hint-Engine bleibt deterministisch und ohne AI.
- Historische Dokumente werden nicht umdatiert. Neue Reads/Writes verwenden die korrigierte Semantik.

### Product Owner Decisions

**Open Product Owner Decisions:** None for the requested first-party Mobile behavior. Die Anforderung „zwingend lokale Uhrzeit des Users bzw. Handys“ entscheidet gegen einen UTC-Fallback in den von Mobile genutzten date-only-Verträgen. Nicht dokumentierte Fremdclients müssen diese Verträge ebenfalls aktualisieren.

## 2. Feature Summary

Einführung einer verbindlichen Date-/Time-Semantik über Mobile, Shared und Backend:

1. Lokale Geräte-Kalendertage werden über den bestehenden Helper `mobile/src/shared/date/localDate.ts` erzeugt.
2. Date-only-Navigation verwendet zentrale, timezone-neutrale Kalenderarithmetik statt verstreuter ISO-Konvertierungen.
3. Backend-Handler akzeptieren beziehungsweise verlangen explizite date-only-Werte und lokale Kontextwerte, statt UTC-„heute“ zu erfinden.
4. Hint-Cooldowns und Food-Relation-Nutzungstage werden mit dem expliziten lokalen beziehungsweise bereits ausgewählten Tagebuchdatum geschrieben.
5. Technische UTC-Zeitstempel, UTC-Quota-Perioden, Cache-Instants und historische date-only-Berechnungen bleiben unverändert.
6. Es findet keine historische Migration statt.

## 3. Current Behaviour

### Bestätigte Mobile-Probleme

- [`mobile/src/modules/home/HomeScreen.tsx`](../../../mobile/src/modules/home/HomeScreen.tsx) verwendet für `todayDate` und den Diary-Load `toISOString().split('T')[0]`, obwohl Wochen- und Daily-Insight-Requests bereits `getLocalIsoDate()` nutzen. Dadurch können Tagesziele, Diary-Summary und Special-Activity-Aktionen auf verschiedene Kalendertage zeigen.
- [`mobile/src/modules/nutrition/useDayTypeStore.ts`](../../../mobile/src/modules/nutrition/useDayTypeStore.ts) sendet den Tagestyp mit einem UTC-abgeleiteten `TODAY()`.
- [`mobile/src/modules/nutrition/DiaryScreen.tsx`](../../../mobile/src/modules/nutrition/DiaryScreen.tsx) verwendet UTC für den initialen heutigen Tag und die date-only-Navigation.
- [`mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`](../../../mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts), [`CopyItemSheet.tsx`](../../../mobile/src/modules/nutrition/CopyItemSheet.tsx) und [`mobile/src/modules/recipes/LogRecipeModal.tsx`](../../../mobile/src/modules/recipes/LogRecipeModal.tsx) haben dieselbe UTC-Ableitung.
- [`mobile/src/modules/nutrition/CyclingInputScreen.tsx`](../../../mobile/src/modules/nutrition/CyclingInputScreen.tsx) und [`HikingInputScreen.tsx`](../../../mobile/src/modules/nutrition/HikingInputScreen.tsx) erkennen „Heute“/„Gestern“ über UTC.
- [`mobile/src/shared/components/HistoryList.tsx`](../../../mobile/src/shared/components/HistoryList.tsx) berechnet eine lokale Wochenwoche, wandelt das Ergebnis aber über `toISOString()` zurück und kann dadurch den Montag verschieben.
- [`mobile/src/modules/nutrition/hub/RelationRow.utils.ts`](../../../mobile/src/modules/nutrition/hub/RelationRow.utils.ts) verwendet für ein date-only-Recency-Fenster einen UTC-abgeleiteten Cutoff.
- [`mobile/src/services/weightsService.ts`](../../../mobile/src/services/weightsService.ts) berechnet zwar lokal, lässt aber `...input` nach dem Default folgen. Ein explizites `date: undefined` kann den korrekten lokalen Default überschreiben.

### Bestätigte Backend-Probleme

- [`backend/src/functions/weights.ts`](../../../backend/src/functions/weights.ts) fällt bei fehlendem Gewichtdatum auf `todayIso()` in UTC zurück.
- [`backend/src/functions/dailyInsight.ts`](../../../backend/src/functions/dailyInsight.ts) fällt bei fehlendem Datum auf den Backend-UTC-Tag zurück. Der Endpoint hat bereits lokale Hour-/Offset-Parameter, behandelt fehlenden Offset aber bewusst mit einer UTC-Legacy-Alternative.
- [`backend/src/functions/diary.ts`](../../../backend/src/functions/diary.ts) setzt für fehlende/ungültige `localHour` aktuell `12`. Der Handler kennt das angefragte Tagebuchdatum, aber nicht den aktuellen lokalen Gerätetag für Hint-Cooldowns.
- [`backend/src/lib/hintEngine.ts`](../../../backend/src/lib/hintEngine.ts) erzeugt `today`, `lastHintDate` und Cooldown-Daten aus der Backend-UTC-Uhr. Beim Anzeigen eines historischen Diary-Tages kann dadurch außerdem der falsche aktuelle Cooldown-Tag persistiert werden.
- [`backend/src/lib/repositories/userFoodRelationRepository.ts`](../../../backend/src/lib/repositories/userFoodRelationRepository.ts) und [`cosmosUserFoodRelationRepository.ts`](../../../backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts) schreiben `usageDates` aus dem Backend-UTC-Tag, obwohl die Diary-Meal-Datei bereits das korrekte date-only-Datum enthält.
- [`backend/src/lib/favoritesScoring.ts`](../../../backend/src/lib/favoritesScoring.ts) leitet das 90-Tage-Fenster für date-only-`usageDates` aus Server-UTC ab. `lastUsedAt` selbst ist dagegen ein technischer Instant und bleibt elapsed-time-basiert.

### Bereits korrekte oder absichtlich unveränderte Pfade

- [`mobile/src/shared/date/localDate.ts`](../../../mobile/src/shared/date/localDate.ts) liefert bereits `getLocalIsoDate()`, `getLocalTimezoneOffsetMinutes()` und date-only-Validierung.
- Der Weekly-Insight-Request erhält bereits ein lokales Referenzdatum aus `HomeScreen`; der Backend-Weekly-Calculator arbeitet mit expliziten date-only-Werten.
- Daily Insight verarbeitet einen validen Offset bereits für lokalen aktuellen Tag, lokale Mitternacht, TTL und Cache-Hash. Die Lücke ist der fehlende/ungültige Vertragswert, nicht die lokale Mitternachtsarithmetik.
- `createdAt`, `updatedAt`, `generatedAt`, `lastUsedAt`, `calculatedAt`, Health-Sync-Zeitpunkte und Quota-Monatsperioden sind technische/operativ definierte UTC-Werte.
- `shared/lib/weeklyReviewCalculator.ts`, `backend/src/lib/progressIntelligence.ts`, `dailyInsightContext.ts` und `weightTrend` verwenden UTC-basierte Arithmetik auf bereits expliziten date-only-Werten. Das ist keine Server-Zeitzonenableitung und darf nicht pauschal ersetzt werden.

## 4. Desired Behaviour

### Date-only-Regel

- Jeder userbezogene Kalendertag ist ein expliziter String `YYYY-MM-DD` aus dem lokalen Gerät oder aus einer bereits gespeicherten/ausgewählten date-only-Quelle.
- Mobile verwendet für „heute“ ausschließlich `getLocalIsoDate()` beziehungsweise einen daraus abgeleiteten zentralen Date-Context.
- Der Backend-Server verwendet für userbezogene „heute“-Semantik keinen `new Date().toISOString().slice(0, 10)`-Fallback.
- Navigation, „Heute/Gestern“, Tagesziele, Diary-Laden, Weight-Logging, Aktivitäts-Logging, Recipe-Logging und Food-Relation-Recency zeigen und schreiben denselben lokalen Kalendertag.

### Lokale Zeitentscheidungen

- Mobile sendet für die Diary-Hint-Anfrage den aktuellen lokalen Gerätetag und die lokale Stunde.
- Fehlende oder ungültige lokale Stunde wird als unbekannt behandelt, nicht als `12` oder als UTC-Stunde.
- Hint-Cooldowns verwenden den aktuellen lokalen Gerätetag, getrennt vom möglicherweise historischen, angezeigten Diary-Datum.
- Daily Insight erhält ein explizites Datum und einen validen lokalen UTC-Offset. Ohne belastbaren lokalen Kontext gibt es keinen stillen UTC-Fallback.
- Der Daily-Insight-Status für Special Activity bleibt die bestehende lokale Hour-/Offset-Heuristik; es wird kein bestätigter Abschlussstatus erfunden.

### Technische Instants

- Persistierte und transportierte ISO-Zeitstempel bleiben UTC mit `toISOString()`.
- TTL- und Ablaufwerte werden als UTC-Instants berechnet; Daily Insight verwendet bei validem Offset weiterhin die nächste lokale Mitternacht, repräsentiert als UTC.
- UTC-Quota-Monatsperioden bleiben UTC, weil sie ein technisches Abrechnungs-/Limitfenster und keinen User-Kalendertag darstellen.

## 5. Scope

- Zentralisierung der lokalen Date-/Time-Kontextbildung in `mobile/src/shared/date/localDate.ts`.
- Date-only-Tagesarithmetik für Diary, Copy, History und ähnliche mobile UI-Flows.
- Home- und DayType-Korrektur.
- Diary-API um lokalen Gerätetag und sichere lokale Hour-Semantik ergänzen.
- Weight-POST ohne UTC-Datum-Fallback; Mobile-Payload-Reihenfolge korrigieren.
- Daily-Insight-Anfrage ohne UTC-Datum-/Offset-Fallback im First-Party-Vertrag.
- Hint-State/Cooldown auf expliziten lokalen Gerätetag umstellen.
- Food-Relation-`usageDates` aus dem tatsächlichen Diary-Meal-Datum schreiben.
- Favoriten-Ranking mit explizitem lokalen Referenzdatum für date-only-Fenster.
- Activity-, Recipe- und Food-Entry-Default-/Label-Pfade korrigieren.
- Shared-Hint-Context und API-Dokumentation aktualisieren.
- Unit-, Handler-, Repository-, Contract- und Boundary-Tests ergänzen.
- Knowledge-Base-Dokumentation nach der Umsetzung aktualisieren.

## 6. Out of Scope

- Keine globale Ersetzung aller `toISOString()`-Aufrufe.
- Keine Änderung technischer UTC-Timestamps oder ihrer Persistenzformate.
- Keine Änderung der UTC-Quota-Perioden.
- Keine Änderung der AI-Prompts, Structured Outputs, Modelle, Quoten oder Nutrition-Heuristiken.
- Keine neue Cosmos-Collection, kein neuer Partition Key und keine Bicep-Änderung.
- Keine Änderung der historischen gespeicherten Diary-, Weight-, Hint- oder Usage-Date-Werte.
- Keine rückwirkende Korrektur falsch zugeordneter historischer Einträge.
- Keine Offline-Unterstützung und kein neues Timezone-Paket.
- Keine neue native Mobile-Abhängigkeit, kein Config-Plugin und keine `app.config.js`-Änderung.
- Keine Änderung fachlicher Grenzwerte der Hint-Engine oder des Favorites-Scorings, abgesehen von der korrekten date-only-Referenz.

## 7. Confirmed Facts

- Das Repository ist ein TypeScript-Monorepo aus Backend, Mobile und Shared.
- Backend und Cosmos besitzen bereits getrennte date-only-Felder und technische UTC-Timestamps.
- Die Diary-GET-Route verlangt im aktuellen Code bereits `date=YYYY-MM-DD`; die API-Dokumentation muss lokale Zusatzparameter ergänzen.
- `WeightEntry.date` ist im Shared-Typ ein date-only-Feld; `WeightEntry.createdAt` ist ein ISO-Timestamp.
- `HintState.lastHintDate` und `cooldownHistory` sind date-only-Felder; `lastHintGeneratedAt` ist ein Timestamp.
- `UserFoodRelation.usageDates[].date` ist date-only; `lastUsedAt` und `createdAt` sind Timestamps.
- Daily Insight hat bereits Offset-normalization, lokale-Mitternacht- und aktuellen-Tag-Helfer.
- Der User verlangt ausdrücklich die Uhrzeit beziehungsweise den Kalendertag des Users/Handys und schließt eine historische Migration aus.
- Die Knowledge Base verlangt bei Logikänderungen Tests und behandelt die Repository-Implementierung als aktuelle Verhaltensquelle.

## 8. Assumptions and Open Questions

- Mobile ist der maßgebliche First-Party-Client. Alle anderen Clients müssen die expliziten date-only-/lokalen Kontextparameter übernehmen.
- Ein lokaler Geräteoffset im Bereich `-840..840` ist verfügbar. Bei einem technisch ungültigen Offset wird der Request nicht still auf UTC umgedeutet.
- `localDate` für Hint-Cooldowns meint den aktuellen Gerätetag, nicht das gerade angezeigte historische Diary-Datum.
- UTC-basierte Arithmetik bleibt für reine date-only-Strings erlaubt, wenn der String bereits explizit ist und die Berechnung nicht von Server-/Gerätezeitzone abhängt.
- Bestehende Legacy-Dokumente ohne neue Kontextwerte bleiben lesbar. Ihre date-only-Werte werden nicht neu interpretiert oder umgeschrieben.
- Die Backend-API darf für die von Mobile genutzten Pflichtfelder `400` liefern, wenn ein Datum fehlt oder ungültig ist. AI-/Provider-Fehler behalten ihren bestehenden freundlichen `200`-Vertrag.

## 9. Existing Components to Reuse

- `mobile/src/shared/date/localDate.ts` als kanonischen Mobile-Helper.
- `getLocalIsoDate()` und `getLocalTimezoneOffsetMinutes()` für Gerätewerte.
- Bestehende ISO-date-only-Validierung in Backend-Handlern und `isValidDateOnly()` im Mobile-Code.
- `normalizeTimezoneOffsetMinutes()`, `isCurrentDayForOffset()`, `getNextLocalMidnightUtc()` und `computeTtlUntilMidnight()` im Daily-Insight-Repository.
- Bestehende explicit-date API-Methoden für Diary, DayType, Special Activity, Weekly Insight und Recipe Logging.
- Repository-Abstraktionen und vorhandene In-Memory-/Cosmos-Testmuster.
- Bestehende Pure-Function-Tests der Hint-Engine, Favorites-Scoring- und Date-Helper.

## 10. Proposed Technical Solution

### 10.1 Kanonischer Mobile-Kontext

`localDate.ts` wird um kleine, pure Helfer für:

- lokalen ISO-Kalendertag,
- lokale Stunde und validierten lokalen Offset,
- date-only-Tagesarithmetik (`addIsoDateDays` oder gleichwertig)

erweitert. Date-only-Tagesarithmetik darf intern UTC-Komponenten verwenden, damit DST die Tageszahl nicht verschiebt; sie darf nicht aus einer aktuellen UTC-Konvertierung den lokalen Tag ableiten.

Ein gemeinsamer Request-Context soll die wiederholte Bildung von `date`, `localHour` und `timezoneOffsetMinutes` vermeiden. Die Helfer bleiben ohne globale Uhr und sind mit injizierten `Date`-Werten testbar.

### 10.2 Explizite API-Verträge

| Endpoint/Pfad | Zielvertrag |
|---|---|
| `GET /api/diary` | `date` bleibt Pflicht. Mobile sendet zusätzlich `localDate` und lokale Stunde. `localHour` wird bei fehlendem/ungültigem Wert unbekannt, niemals `12`; `localDate` fehlt/ist ungültig → `400`, damit Hint-State nicht auf Server-UTC fällt. |
| `POST /api/weights` | `date` wird Pflichtfeld. Der Backend-Fallback `todayIso()` entfällt. |
| `GET /api/ai/daily-insight` | `date` wird Pflichtfeld. Ein fehlender/ungültiger `timezoneOffsetMinutes` darf nicht mehr den lokalen aktuellen Tag, TTL und Cache-Key auf UTC-Legacy-Semantik zurücksetzen; der Request wird für fehlenden/ungültigen lokalen Kontext abgewiesen. `localHour` darf unbekannt sein und erzeugt dann nur keinen zeitabhängigen Status. |
| `GET /api/ai/weekly-insight` | Bereits explizites `date`; Mobile liefert weiterhin `getLocalIsoDate()`. Keine serverseitige Default-Ermittlung. |
| `GET /api/favorites?context=...` | Für die kontextabhängige Sortierung wird ein validiertes `localDate` als Referenz für `usageDates` verlangt. Unranked Favorites und Recent-Listen ändern ihren Timestamp-Vertrag nicht. |
| Diary-Mutationen mit Datum | Bereits explizite Body-/Route-Daten bleiben maßgeblich; Mobile erzeugt Defaults lokal. |

Die konkreten Parameternamen sind im Backend, Mobile API-Client, API-Referenz und Tests konsistent zu halten. `date` bezeichnet das angefragte/zu speichernde Tagebuchdatum; `localDate` bezeichnet den aktuellen Gerätetag für lokale Zustandsentscheidungen.

### 10.3 Hint Engine

- `HintContext` erhält `currentLocalDate: string`.
- `currentHour` wird zu `number | null` oder erhält eine gleichwertige Unknown-Repräsentation.
- `evaluateHint()` verwendet ausschließlich `context.currentLocalDate` für `lastHintDate` und `cooldownHistory`.
- Die Engine enthält keinen Zugriff mehr auf `new Date()` zur Ermittlung des date-only-Tages.
- `lastHintGeneratedAt` bleibt `new Date().toISOString()`.
- Der Diary-Handler validiert und reicht `localDate` durch; die angefragte historische `date` bleibt die Datenbasis der Regeln.

### 10.4 Gewicht und Food Relations

- `AddWeightBodySchema` validiert ein erforderliches echtes Kalenderdatum.
- `weightsService.addWeight()` setzt `{ ...input, date: input.date ?? getLocalIsoDate() }`, sodass `undefined` den Default nicht überschreibt.
- `recordUsage()` erhält das `meal.date` des gerade beschriebenen Diary-Meals als expliziten internen date-only-Wert.
- In-Memory- und Cosmos-Repository trimmen `usageDates` relativ zu diesem Referenzdatum, nicht relativ zum Server-UTC-Tag. Das bestehende `lastUsedAt = new Date().toISOString()` bleibt unverändert.
- `favoritesScoring` erhält ein explizites date-only-Referenzdatum für das 90-Tage-Fenster. Die elapsed-time-Berechnung aus `lastUsedAt` und `favoritedAt` bleibt auf technischen Instants basiert.
- Mobile `favoritesApi.listFavoritesRanked()` sendet das lokale Referenzdatum.

### 10.5 Daily Insight und technische UTC-Werte

- Daily Insight nutzt für das Cache-Datum nur das validierte Request-`date`.
- Bei validem Offset bleiben lokale aktuelle-Tages-Erkennung, lokale Mitternacht, TTL und Offset im Input-Hash erhalten.
- `generatedAt`, `expiresAt`, `lastGeneratedAt`, Feedback-Zeitpunkte, Cosmos-TTL-Berechnung und Logs bleiben UTC.
- Daily-/Weekly-Insight-Kontext und historische Weight-/Nutrition-Calculations erhalten ihre expliziten date-only-Eingaben; ihre sichere UTC-neutrale Tagesarithmetik wird nicht durch lokale Date-Objekte ersetzt.

## 11. Backend Work Package B-1

### Subtask B-1.1 — Shared-/API-Kontextvertrag

**Agent:** Backend

**Goal:** Den Shared-Hint-Context und die Backend-Eingangsregeln so erweitern, dass lokale Date-only- und lokale Hour-Werte explizit transportiert werden können.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**

- `shared/types/hint.ts`
- `shared/types/weights.ts`
- `shared/types/userFoodRelation.ts`
- `backend/src/functions/diary.ts`
- `backend/src/functions/weights.ts`
- `backend/src/lib/repositories/insightRepository.ts`

**Required Skills:**

- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-1
- AC-4
- AC-5
- AC-10

**Dependencies:** None

**Expected Handoff:**

- geänderter `HintContext` mit explizitem lokalem Gerätetag und sicherer Unknown-Semantik für lokale Stunde
- validierte API-Eingangsregeln
- bestätigte Class-0-Persistenzbewertung ohne neue Container und ohne Migration
- aktualisierte Shared-/Backend-Typen für Frontend und QA

### Subtask B-1.2 — Diary, Hint, Weight und Daily-Insight-Verhalten

**Agent:** Backend

**Goal:** Alle Backend-Entscheidungen, die bisher einen UTC-„heute“-Wert oder einen unsicheren lokalen Fallback verwenden, auf den expliziten Vertrag umstellen.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**

- `backend/src/functions/diary.ts`
- `backend/src/lib/hintEngine.ts`
- `backend/src/lib/hintEngine.test.ts`
- `backend/src/functions/weights.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`

**Required Skills:**

- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-9
- AC-10

**Dependencies:**

- B-1.1 Shared-/API-Kontextvertrag

**Expected Handoff:**

- Diary-Handler mit validiertem `localDate`, lokaler Hour-Unknown-Semantik und explizitem Hint-Context
- Hint-State mit lokalem Gerätetag und unverändertem UTC-Generierungszeitpunkt
- Weight-POST ohne UTC-Datum-Fallback
- Daily-Insight-Handler ohne stillen UTC-Datum-/Offset-Fallback
- aktualisierte Handler-, Hint- und Daily-Insight-Tests
- dokumentierter Hinweis, dass Daily-Insight-Prompt, AI-Output und Quota unverändert bleiben

### Subtask B-1.3 — Food-Relation-Datumssemantik und Favoriten-Ranking

**Agent:** Backend

**Goal:** Usage-Date-Einträge und date-only-Favoritenfenster mit dem tatsächlichen Diary-Datum beziehungsweise dem lokalen Request-Referenzdatum bewerten.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/03-food-catalog.md`

**Required Repository Context:**

- `backend/src/functions/diary.ts`
- `backend/src/functions/favorites.ts`
- `backend/src/lib/favoritesScoring.ts`
- `backend/src/lib/favoritesScoring.test.ts`
- `backend/src/lib/repositories/userFoodRelationRepository.ts`
- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts`
- `backend/src/lib/repositories/userFoodRelationRepository.test.ts`
- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts`
- `shared/types/userFoodRelation.ts`

**Required Skills:**

- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-8
- AC-9
- AC-10

**Dependencies:**

- B-1.2 Diary- und Hint-Verhalten

**Expected Handoff:**

- Usage-Date-Einträge werden aus `meal.date` geschrieben und relativ zu diesem Datum getrimmt
- Ranked-Favorites-Vertrag mit validiertem lokalem Referenzdatum
- In-Memory- und Cosmos-Implementierungen sowie Contract-Tests ohne Schema-/Containeränderung
- Bestätigung, dass `lastUsedAt`/`createdAt` weiterhin UTC-Instants bleiben

## 12. Frontend Work Package F-1

### Subtask F-1.1 — Lokale Date-Helper und Kern-Diary-Flows

**Agent:** Frontend

**Goal:** Einen einheitlichen lokalen Date-Context einführen und die Home-, DayType-, Diary- und date-only-Historienpfade auf ihn umstellen.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**

- `mobile/src/shared/date/localDate.ts`
- `mobile/src/shared/date/localDate.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/nutrition/useDayTypeStore.ts`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/shared/components/HistoryList.tsx`
- `mobile/src/modules/nutrition/hub/RelationRow.utils.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-8
- AC-9

**Dependencies:**

- B-1.1 Shared-/API-Kontextvertrag

**Expected Handoff:**

- lokale Date-/Time-Context-Helfer und date-only-Arithmetik
- Home-Diary, DayType-Write, Diary-Navigation und History-Gruppierung verwenden lokale Kalenderdaten
- Home-Ziele, Diary-Summary und Special-Activity-Aktionen referenzieren denselben lokalen `todayDate`
- fokussierte Mobile-Unit-Tests für Grenzfälle und DST-/Mitternachtsarithmetik

### Subtask F-1.2 — Weight, Insight, Diary-API und Favorites-Requests

**Agent:** Frontend

**Goal:** Alle First-Party-API-Aufrufe mit lokalem Datum/lokaler Zeit versehen und Weight-Payloads gegen `undefined`-Überschreibung schützen.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**

- `mobile/src/shared/api/diaryApi.ts`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/shared/api/favoritesApi.ts`
- `mobile/src/services/insightService.ts`
- `mobile/src/services/weightsService.ts`
- `mobile/src/modules/nutrition/CyclingInputScreen.tsx`
- `mobile/src/modules/nutrition/HikingInputScreen.tsx`
- `mobile/src/modules/nutrition/CopyItemSheet.tsx`
- `mobile/src/modules/recipes/LogRecipeModal.tsx`
- `mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-3
- AC-4
- AC-7
- AC-8
- AC-9

**Dependencies:**

- F-1.1 Lokale Date-Helper und Kern-Diary-Flows
- B-1.2 Diary-, Hint-, Weight- und Daily-Insight-Verhalten
- B-1.3 Food-Relation-Datumssemantik und Favoriten-Ranking

**Expected Handoff:**

- Diary-GET sendet `date`, `localDate` und lokale Hour gemäß Vertrag
- Daily Insight sendet lokales Datum, lokale Stunde und validierten Offset
- Ranked Favorites sendet das lokale Referenzdatum
- Gewicht, Rezept, Copy, Activity-Labels und Hub verwenden lokale date-only-Defaults
- `toISOString()` bleibt nur für technische Mobile-Timestamps bestehen

## 13. QA Work Package Q-1

### Subtask Q-1.1 — Automatisierte Regression und Boundary-Tests

**Agent:** QA

**Goal:** Die lokale Date-/Time-Semantik, API-Verträge, Persistenzkompatibilität und die Unverändertheit technischer UTC-Instants automatisiert prüfen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**

- `mobile/src/shared/date/localDate.ts`
- `mobile/src/shared/date/localDate.test.ts`
- `mobile/src/services/weightsService.ts`
- `mobile/src/shared/api/diaryApi.ts`
- `mobile/src/shared/api/favoritesApi.ts`
- `backend/src/functions/diary.ts`
- `backend/src/functions/weights.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/lib/hintEngine.ts`
- `backend/src/lib/favoritesScoring.ts`
- `backend/src/lib/repositories/userFoodRelationRepository.ts`
- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `shared/types/hint.ts`

**Required Skills:**

- `cosmos-data-model-and-migration`
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**

- AC-1 through AC-10

**Dependencies:**

- F-1.2 Frontend-API-Requests
- B-1.3 Food-Relation-Datumssemantik

**Expected Handoff:**

- grüne Backend-, Shared- und Mobile-Testläufe für die betroffenen Slices
- Boundary-Evidenz für UTC−/UTC+-Geräte und Mitternachtsübergänge
- Handler-/Contract-Evidenz für fehlende/ungültige lokale Kontextwerte
- Persistenzprüfung ohne Migration und ohne Veränderung historischer Dokumente

### Subtask Q-1.2 — Geräte- und Akzeptanzprüfung

**Agent:** QA

**Goal:** Die sichtbaren User-Flows und die Konsistenz der lokalen Tage auf realen oder emulierten Zeitzonen prüfen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**

- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/modules/nutrition/CopyItemSheet.tsx`
- `mobile/src/modules/recipes/LogRecipeModal.tsx`
- `mobile/src/modules/nutrition/CyclingInputScreen.tsx`
- `mobile/src/modules/nutrition/HikingInputScreen.tsx`
- `mobile/src/shared/components/HistoryList.tsx`
- `mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4
- AC-6
- AC-7
- AC-9

**Dependencies:**

- Q-1.1 Automatisierte Regression und Boundary-Tests

**Expected Handoff:**

- manuelle Ergebnis-Matrix für mindestens UTC−5, UTC, UTC+2 und UTC+14
- Nachweis für Verhalten kurz vor/nach lokaler Mitternacht
- Bestätigung, dass Tagesziel, Diary, Gewicht, Aktivitäten, Copy und Recipe Logging denselben lokalen Tag zeigen
- dokumentierte Rest-Risiken ohne Produktionscode-Änderung durch QA

## 14. Shared Package Changes

Der Backend-Agent besitzt nach den Agent Boundaries die Verantwortung für Shared-Typen. Geplant sind nur additive beziehungsweise semantisch notwendige Vertragsänderungen:

- `shared/types/hint.ts`: expliziter aktueller lokaler Gerätetag im `HintContext`; lokale Stunde kann „unknown“ repräsentieren.
- `shared/types/weights.ts`: keine Formänderung erforderlich; `date` bleibt date-only und `createdAt` bleibt Timestamp.
- `shared/types/userFoodRelation.ts`: keine neue Persistenzstruktur erforderlich. Falls die interne `recordUsage`-Signatur typisiert erweitert wird, darf kein frei vom Client kontrolliertes Persistenzfeld entstehen.
- `shared/lib/weeklyReviewCalculator.ts`, `shared/lib/weightTrend.ts` und andere historische Calculator bleiben unverändert, sofern Tests bestätigen, dass ihre UTC-neutrale date-only-Arithmetik korrekt ist.

## 15. Persistence Impact

**Migration class:** Class 0 — keine Schema-, Container- oder Partition-Key-Änderung; keine historische Migration erforderlich.

- Bestehende Cosmos-Container, insbesondere `nutritionDiaryMeals`, `weights`, `userFoodRelations` und `aiInsights`, bleiben unverändert.
- Bestehende `HintState`, `UserFoodRelation.usageDates`, Weight- und Diary-Dokumente bleiben lesbar.
- Neue Hint-State-Writes verwenden den lokalen Gerätetag; bestehende `lastHintDate`-/Cooldown-Strings werden nicht nachträglich korrigiert.
- Neue `usageDates` verwenden das vorhandene Diary-Meal-Datum; bestehende Usage-Date-Einträge bleiben unverändert.
- Neue Weight- und Diary-Writes erhalten weiterhin dieselben date-only-Felder, nur mit der korrekten lokalen Quelle.
- Technische Timestamps bleiben UTC und erhalten ihre bisherigen Feldnamen und Formate.
- Keine Anpassung an `backend/src/lib/cosmos.ts`, `infra/modules/cosmos.bicep` oder `infra/main.bicep` erforderlich.

## 16. Infrastructure and Configuration

- **Bicep:** keine Änderung.
- **Cosmos:** keine neue Collection, kein neuer Index, kein neuer Partition Key.
- **Function App-Konfiguration:** keine neuen Secrets oder Settings.
- **Mobile Native Layer:** keine neue native Abhängigkeit und keine Config-Plugin-/EAS-Änderung.
- **Development:** Nach der sequenziellen Implementierung ist eine normale Dev-Ausführung beziehungsweise Dev-Bereitstellung zur Ende-zu-Ende-Prüfung erforderlich.
- **Alpha:** Keine Alpha-Bereitstellung ist Teil dieses Plans. Eine spätere Alpha-Freigabe bleibt ein separater, ausdrücklich angeforderter Release-Vorgang.
- Es gibt kein eigenes Infrastructure-&-Release-Work-Package, weil keine Infrastrukturentscheidung oder IaC-Änderung erforderlich ist.

## 17. Documentation Updates

Nach erfolgreicher Implementierung sind die betroffenen Knowledge-Base-Dokumente durch die zuständigen Implementierungsagenten zu aktualisieren:

- `docs/kb/tech/09-api-reference.md`: Pflichtfelder, `localDate`, `localHour`, `timezoneOffsetMinutes`, lokale-minus-UTC-Definition und Fehlerverhalten.
- `docs/kb/domain/02-diary.md`: Hint-Cooldown-Tag, aktuelle lokale Stunde und Trennung von angezeigtem Diary-Datum und aktuellem Gerätetag.
- `docs/kb/domain/05-weight-tracking.md`: Weight-`date` als expliziter lokaler date-only-Wert und UTC-`createdAt`.
- `docs/kb/tech/03-mobile.md`: kanonischer lokaler Date-Helper und betroffene Default-/Navigation-Flows.
- `docs/kb/tech/04-shared-library.md`: aktualisierter Shared-Hint-Context, falls der Dokumentationsumfang dort beschrieben ist.

Die Dokumentation muss ausdrücklich festhalten, dass keine historische Migration stattfindet und UTC-Timestamps nicht in lokale Date-only-Werte umgewandelt werden.

## 18. Test Strategy

### Unit-Tests

- `localDate.ts`: lokale Werte, einstellige Monate/Tage, Leap Day, date-only-Tagesarithmetik und lokale Offsetgrenzen.
- Mobile API-/Service-Tests: Diary-Parameter, Daily-Insight-Parameter, Ranked-Favorites-Referenzdatum und Weight-Payload bei `date: undefined`.
- Hint Engine: expliziter lokaler Gerätetag, lokale Hour-Unknown-Semantik, Cooldown an lokaler Mitternacht und historische Diary-Abfrage ohne Server-UTC-Datum.
- Weight Handler: fehlendes, ungültiges, gültiges und explizites Datum.
- Daily Insight Handler/Repository: Pflichtdatum, Pflichtoffset, lokaler Tageswechsel, TTL bis lokale Mitternacht, Cache-Hash und unveränderte UTC-`generatedAt`-/`expiresAt`-Werte.
- Favorites Scoring/Relation Repository: date-only-90-Tage-Fenster relativ zum Request-/Meal-Datum, technische `lastUsedAt`-Recency und Legacy-Usage-Date-Lesbarkeit.

### Contract-Tests

- Cosmos-Weights und User-Food-Relations prüfen, dass Dokumentformen, Partition Keys und Timestamp-Felder unverändert bleiben.
- Bestehende Hint-State-/Diary-Dokumente ohne neue Felder bleiben lesbar.
- Es wird kein Test gegen echte Azure-Ressourcen ausgeführt.

### Boundary-/E2E-Matrix

Mindestens:

- UTC−5 am lokalen `00:30`, wenn UTC bereits am Folgetag ist.
- UTC+2 am lokalen `00:30`, wenn UTC noch am Vortag ist.
- UTC+14 und UTC−12/−11 als Offsetgrenzen, soweit die Testumgebung sie unterstützt.
- Übergang über lokale Mitternacht bei Home-Fokus, Diary-Next/Prev, Gewicht, Copy, Recipe Logging und Activity-Labels.
- DST-Übergang für date-only-Arithmetik, ohne dass ein Kalendertag übersprungen oder verdoppelt wird.
- Validierung, dass technische Timestamps weiterhin mit `Z` gespeichert/transportiert werden.

## 19. Acceptance Criteria

- **AC-1:** Auf einem Gerät, dessen lokale Zeit nach UTC-Mitternacht bereits am neuen Tag liegt, verwenden Home-Diary, Tagesziel, DayType-Write, Activity-Aktionen und Daily Insight denselben lokalen `YYYY-MM-DD`-Wert.
- **AC-2:** Diary-Initialisierung, Zurück/Vor-Navigation, „Heute“, „Gestern“ und Next-Day-Grenze folgen dem lokalen Gerätetag; kein Label wird durch UTC-Konvertierung um einen Tag verschoben.
- **AC-3:** Food-Entry-Hub, Copy-Item, Recipe-Logging sowie Hiking-/Cycling-Labels verwenden lokale Defaults und korrekte date-only-Arithmetik.
- **AC-4:** Weight-Logging speichert ohne übergebenes Datum den lokalen Gerätetag; ein explizit ausgewähltes Datum bleibt erhalten; `undefined` überschreibt den lokalen Default nicht.
- **AC-5:** Backend-Weight-POST und alle neu verpflichtenden lokalen Kontextverträge akzeptieren kein fehlendes oder ungültiges date-only-Datum mit einem stillen UTC-Fallback.
- **AC-6:** Hint-Cooldowns und `HintState.lastHintDate` verwenden den aktuellen lokalen Gerätetag; `lastHintGeneratedAt` bleibt ein UTC-Timestamp; fehlende lokale Stunde erzeugt keinen künstlichen Stundenwert.
- **AC-7:** Daily Insight verwendet das explizite lokale Anfragedatum sowie den validierten Geräteoffset für aktuellen Tag, Activity-Heuristik, Cache-Hash, lokale Mitternacht und TTL; technische Response-/Persistenzzeitpunkte bleiben UTC.
- **AC-8:** Food-Relation-`usageDates` verwenden das tatsächliche Diary-Meal-Datum, Ranked Favorites verwenden ein lokales Referenzdatum für date-only-Fenster, und `lastUsedAt` bleibt elapsed-time-basiert als UTC-Instant.
- **AC-9:** Kein technischer Timestamp, kein UTC-Quota-Zeitraum und keine sichere UTC-neutrale historische date-only-Berechnung wird durch eine lokale Date-String-Extraktion beschädigt.
- **AC-10:** Bestehende Diary-, Weight-, Hint-State-, Daily-Insight- und User-Food-Relation-Dokumente bleiben ohne Migration lesbar; falsch datierte historische Werte werden nicht verändert.
- **AC-11:** Die Änderungen besitzen fokussierte Unit-/Handler-/Repository-/Contract-Tests sowie dokumentierte Boundary-Ergebnisse für UTC−- und UTC+-Zeitzonen.
- **AC-12:** `docs/kb/tech/09-api-reference.md`, die relevanten Domain-Dokumente und die Mobile-Architekturdokumentation beschreiben nach der Umsetzung dieselbe lokale/UTC-Semantik wie der Code.

## 20. Risks and Edge Cases

- **Legacy-Clients:** Ein alter Client ohne Pflichtdatum erhält `400` statt einer scheinbar funktionierenden UTC-Antwort. Das ist für die geforderte Semantik beabsichtigt; alle bekannten First-Party-Aufrufer müssen in derselben Änderung aktualisiert werden.
- **Historische Diary-Ansicht:** Der angezeigte Tag und der aktuelle lokale Gerätetag sind verschieden. Der Plan trennt beide Werte, damit ein historischer Read nicht den Cooldown mit dem historischen Datum überschreibt.
- **Gerätezeitzone ändert sich:** Der nächste Request verwendet den neuen lokalen Gerätetag. Bereits gespeicherte date-only-Werte bleiben unverändert.
- **DST:** Date-only-Arithmetik darf nicht über lokale Mitternachts-Instants mit 24-Stunden-Annahmen implementiert werden. Tests müssen Kalenderarithmetik und lokale Anzeige getrennt prüfen.
- **Ungültiger Offset:** Ein Offset außerhalb `-840..840` oder nicht-ganzzahlig darf nicht als UTC interpretiert werden. Daily Insight liefert den definierten Validierungsfehler.
- **Server-/Geräteuhrdrift:** Für userbezogene Date-only-Werte ist der Mobile-Wert maßgeblich. Technische Instants bleiben von der Serveruhr abhängig und werden nicht in Business-Daten umgedeutet.
- **Date-only-UTC-Arithmetik:** Die Verwendung von UTC-Komponenten in einer Funktion, die bereits einen reinen `YYYY-MM-DD`-String verarbeitet, ist zulässig. QA muss sicherstellen, dass daraus keine aktuelle Server-UTC-Ableitung entsteht.
- **Asynchrone Food-Relation-Aufzeichnung:** `recordUsage` bleibt fire-and-forget und darf den Diary-Add nicht blockieren; das explizite Meal-Datum muss trotzdem in beiden Repository-Implementierungen verwendet werden.
- **Daily-Insight-Cache:** Offset ist Teil des bestehenden Hash-/TTL-Vertrags. Änderungen daran dürfen keine neuen Prompt- oder AI-Semantikänderungen verursachen.

## 21. Recommended Execution Order

Die Orchestrierung erfolgt strikt sequenziell:

1. **Backend B-1.1:** Shared-/API-Kontextvertrag und Validierungsregeln festlegen.
2. **Backend B-1.2:** Diary, Hint, Weight und Daily Insight auf explizite lokale Kontextwerte umstellen.
3. **Backend B-1.3:** Food-Relation-Datumssemantik und Ranked-Favorites-Referenzdatum umsetzen.
4. **Frontend F-1.1:** Lokale Date-Helper sowie Home-, DayType-, Diary- und Historienpfade umstellen.
5. **Frontend F-1.2:** API-Clients, Weight-Payload, Activity-/Copy-/Recipe-/Hub-Flows und Favorites-Request aktualisieren.
6. **QA Q-1.1:** Unit-, Handler-, Repository- und Contract-Tests einschließlich Boundary-Fällen ausführen und Defekte an den zuständigen Implementierungsschritt zurückgeben.
7. **QA Q-1.2:** Geräte-/Emulatorprüfung über lokale UTC−/UTC+-Zeitzonen und Mitternachtsübergänge durchführen.
8. **Dokumentationsabschluss:** Die in Abschnitt 17 genannten KB-Dokumente mit dem implementierten Verhalten abgleichen.
9. **Development-Verifikation:** Standardmäßige Dev-Ausführung beziehungsweise Dev-Bereitstellung und End-to-End-Prüfung; keine Alpha-Aktion ohne separate Anforderung.

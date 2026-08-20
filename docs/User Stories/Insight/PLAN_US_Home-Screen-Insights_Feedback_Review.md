# PLAN - Home-Screen-Insights verbessern, Feedback erfassen und technisch reviewen

**User Story:** `US_Home-Screen-Insights_Feedback_Review.md`  
**Planner:** FitTrack Planner  
**Datum:** 2026-08-20  
**Status:** [Correction Approved] Korrekturplanung genehmigt; die Korrekturimplementierung ist noch nicht erfolgt.  
**Approval Traceability:** Die Nutzerfreigabe in der aktuellen Korrekturrunde lautet: "3 ist approved. Behebe die Punkte. Dazu diesen Problem aus dem Log. Das Feature funktioniert nicht mal. Ich will dies per Unit test abgedeckt haben, solche gravierenden Fehler dürfen nicht durch den Prozess durchgehen." Diese Freigabe wird als Zustimmung zur Korrektur von F-04, F-05, F-06 und der stale-weight-Regression interpretiert, nicht als Behauptung einer abgeschlossenen Implementierung.  
**Classification:** Accept with modifications; Requires domain validation before Alpha.  
**Infrastructure Impact: Dev**  
**Mobile Build Impact: None**

Dieser Plan bleibt ein Planungsartefakt. Es werden in dieser Runde keine
Produktionsdateien, Tests, Infrastrukturdateien, Knowledge-Base-Dateien,
QA-Findings oder QA-Reports durch den Planner geändert. Die Korrektur ist für
die spätere Implementierung freigegeben, aber nicht als umgesetzt zu melden.

**Baseline-Erhaltung:** Der bereits dokumentierte Feature-Plan, WP1-WP7 und
AC-1 bis AC-27 bleiben vollständig als fachliche und technische Baseline
erhalten. Die folgenden Korrekturabschnitte öffnen das abgeschlossene Feature
nicht erneut, sondern supersedieren nur widersprüchliche Aussagen zu F-04,
F-05, F-06 und dem stale-weight-Laufzeitfehler.

## 1. Requirement Assessment

### Problem und Lösungseignung

Die Story beschreibt keinen isolierten Prompt-Fehler, sondern einen fachlichen
Vertrag für den vollständigen Daily Insight:

```text
serverseitige Daten und Fakten
  -> deterministische Analyse und Intent
  -> fokussiertes deutsches Prompt
  -> validierte AI-Formulierung
  -> reproduzierbares Daily-Dokument
  -> optionaler, exakt gebundener Feedback-Snapshot
```

Die bestehende v9-Prompt-Akkumulation, die fehlende historische Zielauflösung
und die fehlende Information über den Aktivitätsstatus machen einen reinen
Prompt-Patch ungeeignet. Die vollständige Refaktorierung bleibt daher fachlich
und technisch im Scope.

Deterministische Berechnung bleibt autoritativ. Die AI formuliert nur aus
serverseitig validiertem Kontext. Sie darf weder Kalorienziele,
Aktivitätsstatus, historische Daten noch die Intent-Priorität selbst erfinden.

### Product-Owner-Entscheidungen, die in diesem Plan berücksichtigt sind

| ID | Entscheidung | Umsetzung im Plan |
|---|---|---|
| PO-1 | Vor 20:00 lokale Zeit ist eine eingetragene Aktivität `planned`; ab 20:00 darf sie als wahrscheinlich abgeschlossen behandelt werden. | `planned` für `localHour` 0-19, `likely_completed` für 20-23. `likely_completed` ist ausdrücklich keine bestätigte Tatsache. Keine Änderung an Activity-Entry-UI oder Activity-Request. |
| PO-2 | Feedback-Trigger ist ein Kebab-Menü. | Drei-Punkte-Menü im Insight-Bereich mit „Feedback geben“. |
| PO-3 | Kommentar ist Pflicht. | Server trimmt und akzeptiert genau 1-500 Zeichen; Mobile deaktiviert den Submit bei leerem getrimmtem Text. |
| PO-4 | Feedback gehört zum exakt angezeigten/geöffneten Daily Insight. | API verwendet `date` plus exakt gespeichertes `insightGeneratedAt`; kein stilles Umhängen auf eine spätere Neugenerierung. |
| PO-5 | Mehrere unabhängige Feedbacks pro angezeigtem Insight sind erlaubt. | Jede neue `submissionId` ergibt ein eigenes Dokument; Wiederholungen derselben ID sind idempotent. |
| PO-6 | Keine automatische Löschung oder Retention/TTL für Feedback. | Feedback-Dokumente haben kein `ttl` und kein `expiresAt`; eine spätere manuelle DB-Bereinigung bleibt ein operativer Vorgang außerhalb dieses Features. |
| PO-6A | Für die Anforderung genügt, dass Admins die gespeicherten Feedback-Daten lesen können; es ist keine bestimmte neue Rolle erforderlich. | Bereits autorisierte administrative/operative Zugänge dürfen die Feedback-Dokumente direkt im bestehenden `aiInsights`-Container lesen. Dieses Feature führt dafür keine neue Anwendungsrolle, kein neues Berechtigungsmodell, keine Admin-UI und keinen Lese- oder Löschendpoint ein. |

### Classification-Begründung

Die fachliche Zielsetzung wird angenommen. Die Anpassungen bestehen aus
technisch sicherer Statusbenennung (`likely_completed` statt eines unbelegten
`completed`), einem server-owned Snapshot-Vertrag und der Trennung zwischen
Daily-TTL und Feedback-Lebensdauer. Die Zeitheuristik und die
Aktivitätsformulierungen benötigen vor einer Alpha-Freigabe Domain-Validation;
dies ist kein weiteres offenes PO-Produktvotum.

Die PO-Klarstellung löst PO-6A für dieses Feature: Der bestehende autorisierte
administrative/operative Datenbankzugriff ist als Lesemöglichkeit ausreichend.
Es wird kein neuer Rollen- oder API-Vertrag für den Zugriff erfunden. Die
Feedback-Erfassung persistiert die Daten so, dass dieser bestehende Zugriff
den vollständigen Snapshot direkt im vorhandenen `aiInsights`-Container
analysieren kann.

Die Traceability beantwortet konkret, was der Nutzer beanstandet hat und
welcher Prompt mit welchen Eingaben verwendet wurde. Sie klassifiziert jedoch
nicht automatisch, ob die Ursache in Prompt-Logik, Eingabedaten oder
Domänenregeln liegt; diese fachliche Auswertung bleibt eine spätere manuelle
Analyse.

### Open Product Owner Decisions

- Keine offenen Product-Owner-Entscheidungen verbleiben für den Scope dieses
  Features. PO-6 und PO-6A sind durch die neue Klarstellung aufgelöst: Kein
  automatisches Löschen, kein Feedback-Read-/Cleanup-Endpoint und keine neue
  App-Rolle; bestehende autorisierte administrative/operative Zugänge dürfen
  die Persistenz direkt lesen.
- Die konkrete spätere Betriebsdokumentation und Ausführung einer manuellen
  DB-Bereinigung ist ein operatives Follow-up außerhalb dieses Features. Sie
  ist weder Voraussetzung für die Implementierung noch ein Blocker für den
  Orchestrator-Flow.

### Begriffsvertrag: displayed Insight instance

„Displayed Insight instance“ bezeichnet in diesem Plan die einzelne vom
Backend erzeugte Daily-Insight-Instanz, die dem Nutzer angezeigt und als
`InsightDocument` für Nutzer und Datum gespeichert wurde. Die Bindung erfolgt
nicht über einen unpräzisen UI-Begriff, sondern über den exakten Zeitstempel
`insightGeneratedAt`.

Die Feedback-Identität lautet exakt:

```text
(userId aus JWT, date, insightGeneratedAt)
```

`insightGeneratedAt` ist der unveränderte, kanonische UTC-ISO-Zeitstempel des
gespeicherten `InsightDocument.generatedAt`. Eine spätere Neugenerierung ist
eine neue Insight-Instanz, die den aktuellen Daily-Cache ersetzt. Eine alte
Instanz wird nicht in der mobilen UI historisch angezeigt; nur ein bereits
abgegebenes Feedback enthält ihren serverseitigen Snapshot.

## 2. Recommended Product Behaviour

### Activity-Status

Der bestehende `SpecialActivity`-Datensatz bleibt unverändert. Der Status wird
nur für den Daily-Insight-Kontext deterministisch aus der lokalen Stunde
abgeleitet:

| Bedingung für die angeforderte lokale Tagesansicht | Status | Sprachliche Bedeutung |
|---|---|---|
| Keine `specialActivity` | `null` | Kein Aktivitätskontext |
| Gültige lokale Stunde `0..19` | `planned` | Eingetragen, aber noch nicht als durchgeführt behandeln |
| Gültige lokale Stunde `20..23` | `likely_completed` | Darf als wahrscheinlich abgeschlossen eingeordnet werden, aber nicht als bestätigter Fakt |
| Fehlende, nicht ganzzahlige oder außerhalb `0..23` liegende Stunde | `unknown` | Keine Abschlussaussage |

Die Regel gilt für den normalen Daily-Aufruf des aktuellen lokalen Tages. Eine
nicht aktuelle oder anderweitig rückwirkend angeforderte Tagesansicht darf
keine Abschlussaussage aus der aktuellen Uhrzeit ableiten und verwendet
`unknown`. Ein fehlerhafter Client-Zeitwert darf nicht durch Clamping zu
`likely_completed` werden.

`likely_completed` darf im Prompt Formulierungen wie „dürfte inzwischen
stattgefunden haben“ oder „wenn die Tour bereits beendet ist“ ermöglichen,
aber niemals eine bestätigte Aussage wie „du hast die Tour absolviert“ ohne
zusätzliche Statusquelle. Die Heuristik ist eine temporäre Produktregel und
keine Ground Truth. Eine künftige Google-Health-/Health-Connect-Anbindung oder
eine explizite Statusquelle wird als eigener Backlog-Punkt behandelt; beides
ist in diesem Plan Out of Scope.

### Feedback

Das Kebab-Menü ist nur für einen realen `fresh`- oder `cached`-Insight mit
Feedback-Provenienz sichtbar. Es öffnet ein Pflichtkommentar-Sheet. Der
Mobile-Client merkt sich beim Öffnen `date` und `insightGeneratedAt` der
angezeigten Instanz. Ein Refresh während des offenen Sheets ändert diese Werte
nicht.

Ein logischer Submit-Vorgang hat eine stabile `submissionId`. Netzwerk- oder
manuelle Wiederholungen senden dieselbe ID und denselben getrimmten Kommentar.
Ein neues Feedback-Sheet bzw. ein absichtlich geänderter Kommentar nach einem
Fehlversuch beginnt mit einer neuen ID. Ein positives Feedback wird nicht
gespeichert.

Es gibt keine historische Feedback-Ansicht in Mobile. Das Backend speichert
den vollständigen, server-owned Snapshot für spätere direkte Auswertung durch
bereits autorisierte administrative/operative Zugänge. Mobile erhält keinen
Snapshot zurück; ein Read-Endpoint, eine Analyse-UI und ein Cleanup-Endpoint
werden nicht angelegt. Die Persistenz erteilt weder normalen Nutzern noch
jedem beliebigen Admin automatisch Datenbankzugriff.

Jedes Feedback bewahrt den serverseitig getrimmten Originalkommentar, die
angezeigte/generierte Insight-Antwort, den exakt serialisierten Prompt-Input,
den exakt ausgewählten System-Prompt und alle serverseitigen Eingaben und
Versionsdaten. Dadurch kann später nachvollzogen werden, was der Nutzer
beanstandet hat und welche Prompt-/Input-Kombination die Antwort erzeugt hat;
eine automatische Ursachenklassifikation (Prompt-Logik vs. Eingabedaten vs.
Domänenregeln) ist ausdrücklich nicht Bestandteil dieses Features.

## 3. Feature Summary

Die Umsetzung besteht aus sechs fachlich verbundenen Teilen:

1. vollständiger deterministischer Context- und Intent-Refactor des Daily
   Insights für F1-F9;
2. historische, snapshot-first Ziel- und Aktivitätsdaten für aktuelle und
   vergangene Tage;
3. 20:00-Activity-Heuristik mit sicherer probabilistischer Sprache;
4. fokussierte v10-Promptmodule, Strict Structured Outputs und semantische
   Servervalidierung;
5. authentifizierter Feedback-POST mit exakter Instanzbindung, Idempotenz und
   mehreren separaten Snapshot-Dokumenten;
6. Kebab-Menü und Pflichtkommentar-Sheet in der bestehenden Home-InsightCard.

Weekly Insight, Hint Engine, Activity-Eingabe und lokale Datumsflüsse außerhalb
des Daily-Aufrufs bleiben unverändert, abgesehen von einem gemeinsam
verwendeten, rückwärtskompatiblen historischen Ziel-Resolver.

## 4. Current Behaviour

### 4.1 Aktueller Daily-Pfad

Der aktuelle Codepfad ist:

```text
GET /api/ai/daily-insight
  -> backend/src/functions/dailyInsight.ts
     -> buildInputContext()
     -> computeProgressIntelligence()
  -> generateDailyInsight() in backend/src/lib/openai.ts
     -> dailyInsightV9.ts als ein monolithisches System-Prompt
  -> aiInsights-Cache über insightRepository.ts
  -> InsightResponse
```

`buildInputContext()` liest DayMeta, Diary, Gewichte, Profil und Insight-
Historie. Für die letzten drei Tage werden bisher nur Kalorien und Protein aus
dem Diary verwendet; historische DayMeta-Ziel-Snapshots und Aktivitätsboni
fehlen. Ein vorhandener MealItem mit `0` kcal wird wegen der Prüfung auf eine
positive Kaloriensumme wie ein leerer Tag behandelt.

Der aktuelle `SpecialActivity`-Typ enthält keinen Status. Der Builder übernimmt
die Aktivität ohne belastbare Abschlussinformation. Der aktuelle Handler
clamped eine numerische `localHour` auf `0..23` und behandelt damit fehlerhafte
Eingaben nicht als unbekannt.

Der Mobile-Home-Aufruf verwendet aktuell für den Daily-GET ein UTC-basiertes
Datum. `mobile/src/services/insightService.ts` sendet `date` und `localHour`,
aber noch keinen Feedback-Kontext.

### 4.2 Prompt und AI-Vertrag

`backend/src/lib/prompts/dailyInsightV9.ts` enthält die über mehrere Versionen
gewachsene Regelansammlung für F1-F9. `generateDailyInsight()` verwendet
`response_format: { type: 'json_object' }`, schneidet Textwerte manuell zu und
führt keine vollständige Strict-Schema- und semantische Konsistenzprüfung durch.
Es existieren keine Daily-Live-Evals nach dem Muster der anderen AI-Features.

### 4.3 Persistenz und Cache

`InsightDocument` enthält bereits `inputContext`, `feedbackScore`, Modell,
Tokenzahl, Prompt-Version und `intelligenceVersion`, aber noch keinen
Discriminator für neue Daily-Dokumente, keinen Intent und keinen exakten
Prompt-Snapshot. `get()` akzeptiert derzeit auch fremde Dokumenttypen; die
Cosmos-Abfrage für `listRecent()` schließt Weekly, aber nicht jeden künftigen
Feedback-Typ aus.

Der bestehende `aiInsights`-Container ist mit Partition Key `/userId` und
`defaultTtl: -1` vorhanden. Daily-Dokumente erhalten einen eigenen TTL bis zur
bisherigen Mitternachtsgrenze. Ein Feedback-Endpoint und ein separates
Feedback-Dokument existieren noch nicht.

### 4.4 Mobile

`InsightCard` zeigt derzeit Titel, Summary, Empfehlung und CTA. Es gibt kein
Kebab-Menü, kein Feedback-Sheet und keinen Feedback-Service. Der bestehende
`@gorhom/bottom-sheet`-Provider und `expo-crypto` sind bereits im Mobile-Paket
vorhanden.

## 5. Desired Behaviour

### 5.1 Context, Datenqualität und historische Ziele

Der Context-Builder liefert einen vollständigen, server-owned
`InsightInputContext`:

- aktuelles lokales date-only-Datum, lokale Stunde und Tageskontext;
- `SpecialActivity` und den daraus abgeleiteten
  `activityCompletionStatus` samt Quelle der Heuristik;
- aktuelle Ernährung inklusive gültiger `0`-Werte;
- effektives aktuelles Kalorienziel aus Basisziel plus Aktivitätsbonus;
- letzte drei abgeschlossene Tage mit `hasMealItem`, historischen Zielquellen,
  Basisziel, effektivem Ziel, Aktivitätsbonus und Aktivität;
- Gewichts- und Zielkontext mit Staleness- und Outlier-Flags;
- `ProgressIntelligence` als deterministische Analyse;
- optionaler serverseitiger, aggregierter Vorwochenkontext für die
  Montags-/Morgenorientierung, ohne rohe Produkt- oder Mahlzeitentexte.

Für einen historischen Tag gilt derselbe Ziel-Resolver wie im bestehenden
Weekly-Vertrag:

1. `DayMeta.calorieTargetSnapshot.calories`;
2. rückwärtskompatibel `specialActivity.dailyCalorieTarget`;
3. aktuelles Profilziel als ausdrücklich markierter Read-only-
   `profile_fallback`, sofern keine Special Activity ohne brauchbaren
   Ziel-Snapshot vorhanden ist;
4. andernfalls `unavailable`.

Das Profil-Fallback wird nie als gespeicherte historische Tatsache formuliert.
Eine vorhandene Special Activity ohne brauchbaren Ziel-Snapshot wird nicht durch
ein Profilziel ersetzt. Die gemeinsame Pure-Logik wird aus
`shared/lib/weeklyReviewCalculator.ts` extrahiert oder dort als öffentliche
Funktion verwendet; eine zweite abweichende Zielauflösung ist nicht zulässig.

Für jeden der drei Vortage werden Diary und DayMeta geladen. Ein vorhandener
MealItem mit `0` kcal ist ein gültiger Ernährungstag. Ein Tag ohne MealItem
bleibt bei den Ernährungswerten `null`. Ein Repository-Fehler bei einem
benötigten historischen Read wird nicht als leerer Tag verschluckt: Der
Daily-Handler liefert den bestehenden freundlichen `unavailable`-Vertrag,
persistiert keinen unvollständigen Insight und zählt keine Quota-Nutzung.

### 5.2 Shared Activity-Statusvertrag

In `shared/types/insight.ts` wird ein additiver Statusvertrag vorgesehen:

```ts
export type ActivityCompletionStatus =
  | 'planned'
  | 'likely_completed'
  | 'unknown';

export type ActivityStatusSource =
  | 'local_time_heuristic'
  | 'unavailable';
```

`InsightInputContext` erhält bei vorhandener Aktivität
`activityCompletionStatus` und `activityStatusSource`; ohne Aktivität sind
beide Werte `null`. Es gibt in diesem Plan keinen `completed`-Wert, weil die
aktuelle Activity-Erfassung keine bestätigte Quelle liefert. Historische
Activity-Snapshots werden für Zielberechnung und neutralen Kontext genutzt;
aus der aktuellen Uhrzeit wird rückwirkend kein historischer Abschlussfakt
erzeugt.

Die Boundary-Tests müssen mindestens abdecken: `19 -> planned`, `20 ->
likely_completed`, `23 -> likely_completed`, `0 -> planned`, fehlend ->
`unknown`, nicht ganzzahlig/außerhalb -> `unknown`, keine Aktivität -> `null`.

### 5.3 Deterministischer Intent

Eine I/O-freie `selectInsightIntent(context)`-Funktion verwendet eine
explizite, getestete Priorität:

```ts
type InsightIntent =
  | 'activity_focus'
  | 'weight_signal'
  | 'phase_progress'
  | 'morning_orientation'
  | 'nutrition_guidance'
  | 'general';
```

Routing:

1. vorhandene Activity immer als `activity_focus`, auch bei `planned` oder
   `unknown`;
2. starkes `primarySignal` aus Plateau, Milestone oder Phasenrückkehr als
   `weight_signal`;
3. `phase_context` als `phase_progress`;
4. früher Morgen ohne aktuelle MealItems als `morning_orientation`;
5. belastbarer aktueller Nutrition-Kontext als `nutrition_guidance`;
6. sonst `general`.

Gleicher validierter Context liefert immer denselben Intent. Die AI darf den
Intent nicht ändern. Lokale Tageszeit und der Status-Bucket werden in den
Hash aufgenommen; die alte v9-Antwort darf durch einen Prompt-Versionswechsel
nicht innerhalb des neuen Vertrags zurückkommen.

### 5.4 Prompt-Refaktorierung und Sprache

`dailyInsightV9.ts` wird nicht weiter erweitert. Der neue Mechanismus wird als
versionierter v10-Mechanismus geplant:

```text
backend/src/lib/prompts/
  sharedTone.ts
  promptWeight.ts
  promptActivity.ts
  promptNutrition.ts
  promptMorning.ts
  promptGeneral.ts
  dailyInsight.eval.fixtures.ts
  dailyInsight.eval.test.ts
```

Die Module teilen sich einen deutschen Tonvertrag: konkret, verständlich,
respektvoll, motivierend, nicht diagnostisch und nicht wertend. Verbotene
technische oder abstrakte Formulierungen werden zentral vorgegeben. Das
ausgewählte System-Prompt und die exakt serialisierte User-Message werden als
Snapshot gespeichert.

`promptActivity.ts` muss insbesondere ausdrücken:

- `planned`: Aktivität ist eingetragen/geplant, keine abgeschlossene Sprache;
- `likely_completed`: probabilistische oder konditionale Sprache, keine
  bestätigte Tatsache;
- `unknown`: neutral bleiben und keinen Abschluss behaupten;
- Typ, Dauer, Strecke, Gelände und Gepäck nur als vorhandene Signale
  verwenden;
- lange/intensive Ausdaueraktivitäten mit qualitativer Fueling- und
  Regenerationssprache behandeln, ohne neue exakte Ernährungsgrenzen ohne
  DV-2 zu erfinden.

`promptNutrition.ts` hält den Budget-Lock ein: Bei negativem
`remainingCalories` darf keine weitere Essensempfehlung entstehen, auch wenn
ein Protein-Gap besteht. `promptMorning.ts` bewertet einen leeren aktuellen
Tag nicht als Defizit und verwendet gestern/letzte Tage; ein Vorwochenkontext
darf am Montag nur verwendet werden, wenn er tatsächlich vorliegt.

### 5.5 Strict Structured Outputs und Servervalidierung

`generateDailyInsight()` verwendet `json_schema` mit `strict: true`, einem
benannten `daily_insight`-Schema, `required` für jede Strict-Property und
`additionalProperties: false` auf jeder Objektebene. Fachlich optionale Werte
werden als nullable Felder modelliert. Der bestehende öffentliche
`InsightResponse`-Vertrag bleibt rückwärtskompatibel.

Nach der Providerantwort prüft der Backend-Code weiterhin:

- `finish_reason` ist nicht `length` oder `content_filter`;
- Inhalt ist vorhanden, parsebar und schema-konform;
- Titel-, Summary-, Empfehlung- und CTA-Grenzen entsprechen dem kanonischen
  Vertrag;
- Summary-Länge und deutscher Ton sind im Eval-Vertrag festgelegt;
- `cta` und `ctaTarget` sind konsistent;
- keine verbotene Budget-, Activity- oder Gewichtsaussage wird durch den
  serverseitigen Pure-Validator akzeptiert.

Eine fehlende, abgeschnittene, schemawidrige oder semantisch nicht
validierbare Antwort wird `unavailable`, wird nicht als Daily-Dokument
gespeichert und zählt nicht zur Quota. `generateDailyInsight()` liefert
zusätzlich `intent` und `promptSnapshot: { system, user }`.

### 5.6 Daily-Dokument und Cache

Neue Daily-Dokumente erhalten `_docType: 'dailyInsight'` sowie `intent` und
`promptSnapshot`. Die vollständige Hash-Eingabe umfasst alle ausgaberelevanten
serverseitigen Werte: Datum, DayMeta, heutige und historische Ernährung,
Zielquellen, Activity-Daten, Status-Bucket, lokale Tageszeit,
Gewichts-/Progress-Signale, Intent und aktive Prompt-Version.

`feedbackScore` bleibt als kompatibles Markerfeld erhalten, wird aber nur auf
der exakt passenden Daily-Instanz aktualisiert. Eine spätere Neugenerierung
darf einen alten negativen Marker nicht auf die neue Insight-Instanz
übertragen. Die dauerhafte analytische Wahrheit ist das separate
Feedback-Dokument.

Legacy-Daily-Dokumente ohne Discriminator oder Prompt-Snapshot bleiben lesbar.
Sie sind für einen neuen Feedback-Snapshot nicht ausreichend und führen bei
einem neuen Feedback-Submit zu `409 feedback_snapshot_unavailable`. Neue
Daily-Antworten können dafür ein optionales `feedbackAvailable`-Signal
ausgeben; Mobile zeigt den Trigger nicht, wenn der Server es ausdrücklich auf
`false` setzt.

## 6. Scope

- vollständige Daily-Insight-Refaktorierung für F1-F9;
- Context-Builder mit Activity-Status, historischem Zielkontext,
  `0`-kcal-Semantik und Datenfehlerbehandlung;
- deterministischer Intent und fokussierte v10-Promptmodule;
- Strict Structured Outputs, semantische Validierung, Evals und Cache-
  Invalidierung;
- `_docType`-/Snapshot-Erweiterung für Daily-Dokumente;
- `POST /api/ai/daily-insight/feedback` mit Auth, Pflichtkommentar, exakter
  Instanzbindung, Idempotenz und mehreren Feedback-Dokumenten;
- server-owned, persistierter Feedback-Snapshot im bestehenden
  `aiInsights`-Container für spätere direkte Analyse durch bereits autorisierte
  administrative/operative Zugänge, ohne neuen App-Leseweg;
- Kebab-Menü, Bottom Sheet, Submit-Lock, Retry und deutsche Fehler-UX;
- additive Shared-Typen und rückwärtskompatible Repository-Verträge;
- Dokumentations-Handoff nach dem finalen Implementierungsstand.

## 7. Out of Scope

- Google Health-/Health-Connect-Anbindung zur Ermittlung eines echten
  Activity-Status;
- neue oder geänderte Activity-Entry-UI, Activity-Request-Felder oder
  explizite Statusauswahl;
- `completed` als bestätigter Status ohne neue Datenquelle;
- Feedback-Leseendpoint, Feedback-Löschendpoint, Analyse-API oder Analyse-UI
  in Mobile;
- historische Feedback-Ansicht in der Mobile-UI;
- neue Anwendungsrollen, ein neues Berechtigungsmodell, eine Admin-UI oder ein
  dedizierter administrativer Feedback-Read-/Cleanup-Endpoint;
- automatische Feedback-Löschung, TTL, `expiresAt` oder erfundene
  Retention-Dauer;
- Durchführung oder Auditierung einer späteren manuellen DB-Bereinigung als
  operatives Follow-up;
- positives Feedback oder Daumen-hoch-Flow;
- Weekly-Insight-Prompt, Weekly-Quota, Weekly-Cache und Weekly-UI;
- Hint Engine, Quota-Architektur und Authentifizierungsarchitektur;
- neue Cosmos-Container, Resource Groups, Bicep-Ressourcen oder neue
  Azure-OpenAI-/Health-Ressourcen;
- app-weite Local-Date-/UTC-Refaktorierung;
- operative Releasebefehle als eigenes Feature-Workpackage.

## 8. Confirmed Facts and Source Conflicts

### Repository-Fakten

- Daily-Handler: `backend/src/functions/dailyInsight.ts`.
- AI-Client: `backend/src/lib/openai.ts`.
- Aktueller Prompt: `backend/src/lib/prompts/dailyInsightV9.ts`.
- Daily-/Weekly-Repository: `backend/src/lib/repositories/insightRepository.ts`.
- Shared Insight- und Activity-Typen: `shared/types/insight.ts` und
  `shared/types/diary.ts`.
- Activity-Entry bleibt in `backend/src/functions/specialActivity.ts` und den
  vorhandenen Mobile-Screens unverändert.
- Mobile Insight-Aufruf: `mobile/src/services/insightService.ts`;
  Darstellung: `mobile/src/modules/home/InsightCard.tsx`;
  Orchestrierung: `mobile/src/modules/home/HomeScreen.tsx`.
- `@gorhom/bottom-sheet` und `expo-crypto` sind bereits in
  `mobile/package.json` vorhanden; es ist keine native Ergänzung geplant.
- `aiInsights` existiert in `backend/src/lib/cosmos.ts` und
  `infra/modules/cosmos.bicep` mit `/userId` und aktiviertem per-document TTL.

### Knowledge-Base-Fakten

- AI-Aufrufe gehören ausschließlich ins Backend.
- Strict Structured Outputs benötigen die dokumentierte Azure-OpenAI-
  API-Version von mindestens `2024-07-01`.
- Cosmos-Nutzerdaten verwenden `/userId`; neue Dokumentfelder sollen
  read-compatible sein.
- Business-Logik gehört in Pure Functions und wird unit-getestet.
- Mobile verwendet den bestehenden Axios-Client und deutsche UX-Muster.

### User- und Product-Owner-Klarstellung

- Feedback-Daten müssen als Admin lesbar sein; dafür ist keine neu benannte
  Anwendungsrolle und kein dedizierter administrativer Leseendpoint erforderlich.
- Der vorgesehene Zugriff erfolgt durch bereits autorisierte
  administrative/operative Zugänge direkt auf die Persistenz im bestehenden
  `aiInsights`-Container. Die bestehende `isAdmin`-App-Role wird dadurch nicht
  automatisch zu einem Datenbank-Leserecht erweitert.
- Mobile erhält nur die Submit-Antwort und niemals Feedback-Snapshots. Die
  Anwendung gewährt keinen impliziten Lesezugriff an Nutzer oder beliebige
  Admins; bestehende Betriebsautorisierung bleibt die Sicherheitsgrenze.
- Automatische Löschung bleibt deaktiviert. Eine spätere manuelle
  Datenbankbereinigung ist ein operativer Vorgang außerhalb dieses Features.

### Benannte Abweichungen

- `docs/kb/domain/07-ai-features.md` nennt an einer Daily-Stelle noch eine
  ältere Prompt-Version, während das Repository v9 verwendet. Für das aktuelle
  Verhalten gilt das Repository; WP6 aktualisiert die KB auf den finalen
  v10-Vertrag.
- `docs/kb/tech/09-api-reference.md` beschreibt noch keinen Feedback-POST. Der
  neue Endpoint wird nach Implementierung dort ergänzt.
- `docs/kb/domain/02-diary.md` beschreibt eine Special Activity als bereits
  stattgefundene körperliche Leistung. Diese Aussage reicht für die aktuelle
  User-Story nicht aus, weil der PO die temporäre lokale Zeitheuristik
  bestätigt hat. Die neue `planned`-/`likely_completed`-Semantik wird in WP6
  als ausstehende Dokumentationsänderung und nach Umsetzung als aktuelle Regel
  dokumentiert.

## 9. Assumptions and Open Questions

- Die mobile App sendet im normalen Daily-Flow das lokale date-only-Datum,
  `localHour` und einen validierten `timezoneOffsetMinutes`; die Uhrzeit ist
  ein Input für Formulierung, nicht für Authentifizierung oder Berechtigung.
- Ein falscher Gerätezeitwert kann die Heuristik verschieben. Der Snapshot
  muss deshalb `currentHourLocal`, Status und Statusquelle speichern.
- Der bestehende Daily-GET bleibt für Legacy-Clients tolerant. Fehlende oder
  ungültige Zeitwerte ergeben `unknown`, nicht `likely_completed`.
- Der neue Feedback-POST akzeptiert ausschließlich `date`,
  `insightGeneratedAt`, `submissionId` und `userComment`; Client-Context,
  Prompt, Response oder User-ID sind keine vertrauenswürdigen Felder.
- Die bestehende autorisierte administrative/operative DB-Lesemöglichkeit wird
  vorausgesetzt, aber nicht durch dieses Feature implementiert oder erweitert.
  Insbesondere werden keine neue Rolle, kein neuer Read-/Cleanup-Endpoint und
  keine Admin-UI geplant. Die spätere manuelle Bereinigung bleibt operativ
  außerhalb des Features.
- DV-1 bis DV-3 sind fachliche Gates vor Alpha und werden nicht durch
  technische Unit-Tests ersetzt.

## 10. Existing Components to Reuse

- `computeProgressIntelligence()` und die vorhandenen F1/F2-
  Gewichts-/Outlier-Signale;
- `shared/lib/weeklyReviewCalculator.ts` als Quelle für historische
  Zielauflösung und `0`-kcal-/fehlende-Daten-Semantik;
- `DayMetaRepository`, `DiaryRepository`, `ProfileRepository`,
  `WeightsRepository` und `InsightRepository` statt direkter Cosmos-Zugriffe
  im Handler;
- `withHandler()`, `requireUser()` und `parseBody()`;
- bestehende Quota-Prüfung für den Daily-GET, ohne Quota-Tracking für Feedback;
- `aiInsights`-Container und `/userId`-Partition;
- `BottomSheetModalProvider`, `@gorhom/bottom-sheet`, `Snackbar`,
  `InfoOverlay`-/Theme-Konventionen und vorhandener `Icon`-Wrapper;
- `expo-crypto.randomUUID()` für mobile Submission-IDs;
- bestehender Axios-`apiClient` und `aiApi`-Typisierung.

## 11. Proposed Technical Solution

### 11.1 Context- und Shared-Vertrag

`InsightNutritionDay` wird um nullable Werte, `hasMealItem`, Zielquelle,
historische Activity-Daten und den neutralen historischen Status erweitert. Das
aktuelle `InsightNutritionContext.today` bleibt `null`, wenn kein MealItem
vorhanden ist; bei einem vorhandenen MealItem bleiben alle Summenwerte
inklusive `0` gültig.

Der Context erhält mindestens:

```ts
activityCompletionStatus: ActivityCompletionStatus | null;
activityStatusSource: ActivityStatusSource | null;
currentHourLocal: number | null;
```

Für Montag-/Morgenorientierung darf ein kleiner aggregierter `previousWeek`-
Block ergänzt werden. Er enthält nur tatsächlich geladene Summen und `null` bei
fehlenden Daten; keine Mahlzeitennamen, Produkttexte, User-IDs oder technische
Cachewerte.

### 11.2 Prompt- und Intent-API

Die empfohlene API ist:

```ts
const intent = selectInsightIntent(context);
const prompt = buildDailyInsightPrompt(intent, context);
const result = await generateDailyInsight(context, intent, prompt);
```

`generateDailyInsight()` gibt Response, Tokenzahl, Intent und den exakten
`promptSnapshot` zurück. Der Prompt wird nicht aus dem Mobile-Request oder aus
einem später geänderten Context rekonstruiert.

### 11.3 Feedback-API

```text
POST /api/ai/daily-insight/feedback
Authorization: Bearer <JWT>
Content-Type: application/json
```

Request:

```json
{
  "date": "2026-08-20",
  "insightGeneratedAt": "2026-08-20T08:30:00.000Z",
  "submissionId": "uuid",
  "userComment": "Die Aktivität war nur geplant."
}
```

Der Server validiert ein reales Kalenderdatum, einen kanonischen UTC-
Zeitstempel, eine UUID und den getrimmten Kommentar mit 1-500 Zeichen.
`userId` kommt ausschließlich aus `requireUser()`. Nicht zum Vertrag gehörende
Snapshot-Felder werden nicht verwendet; die sicherste Implementierung weist
sie als ungültigen Body zurück.

Responses:

```text
201 { feedbackId: string, created: true }
200 { feedbackId: string, created: false }
400 invalid body
401 invalid or missing JWT
404 { code: "insight_not_found" }
409 { code: "insight_generation_changed" }
409 { code: "feedback_snapshot_unavailable" }
409 { code: "feedback_submission_conflict" }
500 generic handler error without stack trace
```

Verarbeitungsreihenfolge:

1. authentifizieren und Body validieren;
2. `getFeedbackBySubmissionId(userId, submissionId)` vor dem Daily-Read
   ausführen;
3. bei vorhandener ID die normalisierten unveränderlichen Request-Felder
   vergleichen: Gleichheit ergibt immer `200 created: false`, auch nach
   Daily-TTL-Ablauf; eine Abweichung ergibt `409
   feedback_submission_conflict` und ändert nichts;
4. bei neuer ID das Daily-Dokument mit `date` lesen; fehlend ergibt `404`, ein
   anderes `generatedAt` ergibt `409 insight_generation_changed`;
5. fehlender Prompt-Snapshot, Intent oder anderer zwingender neuer Provenienz
   ergibt `409 feedback_snapshot_unavailable`;
6. den Snapshot ausschließlich aus dem passenden Daily-Dokument aufbauen und
   per Create-if-absent unter `${userId}:feedback:${submissionId}` speichern;
7. einen Cosmos-Create-Konflikt erneut vergleichen und als identischen Retry
   oder Submission-Konflikt behandeln;
8. den kompatiblen negativen Marker nur auf der passenden Daily-Instanz patchen,
   ohne ihren ursprünglichen Ablaufzeitpunkt zu verlängern;
9. keine Quota-Prüfung und kein `trackUsage()` für Feedback ausführen.

Das separate Dokument enthält mindestens:

```ts
interface InsightFeedbackDocument {
  id: string;
  userId: string;
  _docType: 'insightFeedback';
  insightId: string;              // exact InsightDocument.id
  date: string;                   // exact InsightDocument.date, YYYY-MM-DD
  insightGeneratedAt: string;    // exact InsightDocument.generatedAt
  submittedAt: string;           // server time
  submissionId: string;
  score: 'negative';
  userComment: string;             // exact server-trimmed value, 1-500
  response: InsightResponse;        // exact server-generated/displayed content
  promptSnapshot: {
    system: string;                 // exact selected system prompt
    user: string;                   // exact serialized provider user message
  };
  promptVersion: string;            // exact selected prompt version
  intent: InsightIntent;             // server-selected deterministic intent
  inputContext: InsightInputContext; // exact server-side prompt inputs
  inputHash: string;                 // exact server-computed input hash
  model: string;                     // exact model/deployment identifier
  intelligenceVersion: string;       // exact server intelligence version
  tokensUsed: number;                // provider-reported token usage
}
```

#### Verbindliche Traceability-Matrix

Der Feedback-Snapshot ist kein vom Client zusammengesetztes Diagnoseobjekt.
Für jede neue `submissionId` werden die folgenden Werte unverändert aus dem
passenden Daily-Dokument und den serverseitig erzeugten Request-Artefakten
übernommen:

| Persistiertes Feld | Verbindliche Quelle und Aussage |
|---|---|
| `userComment` | Exakter serverseitig getrimmter Body-Wert mit 1-500 Zeichen; zeigt, was der Nutzer beanstandet hat. |
| `response` | Exakte servergenerierte und angezeigte Insight-Nutzlast aus `InsightDocument.response`; nie aus dem Client-Body. |
| `promptSnapshot.user` | Exakt serialisierte User-Message, die an Azure OpenAI gesendet wurde, einschließlich der serverseitig ausgewählten Prompt-Eingaben. |
| `promptSnapshot.system` | Exakt ausgewählter System-Prompt des verwendeten Intent-/Prompt-Moduls. |
| `promptVersion` | Serverkonstante der tatsächlich verwendeten Prompt-Version. |
| `intent` | Serverseitig deterministisch ausgewählter Intent; der Client kann ihn nicht setzen. |
| `inputContext` | Vollständiger serverseitiger `InsightInputContext`, der die Prompt-Eingaben einschließlich Datenquellen, Status und Aggregaten enthält. |
| `inputHash` | Serverberechneter Hash genau dieses Context-/Versionsvertrags. |
| `model` | Tatsächliche Modell-/Deployment-Kennung aus der Backend-Konfiguration. |
| `intelligenceVersion` | Version der deterministischen Progress-Intelligence, die den Context erzeugt hat. |
| `tokensUsed` | Vom Provider gemeldete Token-Nutzung des Generierungsvorgangs. |
| `insightId` | Exakte ID des referenzierten `InsightDocument`. |
| `date` | Exaktes date-only-Datum des referenzierten `InsightDocument`. |
| `insightGeneratedAt` | Exakter kanonischer UTC-ISO-Zeitstempel des referenzierten `InsightDocument.generatedAt`. |
| `submittedAt` | Serverseitiger Zeitpunkt der Feedback-Annahme; nicht vom Client geliefert. |

Diese Kombination erlaubt die spätere Gegenüberstellung von Nutzerkommentar,
Antwort, Prompt und Eingaben. Sie beweist die verwendete Provenienz, entscheidet
aber nicht automatisch, ob ein Problem durch Prompt-Logik, fehlerhafte
Eingabedaten oder eine Domänenregel verursacht wurde.

Das Dokument enthält absichtlich weder `ttl` noch `expiresAt`. Das bestehende
Container-`defaultTtl: -1` bleibt unverändert; ohne per-document `ttl` läuft das
Feedback nicht automatisch ab. Es bleibt bis zu einer späteren, autorisierten
manuellen Bereinigung nach der Analyse. Eine konkrete Dauer wird nicht
erfunden. Die direkte Lesbarkeit gilt ausschließlich für bereits autorisierte
administrative/operative Zugänge; sie schafft kein allgemeines Nutzer- oder
Admin-Leserecht und wird nicht über Mobile oder einen neuen Backend-Read-
Endpoint exponiert. Die spätere Bereinigung ist ein operativer Vorgang
außerhalb dieses Features.

### 11.4 Repository und Discriminator

`InsightRepository` erhält Methoden für:

```ts
getFeedbackBySubmissionId(userId, submissionId)
createFeedbackIfAbsent(document)
markNegativeFeedback(userId, date, insightGeneratedAt)
```

`createFeedbackIfAbsent()` verwendet atomare Create-/Conflict-Semantik in
Cosmos und eine eigene Map im In-Memory-Repository. `get()` akzeptiert neue
`dailyInsight`-Dokumente und Legacy-Daily-Dokumente ohne Discriminator, weist
aber Weekly- und Feedback-Dokumente zurück. `getWeekly()` und `listRecent()`
filtern anhand des Discriminators. Neue Daily-Upserts setzen `_docType:
'dailyInsight'` und erhalten den bisherigen Daily-TTL.

### 11.5 Persistence Impact

**Schema-Evolutionsklassifikation:**

- Neue Daily-Felder (`_docType`, Intent, Prompt-Snapshot, Status- und
  Context-Felder) sind additive Class 0/read-compatible Änderungen. Kein
  Backfill und keine Migration. Legacy-Dokumente bleiben lesbar und liefern
  für neue Felder sichere Fallbacks.
- `insightFeedback` ist ein neuer Dokumenttyp im bestehenden `aiInsights`-
  Container. Es gibt keine neue Collection, keinen neuen Partition Key und
  keine Migration bestehender Dokumente.
- Feedback erhält keinen Daily-TTL und kein eigenes automatisches Ablaufdatum.
  Der Unterschied zwischen dem bestehenden Daily-TTL und dem Feedback-No-TTL
  ist durch Contract-Tests nachzuweisen.

Backward Compatibility für Dev und Alpha: alte Daily-/Weekly-Dokumente bleiben
lesbar; alte Daily-Dokumente ohne vollständigen Snapshot können nicht
rückwirkend mit neuem Feedback versehen werden. Neue Feedbacks sind unter
`/userId` nutzerisoliert. Direkter administrativer/operativer DB-Zugriff ist
kein neuer Anwendungspfad und wird nicht durch den Feedback-POST oder die
Mobile-App verliehen.

### Persistence and Security Boundary

- Feedback bleibt ein neuer Dokumenttyp im vorhandenen `aiInsights`-Container;
  die Partitionierung `/userId` und die bestehende Cosmos-Autorisierung bleiben
  unverändert.
- Der Feedback-POST authentifiziert den Nutzer mit `requireUser()`. `userId`,
  Response, Prompt, Context, Hash, Modell, Versionen und Token-Nutzung stammen
  ausschließlich vom Server bzw. Provider. Der Client liefert nur die
  Identitätsreferenz (`date`, `insightGeneratedAt`, `submissionId`) und den
  Kommentar; auch diese Werte werden serverseitig validiert und normalisiert.
- Bereits autorisierte administrative/operative Zugänge dürfen die
  gespeicherten Dokumente direkt aus `aiInsights` lesen. Das ist eine Nutzung
  bestehender Betriebsautorisierung, keine neue App-Rolle und kein neuer
  Reader-Endpoint. Weder jeder authentifizierte Nutzer noch jeder JWT-Admin
  erhält automatisch Zugriff durch dieses Feature.
- Der Backend-POST sendet keinen Snapshot zurück; Mobile erhält nur die
  minimale Erfolgs-/Fehlerantwort. Es gibt keine historische Mobile-Ansicht,
  keine Analyse-UI und keinen Cleanup-Endpoint.
- Feedback-Dokumente enthalten kein `ttl` und kein `expiresAt`. Automatische
  Löschung bleibt deaktiviert; manuelle DB-Bereinigung und deren eventuelle
  Auditierung sind operative Folgearbeit außerhalb dieses Plans.

## 12. Backend Work Package

### WP1 - Shared Contracts, Context und deterministische Regeln

**Agent:** Backend  
**Goal:** Additive Shared-Typen, historische Zielauflösung, gültige
`0`-kcal-Semantik, lokalen Activity-Status und testbaren Context-Builder für
den vollständigen F1-F9-Kontext umsetzen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**
- `shared/types/insight.ts`
- `shared/types/diary.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/specialActivity.ts`
- `backend/src/lib/repositories/diaryRepository.ts`
- `backend/src/lib/repositories/dayMetaRepository.ts`
- `backend/src/lib/repositories/profileRepository.ts`
- `backend/src/lib/repositories/weightsRepository.ts`
- `backend/src/lib/weeklyTargetSnapshot.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-1 bis AC-8
- AC-10 bis AC-12
- AC-17

**Dependencies:** None.

**Expected Handoff:**
- additive Shared-Contracts einschließlich Activity-Status;
- dokumentierte 19/20-Uhr-, fehlend- und invalid-Boundary-Tests;
- gemeinsam genutzter historischer Target-Resolver;
- Context-Builder für drei historische Tage mit Zielquelle,
  Activity-Snapshot, `hasMealItem` und `0`-kcal-Semantik;
- getestete Repository-Fehler- und Legacy-Semantik;
- klare Übergabe der Felder, die Hash, Intent und Prompt verwenden.

### WP2 - Intent, fokussierte v10-Prompts, Structured Outputs und Cache

**Agent:** Backend  
**Goal:** Deterministisches Intent-Routing, fachlich vollständige v10-
Promptmodule, Strict Structured Outputs, semantische Validierung, server-owned
Prompt-Snapshot und vollständige Cache-Invalidierung umsetzen.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

**Required Repository Context:**
- `backend/src/lib/openai.ts`
- `backend/src/lib/prompts/dailyInsightV9.ts`
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/lib/progressIntelligence.ts`
- `backend/src/lib/openai.weekly.test.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/vitest.eval.config.mts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-1 bis AC-16
- AC-18

**Dependencies:** WP1 Handoff.

**Expected Handoff:**
- deterministische Intent-Matrix und Unit-Tests;
- fokussierte v10-Promptmodule mit deutscher Activity-/Nutrition-/Weight-
  Sprache;
- Strict-Schema-/Validation-API und Provider-Failure-Vertrag;
- exakter System-/User-Prompt-Snapshot;
- vollständiger Input-Hash inklusive Intent, Status-Bucket und Version;
- harte v9-zu-v10-Invalidierung, Erhalt der Daily-Quota-Semantik und kein
  Übertragen eines alten `feedbackScore` auf eine neue Instanz.

### WP3 - Feedback-Dokument, Repository und Backend-Route

**Agent:** Backend  
**Goal:** Authentifizierten Feedback-POST mit exakt gebundener Insight-Instanz,
Pflichtkommentar, mehreren Dokumenten, atomarer Idempotenz und vollständigem
server-owned Snapshot umsetzen.

**Status:** Baseline-Workpackage für die bereits geplante Feedback-Erfassung;
durch die Korrekturrunde nicht erneut zu planen. Die spätere manuelle
DB-Bereinigung ist ein operativer Vorgang außerhalb dieses Features. Die
Feedback-Dokumente sind nach der Persistierung durch bestehende autorisierte
administrative/operative Zugänge direkt im `aiInsights`-Container lesbar; eine
neue Rolle, Admin-UI oder Read-/Cleanup-Route wird nicht eingeführt.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

**Required Repository Context:**
- `shared/types/insight.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/http.ts`
- `backend/src/index.ts`
- `backend/src/lib/cosmos.ts`
- `infra/modules/cosmos.bicep`

**Required Skills:**
- `cosmos-data-model-and-migration`
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-16 bis AC-24
- AC-27

**Dependencies:** WP2 Handoff.

**Expected Handoff:**
- `dailyInsightFeedback.ts` und Import in `backend/src/index.ts`;
- Shared Feedback-Document und Request-/Response-Vertrag;
- In-Memory- und Cosmos-Repository mit Discriminator-Filter,
  Create-if-absent und Conditional-Marker-Update;
- Auth-, Trim-, Boundary-, Snapshot-, User-Isolation- und Idempotenztests;
- Provenienz-Matrix-Tests für Kommentar, Response, beide Prompt-Texte,
  Prompt-/Intelligence-Version, Intent, Context, Hash, Modell, Token-Nutzung,
  Insight-ID/-Datum/-Zeitstempel und serverseitiges `submittedAt`;
- exakte `200`/`201`/`400`/`401`/`404`/`409`-Verträge;
- Nachweis, dass Feedback kein Quota-Tracking ausführt und weder `ttl` noch
  `expiresAt` enthält, keinen Snapshot an Mobile zurückgibt und keinen neuen
  administrativen Lese- oder Cleanup-Pfad voraussetzt.

### WP4 - Daily-Insight-Live-Evals

**Agent:** Backend  
**Goal:** Die fertigen v10-Prompts gegen F1-F9, Activity-Unsicherheit,
Budget-/Protein-Konsistenz, natürliche deutsche Sprache und verbotene
Formulierungen evaluieren.

**Required Knowledge Base:**
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
- `backend/src/lib/prompts/dailyInsightV9.ts`
- `backend/src/lib/openai.ts`
- `backend/vitest.eval.config.mts`
- `backend/scripts/run-eval.mjs`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-1 bis AC-12

**Dependencies:** WP2 Handoff.

**Expected Handoff:**
- Fixtures für morgenleeren Tag, historische Ziele, Gewichtssignale,
  `planned`, `likely_completed` und `unknown` Activity, Budget-Lock,
  Protein-Gap, intensive Ausdaueraktivität und Widersprüche;
- explizite Ausführung über `npm run test:eval`;
- je Szenario `VERIFIED` oder bei fehlenden Azure-Credentials `UNVERIFIED`;
- dokumentierte DV-1-, DV-2- und DV-3-Gates für die Alpha-Freigabe.

## 13. Frontend Work Package

### WP5 - Home-Screen-Feedback-UI

**Agent:** Frontend  
**Goal:** Kebab-Menü, Pflichtkommentar-Sheet, lokales Daily-Datum, typed
Feedback-POST, stabile Submission-ID, Erfolg, mehrere Kommentare und
verständliche Retry-/Instanzfehler in die bestehende `InsightCard`
integrieren.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/01-product-philosophy.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/InsightCard.tsx`
- `mobile/src/services/insightService.ts`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/shared/api/client.ts`
- `mobile/src/shared/date/localDate.ts`
- `mobile/src/shared/components/Icon.tsx`
- `mobile/src/shared/components/Snackbar.tsx`
- `mobile/src/app/App.tsx`
- `mobile/package.json`

**Required Skills:** None.

**Relevant Acceptance Criteria:**
- AC-10
- AC-13
- AC-18 bis AC-26

**Dependencies:** WP3 Handoff.

**Expected Handoff:**
- Kebab-Menü nur für `fresh`/`cached` und verfügbare Snapshot-Provenienz;
- Bottom Sheet mit Pflichtfeld, getrimmter 1-500-Zeichen-Grenze,
  Submit-Lock und deutschen Strings;
- Daily-GET mit lokalem date-only-Datum, `localHour` und validiertem
  `timezoneOffsetMinutes`, ohne Änderung an anderen Datumspfaden;
- Feedback-POST mit unveränderten `date`-/`insightGeneratedAt`-Werten;
- `expo-crypto`-ID bleibt bei unverändertem Retry stabil, neue IDs erlauben
  weitere Kommentare;
- `created: false` wird als Erfolg behandelt;
- Success-Snackbar, `404`/`409`-Meldungen, Kommentarerhalt und
  `feedback_snapshot_unavailable`-Zustand;
- keine neue native Abhängigkeit, kein Activity-Entry- oder Health-Connect-
  Change.

### WP6 - Knowledge-Base-Handoff nach Implementierung

**Agent:** Backend  
**Goal:** AI-, API-, Domain- und Persistence-Dokumentation auf den tatsächlich
implementierten Daily-/Feedback-Vertrag aktualisieren. Dabei wird die
aufgelöste PO-6A-Grenze dokumentiert: bestehende autorisierte
administrative/operative Direktlese-Zugänge genügen; weder eine neue Rolle
noch eine Lese-/Cleanup-API werden als Featurebestandteil eingeführt oder
dokumentiert.

**Required Knowledge Base:**
- `docs/kb/README.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**
- Handoffs aus WP1 bis WP5;
- `shared/types/insight.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/functions/dailyInsightFeedback.ts`
- `mobile/src/modules/home/InsightCard.tsx`
- `docs/kb/README.md`
- dieser Plan

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-12 bis AC-24
- AC-27

**Dependencies:** WP5 Handoff; WP3 muss den finalen API-/Persistenzvertrag,
die Provenienz-Matrix und die Sicherheitsgrenze für direkten autorisierten
DB-Zugriff übergeben. Der konkrete spätere manuelle Bereinigungsprozess bleibt
operatives Follow-up außerhalb dieses Features und ist keine WP6-Abhängigkeit.

**Expected Handoff:**
- aktualisierte AI-, API-, Domain- und gegebenenfalls KB-Index-Dokumente;
- final dokumentierte v10-, Intent-, Activity-Status-, Snapshot- und
  No-TTL-Feedback-Semantik;
- explizite Traceability-Matrix und Sicherheitsgrenze: bestehende autorisierte
  administrative/operative Direktlese-Zugänge, aber keine neue Rolle, Admin-UI,
  Read- oder Cleanup-API;
- expliziter Abweichungsbericht, falls Implementierung und Knowledge Base
  weiterhin divergieren.

## 14. QA Work Package

### WP7 - Dedicated QA Review

**Agent:** QA  
**Goal:** Vollständige Abnahme der Refaktorierung gegen alle Acceptance
Criteria einschließlich F1-F9, AI-Vertrag, Activity-Boundaries, Auth, Quota,
Snapshot-Provenienz, exakter Instanzbindung, Idempotenz, No-TTL-Feedback,
Mobile-Zuständen, bestehendem autorisiertem Direktzugriff und Weekly-
Regression. QA prüft dabei, dass die Traceability vollständig ist, ohne einen
neuen Rollen-, Admin-UI- oder Read-/Cleanup-Vertrag zu verlangen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- Handoffs aus WP1 bis WP6;
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsightFeedback.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/InsightCard.tsx`
- `mobile/src/shared/components/Snackbar.tsx`
- `docs/qa/findings.md`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-1 bis AC-27

**Dependencies:** WP6 Handoff; WP6 muss seine Dokumentationsänderungen,
Traceability-Matrix und die aufgelöste Sicherheitsgrenze übergeben. Die
spätere manuelle DB-Bereinigung ist ein operatives Follow-up außerhalb dieses
Features und wird nicht als fehlender Implementierungsbestandteil bewertet.

**Expected Handoff:**
- QA-Report im Format `fittrack-qa-v1` unter
  `docs/qa/reports/PLAN_US_Home-Screen-Insights_Feedback_Review.md`;
- Kriterienmatrix für AC-1 bis AC-27 mit Ergebnis und Evidence;
- Testtabelle mit jedem relevanten Befehl, Exit-Code und Ergebnis;
- Cosmos-/Daily-TTL-/Feedback-No-TTL-Nachweis, User-Isolation,
  Idempotenz- und Instanzwechsel-Nachweis;
- Nachweis, dass jeder Feedback-Snapshot den exakten Kommentar, die Response,
  beide Prompt-Texte, Prompt-Version, Intent, InputContext, InputHash,
  Modell/Deployment, Intelligence-Version, Tokens, Insight-ID/-Datum/-Zeit,
  und serverseitiges `submittedAt` enthält und dass kein Snapshot an Mobile
  zurückgesendet wird;
- Nachweis, dass kein neuer Rollen-, Admin-UI-, Read- oder Cleanup-Endpoint
  eingeführt wurde und der dokumentierte Zugriff ausschließlich über bereits
  autorisierte administrative/operative Direktlese-Zugänge erfolgt;
- Eval-Status `VERIFIED`/`UNVERIFIED` und getrennte manuelle Prüfgrenzen;
- Findings mit strukturierten Feldern oder expliziter Aussage, dass keine
  actionable findings vorliegen;
- klare DV- und Alpha-Blocker sowie Rückmeldung zu operativem Follow-up ohne
  technische Interpretation.

## 15. Shared Package Changes

Der Backend-Agent erweitert `shared/types/insight.ts` additiv um:

- `ActivityCompletionStatus` und `ActivityStatusSource`;
- den erweiterten `InsightNutritionDay`-Vertrag mit nullable Werten,
  `hasMealItem`, Zielquelle und historischem Activity-Kontext;
- `activityCompletionStatus`, `activityStatusSource` und gegebenenfalls
  aggregierten Vorwochenkontext in `InsightInputContext`;
- `InsightIntent` und `InsightFeedbackDocument`;
- optionale Provenienz-/Feedback-Vertragsfelder, ohne bestehende Mobile-
  Responses inkompatibel zu machen.

Die Activity-Typen in `shared/types/diary.ts` werden nicht um ein Statusfeld
erweitert. Die lokale Heuristik gehört ausschließlich in den Daily-Insight-
Context. Shared-Änderungen bleiben pure Typen bzw. Pure Resolver ohne I/O.

## 16. Infrastructure and Configuration

**Infrastructure Impact: Dev** bedeutet: Der geänderte Backend-/Mobile-Vertrag
wird zunächst gegen Development validiert. Es ist keine neue
Infrastrukturentscheidung erforderlich.

- Bestehender Container `aiInsights`, Partition Key `/userId`, bleibt
  bestehen.
- Keine Änderung an `infra/modules/cosmos.bicep`, `backend/src/lib/cosmos.ts`,
  Resource Group oder Partition Key.
- Daily-Dokumente behalten ihren bestehenden per-document TTL bis zur
  lokalen/legacy Mitternachtsgrenze; `timezoneOffsetMinutes` darf diese Grenze
  für den Daily-GET bestimmen.
- Feedback-Dokumente setzen kein `ttl` und kein `expiresAt`; der bestehende
  Container-Default `-1` bleibt unverändert und bewirkt für diese Dokumente
  keine automatische Löschung.
- Vor Alpha muss Infrastructure & Release die konfigurierte Azure-OpenAI-
  API-Version für Strict Structured Outputs verifizieren.
- Für die ursprüngliche Feature-Revision gibt es kein Bicep- oder Ressourcen-
  Workpackage, weil weder Container, Ressourcentyp, Environment-Strategie noch
  EAS-Native-Konfiguration geändert wird. Die genehmigte Korrektur ergänzt
  jedoch ein operatives Infrastructure-&-Release-Handoff (CWP-I1): Der
  Backend-Code wird nach QA gegen Dev validiert/deployed, und Infrastructure &
  Release trifft die abschließende Entscheidung `Dev Build Required: NO`.

## 17. Documentation Updates

Nach dem finalen Implementierungsstand aktualisiert WP6 als Backend-Agent:

- `docs/kb/tech/06-ai-integrations.md` - v10, Intent, Structured Outputs,
  Activity-Status und Quota-Verhalten;
- `docs/kb/tech/09-api-reference.md` - Daily-GET-Erweiterung und neuer
  Feedback-POST mit Fehlercodes;
- `docs/kb/domain/02-diary.md` - temporäre `planned`-/
  `likely_completed`-Semantik und Grenzen der lokalen Heuristik;
- `docs/kb/domain/07-ai-features.md` - Context-/Prompt-/Snapshot-Vertrag,
  serverseitige Validierung und spätere Analysegrundlage;
- gegebenenfalls `docs/kb/README.md`, falls der Dokumentindex betroffen ist.

Die Dokumentation darf PO-6A nicht als neu zu implementierende Rolle oder
Anwendungsprozess ausgeben. Sie dokumentiert stattdessen die aufgelöste
Grenze: Bestehende autorisierte administrative/operative Zugänge dürfen
Feedback direkt aus `aiInsights` lesen; es gibt keine neue Rolle, Admin-UI,
Read- oder Cleanup-API. Der No-Automatic-Deletion-Beschluss bleibt bestehen.
Eine konkrete manuelle Bereinigung ist ein operatives Follow-up außerhalb
dieses Features und wird nicht als offene Implementierungsentscheidung
dargestellt.

## 18. Test Strategy

### Backend Unit- und Handler-Tests

- reale Kalenderdaten, lokales Datum und lokale Stunden `0..23`;
- normalisierter `timezoneOffsetMinutes`-Vertrag, lokale Tagesgrenzen,
  lokale nächste Mitternacht und Offset-/Cache-Invalidierung;
- Activity-Grenze `19/20`, `23`, `0`, fehlend, nicht ganzzahlig und außerhalb
  des Bereichs;
- `planned`, `likely_completed`, `unknown` und `null` bei fehlender Activity;
- aktuelle und historische Zielquellen in Snapshot-first-Reihenfolge;
- Special Activity ohne Ziel-Snapshot bleibt `unavailable`;
- vorhandener MealItem mit `0` kcal gegenüber leerem Tag;
- historische DayMeta-/Diary-Reads und Fehler ohne AI-Aufruf;
- Intent-Priorität und Determinismus;
- F1-F9, Budget-Lock, Protein-Lock und CTA-Konsistenz;
- Strict-Schema, required nullable fields, Summary-/Titelgrenzen,
  `finish_reason`, leere und semantisch ungültige Providerantworten;
- vollständiger Input-Hash, Zeit-/Status-Invalidierung, harte
  Prompt-Versionsinvalidierung und kein Score-Transfer auf neue Instanzen;
- Feedback 400/401/404/409/500, Auth-Isolation, Trim, UUID-/Datum-/
  Timestamp-Boundary und kein `trackUsage()`;
- Lookup derselben `submissionId` vor Daily-Read, identischer Retry nach
  Daily-TTL-Ablauf, Submission-Konflikt und mehrere neue IDs;
- Wechsel der angezeigten Insight-Instanz, fehlender Legacy-Prompt-Snapshot,
  Create-Konflikt und Erhalt des Daily-TTL beim Marker-Patch.

### Cosmos Contract Tests

Mit der vorhandenen Contract-Konfiguration und dem Emulator:

- Feedback bleibt unter `/userId` nutzerisoliert;
- `_docType` trennt Daily, Weekly und Feedback;
- `get()`, `getWeekly()` und `listRecent()` liefern keine fremden
  Dokumenttypen;
- Feedback hat weder `ttl` noch `expiresAt` und wird nicht automatisch
  gelöscht;
- Daily-Score-Patch verlängert den bestehenden Daily-Ablauf nicht;
- zwei verschiedene `submissionId`s erzeugen zwei vollständige Snapshots
  derselben Insight-Instanz;
- identische Retries erzeugen kein zweites Dokument;
- ein anderer normalisierter Body mit gleicher ID wird abgewiesen;
- alte Daily-/Weekly-Dokumente bleiben lesbar.

### Live Prompt Evals

Daily-Evals laufen ausschließlich über `npm run test:eval`, nicht im normalen
CI-Lauf. Fehlende Azure-Credentials werden als `UNVERIFIED` ausgewiesen. Evals
prüfen deutsche Sprache, F1-F9, Activity-Unsicherheit, Ziel-/Budgetkonsistenz
und Forbidden Phrases; sie ersetzen keine deterministischen Unit-Tests und
keine Domain-Validation.

### Mobile-Validierung

Mobile-Typecheck sowie Service-/Request-Tests decken lokales Datum, `localHour`
und Offset ab. Ein ausgeführter `InsightCard.test.tsx`-Component-Test deckt
Kebab-Sichtbarkeit, Sheet-Öffnung, Snapshot-Identität, `submissionId`, Trim,
Submit-Lock, `created: false`, mehrere Kommentare, Success-Snackbar,
Fehlerzustände und Kommentarerhalt ab. Manuelle Dev-/Preview-Prüfung deckt
Skeleton, `fresh`/`cached`, Quota/Unavailable, Keyboard, Bottom Sheet, 404/409,
Accessibility und keine Änderung an Activity-Entry-/Health-Connect-Flows ab.

## 19. Acceptance Criteria

1. **F1 Gewicht:** Ein vorheriger Ausreißer wird nicht als kurzfristige
   Vergleichsbasis verwendet; `trend7d` bleibt autoritativ und die Bewertung
   bezieht das Nutzerziel ein.
2. **F2 Aktualität:** `daysSinceLastMeasurement = 14` bleibt aktuell, `15` ist
   stale; stale Werte werden weder als aktuelles Gewicht noch als aktueller
   Trend dargestellt.
3. **F3 aktuelles Ziel:** Das aktuelle effektive Kalorienziel ist Basisziel plus
   gültiger Activity-Bonus; `remainingCalories` verwendet diesen Wert und kann
   negativ sein.
4. **F3 historische Ziele:** Für alle drei Vortage gilt die dokumentierte
   Snapshot-first-Reihenfolge. Profile-Fallbacks tragen die Quelle
   `profile_fallback` und werden nicht als gespeicherte historische Fakten
   formuliert.
5. **0-kcal-Daten:** Ein vorhandener MealItem mit `0` kcal bleibt gültige
   Ernährung; ein Tag ohne MealItem bleibt fehlend und wird nicht als
   `0`-kcal-Tag erfunden.
6. **F4 Statusgrenzen:** `localHour 0..19` ergibt bei vorhandener Activity
   `planned`, `20..23` ergibt `likely_completed`, `20` ist die inklusive
   Grenze, und fehlende/ungültige Stunden ergeben `unknown`.
7. **F4 Sprache:** `planned` und `unknown` führen zu keiner abgeschlossenen
   Activity-Aussage; `likely_completed` erlaubt nur probabilistische oder
   konditionale Sprache. Kein Prompt behauptet einen bestätigten
   `completed`-Status.
8. **F5 Activity:** Typ, Dauer und vorhandene Intensitätssignale werden
   berücksichtigt; lange/intensive Ausdaueraktivitäten erhalten
   situationsgerechte qualitative Fueling-/Regenerationssprache. Neue exakte
   Ernährungsschwellen erscheinen nur nach DV-2.
9. **F6 Konsistenz:** Bei negativem Kalorienbudget entsteht keine weitere
   Essensempfehlung; ein Protein-Gap wird nicht gleichzeitig als „fast optimal“
   und als Pflicht zum Nachessen bewertet.
10. **F7 Zeitfokus:** Leerer früher Morgen bewertet den heutigen Tag nicht als
    Defizit, verwendet belastbare gestern-/Historienwerte und kann am Montag
    einen tatsächlich geladenen Vorwochenaggregat nutzen. Spätere Tagesstufen
    werden deterministisch aus lokaler Zeit und Datenlage geroutet.
11. **F8/F9 Sprache:** Der aktive Prompt vermeidet bekannte technische und
    abstrakte Forbidden Phrases und bleibt konkret, verständlich, respektvoll
    und motivierend, ohne Diagnose- oder Drucksprache.
12. **Intent:** Gleicher validierter Context liefert denselben Intent;
    vorhandene Activity bleibt auch bei `unknown` im Activity-Routing.
13. **Structured Output:** Der Daily Insight nutzt `json_schema`, `strict:
    true`, required Properties, nullable optionale Felder und
    `additionalProperties: false` auf jeder Objektstufe.
14. **Provider Failure:** Leere, parse-/schemawidrige, semantisch ungültige,
    gefilterte oder mit `finish_reason: 'length'` abgeschnittene Antworten
    werden `unavailable`, nicht persistiert und nicht quota-gezählt.
15. **Quota:** Die Daily-Quota wird vor dem AI-Aufruf geprüft und nur nach
    erfolgreicher validierter Insight-Erzeugung getrackt. Der bestehende öffentliche
    `200`-Vertrag für `quota_exceeded` bleibt erhalten.
16. **Cache:** Der Hash deckt alle ausgaberelevanten Inputs einschließlich
    Status-Bucket, lokaler Zeitstufe, Intent und aktiver Prompt-Version ab;
    v10 liefert keinen alten v9-Text. Ein negativer Marker wird nicht auf eine
    spätere Insight-Instanz übertragen.
17. **Daily Snapshot:** Neue Daily-Dokumente speichern Discriminator,
    InputContext, Response, Intent, Prompt-Version, tatsächlichen System- und
    User-Prompt, Modell, Input-Hash, Tokens und Intelligence-Version.
18. **Legacy:** Legacy-Daily-/Weekly-Dokumente ohne neue Felder bleiben lesbar;
    fremde `_docType`-Dokumente werden nicht als Daily oder Weekly interpretiert.
    Legacy-Daily ohne Snapshot liefert beim neuen Feedback
    `feedback_snapshot_unavailable`.
19. **Feedback Auth/Body:** Feedback verlangt JWT, reales Datum, exakten
    kanonischen `insightGeneratedAt`, UUID-`submissionId` und serverseitig
    getrimmten Pflichtkommentar mit 1-500 Zeichen. Client-User-, Prompt-,
    Context- und Response-Felder werden nicht als Provenienz akzeptiert.
20. **Feedback-Instanz:** Bei neuer ID führt fehlendes Daily zu `404
    insight_not_found`, ein anderer gespeicherter Zeitstempel zu `409
    insight_generation_changed`; es gibt kein stilles Umhängen auf eine
    spätere Instanz.
21. **Feedback-Idempotenz:** Der Server sucht eine bestehende ID vor dem
    Daily-Read. Identischer Retry ergibt auch nach Daily-TTL-Ablauf `200
    created: false`; ein anderer Body mit gleicher ID ergibt `409
    feedback_submission_conflict`.
22. **Mehrere Feedbacks:** Jede neue `submissionId` erzeugt ein eigenes
    `insightFeedback`-Dokument für dieselbe `date`/`insightGeneratedAt`, auch
    bei gleichem Kommentar. Positive Feedbacks werden nicht erzeugt.
23. **Feedback-Snapshot und Traceability:** Jede neue ID kopiert serverseitig
    den exakt getrimmten `userComment`, die angezeigte/generierte `response`,
    den exakt serialisierten User-Prompt, den exakt ausgewählten System-Prompt,
    Prompt-Version, Intent, vollständigen serverseitigen `inputContext`,
    `inputHash`, Modell-/Deployment-Kennung, `intelligenceVersion`,
    Provider-Token-Nutzung, `insightId`, date-only-`date`,
    `insightGeneratedAt` und serverseitiges `submittedAt`. Der Client kann
    keinen Snapshot oder Provenienz-Wert einschleusen. Die Daten ermöglichen
    den Vergleich von Nutzerkritik, Antwort, Prompt und Eingaben, aber keine
    automatische Entscheidung, ob die Ursache Prompt-Logik, Eingabedaten oder
    Domänenregeln ist.
24. **Feedback-Lebensdauer und Zugriff:** Feedback enthält kein `ttl` und kein
    `expiresAt`, wird nicht automatisch gelöscht und bleibt bis zur späteren
    manuellen DB-Bereinigung. Bereits autorisierte administrative/operative
    Zugänge können die Dokumente direkt im bestehenden `aiInsights`-Container
    lesen. Dieses Feature führt keine neue Rolle, kein neues
    Berechtigungsmodell, keine Admin-UI und keinen Read-/Cleanup-Endpoint ein;
    die Persistenz gewährt keinem Nutzer oder beliebigen Admin implizit
    Zugriff.
25. **Mobile Trigger:** Nur ein verfügbarer `fresh`-/`cached`-Insight zeigt das
    Kebab-Menü. Skeleton, `quota_exceeded`, `unavailable` und explizit nicht
    feedbackfähige Legacy-Insights zeigen kein Sheet.
26. **Mobile Feedback:** Kebab-Sheet, Pflichtfeld, Trim, Submit-Lock, stabile
    Retry-ID, neue IDs für weitere Kommentare, Erfolgssnackbar, `created: false`,
    404/409-UX und Kommentarerhalt funktionieren ohne neue native Abhängigkeit
    und ohne historische Feedback-Ansicht.
27. **Regression und Handoff:** Weekly Insight, Hint Engine,
    Activity-Entry/Health-Connect, positive Bewertung und lokale Datumsflüsse
    außerhalb des Daily-Aufrufs bleiben unverändert; Route-Registrierung,
    KB-Handoff, QA-Report und Dev-Release-Handoff sind abgeschlossen.

## 20. Domain Gates, Risks and Edge Cases

### Domain-Validation-Gates

| ID | Status | Gate |
|---|---|---|
| DV-1 | Required before Alpha | Fachliche Prüfung der temporären 20:00-Heuristik, der Bezeichnungen `planned`/`likely_completed` und der probabilistischen Activity-Sprache. Die technische Umsetzung darf vor der Prüfung erfolgen. |
| DV-2 | Required before Alpha | Fachliche Prüfung der qualitativen Fueling-/Regenerationssprache für lange/intensive Hiking-/Cycling-Aktivitäten; keine neuen exakten Ernährungsschwellen ohne Freigabe. |
| DV-3 | Required before Alpha | Fachliche Prüfung von Gewichts-, Kalorien-, Motivations- und Zielformulierungen gegen F1/F2/F6/F8/F9. |

### Risiken und Gegenmaßnahmen

- **Gerätezeit ist keine Ground Truth:** `likely_completed` wird nie als
  `completed` serialisiert; `unknown` bleibt der Fallback.
- **Grenze 19/20:** Boundary-Tests müssen exakt `20` als ersten
  `likely_completed`-Wert prüfen. Invalides Input darf nicht geklemmt werden.
- **Historische Activity:** Vergangene Activity-Snapshots dürfen für das
  historische Budget verwendet werden, aber nicht durch die aktuelle Uhrzeit
  rückwirkend als abgeschlossen behauptet werden.
- **Cache-Zeitfenster:** Ein Hashwechsel kann innerhalb des bestehenden
  Regenerationsintervalls noch den konservativen Cache liefern. Dieser darf
  keine abgeschlossene Tatsache ausgeben; die nächste zulässige
  Neugenerierung verwendet den neuen Status-Bucket.
- **Regeneration während Feedback:** Date-only-Datum plus exakter Timestamp
  verhindert, dass ein Kommentar auf die neue Instanz umgebunden wird.
- **TTL-Race:** Feedback wird vor dem Daily-Read per Submission-ID erkannt; ein
  identischer Retry bleibt nach Daily-Ablauf möglich.
- **Cosmos-Race:** Create-if-absent und erneuter Vergleich verhindern
  Überschreiben bei gleicher ID.
- **Datenmenge und sensible Snapshots:** Vollständige Snapshots können
  Gesundheits- und Ernährungsdaten enthalten. Sie werden nicht geloggt und
  nicht an Mobile zurückgesendet. Ohne automatische Löschung bleibt die
  Datenmenge bis zur manuellen Bereinigung bestehen. Die direkte Lesbarkeit
  setzt bestehende administrative/operative Autorisierung voraus; ein neuer
  Anwendungspfad oder ein implizites Admin-Leserecht entsteht nicht. Die
  Bereinigung selbst bleibt operatives Follow-up außerhalb dieses Features.
- **Unklare Ursachen der Kritik:** Ein vollständiger Prompt-/Input-Snapshot
  ermöglicht die spätere Gegenüberstellung, klassifiziert aber nicht
  automatisch Prompt-Logik, Eingabedaten oder Domänenregeln. Die Analyse muss
  diese drei möglichen Ursachen getrennt bewerten.
- **Legacy-Provenienz:** Alte Daily-Dokumente bleiben lesbar, können aber kein
  Feedback ohne server-owned Prompt-Snapshot aufnehmen.
- **Prompt-Komplexität:** Module behalten den vollständigen F1-F9-Regelumfang,
  aber jede Intent-Auswahl lädt nur den fokussierten Regelteil.
- **Provider-Kompatibilität:** Eine zu alte Azure-OpenAI-API-Version ist vor
  Alpha ein Release-Blocker für Strict Structured Outputs.
- **Shared-Resolver-Regression:** Weekly- und Daily-Tests müssen nach der
  Extraktion gemeinsam ausgeführt werden.

## 21. Original Feature Execution Order (Baseline)

Die Orchestrierung ist strikt sequenziell. Kein nachfolgender Agent beginnt,
bevor der erwartete Handoff des vorherigen Pakets geprüft wurde.

1. **WP1:** Shared Contracts, Activity-Statusgrenzen, historische
   Zielauflösung und Context-Builder.
2. **WP2:** Intent, v10-Promptmodule, Strict Schema, semantische Validierung,
   Prompt-Snapshot und Cache-Vertrag.
3. **WP4:** Daily-Live-Evals auf dem fertigen AI-Vertrag; DV-Ergebnisse als
   `VERIFIED` oder `UNVERIFIED` dokumentieren.
4. **WP3:** Feedback-Dokument, Repository, Route, Idempotenz und server-owned
   Snapshot.
5. **WP5:** Home-Kebab-Menü, Pflichtkommentar-Sheet und typed Feedback-Service
   auf dem Backend-Handoff.
6. **WP6:** Knowledge-Base-Handoff für den tatsächlich implementierten
  Vertrag einschließlich der aufgelösten PO-6A-Zugriffsgrenze und der
  Traceability-Matrix.
7. **WP7:** Dedicated QA Review gegen AC-1 bis AC-27 und Erstellung des Reports
   unter dem deklarierten Pfad.
8. Nach einem QA-Ergebnis ohne offene Blocker führt die zuständige
   Infrastructure-&-Release-Rolle die bestehenden Dev-/Alpha-Operationen aus.
   Vor Alpha müssen DV-1 bis DV-3 und die Strict-Output-Konfigurationsprüfung
  erfüllt sein; direkte autorisierte DB-Lektüre ist bereits als
  Zugriffsvoraussetzung dokumentiert. Eine spätere manuelle Bereinigung und
  ihre operative Auditierung bleiben außerhalb dieses Plans.

Diese Reihenfolge bleibt als historische Baseline des ursprünglichen Feature-
Plans erhalten. Sie ist für die Korrekturrunde nicht maßgeblich; die
verbindliche Reihenfolge für F-04, F-05, F-06 und die stale-weight-Regression
steht in Abschnitt 23.

## 22. Focused Correction Addendum (authoritative)

### 22.1 Correction boundary and approval

Dieses Addendum ist für die Korrekturrunde die maßgebliche Ergänzung zum
Baseline-Plan. Es supersediert ausschließlich Aussagen, nach denen
`timezoneOffsetMinutes` bereits serverseitig wirksam wäre, die Mobile-
Komponentenabdeckung bereits durch Service-Tests erbracht wäre, der Plan einen
veralteten Freigabestatus trüge oder der stale-weight-Laufzeitfehler als erledigt gelten
könnte.

Nicht neu geplant werden die fachlich abgeschlossene Daily-/Feedback-
Refaktorierung, der bestehende API- und Cosmos-Vertrag außerhalb des
Timezone-/TTL-Punkts, die ursprünglichen WPs 1-7 und AC-1 bis AC-27. QA muss
weiterhin alle AC-1 bis AC-27 sowie die neuen AC-28 bis AC-43 prüfen.

F-06 ist eine Plan- und Traceability-Korrektur. Die Aktualisierung dieses
Dokuments ist dafür die einzige aktuelle Artefaktänderung. Es werden weder
`docs/qa/findings.md` noch der bestehende QA-Report in dieser Planungsrunde
geändert. Nach der späteren Korrekturvalidierung liefert QA die Evidenz, und
der Orchestrator reconciliiert die Findings gemäß seinem Registerprozess.

Es gibt für F-04 keine offene Product-Owner-Entscheidung. Die lokale-minus-
UTC-Bedeutung, der gültige Bereich, die sichere Behandlung ungültiger Werte
und die lokale Mitternachtsgrenze sind Bestandteil dieses freigegebenen
technischen Korrekturvertrags.

### 22.2 Authoritative correction facts

| Finding / Regression | Verifizierter aktueller Zustand | Korrekturgrenze |
|---|---|---|
| F-04 / FT-QA-2026-012 | Mobile sendet `timezoneOffsetMinutes`, der Daily-Handler verwendet ihn nicht. Current-Day-Ermittlung und Daily-TTL folgen dadurch weiterhin der Backend-UTC-Grenze. Die API-/KB-Dokumentation benennt diese Divergenz. | Backend normalisiert und verwendet den Offset für validierte lokale Tages- und TTL-Semantik; Mobile bestätigt nur den bestehenden Request-Vertrag; API-/AI-/Domain-Dokumentation wird danach korrigiert. |
| F-05 / FT-QA-2026-013 | `InsightCard.tsx` enthält die Feedback-State-Machine, aber es gibt keine `InsightCard.test.tsx`. `mobile/vitest.config.mts` nimmt derzeit nur `.test.ts` auf. | Ein echter Component-Test über den Render-/Interaktionspfad wird hinzugefügt und ausgeführt. Kein Service-only- und kein ausschließlich manueller Ersatz. |
| F-06 / FT-QA-2026-014 | Der Planheader und das Ende des Dokuments trugen noch einen veralteten Freigabestatus, obwohl die Korrektur beauftragt wurde. | Header, Approval-Traceability, Baseline-Hinweis und finaler Korrekturhandoff dieses Dokuments sind aktualisiert. Keine Feature-Replanung. |
| Stale-weight runtime regression / FT-QA-2026-015 | `validateWeightSemantics()` weist bestimmte stale-as-current-Aussagen korrekt zurück, aber der vollständige Provider-/Generatorpfad war nicht deterministisch mit stale Context getestet. Der neue Laufzeitlog zeigt erneut stale-as-current-Providerausgabe; ein einmaliger Live-Eval kann diese Regression nicht ausreichend absichern. | Der Safety-Validator bleibt autoritativ. Prompt-/Intent-/Marker-Ausrichtung wird untersucht und mit credential-freien Generator- und Handler-Regressionstests abgesichert. Die alte `Closed`-Markierung wird nach der Prüfung mit der neuen Evidenz reconciliiert. |

### 22.3 F-04: validated timezone, current day and local-midnight TTL

#### Request and normalization contract

`timezoneOffsetMinutes` ist ein vom Mobile-Client gesendeter Offset in der
Richtung `local - UTC`. Der Backend-Handler liest den Querywert einmal und
führt eine zentrale Normalisierung durch:

| Eingang | Normalisierter Wert | Verbindliches Verhalten |
|---|---:|---|
| Ganzzahliger Wert in `[-840, 840]` | derselbe Integer | Lokales Datum, Current-Day-Status und lokale nächste Mitternacht werden aus diesem Offset berechnet. |
| Fehlender Wert | `null` | Der GET bleibt für Legacy-Clients tolerant. Es wird keine lokale Abschlussaussage aus `localHour` abgeleitet; für den Ablauf gilt der bestehende UTC-Fallback. |
| Nicht-ganzzahliger, nicht numerischer oder außerhalb liegender Wert | `null` | Kein Clamping und kein `likely_completed` aus dem ungültigen Offset. Der GET bleibt tolerant, verwendet den sicheren Legacy-UTC-Fallback und behandelt den lokalen Activity-Status als `unknown`/nicht verfügbar. |

Der Offset wird nicht als Authentifizierungs-, Berechtigungs- oder
Benutzeridentitätsinformation verwendet. Ein fehlender oder ungültiger Offset
ist kein alleiniger HTTP-400-Grund, damit der bestehende Legacy-GET-Vertrag
erhalten bleibt. `localHour` bleibt separat auf einen ganzzahligen Wert `0..23`
validiert; ein valider `localHour` darf ohne valides Offset aber keine lokale
Current-Day-Aussage erzwingen.

#### Current-Day calculation

Bei einem validierten Offset wird das Backend-`now` für die lokale
date-only-Berechnung um `offsetMinutes * 60_000` Millisekunden verschoben:

```text
currentLocalDate = dateOnly(backendNow + offsetMinutes * 60_000)
isCurrentDay = requestedDate === currentLocalDate
```

`planned`/`likely_completed` darf nur entstehen, wenn `isCurrentDay` wahr ist,
eine `specialActivity` vorhanden ist und `localHour` gültig ist. Die
einschließenden Grenzen bleiben `0..19 -> planned` und `20..23 ->
likely_completed`. Ein nicht aktuelles Datum, fehlender/ungültiger Offset,
fehlender/ungültiger `localHour` oder fehlende Activity führt zu `unknown` bzw.
`null` entsprechend dem bestehenden Shared-Vertrag. Die UTC-Fallback-Logik
für alte Clients dient damit nur der kompatiblen Daily-Anforderung und erzeugt
keine unbelegte lokale Abschlussaussage.

Die Implementierung nutzt den Backend-Zeitpunkt als injizierbare Testzeit.
Tests müssen mindestens UTC-Mitternacht, lokale Mitternacht nahe einer
UTC-Grenze, `-840`, `0`, `840`, ein vergangenes Datum und ein zukünftiges
Datum abdecken.

#### Local-midnight expiration

Bei validiertem Offset wird die nächste lokale Mitternacht als UTC-Zeitpunkt
berechnet. Für lokale date-only-Komponenten `nextLocalDate 00:00:00` gilt:

```text
nextLocalMidnightUtc = nextLocalDateAtMidnight - offsetMinutes * 60_000
expiresAt = nextLocalMidnightUtc.toISOString()
ttl = max(1, ceil((nextLocalMidnightUtc - backendNow) / 1000))
```

`expiresAt` und `ttl` müssen dieselbe Grenze beschreiben; ein positiver,
mindestens ein Sekunde langer TTL-Wert darf nicht durch Rundung vor der Grenze
ablaufen. Falls `backendNow` bereits an der Grenze liegt, wird die nächste
lokale Mitternacht verwendet. Bei fehlendem/ungültigem Offset bleiben die
bisherige UTC-Mitternachtsgrenze und der sichere UTC-TTL-Fallback erhalten.
Feedback-Dokumente bleiben unverändert ohne `ttl` und `expiresAt`.

Die Pure-Helper sollen die vorhandene Repository-Funktion
`computeTtlUntilMidnight()` ersetzen oder dort zentral verwendet werden; es
gibt keine zweite TTL-Berechnung im Handler. Geeignete Helper sind eine
Normalisierung, offset-adjustierte date-only-Berechnung, Current-Day-Prüfung,
nächste lokale Mitternacht und TTL-Berechnung. Unit-Tests prüfen die Werte und
nicht nur, dass ein Feld vorhanden ist.

#### Cache and persistence boundary

Der Input-Hash enthält den normalisierten Offset und/oder eine äquivalente,
ausgaberelevante lokale Tagesgrenze. Eine Änderung des Offsets darf bei
gleichem `date` keinen Cache ausliefern, dessen Status, lokale Tagesgrenze oder
`expiresAt` für den vorherigen Offset berechnet wurde. Der Hash darf nicht den
rohen, unvalidierten Querystring übernehmen. Der bestehende `aiInsights`-
Container, `_docType`, Partition Key `/userId` und die Feedback-No-TTL-
Semantik bleiben unverändert.

#### Documentation handoff

Nach der Implementierung müssen mindestens folgende Dokumente die Divergenz
nicht mehr behaupten:

- `docs/kb/tech/09-api-reference.md`: Queryvertrag, Offsetrichtung,
  Wertebereich, Legacy-Fallback, Current-Day- und TTL-Semantik;
- `docs/kb/tech/06-ai-integrations.md`: serverseitige Kontext- und Cache-
  Auswirkungen sowie Fehler-/Quota-Vertrag;
- `docs/kb/domain/07-ai-features.md` und gegebenenfalls
  `docs/kb/domain/02-diary.md`: lokale Activity-Statusgrenze und die Grenze
  zwischen Client-Uhrzeit und serverseitiger Validierung.

Diese Dokumente werden jetzt nicht geändert. Die spätere Aktualisierung ist
Bestandteil von CWP-D1.

### 22.4 Blocking stale-weight correction

Die bestehende Sicherheitsgrenze bleibt unverändert: Bei
`daysSinceLastMeasurement > 14` darf eine Antwort Gewicht oder Gewichtstrend
nicht als aktuell darstellen. Eine Providerantwort mit aktueller
Gewichtssprache wird deterministisch abgewiesen. Die Korrektur darf weder die
Stale-Grenze erhöhen noch Marker-Regexe lockern, nur damit ein Live-Eval
grün wird.

Der Backend-Agent muss die Ursache zwischen den tatsächlich beteiligten
Grenzen unterscheiden und im Handoff festhalten:

1. Welcher `InsightIntent` und welches Promptmodul für den stale Fixture-
   Context tatsächlich gewählt werden;
2. welche Stale-Anweisung im exakten System-/User-Prompt landet;
3. welche Providerformulierung den Validatorfehler aus dem Laufzeitlog
   auslöst;
4. ob die akzeptierten Stale-Marker die beabsichtigte Promptsprache
   vollständig abdecken, ohne aktuelle Stale-Aussagen zu erlauben;
5. ob der Eval bisher nur den Providerlauf, nicht aber den vollständigen
   `generateDailyInsight()`- und Handlervertrag abgesichert hat.

Die deterministische Regression verwendet den vorhandenen Test-Provider-
Injection-Pfad und benötigt keine Azure-Credentials:

- stale Context (`daysSinceLastMeasurement: 15` oder älter) plus aktuelle
  Gewicht-/Trendformulierung -> `validateDailyInsightResponse()` weist ab;
- derselbe stale Context plus explizite Marker wie `veraltet`/`nicht aktuell`
  -> Validierung akzeptiert;
- `generateDailyInsight()` mit gemockter Providerantwort deckt beide Fälle
  über den vollständigen Strict-Output-/Semantic-Validation-Pfad ab;
- der Daily-Handler liefert bei der semantischen Ablehnung HTTP 200 mit
  `status: unavailable`, persistiert kein Daily-Dokument und ruft kein
  `trackUsage()` auf;
- eine akzeptierte stale-markierte Antwort darf normal persistiert und nach
  dem bestehenden Quota-Vertrag getrackt werden.

Die bestehende `stale-weight`-Fixture bleibt ein credential-abhängiger
Provider-/Prompt-Check und ersetzt die Unit-Regression nicht. Nach einer
Prompt-/Semantikänderung muss der Agent begründen, ob v10 als Hardening-
Vertrag gültig bleibt oder ob die Promptversion erhöht und der Daily-Cache
invalidiert werden muss. `npm run test:eval` ist danach vollständig
auszuführen; fehlende Credentials ergeben `UNVERIFIED`, nie einen
erfolgreichen Regression-Nachweis.

### 22.5 F-05: InsightCard component-test contract

Die bestehende `InsightCard`-State-Machine bleibt fachlich erhalten. Die
Korrektur liefert einen echten Test über den React-Render- und
Interaktionspfad in:

```text
mobile/src/modules/home/InsightCard.test.tsx
```

`mobile/vitest.config.mts` muss `.test.tsx` aufnehmen, zum Beispiel über ein
Include-Muster für `src/**/*.test.{ts,tsx}`. Der Test läuft im vorhandenen
Vitest-Setup ohne App-Start, Device oder Azure.

Der Harness muss native Laufzeitabhängigkeiten mocken, unter anderem React
Native-Primitives, `@gorhom/bottom-sheet`, `expo-crypto`, `Icon`, `Snackbar`
falls im Pfad verwendet und `aiApi.submitDailyInsightFeedback`. Für den
Component-Render ist ein JS-only React-Test-Renderer bzw. ein ebenso
begründeter JS-only Test-Seam zulässig. Eine native Runtime-Abhängigkeit,
Config-Plugin-Änderung oder `app.config.js`-Änderung ist verboten. Falls ein
Renderer als Dev-Dependency fehlt, muss seine React-Peer-Kompatibilität vor
der Auswahl geprüft werden; die aktuelle React-Version `19.1.0` darf nicht
blind mit einer inkompatiblen neuesten Renderer-Version kombiniert werden.

Ein reiner Test von `insightService`, `localDate` oder einer extrahierten
Pure-Function erfüllt AC-38 bis AC-41 nicht. Der Test muss den gerenderten
Trigger, das Sheet, Eingabeänderungen, Submit und die sichtbaren Fehler-/
Erfolgszustände aus der `InsightCard` heraus auslösen.

Verbindliche Testmatrix:

- Trigger sichtbar bei `fresh`/`cached` mit Datum und verfügbarer Provenienz;
  verborgen bei Skeleton, `quota_exceeded`, `unavailable`, fehlendem Datum
  und `feedbackAvailable: false`;
- Kebab-Menü öffnet das Feedback-Sheet, das Kommentarfeld trimmt logisch,
  lehnt leer/>500 ab und sperrt Submit während des Requests;
- unveränderter Kommentar nach Netzwerkfehler verwendet dieselbe
  `submissionId` erneut;
- geänderter, getrimmter Kommentar erzeugt eine neue ID;
- Erfolg schließt das Sheet, zeigt die bestehende Success-Snackbar und ruft
  `onFeedbackSuccess` auf; `created: false` ist ebenfalls Erfolg;
- `insight_not_found`, `insight_generation_changed`,
  `feedback_snapshot_unavailable` und `feedback_submission_conflict` zeigen
  den passenden Fehler, behalten den Kommentar und sperren nur den jeweils
  fachlich erforderlichen weiteren Submit-Pfad;
- 404/409-Fehler werden nicht als erfolgreicher Callback behandelt.

### 22.6 F-06: persisted plan status and finding traceability

Die F-06-Korrektur ist mit diesem Plan dokumentiert:

- Status ist `[Correction Approved]` mit der Nutzerfreigabe und ihrer
  Interpretation;
- die ursprüngliche Feature-Baseline und AC-1 bis AC-27 bleiben auffindbar,
  werden aber nicht erneut als neue Implementierungsarbeit eingeplant;
- der finale Abschnitt beschreibt den Korrekturhandoff statt eines weiterhin
  veralteten Freigabestatus;
- der bestehende QA-Report und `docs/qa/findings.md` bleiben in dieser Runde
  unverändert.

Nach erfolgreicher Implementierung und QA müssen die Finding-Einträge
FT-QA-2026-012, FT-QA-2026-013 und FT-QA-2026-014 mit der tatsächlichen
Korrekturevidenz aktualisiert werden. FT-QA-2026-015 darf wegen des neuen
Laufzeitlogs nicht ohne neue Evidenz als erledigt stehen bleiben: Der
Orchestrator muss seinen Status und die Historie mit QA-Evidenz
reconciliieren, gegebenenfalls wieder öffnen und erst nach einem bestandenen
deterministischen Regressionstest schließen.

### 22.7 Correction work packages

#### CWP-B1 - Backend F-04 timezone and TTL correction

**Agent:** Backend  
**Goal:** Den validierten Offsetvertrag, lokale Current-Day-Ermittlung,
lokale Mitternachtsgrenze, sichere Legacy-Fallbacks und Hash-/TTL-Verhalten im
bestehenden Daily-Pfad implementieren.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`

**Required Repository Context:**
- `backend/src/functions/dailyInsight.ts`
- `backend/src/lib/dailyInsightContext.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `mobile/src/services/insightService.ts`
- `mobile/src/shared/date/localDate.ts`
- `shared/types/insight.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-6
- AC-16
- AC-27
- AC-28 bis AC-32

**Dependencies:** Baseline-Daily-Implementierung und die in diesem Addendum
festgelegte F-04-Vertragsentscheidung.

**Expected Handoff:**
- zentrale Offset-Normalisierung ohne Clamping;
- Pure-Helper für lokale Tagesgrenze, Current-Day-Prüfung, nächste lokale
  Mitternacht und TTL;
- Handler-/Repository-Tests für gültige, fehlende, ungültige und extreme
  Offsets sowie UTC-/lokale Mitternachtsgrenzen;
- Hash-Test gegen falsche Cache-Wiederverwendung bei Offsetwechsel;
- Nachweis, dass Cosmos-Container, Partition Key, Discriminator und
  Feedback-No-TTL unverändert bleiben;
- präziser API-/Fallback-Vertrag für CWP-D1.

#### CWP-B2 - Backend stale-weight generator and handler regression

**Agent:** Backend  
**Goal:** Den im Laufzeitlog reproduzierten stale-weight-Fehler über direkte
Validierung, Provider-/Generatorpfad und Daily-Handler deterministisch
absichern und die Ursache beheben, ohne die Sicherheitsgrenze zu lockern.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

**Required Repository Context:**
- `backend/src/lib/dailyInsightValidation.ts`
- `backend/src/lib/dailyInsightValidation.test.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.daily.test.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/lib/prompts/promptWeight.ts`
- `backend/src/lib/prompts/dailyInsightV10.ts`
- `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-2
- AC-14
- AC-15
- AC-33 bis AC-37

**Dependencies:** CWP-B1 Handoff für den finalen Handler-Testaufbau; die
stale-weight-Regression darf unabhängig von Azure-Credentials laufen.

**Expected Handoff:**
- Root-Cause-Befund für Intent, Prompt, Providerantwort, Marker und Eval-
  Lücke;
- Red/Green-Unit-Tests für stale-as-current und stale-markierte Antworten;
- `generateDailyInsight()`-Tests mit gemocktem Provider;
- Handler-Test für HTTP 200 `unavailable` ohne Persistierung und Quota-
  Tracking;
- dokumentierte Entscheidung zu v10-Hardening oder Promptversions-
  invalidierung;
- vollständiger Eval-Status mit `VERIFIED` oder `UNVERIFIED` bei fehlenden
  Credentials.

#### CWP-F1 - Frontend testability seam for InsightCard

**Agent:** Frontend  
**Goal:** Den vorhandenen `InsightCard`-Render-/Feedbackpfad für einen
deterministischen JS-only Component-Test zugänglich machen, ohne sichtbare
Feedbacksemantik zu ändern oder eine native Abhängigkeit einzuführen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/InsightCard.tsx`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/services/insightService.ts`
- `mobile/src/shared/components/Snackbar.tsx`
- `mobile/src/shared/components/Icon.tsx`
- `mobile/vitest.config.mts`
- `mobile/package.json`
- `mobile/src/modules/nutrition/hub/FoodEntryHub.test.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:**
- AC-25
- AC-26
- AC-38 bis AC-41

**Dependencies:** CWP-B2 Handoff für die endgültigen API-Fehlercodes; die
vorhandene UI-State-Machine ist die Verhaltensbaseline.

**Expected Handoff:**
- minimaler, dokumentierter Test-Seam oder Mock-Grenzen für den echten
  `InsightCard`-Renderpfad;
- keine sichtbare Änderung an Trigger-, Submit-, Retry- oder Fehlersemantik;
- Entscheidung, ob ein JS-only Dev-Renderer benötigt wird, einschließlich
  React-Peer-Kompatibilitätsprüfung;
- Übergabe der auswählbaren Accessibility-Labels und Events an CWP-F2;
- Bestätigung von `Mobile Build Impact: None`.

#### CWP-F2 - Focused InsightCard component test

**Agent:** Frontend  
**Goal:** Die vollständige Finding-F-05-Interaktionsmatrix als ausgeführten
Component-Test abdecken und sicherstellen, dass Vitest `.test.tsx` nicht
überspringt.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/InsightCard.tsx`
- `mobile/src/modules/home/InsightCard.test.tsx`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/services/insightService.ts`
- `mobile/vitest.config.mts`
- `mobile/package.json`
- CWP-F1 Test-Seam-Handoff

**Required Skills:** None.

**Relevant Acceptance Criteria:**
- AC-25
- AC-26
- AC-38 bis AC-41

**Dependencies:** CWP-F1 Handoff und der bestehende Backend-Feedbackvertrag.

**Expected Handoff:**
- `mobile/src/modules/home/InsightCard.test.tsx` mit echter Render-/
  Interaktionsausführung;
- Vitest-Konfigurationsnachweis, dass `.test.tsx` ausgeführt wird;
- Assertions für Triggerzustände, Sheet, Trim/Länge/Submit-Lock, stabile und
  rotierende IDs, Success/Callback/`created: false`, 404/409 und
  Snapshot-Unavailable mit Kommentarerhalt;
- Testausgabe ohne neue native Dependency, Config-Plugin oder App-Config-
  Änderung.

#### CWP-D1 - Correction documentation and implementation handoff

**Agent:** Backend  
**Goal:** Nach der Implementierung die API-, AI- und Domain-Dokumentation auf
den tatsächlich gelieferten F-04- und stale-weight-Vertrag aktualisieren und
keine bekannte Offset-Divergenz zurücklassen.

**Required Knowledge Base:**
- `docs/kb/README.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**
- CWP-B1 Handoff
- CWP-B2 Handoff
- CWP-F2 Handoff
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`
- dieser Plan

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-12
- AC-14 bis AC-16
- AC-27
- AC-30
- AC-33
- AC-37

**Dependencies:** CWP-B1, CWP-B2 und CWP-F2 Handoffs. Diese
Dokumentationsänderungen erfolgen erst im späteren Implementierungsdurchlauf;
in der aktuellen Planner-Runde bleibt die KB unverändert.

**Expected Handoff:**
- aktualisierte API-Dokumentation ohne Aussage, dass der Offset ignoriert
  wird;
- dokumentierter Wertebereich, Richtung, Fallback, Current-Day- und
  Local-Midnight-TTL-Vertrag;
- dokumentierter stale-weight-Safety-/Quota-/Unavailable-Vertrag und
  gegebenenfalls Promptversionsänderung;
- Abweichungsbericht zwischen Implementierung und KB, falls vorhanden.

#### CWP-Q1 - Dedicated correction QA and finding reconciliation

**Agent:** QA  
**Goal:** AC-1 bis AC-27 sowie AC-28 bis AC-43 vollständig gegen die
Implementierung prüfen, die blocking stale-weight-Regression beweisen und die
vier Findings mit reproduzierbarer Evidenz bewerten.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

**Required Repository Context:**
- CWP-B1 Handoff
- CWP-B2 Handoff
- CWP-F1 Handoff
- CWP-F2 Handoff
- CWP-D1 Handoff
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/lib/openai.daily.test.ts`
- `backend/src/lib/dailyInsightValidation.test.ts`
- `mobile/src/modules/home/InsightCard.test.tsx`
- `mobile/vitest.config.mts`
- `docs/qa/reports/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- `docs/qa/findings.md`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-1 bis AC-43

**Dependencies:** CWP-D1 Handoff; alle Korrekturimplementierungen und die
Dokumentationsänderungen müssen vor dem abschließenden QA-Lauf vorliegen.

**Expected Handoff:**
- aktualisierter QA-Report unter
  `docs/qa/reports/PLAN_US_Home-Screen-Insights_Feedback_Review.md` im Format
  `fittrack-qa-v1`;
- Matrix für AC-1 bis AC-43 mit Ergebnis und Evidence;
- Testtabelle mit Exit-Code für jeden relevanten Befehl;
- expliziter Nachweis der lokalen Offset-/TTL-Grenzen, Cache-Invalidierung,
  stale-weight-Generator-/Handler-Regression und no-persist/no-track-Verhalten;
- Nachweis, dass `InsightCard.test.tsx` tatsächlich ausgeführt wurde;
- getrennte `VERIFIED`, `UNVERIFIED` und `MANUAL VALIDATION REQUIRED`-Angaben;
- strukturierte Reconciliation-Empfehlung für FT-QA-2026-012, -013, -014 und
  insbesondere den Konflikt zwischen FT-QA-2026-015 `Closed` und dem neuen
  Laufzeitlog. Der Orchestrator schreibt das zentrale Register nach seinem
  Findings-Prozess.

#### CWP-I1 - Infrastructure and Release Dev handoff

**Agent:** Infrastructure  
**Goal:** Die korrigierte Backend-Funktion nach bestandenem QA-Lauf im Dev-
Umfeld validieren/deployen, den Staging-Sync nach dem dokumentierten Workflow
sicherstellen und die abschließende Build-Entscheidung treffen.

**Required Knowledge Base:**
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**
- `infra/main.bicep`
- `infra/modules/cosmos.bicep`
- `_deploy_staging/`
- `backend/package.json`
- `mobile/package.json`
- `mobile/app.config.js`
- CWP-Q1 QA Handoff

**Required Skills:** None.

**Relevant Acceptance Criteria:**
- AC-27
- AC-43

**Dependencies:** CWP-Q1 muss ohne offenen blocking Finding abgeschlossen
sein. Ein Alpha-Deploy ist kein Bestandteil dieses Handoffs und benötigt
weiterhin einen ausdrücklichen operativen Auftrag.

**Expected Handoff:**
- Dev-Deploy-/Smoke-Check-Evidence gemäß bestehendem Windows-zu-Linux-
  Staging-Workflow;
- Bestätigung, dass kein Bicep-, Cosmos-, Config-Plugin- oder Native-Change
  erforderlich ist;
- finale Entscheidung `Dev Build Required: NO`;
- Alpha-Gate-Status mit Verweis auf QA, Evals, Emulator-/manuelle Grenzen und
  DV-1 bis DV-3;
- kein automatisch ausgelöstes Alpha-Deployment.

### 22.8 Correction test commands and evidence rules

Die folgenden Befehle gehören zum späteren Implementierungs-/QA-Handoff. In
dieser Planner-Runde werden sie nicht ausgeführt:

```text
cd backend && npx vitest run src/lib/dailyInsightValidation.test.ts src/lib/openai.daily.test.ts src/functions/dailyInsight.test.ts
cd backend && npx vitest run --reporter=dot --silent
cd backend && npx tsc --noEmit
cd backend && npm run build:verify
cd backend && npm run test:eval
cd backend && npx vitest run --config vitest.contract.config.mts
cd shared && npx vitest run
cd shared && npx tsc --noEmit
cd mobile && npx vitest run src/modules/home/InsightCard.test.tsx
cd mobile && npx vitest run
cd mobile && npx tsc --noEmit
node scripts/check-encoding.mjs
git diff --check
```

`npm run test:eval` ist ein Provider-/Prompt-Nachweis, kein Ersatz für die
credential-freien stale-weight-Unit-Tests. Fehlende Azure-Credentials werden
als `UNVERIFIED` erfasst. Cosmos-Contract-Tests benötigen den Emulator; ein
nicht verfügbarer Emulator wird getrennt als `UNVERIFIED` erfasst. Ein
fehlender Component-Test oder ein nicht ausgeführtes `.test.tsx` ist dagegen
ein actionable Finding und keine manuelle Validierungsgrenze.

### 22.9 Additive correction acceptance criteria

28. **F-04 Offset-Vertrag:** Der Backend-Handler akzeptiert als wirksamen
    `timezoneOffsetMinutes` ausschließlich einen Integer im Bereich `-840..840`
    mit der Bedeutung `local - UTC`. Fehlende, nicht-ganzzahlige, nicht-
    numerische oder außerhalb liegende Werte werden zu `null` normalisiert,
    nicht geklemmt und lösen keinen alleinigen 400-Fehler aus.
29. **F-04 Current Day:** Bei validem Offset entspricht das serverseitig
    berechnete lokale date-only-Datum `dateOnly(backendNow + offset)`. Nur bei
    Übereinstimmung von Request-Datum und diesem Datum darf `localHour` den
    Activity-Status bestimmen; lokale/UTC-Grenzfälle und `-840/840` sind
    getestet.
30. **F-04 Invalid/Missing Safety:** Bei fehlendem oder ungültigem Offset
    bleibt der Daily-GET legacy-tolerant, verwendet den UTC-Fallback für den
    Ablauf und erzeugt keine unbelegte lokale Activity-Abschlussaussage. Ein
    ungültiger Wert wird nicht als gültiger Randwert interpretiert.
31. **F-04 Local TTL:** Bei validem Offset zeigen `expiresAt` und der
    positive, aufgerundete TTL-Wert auf dieselbe nächste lokale Mitternacht in
    UTC. Der UTC-Fallback bleibt für fehlende/ungültige Offsets bestehen;
    Feedback-Dokumente erhalten weiterhin kein `ttl`/`expiresAt`.
32. **F-04 Cache:** Der Input-Hash enthält den normalisierten Offset oder eine
    gleichwertige lokale Ablaufgrenze. Ein Offsetwechsel kann kein Daily mit
    falscher lokaler Status-/TTL-Semantik aus dem Cache liefern.
33. **F-04 API-Dokumentation:** `docs/kb/tech/09-api-reference.md` und die
    relevanten AI-/Domain-Dokumente beschreiben nach dem Implementierungs-
    Handoff die Offsetrichtung, den Wertebereich, Fallbacks, Current-Day-
    Ermittlung und Local-Midnight-TTL; sie behaupten nicht mehr, dass der
    Backend-Offset ignoriert wird.
34. **Stale direct validator regression:** Bei stale Context über 14 Tagen
    wird aktuelle Gewicht-/Trend-Sprache deterministisch abgewiesen; explizite
    Stale-Sprache wird akzeptiert. Die bestehende Grenze `14 aktuell, 15
    stale` bleibt erhalten.
35. **Stale generator regression:** `generateDailyInsight()` wird mit
    gemockten Providerantworten für beide stale-Fälle ausgeführt. Die Tests
    laufen ohne Azure-Credentials und decken Strict Output plus semantische
    Validierung gemeinsam ab.
36. **Stale handler failure contract:** Eine semantisch abgewiesene
    stale-as-current-Antwort ergibt HTTP 200 `unavailable`, erzeugt kein
    Daily-Dokument und ruft kein Quota-Tracking auf. Eine akzeptierte
    stale-markierte Antwort folgt dem normalen Persistenz-/Quota-Vertrag.
37. **Stale prompt/eval alignment:** Der Handoff benennt Intent, Promptmodul,
    exakte Stale-Anweisung, Providerabweichung und Markerentscheidung. Eine
    Promptänderung wird mit v10-Hardening oder neuer Version plus Cache-
    Invalidierung begründet; die Sicherheitsprüfung wird nicht gelockert.
38. **Component test execution:** `mobile/src/modules/home/InsightCard.test.tsx`
    wird vom Mobile-Vitest-Befehl ausgeführt. Ein reiner Service-, Date- oder
    manuell dokumentierter Test gilt nicht als Erfüllung.
39. **Component trigger states:** Der Component-Test beweist Trigger-
    sichtbarkeit für `fresh`/`cached` mit Datum und Provenienz sowie deren
    Unsichtbarkeit für Skeleton, Quota, Unavailable, fehlendes Datum und
    `feedbackAvailable: false`.
40. **Component submission states:** Der Component-Test beweist Sheet-
    Öffnung, Trim-/1-500-Zeichen-Regel, Submit-Lock, unveränderte Retry-ID,
    ID-Wechsel nach geändertem Kommentar, Erfolg/Callback/Snackbar und
    `created: false` als Erfolg.
41. **Component error retention:** `insight_not_found`,
    `insight_generation_changed`, `feedback_snapshot_unavailable` und
    `feedback_submission_conflict` werden mit passender UX, Kommentarerhalt
    und korrektem weiteren Submit-Verhalten geprüft. 404/409 sind kein
    Erfolgs-Callback.
42. **F-06 Traceability:** Der persistierte Plan trägt den Status
    `[Correction Approved]`, die Nutzerfreigabe und die Interpretation, hält
    AC-1 bis AC-27 als Baseline vor und endet mit dem Korrekturhandoff. Kein
    veralteter Nicht-Freigabestatus bleibt maßgeblich.
43. **Correction QA and release:** QA validiert AC-1 bis AC-43 und liefert
    Report-/Finding-Evidence. Infrastructure & Release validiert Dev, trifft
    final `Dev Build Required: NO`, bestätigt `Infrastructure Impact: Dev` und
    `Mobile Build Impact: None`; Alpha bleibt durch QA, Evals, DV-Gates und
    den bestehenden operativen Auftrag geschützt.

### 22.10 Correction-specific risks and residual boundaries

- **Fixed offset versus IANA timezone:** Der aktuelle API-Vertrag übermittelt
  einen Offset, keine Zeitzonen-ID. Die lokale nächste Mitternacht wird daher
  mit dem beim Request validierten Offset berechnet; eine zukünftige
  DST-Änderung innerhalb dieses Tages ist eine bekannte Vertragsgrenze und
  kein Anlass, in dieser Korrektur einen neuen Zeitzonenvertrag zu erfinden.
- **Legacy fallback:** Fehlende/ungültige Offsets bleiben abrufbar, erhalten
  aber keine erfundene lokale Completion-Aussage. Diese Kombination muss in
  Handler- und Context-Tests ausdrücklich sichtbar sein.
- **TTL boundary race:** `expiresAt`/TTL werden aus demselben injizierten
  `backendNow` und derselben lokalen Grenze berechnet. Feedback bleibt durch
  den bestehenden Submission-ID-Lookup unabhängig vom Daily-TTL retrybar.
- **Cache correctness:** Offset ist Teil des ausgaberelevanten Inputs. Ein
  Test muss einen Cache-Hit mit identischem Offset von einem Hash-Mismatch nach
  Offsetwechsel unterscheiden.
- **AI safety versus availability:** Ein stale-as-current-Text bleibt ein
  Sicherheitsfehler und wird `unavailable`; der Fix darf den Validator nicht
  abschalten. Die akzeptierte stale-markierte Providerantwort beweist,
  dass der korrigierte Prompt-/Generatorvertrag wieder einen nutzbaren
  Insight erzeugen kann.
- **Renderer compatibility:** Die Mobile-Tests dürfen keine native
  Dependency, keinen Config-Plugin- oder App-Config-Change erzeugen. Ein
  erforderlicher JS-only Renderer muss zur vorhandenen React-Version passen
  und darf nicht ungeprüft aktualisiert werden.
- **Closed finding conflict:** FT-QA-2026-015 wird erst nach der neuen
  deterministischen Evidenz geschlossen. Ein alter Live-Eval-Pass ist dafür
  nicht ausreichend.

## 23. Updated Correction Execution Order

Die Korrekturrunde wird strikt sequenziell ausgeführt. Das ursprüngliche
Feature wird nicht erneut implementiert; jeder Schritt liefert genau den im
jeweiligen Workpackage genannten Handoff.

1. **CWP-B1:** Backend validiert `timezoneOffsetMinutes`, Current-Day,
   Local-Midnight-TTL, Hash und Legacy-Fallback.
2. **CWP-B2:** Backend reproduziert und korrigiert die stale-weight-
   Generator-/Handler-Regression mit credential-freien Unit-Tests und führt
   danach den vollständigen Live-Eval mit `VERIFIED`/`UNVERIFIED`-Status aus.
3. **CWP-F1:** Frontend stellt den minimalen, verhaltensneutralen
   `InsightCard`-Test-Seam und die Mock-Grenzen bereit.
4. **CWP-F2:** Frontend fügt den ausführbaren `.test.tsx`-Component-Test hinzu und
   weist die vollständige F-05-Interaktionsmatrix nach.
5. **CWP-D1:** Backend aktualisiert API-, AI- und Domain-Dokumentation auf den
   tatsächlich implementierten Korrekturvertrag.
6. **CWP-Q1:** QA validiert AC-1 bis AC-43, aktualisiert den QA-Report und
   liefert die Reconciliation-Empfehlung für FT-QA-2026-012 bis -015. Der
   Orchestrator persistiert die Finding-Status gemäß seinem Prozess.
7. **CWP-I1:** Infrastructure & Release validiert/deployed ausschließlich
   gegen Dev, prüft den Staging-Sync und entscheidet final
   `Dev Build Required: NO`. Kein Alpha-Deploy und kein EAS-Build wird durch
   diesen Plan automatisch ausgelöst.

**Final correction handoff:** Dieser Plan ist mit der Nutzerfreigabe als
Korrekturplanung persistiert. Er behauptet weder, dass die Korrekturen bereits
implementiert sind, noch dass der stale-weight-Fehler bereits geschlossen
ist. Die spätere Implementierung wird erst nach den oben genannten
deterministischen Tests, der vollständigen QA-Matrix, der Finding-Reconciliation
und dem Dev-Handoff als abgeschlossen bewertet.

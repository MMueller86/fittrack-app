# Umsetzungsplan – US-03 Dynamische KI-Begrüßung mit FitTrack Insight (Revision 2)
Story: [US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md](US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight-v2.md)
Status: DRAFT – Planung für Review; die Story ist Draft und erteilt keine Implementierungs- oder Releasefreigabe.
Infrastructure Impact: None
Mobile Build Impact: None

## 1. Requirement Assessment

**Klassifikation:** Accept as proposed. Die persönliche Einordnung benötigt eine KI, weil mehrere verifizierte Signale knapp und zusammenhängend in natürlicher Sprache formuliert werden sollen. Berechnungen, Datenqualität, Empfehlungsberechtigung und Sicherheitsgrenzen bleiben deterministisch serverseitig; die KI erfindet weder Status noch Schwellenwerte.

**Produktproblem:** Die aktuelle Daily-Insight-Komposition priorisiert einen Intent exklusiv und enthält überlappende Guards. Das erschwert gemeinsame Einordnungen und lässt geltende Produktregeln unnötig kompliziert und widersprüchlich werden. Die Story definiert die gewünschte, vereinfachte fachliche Quelle.

**Planner-Prozessgrenze:** Die Story verlangt ein zentrales KB-Regeldokument „als Planungsergebnis“. Die Planner-Rolle darf laut `.github/instructions/planner.instructions.md` ausschließlich unter `docs/User Stories/` schreiben. Dieses Planungsdokument legt deshalb Inhalt, Zielpfad und Folgereferenzen fest; Erstellung und KB-Änderungen sind ein verpflichtender Backend-Dokumentationsdeliverable vor QA, nicht eine Planner-Dateiänderung.

**Offene Product-Owner-Entscheidungen:** Keine für den beschriebenen Umfang. Für Datumsabfragen in der Zukunft spezifiziert die Story kein neues Verhalten; bestehendes Verhalten bleibt unverändert.

## 2. Feature Summary

Eine einzelne KI-Generierung liefert Begrüßung, Kurz-Insight und vollständigen Insight. Der bestehende authentifizierte `GET /api/ai/daily-insight`-Pfad, Requestparameter, Quoten, Lade-/Refresh-Auslöser, Cache-/TTL-Mechanik und Datenquellen bleiben bestehen. Der HomeScreen zeigt ein gültiges Begrüßungs-/Kurzsatz-Paar in der vorhandenen Coaching-Karte; „Mehr lesen“ öffnet den exakten Insight als lokale Momentaufnahme.

Die Backend-Änderung erweitert nur die aus bereits vorhandenen Diary-, Profil-, Aktivitäts- und Gewichtsdaten abgeleiteten Fakten und richtet Prompt, Validierung und Evals an Story v2 aus. Es gibt keinen separaten Summary-Aufruf.

## 3. Current Behaviour / Confirmed Facts

- Der bestehende Handler ist `backend/src/functions/dailyInsight.ts`; er verarbeitet Authentifizierung, lokales Datum/Ortszeit, bestehenden Cache, Quota und eine einzige tägliche Insight-Antwort. `shared/types/insight.ts` enthält bereits optionale Response-Felder `greeting` und `shortInsight`; die Mobile-Servicefunktion akzeptiert ein vollständiges Paar nur bei `fresh`/`cached` und validiert die Längen 120/240.
- `backend/src/lib/dailyInsightContext.ts` liefert das effektive Tagesziel bereits über die bestehende Zielauflösung. Es liefert heute nur `hasMealItem`, nicht die Vollständigkeit von Frühstück, Mittagessen und Abendessen. Protein wird aktuell anhand der bestehenden Shared-Klassifizierung berechnet; deren Coaching-Schwelle beträgt 2,2 g/kg und entspricht daher nicht der Story-Schwelle 2,5 g/kg.
- Derselbe Kontext leitet derzeit `planned` vor 20 Uhr, `likely_completed` ab 20 Uhr und `unknown` für historische/unbekannte Fälle ab. Das widerspricht der Story (22 Uhr, vergangene Aktivität abgeschlossen, keine Tri-State-Aussage).
- `backend/src/lib/dailyInsightIntent.ts` wählt genau einen Intent anhand einer festen Reihenfolge. Die Promptprojektion in `dailyInsightPrompt.ts` entfernt bei Gewichts-Intents Ernährungsdaten. Das widerspricht der Story, die relevante validierte Signale gemeinsam zulässt.
- Die aktuelle Prompt-/Validator-Implementierung enthält viele intent- und phrase-spezifische Guards einschließlich eines 20-g-Protein-Locks und enger Aktionsbedingungen. Die Story ersetzt diese Verhaltensregeln; unabhängige Datentreue- und Sicherheitsprüfungen bleiben erforderlich.
- `backend/src/lib/dailyInsightValidation.ts` begrenzt `summary` derzeit auf 600 Zeichen. Die Story erlaubt knappe Texte ohne Mindestwortzahl und setzt 5.000 Zeichen als technische Obergrenze, oberhalb derer abgelehnt werden darf.
- `mobile/src/modules/home/CoachingHeroCard.tsx` kann ein kompaktes Insight-Paar und eine Detailansicht bereits darstellen. `HomeScreen.tsx` übergibt das Paar derzeit nicht an die Karte und rendert weiterhin eine separate `InsightCard` weiter unten. Der bestehende Detailpfad verwendet `InfoOverlay`; Feedback, CTAs und Momentaufnahme sind dort vorhanden.
- Im aktuellen Arbeitsbaum sind bereits Backend-, Prompt-, Eval- und zahlreiche KB-Dateien geändert. Das sind unbestätigte Arbeitsänderungen, kein Abnahme- oder QA-Nachweis. Die Dateien müssen bei der Umsetzung gelesen, erhalten und fachlich gegen Story v2 geprüft werden. Die gleichfalls geänderten `ProgressHeroCard`-Dateien sind nicht Teil dieses Vorhabens und bleiben unberührt.
- Der aktuelle Arbeitsbaum deklariert `DAILY_INSIGHT_PROMPT_VERSION = v23`, Assembly `v8`, Manifest-Release `v24` und Fingerprint `sha256:a3d601ae4a68d4257af49d14e84b66993293507c590125e2504cc51720bcaa96`. Das ist die beobachtete Kandidatenidentität, kein bestandener Gate-Nachweis. Der alte, untracked Plan beschreibt einen anderen v23/Assembly-Stand und frühere fachliche Regeln; er gilt nicht als Plan für Revision 2 und bleibt unverändert.

## 4. Desired Behaviour

- Eine zentrale, kurze Einordnung darf passende Kalorien-, Protein-, Aktivitäts- und Gewichtssignale gemeinsam verwenden; ein ausgewählter Intent darf relevante Fakten nicht exklusiv aus dem Kontext entfernen.
- Server berechnet und übergibt valide Tageszielrelation, Proteinstatus, Mahlzeitenvollständigkeit/Empfehlungserlaubnis, Aktivitätszeitregel und Gewichtssignal. Das Modell übernimmt keine Rohdatenberechnung.
- Essensempfehlungen sind ausschließlich bei je einem Diary-Eintrag in `breakfast`, `lunch` und `dinner` sowie mindestens 300 kcal Rest erlaubt; optionale Empfehlungen sind weder Pflicht noch Eval-Erfolgskriterium.
- Vor 22 Uhr Ortszeit wird für eine heutige Aktivität kein Abschluss behauptet; ab 22 Uhr darf sie als abgeschlossen gelten. Vergangene Diary-Aktivitäten gelten als durchgeführt.
- Die Mobile-Karte zeigt nur ein vollständiges gültiges Paar; andernfalls zeigt sie die vorhandene statische Begrüßung ohne Kurzsatz und Detailaktion. „Mehr lesen“ macht keinen neuen Request und hält den angezeigten Snapshot stabil.

## 5. Scope / Out of Scope

**Im Scope:** Backend-Kontext, Prompt, Schema/Validator, Eval-Fixtures und Releaseidentität; Integration in HomeScreen/CoachingHeroCard; lokale und manuelle UI-Prüfung; zentraler Daily-Insight-KB-Artikel und gezielte Querverweise; Backend-, Shared-, Mobile- und QA-Nachweise einschließlich Story-Gate.

**Nicht im Scope:** neuer Endpoint, Requestparameter, zusätzlicher Provider-Aufruf, Datenquelle, Refresh-Auslöser, Quota, Container, Index, Bicep-Änderung, Migration/Backfill, KI-generierter Ersatz für fehlende Kurzfelder, neue native Abhängigkeit, Deploy oder EAS-Build. Eine Änderung der API-Response-Struktur ist nicht vorgesehen; `greeting` und `shortInsight` bleiben auf Response-Ebene optional, weil unavailable/quota/cached Altantworten kein Paar enthalten können.

## 6. Proposed Technical Solution

1. Bestehende Repository-Daten verwenden. Für die Empfehlungsfreigabe Mahlzeittypen aus den Items des aktuellen Diary-Tags auswerten; ein leerer Meal-Container zählt nicht. Die Tagesaufnahme und das effektive Ziel bleiben die bestehenden serverseitigen Werte.
2. Für Daily Insight eine eindeutige serverseitige Protein-Klassifikation bereitstellen: unter 1,5 g/kg, innerhalb 1,5–2,0 g/kg, oberhalb der Range ohne besondere Warnung bis unter 2,5 g/kg, sowie ab 2,5 g/kg optionaler Hinweis. Bei fehlendem/veraltetem Gewicht bleibt diese spezifische Klassifikation unbekannt. Die bestehende Shared-Coaching-Funktion und Hint-Engine nicht ungewollt von 2,2 auf 2,5 umstellen; Änderungen an gemeinsam genutzter Klassifizierung müssen die Aufrufer und Regressionen zuerst prüfen.
3. Die Aktivitätsableitung auf die Story-Regel umstellen, ohne ein Persistenzfeld in `SpecialActivity` einzuführen. Keine Kategorien `planned`, `likely_completed` oder `unknown` als neue Insight-Aussage an das Modell geben. Bestehende Zeitzonen-/Ortszeitquelle weiterverwenden; zukünftige Datumsabfragen unverändert lassen.
4. Die exklusive Intent-Priorisierung und Kontextprojektion entfernen oder so zurückstufen, dass sie keine relevanten validierten Themen ausfiltert. Das Modell erhält eine sachlich begrenzte Signalmenge und formuliert eine zentrale Erkenntnis. Aktivitäts- und Zielschutz sowie zuverlässige historische Zuordnung bleiben als sachliche Validierung erhalten, nicht als starre Themenrangfolge.
5. Provider-Schema/Antwortvalidator: Begrüßung und `shortInsight` im erfolgreichen Generierungsfall gemeinsam verpflichtend; Kurzsatz genau ein vollständiger deutscher Satz, max. 240 Zeichen; Headline max. 40; `summary` ohne Mindestwortzahl, max. 5.000 Zeichen. Empfehlung/CTA bleiben optional und konsistent. Inhaltsprüfungen gelten auch für `shortInsight` und sämtliche Aktionsfelder.
6. Server prüft harte, datenbasierte Grenzen: Kalorienbeziehung stimmt rechnerisch; innerhalb Ziel keine „zu viel“-Aussage; über Ziel eine unterstützende Tagesziel-Einordnung ohne physiologische Energiebilanz; Empfehlung nur bei den Mahlzeiten-/300-kcal-Bedingungen; keine Gewichtstrendbehauptung ohne 30-Tage-Trend; kein veraltetes Gewicht als aktuell. Keine festen Wortlaute oder Du/Sie-Prüfungen.
7. Evals decken wenige robuste Verhaltensgrenzen plus Ausgabe-Vertrag ab. Positive Generierungsfälle müssen eine echte valide Generierung liefern; Fallbacks und erwartete Ablehnungen können einen positiven Fall nicht grün machen. Optionale Empfehlungen werden nicht verlangt. Negative Safety-Fixtures dürfen ihren ausdrücklich erwarteten Reject weiter prüfen.
8. Vor Backend-Handoff den Promptkandidaten und relevante Quell-/Fixture-Identität fixieren. Die zehn vollständigen betroffenen Eval-Läufe müssen für exakt diesen Kandidaten erfolgreich sein; nach jeder relevanten Änderung wird die komplette Zehnerserie neu gestartet.
9. Mobile verwendet vorhandenen `getInsight`, `hasCompactInsight`, `CoachingHeroCard`, `InsightCard` und `InfoOverlay`. Kein neuer Fetch auf Detailöffnung, Selector-Änderung oder Feldlücke; vorhandene Home-Fokus-/Pull-to-refresh-Auslöser unverändert.

### API, Persistence und Infrastructure

**API:** Kein neuer Endpoint oder Requestparameter. Bestehender GET-Vertrag und `InsightResponse`-Form bleiben erhalten; optionale Felder sind nur für gültige frische/gecachte Insights gemeinsam verfügbar. Die technische Validierungsobergrenze für `summary` wird in API-Dokumentation und Tests auf 5.000 Zeichen ausgerichtet.

**Persistence Impact:** Erwartet Class 0. Keine neue Entität oder Container und keine Migration. Falls reproduzierbare Ableitungen als optionale Felder innerhalb des bereits gespeicherten `InsightDocument.inputContext` ergänzt werden, bleiben ältere Dokumente ohne diese Felder lesbar; kein Backfill/Rewrite. Keine neuen Datenquellen: Ableitungen stammen aus den bereits gelesenen Diary-/Profil-/Gewichts-/Aktivitätsdaten. Backend muss Eingabe-Hash und Snapshot-Projektion auf vollständige Reproduzierbarkeit prüfen; nur reguläre Kontext-/Promptidentität kann die bestehende Cacheentscheidung beeinflussen.

**Infrastructure:** Keine Bicep-, Cosmos-Container-, Konfigurations- oder Ressourcenänderung und kein Deploy durch diesen Plan. Backend-Integrationstests bleiben providerfrei, Live-Evals verwenden die vorhandenen lokalen Azure-Credentials. Dev/Alpha-Rollout ist ein späterer, gesonderter operativer Auftrag.

## 7. Backend Work Package

### B-1.1 – Serverkontext und Modellgrenzen
Agent: Backend

**Goal:** Alle storyrelevanten Fakten aus vorhandenen Quellen serverseitig und reproduzierbar ableiten: Mahlzeitenvollständigkeit, Empfehlungserlaubnis, Proteinstatus einschließlich 2,5-g/kg-Grenze, Kalorienrest, 30-Tage-Gewichtssignal und Aktivitätsaussage gemäß 22-Uhr-Regel. Exklusive Themenunterdrückung entfernen. Keine neuen API- oder Diary-Datenquellen.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`

**Required Repository Context:**
- `backend/src/lib/dailyInsightContext.ts`
- `backend/src/lib/dailyInsightContext.test.ts`
- `backend/src/lib/dailyInsightIntent.ts` und zugehörige Tests
- `backend/src/lib/repositories/insightRepository.ts` und Tests
- `shared/types/insight.ts`
- `shared/lib/macroRanges.ts` und `shared/lib/macroRanges.test.ts` bzw. zugehörige Profiltests
- `shared/types/diary.ts`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-3 bis AC-9, AC-14, AC-16.

**Dependencies:** Keine. Story v2 ist führend; vorhandene Änderungen erst prüfen und erhalten.

**Expected Handoff:** Geprüfte Context-/Type-Schnittstelle, eindeutige Ableitungen und Unit-Tests; dokumentierte Backward-Compatibility-Bewertung des optionalen `inputContext`; Bestätigung, dass Profilberechnung, andere Hint-Engine-Aufrufer und Diary-Datenvertrag unverändert bleiben. Übergabe an B-1.2 mit konkreten Feld-/Enum-/Hashänderungen.

### B-1.2 – Prompt, Validierung, Evals, KB und Backend-Gate
Agent: Backend

**Goal:** Provider-Ausgabe und Safety-Validierung an Story v2 anpassen, relevante Evals stabilisieren, zentrales Regelwerk plus Backend-KB-Verweise aktualisieren und das verbindliche Zehn-Läufe-Gate erfolgreich für einen fixierten Kandidaten abschließen.

**Required Knowledge Base:**
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- Handoff B-1.1

**Required Repository Context:**
- `backend/src/lib/dailyInsightSchema.ts`
- `backend/src/lib/dailyInsightValidation.ts` und Tests
- `backend/src/lib/openai.ts` und `openai.daily.test.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.ts`, `sharedTone.ts`, `promptActivity.ts`, `promptNutrition.ts`, `promptWeight.ts`, `promptMorning.ts`, `promptGeneral.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`, `dailyInsight.eval.fixtures.ts`, Eval-Rubrik/Evidence und Manifest samt Tests
- `backend/scripts/run-eval.mjs`
- `backend/scripts/verify-daily-insight-prompt.mjs` und `verify-daily-insight-prompt.test.mjs`
- `backend/src/functions/dailyInsight.ts` und Tests
- `shared/types/insight.ts`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1 bis AC-10, AC-14 bis AC-16.

**Dependencies:** B-1.1 Handoff. Die bestehenden uncommitted Backend-/KB-Änderungen sind Prüfgegenstand und dürfen nicht verworfen werden.

**Required Deliverables:**
- Provider erzeugt Greeting, Kurzsatz und Volltext in einer bestehenden Generierung; keine zusätzliche AI-Operation.
- Entfernte/angepasste Promptguards entsprechen dem zentralen Regelwerk; optionale Ratschläge bleiben optional.
- Schema-, Validator-, Prompt-, Fixture-, Rubrik-, Manifest- und Release-Guard-Identität sind konsistent. Unveränderte Teile der bestehenden Quoten-, Auth-, Cache-, TTL- und Feedbackverträge sind regressionsgeprüft.
- Neues zentrales Regelwerk `docs/kb/domain/09-daily-insight.md` mit Motivation, Zielen, Signalen, Bedingungen, Ausnahmen und prüfbaren Verhaltensgrenzen. `docs/kb/README.md` indexiert es. `domain/02-diary.md`, `domain/07-ai-features.md`, `tech/06-ai-integrations.md`, `tech/08-testing.md` und `tech/09-api-reference.md` verweisen darauf, soweit ihr bestehender Inhalt Daily-Insight-Regeln beschreibt. Überholte Aussagen werden ersetzt, nicht parallel gepflegt.
- Ein dauerhaftes Backend-Handoff dokumentiert geänderte Dateien, Kandidatenidentität, genaue Prüfkommandos/Exitcodes, Live-Ergebnisse, übersprungene Tests und nicht verifizierte Grenzen.

**Backend Gates vor Übergabe:**
- Alle betroffenen Backend-/Shared-Unit-Tests, beide Typechecks (Backend und Shared), `npm run build:verify --workspace=@fittrack/backend` und `npm run verify:daily-insight-prompt --workspace=@fittrack/backend` bestehen.
- Danach vollständige betroffene Eval-Suite zehnmal nacheinander mit identischem Prompt-/Quell-/Fixture-Kandidaten ausführen. Jeder Lauf muss vollständig erfolgreich sein. Ein positiver Fall zählt nur, wenn er eine valide echte Generierung geliefert hat; `fallback`, `unavailable`, `quota_exceeded`, unerwartete/erwartete Ablehnung im positiven Fall, `skipped` und `UNVERIFIED` zählen nicht als Erfolg.
- Einen Lauf mit Ergebnisfehlern nicht durch Wiederholung überstimmen. Fehlerursache innerhalb der Story beheben und anschließend eine neue vollständige Zehnerserie starten. Jede prompt-, schema-, validator-, fixture- oder evalrelevante Änderung nach dem Start macht die Serie ungültig.
- Pro Serie Version/Assembly/Manifest-Fingerprint, Quell- und Fixture-Hashes, Run-IDs/Zeitpunkte, vollständige Laufzahlen nach Pass/Fail/Skip/UNVERIFIED sowie tatsächliche positive Generierungen festhalten. Keine Geheimnisse oder realen Nutzerdaten in Artefakten.

**Expected Handoff:** Erfolgreiche 10/10 Evidenz samt reproduzierbarer Identität und Artefakten; B-1-Status; Backend-/Shared-Gate-Ergebnisse; zentrale KB-Datei und Verweise; stabiler bestehender API-Vertrag; offene Risiken und klare Bestätigung, dass weder Deployment noch Datenmigration durchgeführt wurde. Nur dann darf F-1 starten.

## 8. Frontend Work Package

### F-1 – Coaching-Karte und Insight-Detail
Agent: Frontend

**Goal:** Das bestehende gültige Response-Paar in die Home-Coaching-Karte integrieren, die separate Insight-Karte entfernen und die bestehende vollständige Insight-/Feedback-Funktion über den lokalen Snapshot erhalten.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/09-daily-insight.md`

**Required Repository Context:**
- `mobile/src/modules/home/HomeScreen.tsx` und `HomeScreen.insight.test.tsx`
- `mobile/src/modules/home/CoachingHeroCard.tsx` und Tests
- `mobile/src/modules/home/InsightCard.tsx` und Tests
- `mobile/src/services/insightService.ts`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/shared/components/InfoOverlay.tsx`
- `shared/types/insight.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-10 bis AC-13, AC-16.

**Dependencies:** B-1.2 erfolgreicher 10/10 Backend-Handoff und stabiler bestehender `InsightResponse`-Vertrag. Keine Arbeit beginnt mit einem unbestätigten API-Shape.

**Implementation Boundaries:**
- `HomeScreen` übergibt Insight/Datum und bestehende Feedback-/CTA-Callbacks an `CoachingHeroCard`; die untere separate `InsightCard` entfällt.
- Paar nur bei `fresh`/`cached`, beiden nichtleeren gültigen Feldern und bestehenden Längenlimits anzeigen. Bei `unavailable`, `quota_exceeded`, Netzwerkfehler oder Feldlücke: bestehende statische Begrüßung, kein Kurzsatz, kein Detail-CTA.
- KI-Begrüßung ist der gelieferte tageszeitneutrale Text. Lokaler existierender Gruß bleibt ausschließlich Fallback.
- „Mehr lesen“ zeigt exakt Titel, Zusammenfassung, Empfehlung und vorhandene CTA/Feedback-Möglichkeiten desselben Datums-/`generatedAt`-Snapshots; kein neuer GET, keine Regenerierung und kein Umschalten durch Refresh bei geöffnetem Detail.
- Selector, Home-Fokus, Pull-to-refresh, Requests/Race-Abwehr, Navigation und übrige Home-Karten unverändert lassen. Keine neue native Dependency oder `app.config.js`-Änderung.

**Tests / Handoff:** Mobile-Unit-/Layouttests für gültiges Paar, fehlendes/partielles Paar, Status-Fallback, Snapshot-Stabilität, Detail/Feedback/CTA und Refresh-Races; Typecheck und betroffene Mobile-Suite. Frontend aktualisiert `tech/03-mobile.md` und `product/05-ux-patterns.md` nur soweit nötig, referenziert das zentrale Regelwerk und integriert vorhandene Änderungen. Übergibt geänderte Dateien, Prüfergebnisse und manuelle UI-Nachweise an QA.

## 9. QA Work Package

### Q-1 – Unabhängige Story-Abnahme
Agent: QA

**Goal:** Unabhängig alle Story-v2-Akzeptanzkriterien, Backend-Gates, API-/Cache-/Persistenzgrenzen, Home-UX und KB-Konsistenz überprüfen. QA implementiert keine Änderungen.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/09-daily-insight.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- Story v2 und dieser Plan
- B-1- und F-1-Handoffs, insbesondere zehnerlaufbezogene Quellen-/Reportidentität
- Daily Insight context, intent, schema, prompt, validator, eval fixtures, runner und manifest/guard
- `dailyInsightContext.test.ts`, `dailyInsightValidation.test.ts`, `dailyInsight.eval.test.ts`
- `dailyInsight.ts`, `insightRepository.ts` und zugehörige Tests
- `HomeScreen.tsx`, `CoachingHeroCard.tsx`, `InsightCard.tsx`, `insightService.ts` und zugehörige Tests
- `docs/kb/domain/09-daily-insight.md`, Index und aktualisierte Querverweise

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1 bis AC-16.

**Dependencies:** B-1 erfolgreich mit 10/10 Läufen; F-1-Implementierung, Doku und Handoff vollständig. Ein Backend-Fix nach QA-Fund geht an Backend, invalidiert das bestehende Zehnergate und erfordert 10 neue erfolgreiche Läufe vor gezielter erneuter QA.

**Expected Handoff:** Dauerhafter QA-Bericht mit AC-Matrix `PASS`/`FAIL`/`UNVERIFIED`, reproduzierbaren Befunden, Befehlen und Exitcodes, UI-Nachweisen und Restrisiken. QA bestätigt die Identität der 10 Backend-Läufe unabhängig; es darf keine Ablehnung/Fallback eines positiven Generierungsfalls als Erfolg werten. Keine Freigabe aus bloßen Unit-Ergebnissen oder aus einer nicht gebundenen historischen Promptzahl ableiten.

## 10. Documentation Updates

- Zentrale Fachquelle: `docs/kb/domain/09-daily-insight.md`; README-Index aktualisieren.
- Backend ergänzt Verweise und entfernt widersprechende Detailregeln aus Diary-/AI-/Testing-/API-Dokumentation. Das Diary-Datenmodell selbst erhält kein Completion-Statusfeld.
- Frontend aktualisiert Home-/Detailverhalten in `tech/03-mobile.md` und `product/05-ux-patterns.md` und verweist auf das Fachregelwerk.
- Dokumentation nennt den tatsächlich implementierten Prompt-/Assembly-/Releasefingerprint und aktuelle Prüfergebnisse. Alte Versionen und frühere Testresultate bleiben historisch, nicht rückwirkend umetikettiert.

## 11. Test Strategy and Acceptance Criteria

**Offline/regression:** Backend-Kontext-, Intent-/Signal-, Schema-, Validierungs-, Provider-, Cache- und Handler-Tests; Shared-Klassifizierung/Typkompatibilität; Mobile Status-/Fallback-/Layout-/Snapshot-/Feedbacktests. Prüfen mindestens: Protein 1,5/2,0/2,5 g/kg und unzuverlässiges Gewicht; genau drei Mahlzeiten oder fehlende/leere Mahlzeit; 299/300 kcal Rest; Kalorien innerhalb, genau am und über Ziel; widersprüchlicher Rest; Aktivität vergangen, heute 21:59/22:00 und normale Aktivität; Gewicht 14/15 Tage und ohne belastbaren Trend; Kurzsatz leer, ein Satz, zwei Sätze, 240/241 Zeichen; Summary knapp und 5.000/5.001 Zeichen.

**Live:** Nur die vollständigen betroffenen Daily-Insight-Evals mit gesetzten lokalen Credentials. Zehn erfolgreiche Läufe auf demselben fixierten Kandidaten sind Backend-Abnahmekriterium; Live-Antworten müssen an positive Generierung statt bloß an Testprozess-Exit gebunden sein. Keine Secrets in Ausgabe.

**Mobile manuell:** Physisches Android-Gerät/geeignetes Gerät mit 320/360 dp verfügbarer Breite und Font Scale 1,0/1,3; TalkBack, Safe Area, Android Back, Textumbruch und 48-dp-Aktionen nachweisen. Keine Emulatorinstallation oder neuer nativer Build im Plan.

**Story Acceptance:** Die 16 Kriterien der referenzierten Story sind maßgeblich. Plan-spezifische Freigabeschranke: QA beginnt erst nach dem vollständigen Backend-10/10-Handoff und Frontend-Handoff; jede relevante Backend-Korrektur startet die Zehnerserie neu.

## 12. Risks and Boundaries

- **Intent-Restkopplung:** Promptmodule und Validatoren enthalten derzeit starke Intent-Sonderregeln. QA prüft, dass kein Gewichtssignal Ernährung wieder exklusiv ausblendet und dass kein altes Beispiel-/Wortlautkriterium zur impliziten Geschäftsregel wird.
- **Geteilte Proteinlogik:** Die bestehende 2,2-g/kg-Hilfsfunktion wird auch außerhalb von Daily Insight verwendet. Keine globale Schwellenänderung ohne Caller-Regressionen; Daily-Insight-spezifische 2,5-g/kg-Klassifizierung bleibt lokal oder gezielt parametriert.
- **Cache-Identität:** Feld-/Promptänderungen müssen in derselben bestehenden Hash-/Manifest-/Release-Guard-Logik abgebildet werden. Keine spezielle Legacy-Invalidierung oder UI-Refreshaktion hinzufügen. Ein Cache darf jedoch kein Insight weiterverwenden, dessen relevante, bereits gehashte Fakten sich geändert haben.
- **Optionale Empfehlung:** Nicht erzwingen und nicht als positives Evalziel nutzen. Die harten Bedingungen für Mahlzeitenvollständigkeit und 300 kcal müssen dagegen serverseitig nicht umgehbar sein.
- **Uncommitted work:** Geänderte Backend-/KB-Dateien und die vorhandenen untracked Story-/Altplan-Dateien sind Nutzerarbeitsstand. Nicht überschreiben, löschen oder zurücksetzen; Änderungen lesen und gezielt integrieren.
- **API-Limit:** 5.000-Zeichenlimit erhöht gegenüber dem vorhandenen Validatorlimit; Mobile Detail muss den vollen erlaubten Text scrollen und darf ihn nicht still abschneiden.
- **Release:** Kein Deploy, keine Infrastrukturänderung und keine native Build-Entscheidung. Der Plan belegt keine Alpha-Bereitstellung.

## 13. Recommended Execution Order

1. Backend B-1.1: serverseitige Fakten-/Context-Regeln und Offline-Regressionen.
2. Backend B-1.2: Prompt/Validator/Evals/Manifest, zentrale KB und Backend-Gates; vollständige 10/10-Serie für den fixierten Kandidaten. Bei jedem Fehler korrigieren und die Serie neu starten.
3. Frontend F-1: bestehenden Vertrag in die Coaching-Karte integrieren, Detail-/Feedbackpfad erhalten, Tests und Geräteprüfung; Mobile-KB aktualisieren.
4. QA Q-1: unabhängige Abnahme aller Story-Kriterien und Nachweise. QA-Funde an zuständigen Agent zurückgeben; Backend-Fixes benötigen ein neues vollständiges 10/10-Gate.
5. Ein späterer Deploy-/Release-Auftrag bleibt außerhalb dieses Plans und erfordert gesonderte Autorisierung.

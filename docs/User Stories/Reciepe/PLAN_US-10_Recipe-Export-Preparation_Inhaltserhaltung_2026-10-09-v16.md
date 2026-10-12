# PLAN_US-10: Preparation-Inhaltserhaltung v16

Status: Revidierter Korrekturplan zur neuen ausdruecklichen Freigabe; keine Implementierung, Live-Ausfuehrung oder Deployment autorisiert.
Infrastructure Impact: Alpha
Mobile Build Impact: None

## Open Product Owner Decisions und Freigabegrenze

- PO-1 bleibt [Open, nicht blockierend]: genau `min(N,5)` oder maximal fuenf Exportgruppen. Dieser Plan behaelt die bestehende exakte Prompt-/Evalregel und alle Limits; keine Entscheidung oder Validatorerweiterung hierzu.
- Erforderliche neue Entscheidung: **APPROVE fuer ausschliesslichen Preparation-Systemprompt v2 im vorhandenen optionalen Zweig**, statt Importprompt plus Zusatz v1, und die in diesem Plan getrennte Pruefreihenfolge. Kein export-only Schema, neuer Generator, Endpunkt oder zweiter Call. Die v15-Freigabe gilt nicht fuer diese Revision.
- Bestehende Import-/Gesamt-Livegates werden NICHT erlassen. Sie blockieren weiterhin Paketabschluss/Merge-/Releasefreigabe, nicht die eng begrenzte Implementation und Befunderstellung. Ihre Reparatur benoetigt bei erneutem Scheitern einen eigenen Auftrag. Keine verdeckte Genehmigung zur Scopeausweitung.

## 1. Auftrag, Evidenz und falsifizierte Annahme

Nutzeranforderung wortgetreu: "bitte korrigierne, ich will dass das feature endlich funktioniert."

Classification: Accept with modifications. Ziel ist vollstaendiger Preparation-Export unter bestehenden Limits, kein weiterer allgemeiner Import-Stabilisierungsauftrag. KI bleibt fuer semantische deutsche Verdichtung erforderlich; Sourceidentitaet und Validierung bleiben deterministisch. Ausgabe bleibt ein transienter, ausdruecklich zu bestaetigender Vorschlag, keine Ernaehrungs- oder Garzeitneuerfindung.

Verbindliches Working Artifact ist der vollstaendig gelesene [v15-Plan](PLAN_US-10_Recipe-Export-Preparation_Gezielte-Korrektur_2026-10-09-v15.md). Ebenfalls vollstaendig gelesen: [B-1-Handoff](B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md), [Ausgangsdiff](B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt), [Enddiff](B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch), [Ruecknahmediff](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch) und [B-2-Handoff](B-2_Recipe-Preparation-v15_Handoff_2026-10-09.md). Diese Artefakte bleiben historisch unveraendert. v15 war laut konsolidiertem Workflow ausdruecklich APPROVE; B-1 abgeschlossen, B-2 Live FAIL, D-1/QA nicht gestartet, kein Deployment.

Historischer Fehler laut Nutzer: `recipes-prepare-export-view`, 422 um 12:48:42 UTC, operation_Id `a9f0b3adf10d2c4e2ab866d38d6b65ae`. Gespeicherte Orders 1..8, Export `[1],[2],[3],[4],[6,7]`; fehlen 5 (Reis separat kochen) und 8 (Servieren), erster Mismatch Position 5 / erwartet 5 / erhalten 6. Kein share-bundle-Aufruf. Originaltexte und deployed Revision unbekannt; keine neue Telemetrieabfrage oder historische Inhaltsreproduktion behauptet.

Belegter aktueller Restfehler ist ein anderer: Im ersten synthetischen v15-Livelauf wurden alle gespeicherten Quelltexte und IDs erhalten. Export `[1,2,3,4],[5],[6],[7],[8]`, genau fuenf Gruppen, Laengen 57/65/56/45/43. Gruppe 1 "Schneide das Haehnchen, wuerze es und brate es in Olivenoel." verliert Wuerfel, Salz/Pfeffer, Oelerhitzen/Pfanne, mittlere Hitze und 4 Minuten je Seite; Gruppe 7 verliert die Entnahme aus der Pfanne. Reis separat 12 Minuten in Salzwasser/Abgiessen, Hitze senken/weitere 6 Minuten und Servieren mit Reis sind erhalten. Exakte Unicode-Modelltexte stehen im B-2-Handoff; die Umschrift hier ist kein Originalmodellwortlaut.

**Falsifiziert ist die v15-Annahme, Sourcebindung plus allgemeiner Zusatz sei bereits eine ausreichende Inhaltskorrektur.** Sourcebindung funktioniert, Inhaltsverdichtung nicht. Ursache innerhalb des Modells bleibt unbekannt. Codebeleg: `openai.ts` waehlt tatsaechlich `RECIPE_ANALYZE_SYSTEM_PROMPT + RECIPE_PREPARATION_SYSTEM_ADDENDUM`, nicht Zusatz vor Importprompt wie in Plan/Handoff beschrieben. Der Importauftrag verlangt freie Extraktion und neue Formulierung, plant zuerst semantische Abschnitte und anschliessend deren Texte. Der Zusatz verbietet Reextraktion, aendert aber diese Gruppierungsstrategie nicht. Dass dieser konkurrierende Auftrag den Verlust verursacht, ist eine gezielt zu pruefende Hypothese, kein bewiesener Promptdominanzeffekt.

Billiger diskriminierender Check: bestehender SDK-Requesttest muss bei Preparation ausschliesslich den eigenstaendigen Prompt verlangen und am aktuellen zusammengesetzten Request scheitern; Importrequest bleibt exakt gleich. Der inhaltlich diskriminierende Check ist dieselbe unveraenderte Preparationfixture mit voller Rubrik am echten Handler-/Clientzweig, nicht Request-Red/Green allein. Offline existieren bereits zwei vollstaendige, fuenfgruppige Partitionen unter 90 Zeichen: `[1,2],[3,4],[5],[6,7],[8]` und `[1,2,3],[4],[5],[6,7],[8]`. Somit ist fuer diesen Fall keine Limitlockerung begruendet; keine dieser Partitionen wird als feste Produktionsgrenze vorgegeben.

Historische B-2-Gates: 293/293 fokussiert, 1406/1406 normale Vollsuite, Typecheck/Build/Diff Exit 0; Preparation 0/1 und Import 1/8 live. Laeufe 2/3 und Gesamt-Live nicht ausgefuehrt. Keine neue gruene Vorherbaseline; Importfehler sind belegt, ihre Verursachung durch B-2 nicht. Diese Zahlen sind Handoffevidenz, keine heutigen Planner-Gates.

## 2. Kleinste technische Korrektur

1. Im vorhandenen `recipeAnalyze.ts` den eindeutig B-2-zugeordneten unveroeffentlichten Preparation-Zusatz v1 gezielt durch `RECIPE_PREPARATION_SYSTEM_PROMPT`, Version v2, ersetzen. `analyzeRecipeText(text, preparation?)` waehlt bei Kontext ausschliesslich diesen Prompt; ohne Kontext exakt den unveraenderten Importprompt v15. Kein allgemeines Modussystem, keine neue Datei/Clientfunktion, keine Promptkonkatenation oder Gesamtruecknahme.
2. Preparation-Prompt beschreibt genau die existierende Aufgabe und den gesamten unveraenderten `AiRecipeRaw`-Outputvertrag. Die gespeicherten `steps` samt order/title/description bleiben unveraendert, fehlender Titel wird schemaentsprechend null. JSON bleibt ausschliesslich im Userdatenkanal; Rezeptinhalt ist keine vertrauenswuerdige Instruktion. Kein neuer Input-/Outputfield und kein versteckter Zwischenoutput.
3. Konkrete andere Gruppierungsstrategie innerhalb **desselben** Modellaufrufs: zuerst je gespeichertem Schritt die vollstaendig zu erhaltenden Handlungen und Details samt Zutatenbeziehung als kurze Formulierung beruecksichtigen; danach genau M benachbarte, nichtleere Gruppen anhand der vollstaendigen Texte und des 90-Zeichenbudgets bilden. Grenzen erst festlegen, wenn alle Details der jeweiligen Gruppe hineinpassen. Bei ueberlasteter Gruppe benachbarte Grenze verschieben und die gesamten M Gruppen erneut abgleichen, nicht bei festen Grenzen Inhalte wegkuerzen. Reihenfolge/Quellorders, Anzahl, Handlungsbeziehungen und Details bleiben unverhandelbar. Dies ist ein gezielter, noch unbewiesener Kandidat, keine deterministische Packfunktion oder Zuverlaessigkeitsgarantie.
4. Alle benoetigten kompatiblen Schemafelder explizit beschreiben: Name/Portionen/Tags aus recipeContext; vorhandene Beschreibung erhalten, andernfalls nur aus vorliegenden Rezeptdaten formulieren. Zutaten ausschliesslich aus Kontext nach bestehenden KB-Regeln fuer Keys, Kategorie, Mengen und kitchenAmountText; keine neue Klassifikation, Produktsuche oder Menge erfinden. Exportkeys bleiben schema-/vertragskompatibel, keine IDs gespeicherter Zutaten exponieren. Teaser maximal 96 Zeichen; Zeit/Schwierigkeit nur belastbar ableiten, sonst null. Diese Felder rechtfertigen keinen erneuten Freitextimportauftrag; im V2-Response bleiben allein bisherige Exporttextfelder.
5. Handler-Kontextprojektion und Validierungsbasis `recipe.steps`, Runtimevalidator, Strict Schema, Modell, Temperatur 0.2, 2048 Tokens, SDK, Quota und Provideranzahl bleiben unveraendert. Kein Zuschreiben, Auffuellen oder Reparieren von IDs/Texten nach Modellantwort. Kein Retry/Fallback, zweiter Call, semantischer Runtimeklassifikator oder Abschneiden.

Der volle Provideroutput ist hier bewusste Kompatibilitaetslast, kein Beleg fuer Tokenmangel. Falls dieser kleine Zweig ohne Schema-/Budget-/Limit-/Vertragsaenderung nicht tragfaehig ist: stoppen, konkrete neue Evidenz und exakt benoetigte Entscheidung vorlegen. Keine selbststaendige weitere Architektur oder Promptserie. Keine Erfolgszusage fuer beliebig lange gespeicherte Schritte (API erlaubt bis 2000 Zeichen je Schritt) bei insgesamt hoechstens 450 Exportzeichen.

Persistence Impact: None; keine Dokument-/Repository-/Containeraenderung, Migration oder neue Promptversion in Cosmos, keine Rueckfuellung in Dev/Alpha. Keine neuen Dependencies oder Mobile-/Shared-/Infraaenderungen. Alpha benoetigt nach erfolgreicher Abnahme/Merge einen separat ausdruecklich beauftragten Release; dieser Plan autorisiert keinen Deploy und keinen Build der Mobile-App.

## 3. Behalten, Ersetzen und Grenzen

- B-1 wird nicht wiederholt: Ruecknahmen der eindeutig v14-zugeordneten Promptversuche und Temperatur 0 bleiben; Import v15 und 0.2 bleiben. Drei vermischte ausgesetzte Importhunks bleiben unveraendert, weil der v13-vor-v14-Snapshot fehlt. Kein pauschales Restore/Revert.
- Gespeicherte Validierungsreferenz, sichere begrenzte numerische Diagnosen, B-1-Datenschutz ueber alle log/warn/error-Argumente, Countregel, bestehende Source-/Exportsemantikrubrik, 20 Detailmutationen/Semantikswap, alternative Partitionen und Boundarytests bleiben. IDs allein belegen keinen Textinhalt; Rubrik bleibt Testevidenz, kein allgemeiner Runtime-Semantikschutz.
- Gezielt ersetzt wird allein der B-2-Preparation-Zusatz und seine Requestauswahl samt eigenen Guards/Tests. Vor Edit aktuelle Ausgangsdiffs dokumentieren; fremde Dirty-Worktree-Aenderungen erhalten. Keine unbekannten Hunks als eigene Kandidaten behandeln.
- Out of Scope: Importstabilisierung, Renderer/Layout/Assets/Timeouttuning, share-bundle, DailyInsight-Reparatur, neue Ernaehrungsregeln, Quota/Auth/Persistenz, Produktlimits, historische Berichtsaenderungen und Registerpflege. Normale Vollsuite/Gesamt-Live sind Gates, keine Reparaturauftraege fuer diese Bereiche.
- KB-Konflikte: Rezeptdomain und API-Referenz sagen weiterhin "does not change the prompt"; AI-KB nennt v13 statt aktuellem Import v15/Preparation v1 und nur Teilsemantikdeckung. D-16 berichtigt nach tatsaechlichem Codeedit ausschliesslich diese betroffenen Aussagen, Versionen, Privacydiagnose und Evidenzgrenzen.

## 4. Akzeptanzkriterien

- AC-1 Requestisolation: SDK-Request-Red/Green belegt eigenstaendigen Preparation-v2-Systemprompt ohne Importpromptkoerper; JSON und gespeicherte Schritte bleiben unveraendert. Importrequest/Prompt v15 und Guards bleiben exakt kompatibel; kein neuer Vertrag oder Call.
- AC-2 Inhaltsfix: Echte Preparation der unveraenderten synthetischen Acht-Schritt-Fixture liefert innerhalb M=5 und 90 Zeichen je Gruppe alle Handlungen/Details 1..8 in genau ihren referenzierenden Texten: Wuerfel, Salz/Pfeffer, Oelerhitzen/Pfanne, mittlere Hitze, 4 Minuten je Seite, Reis separat 12 Minuten Salzwasser/Abgiessen, Hitze senken/weitere 6 Minuten, Entnehmen/zugedeckt/3 Minuten Ruhen, Servieren/Reis/Beilage. Ganze Rubrik pruefen; keine festen Gruppengrenzen oder Modellsaetze als Golden verlangen.
- AC-3 Kein Scheinfix: Den dokumentierten v15-Liveverlust als eindeutig synthetischen Offline-Negativfall mit originalen fuenf Gruppen hinzufuegen; struktureller Runtimecheck bleibt gruen, Inhaltsrubrik scheitert. Existierende zwei Positivpartitionen, Detailmutationen und Textswap bleiben wirksam. Kein semantischer Runtime-Schutz behauptet; keine Assertionlockerung oder Inputanpassung, um den Livefall gruen zu machen.
- AC-4 Fail-closed Invarianten: Exakter historischer numerischer Trace bleibt 422 mit source_step_coverage_mismatch und 5/5/6 gegen gespeicherte Orders, ohne Usage/Persistenz/Reparatur/Retry. Fehlende/doppelte/unbekannte/vertauschte Referenzen, Leertexte und Limits bleiben ungueltig. Auth vor Arbeit, optionales ETag vor Quota, 429/502, Strict Schema, ein Call, einmal Usage nur nach validem Erfolg, V2/Text-only/Transienz und Datenschutz erhalten.
- AC-5 Fokussierter Livebeleg: Drei vorab festgelegte aufeinanderfolgende vollstaendige Preparation-Laeufe desselben Kandidaten bestehen, jeweils ueber den realen prepareRecipeExportViewHandler und analyzeRecipeText mit genau einem SDK-Provideraufruf. Gespeicherte Fixture vor Aufruf, rohe generierte Zuordnung/Inhalt vor V2-Projektion und 200-Response samt Usage/Unveraendertheit pruefen. Source-/Exportsemantik und Counts getrennt berichten. Bei erstem Fehler stoppen, keine Ersatzlaeufe/Promptnachbesserung auf Verdacht.
- AC-6 Gateehrlichkeit: Fokussierte Units, normale Vollsuite, Typecheck/Build/Diff neu bestanden; acht unveraenderte Importfixtures und Gesamt-Livegate separat ausgefuehrt und ehrlich ausgewiesen. FAIL blockiert Abschluss/Release; Credentials/Exit 2/fehlende Ausfuehrung oder Live-Skips = UNVERIFIED, nie PASS. Preparation-PASS ist kein Import-/Gesamt-PASS und keine historische Reproduktion.
- AC-7 Herkunft und unabhaengige QA: Nur zugeordnete Preparationhunks ersetzt, v15-Behalten-/Ruecknahmebewertung erhalten. KB entspricht tatsaechlichem Code und beschreibt die Runtime-Semantikgrenze. QA prueft AC-1..7 und betroffene US-10 AC-15/16 unabhaengig; allgemeine Import-/v13/v14-Findings werden nicht geschlossen. Kein Deployment oder Registryedit in diesem Auftrag.

## 5. Arbeitspakete

### B-16 - Isolierte Preparationkorrektur und Evidenz
Agent: Backend
Goal: Ausschliesslich Abschnitt 2 implementieren. Vorher Preparationhunks gegen B-2 und aktuellen Diff abgrenzen. Bestehenden SDK-Test zuerst auf ausschliesslichen Preparationprompt verschaerfen (echtes Red), kleinen Request-/Promptedit, denselben Check sofort gruen. v2/Guard bewusst setzen; Import v15 nicht editieren. Bestehende Offline-Rubrik um exakt den synthetischen v15-Liveverlust ergaenzen. Preparation-Livefixture im vorhandenen Evalfile ueber realen Handler und Client fuehren; gespeichertes Rezept mit bestehenden Auth-/Request-Testhilfen und in-memory Repository aufbauen, lediglich Boundary-Fixtures/Quota kontrollieren, nicht Handler/Client/Validator oder Providerantwort mocken. Generierte Rohantwort testlokal durch delegierenden Spy erfassen, ohne zweiten Call/Produktionshook; weder Trace noch Detailrubrik durch V2-Projektion verlieren. Gatefolge Abschnitt 6 ausfuehren, dann auch bei FAIL/UNVERIFIED Befundhandoff liefern, kein Paket-PASS behaupten.
Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (Preparation V2)
- docs/kb/tech/08-testing.md
Required Repository Context:
- backend/src/lib/prompts/recipeAnalyze.ts
- backend/src/lib/openai.ts (RecipePreparationContext, analyzeRecipeText, RECIPE_ANALYZE_SCHEMA)
- backend/src/functions/recipes.ts (buildRecipePreparationContext, prepareRecipeExportViewHandler)
- backend/src/functions/ai.test.ts (SDK-/Importrequests)
- backend/src/functions/recipes.test.ts (Authhilfen, in-memory Fixture, V2, Trace, Privacy, Usage)
- backend/src/lib/recipeAnalyzeValidation.ts und backend/src/lib/recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.eval.test.ts und recipeAnalyze.eval.fixtures.ts
- backend/src/test-utils/ (nur vorhandene von recipes.test.ts verwendete Auth-/Requesthilfen)
- backend/package.json, backend/vitest.config.mts, backend/vitest.eval.config.mts, backend/scripts/run-eval.mjs
- docs/User Stories/Reciepe/B-2_Recipe-Preparation-v15_Handoff_2026-10-09.md
- docs/User Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md samt drei dort referenzierten Diffartefakten
- dieser Plan Abschnitte 1..4 und 6 als Aufgabenvertrag, aktueller fokussierter Worktree-Diff
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 (Hunkherkunft)
Dependencies: Neue ausdrueckliche v16-Freigabe; vorhandene B-1/B-2-v15-Handoffs. Keine nochmalige B-1-Ausfuehrung.
Expected Handoff: Repository-backed B-16-Handoff unter docs/User Stories/Reciepe mit Ausgangs-/Enddiff fuer eigene Hunks, Versionen, Red/Green, vollstaendiger synthetischer Aktionsmatrix und Gruppen/Laengen, Liveparameter/Callzahlen, Befehlen/Exitcodes je Gate, offenem Import-/Gesamtbefund und Runtimegrenze; keine privaten Texte/Secrets. Auch Fehlschlagsbefund ist ein vollstaendiger Handoff, keine Abnahme.
Recommended Execution Order: 1 nach neuer Freigabe; danach D-16, bei technischer Planinvaliditaet zuerst zurueck zum Planner.

### D-16 - Tatsaechlichen Stand eng dokumentieren
Agent: Backend
Goal: Nur vom B-16-Code betroffene KB-Aussagen korrigieren: JSON-Quelle, exklusiver Preparationprompt und beide Versionen, unveraenderter voller Providervertrag/Einmalaufruf, Text-only V2, gespeicherte Validierungsbasis, Privacydiagnose und fehlender allgemeiner Inhaltsvalidator. Live-FAIL/UNVERIFIED nicht als funktionierende Inhaltsgarantie dokumentieren. Nur bei tatsaechlicher Implementation anpassen; vorhandene Aussagen nicht pauschal bereinigen.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md (Transient Export-View Preparation)
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md (Preparationdiagnose)
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (Preparation)
Required Repository Context:
- B-16-Handoff und eigener Diff
- backend/src/lib/prompts/recipeAnalyze.ts, backend/src/lib/openai.ts, backend/src/functions/recipes.ts (nur geaenderter Vorbereitungspfad)
- dieser Plan Abschnitte 1..4 (Evidenzgrenzen)
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-7; AC-1, AC-4, AC-6 (Dokumentationsabgleich)
Dependencies: Vollstaendiger B-16-Handoff; bei fehlgeschlagenen Gates nur tatsaechlichen Code und offene Nachweise dokumentieren, keine Abnahme voraussetzen.
Expected Handoff: Enger KB-Diff und Code-/Versionsabgleich in repository-backed D-16-Handoff, offen gebliebene Gates explizit an QA; keine historischen Plan-/Report-/Story-/Registeredits.
Recommended Execution Order: 2, vor dokumentationspruefender QA.

### Q-16 - Unabhaengige Preparationabnahme
Agent: QA
Goal: Vollstaendigen v16-Plan und alle Handoffs gegen realen Code unabhaengig pruefen; Testrequestisolation, Rohtrace/Inhalt statt bloss IDs, gespeicherte Sourcebasis, Datenschutz, unveraenderte Importrequests und alle Gategrenzen nachvollziehen. Fokussierte Tests selbst ausfuehren; feste Dreierserie am Handlerzweig unabhaengig verifizieren, keine Zufallspasses sammeln. Pflichtgates nach Abschnitt 6 selbst pruefen, keine Herkunftskorrektur/Assertionlockerung/Implementierung. v15-AC-3/7-Fehler nicht durch Offline-PASS schliessen. FT-QA-2026-063 und allgemeine Findings getrennt behandeln; keine Registerpflege durch QA.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (Preparation V2)
- docs/kb/tech/08-testing.md
Required Repository Context:
- Vollstaendiger v16-Plan, B-16-/D-16-Handoffs samt eigenen Diffs
- docs/User Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md (AC-15/16)
- B-1-/B-2-v15-Handoffs und drei B-1-Diffartefakte aus Abschnitt 1
- backend/src/functions/recipes.ts, recipes.test.ts, ai.test.ts
- backend/src/lib/openai.ts, recipeAnalyzeValidation.ts, recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts, recipeAnalyze.eval.fixtures.ts
- backend/package.json, beide betroffenen Vitestconfigs, backend/scripts/run-eval.mjs
- docs/qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md und docs/qa/findings.md (nur FT-QA-2026-063, read-only)
Required Skills: azure-openai-feature-integration (Section 6 und references/implementation-checklist.md)
Relevant Acceptance Criteria: AC-1 bis AC-7; US-10 AC-15/16 ausschliesslich Preparation-Schrittvollstaendigkeit
Dependencies: Neue v16-Freigabe, vollstaendige B-16-/D-16-Handoffs; Gatefehler blockieren nicht unabhaengige Befundpruefung, aber PASS/Abschluss.
Expected Handoff: Report docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md im Format fittrack-qa-v1 mit genau einem Verdict, allen AC-Zeilen inklusive US-10 AC-15/16, Befehlen/Exitcodes, getrennten Verification Limits und strukturierten Findings; nichtleeres Manifest mit demselben Repositorypfad/Verdict. Keine Erfolgs-/Releasebehauptung bei offenem Pflichtgate, keine historische Reproduktion.
Recommended Execution Order: 3; danach Orchestratorentscheidung anhand Report, kein automatischer Deploy.

## 6. Prueffolge, Abschlussgrenzen und Recommended Execution Order

Alle folgenden Ausfuehrungen erst nach neuer Freigabe durch Backend bzw. QA. Planner hat keine Unit-/Live-/Buildgates ausgefuehrt.

1. B-16: Requestisolation Red -> minimaler Edit -> derselbe Check Green, danach `npx vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts` in backend. Bestehende Positivpartitionen/Mutationen, v15-Liveverlust-Negativfall, exakter 422 und Privacy erfassen.
2. B-16: In backend dreimal vorab festgelegt `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"`. Pro Lauf alle Preparationchecks, kein Import-/Gesamt-PASS aus bewusst abgewahlten Tests ableiten. Fixture unveraendert; realer Handler/Client/Provider, Rohoutput nur synthetisch, 200/Usage/kein Write und komplette 1..8-Inhaltsmatrix. Bei erstem FAIL stoppen, Bericht liefern; keine automatische Korrekturschleife. Diese endliche Stichprobe ist keine allgemeine Garantie.
3. B-16: Danach separat einmal `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` (acht unveraenderte Imports plus Preparation/Guards) und `npm run test:eval` als weiterhin verpflichtendes Skill-Gesamtgate. Fehlende Credentials = UNVERIFIED. Import-/fremde Evalfehler nicht reparieren, nicht weglassen; Befund erhaelt FAIL/offenes Gate. Anders als v15 ist der Preparation-Dreiernachweis bewusst zuerst isoliert, damit vorhandene Importfehler ihn nicht verdecken. Kein Gate wird damit abgesenkt.
4. B-16: `npx vitest run`, `npm run typecheck`, `npm run build:verify` in backend und `git diff --check` am Root, jeweils normal ohne Timeout-/Skip-/Assertionlockerung. Auch bei Live-FAIL Offlinegates ausfuehren und Befundhandoff liefern. Manueller eigener Diff-/Secret-/Provenienzreview. Keine neuen Cosmos-/Mobile-/Bildgates ohne entsprechenden Eingriff.
5. D-16: Tatsaechlichen Stand und verbleibende Nachweisluecken in betroffener KB abgleichen; dann Q-16 unabhaengig in derselben fokussierten Pruefreihenfolge. Eigene Dreierserie nur fuer denselben eingefrorenen Kandidaten, kein Ersatz fuer einen dokumentierten Fehlschlag.
6. Jeder Schritt bleibt sequenziell: **neues APPROVE -> B-16 -> D-16 -> Q-16**. Reale Planinvaliditaet (z.B. unumgaengliches neues Schema oder unmoegliche Darstellung) stoppt Implementation und verlangt neue Entscheidung. Bei Gate-FAIL kann QA den begrenzten Fix bewerten, aber nicht alle AC als bestanden oder das Paket als abgeschlossen markieren. Separate Import-/Gesamtgateklaerung bleibt Voraussetzung fuer Merge/Release; kein abgeschlossener Featurefix allein aufgrund von Preparation-PASS.
7. Privates Originalrezept bleibt MANUAL VALIDATION REQUIRED, solange Originaldaten/Revision fehlen. Eine spaetere autorisierte private Preparationpruefung darf keine Inhalte ins Repository/Logging uebernehmen. Kein share-bundle-/Renderer-/Alpha-Erfolg wird aus synthetischen Checks abgeleitet. Nach vollstaendiger Abnahme/Merge separat beauftragter Alpha-Deploy, ausserhalb dieses Plans.

Planartefaktpruefung dient nur der Vollstaendigkeit dieses Handoffs, nicht als Implementierungs- oder QA-Nachweis. Kein anderer Plan, Code, Test, KB-Eintrag oder Register wird vom Planner geaendert.
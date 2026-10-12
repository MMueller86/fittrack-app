# PLAN_US-10: Recipe-Analyze-Schrittvollstaendigkeit - Korrektur v14

Status: Entwurf zur Freigabe; ausschliesslich Planung, keine Umsetzung oder erneute QA autorisiert.
Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Auftrag und Freigabe

Nutzeranforderung wortgetreu:

> Die erneute QA ist gelaufen, aber der v13-Plan hat **FAIL**. Der vollstaendige Bericht steht hier: v13-QA-Bericht.
>
> Erstelle einen Plan den Fehler zu korrigieren.

Verbindliche Quellen:
- [Vorgaengerplan v13](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md).
- [Vollstaendiger v13-QA-Bericht](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md).
- [US-10](US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md), AC-15 und AC-16.

Die freie Folgeversion v14 ersetzt nach ausdruecklicher Freigabe nur den Korrektur-/Pruefauftrag dieses Schrittvollstaendigkeitsplans. V13-Anforderungen bleiben verbindlich; historische Plaene, User Story, v12-/v13-Berichte und QA-Register bleiben bei dieser Planung unveraendert. Eine fruehere v13-Freigabe ist keine v14-Umsetzungsfreigabe. Kein Deployment ist autorisiert.

Open Product Owner Decisions: None fuer die vorgeschlagene Korrektur. Erforderlich ist die ausdrueckliche Planfreigabe. Falls die unveraenderten Textlimits trotz Promptkorrektur nicht erfuellbar sind oder eine breitere technische Aenderung erforderlich wird, stoppen und einen gesonderten Entscheidungsauftrag vorlegen; keine Limits, Retry-Strategie oder Produktregeln eigenmaechtig aendern.

## 2. Requirement Assessment

Classification: Accept as proposed. Der Nutzer benoetigt einen gezielten Korrekturplan, keine neue Exportfunktion. Der kleinste belegte Ansatz ist: Inhaltslogging zuruecknehmen, vorhandene Semantikassertionen vervollstaendigen, denselben Analyzer stabilisieren und das offene Vollsuite-Gate nachweisen. Menschliche Pruefung, Transienz und fail-closed Servervalidierung bleiben erhalten. Verlorene Garzeiten, Hitzeangaben oder Wendepunkte koennen Zubereitungshinweise verfaelschen; es werden keine neuen fachlichen Garregeln erfunden.

AI assessment:
- AI necessity: Die bestehende sprachliche Rezeptverdichtung bleibt beim vorhandenen KI-Aufruf; deterministische Trace- und Grenzpruefungen bleiben serverseitig. Kein neues KI-Feature.
- Advisory: Vorschlag zur expliziten Nutzerpruefung; keine automatische Speicherung.
- Failure contract: Bestehende 422-Validierung, 429-Quota und 502-Provider-/Parsefehler bleiben unveraendert.
- AiFeature: `recipe-analyze`; Quota vor Aufruf, Nutzung nur nach gueltigem Erfolg.
- Prompt: Bestehendes Modul ueberarbeiten; semantische Korrektur als Prompt v14, kein neues Modul.
- Structured Output: Unveraendertes Schema, `strict: true` und `additionalProperties: false`; keine API-/Typaenderung.

## 3. Bestaetigte Findings und lokaler Kontext

| Finding aus v13 | Befund | Gezielte Massnahme |
|---|---|---|
| RECIPE-ANALYZE-LIVE-TRACE-001 | Drei fokussierte Live-Laeufe gescheitert; `explicit-quantities-with-unit-conversion` wiederholt `[1,2,3,4,5,5]`; weitere Fehler variieren, u.a. leerer Exporttext. | Bestehenden gemeinsamen Prompt zur eindeutigen Gruppenzuordnung korrigieren; alle acht unveraenderten Live-Fixtures wiederholt pruefen. |
| RECIPE-ANALYZE-STEP-COVERAGE-001 | Acht Quellorders werden gezaehlt, aber nur Quellschritte 1/8 semantisch geprueft; Details fehlen als Nachweis. | Bestehende Assertionstypen fuer jeden Quellschritt und seine zugeordnete Exportgruppe nutzen; Detailverlust gezielt negativ testen. |
| RECIPE-ANALYZE-LOGGING-SCOPE-001 | Handler loggt bei Coverage-Fehlern privaten Input und generierte Schritte, je bis 16.000 Zeichen; Test verlangt dies. | Inhaltslogging samt ausschliesslich dafuer benoetigten Hilfen entfernen; negative Datenschutzassertionen und KB-Korrektur. |
| BACKEND-UNIT-SUITE-TIMEOUT-001 | Normale Vollsuite: 1.285/1.287; zwei 30-s-Timeouts, isolierte Dateien bestanden. | Vollsuite unter Normalaufruf diagnostizieren; nur belegte lokale Testkosten beheben, keine Renderer-Neugestaltung. |

Enge Repository-Pruefung bestaetigt:
- `recipeAnalyze.ts` und Eval-Guard sind v13. Prompt fordert bereits getrennte Listen, genau `min(N, 5)` Exportgruppen und lueckenlose Partition. Eine weitere allgemeine Erhaltungsregel allein ist kein belegter Fix.
- `recipeAnalyze.eval.fixtures.ts`: acht nummerierte Anweisungen; semantische Source-/Exportassertionen derzeit ausschliesslich fuer 1 und 8. `recipeAnalyze.eval.test.ts` prueft flache Trace-Gleichheit und Grenzen, aber nicht ausdruecklich die genaue Exportzahl oder alle Exportorders.
- `analyzeRecipeText()` in `openai.ts` verwendet `temperature: 0.2`, `max_tokens: 2048`, Strict Structured Outputs und einen Aufruf. Daraus folgt weder eine bestaetigte Temperaturursache noch ein belegtes Tokenproblem.
- `recipes.ts`: `validationContext` enthaelt `recipe_input_text`; `validationOutput` enthaelt JSON mit Source-/Exportbeschreibungen. Sichere Phase/Code/Pfad- und numerische Trace-Diagnosen existieren bereits separat.
- Vorbereitung validiert gegen gespeicherte Rezeptschritte, nicht gegen re-extrahierte Analyzer-Schritte. Dies bleibt verbindlich; Neuerstellung verwendet den vollstaendigen Analyze-Validator.
- `highlight.test.ts` rendert und dekodiert Vergleichsbilder; `tags.test.ts` rendert drei Varianten in einem Test. `vitest.config.mts` setzt 30 Sekunden. Lastempfindlichkeit ist plausibel, die Ursache aber nicht bewiesen.
- Bekanntes `FT-QA-2026-063` ist weiterhin `In progress`; nicht schliessen und keine neuen Register-IDs erfinden. V13-Report-Keys sind die Referenzen dieser Folgekorrektur.

Discriminating checks fuer die Umsetzung: exakter Duplikattrace als deterministischer Negativfall; Entfernung eines Details bei unveraenderter Anzahl/Trace muss die Semantikassertion scheitern lassen; private Marker duerfen bei 422 in keinem erfassten Log auftauchen; nur der normale Vollsuite-Aufruf entscheidet das Timeout-Gate. Diese Checks wurden vom Planner nicht ausgefuehrt.

## 4. Zielverhalten, Scope und Grenzen

Unveraendert: Explizit nummerierte Eingabe hat genau einen semantisch passenden Quellschritt je Anweisung, lueckenlos 1-basiert und geordnet. Keine Fuenferbegrenzung der Quellliste. Export gruppiert ausschliesslich benachbarte Schritte, gemaess vorhandenem v13-Prompt genau `min(N, 5)` Gruppen, maximal fuenf Schritte mit je 1-90 Zeichen. Alle Sourceorders erscheinen genau einmal in Reihenfolge; Handlungen, Zutatenbeziehungen, vorhandene Zeiten/Hitze/Temperaturen, Wendepunkte, Beilagen und Servieren bleiben lesbar.

In Scope: gemeinsamer Recipe-Analyze-Prompt/Version und bestehende Eval-Fixtures/-Tests; begrenzte Handler-Logging-Ruecknahme und Regressionstests; Diagnose des Pflicht-Vollsuite-Gates und evidenzbasierte lokale Testoptimierung; sachlich betroffene KB-Passagen vor QA.

Out of Scope: neue API-/Structured-Output-Felder, Mobile, Shared, Cosmos/Datenmodell/Migration, Bicep/Ressourcen, Renderer-Produktionsverhalten und Assets, Share Bundle, bestaetigte Exportansichten, US-10 AC-11-Korrektur, andere Daily-Insight-Fehler, Quota-/Auth-/Bestaetigungsregeln, zweiter KI-Aufruf, automatische Reparatur/Retry, deterministisches Umschreiben oder Fallback, neue Inhaltslogs/Retention-Aenderung. Keine allgemeine Suite-Timeout-Erhoehung, Test-Skips, entfernten Assertions oder reduzierte Pflichtsuite.

Persistence Impact: None; keine Repository-/Cosmos-Aenderung, keine Migration oder Rueckfuellung in Dev/Alpha. Kein Cosmos-Skill erforderlich.

Infrastructure and Release: Keine Infrastruktur-/Konfigurations-/Paketinstallation erforderlich. Backendkorrektur muss spaeter Alpha erreichen; erst nach Freigabe, erfolgreicher QA und Merge durch separat explizit beauftragtes `Deploy to Alpha`. Kein Architektur-/Infrastructure-Arbeitspaket und kein nativer Mobile-Build. Dev-Verifikation erfolgt im bestehenden Backend-Setup.

## 5. Annahmen, Divergenzen und ungepruefte Bereiche

- Annahme: Promptkorrektur und lokale Testkostenkorrektur reichen innerhalb des bestehenden Vertrags. Live-Stabilitaet ist noch nicht nachgewiesen; drei erfolgreiche Laeufe sind ein endliches Gate, keine allgemeine Zuverlaessigkeitsgarantie.
- Der Vorgaengerplan nennt QA ausstehend und erfolgreiche Backend-Ergebnisse; der vollstaendige v13-Bericht belegt inzwischen FAIL. Register-Evidence behauptet noch, es gebe keinen v13-Bericht; Decision nennt bereits v13-FAIL. Historische Statusaussagen sind keine aktuelle Freigabe-/Erfolgsevidenz.
- `docs/kb/tech/02-backend.md` beschreibt Inhaltslogging/30-Tage-Retention als aktuellen Stand. Das entspricht dem Handler, widerspricht aber der genehmigten Scope-Grenze; nach Ruecknahme korrigieren, keine Retention-Infrastruktur aendern.
- Die AI-KB benennt korrekt v13 und nur die zwei vorhandenen Semantikpruefungen. Kuenftig Version und tatsaechlich erweiterte Pruefdeckung aktualisieren; keine heutigen Zuverlaessigkeitsbehauptungen aus Promptregeln ableiten.
- Fixture-Kommentare leiten bestehende Klassifikationsannahmen teilweise vom Prompt ab. Fuer die hier ergaenzten Schrittassertionen sind US-10 AC-15/16, Rezeptregeln und synthetischer Input die Grundlage; keine scopefremde Klassifikationsneufassung.
- US-10 enthaelt noch aeltere Ausloese-/Bestaetigungsbeschreibungen gegenueber dem aktuellen Share-/V2-KB-Verhalten. Dieser Plan aendert nur AC-15/16; bestehender Handlervertrag/KB bleiben fuer Ausloesung und Transienz Referenz. Story nicht umschreiben und den Konflikt nicht als neue Produktentscheidung behandeln.
- Ungeprueft: neue Live-Laeufe, Timeout-Reproduktion/Ursache, CI-Laufzeiten, Alpha-Laufzeit, historische Telemetriedaten oder tatsaechliche Retention. Keine Aussage ueber Loeschbedarf oder bereits erfolgten Datenabfluss; keine Telemetrieabfrage/Loeschaktion im Korrekturauftrag. Ein etwaiger Datenschutz-Folgeprozess bedarf eigener Beauftragung.

## 6. Akzeptanzkriterien

1. **AC-1 Version/Kompatibilitaet:** Semantisch korrigierter Prompt und bewusster Eval-Guard verwenden v14; beide AI-KB-Referenzen stimmen ueberein. Schema, API, fuenf/90-Limits und alle weiter geltenden v13-Regeln bleiben erhalten; genau `min(N, 5)` Exportgruppen und Exportorders 1..M werden in der Eval explizit geprueft.
2. **AC-2 Quellsemantik:** Die unveraenderte achtteilige Fixture liefert genau acht geordnete Sourceeintraege. Jede Anweisung 1..8 besitzt eigene Aktions-/Zutatenassertionen: Kartoffeln kochen/abgiessen (18 min), Bohnen garen/abgiessen (8 min), Haehnchen salzen/pfeffern, Oel in Pfanne erhitzen, Haehnchen bei mittlerer Hitze 4 min je Seite braten, Hitze reduzieren/weitere 6 min garen, entnehmen/zugedeckt 3 min ruhen, aufschneiden/mit Kartoffeln als Beilage und Bohnen servieren.
3. **AC-3 Exportsemantik:** Dieselben vorhandenen Details sind in der jeweils `sourceStepOrder` referenzierenden Exportbeschreibung nachgewiesen; blosses Auftauchen anderswo reicht nicht. Je-Seite-/Wende-, Reduktions-, Ruhe- und Servierbeziehungen bleiben erhalten. Keine numerische Temperatur erfinden: die Fixture enthaelt qualitative Hitze. Entfernte oder vertauschte Handlung/Zutatenbeziehung/Zeit/Hitze/Wendepunkt laesst gezielte Negativproben trotz korrekter Counts/Trace scheitern. Keine exakten Saetze oder Gruppengrenzen erzwingen.
4. **AC-4 Trace/Live:** Alle acht bestehenden Live-Fixtures bestehen drei unmittelbar aufeinanderfolgende vollstaendige fokussierte Laeufe, ohne selektive Wiederholung/Assertionslockerung. Exakt `[1,2,3,4,5,5]` gegen Source 1..5 sowie fehlende, unbekannte oder umgeordnete Referenzen bleiben deterministisch ungueltig; leerer Exporttext bleibt ungueltig. Erfolgsfall angrenzender Gruppen besteht. Kein Trace wird nachtraeglich repariert.
5. **AC-5 Datenschutz:** Bei Coverage-422 werden weder Rezeptname/-beschreibung/-zutaten/-schritte noch generierte Source-/Exporttexte oder private Fehlermeldungen geloggt, auch nicht gekuerzt/serialisiert. Bestehende sichere Fehlercodes/Pfade/numerische Trace-Diagnosen bleiben verfuegbar; keine neuen Inhaltsereignisse. Erfasste Handlerlogs enthalten keine synthetischen privaten Marker; geaenderte KB beschreibt diesen Stand.
6. **AC-6 Handlerinvarianten:** Vorbereitung prueft gespeicherte Sourceorders; Import behaelt volle Analyze-Validierung. Unveraenderte 422/429/502-Vertraege, Auth-/Quota-Reihenfolge, ein KI-Aufruf, Nutzung nur einmal nach gueltigem Erfolg und keine Persistenz sind durch bestehende/gezielt ergaenzte Tests nachgewiesen.
7. **AC-7 Vollsuite:** `npx vitest run` im Backend besteht unter normalem Aufruf, ohne Skips, Assertionverlust oder pauschale Timeout-Erhoehung. Isolierte Highlight-/Tags-Ergebnisse sind nur Diagnose. Bei Aenderungen dieser Tests bleiben Render-, Bildvergleichs-, Chipzahl- und Layoutassertionen gleichwertig; Ursache/Massnahme und Laufzeiten sind dokumentiert.
8. **AC-8 Restgates/QA:** Fokussierte Unit-Tests, Typecheck, Build-Verifikation und Diff-/Dokumentationspruefung bestehen. Gesamt-Live-Eval wird ausgefuehrt und gemaess Skill muss vor Abschluss bestehen; fremde Daily-Insight-Fehler separat ausweisen, nicht hier beheben oder als Erfolg umdeuten. Fehlende Credentials/ausgelassene Live-Pruefungen sind `UNVERIFIED`, kein PASS. QA weist alle ACs und vier Findings separat nach; historische Evidenz bleibt unveraendert, FT-QA-2026-063 bleibt bis verifiziertem Abschluss offen.

## 7. Ausfuehrbare Agent-Arbeitspakete

### B-1 - Inhaltslogging zuruecknehmen
Agent: Backend
Goal: Nur unfreigegebenes Input-/Output-Logging und ausschliesslich dazu benoetigte Hilfen entfernen; bestehenden Positiv-Loggingtest in negative Datenschutzregression umstellen. Marker fuer Rezeptmetadaten, Zutaten, gespeicherte/re-extrahierte Schritte, Exporttext und Fehlertext bei Coverage-422 einsetzen; alle erfassten Logs pruefen. Sichere Diagnose-/HTTP-Funktion erhalten.
Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/domain/06-recipes.md`
Required Repository Context:
- `backend/src/functions/recipes.ts` (Preparation und Diagnosehilfen)
- `backend/src/functions/recipes.test.ts` (Coverage-Logging und V2-Fehlerpfade)
- `backend/src/lib/recipeAnalyzeValidation.ts` und `backend/src/lib/recipeAnalyzeValidation.test.ts`
- v13-QA-Bericht, Finding RECIPE-ANALYZE-LOGGING-SCOPE-001
Required Skills: None
Relevant Acceptance Criteria: AC-5, AC-6
Dependencies: ausdrueckliche v14-Freigabe
Expected Handoff: eng begrenzter Logging-Diff, Red/Green-Datenschutztest, erfolgreiche fokussierte Handler-/Validatortests; sichere verbleibende Logfelder und entfernte KB-Aussage fuer D-1.

### B-2 - Schrittpruefdeckung und Promptstabilisierung
Agent: Backend
Goal: Vor Promptaenderung Semantik-Rubrik fuer alle acht Anweisungen aus Input/US-10 vervollstaendigen und mit gezielten Verlust-/Vertauschungsproben validieren. Vorhandene Fixture-Assertionstypen wiederverwenden; Assertions in bestehenden Tests offline pruefbar machen, keine neue Testframework-Abstraktion. Bestehende acht Fixtureinputs und Klassifikations-/Mengenconstraints erhalten. Exakten Duplikattrace als Unit-Negativregression und gueltige angrenzende Gruppierung aufnehmen.

Promptkorrektur auf die eindeutige Source-/Exportzuordnung konzentrieren, insbesondere mehrere Aktionen innerhalb eines Sourceeintrags nicht durch einen zusaetzlichen Export mit wiederholter Order abbilden. V14 bewusst setzen. Alle Fixtures mit unveraenderten Providerparametern zuerst pruefen. Nur falls dabei begruendete Evidenz vorliegt, Recipe-Analyze-lokal `temperature: 0` als begrenzten Stabilisierungsschritt pruefen und Requestassertion/Handoff ergaenzen; kein globaler Client-/Modell-/Tokenwechsel. Weder Temperatur noch weitere Promptsaetze gelten ohne bestandene Gates als Loesung. Kein retry-until-green; Fehlschlaege dokumentieren, Ursache lokal untersuchen und nach inhaltlicher Korrektur den vollstaendigen Dreiernachweis neu beginnen. Bei weiterhin unzureichender Stabilitaet stoppen und Restbefund zur Entscheidung uebergeben.
Required Knowledge Base:
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
Required Repository Context:
- `backend/src/lib/prompts/recipeAnalyze.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
- `backend/src/lib/openai.ts` (nur analyzeRecipeText und Schema)
- `backend/src/lib/recipeAnalyzeValidation.ts` und `.test.ts`
- `backend/src/functions/ai.test.ts` (Recipe-Analyze-Provider/Validator/Handler-Tests)
- US-10 AC-15/16, v13-QA-Trace-/Coverage-Findings
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1, AC-2, AC-3, AC-4, AC-6
Dependencies: B-1-Handoff
Expected Handoff: Prompt v14, alle acht re-reviewten Constraints, Source-/Exportsemantikmatrix 1..8, Red/Green-Verlustproben, Trace-/Grenzregressionen, drei vollstaendige fokussierte Live-Ergebnisse mit Fixtureanzahl und Parametern; keine privaten Nutzerrezepte/Secrets als Artefakte.

### B-3 - Vollsuite-Gate diagnostizieren und schliessen
Agent: Backend
Goal: Normale Vollsuite reproduzieren und Laufzeiten/Fehler gegen isolierte Highlight-/Tags-Laeufe vergleichen. Falls reproduzierbar, zuerst vermeidbare wiederholte Render-/Decode-Arbeit in diesen beiden Tests mit unveraenderter Assertiondeckung begrenzen. Nur eine durch Messungen begruendete lokale Testaenderung; keine behauptete Lastursache ohne Evidenz. Besteht die normale Suite ohne Codeaenderung, Ergebnis und Umgebungsunterschied dokumentieren statt einen Fix zu erfinden. Falls die Ursache globale Runner-/Produktionsaenderungen erfordert, gesonderte Freigabe einholen.
Required Knowledge Base: `docs/kb/tech/08-testing.md`
Required Repository Context:
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/tags.test.ts`
- `backend/vitest.config.mts`
- `backend/package.json`
- v13-QA-Bericht, Finding BACKEND-UNIT-SUITE-TIMEOUT-001
Required Skills: None
Relevant Acceptance Criteria: AC-7, AC-8
Dependencies: B-2-Handoff
Expected Handoff: belegte Ursache oder explizit nicht reproduzierter Befund, minimaler Testdiff falls erforderlich, unveraenderte Pruefdeckung, normaler Vollsuite-PASS samt Laufzeiten und Exitcode; keine isolierten Ersatzgates.

### D-1 - Betroffene Knowledge Base angleichen
Agent: Backend
Goal: Nach Implementierung die v14-Promptidentitaet und tatsaechliche Semantikpruefdeckung in beiden AI-Dokumenten aktualisieren; in Backend-KB Inhaltslogging-/Retention-Passage entfernen und sichere verbleibende Diagnosen korrekt beschreiben. Keine Erfolgsgarantie oder neue Privacy-Policy behaupten. Historische Plaene/Story/Berichte und QA-Register nicht bearbeiten.
Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
Required Repository Context: B-1/B-2/B-3-Handoffs und deren betroffene Diffs; dieser Plan, Abschnitt 5
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1, AC-5, AC-8
Dependencies: B-3-Handoff
Expected Handoff: drei eng begrenzte KB-Korrekturen, Dokumentations-/Implementierungsabgleich und konsolidierte Gate-Evidenz an QA. Diese Aenderungen sind erst nach Planfreigabe vom Backend vorzunehmen, nicht durch den Planner.

### Q-1 - Unabhaengige Korrektur-QA
Agent: QA
Goal: Alle acht ACs und vier v13-Findings unabhaengig pruefen; Azure-OpenAI-QA-Checklist nur fuer betroffene Invarianten anwenden. Keine Implementierungsreparatur durch QA. Frischen Bericht erstellen; historische Berichte nicht ueberschreiben und FT-QA-2026-063 nicht allein aufgrund Backend-Handoff schliessen. Registerpflege bleibt dem normalen separat autorisierten QA-Prozess vorbehalten.
Required Knowledge Base:
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
Required Repository Context:
- dieser Plan und v13-QA-Bericht
- `docs/qa/findings.md` (nur FT-QA-2026-063-Kontext)
- konsolidierte B-1/B-2/B-3/D-1-Handoffs und betroffene Diffs
- die in B-1/B-2/B-3 genannten Tests sowie `backend/src/functions/ai.ts` (Analyze-Handlerinvarianten)
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1 bis AC-8; US-10 AC-15 und AC-16
Dependencies: ausdrueckliche v14-Freigabe und D-1-Handoff; keine vorgezogene QA
Expected Handoff: eigener Verdict, AC-/Finding-Matrix mit Befehlen/Exitcodes, drei fokussierte Live-Laeufe, Vollsuite/Restgates, getrennte fremde Evalfehler und UNVERIFIED-Gates; keine Deployment-Freigabe ableiten.

## 8. Fokussierte Regressionen und Pflichtbefehle

Alle nachfolgenden Ausfuehrungen sind erst nach Freigabe Aufgaben von Backend/QA. Windows: Arbeitsverzeichnis `backend` verwenden; Befehle einzeln ausfuehren, kein `&&` voraussetzen.

1. Red/Green in bestehenden Tests: Duplikattrace `[1,2,3,4,5,5]`, fehlende/umgeordnete/unbekannte Orders, leerer Exporttext sowie gueltige angrenzende Gruppen. Semantikverlust bei korrektem Trace/Counts fuer jeden Quellschritt und repräsentative Beziehung/Zeit/Hitze/Wende nachweisen. Handler-422 mit privaten Markern darf keine Inhalte loggen; gespeicherte Schrittquelle, Quota und Single-Call beibehalten.
2. `npx vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts` plus bestehende Datei mit den offline Semantik-Negativproben, falls diese dort nicht enthalten sind. Der Promptguard wird zusaetzlich durch das Live-Gate geprueft; ein unter Unit-Konfiguration ausgeschlossenes Evalfile ist kein Semantiknachweis.
3. `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` dreimal unmittelbar nacheinander: jeweils acht Live-Fixtures plus Versionsguard ausweisen, keine Skips/Selektionsfilter, alle Assertions bestehen. Fehler vor Korrektur als Ausgangsevidenz behalten, nicht durch spaetere Zufallspasses verschweigen.
4. Diagnose bei Bedarf: `npx vitest run src/lib/instagramRenderer/__tests__/highlight.test.ts` und `npx vitest run src/lib/instagramRenderer/__tests__/tags.test.ts`; danach zwingend `npx vitest run` ohne Filter/erleichterte CLI-Konfiguration. Vollsuite-Erfolg ist obligatorisch.
5. `npm run test:eval` als weiterhin erforderliches Gesamt-Live-Gate. Daily-Insight-Faelle `likely-completed-activity`/`protein-nearly-complete` waren im v13-Bericht fremde Fehler; keine Reparatur in diesem Plan. Bei erneutem Fehler separat eskalieren: Recipe-Analyze-Ergebnis differenzieren, Gesamtgate bleibt offen und verhindert vollstaendigen Abschluss gemaess Skill.
6. `npm run typecheck`, `npm run build:verify`; am Repository-Root `git diff --check`. Betroffene KB/Versionsguard, fehlendes Inhaltslogging, keine Secrets und unveraenderte historischen Artefakte pruefen. Credentials niemals ausgeben; Exitcode 2 des Evalrunners/fehlende Live-Credentials bedeutet UNVERIFIED.

## 9. Recommended Execution Order

1. Nutzer erteilt ausdrueckliche v14-Freigabe; bis dahin nur dieses Planartefakt.
2. B-1 Logging-Ruecknahme und Datenschutzregression.
3. B-2 vollstaendige Semantikpruefdeckung, Prompt v14 und fokussierte Stabilisierung.
4. B-3 normales Vollsuite-Gate, anschliessend konsolidierte Restgate-Ergebnisse.
5. D-1 KB-Aktualisierung vor dokumentationspruefender QA.
6. Q-1 unabhaengige QA aller Findings/ACs; bei FAIL oder UNVERIFIED kein abgeschlossener Korrekturauftrag.
7. Erst nach erfolgreicher Abnahme/Merge separater expliziter Alpha-Deploy-Auftrag. Keine Infrastruktur zuerst erforderlich, da keine Ressourcen-/Bicep-Aenderung geplant.
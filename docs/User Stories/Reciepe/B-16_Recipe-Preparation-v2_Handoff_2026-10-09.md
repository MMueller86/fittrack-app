# B-16 Recipe Preparation v2 Handoff

Datum: 2026-10-09. Freigabe: ausdrueckliches Nutzer-APPROVE fuer v16 B-16.
Status: FAIL. Kandidat implementiert, Requestisolation und Offlinegates bestanden; Inhaltsfix und Dreiernachweis NICHT erbracht. Kein Paket-PASS, keine Abnahme, keine Merge-/Releasefreigabe.
Scope: ausschliesslich B-16. Kein D-16, KB-/QA-/Registeredit, Deployment oder fremder Reparaturauftrag.

## Herkunft und eigener Ausgangs-/Enddiff

Vor dem ersten Edit: aktueller fokussierter git diff und git diff --stat gelesen; 14 bereits geaenderte tracked Dateien, 1025 insertions / 58 deletions. Das war keine gruene neue Baseline. Vorhandene untracked B-1/B-2-Handoffs, Plaene und QA-Berichte wurden erhalten.

Gelesene Herkunftsevidenz: [B-2 v15](B-2_Recipe-Preparation-v15_Handoff_2026-10-09.md), [B-1 v15](B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md), dessen [Ausgangsdiff](B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt), [Enddiff](B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch) und [Ruecknahmediff](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch). v16 Abschnitte 1..4/6 und das explizite Task Package waren der Aufgabenvertrag. Keine Wiederholung von B-1.

Der [eigene vollstaendige Diff](B-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch) enthaelt beide Seiten aller B-16-Hunks: Minus = unmittelbar vor B-16 erfasster Stand, Plus = finaler Stand. Er ist NICHT der gesamte HEAD-gegen-Worktree-Diff. Er erlaubt zusammen mit dem aktuellen Sourcebestand die Rekonstruktion des Ausgangsstands ohne externe Sitzungsdateien. Alle fuenf Abschnitte wurden exakt mit den aus den vor Edit erfassten UTF-8-/LF-Inhalten abgeleiteten Diffs verglichen; git apply --reverse --check bestand ohne Anwendung. Dateireihenfolge ist fuer den Vergleich irrelevant.

SHA-256 des eigenen Diffartefakts: FA5F46B93F88C229C2A7DC8765A89D55B335BFFA5E01F09E993320917E736163.

| Datei / eigener Hunk | Ausgang | Ende |
|---|---|---|
| [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | B-2-Zusatz v1 hinter Importprompt im SDK-Request | Exklusiver RECIPE_PREPARATION_SYSTEM_PROMPT v2, voller unveraenderter AiRecipeRaw-Vertrag, inhaltsgetriebene Gruppierung im selben Call |
| [openai.ts](../../../backend/src/lib/openai.ts) | Importprompt + Zusatz; vorhandener optionaler Kontext | Nur Import des neuen Symbols und dessen Auswahl bei Kontext; ohne Kontext derselbe v15-Importprompt |
| [ai.test.ts](../../../backend/src/functions/ai.test.ts) | B-2-Preparationrequesttest | Exklusiver v2-Prompt, kein Importkoerper, zwei Kanaele, unveraendertes JSON/Identitaeten; Importtest unberuehrt |
| [recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) | Bestehende Positivpartitionen/Mutationen/Swap | Genau ein zusaetzlicher synthetischer Negativtest mit den originalen fuenf v15-Livegruppen |
| [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | Direkter Preparationclientcall, Guard v1 | Guard v2; gespeicherte Boundaryfixture, echter Preparationhandler/Client/Provider, delegierende Spies, rohe Rubrik/Trace vor V2, Counts separat |

LF-normalisierte Git-Blob-IDs der Ausgangs-/Endinhalte, nicht historische Dateibytehashes:

| Datei | Ausgangsblob | Endblob |
|---|---|---|
| recipeAnalyze.ts | 2db1ea9ca4be50683ae2d16c4cd6310446fb37ec | 41ab9787dcc1680c7451555467da044c4d82a52c |
| openai.ts | 36293a662050d0934172b8520a2c31753be7ddce | f36f68d7863dc232ec6815cece69613ae8356ec5 |
| ai.test.ts | 3eaef8c70d319941e4bbae5584cbfd64984d36a4 | 4f0afb550de516b7ef00fb629e39f034dd219cfb |
| recipeAnalyze.eval.test.ts | 22e3f42e35a9b2b641e60eb6a517cbc6fa080719 | 19ec3735095bd1386c432a14515d16fcefc7cca8 |
| recipeAnalyzeValidation.test.ts | a5b25c0e6004b21252ef77263b5c28bf968113cc | 526e5b4ba01b857100bbbbead95c9c7eaad40e8a |

## Versionen und unveraenderte Grenzen

Importprompt/Guard v15; Preparationprompt/Guard v2; Exportversion 1; Preparationrequest/Response contractVersion 2; Vitest 2.1.9. Kein neues Clientverfahren, Modussystem, Schema, Input-/Outputfield oder Produktionshook.

Kontextprojektion, recipe.steps als Validierungsbasis, Runtimevalidator, Strict recipe_analyze Schema, SDK/Modellwahl, Temperatur 0.2, max_tokens 2048, Quota, Provideranzahl und V2-Textprojektion unveraendert. JSON bleibt nur im Userdatenkanal; gespeicherte order/title/description bleiben unveraendert, fehlender title wird modellseitig null. Keine Produkt-/Zutatensuche, Erfindung, Sortierung, Reparatur, neuer Zwischenoutput, zweiter Call, Retry, Fallback, Packer oder Runtime-Semantikklassifikator hinzugefuegt.

Die allein geaenderte Promptstrategie beruecksichtigt zuerst pro gespeicherten Schritt kurze vollstaendige Texte aller Handlungen/Details/Zutatenbeziehungen, bildet danach genau M=min(N,5) benachbarte Gruppen aus diesen Texten unter 90 Zeichen, legt Grenzen erst bei passendem Inhalt fest und verschiebt bei Ueberlast eine benachbarte Grenze mit erneutem Abgleich aller M Gruppen. Keine festen Gruppen oder Goldensaetze als Produktionsvorgabe.

Evidenzgrenze: Dies ist eine nicht bestaetigte Modellhypothese, keine Garantie. Keine Behauptung von Promptdominanz oder Tokenmangel. Das finish_reason der beiden vollstaendig erfassten Antworten war stop, nicht length.

## SDK Red / Green

Ausgefuehrt vom Root, npm exec --workspace=backend wechselt in das Backend. Exakt derselbe Check vor/nach kleinem Produktionsedit:

| Befehl | Exit | Befund |
|---|---:|---|
| npm exec --workspace=backend -- vitest run src/functions/ai.test.ts -t 'sends preparation JSON' | 1 | 10:08:42, 1 fehlgeschlagen / 77 bewusst abgewahlt. Echtes Red: enthaltenen RECIPE_ANALYZE_SYSTEM_PROMPT trotz Preparation nachgewiesen; keine fehlende Export-/Importaufloesung als Red ausgegeben. |
| Derselbe Befehl unmittelbar nach Prompt-/Requestedit | 0 | 10:10:02, 1 bestanden / 77 bewusst abgewahlt. Zwei Nachrichten, exklusiver Preparation-v2-Systemprompt, unveraendertes JSON, ein Call, 0.2/2048/Strict. |

Im Red wurde das noch nicht vorhandene Promptsymbol nur testseitig per typisiertem Recordzugriff geprueft; die erste fehlgeschlagene Assertion pruefte den vorhandenen Importkoerper. Nach Green direkter Symbolzugriff ohne Assertionaenderung. Kein Import-Live-PASS aus dieser Selektion.

## Offline-Negativfall und beibehaltene Rubrik

Der neue Test uebernimmt exakt die ausschliesslich synthetischen v15-Livebeschreibungen, sourceStepOrders und ingredientKeys aus B-2, keine private historische Rezeptrekonstruktion:

| Gruppe | Orders | Laenge | Synthetischer v15-Text (ASCII-Umschrift, Original im Test/B-2) |
|---:|---|---:|---|
| 1 | [1,2,3,4] | 57 | Schneide das Haehnchen, wuerze es und brate es in Olivenoel. |
| 2 | [5] | 65 | Koche den Reis separat 12 Minuten in Salzwasser und giesse ihn ab. |
| 3 | [6] | 56 | Senke die Hitze und gare das Haehnchen weitere 6 Minuten. |
| 4 | [7] | 45 | Lasse das Haehnchen zugedeckt 3 Minuten ruhen. |
| 5 | [8] | 43 | Serviere das Haehnchen mit Reis als Beilage. |

Runtime-Preparationvalidator: ok=true; Count=5; Trace exakt 1..8; Laengen 57/65/56/45/43. Rubrik scheitert an den Orders [1,2,3,4,7]. Zutatenkeys werden dabei wie bisher vom Preparationvalidator nicht ausgewertet. Dies ist KEIN allgemeiner Runtime-Inhaltsschutz.

Die beiden bestehenden positiven angrenzenden Partitionen [1,2],[3,4],[5],[6,7],[8] und [1,2,3],[4],[5],[6,7],[8] bestehen weiterhin unter 90 Zeichen. Alle 20 vorhandenen Detailmutationen und der Reis-/Serviertextswap bleiben unveraendert wirksam; kein Input, Regex, Count, Zeit- oder Zeichenlimit gelockert.

## Vorbereitung der Livechecks

Unveraenderte Fixture: synthetic-saved-eight-steps-rice-serving aus [recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts). Gespeicherte synthetische Zutaten: Haehnchen 350 g, Reis 150 g, Olivenoel 15 g, Salz/Pfeffer indeterminiert, zwei Portionen, vorhandene Beschreibung/Titel/Tags unveraendert. Null-Naehrwerte sind reine Repository-Boundarydaten, keine neue Ernaehrungsregel oder AI-Schaetzung.

Vor jedem Preparationaufruf: bestehende makeAuthRequest/makeContext/setupTestAuth/teardownTestAuth, echte JWT-Verifikation ueber Test-JWKS, bestehendes in-memory RecipesRepository. Gespeicherte Schritte, Kontextzutaten und Metadaten werden vor dem Aufruf gegen die Fixture geprueft. Nur Cosmoswahl fuer diese Boundaryfixture, Storageboundary und Quota sind kontrolliert. Keine Mocks fuer Handler, analyzeRecipeText, Validator oder Providerantwort.

Delegierende vi.spyOn-Aufrufe auf Completions.prototype.create und analyzeRecipeText leiten an die Originalfunktionen weiter; keine mockImplementation/mockResolvedValue fuer diese Funktionen. Ein SDK-Aufruf wird beobachtet, dessen echte choices[0].message.content testlokal vor V2 geparst wird. Alle acht Rubrikzeilen werden vor fail-fast Assertions ausgewertet und ausgegeben; Counts/Laengen/Status/Usage/Unveraendertheit separat. Kein zweiter Providercall oder Produktionsinstrumentierung.

Bei erfolgreicher Rubrik folgen unveraenderte Sourceidentitaet, Vollvalidator/Preparationvalidator, Metadaten-/Zutatenkompatibilitaet, Count, Laengen, 200, einmal Usage nach Provider, exakte V2-Textprojektion und keine Zutaten-IDs. Diese nachgelagerten Erfolgsassertions wurden wegen Inhaltsfehlern NICHT vollstaendig erreicht; kein erfolgreicher 200-Workflow behauptet.

Liveparameter in den zwei vollstaendig erfassten Preparationantworten: Deployment gpt-4o-mini, API-Version 2024-08-01-preview, temperature 0.2, max_tokens 2048, finish_reason stop. Keine Endpoints, Credentials oder privaten Texte dokumentiert.

## Vorab festgelegte Dreierserie und Abbruch

Genau drei unmittelbar aufeinanderfolgende vollstaendige Preparationlaeufe desselben eingefrorenen Produktionskandidaten wurden vor Lauf 1 festgelegt, ohne abgewahlte Imports als PASS zu zaehlen. Beim ersten Fehler wurde die Serie beendet. Lauf 2 und 3 wurden NICHT ausgefuehrt; keine Ersatzlaeufe oder Promptnachbesserung.

Lauf 1: echter Handler 422, source_step_coverage_mismatch, erwartete Orders [1,2,3,4,5,6,7,8], erhalten [1,2,3,4,5,6,7], erste Abweichung Position 8 / erwartet 8 / erhalten null. Ein SDK-/Analyzecall, Usage 0, gespeichertes Rezept/ETag unveraendert. Ganze Source-Step-Liste einschliesslich Titel unveraendert, fehlende Titel null. Inhaltsverluste: mittlere Hitze, Abdeckung beim Ruhen, komplettes Servieren/Beilagenbezug.

Zusaetzlicher eigener Testharnessdefekt: Vitest 2.1.9 kennt toHaveBeenCalledExactlyOnceWith nicht. Dies war die erste geworfene Testassertion in Lauf 1 und verdeckte die spaetere Rubrikassertion, NICHT den zuvor ausgegebenen echten 422/Rohbefund. Nach Abbruch ausschliesslich auf gleichwertige toHaveBeenCalledTimes(1) plus toHaveBeenCalledWith umgestellt. Keine Count-/Argument-/Inhaltslockerung, keine Produktionsaenderung, kein erneuter Serienlauf. Der spaetere separate Recipe-Livecheck pruefte diese Assertions erfolgreich und scheiterte danach an mittlerer Hitze. Diese Testharnesskorrektur ist explizit offengelegt, kein ungebrochen eingefrorener Testdateistand behauptet.

## Vollstaendige synthetische Aktionsmatrix

S = Serienlauf 1. R = separates Recipe-Livegate, KEIN Ersatzlauf. Alle Sourcepattern-Checks beider erfassten Antworten bestehen; Order, title und description stimmen mit den gespeicherten Daten ueberein, fehlende title=null. Exportchecks beziehen sich ausschliesslich auf den Text der zugeordneten Gruppe. T/F unten folgen exakt der unveraenderten Patternreihenfolge der Fixture.

| Source | Vollstaendige Detailrubrik | Gruppe S/R | Source S/R | Export S | Export R |
|---:|---|---|---|---|---|
| 1 | Schneiden, Haehnchen, Wuerfel | [1,2] | T,T,T | T,T,T | T,T,T |
| 2 | Wuerzen, Haehnchen, Salz, Pfeffer | [1,2] | T,T,T,T | T,T,T,T | T,T,T,T |
| 3 | Erhitzen, Olivenoel, Pfanne | [3,4] | T,T,T | T,T,T | T,T,T |
| 4 | Braten, Haehnchen, mittlere Hitze, 4 Min. je Seite | [3,4] | T,T,T,T | T,T,F,T | T,T,F,T |
| 5 | Reis kochen, separat, 12 Min., Salzwasser, Abgiessen | [5] | T,T,T,T,T | T,T,T,T,T | T,T,T,T,T |
| 6 | Hitze senken, Haehnchen, Garen, weitere 6 Min. | [6] | T,T,T,T | T,T,T,T | T,T,T,T |
| 7 | Entnehmen/Haehnchen/aus Pfanne, zugedeckt, 3 Min., Ruhen | [7] | T,T,T,T | T,F,T,T | T,T,T,T |
| 8 | Servieren/Haehnchen, mit Reis als Beilage | KEINE | T,T | F,F | F,F |

Counts getrennt: jeweils 8 Quellsteps, 5 Exportsteps mit Orders 1..5, alle Texte <=90. Sourceabdeckung scheitert trotz richtigem Count. S-Laengen 66/73/65/56/62; R-Laengen 66/73/65/56/72. Beide Handler 422, SDK-/Analyzecalls 1, Usage 0, unchanged=true. Keine Countgruene als Inhalts-PASS.

Exakte Rohgruppen des Serienlaufs, Unicode-Escapes bewahren Originaltexte unabhaengig vom Dokumentencoding:

```json
[
  {"order":1,"sourceStepOrders":[1,2],"description":"Schneide das H\u00e4hnchen in W\u00fcrfel und w\u00fcrze es mit Salz und Pfeffer.","ingredientKeys":["ingredient-1","ingredient-4","ingredient-5"]},
  {"order":2,"sourceStepOrders":[3,4],"description":"Erhitze Oliven\u00f6l in der Pfanne und brate das H\u00e4hnchen 4 Minuten je Seite.","ingredientKeys":["ingredient-1","ingredient-3"]},
  {"order":3,"sourceStepOrders":[5],"description":"Koche den Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","ingredientKeys":["ingredient-2"]},
  {"order":4,"sourceStepOrders":[6],"description":"Senke die Hitze und gare das H\u00e4hnchen weitere 6 Minuten.","ingredientKeys":["ingredient-1"]},
  {"order":5,"sourceStepOrders":[7],"description":"Nimm das H\u00e4hnchen aus der Pfanne und lasse es 3 Minuten ruhen.","ingredientKeys":["ingredient-1"]}
]
```

Im separaten Recipe-Livegate sind Rohgruppen 1..4 feldweise gleich; ausschliesslich Gruppe 5 lautet:

```json
{"order":5,"sourceStepOrders":[7],"description":"Nimm das H\u00e4hnchen aus der Pfanne und lasse es zugedeckt 3 Minuten ruhen.","ingredientKeys":["ingredient-1"]}
```

## Historischer Trace und Invarianten

Der unveraenderte gespeicherte 1..8-Negativfall mit Export [1],[2],[3],[4],[6,7] bleibt 422 / source_step_coverage_mismatch / firstMismatchPosition=5 / expectedOrder=5 / actualOrder=6. Ein Analyzeaufruf, keine Usage/Persistenz/Reparatur/Retry. Bestehende Handler-/Validatorchecks pruefen dies gegen recipe.steps, auch wenn die modellseitige Source-Liste gekuerzt wird. Der neue aktuelle Livefehler an Position 8 ist NICHT derselbe historische Fehler.

Fokussierte Units bestaetigen weiterhin Auth vor Arbeit, optionales ETag vor Quota, 429/502, Strict Schema, einmaligen Call, Usage nur nach validem Erfolg, V2/Text-only/Transienz, Privacy ueber alle erfassten log/warn/error-Argumente, fehlende/doppelte/unbekannte/vertauschte Referenzen, Leertexte und Limits. Kein allgemeiner Runtime-Semantikschutz: korrekte IDs/Laengen/Counts garantieren keine Textvollstaendigkeit. Im aktuellen Livefall blockiert fehlende Order 8; bei vollstaendigem Trace koennten semantische Verluste weiterhin durch den Runtimevalidator gelangen.

## Alle aktuellen Gates

Rootbefehle der Red/Green-Tabelle oben; folgende Befehle im backend, letzter Diffcheck am Root. Zeiten sind lokale Runnerstarts; Handlerlogs oben stammen aus UTC. Keine Timeouts oder Skips neu eingefuehrt.

| Befehl / Gate | Exit | Ergebnis |
|---|---:|---|
| npm exec --workspace=backend -- vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts (Root) | 0 | 10:11:30, 294/294, drei Dateien, 1.18 s |
| Derselbe Rootbefehl --reporter=dot --silent nach Testtypbereinigung | 0 | 10:12:10, 294/294, 1.16 s; nur Ausgabeformat geaendert |
| npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation", Serienlauf 1 | 1 | 10:12:28, 9.50 s, Preparation FAIL 0/1, Guard PASS 1/1, neun bewusst abgewahlte Tests. Echter Provider/Handler 422 plus oben offengelegter Matcherdefekt. |
| Serienlauf 2 / derselbe Befehl | nicht ausgefuehrt | Nach erstem FAIL gestoppt, UNVERIFIED |
| Serienlauf 3 / derselbe Befehl | nicht ausgefuehrt | Nach erstem FAIL gestoppt, UNVERIFIED; keine Ersatzlaeufe |
| npx vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts --reporter=dot --silent nach aequivalentem Matcherfix | 0 | 10:13:00, 294/294, 1.12 s; kein Live-Ersatz |
| npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts | 1 | 10:13:07, 83.89 s, 9 FAIL / 2 Guard-PASS, kein Skip. Acht Imports 0/8, Preparation 0/1; Assertions ueber echten Call/Request/Quota/Persistenz erreicht, dann Inhaltsfehler. |
| npm run test:eval | 1 | 10:14:43, 151.68 s, fuenf Dateien: 2 FAIL / 3 PASS; 12 FAIL / 27 PASS, kein Live-Skip. Recipe 9 FAIL, Daily Insight 3 FAIL; unveraenderte weitere Evaldateien bestanden. Kein Gesamt-PASS. |
| npx vitest run | 0 | 10:17:28, 57.25 s, 1407/1407, 66 Dateien. Keine Renderer-/Timeout-/Assertionlockerung. |
| npm run typecheck | 0 | Backend tsc --noEmit bestanden |
| npm run build:verify | 0 | Compile, Assetkopie, Modulaufloesung und doppelte Function-IDs bestanden |
| git -C .. diff --check (aus backend, Rootgate) | 0 | Keine Whitespacefehler; bestehende CRLF/LF-Hinweise |
| Eigener Diff abschnittsweise exakt vergleichen; git apply --reverse --check | 0 | Fuenf eigene Dateihunks exakt, kein Apply; Artefakt-Endzeile korrigiert und erneut geprueft |

Azure-Functions-Testmodus meldet ueblicherweise nicht ausgefuehrte Functionregistrierung, nicht ausgelassene Livefixture. Credentials waren vorhanden; kein Exit 2. Kein Kosten-/Timeout-/Skip-/Assertiontuning zur Gruenfaerbung. Fokussierte Selektionsskips sind ausschliesslich bewusst abgewahlte Tests, kein Import- oder Gesamt-PASS.

## Separate Import-/Gesamtbefunde und Verification Limits

Acht Inputs/Constraints und Importtestkoerper unveraendert. Erstfehler im separaten Recipegate versus Gesamtgate:

| Importfixture | Separates Recipegate | Gesamtgate |
|---|---|---|
| mixed-food-seasoning | FAIL: 3 statt 5 Gruppen | FAIL: 3 statt 5 Gruppen |
| borderline-classification | FAIL: 3 statt 5 | FAIL: 3 statt 5 |
| explicit-quantities-with-unit-conversion | FAIL: 3 statt 5 | FAIL: 4 statt 5 |
| missing-quantities-food-gets-estimated | FAIL: 2 statt 5 | FAIL: 2 statt 5 |
| indeterminate-spray-oil-stays-food | FAIL: 2 statt 3 | FAIL: 2 statt 3 |
| no-lost-or-invented-ingredients | FAIL: 3 statt 5 | FAIL: leere Beschreibung |
| full-recipe-output-fields | FAIL: 4 statt 5 | FAIL: Duplikattrace [1,2,3,4,5,5] |
| side-dish-and-serving-actions | FAIL: Abgiessen verloren | FAIL: Salzwasser verloren |

Diese Erstfehler belegen nicht, dass alle spaeteren Zutatenassertions erreicht wurden. Keine Kausalitaetsbehauptung, B-16 habe den Import verschlechtert; eine heutige bestandene Vorher-Livebaseline fehlt. Importprompt/Request unveraendert, trotzdem aktuelles Pflichtgate FAIL. PO-1 bleibt offen, exakte Countregel bleibt unveraendert.

Gesamtgate: Preparation scheitert erneut an mittlerer Hitze; die vor der Rubrik stehenden Assertions bestaetigen genau einen SDK-/Analyzecall, exakten Kontext/Systemprompt, Quota vor Provider und kein Rezeptwrite/keine Rezeptaenderung. Vollstaendige Rohgruppen, Laengen, Source-/Exportmatrix, Handlerstatus und Usagecounts dieses dritten Provideroutputs sind in der verfuegbaren Gesamtgateausgabe nicht vollstaendig erhalten: fuer diese Einzelangaben UNVERIFIED, nicht aus den beiden vorigen Antworten rekonstruiert. Kein weiterer Call zur Rekonstruktion. Der Gesamtgate-FAIL und seine 39-Test-Zusammenfassung sind erhalten.

Drei Daily-Insightfehler im Gesamtgate bleiben fremde Befunde; sichtbar waren phase-progress-open-day und target-relative-overage-not-achieved, der vollstaendige dritte Detailbefund ist hier nicht gesichert. Keine Daily-Inhalte, fremde Reparatur oder allgemeine Finding-Schliessung. Drei andere Evaldateien bestanden; daraus folgt kein Paket-PASS.

Die Erfolgsassertions nach der ersten gescheiterten Inhaltsassertion (insbesondere 200/V2/Usage-einmal/volle Rohmetadatenkompatibilitaet) sind fuer die aktuellen Liveantworten nicht alle ausgefuehrt. Alle verbleibenden Verification Limits sind Bestandteil dieses FAIL-Handoffs, keine angenommene Freigabe.

Historisches privates Originalrezept und deployed Revision fehlen: MANUAL VALIDATION REQUIRED. Synthetische Fixture keine historische Reproduktion, kein share-bundle-/Renderer-/Alpha-Nachweis. Keine neue Telemetrieabfrage.

## Integritaet, Secrets und KB-Konflikt

Direkter Vorher-/Nachhervergleich bestaetigt: kompletter Import-v15-Promptkoerper, gesamte [Fixturedatei](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts), recipes.ts, recipes.test.ts, Runtimevalidator und vorhandene KB-/QA-Dateien unveraendert. Fixture-Dateibyte-SHA-256 vor/nach: 8D374DE609328E2F29633AAB44988E6A4BFF84A089C9FECDFA9AB5B994BF404E. Damit bleiben alle acht Imports UND die gespeicherte Preparationfixture unveraendert; keine neu behauptete historische Baseline.

B-1-Artefaktbytes erneut verifiziert und unveraendert:

| Artefakt | SHA-256 |
|---|---|
| Ausgangsdiff | 07FF1F0B20DE4D6590E0D7647975FA92414189FA71174D10B54F24C22CEBC767 |
| Enddiff | 76D9DFF2C42C47A5E4F6A82094B06DD596DD4BBD969242874F614A9C2FB05082 |
| Ruecknahmediff | F61A4FB4CB75DF84BA82ECA9E43C2EEDDEEB2090E780338F12E5CDABB0DEB5AB |

Finale eigene Source-Dateibyte-SHA-256:

| Datei | SHA-256 |
|---|---|
| recipeAnalyze.ts | C78A24D32DA4FAACC1BB58A8A14977CE40EB8E16C87FA79C7726994701E9B3DE |
| openai.ts | 82144DD35E9B1CB1222CF8EF0334BB9FD12590AE17FEA8DBAEB2DF0612B1949D |
| ai.test.ts | C33F8BFC11B3BDCFAD2498E54A8C15BBD45CF5DBFD120047A55F0B412597B799 |
| recipeAnalyze.eval.test.ts | 7A0A13CD24054B1044026CF63F2A01AE80D9B9EAD9E10CC447A24EFEDE6A7C02 |
| recipeAnalyzeValidation.test.ts | 37C06937967A48D6ACC45090797E079966D781BC0672C3C2B1FA1922FD6D1853 |

Manueller eigener Diff-/Secret-/Provenienzreview: nur zugeordnete Preparationhunks, statischer Prompt, Testfixture/Spycode und diese Evidenzartefakte; keine neuen Secrets, privaten Rezepttexte oder Endpoints. JSON-Rohtexte hier ausschliesslich synthetisch. Keine neuen Dependencies, shared/mobile/infra-Dateien, produktiven Daten-/Ressourcenaenderungen, Commits oder Branches. Alle fuenf geaenderten Backenddateien ohne Editor-Diagnosen. B-1-Ruecknahmen und drei ungeklaerte Importhunks bleiben erhalten.

KB-Konflikte bleiben explizit: Rezeptdomain/API sagen noch does not change the prompt; AI-KB nennt v13 statt Import v15/Preparation v2 und beschreibt nur Teilsemantikdeckung. Keine KB-Aenderung in B-16; D-16 muss bei separater Beauftragung den tatsaechlichen Code und diese FAIL-/Runtimegrenzen eng angleichen, nicht die Korrektur als funktionierend beschreiben.

## AC-Stand und Handoffentscheidung

| AC | Stand | Evidenz / Grenze |
|---|---|---|
| AC-1 | PASS fuer Requestisolation | SDK-Red/Green, fokussierte Units, Importkoerper-/Fixture-/Requestkompatibilitaet; kein neuer Vertrag oder Call |
| AC-2 | FAIL | Vollrubrik: mittlere Hitze und Servieren fehlen, im Serienlauf auch zugedecktes Ruhen; Handler 422 |
| AC-3 | PASS offline | Originaler synthetischer v15-Verlust strukturgruen/rubrikrot; zwei Positivpartitionen, 20 Mutationen, Swap erhalten |
| AC-4 | PASS offline | Historischer 5/5/6-Trace und bestehende fail-closed/Auth/ETag/Quota/Privacy/V2-/Usageinvarianten unveraendert gruen |
| AC-5 | FAIL / verbleibende Laeufe UNVERIFIED | Serie nach Lauf 1 gestoppt; keine drei erfolgreichen 200-Laeufe; Matcherdefekt und Gesamtgate-Rohdatenluecke offengelegt |
| AC-6 | FAIL | Alle Offlinegates bestanden, beide separaten Livegates FAIL; kein Paket-/Import-/Gesamt-PASS |
| AC-7 | PASS fuer B-16-Hunkgrenze, weitere Pakete offen | Import/B-1/fremde Dirty-Hunks erhalten; PO-1 offen; KB/QA/Register/Deployment nicht ausgefuehrt |

Konkreter Befund an Orchestrator: Der genehmigte exklusive Preparation-v2-Prompt allein erzeugt fuer dieselbe unveraenderte synthetische Acht-Schritt-Fixture noch keine vollstaendige Ausgabe unter dem bestehenden Vertrag. Offline existieren passende fuenfgruppige Loesungen; Unmoeglichkeit oder Tokenmangel sind damit nicht belegt. Die erlaubte kleine Korrektur ist live gescheitert. Keine neue Architektur, Schema-/Budget-/Limitentscheidung oder Promptserie selbststaendig vorgenommen. Weitere Entscheidung benoetigt; dieser Handoff ist Befunderstellung, keine Abnahme. Import-/Gesamtgateklaerung und unabhaengige QA bleiben offen, Release blockiert.

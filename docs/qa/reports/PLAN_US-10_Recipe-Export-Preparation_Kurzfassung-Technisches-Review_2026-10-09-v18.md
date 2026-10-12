# QA Report: Q-18A Kurzfassung und gesamter Serienstand

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)
- Verdict: `FAIL`
- Review date: 2026-10-09
- Agent: FitTrack QA; unabhaengige Q-18A, keine Backend-Selbstabnahme.
- HEAD: `b637ee5b59a4f72b7d822443680c1951a01f9dc4`.

## Scope

Ausdruecklich beauftragte unabhaengige Abnahme aller 14 v18-ACs, des Kurzfassungsfixes und des gesamten relevanten v12..v18-Serienbestands. Der unveraenderte Freigabeentwurf im Planheader wird durch die auftragsseitige Freigabe nicht zu einer weiteren Planrevision. Ausgefuehrt sind Q-18R, B-18 einschliesslich dokumentierter Handoff-Recovery/Livecompletion und D-18. Keine zusaetzliche freigegebene Findingliste: Q-18R dokumentierte No-op ueber K-1..K-8 hinaus. B-18C/D-18C/Q-18C wurden nicht ausgefuehrt oder automatisch autorisiert.

Originalziel: die wichtigsten Kochhandlungen als kurze Zusammenfassung innerhalb des bestehenden Render Templates; zusaetzlich unabhaengiger technischer Review der ganzen Korrekturserie auf begruendbare Vereinfachung. Keine Pflicht zum Export jedes Quelldetails. Vollstaendige nummerierte Importquelle und unveraenderte gespeicherte Preparationquelle bleiben dagegen verbindlich. [US-10](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md#L255) AC-15/16 werden nach der ausdruecklichen v18-Klarstellung bewertet, AC-13/14/17 nur hinsichtlich unveraenderter Templategrenzen. Andere Storyfeatures sind kein neuer Implementierungsauftrag.

Nur dieser neue Bericht wurde manuell angelegt. Keine Implementierung, Test-/KB-/Register-/Historienedits, Commits, Branches, Deployment, Privatreplay oder Promptnachbesserung. Normale ignorierte Buildausgaben sind Gateartefakte, keine Sourceaenderungen. AI-Skill Section 6 und Implementation-Checklist angewandt; Cosmos-/Mobile-/Infrastrukturimplementierung nicht betroffen. Bestehender Recipe-Vertrag 502 und 0.2/2048 hat laut genehmigtem Plan Vorrang vor generischen Skillbeispielen, kein neuer Fehler-/Samplingvertrag.

Die strukturellen Vereinfachungen und engen KB-Angleichungen sind vorhanden. Der reale Preparationexport verliert weiterhin Fertiggaren, eine neue Test-only Widerspruchsregel lehnt eine erlaubte Servierkombination ab, das separate Importgate und das Gesamtgate scheitern. Keine Abschluss-/Merge-/Releasefreigabe.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Beide Validatoren akzeptieren ordered unique subset mit Gaps innen/zwischen, auch den numerischen historischen Teiltrace; Source-/Exportordnung, globale/lokale Duplicate, Unknown/Reorder/empty refs und Nichtmutation erhalten. Eigene 102 Validatorunits und 288 Fokusunits, VA/UT/HT/AT-Inventar unten. |
| AC-2 | PASS | MIN1/MAX5/90 explizit; 1/4/5 und90 positiv,0/6/91/blank/no-source negativ. Reale Produktionsfont-/Satori-/Resvg-Probe fuer1..5, PNG-Metadaten1080x1350 und bestehende Overflownegative:34/34. Keine Rendererlayout-/Asset-/Timeoutaenderung. |
| AC-3 | FAIL | Offline vier Kernhandlungen und erlaubte Detail-/Servierauslassung positiv, fehlendes Reiskochen negativ. Eigene reale F/R/G verlieren aber Kern6/Fertiggaren. Zusaetzlich erlaubte Kombination von Fertiggaren und Servieren durch neue Rubrik abgelehnt; Findings001/002. |
| AC-4 | PASS fuer die abgegrenzten Negativnachfolger | Kernverlust/falsche Komponente/Swap/erfundene Temperatur trotz Strukturgruen werden negativ geprueft; source-backed numerische Exporttemperatur positiv. Sourceverlustbatterie bleibt vollstaendig. Kein universeller Widerspruchsschutz behauptet; zusaetzlicher positiver Rubrikdefekt separat002, kein Entlastungsgrund fuer001. |
| AC-5 | PASS fuer Code/Guards/Quellbindung | Importv16/Preparationv3, beide Guards bestehen; zwei exklusive Nachrichten/JSON/source identity, unveraenderte Nicht-Export-Importregeln/Keys/Kategorien/Mengen und Wordabbruchschutz. Nummerierte Importfixture8 besteht R/G mit allen acht Sources. Exact-M/Vollpartition/All-details-Packstrategie entfernt. |
| AC-6 | PASS fuer erhaltene Schutzvertraege; Liveerfolg begrenzt | Eigene Fokus-/Vollsuite bestaetigt Auth/Ownership/ETag-vor-Quota,429/502/echte422,Strict/einCall/success-only Usage,V2/no writes/Privacy,Confirmation/Save/Share/Fingerprint. F/R/G beobachten SDK1/analyze1/Usage1/200/writes0/unchanged; spaetere V2-Body-/Usage-Order-Liveassertions nicht erreicht, kein voller Liveworkflow-PASS. |
| AC-7 | PASS mit ausdruecklicher Provenienzgrenze | Eigene exakte LF-Rekonstruktion aller9 B18-/5 D18-Vorstaende passt zu Q18R;46/37 Hunks zu K-/Inventar-IDs zugeordnet. B1-Ruecknahmen,20 historische Artefakt-/Storybytehashes erhalten; kein v13-Restore. Originale Red-/Livechronologie weiterhin UNVERIFIED, fremde Registryabweichung nicht restored. |
| AC-8 | FAIL | Alle vorgeschriebenen Gates selbst neu ausgefuehrt. F echter1FAIL/1PASS, R2FAIL/9PASS, G5FAIL/34PASS; keine Live-Skips in R/G.102/288/34/1397 Units,Typecheck,Build,Rootdiff gruen ersetzen die roten Livegates nicht. |
| AC-9 | PASS fuer Dokumentation und unabhaengigen Review | Alle5 KB-Dateien beschreiben v16/v3,Teiltrace/max/Source-/Exporttrennung und Runtimequalitaetsgrenze; historische B16-FAILs erhalten, neue B18-Befunde datiert statt rueckdatiert. Eigener Gesamtinventar-/Storyabgleich vorhanden, keine Registryclosure/Alpha-/Privatreplay-/Sharebehauptung. |
| AC-10 | PASS | Dauerhaftes Q18R mit87 Ankern und8 Aspekten vorhanden; hier alle87 final abgeglichen, neue Artefakte gesondert aufgenommen. Angrenzende owning Import-/Save-/Shared-/Renderer-/Runneroberflaechen selbst geprueft, Ausschlussbasis X-Zeilen. |
| AC-11 | PASS mit offenen Urspruengen | Logische Serien-/Plan-/Rollbackanker erhalten; neuer K-ID-Abgleich und direkte Patchrekonstruktion unten. PR07/08/10 historisch weiter ungeklaert; kumulierte HEAD-Diffs, rekonstruierte Diffs, unmittelbare eigene Diffs und Rohbyte-/LF-Nachweise getrennt. |
| AC-12 | PASS fuer Entscheidungsgrenzen | Keine zusaetzliche Implementierung/Findingliste ausgefuehrt. Neue Findings nennen Position/Owner/Risiko/Alternative/Checks. Gezielte Rubrikregression nur nach genauem Orchestratorauftrag eventuell im einmaligen Folgezyklus; Inhalts-/Import-/Daily-/Werkzeugvorschlaege keine freie Refactoringvollmacht. |
| AC-13 | FAIL | K1..4/K8 umgesetzt, zielbedingt entfallene Exportpflichten mit Nachfolgern dokumentiert und Schutztests erhalten. K4/K6 enthalten jedoch belegte lokale Rubrikregression002. Keine QA-Selbstkorrektur oder C-Abnahme; maximaler Folgezyklus nicht gestartet. |
| AC-14 | FAIL | Alle87 Dispositionen und neue Hilfsartefakte bewertet, keine fehlende benoetigte Coverage-only-Loeschung gefunden. Offene echte Preparation-/Rubrik-/Import-/Gesamtfehler verhindern sauberen Abschluss. Historische/manuelle Grenzen mit Owner sichtbar, keine pauschale Closure. |

### US-10 Interpretation

| ID | Result | Evidence |
|---|---|---|
| US-10 AC-15 | FAIL fuer die aktuelle brauchbare Verdichtung | Anzahl/Layout passen, doch der echte 200-Vorschlag verliert eine verbindliche Kernhandlung. Runtime kontrolliert Struktur, nicht Kochkern;200 ist hier weder semantischer Erfolg noch kontrolliertes Blockieren des Kernverlusts. Reales Share nicht geprueft. |
| US-10 AC-16 | FAIL nach genehmigter Kurzfassungsauslegung | Volle Source erhalten; optionales Servieren/Detailauslassung allein waere erlaubt. Fertiggaren fehlt jedoch tatsaechlich. Historische Story/FAILs bleiben unveraendert, keine erneute pauschale Detailpflicht. |

## Tests

Eigene Gates am unveraenderten Kandidaten; Root-Workspacebefehle entsprechen den Backendbefehlen des Plans. Reihenfolge: Validator, Fokus, Render, F, R, G, Vollsuite, Typecheck, Build, Diff. `--reporter=dot --silent` bei der Vollsuite betrifft nur Ausgabe, keine Konfiguration/Assertions/Skips/Timeouts. Vitest2.1.9; normale66-Dateien-Suite schliesst Eval/Contract aus, Livekonfiguration bleibt seriell und unveraendert.

| Command | Exit code | Result |
|---|---:|---|
| `npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts` | 0 |102/102, Start12:41:23 lokal,2.59s. |
| `npm exec --workspace=backend -- vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts src/lib/recipeValidation.test.ts` | 0 |288/288:AI78,Recipes103,Validator102,Save5;12:41:42,22.56s. |
| `npm exec --workspace=backend -- vitest run src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts` | 0 |34/34;12:42:36,85.23s; neue1..5/90-Probe14.908s; reale Fonts/PNG/Overflow. |
| `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` | 1 | F: PreparationFAIL/GuardPASS,9 bewusst ausgewaehlte Nicht-Fokustests skipped;UTC10:44:35.018 bis10:44:46.107. Echter Provider/Handler, kein all-skipped-PASS. |
| `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts` | 1 | R:9PASS/2FAIL, Imports7/8,Guards2/2,PreparationFAIL;UTC10:45:02.498 bis10:46:27.597;keine Skips. |
| `node backend/scripts/run-eval.mjs` | 1 | G:34PASS/5FAIL,2 DateienFAIL/3PASS,39 Tests;UTC10:47:17.215 bis10:49:33.542;Preparation1+Daily4FAIL,Imports8/8PASS,keine Skips. |
| `npm exec --workspace=backend -- vitest run --reporter=dot --silent` | 0 |1397/1397,66 Dateien;12:49:56,79.61s; normale unveraenderte Vollsuite, keine isolierten Ersatzgates. |
| `npm run typecheck --workspace=backend` | 0 |`tsc --noEmit`, keine Diagnosen. |
| `npm run build:verify --workspace=backend` | 0 |Compile,10 vorhandene Rendererassets,Modulaufloesung und doppelte Function-IDs bestanden. |
| `git diff --check` | 0 |Root-Whitespacegate; bestehende CRLF/LF-Hinweise keine Fehler. |
| `git diff --cached --quiet` | 0 |Index weiterhin leer/unveraendert. |
| Read-only exakte LF-Hunkrekonstruktion via `node --input-type=module` | 0 |9 B18-Dateien/46Hunks und5 D18-Dateien/37Hunks rueckwaerts nur im Speicher; Vorstandsblobs passen Q18R bzw. HEAD-clean Rendererbasis. Kein Apply/Restore. |
| Read-only Q18R-Historical-/Storyhashvergleich | 0 |20/20 Rohbytehashes identisch. Erste CRLF-sensitive Tabellenabfrage fand0 und war KEIN Bewahrungsnachweis; korrigierter Parser normalisiert nur gelesenen Berichttext und verlangt explizit20. |
| Read-only `git diff --numstat HEAD -- <13 named boundary paths>` | 0 |13 Pfade ohne Diff:ai.ts,http helper,package,beide configs,evalrunner,beide Sharedtypes,Savevalidator/-test,Rendererproduktion,highlight-/tags-test. |
| In-memory Rubrikprobe via `node --input-type=module` | 0 |Tatsaechlicher TS-Helper/Validator per Transpile geladen, nur bestehende Vitest-Expectoperationen durch Nodeassert-adapter ersetzt. Beide Validatoren gruen; erlaubte Servierkombination rubricrot. Minimaler Kern positiv, fehlende6/falsche Komponente/falsche4-Minuten negativ;Nichtmutation. Kein Test-/Fixtureedit/Providercall. |
| Parsed-object Vergleich bereits beobachteter F/R/G-Synthetik | 0 |Modellsource exakt gespeicherte Source mit missing title=null; Exportsteps feldweise identisch. Vollraw nicht identisch:Teaser variiert. Vorige PowerShell-JSON-Stringprobe war property-order-sensitiv, kein Sourceverlustbefund. |
| Begrenzter SHA256-Kandidatenschutz | 0 |27 benoetigte Code-/Test-/KB-/Boundary-/Registerpfade vor F und nach jedem Livegate sowie nach Abschlussgates unveraendert;keine globale Hashpipeline. |

F/R/G wurden je genau EINMAL vorab festgelegt ausgefuehrt. Der offizielle unveraenderte Runner wurde durch `spawnSync(process.execPath, args)` mit explizitem Argumentarray gestartet, nicht durch eine neue Evalkonfiguration. Das ist das gleiche Runner-/Vitest-Verfahren wie `npm run test:eval`; es vermeidet die bei B18 beobachtete Windows-npm-Argumentweitergabe. Der senkrechte Strich oben ist nur Tabellenescaping, im Argument ein echter `|`. Wrapper nutzte `loadEvalEnvironment()` privat und redigierte konfigurierte sensitive Werte/URLs vor Ausgabe; keine Settingscopy, kein Providerretry. Die drei Commands/Exits sind echte eigene Ausfuehrungen, nicht B18-Handoffzahlen.

Azure-Functions-Testmoduswarnungen betreffen Registrierungen, nicht ausgelassene Livefixtures. Credentials vorhanden/kein Exit2; F-Selektionsskips sind weder Import- noch Gesamt-PASS. Kein weiterer Livecall zur Rohdatenrekonstruktion oder Gruensammlung. Nach Reportanlage folgen ausschliesslich Reportvertrag-/JSON-/Link-/Privacy-/Bewahrungschecks, keine neue fachliche Gateausfuehrung.

## Synthetic Live Evidence

F=Fokus, R=separates Recipegate, G=Gesamtgate. Unveraenderte gespeicherte [Fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L175). Alle drei Antworten enthalten Source1..8 samt vorhandenen Titeln/Beschreibungen exakt; fehlender Titel im Modell null. Alle Sourcepattern bestehen. Synthetische Daten, keine privaten Originaltexte. SDK/analyze/Usage je1,write update/replace/create je0,recipe/ETag unveraendert;API2024-08-01-preview,temperature0.2,maxTokens2048,finishReasonstop;Deploymentname redigiert. Keine Behauptung gemessener Gesamtprovider-/Import-/Dailycallzahlen.

| Source | Gespeicherter Schritt, ASCII-Umschrift | Sourcepatterns F/R/G | Exportkern F/R/G |
|---|---|---|---|
|1|Schneide das Haehnchen in Wuerfel;Titel Schneiden|T,T,T|Schneiden T,Gruppe[1]|
|2|Wuerze das Haehnchen mit Salz und Pfeffer|T,T,T,T|optional,Gruppe[2]|
|3|Erhitze Olivenoel in der Pfanne|T,T,T|optional,Gruppe[3]|
|4|Brate Haehnchen bei mittlerer Hitze4 Minuten je Seite|T,T,T,T|Anbraten T,Gruppe[4];contradiction F|
|5|Koche Reis separat12 Minuten in Salzwasser und giesse ihn ab;Titel Separate Beilage|T,T,T,T,T|Reiskochen T,Gruppe[5];contradictions F,F|
|6|Senke die Hitze und gare Haehnchen weitere6 Minuten|T,T,T,T|Fertiggaren F,KEINE Gruppe;contradictions F,F,F mangels Text|
|7|Nimm Haehnchen aus der Pfanne und lasse es zugedeckt3 Minuten ruhen|T,T,T,T|optional,keine Gruppe|
|8|Serviere Haehnchen mit Reis als Beilage;Titel Servieren|T,T|optional,keine Gruppe|

F/R/G status200,Sourcecount8,Exportcount5,Laengen32/40/31/54/61. Exakte gemeinsame synthetische Exportsteps vor V2, Originaltexte mit Unicode-Escapes:

```json
[
  {"order":1,"description":"Schneide das H\u00e4hnchen in W\u00fcrfel.","sourceStepOrders":[1],"ingredientKeys":["ingredient-1"]},
  {"order":2,"description":"W\u00fcrze das H\u00e4hnchen mit Salz und Pfeffer.","sourceStepOrders":[2],"ingredientKeys":["ingredient-1","ingredient-4","ingredient-5"]},
  {"order":3,"description":"Erhitze Oliven\u00f6l in der Pfanne.","sourceStepOrders":[3],"ingredientKeys":["ingredient-3"]},
  {"order":4,"description":"Brate H\u00e4hnchen bei mittlerer Hitze 4 Minuten je Seite.","sourceStepOrders":[4],"ingredientKeys":["ingredient-1"]},
  {"order":5,"description":"Koche Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","sourceStepOrders":[5],"ingredientKeys":["ingredient-2"]}
]
```

Gespeicherte/modelseitige Quelle sowie beobachtete Rohmetadaten des Fokuslaufs, unveraenderte F/R/G-Sourcewerte separat exakt geprueft:

```json
{
  "suggestedName":"Synthetische H\u00e4hnchenpfanne mit Reis",
  "description":"Synthetische Preparationfixture f\u00fcr v15 B-2 AC-3/4, kein historisches Rezept.",
  "suggestedPortions":2,"tags":[],
  "steps":[
    {"order":1,"title":"Schneiden","description":"Schneide das H\u00e4hnchen in W\u00fcrfel."},
    {"order":2,"title":null,"description":"W\u00fcrze das H\u00e4hnchen mit Salz und Pfeffer."},
    {"order":3,"title":null,"description":"Erhitze Oliven\u00f6l in der Pfanne."},
    {"order":4,"title":null,"description":"Brate H\u00e4hnchen bei mittlerer Hitze 4 Minuten je Seite."},
    {"order":5,"title":"Separate Beilage","description":"Koche Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab."},
    {"order":6,"title":null,"description":"Senke die Hitze und gare H\u00e4hnchen weitere 6 Minuten."},
    {"order":7,"title":null,"description":"Nimm H\u00e4hnchen aus der Pfanne und lasse es zugedeckt 3 Minuten ruhen."},
    {"order":8,"title":"Servieren","description":"Serviere H\u00e4hnchen mit Reis als Beilage."}
  ],
  "ingredients":[
    {"analysisKey":"ingredient-1","line":"350 g H\u00e4hnchen","displayName":"H\u00e4hnchen","category":"food","amountGrams":350,"kitchenAmountText":null},
    {"analysisKey":"ingredient-2","line":"150 g Reis","displayName":"Reis","category":"food","amountGrams":150,"kitchenAmountText":null},
    {"analysisKey":"ingredient-3","line":"15 g Oliven\u00f6l","displayName":"Oliven\u00f6l","category":"food","amountGrams":15,"kitchenAmountText":null},
    {"analysisKey":"ingredient-4","line":"nach Geschmack Salz","displayName":"Salz","category":"seasoning","amountGrams":null,"kitchenAmountText":"nach Geschmack"},
    {"analysisKey":"ingredient-5","line":"nach Geschmack Pfeffer","displayName":"Pfeffer","category":"seasoning","amountGrams":null,"kitchenAmountText":"nach Geschmack"}
  ],
  "focusExportMetadata":{"version":1,"teaser":"Schnelle H\u00e4hnchenpfanne mit Reis und w\u00fcrziger Note.","totalTimeMinutes":30,"difficulty":"einfach","includedIngredientKeys":["ingredient-1","ingredient-2","ingredient-3"]}
}
```

Dies ist eine dokumentierte Rohfeldprojektion, kein neu erzeugter Provideroutput und kein vollstaendiger V2-Body. R/G-Teaser lautet exakt `Synthetische H\u00e4hnchenpfanne mit Reis f\u00fcr ein schnelles Gericht.` (JSON-Escape-Schreibweise), Zeit30/Schwierigkeit `einfach`. Vollraws nicht pauschal gleichsetzen. Saved titles2/3/4/6/7 fehlen tatsaechlich; nur im Modelloutput null.

Erster geworfener Check: `Missing export reference 6: finish cooking chicken after frying` im [Helper](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L84), aufgerufen [vor den spaeteren Erfolgsassertions](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L367). Vorher erreichte Request-/EinCall-/Quota-/No-write-/Unchangedchecks bestehen. Nachher liegende volle Modellmetadaten-/Validator-/200-/V2-Body-/Usage-Order-/ID-Abwesenheitsassertions nicht erreicht. Direkte Zaehlerbeobachtung200/Usage1 ist kein Ersatz fuer deren Live-PASS. Sourceidentitaet wurde zusaetzlich offline an den schon beobachteten Objekten exakt bestaetigt, nicht durch einen weiteren Providerlauf.

### Independent Rubric Probe

Gleiche vollstaendige gespeicherte Source, vier Texte `Schneide Haehnchen.`, `Brate Haehnchen an.`, `Koche Reis separat.`, letzter Text unten; Unicode wie Fixture. Keine Inputaenderung, Goldenpflicht oder Runtimeklassifikation. TS-Originalhelper im Speicher ausgefuehrt; Nodeassert bildet dessen verwendete Expectoperationen ab. Source/Exportlimits und beide tatsaechlichen Validatoren separat geprueft.

| Last export text, ASCII-Umschrift | Referenzen | Beide Validatoren | Originalrubrik | Begruendung |
|---|---|---|---|---|
|Gare Haehnchen fertig.|[6]|true|PASS|Minimaler genehmigter Kern.|
|Gare Haehnchen fertig und serviere es mit Reis.|[6,8]|true|FAIL|Fehlalarm: `/gar\w*[^;,.]*(?:reis\|bohn)/iu` verbindet gare mit Reis in der Servierklausel.|
|Gare Reis fertig.|[6]|true|FAIL|Echte falsche Hauptkomponente, positive Kernpattern scheitert.|
|Gare Haehnchen weitere4 Minuten.|[6]|true|FAIL|Echter Widerspruch zu weiteren6 Minuten.|
|Gare Haehnchen fertig., aber Referenz[7]|[7]|true|FAIL|Fehlende Kernreferenz6 bleibt negativ.|

Die korrekte Kombinationsbeschreibung ist unter90 Zeichen, alle4 Kernhandlungen sind vorhanden, [6,8] ist eine geordnete Teilgruppe mit erlaubter Luecke7. Source8 belegt Servieren mit Reis. Die neue negative Regex an [Preparationkern6](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L231) ist zu breit; dies ist ein reproduzierbarer lokaler K4/K6-Testdefekt, kein angeblich allgemeiner NLP-Beweis. Der echte Liveoutput001 enthaelt gar keine6-/Fertiggarklausel und scheitert unabhaengig davon korrekt.

### Separate Import And Overall Results

| Import fixture | R | G |
|---|---|---|
|mixed-food-seasoning|PASS|PASS|
|borderline-classification|PASS|PASS|
|explicit-quantities-with-unit-conversion|PASS|PASS|
|missing-quantities-food-gets-estimated|PASS|PASS|
|indeterminate-spray-oil-stays-food|FAIL:amountGrams0.01 statt null|PASS|
|no-lost-or-invented-ingredients|PASS|PASS|
|full-recipe-output-fields|PASS|PASS|
|side-dish-and-serving-actions|PASS|PASS|

R-Fixture8: Sources1..8 voll, Exportrefs[1],[2],[5],[6],[8]; Kartoffeln/Bohnen kochen, Haehnchen braten/fertiggaren vorhanden. Keine Pflicht zu eigenstaendigem Servierschritt wird daraus fuer Preparation abgeleitet. Importconstraints1..7 unveraendert; Spray-Oel0.01 ist eine echte nicht belegte Kleinstmenge, kein neuer Exportdetailvertrag. G-PASS derselben Importfixture schliesst ihren vorherigen ausgefuehrten R-FAIL nicht. Keine behauptete Kausalitaet durch B18 oder belegte statistische Zuverlaessigkeit; Importraws1..7 nicht vom vorhandenen Harness ausgegeben.

Fremde G-FAILs: Daily `protein-gap-with-budget` und `stale-weight`: `Daily insight judges an open day as completed`; `protein-nearly-complete`: `Daily insight treats a target-relative calorie difference as an achieved energy balance`; `midday-empty-day-not-morning`: required concept group1 fehlt (heute/dein tag/fuer den rest). Daily14/18,Recipe10/11; RecipeScale3/3,Weekly4/4,Weeklydiagnose3/3 bestanden. Kein Dailyfix/-Kausalitaetsclaim oder Wiederholung in diesem Auftrag.

## Provenance And Final Hunk Reconciliation

Autoritative Basis: [Q18R](PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Vorreview.md), [B18-Handoff](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md), [B18-Enddiff](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_Enddiff_2026-10-09.patch), [D18-Handoff](../../User%20Stories/Reciepe/D-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md), [D18-Eigendiff](../../User%20Stories/Reciepe/D-18_Recipe-Kurzfassung_EigenerDiff_2026-10-09.patch). H1..Hn bedeutet Hunkreihenfolge innerhalb der jeweiligen Datei in diesen Eigendifferenzen. Alle46/37 Hunks selbst exakt rueckwaerts im Speicher mit finalem Source-/KB-Text abgeglichen. Vorstandsblobs entsprechen allen Q18R-Paaren; Renderer davor HEAD-clean. Das belegt Inhalte/Zuordnung, keine historische Test-first-Zeitfolge.

| Own file surface | Hunk -> authorized action and inventory |
|---|---|
|Validator|H1..3 K1/VA01/02, H4..5 K2/VA05, H6 K1/VA03/04.|
|Validatorunits|H1..2 K4/UT01/03;H3 K1/4/UT03/04/05;H4 K1/2/UT05/08;H5 K1/UT05;H6..7 K4/UT06;H8..9 K4/UT07;H10 K1/2/UT08.|
|Preparationhandler|H1..3 K2/HD02/04;kein anderer owning Vertragsumbau.|
|Handlerunits|H1..4 K2/7/HT02, H5..6 K1/5/HT04.|
|Prompt|H1 K3/PR01;H2 K3/PR04;H3 K3/PR05..09;H4 K3/PR09/10.|
|Fixturehelper/-constraints|H1..2 K4/FX02;H3 K4/FX05;H4..5 K4/FX07. Neuer Defekt002 inH3, keine unbekannte Frameworkschicht.|
|Evalharness|H1 K3/EV01;H2..3 K4/EV03/04;H4..5 K4/6/EV05/06;H6 K6/EV05/07;H7..8 K4/EV07.|
|AIunits|H1 K3/AT01;H2..3 K1/AT03/04.|
|Rendererunitprobe|H1 K1/4/PL02/X03;Recovery ergaenzte2/3 zur bestehenden1/4/5-Probe,kein Layoutedit.|
|Recipes-KB|H1/H6 KB01;H2/H3/H4 KB02;H4/H5 KB03;K8.|
|AI-Domain-KB|H1..8 KB04;H9..11 KB05;K8.|
|Backend-KB|H1/H2 KB06;K8.|
|AI-Tech-KB|H1..6/H8 KB07;H7..13 KB08;H14 KB09;K8.|
|API-KB|H1/H2 KB10;H3/H4 KB11;K8.|

Historie selbst gelesen: v12/13-/v14-/v15-/v16-/v17-Planaussagen, Q12/Q13/Q16, B1/B2-v14/B2-Preparation/B16/D16-Handoffs und relevante eigene/kumulierte Patchtexte. B1-Ausgangs-/Enddiff sind HEAD-kumuliert; Ruecknahme nachtraeglich aus passenden Basisblobs/Hunks abgeleitet. B16/D16 haben getrennte eigene Basis. Unbekannter v13-vor-v14-Snapshot fuer PR07/08/10 wird nicht durch v11-HEAD ersetzt. Historische Q13-Inhaltslogs/Timeouts und Q16-Vollerhalt-FAILs bleiben historische Findings, kein rueckwirkendes Kurzfassungs-PASS.

B18-Recovery-Red/Green ist ein gespeicherter rekonstruierter Baseline-Replay, kein wiedergewonnener Original-Redcapture; Generator von QA NICHT ausgefuehrt. Original-Livechronologie fehlt. Historische B18-Livecompletion10:23:20..10:27:19 UTC: F alle39 skipped/Exit0 korrekt UNVERIFIED, RPreparationFAIL/Imports8PASS, GPreparation+Daily2FAIL. Das sind B18-Ergebnisse, nicht eigene Q18A-Gates. D18 beschreibt diese datiert korrekt. Seine strikte Reverse-Kontextgrenze und historische D16-Grenze sind weiterhin nur whitespace-tolerant dokumentiert; eigener exakter LF-Inhaltsabgleich ist kein historischer Rohbyte-/EOL-Beweis.

Eigene Artefaktbytehashes: B18-Ausgang `096E4CA97562CA6681E6A758F5058AC669EC383165A5673D821E5FA75478FC97`; urspruenglicher Eigendiff `934AFD6DAE1DE44BDCB237B49F40D72CD44C129EF3346967B727409D40497312`; finaler Enddiff `DA861B25B8AF9BBAA91079B039E8F835E3017D4368C63D8CD323EF0474AFB40E`; D18-Eigendiff `C83B661C301C8019789A996A26BD762C8688554D1BE60E66C3FF7A5BA2091285`. Baseline-/End-/D18-Hashes entsprechen Handoffs.20 historische Artefakt-/Storyhashes stimmen Q18R. Q18R-Registryabweichung ist fremder Orchestratorstand/FT070, keine QA-Reparatur oder pauschaler alter49/49-PASS. Register seit eigener27-Pfade-Erfassung unveraendert.

### Test Successors

Source35-Verlustfaelle voll erhalten.35 gespiegelte Exportdetailnegative zielbedingt durch6 Kern-/Komponenten-/Zeitnegative plus Swap/Erfindung/erlaubte Auslassung ersetzt.20 Preparationdetailnegative durch8 Kern-/Widerspruchsnegative, rice/serve Swap und erlaubte vier Kerntexte ersetzt. Historische v15-Fuenftexte jetzt positiv unter NEUEM Vertrag; Q16 bleibt unter altem Vertrag FAIL. Vollcoverage-/Mismatch-/missing-only Negative wurden durch erlaubte Teiltracepositiven und echte globale Duplicate/Reorder/Unknown-Negative ersetzt, Nichtmutation erhalten. Privacytrigger echter Unknown99, alle Logger-/nested Marker unveraendert pruefbar. Gespeicherte-Basis-Negative bleibt mittels AI-onlyOrder2 gegen savedOrder1,422/usage0/no writes. Explicit0/1/4/5/6/90/91/no-source und reale Rendererprobe sichern Grenzen. Keine Testdatei/Schutzbatterie pauschal entfernt; Differenz1407->1397 ist kein Qualitaets-/Reduktionsziel. Defekt002 zeigt eine konkrete fehlende positive Kombinationsregression, nicht den Auftrag fuer eine neue Detailmatrix.

## Final Inventory Dispositions

Alle87 Q18R-Anker unten genau einmal als Definition; keine Umnummerierung. Die historischen Zweck-/Herkunft-/Alternative-/Risiko-/Ownerfelder der jeweiligen Q18R-Zeile bleiben Teil dieser dauerhaften Inventarbasis. Die folgende Matrix ergaenzt den aktuellen Symbolanker, eigene K-/Hunkbasis, finalen Nutzen und Disposition sowie Folgecheck. `I` implementiert, `R` historisch zurueckgenommen, `P` Plan-/Entscheidungsregel; PL-I bedeutet v18-Regel jetzt implementiert, nicht v17 ausgefuehrt. Handoffherkunft ist kein behaupteter zeitgleicher Originalcapture. Keine unbelegte persoenliche Urheberschaft.

Checks: V=102 Validatorunits, H=AI/Handler/Fingerprint-Slice288, R=34 Renderunits, F=1397/Typecheck/Build/Diff, L=eigene F/R/G, D=fuenf KB/Codeabgleich, P=exakte LF-/Byte-/Boundarychecks, S=in-memory Rubrikprobe. PASS bei Schutzcheck ist kein Gesamt-PASS. Fuer begruendetes Behalten bleibt die Alternative neuer Umbau No-op wegen unnoetiger Scope-/Regressionslast; fuer vollzogene Vereinfachung waere Rueckkehr zu exact-M/Vollpartition/blanket Detailpflicht falsch. Ausser explizitem Finding/Provenienzlimit keine weitere lokale Entscheidungsfrage. Risks entsprechen je Q18R-Zeile; neue Risiken/Blockingowner in Findings.

| ID | Current anchor / origin and state | Final disposition, purpose and evidence | Owner / next check or open question |
|---|---|---|---|
| PR-01 | [versions](../../../backend/src/lib/prompts/recipeAnalyze.ts#L6);R15/B16->B18H1,I |Vereinfachung K3 vollzogen:v16/v3,Guards/KB synchron;H/L/D.|Backend;Versionsdrift vermeiden.|
| PR-02 | [Preparation data boundary](../../../backend/src/lib/prompts/recipeAnalyze.ts#L9);P15/B16,I |Behalten K5:exklusiv,JSON als Daten,keine Reextraktion;H/L.|Backend;kein Addendum-Rueckbau.|
| PR-03 | [full fields](../../../backend/src/lib/prompts/recipeAnalyze.ts#L13);B16,I |Behalten K5:volle Strict-Felder kompatibel,kein V2-Persistenzauftrag;H.|Backend;Schemafork neue Freigabe.|
| PR-04 | [Preparation export core](../../../backend/src/lib/prompts/recipeAnalyze.ts#L24);B16->B18H2,I |K3-Packstrategie entfernt,selektiver Block;Code korrektes Ziel,Live001 offen.|Backend;L nur nach Kandidatenentscheidung.|
| PR-05 | [source steps](../../../backend/src/lib/prompts/recipeAnalyze.ts#L53);H13/H14/R15->B18H3,I |Sourcevollerhalt K7 behalten,nur Exportklausel K3 angepasst;V/L/P.|Backend;kein Sourcecap5.|
| PR-06 | [import export block](../../../backend/src/lib/prompts/recipeAnalyze.ts#L60);H14/R15->B18H3,I |K3 vereinfachen vollzogen:Auswahlkern statt All-details/Servepflicht;V/L.|Backend;wesentliche Beilage behalten.|
| PR-07 | [description word protection](../../../backend/src/lib/prompts/recipeAnalyze.ts#L61);Origin ungeklaert->B18H3,I |Neue K3-Autorisation,Wordabbruchschutz erhalten K7;P/V. Kein Restore.|Backend;v13-Zwischenstand fehlt.|
| PR-08 | [export mapping](../../../backend/src/lib/prompts/recipeAnalyze.ts#L66);Origin ungeklaert->B18H3,I |Exact-M/N<=5-1:1 ersetzt durch ordered subset,K3;V/L/P.|Backend;historischer Ursprung bleibt offen.|
| PR-09 | [subset/final rules](../../../backend/src/lib/prompts/recipeAnalyze.ts#L66);H14/R15->B18H3/4,I |Vollpartition/checklistduplikation entfernt,unique/ascending/no invention erhalten;V/P.|Backend;kein weiterer Packhelper.|
| PR-10 | [final JSON check](../../../backend/src/lib/prompts/recipeAnalyze.ts#L87);Origin ungeklaert->B18H4,I |K3 max/Teiltrace statt exactmin,Limits/Wordschutz behalten;V/P.|Backend;kein historischer Wortlautbeweis.|
| PR-11 | [remaining import rules](../../../backend/src/lib/prompts/recipeAnalyze.ts#L30);R15,I |Behalten K7:Kategorien/Mengen/Keys/Whitelist;H/P,R7/8,G8/8 Imports.|Backend;Importfinding003 separat.|
| VA-01 | [Analyze export schema](../../../backend/src/lib/recipeAnalyzeValidation.ts#L39);HEAD->B18H1..3,I |K1 min1/max5/90 explizit;V,R. Kein indirekter empty-Coveragecheck.|Backend;Grenzen erhalten.|
| VA-02 | [Preparation schema](../../../backend/src/lib/recipeAnalyzeValidation.ts#L61);HEAD->B18H3,I |K1 min1,Shape K5 text-only/unused ingredients unveraendert;V/H.|Backend;keine volle Importvalidation inV2.|
| VA-03 | [validateExportStepTrace](../../../backend/src/lib/recipeAnalyzeValidation.ts#L130);HEAD->B18H6,I |Source/export/local Checks behalten,globalunique/ascending ergaenzt;V/H.|Backend;keine Mutation/Sortierung.|
| VA-04 | [global flattened trace](../../../backend/src/lib/recipeAnalyzeValidation.ts#L197);R15->B18H6,I |K1 Coverage durch subsetschutz ersetzt,neue stabile Codes;V.|Backend;Duplicate/Reorder bleiben echte Fehler.|
| VA-05 | [diagnostic type/projection](../../../backend/src/lib/recipeAnalyzeValidation.ts#L76);R15->B18H4/5,I |K2 sourceStepTrace entfernt,nurphase/code/path;Nutzungssuche keine Resthelper.|Backend;generische Diagnose behalten.|
| VA-06 | [full validator/paths](../../../backend/src/lib/recipeAnalyzeValidation.ts#L116);HEAD,I |Behalten K7:safe paths/Ingredientkeys/food whitelist;V/H.|Backend;keine universelle Semantikregex.|
| UT-01 | [synthetic source/partitions](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L6);H14/R15->B18H1/2,I |Source behalten,eigenstaendiger Exportkern/alternative Gruppierungen K4;V.|Backend;keine Goldenpflicht.|
| UT-02 | [source loss tests](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L72);H14/R15,I |35 Sourceverluste/Swap/Temp beibehalten K4;V/P.|Backend;keine Sourceausduennung.|
| UT-03 | [export mutation/omission](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L99);H14/R15->B18H1..3,I |K4 zielwidrige35-Pflicht durch6negative/Swap/Temp/positive Auslassung ersetzt;V.|Backend;Nachfolger signalgerecht.|
| UT-04 | [border cases](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L166);H14->B18H3,I |K1/K4 0/1/4/5/6/90/91/blank/no-source;V/R.|Backend;Grenzfalsepositiven vermeiden.|
| UT-05 | [trace regressions](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L155);R15->B18H3..5,I |K1/K2 omissionpositiv,globale/lokale Fehler/Nichtmutation behalten;V.|Backend;kein IDrepair.|
| UT-06 | [historical v15 texts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L294);B16->B18H6/7,I |K4 gleicher Text jetzt Kernpositiv,alte Detailpflicht entfallen;V/P.|Backend;kein rueckwirkendesQ16-PASS.|
| UT-07 | [Preparation successors](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L329);P15/B16->B18H8/9,I |K4 achtnegative/Swap/vierKernpositive;V,neue erlaubte Kombinationsluecke002/S.|Backend;genauer lokaler Folgeauftrag.|
| UT-08 | [safe diagnostics](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L395);R15->B18H4/10,I |Generische Fehler behalten,Coveragepayload nur zielbedingt entfernt;V/H.|Backend;kein unsicheres Log.|
| FX-01 | [first-seven grounding](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L1);R15,I |K7 Inputs/Kategorien/Mengenconstraints unveraendert;P/L.|Backend;Sprayoelfehler nicht lockern.|
| FX-02 | [assertRecipeStepSemantics](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L72);H14->B18H1/2,I |K6 test-only Helper behalten;K4 positive/contradictions/source-backed Temp getrennt;V/S.|Backend;keine Runtime-/Frameworkextraktion.|
| FX-03 | [numbered source semantics](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L103);H14/R15,I |K4 volle Source1..8 unveraendert,V/L/P.|Backend;kein Exportziel auf Source uebertragen.|
| FX-04 | [saved fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L175);P15/B16,I |K5/K6 achtgespeicherte Source-/Kontextbasis behalten,H/L/P.|Backend;keine passend gemachte Eingabe.|
| FX-05 | [Preparation core](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L227);P15->B18H3,I |K4 eigenstaendige1/4/5/6-Rubrik statt blanketcopy;Defekt002 belegt,S.|Backend;lokale positive Regression benoetigt.|
| FX-06 | [eighth import input](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L371);H12/H14,I |K7 unveraenderte acht nummerierte Inputs,Source/Beilagenregression;P/L.|Backend;kein leichterer Fixtureersatz.|
| FX-07 | [import export core](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L380);H14->B18H4/5,I |K4 Kartoffel/Bohnen/Braten/Fertiggaren statt Sourcecopy;V,LFixture8PASS.|Backend;keine globale Servepflicht.|
| EV-01 | [two guards](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L46);R15/P15/B16->B18H1,I |K3/K6 synchron v16/v3;LGuardsPASS.|Backend;kein offlineguard als LivePASS.|
| EV-02 | [import evidence/semantics](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L142);H14/P15,I |K6 synthetic evidence/semantics-first behalten,L.|Backend;keine Counts-Verdeckung.|
| EV-03 | [count/order checks](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L170);H14->B18H2,I |K4 min1/max5/1..K,exactmin entfernt;V/L.|Backend;zero/padding nicht akzeptieren.|
| EV-04 | [source count/subset](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L215);H13/H14->B18H3,I |Sourceexact8 bleibt,Exportmembership/unique/ascending;V/L.|Backend;kein Sortieren beiderListen.|
| EV-05 | [real handler harness](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L260);P15/B16->B18H4..6,I |K6 delegierendeSDK-/Clientspies/Boundarysetup/Writecounts sinnvoll;H/L.|Backend;Mocks keine Providerantwort.|
| EV-06 | [separate matrices](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L315);B16->B18H4/5,I |K4/K6 Sourcevoll/Kernexport separat vor throw;Lzeigt001,FX05/S002.|Backend;unerreichte Erfolgschecks offen.|
| EV-07 | [final protections](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L367);P15/B16->B18H7/8,I |K5/K7 Schutz erhalten,Exportcount angepasst;H;spaetereLiveV2 nicht erreicht.|Backend;LerstnachfreigegebenemStand.|
| CL-01 | [AiRecipeRaw/strict schema](../../../backend/src/lib/openai.ts#L373);HEAD,I |K5 volle Shape/additionalPropertiesfalse behalten,H/P.|Backend;export-onlyFork neue Freigabe.|
| CL-02 | [RecipePreparationContext](../../../backend/src/lib/openai.ts#L506);P15,I |K5 kleineType/einowningConsumer sinnvoll,H/P.|Backend;kein strategyservice.|
| CL-03 | [analyzeRecipeText](../../../backend/src/lib/openai.ts#L522);P15/B16,I |K5/K7 optionalbranch/JSON/onecall/0.2/2048 unchanged,H/L/P.|Backend;kein Retry/Schemafork.|
| HD-01 | [context projection](../../../backend/src/functions/recipes.ts#L704);P15,I |K5 ID-freie gespeicherte Datenprojektion/identity behalten,H/L.|Backend;kein Reextrahieren/Sortieren.|
| HD-02 | [removed coverage helpers](../../../backend/src/functions/recipes.ts#L720);R15->B18H1..3,I |K2 max32/boundedOrderSequence/sourceTraceDiagnosticLogFields entfernt,Nutzungssuche/P.|Backend;kein toterDiagnoseauftrag.|
| HD-03 | [auth/body/owner/etag/quota](../../../backend/src/functions/recipes.ts#L721);HEAD,I |K7 owningSecurity unveraendert,H/F.|Backend;kein auth-/quotarefactor.|
| HD-04 | [saved validation basis](../../../backend/src/functions/recipes.ts#L787);P15->B18H2/3,I |K5 saved override behalten,K2coveragefind/spread entfernt,H/P.|Backend;AI-onlyOrder negativ bleibt.|
| HD-05 | [providerFailureLogFields](../../../backend/src/functions/recipes.ts#L675);HEAD/H14,I |K7 allowlistedproviderfields statt private message,H/P.|Backend;Response502 bestehende getrennte Boundary.|
| HD-06 | [usage/V2/completion](../../../backend/src/functions/recipes.ts#L815);HEAD,I |K7success-only Usage/textprojection/no persistence;H,Lcounts;keinqualitaetsclaim.|Backend;LiveV2-body weiterhin unerreicht.|
| HT-01 | [unsorted identity probe](../../../backend/src/functions/recipes.test.ts#L256);P15,I |K5 gespeicherte7,3 beweisen RequestNichtmutation,H.|Backend;nichtalsgueltigenRuntimeexportdeuten.|
| HT-02 | [privacy all logger args](../../../backend/src/functions/recipes.test.ts#L714);R15->B18H1..4,I |K2Unknown99trigger,K7alleMarker/nested/logwarnerror;H.|Backend;keine Coverage-/Rohlogs wiederherstellen.|
| HT-03 | [V2/error/invariants](../../../backend/src/functions/recipes.test.ts#L285);HEAD,I |K7text-only/unusedingredients/securityusagewrite Schutz erhalten,H/F.|Backend;keineSchutztestquote.|
| HT-04 | [saved authority/partial trace](../../../backend/src/functions/recipes.test.ts#L822);P15->B18H5/6,I |K1subset200/Usage1/no writes;AI-onlyUnknown422/savedbasis;H.|Backend;keineprivateHistoryrekonstruktion.|
| AT-01 | [exclusive SDK context](../../../backend/src/functions/ai.test.ts#L667);P15/B16->B18H1,I |K3v3literal,K5zweiKanaele/unsorted8,5identity;H/L.|Backend;keineContextsortierung.|
| AT-02 | [original import request](../../../backend/src/functions/ai.test.ts#L700);P15,I |K5Originaltext/Importprompt getrennt erhalten,H/P.|Backend;kein gemeinsamerExtractionmodus.|
| AT-03 | [auth/quota/provider/usage](../../../backend/src/functions/ai.test.ts#L728);H14->B18H2/3,I |K7Schutz unveraendert;K1missing-only durch echtenrefFehler ersetzt,H.|Backend;echte422/429/502bleiben.|
| AT-04 | [strict/key whitelist](../../../backend/src/functions/ai.test.ts#L827);H14/R15->B18H2/3,I |K5/K7Schema/0.2/2048/onecall/keys/foodwhitelist erhalten,H/P.|Backend;Sprayoel003nichtAssertionlockern.|
| KB-01 | [source/export rules](../../kb/domain/06-recipes.md#L94);H14/P15->D18H1/6,I |K8Sourcevoll/Exportteiltrace getrennt,D/P.|Documentation;keineVolltracebehauptung.|
| KB-02 | [Preparation contract](../../kb/domain/06-recipes.md#L185);P15/D16->D18H2..4,I |K8v16/v3/savedAuthority/V2/echte422,D/H/P.|Documentation;LF-Beweis nichtBytegeschichte.|
| KB-03 | [evidence/share boundary](../../kb/domain/06-recipes.md#L215);D16->D18H4/5,I |K8Geschichte behalten,B18datierteFAILs,noShareclaim,D/P.|Documentation;keinRueckdatieren.|
| KB-04 | [Recipe Analyzer](../../kb/domain/07-ai-features.md#L105);H14/P15/D16->D18H1..8,I |K8Versionen/Kern/subset,Source/Ingredientvertrag erhalten,D/P.|Documentation;keineNutritionneufassung.|
| KB-05 | [validation/preparation](../../kb/domain/07-ai-features.md#L194);P15/D16->D18H9..11,I |K8Runtimegrenze/V2/noWrite/alte-neueEvidence korrekt,D.|Documentation;200keinKochkernbeweis.|
| KB-06 | [diagnostics](../../kb/tech/02-backend.md#L264);R15/D16->D18H1/2,I |K8CoverageonlyDokuentfernt,genericphasecodepath/Privacybehalten,D/P.|Documentation;keinneuerInhaltslogger.|
| KB-07 | [versions/provider/source](../../kb/tech/06-ai-integrations.md#L66);H14/D16->D18H1..6/8,I |K8v16/v3volleStrictShape/Source/0.2/2048,D/H.|Documentation;historischeVersionenkontextbehalten.|
| KB-08 | [subset/preparation JSON](../../kb/tech/06-ai-integrations.md#L97);H14/D16->D18H7..13,I |K8max/Teiltrace/exklusiv/savedbasis,D/V.|Documentation;keinSchemaausbau.|
| KB-09 | [evidence boundary](../../kb/tech/06-ai-integrations.md#L136);D16->D18H14,I |K8B16FAILverbatimhistorisch,B18datierteGrenzen,D/P.|Documentation;Originalchronologieoffen.|
| KB-10 | [Preparation API](../../kb/tech/09-api-reference.md#L404);P15/D16->D18H1/2,I |K8Versionen/JSON/Strict/einCall;RouteBodyResponsegleich,D/H.|Documentation;keinDTOwechsel.|
| KB-11 | [remaining422/evidence](../../kb/tech/09-api-reference.md#L429);D16->D18H3/4,I |K8Gapsnicht422,echte422/Runtimegrenze/evidencebehalten,D/V.|Documentation;keinpauschaler422-Wegfall.|
| RB-01 | [temperature rollback](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch#L68);R15,R |K7Ruecknahme0->0.2 erhalten,H/P;rekonstruiertnichtOriginalcapture.|Backend;keinTemperaturversuch.|
| RB-02 | [example/planning rollback](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch#L10);R15,R |K7konkreteRuecknahmenbewahrt,K3neuerExportvertraggesondert,P.|Backend;keinWhole-fileRestore.|
| RB-03 | [privacy rollback history](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md);H13/H14/R15,R |K7Rawcontentlogverbotbehalten,H/P;keinzeitgleicherkompletterLoggingdiff.|Backend;historischeCapturegrenze.|
| PL-01 | [source/subset rule](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L44);V17/V18,P->I |K1/K5/K7vollsource/ordereduniquesubset umgesetzt,V/H/P.|Backend;v17nichtausgefuehrt.|
| PL-02 | [template bounds](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L46);V18,P->I |K1/3/4min1max5/90/keinpadding;1..5Probe,R/V.|Backend;Layout/AssetsNo-op.|
| PL-03 | [core/omission/contradiction](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L49);V18,P->I |K3/4getrennteKernrubrik,aber001/002offen,L/S.|Backend;keineuniverselleTaxonomie.|
| PL-04 | [no-source/min1](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L53);V18,P->I |K1explicit.min1/no-sourceUnknown/keinFallback,V/H.|Backend;keineerfundeneOrder.|
| PL-05 | [K1/K2](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L65);V18,P->I |Validatorvereinfacht,Coverage-onlyhelperentfernt;V/H/P.|Backend;keinTraceframework.|
| PL-06 | [K3/K4](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L67);V18,P->I |Exportbloecke/Nachfolgervereinfacht;V,L/S002offen.|Backend;gezielterpositiverRegressionstest.|
| PL-07 | [K5/K6/K7](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L69);V18,P->I |BestehendeOwnership/StrictHarness/Schutzbehalten,H/P.|Backend;keinegenericServices.|
| PL-08 | [K8](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L72);V18,P->I |Nur5KB-Dateien angeglichen,D/P.|Documentation;keinehistorischeBereinigung.|
| PL-09 | [finite decision boundary](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L109);V18,P |No-opzusatzlistebewahrt;neueFindingsnurueberkonkreteFreigabe,P.|Planner;keinautomatischerRefactor.|
| PL-10 | [gates/single conditional C](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md#L138);V18,P |EigeneF/R/G/F/D/Pausgefuehrt;Abschlussrot,keinCgestartet.|QA;genauerOrchestratorauftrag/Stop.|
| X-01 | [owning import](../../../backend/src/functions/ai.ts#L519),[HTTP helper](../../../backend/src/test-utils/http.ts#L1);HEAD,fremdeBoundary |Behalten;keinHEAD-Diff,auth/quota/fullvalidation/usage/preview/JWThelpersgelesen,H/P.|Backend;keinImportimplementierungsauftrag.|
| X-02 | [package](../../../backend/package.json),[unit config](../../../backend/vitest.config.mts),[eval config](../../../backend/vitest.eval.config.mts),[runner](../../../backend/scripts/run-eval.mjs);HEAD |Behalten;keinDiff/Dependencies/Timeoutedit;30s,normalexclusion,seriallive/exit2geprueft,F/L/P.|Backend;all-skippedniePASS.|
| X-03 | [production template](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts#L347),[probe](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts#L332);HEAD->B18probe |Produktion behalten/kein Diff;ein zulaessiger Probehunk neu,1..4 large/5 compact,width/height gates,R/P.|Backend;keine Layouthacks.|
| X-04 | [Shared limits](../../../shared/types/recipeExport.ts),[DTO](../../../shared/types/recipes.ts),[save validator](../../../backend/src/lib/recipeValidation.ts),[save tests](../../../backend/src/lib/recipeValidation.test.ts);HEAD |Behalten/keinDiff;text-onlyV2,confirm/fingerprint/IDs/seasoning/strictdraftgelesen;H5Save/F/P.|Backend;Cosmos/deployed/devicekeinClaim.|
| X-05 | [highlight tests](../../../backend/src/lib/instagramRenderer/__tests__/highlight.test.ts),[tags tests](../../../backend/src/lib/instagramRenderer/__tests__/tags.test.ts);HEAD,fremdeBoundary |Behalten/keinDiff;Pixel/Asset/layout/chipSchutzgelesen,Vollsuitegruen,F/P.|Backend;historischeTimeoutursachenoffen.|
| X-06 | [registry](../findings.md#L902),[historical Q16](PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md);Orchestrator/Historie |Read-onlybewahrt;FT063..070/VER015keinClosure,Q13Detailbasisfuer064..066;P.|QA;RegistryentscheidnurOrchestrator.|
| X-07 | [overall eval boundary](../../../backend/vitest.eval.config.mts);Daily/Scale/Weekly/mobile/infra/fremd |KeinekonkretenSerienhunksaussergenannten9/5;F/GalsGates,keineOwnershipausweitung;Daily004.|Planner;separaterfremderAuftrag.|

### Newly Added Evidence Surfaces

Diese neuen Artefakte ergaenzen die87 Anker; sie ersetzen keine historische Inventar-ID. Zustand jeweils I als Evidenz, nicht Produktionsfeature. Owner Backend fuer B18-Artefakte, Documentation fuer D18-Artefakte. Die Generatoren sind einmalige Capture-/Rekonstruktionshilfen und werden weder von Produktion noch regulaerer Test-/Releasekonfiguration konsumiert. Ihre breite641/797-Pfade-Bewahrung ist archivalische Evidenzlast, keine neue Runtimearchitektur oder genehmigte globale Hashpipeline als Feature. QA hat sie nicht ausgefuehrt und kopiert diese Last nicht in eine neue Frameworkschicht.

| ID | Artifact / basis | Disposition, benefit, alternative and risk / next check |
|---|---|---|
| NA-01 | [B18 baseline patch](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_Ausgangsdiff_2026-10-09.patch);HEAD-kumuliert |Behalten als Basisevidenz,nicht eigenerEditdiff;P/Bytehash. Alternative HEADrestore falsch;historischeZeitgrenze offen.|
| NA-02 | [B18 original own patch](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_EigenerDiff_2026-10-09.patch);vorgefunden |Behalten original9/46,Renderer1/4/5;Enddiffklarseparat. KeinUeberschreiben zum historischenGruen;P.|
| NA-03 | [B18 end patch](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_Enddiff_2026-10-09.patch);Recovery9/46 |Behalten finalzugeordneteHunks/2-3Probeergaenzung;P. LFbelegtkeineOriginalchronologie.|
| NA-04 | [B18 preservation JSON](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_Preservation_2026-10-09.json);18Invarianten |Behalten Datenmanifest;Inputs1..8/constraints1..7/source/prepbasis durchPpatchseparatbestaetigt. KeinTestlaufersatz.|
| NA-05 | [B18 offline evidence](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_OfflineEvidence_2026-10-09.json);Recovery |Behalten Replay/exits/hashbasisalsRecovery,nichtOriginalRed;keinenHistoryreplaystarten. EigeneV/H/R/FstattgeerbterPASS.|
| NA-06 | [B18 verifier](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_Verification_2026-10-09.mjs);Evidence-only |Behalten archivalisch:rekonstruiertBaseline/isolierterIndex/Gates. Nichtregulaererneutausfuehren,schreibtEnddiff/Evidence. KeinezusatzServiceabstraktion;Read-onlyreview.|
| NA-07 | [B18 live evidence](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_LiveEvidence_2026-10-09.json);3historischeCaptures |Behalten komplettebereinigteSynthetik/641Hashmanifest;Gate1UNVERIFIEDkorrekt. NichtalsQ18AoderWhole-callcountsdeuten;P/L.|
| NA-08 | [B18 live capture](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_LiveCapture_2026-10-09.mjs#L70);Evidence-only |Archivalischer Nutzen:one gate/order/freeze/redaction;auto Exit0=>PASS Defekt005. Keine automatische Weiterverwendung/Reruns;genaue Werkzeugentscheidung.|
| NA-09 | [B18 handoff](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md);Recovery/completion |Behalten Scope/46Hunkmapping/Ersatzmatrix/offeneChronologie/FAILs. KeinBackend-SelbstQA;P/Lunabhaengig.|
| NA-10 | [D18 own patch](../../User%20Stories/Reciepe/D-18_Recipe-Kurzfassung_EigenerDiff_2026-10-09.patch);5/37 |Behalten engK8/KB01..11;exakteLF-VorstaendeP. Strictreverse/EOLhistorischnichtalsBytePASS.|
| NA-11 | [D18 handoff](../../User%20Stories/Reciepe/D-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md);KB-only |Behalten Mapping/129+69-/797historischerBewahrung und offeneB18Gates. KeinFeature-/QA-/Releasepass;D/P.|

Keine neue relevante unzugeordnete Produktionshunkgruppe gefunden. Kumulative10 Backendpfade enthalten unchanged-vs-Q18R Client als historische Serienarbeit; eigeneB18-Edits nur9 Pfade einschliesslichProbe. Weitere5 KB undRegistryfremd. NA-06/08 sind keine notwendige neue Laufzeit-Hilfsschicht: ihre Archivierung bewahrt Herkunft, wiederverwendbare Verifikationsinfrastruktur daraus waere nicht autorisiert. Finding005 ist konkreter Klassifikationsdefekt, nicht Loeschvollmacht fuer Geschichte oder gesamte Evidenz.

## Eight Technical Review Aspects

1. Ownership/Abstraktionen: beide Runtimepfade teilen owning Tracevalidator;Handler besitzt saved authority/auth/Usage;Client besitzt genau einen Strictrequest. Contextbuilder/kleineType tatsaechlich benoetigt. Testhelper hat nur Unit-/Evalconsumer,keinRuntime-Vitestimport. Kein weiterer Service-/Mode-/Strategierefactor begruendet.
2. Provider/Promptduplikation: volle AiRecipeRaw-Shape ist bewusste Kompatibilitaetslast;notwendige Ingredient-/Metadatenfelder sind nicht freiwillig entfernbar. Beide Exportbloecke jetzt kompakt/konsistent,alteexact-M/all-detailPackkonkurrenz entfernt. Export-onlySchema waere anderer Scope. Live001 widerlegt ausreichende Wirkung,nicht einen belegtenTokenmangel.
3. Validierungskomplexitaet: Source-/Export-/lokaleRef-/globaleSubsetchecks besitzen unterschiedliche Fehlerauftraege. K1 globalDuplicate/Reorder ersetzt nur Vollcoverage;K2 exclusivetracehelpers restlos entfernt,genericdiagnostics bleiben. Kein weiterer redundant/toter owningPfad belegt;keineuniverselleSemantikregex inRuntime.
4. Garantien: strukturgruene200/Usage1/fuenfTexte koennen fehlendesFertiggaren enthalten. Sourceidentitaet,Promptintent,fixturebezogeneRubrik,Rendererpassung und Nutzerreview getrennt. Keine allgemeine Wichtigkeits-/Sicherheits-/Stabilitaetsgarantie. Die neue Fehlalarmregex002 ist kein berechtigtes neues Produktverbot.
5. Testsignal: Sourceverlust35 erhalten;Exportpflichtzweck gezielt geaendert,6/8negativeNachfolger/Swap/invention/boundaries/security erhalten.1397 statt1407 keine Qualitaetsquote. Fehlende positive Kombinationsprobe002 konkret nachrouten;keine neue enorme Detailmatrix oder Assertionlockerung fuer001/003/004.
6. Fixtures/Harness: Source8/Preparationinput unveraendert,Source/Kernexportmatrizen getrennt. DelegierendeSpies/JWT/in-memoryRepository undWriteSpiesnachSetup rechtfertigen die bestehende Komplexitaet. Failfastgrenze ehrlich dokumentiert. Neue archivalische Generatoren nicht zum neuen Testframework machen;NA08klassifikationsfehler konkret005.
7. Debug/Privacy: allelog/warn/errorArgumente/nestedMarker bei echtemUnknownfehler gruen. Genericphase/code/path bounded,providerfields allowlisted,keineCoverage-onlyrestfelder. Nur synthetischeRawwerte hier;Secrets/Endpoints/Privatrezepte nichtuebernommen. Existierende502response ist separateBoundary,keinunbeauftragterAPIumbau.
8. Doku/Version/Geschichte: v16/v3 undGuards/5KB korrekt;v18 istPlanrevision. HistorischeB16FAIL/gestoppteRuns/Originalchronologie nichtumgeschrieben. Storyauslegungskonflikt explizitdurchgenehmigteExportklarstellungbegrenzt;keine neue relevanteKB-Codeabweichung. KB dokumentiertB18-Zeitbasis,nichtheutigeQA-Zahlen.

## Verification Notes

### UNVERIFIED

| Check | Owner / prerequisites and next step | Expected result / result |
|---|---|---|
|OriginalB18Red-/Livechronologie|QA;Orchestrator liefert vorhandene unveraenderte Originalcaptures falls verfuegbar,keinNachbau einerhistorischenZeitfolge.|OriginalzeitlicheEvidenceoderexplizitnichtrekonstruierbar;OFFEN,ReplaybleibtReplay.|
|SpaetereLiveV2-/Usage-Order-/fullmetadata-/IDassertions|Backend;erstnachkonkretautorisiertemkorrektemKandidaten,danachunabhaengigeQA desechtenHandlers.|AlleAssertionsnachRubriktatsaechlicherreicht;OFFEN,beobachteteCountsundUnitPASSkeinersatz.|
|PR07/08/10Urspruenge/v13Zwischensnapshot|Planner;vorhandenezeitgleicheHunkevidenzbereitstellenfallsverfuegbar,keinHEAD-v11Restore.|BelegoderbleibendeHerkunftsgrenze;OFFEN,neueK3Semantikabernichtblockiert.|
|HistorischeD16/D18Strictreverse-/Byte-EOLgrenze|Documentation;historischeOriginalbytesnurfallsvorhanden,nichtnormalisierendrestaurieren.|BytebeweisoderoffeneGrenze;OFFEN. EigenerexakterLF-Patchbeweisgegeben.|
|Importraws1..7/gesamteProviderzahlen|QA;vorhandenerHarnessgibtdiesnichtaus,keinextraprivaterCaptureoderweitererCallgenehmigt.|KeineungemessenenRaw-/Callbehauptungen;OFFEN. Testresultate R/Gbeobachtet.|

Diese fehlenden oder unerreichten Nachweise sind keine zusaetzlichen actionable Findings und allein kein Grund fuer das Urteil. Urteil folgt den tatsaechlich ausgefuehrten Fehlern. Historische VER015-Serienruns2/3 bleiben gestoppt;v18 verlangt keine Ersatz-Dreierserie.

### MANUAL VALIDATION REQUIRED

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
|Privates Originalrezept|Planner/QA:autorisierteOriginaldaten,bekanntedeployedRevision,gesonderterprivaterTestauftrag.|NachautorisierterKorrektur privatSource/gewichtigteKochaktionen/Preparationresponsevergleichen;keineInhaltsuebernahmeinsRepo/Logs.|BrauchbarekurzeKochanleitung/200/unveraenderteSource/keinePrivatinhaltslogs.|OFFEN:Daten/Revisionfehlen,keinReplay.|
|Alpha/echtesShare-/Save-/DeviceEnd-to-End|Infrastructure/Frontend/QA:nachbestandenenGates/Merge gesonderteRelease-/E2EFreigabe undpassendeUmgebung.|AutorisiertenWorkflowunterrealemNutzerreview/confirm/render/sharepruefen,ohneScopehierauszuweiten.|KorrektesReview/Save/Fingerprint/PNG/ShareohnezusatzAI/Persistenznebenwirkungen.|NICHT AUSGEFUEHRT;keinDeployment/E2E-ErfolgausSynthetik.|

Keine Cosmoscontainer-/Repositoryaenderung:kein neuer Contracttestauftrag. KeineMobile-/Nativeaenderung:keinDevice-/Mobiletypecheckgatefuerdiesereview. Produktionsrendererunveraendert:vorhandenerealeRender-/Overflowgatesgeprueft,keinLayout-/Assetreparaturauftrag.

## Findings

Finding key: Q18A-PREPARATION-CORE-001  
Plan reference: [v18 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)  
Acceptance criterion: AC-3; AC-8; AC-14; US-10 AC-15/16  
Description: Alle drei eigenen echten Preparationantworten behalten die volle Source, exportieren aber ausschliesslich [1]..[5] und verlieren Fertiggaren6. Status200/Usage1 und korrekte5/90-Struktur sind kein Kochkernerfolg. Optionales Ruhen/Servieren allein waere erlaubt;fehlende6 ist verbindlicher Kernverlust.  
Criticality: Blocking  
Owner: Backend  
Evidence: [Preparation core assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L231), [live check](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L367);F/R/G Exit1,gemeinsame Exportsteps/gesamte Source-/Kernmatrix oben. Inventar PR-04/FX-05/EV-06/PL-03.  
Risk: Unvollstaendige Kochanleitung wird strukturgueltig zur Nutzerpruefung angeboten;kein allgemeiner Runtimekochschutz.  
Recommendation: An Orchestrator/Planner fuer eine genaue weitere Kandidatenentscheidung zurueckgeben;keine neue Promptserie automatisch starten. Die Alternative,aktuellen200 als Erfolg zu akzeptieren,verletzt den genehmigten Kern. Nach autorisierter Korrektur denselben Input und dieselbe Kernrubrik nutzen,einen vorab festgelegten echten Handlerlauf sowie Recipe-/Gesamtgates pruefen;keine Limit-/Assertionlockerung oder verdeckter zweiter Call.

Finding key: Q18A-RUBRIC-FALSE-NEGATIVE-002  
Plan reference: [v18 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)  
Acceptance criterion: AC-3; AC-13; AC-14  
Description: Die neue K4-Widerspruchsregex fuerOrder6 matcht gare bis reis ueber die Servierklausel. Der erlaubte Text `Gare H\u00e4hnchen fertig und serviere es mit Reis.` bei[6,8] scheitert als Contradiction at6,obwohl volle Source/richtiger Kern/beide Validatoren/Nichtmutation/90 gruen sind. Die Rubrik schreibt so indirekt eine unbegruendete Gruppierungs-/Satzgrenze vor.  
Criticality: Blocking  
Owner: Backend  
Evidence: [source6 contradictions](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L231), [helper negative loop](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L88);eigene In-memory-Probe oben. Inventar FX-05/FX-02/UT-07/EV-06;B18 FixtureH3,K4/K6.  
Risk: Gueltige Kurzfassung als FAIL/erneutes Prompttuning behandelt;Positivabdeckung fuer zulaessige Gruppen unvollstaendig. Keine Erklaerung fuer001.  
Recommendation: Genau diesen lokalen Rubrikhunk und die positive Kombinationsregression an Orchestrator routen. Ein begrenzter C-Durchlauf nur mit konkreter Beauftragung innerhalb K4/K6;keine allgemeine Semantikarchitektur. Die Alternativen,Serviertext aus gueltigen Tests zu entfernen oder alle Contradictions zu loeschen,verwerfen:dies verletzt Flexibilitaet beziehungsweise Negativschutz. Minimaler Kern und richtige Kombination positiv;fehlende6/falsche Komponente/falsche Zeit/Swap/invention weiterhin negativ. V/H/Recipe-/Gesamtgates,Dokuabgleich und erneute unabhaengige QA erforderlich.

Finding key: Q18A-IMPORT-GATE-003  
Plan reference: [v18 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)  
Acceptance criterion: AC-8; AC-14  
Description: Das separate verpflichtende Recipegate liefert bei unermessenem Sprayoel amountGrams0.01 statt null.7/8 ImportPASS,1FAIL;spaeteres G8/8 hebt R-FAIL nicht auf. Keine Kausalitaet durch B18 behauptet,keine zutatenbezogene Scopefreigabe aus der Exportkorrektur.  
Criticality: Blocking  
Owner: Backend  
Evidence: [amount assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L76), [ingredient constraints](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L317);R Exit1, `Spruehoel: expected amountGrams to be null: expected 0.01 to be null` (ASCII-Umschrift). Inventar PR-11/FX-01/AT-04/X-01.  
Risk: Erfundene Kleinstmenge statt unbestimmter Menge und ungerechtfertigte Gateclosure.  
Recommendation: Orchestrator/Planner entscheidet einen separaten abgegrenzten Importanalyse-/Korrekturauftrag;keine Importklassifikationsreparatur im C-Durchlauf oder Lockerung null->positive. Die Alternative,G-PASS als R-Ersatz zu behandeln,verwerfen. Unveraenderte acht Inputs/Constraints und Pflichtgates nach freigegebenem Stand pruefen;keine zufaellige Gruensammlung.

Finding key: Q18A-OVERALL-DAILY-GATE-004  
Plan reference: [v18 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)  
Acceptance criterion: AC-8; AC-14  
Description: Das Gesamtgate hat vier fremde Daily-FAILs:protein-gap-with-budget/stale-weight bewerten den offenen Tag als abgeschlossen;protein-nearly-complete behauptet erreichte Energiebilanz aus einer Zieldifferenz;midday-empty-day-not-morning fehlt verbindlicher aktueller Tagesbezug. Die Fehler sind unabhaengig von Recipe auftragsfremd,keine B18-Kausalitaet behauptet.  
Criticality: Blocking  
Owner: Backend  
Evidence: [daily live checks](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L23), [budget validator](../../../backend/src/lib/dailyInsightValidation.ts#L230), [energy balance validator](../../../backend/src/lib/dailyInsightValidation.ts#L289);G Exit1,5FAIL/34PASS,Daily4FAIL/14PASS. Inventar X-07/PL-10.  
Risk: Pflichtgesamtgate ungeklaert und falsche Dailybewertungen;keine Recipe-Reparaturautorisation.  
Recommendation: Vier konkrete Faelle separat durch Orchestrator/Planner routen;Daily-/Runner-/Timeout-/Skipchecks unveraendert lassen. Die Alternative,Daily zu ignorieren und Gesamtgruen zu behaupten,verwerfen. Eigenes fokussiertes Daily-Review und unveraendertes Gesamtgate vor Abschluss;nicht im Recipe-C-Durchlauf implementieren.

Finding key: Q18A-CAPTURE-RESULT-005  
Plan reference: [v18 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)  
Acceptance criterion: AC-12; AC-14 (neue Hilfsartefakte); AC-8 Gateehrlichkeit  
Description: Die neue Evidencehilfe setzt result allein von Exitcode0 auf PASS und erkennt keine all-skipped-Ausfuehrung. Ihr tatsaechlicher historischer Gate1 hat Exit0/39skipped;dauerhaftes JSON/Handoff wurden korrekt als UNVERIFIED eingeordnet,aber der Generatorcode tut dies nicht. Der persistierte Report ist nicht falschgruen;der Defekt betrifft ungepruefte Wiederverwendung der neuen Hilfe.  
Criticality: Non-blocking  
Owner: Backend  
Evidence: [capture result classification](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_LiveCapture_2026-10-09.mjs#L70), [corrected historical evidence](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung_LiveEvidence_2026-10-09.json);NA-08/NA-07 undX-02. Keine Ausfuehrung durch QA.  
Risk: Zukuenftige Archivevidenz kuenstlich gruen und ueberfluessige wiederverwendbare Werkzeugschicht;Produktionspfad nicht betroffen.  
Recommendation: Orchestrator/Planner entscheidet genau zwischen Archival-No-op und gezielter Klassifikationskorrektur;kein unbekannter Werkzeugedit oder Historyrewrite automatisch. Die Alternative,nur Exitcode0 zu vertrauen,verwerfen. Falls Wiederverwendung genehmigt,einen lokalen all-skipped/echterPASS/FAIL/Exit2-Ausgabecheck ohne Provider erarbeiten;Originalcaptures/Resultate nicht ersetzen. Keine globale Hash-/Evalframeworkerweiterung.

## Report Integrity And Handoff Boundary

Der unmittelbare fokussierte Berichtcheck bestand: exakt14 Plan-ACs,2 Story-ACs,87 Originalinventar- und11 Neuartefaktdefinitionen,alle5 Findings mit Pflichtfeldern und2 parsebare synthetische JSON-Bloecke mit exakter Gleichheit zur beobachteten Fokusantwort. Links/ASCII/Privacy bestanden. Eine erste CRLF-sensitive Fenceabfrage war ein Checkparserfehler,kein fehlender Rawcapture;nach Parserkorrektur bestanden. Der finale Berichtstand wird mit demselben Check nochmals validiert.27 geschuetzte Kandidatenbytehashes unveraendert,Rootdiff/Index Exit0,keine Markdowndiagnosen. Nur dieser neue Bericht manuell angelegt.

Das Ergebnis ist ein Befundhandoff und Stop fuer Implementation,nicht Start von B18C/D18C/Q18C. Orchestrator entscheidet die genaue Korrekturliste:002 ist eine belegte genehmigte Rubrikregression mit potentiellem begrenzten Folgepfad,001 braucht eine Kandidatenentscheidung,003/004 separate Auftraege,005 eine konkrete Werkzeugentscheidung oder Archival-No-op. Neuer Scope/Shape/Produkt-/Architekturwechsel braucht neue Freigabe. Kein Registryabschluss/Release bei Blockingbefunden;keine historische Erfolgserfindung.
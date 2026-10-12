# QA Report: Q-16 Preparation-Inhaltserhaltung v16

- Format: `fittrack-qa-v1`
- Plan reference: [PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md)
- Verdict: FAIL
- Review date: 2026-10-09
- Agent: FitTrack QA, unabhaengiges Q-16 nach ausdruecklicher v16-Freigabe.

## Scope

Vollstaendiger freigegebener v16-Plan unveraendert gelesen und gegen den aktuellen Kandidaten geprueft, einschliesslich AC-1..7, Scope/Out of Scope und Gatefolge Abschnitt 6. Alle B-16-/D-16-Pakete wurden laut Auftrag ausgefuehrt; keines wurde als uebersprungen behandelt. Ihre Handoffergebnisse sind keine eigenen QA-Laufergebnisse. Diese QA hat Code, Tests, KB, historische Artefakte und Register nicht geaendert; nur dieser frische Report wurde angelegt. Kein Deployment, Commit, Branch, B-1-Wiederholung, Import-/Renderer-/Daily-Insightfix oder anderer Implementierungsauftrag.

Originalanforderung: "bitte korrigierne, ich will dass das feature endlich funktioniert." Historische Nutzerevidenz: `recipes-prepare-export-view`, 422 um 12:48:42 UTC, operation_Id `a9f0b3adf10d2c4e2ab866d38d6b65ae`; Source 1..8, Export `[1],[2],[3],[4],[6,7]`, fehlende Orders 5/8, Mismatch 5/5/6, kein share-bundle. Originaltexte und deployed Revision sind unbekannt. Die heutigen synthetischen Laeufe sind kein Historical Replay und keine neue Telemetrieabfrage.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Exklusiver Preparation-v2-Systemprompt, genau zwei Nachrichten, JSON nur im Userkanal, originale Steps/Identitaeten und ein SDK-Call: [SDK-Requesttest](../../../backend/src/functions/ai.test.ts#L667), [Client](../../../backend/src/lib/openai.ts#L522), eigene fokussierte 294/294 Tests. Import-v15-Koerper exakt gegen den aus B-1-Enddiff rekonstruierten Stand verglichen; Guards kompatibel. B-16-Red/Green ist historische repository-backed Evidenz, nicht von QA erneut erzeugtes Red. Kein neues Schema, Vertragsfeld oder Verfahren. |
| AC-2 | FAIL | Eigener realer Handler-/Client-/Providerlauf der unveraenderten Acht-Schritt-Fixture: mittlere Hitze, Abdeckung und komplette Order 8/Servieren fehlen. Fuenf Gruppen und Laengen 66/73/65/56/62 sind korrekt, Inhalt/Trace nicht. Vollmatrix und exakte synthetische Rohgruppen unten. Handler 422, kein erfolgreicher Inhaltsfix. |
| AC-3 | PASS (offline) | [Negativfall](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L217) enthaelt exakt die originalen fuenf synthetischen v15-Gruppen aus B-2: Runtime gruen, Rubrik rot fuer 1/2/3/4/7. Beide Positivpartitionen, 20 Detailmutationen und Reis-/Serviertextswap unveraendert, eigenstaendig ausgefuehrt. Keine Assertion-/Input-/Limitlockerung; kein allgemeiner Runtime-Semantikschutz. Dieser PASS schliesst keinen v15-Livefehler. |
| AC-4 | PASS (Code/Units; Live-Ablehnung bestaetigt) | [Historischer numerischer Handlertrace](../../../backend/src/functions/recipes.test.ts#L844) und [Validatortrace](../../../backend/src/lib/recipeAnalyzeValidation.test.ts#L138): 422/source_step_coverage_mismatch/5/5/6 gegen gespeicherte 1..8, selbst bei verkuerzter Modellsource; ein Analyzeaufruf, Usage 0, keine Writes/Reparatur/Retry. Auth, optionales exaktes ETag vor Quota, 429/502, Strict/einCall/UsageNurErfolg, Boundaryfehler, V2/Text-only/Transienz und log/warn/error-Privacytests bestehen. Heutiger Livefehler ist Position 8, nicht der historische 5/5/6-Trace. |
| AC-5 | FAIL | Vor Lauf 1 genau drei aufeinanderfolgende vollstaendige Preparationlaeufe desselben eingefrorenen B-16-Kandidaten festgelegt. Lauf 1 Exit 1, Source-/Exportrubrik rot, Handler 422 statt 200; Lauf 2/3 nach erstem Fehler gestoppt, UNVERIFIED. Keine Ersatzserie, Promptnachbesserung oder Zufallspasses. Ein SDK-/Analyzecall, gespeicherte Fixture vor Aufruf und unveraenderte Daten/ETag nach Aufruf bestaetigt. |
| AC-6 | FAIL | Eigene 294 fokussierte / 1407 normale Unit-Tests, Typecheck, Build und Rootdiff gruen. Separates Recipegate Exit 1: acht Imports 0/8, Preparation FAIL, zwei Guards PASS. Gesamtgate Exit 1: 9 FAIL/30 PASS, sieben Importfehler plus Preparation und ein fremder Daily-Insightfehler. Keine fehlenden Credentials/Exit 2; keine Live-Skips in beiden Vollgates. Abschluss/Merge-/Releasefreigabe bleibt blockiert. |
| AC-7 | PASS (Herkunft/Dokumentation/QA-Grenze) | Eigene B-16-/D-16-Hunks vollstaendig gelesen, exakt LF-normalisiert im Speicher rueckwaerts rekonstruiert und gegen Handoffvorstaende geprueft. Import-v15/B-1-Ruecknahmen und drei offene Importhunks erhalten. Fuenf KB-Dokumente stimmen mit Code, Privacy und Runtime-Inhaltsgrenze ueberein und behaupten keinen Livefix. Eigene unabhaengige Gates; 789 Schutzdateien unveraendert. Keine allgemeine Finding-Schliessung, Registeraenderung oder Deployment. Strikter D-16-Reverse-Kontextfehler unten explizit erhalten. |
| US-10 AC-15 | PASS (kontrolliertes Blockieren) | [Story-Kriterium 15](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md#L255): semantische Verdichtung auf hoechstens fuenf ODER kontrolliert blockierter Export. Der echte Handler blockiert den unvollstaendigen Trace mit 422 und veraendert das Rezept nicht. Das ist kein erfolgreicher Preparationfix und kein Renderer-/Share-Nachweis. |
| US-10 AC-16 | FAIL | [Story-Kriterium 16](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md#L257): mittlere Hitze und zugedecktes Ruhen fehlen in ihren referenzierenden Texten, finales Servieren/Reisbeilage fehlt vollstaendig. Sourceidentitaet, Count und Zeichenlimit allein genuegen nicht. |

## Tests

Alle Produktgates selbst am unveraenderten Kandidaten ausgefuehrt, vom Workspace-Root ueber npm-workspace; aequivalent zu den im Plan geforderten Backendbefehlen. Zeitangaben `Start at` sind lokale Runnerzeiten; Handlerzeiten sind UTC. Befehle sequenziell: fokussierte Units, Serie bis Erstfehler, separates Recipegate, Gesamtgate, normale Vollsuite, Typecheck, Build, Rootdiff. Zusatzchecks unten sind read-only Provenienzchecks, keine Ersatzgates.

| Command | Exit code | Result |
|---|---:|---|
| `npm exec --workspace=backend -- vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts` | 0 | PASS: 294/294, drei Dateien, Start 10:38:47, 1.52 s. AI 78, Handler 102, Validator/Rubrik 114. |
| `npm run test:eval --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"`, Serienlauf 1 | 1 | FAIL: Preparation 0/1, Guard 1/1, neun bewusst abgewahlte Tests; Start 10:39:10, 10.03 s. Handlerstart 08:39:11.203Z, Ablehnung 08:39:20.157Z. Kein Import-/Gesamt-PASS aus der Selektion. |
| Derselbe Serienbefehl, vorab festgelegter Lauf 2 | nicht ausgefuehrt | UNVERIFIED: planmaessiger Stop nach erstem FAIL, kein Ersatzlauf. |
| Derselbe Serienbefehl, vorab festgelegter Lauf 3 | nicht ausgefuehrt | UNVERIFIED: planmaessiger Stop nach erstem FAIL, kein Dreiernachweis. |
| `npm run test:eval --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts` | 1 | FAIL: 9 FAIL/2 Guard-PASS; Imports 0/8, Preparation 0/1, keine Live-Skips; Start 10:39:39, 82.09 s. Preparation 08:40:54.082Z bis 08:41:01.973Z. Separates Pflichtgate, kein Serienersatz. |
| `npm run test:eval --workspace=backend` | 1 | FAIL: 9 FAIL/30 PASS, fuenf Dateien, zwei FAIL/drei PASS; Start 10:41:22, 143.68 s. Recipe 8 FAIL/3 PASS (ein Import plus zwei Guards PASS); Daily Insight 1 FAIL/17 PASS; die drei anderen Evaldateien bestehen. Kein Live-Skip. |
| `npm exec --workspace=backend -- vitest run` | 0 | PASS: normale Vollsuite 1407/1407, 66 Dateien, Start 10:44:12, 65.72 s. Keine Timeout-/Skip-/Assertionaenderung. |
| `npm run typecheck --workspace=backend` | 0 | PASS: `tsc --noEmit`, keine Diagnosen. |
| `npm run build:verify --workspace=backend` | 0 | PASS: Compile, Kopie von zehn vorhandenen Rendererassets, Modulaufloesung und doppelte Function-IDs geprueft. Kein Deployment. |
| `git diff --check` | 0 | PASS: Root-Whitespacegate; bestehende CRLF/LF-Hinweise sind keine Fehler. |
| Read-only SHA-256-Schutzcheck vor Reportanlage | 0 | PASS: 789 tracked/untracked, nicht ignorierte vorhandene Dateien unveraendert; sechs Kandidaten-/Fixturehashes stimmen mit B-16 ueberein. |
| In-memory LF-Hunkrekonstruktion, erster `node -e`-Versuch | 1 | QA-Werkzeugfehler: Windows-Argumentquotierung; kein Produktbefund. |
| In-memory Hunkrekonstruktion ueber stdin, noch ohne Patch-LF-Normalisierung | 1 | QA-Pruefvorbereitung: Zeilenenden beider Vergleichsseiten mussten normalisiert werden; kein Codeedit. |
| In-memory exakte LF-Hunkrekonstruktion ueber stdin | 0 | PASS: alle fuenf B-16-Vorstandsblobs und alle fuenf D-16-Vorstands-SHA-256 exakt wie Handoff; keine Dateiaenderung/Apply. |
| Import-v15-Speichervergleich gegen rekonstruierte B-1-Enddiffbasis, erster Versuch | 1 | QA-Kommando-Syntaxfehler, kein Produktbefund. |
| Derselbe korrigierte read-only Importkoerpervergleich | 0 | PASS: kompletter Importpromptkoerper exakt identisch auf LF-Ebene. |
| `git apply --reverse --check` fuer B-16-EigenerDiff | 0 | PASS, nur Kontextcheck, keine Anwendung. |
| `git apply --reverse --check` fuer D-16-EigenerDiff | 1 | FAIL: Kontext in [Rezeptdomain](../../kb/domain/06-recipes.md#L182), derselbe offen dokumentierte D-16-Befund. Keine byteidentische/strikt rueckwaerts anwendbare Rekonstruktion behauptet. |
| `git apply --reverse --check --ignore-space-change` fuer D-16-EigenerDiff | 0 | PASS fuer whitespace-toleranten Kontext, getrennt vom exakten LF-Inhaltsvergleich. Kein Apply. |

Azure-Functions-Testmoduswarnungen betreffen Functionregistrierung im Testprozess, nicht ausgelassene Livefixtures. Credentials waren fuer die drei ausgefuehrten Livegates vorhanden; kein Credential-Exit 2. Keine Credentials oder Endpoints wurden in diesen Report uebernommen. Der Gesamtprozess wurde bis zum Abschluss beobachtet; keine offenen Pflichtprozesse.

## Independent Code Review

Die naheliegende v16-Hypothese ist Requestisolation plus inhaltsgetriebene Gruppierung im einzigen bestehenden Call. Der SDK-Test bestaetigt die Isolation; die unveraenderte Livefixture falsifiziert die Annahme eines bereits ausreichenden Inhaltsfixes.

- [Prompt](../../../backend/src/lib/prompts/recipeAnalyze.ts#L6): Import v15, Preparation v2; exklusiver voller bestehender Providervertrag und detailgetriebene angrenzende Gruppierung, keine feste Produktionspartition.
- [Client](../../../backend/src/lib/openai.ts#L420): bestehendes Strict `recipe_analyze` mit `additionalProperties: false` an allen Objekten, 0.2/2048, ein SDK-Aufruf. Keine B-16-Schemaaenderung, kein neuer Generator oder Retry/Fallback. Import ohne Kontext nutzt unveraenderten Freitextrequest. Bestehende Ingredientnormalisierung bleibt unveraendert.
- [Handler](../../../backend/src/functions/recipes.ts#L704): original geordnete Steps samt optionalem Titel und reduzierte Metadaten/Zutatenprojektion ohne gespeicherte Zutaten-IDs. Auth zuerst, ETag vor Quota, Validation gegen gespeicherte `recipe.steps`, nicht Modellsource; erst danach Usage und V2-Textprojektion. Kein Rezeptwrite oder Rueckfuellen.
- [Runtimevalidator](../../../backend/src/lib/recipeAnalyzeValidation.ts#L91): strukturelle Text-/Metadatenlimits und genaue geordnete Referenzabdeckung, keine allgemeine semantische Inhaltspruefung und keine exakte M-Countregel im Runtimevalidator. Exakt M ist weiterhin Prompt-/Evalregel. Diese Grenze ist genehmigt, kein neu eingefuehrter QA-Fixvorschlag.
- [Handlerregressionen](../../../backend/src/functions/recipes.test.ts#L714): Privacy prueft saemtliche erfassten log/warn/error-Argumente einschliesslich verschachtelter Werte. Produktionsdiagnosen enthalten begrenzte phase/code/path und maximal 32 Orders, nicht Rezept-/Providertexte. Keine pauschale Aussage ueber alle Logs der gesamten Anwendung.
- [Liveharness](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L260): echter JWT-/Handler-/Client-/Validator-/Providerpfad, vorhandenes in-memory Repository. Nur Boundaryumgebung, Storage und Quota kontrolliert. `vi.spyOn` auf SDK und Client delegiert an Originale, keine erfundene Providerantwort. Gespeicherte Quelle wird vor dem Call geprueft; Rohoutput und komplette Matrix vor der fail-fast Rubrik erfasst.
- Die nachgelagerten 200/V2/Usage-einmal-/vollen Metadatenassertions werden bei Inhaltsfehler nicht erreicht. Die vorangehenden Assertions bestaetigen einen SDK-/Analyzecall, exakten Kontext/Systemprompt, Quota-vor-Provider und keine Rezeptwrites. Ablehnungsstatus/Usage 0/Unveraendertheit sind zusaetzlich direkt beobachtet; ein erfolgreicher Liveworkflow ist nicht belegt.
- Skill Section 6 / QA-Checklist angewandt: Quota, Strict, Preview, Versionsguards, Fehler-/Usage-/Boundarytests und Pflichtgesamtgate geprueft. Keine neue Nutritionausgabe, Klassifikationslogik, Quotaart oder persistierte AI-Version in dieser Preparationkorrektur; neue Nutrition-/Container-/Mobile-/Contractgates deshalb nicht hinzugefuegt.

## Synthetic Live Evidence

S = eigener Serienlauf 1; R = separates Recipegate; G = Gesamtgate. Nur S gehoert zur abgebrochenen Dreierserie. R/G sind unabhaengige Pflichtgates, keine Ersatzlaeufe. S/R-Rohdaten wurden vollstaendig gelesen; sie sind feldweise identisch, einschliesslich der Zutatenkeyreihenfolge. G ist fuer die vollstaendige Rohmatrix teilweise UNVERIFIED, nicht aus S/R rekonstruiert.

Fixture: [synthetic-saved-eight-steps-rice-serving](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L168), unveraendert. Gespeichert: zwei Portionen; Haehnchen 350 g, Reis 150 g, Olivenoel 15 g, Salz/Pfeffer unbestimmt; Metadaten wie Fixture. Null-Nutrition sind ausschliesslich Repository-Boundarydaten. Gespeicherte Source und Modellsource stimmen bei S/R feldweise exakt ueberein, fehlende title als null im Modell. Alle Sourcepattern bestehen. Dies sind synthetische Texte, keine historischen privaten Originaltexte.

| Source | Details in verbindlicher Patternreihenfolge | Referenzgruppe S/R | Source S/R | Export S/R |
|---:|---|---|---|---|
| 1 | Schneiden, Haehnchen, Wuerfel | [1,2] | T,T,T | T,T,T |
| 2 | Wuerzen, Haehnchen, Salz, Pfeffer | [1,2] | T,T,T,T | T,T,T,T |
| 3 | Erhitzen, Olivenoel, Pfanne | [3,4] | T,T,T | T,T,T |
| 4 | Braten, Haehnchen, mittlere Hitze, 4 Minuten je Seite | [3,4] | T,T,T,T | T,T,F,T |
| 5 | Reis kochen, separat, 12 Minuten, Salzwasser, Abgiessen | [5] | T,T,T,T,T | T,T,T,T,T |
| 6 | Hitze senken, Haehnchen, Garen, weitere 6 Minuten | [6] | T,T,T,T | T,T,T,T |
| 7 | Entnehmen/Haehnchen/aus Pfanne, zugedeckt, 3 Minuten, Ruhen | [7] | T,T,T,T | T,F,T,T |
| 8 | Servieren/Haehnchen, mit Reis als Beilage | KEINE | T,T | F,F |

Counts getrennt: S/R jeweils 8 Sourceeintraege, 5 Exporteintraege mit order 1..5, Laengen 66/73/65/56/62, alle <=90. Trace ist `[1,2,3,4,5,6,7]`, nicht 1..8. Status 422, Usage 0, SDK-/Analyzecalls 1/1, gespeichertes Rezept/ETag unveraendert. Deployment `gpt-4o-mini`, API-Version `2024-08-01-preview`, temperature 0.2, max_tokens 2048, finish_reason `stop`. Kein Beleg fuer Tokenmangel.

Exakte S/R-Rohgruppen, Unicode-Escapes bewahren Originalmodelltexte:

```json
[
  {"order":1,"description":"Schneide das H\u00e4hnchen in W\u00fcrfel und w\u00fcrze es mit Salz und Pfeffer.","sourceStepOrders":[1,2],"ingredientKeys":["ingredient-1","ingredient-4","ingredient-5"]},
  {"order":2,"description":"Erhitze Oliven\u00f6l in der Pfanne und brate das H\u00e4hnchen 4 Minuten je Seite.","sourceStepOrders":[3,4],"ingredientKeys":["ingredient-3","ingredient-1"]},
  {"order":3,"description":"Koche den Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","sourceStepOrders":[5],"ingredientKeys":["ingredient-2"]},
  {"order":4,"description":"Senke die Hitze und gare das H\u00e4hnchen weitere 6 Minuten.","sourceStepOrders":[6],"ingredientKeys":["ingredient-1"]},
  {"order":5,"description":"Nimm das H\u00e4hnchen aus der Pfanne und lasse es 3 Minuten ruhen.","sourceStepOrders":[7],"ingredientKeys":["ingredient-1"]}
]
```

S/R-Handlerdiagnose: `source_step_coverage_mismatch`, erwartete Orders 1..8, erhaltene Orders 1..7, firstMismatchPosition=8, expectedOrder=8, actualOrder=null. Der erste geworfene Evalfehler ist fehlende mittlere Hitze fuer Order 4. Die davor ausgewertete komplette Matrix belegt auch Order 7/8. Kein Matcherdefekt im QA-Lauf, keine Testreparatur. B-16s frueherer Matcherdefekt wurde als historische Abweichung gelesen, nicht als eigener QA-PASS ausgegeben.

## Separate Import And Overall Gates

Die acht Importinputs/Constraints und Importrequest sind unveraendert. R/G-Ergebnisse sind eigene aktuelle Laeufe, keine B-16-Zahlen. Tabellenwerte sind erste geworfene Assertions; spaetere ungepruefte Zutaten-/Metadatenassertions werden nicht als PASS bezeichnet.

| Importfixture | R: separates Recipegate | G: Gesamtgate |
|---|---|---|
| mixed-food-seasoning | FAIL: Count 3 statt 5 | FAIL: Count 3 statt 5 |
| borderline-classification | FAIL: Count 3 statt 5 | FAIL: Count 3 statt 5 |
| explicit-quantities-with-unit-conversion | FAIL: Count 3 statt 5 | FAIL: Trace [1,2,3,4,5,1] statt [1,2,3,4,5] |
| missing-quantities-food-gets-estimated | FAIL: Count 2 statt 5 | FAIL: Count 2 statt 5 |
| indeterminate-spray-oil-stays-food | FAIL: Count 1 statt 3 | FAIL: Count 2 statt 3 |
| no-lost-or-invented-ingredients | FAIL: Count 2 statt 5 | FAIL: leere Exportbeschreibung |
| full-recipe-output-fields | FAIL: Count 4 statt 5 | PASS: alle bestehenden Assertions |
| side-dish-and-serving-actions | FAIL: Salzwasser fehlt in zugeordneter Gruppe 1 | FAIL: Salzwasser fehlt in zugeordneter Gruppe 1 |

R-Importbeispiel der letzten Fixture: Source 1..8 erhalten; Export `[1,2],[3,4,5],[6],[7],[8]`, Count 5, dennoch "Koche die Kartoffeln 18 Minuten und gare die Bohnen 8 Minuten bissfest." ohne Salzwasser/Abgiessen. Auch dieser Count-PASS ist kein Inhalts-PASS. Keine Kausalitaetsbehauptung, B-16 habe den Import verschlechtert: aktueller gruener Vorher-Livebaseline fehlt, Importkoerper ist identisch.

G-Preparation scheitert wieder an mittlerer Hitze in "Erhitze Olivenoel in der Pfanne und brate das Haehnchen 4 Minuten je Seite." (ASCII-Umschrift, kein vollstaendiger G-Rohoutput). Die vor dieser Rubrikassertion liegenden Call-/Request-/Quota-/No-writechecks wurden erreicht. Vollstaendige G-Rohgruppen, gesamte Matrix, Handlerstatus/Usage/Laengen/finish_reason sind fuer diesen dritten Output nicht gesichert: UNVERIFIED. Nicht aus S/R/B-16 ergaenzt, kein Rekonstruktionscall.

Fremder G-Befund: Daily Insight `phase-progress-open-day` FAIL; 17/18 Daily-Tests bestanden. Die vollstaendige spezifische Fehlermeldung dieses Dailyfalls ist nicht gesichert und bleibt UNVERIFIED. Recipe Scale, Weekly Insight und Weekly Special-Activity Diagnostic bestehen. Keine Daily-Reparatur, keine Aussage ueber private Dailyinhalte, keine pauschale Schliessung frueherer Dailyfindings. Gesamtgate bleibt trotz 30 PASS rot.

## Provenance And Knowledge Base

Vollstaendig gelesen: [B-16-Handoff](../../User%20Stories/Reciepe/B-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [B-16-EigenerDiff](../../User%20Stories/Reciepe/B-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch), [D-16-Handoff](../../User%20Stories/Reciepe/D-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [D-16-EigenerDiff](../../User%20Stories/Reciepe/D-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch), [B-1-Handoff](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md), [B-1-Ausgangsdiff](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt), [B-1-Enddiff](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch), [B-1-Ruecknahmediff](../../User%20Stories/Reciepe/B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch) und [B-2-Handoff](../../User%20Stories/Reciepe/B-2_Recipe-Preparation-v15_Handoff_2026-10-09.md). Keine erneute B-1-Umsetzung.

B-16 hat nur fuenf zugeordnete Dateien: exklusiver Prompt, zwei Clientauswahlhunks, Preparationrequestassertions, ein v15-Offlinenegativfall und realer Preparationliveharness/Guard. Keine Importtestkoerper-/Fixture-/Runtime-/Handler-/Schemaaenderung in dessen eigenem Diff. D-16 hat nur fuenf KB-Dokumente, 123+/17-. Der ganze dirty HEAD-Diff ist nicht der B-16-/D-16-Aenderungsumfang.

Eigene Speicherrekonstruktion verglich alle Hunkkontexte exakt, normalisierte beide Seiten auf LF und rekonstruierte die Vorstaende ohne Dateischreibzugriff. B-16-Vorstandsblobs: Prompt `2db1ea9ca4be50683ae2d16c4cd6310446fb37ec`, Client `36293a662050d0934172b8520a2c31753be7ddce`, SDK-Test `3eaef8c70d319941e4bbae5584cbfd64984d36a4`, Validator-Test `a5b25c0e6004b21252ef77263b5c28bf968113cc`, Eval `22e3f42e35a9b2b641e60eb6a517cbc6fa080719`: alle exakt B-16-Handoff. Alle fuenf D-16-Vorstands-SHA-256 stimmen exakt mit dessen Tabelle. Importprompt separat aus HEAD plus B-1-Enddiff rekonstruiert und aktueller kompletter Koerper identisch. Die drei ausgesetzten Importhunks bleiben unveraendert; fehlender v13-vor-v14-Snapshot wird nicht ersetzt.

Eigene Artefaktbytehashes stimmen mit den Handoffs:

| Artefakt | SHA-256 |
|---|---|
| B-16-EigenerDiff | FA5F46B93F88C229C2A7DC8765A89D55B335BFFA5E01F09E993320917E736163 |
| D-16-EigenerDiff | 96DB90866D378B765D51E903BEC3B8C5CCEA7577ACAB5D128C88EF2CC4AAA454 |
| B-1-Ausgangsdiff | 07FF1F0B20DE4D6590E0D7647975FA92414189FA71174D10B54F24C22CEBC767 |
| B-1-Enddiff | 76D9DFF2C42C47A5E4F6A82094B06DD596DD4BBD969242874F614A9C2FB05082 |
| B-1-Ruecknahmediff | F61A4FB4CB75DF84BA82ECA9E43C2EEDDEEB2090E780338F12E5CDABB0DEB5AB |

Kandidatenbytehashes selbst gegen B-16 geprueft: Prompt `C78A24D32DA4FAACC1BB58A8A14977CE40EB8E16C87FA79C7726994701E9B3DE`, Client `82144DD35E9B1CB1222CF8EF0334BB9FD12590AE17FEA8DBAEB2DF0612B1949D`, SDK-Test `C33F8BFC11B3BDCFAD2498E54A8C15BBD45CF5DBFD120047A55F0B412597B799`, Eval `7A0A13CD24054B1044026CF63F2A01AE80D9B9EAD9E10CC447A24EFEDE6A7C02`, Validator-Test `37C06937967A48D6ACC45090797E079966D781BC0672C3C2B1FA1922FD6D1853`, unveraenderte Fixture `8D374DE609328E2F29633AAB44988E6A4BFF84A089C9FECDFA9AB5B994BF404E`.

KB-Abgleich: [Rezeptdomain](../../kb/domain/06-recipes.md#L182), [Recipe Analyzer](../../kb/domain/07-ai-features.md#L103), [Backenddiagnose](../../kb/tech/02-backend.md#L245), [AI-Integrationen](../../kb/tech/06-ai-integrations.md#L105) und [Preparation-API](../../kb/tech/09-api-reference.md#L400) beschreiben exklusives v2, unveraendertes Import-v15/Strict/einCall, gespeicherte Validierungsbasis, V2/Text-only/Transienz, begrenzte numerische Privacydiagnose und fehlenden allgemeinen Runtime-Inhaltsvalidator korrekt. [Testing](../../kb/tech/08-testing.md) bestaetigt separate Livegates und Credential-Exit 2. D-16-Zahlen sind explizit B-16-Historie, keine heutigen D-16-Gates. Kein neuer relevanter KB-Code-Konflikt festgestellt.

Der strikte D-16-Reverse-Kontextcheck scheitert weiterhin an Rezeptdomain-Kontext; die genaue Ursache ist nicht abschliessend bewiesen. Whitespace-toleranter Gitcheck und separater exakter LF-Inhaltsvergleich bestehen. Kein verdeckter Kontextfix und keine Byteidentitaetsbehauptung; dies ist kein Nachweis eines anderen Produktionsdefekts.

[Historischer v13-Report](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md) gelesen; [FT-QA-2026-063](../findings.md#L898) nur read-only. Aktuelle 1..8-Rubrik und Privacyregression sind verbessert, aber Offline-PASS schliesst weder v15-Inhalts-/Livefehler noch allgemeine Import-/v13/v14-Findings. FT-QA-2026-063 bleibt offen: G zeigt erneut einen duplizierten Importtrace. Keine Registerdisposition durch QA.

## Plan Validity And Decision Boundary

Kein belegter Fall technischer Planinvaliditaet: die zwei bestehenden Offlinepartitionen zeigen fuer genau diese synthetische Fixture vollstaendigen Inhalt unter M=5/90. Die kleinen genehmigten Prompt-/Requestedits sind implementiert, ihr Liveziel scheitert. Ursache im Modell, Promptdominanz, Tokenmangel oder mathematische Unmoeglichkeit sind nicht bewiesen. Der Befund ist fehlende geforderte Implementierungswirkung, nicht eine eigenmaechtige neue Architekturentscheidung.

PO-1 (exakt min(N,5) versus maximal fuenf) bleibt produktseitig offen und laut Plan nicht blockierend; v16 behaelt die exakte Prompt-/Evalregel unveraendert. Importcountfehler werden nicht durch Umdeuten dieser Regel geschlossen. Weitere Prompt-/Schema-/Budget-/Limit-/Vertragsentscheidung benoetigt ausdrueckliche Freigabe; kein neuer Fixentwurf wird hier als funktionierend ausgegeben. Import-/Gesamtgates sind separate Abschlussgrenzen, keine Reparaturautorisation.

## Verification Limits

### UNVERIFIED

- Serienlaeufe 2/3: nicht ausgefuehrt nach erstem Fehler gemaess verbindlicher Stopregel. Kein fehlender Credentialstatus, kein PASS. Naechste Pruefung erst nach autorisierter Kandidatenentscheidung, neu festgelegter Serie und ohne Zufallspasssammlung.
- Live-Erfolgsassertions nach der gescheiterten Inhaltsrubrik: 200, volle V2-Projektion, einmal Usage nach validem Erfolg und restliche Rohmetadatenkompatibilitaet nicht erreicht. Unit-PASS ist kein Ersatz fuer erfolgreiche Liveassertions.
- G: vollstaendige Preparation-Rohgruppen, Source-/Exportmatrix, Laengen, Handlerstatus/Usage und finish_reason dieses dritten Outputs nicht gesichert. Keine Ergaenzung aus S/R oder B-16; keine erneute Ausfuehrung zur Rekonstruktion. Gesamtgate-Exit 1 und 9/30-Zusammenfassung sowie erster Preparationfehler gesichert.
- Daily Insight G: Fixturefehler `phase-progress-open-day` und Dateizahlen gesichert; exakte spezifische Fehlermeldung nicht gesichert. Separate autorisierte Analyse muss sie erfassen, ohne Rezeptauftrag zu erweitern.
- Historischer v13-vor-v14-Dateisnapshot fehlt weiterhin fuer drei ausgesetzte Importhunks. LF-Hunk-/Artefaktchecks belegen aktuelle Herkunftsgrenzen, keine signierte historische Erfassungszeit oder unbekannte Originaldateibytes.

Diese Grenzen sind keine eigenstaendigen actionable Findings. Der Abschluss scheitert bereits an ausgefuehrten, belegten Inhalts-/Gatefehlern, nicht an einer hypothetischen Umgebungsstoerung.

### MANUAL VALIDATION REQUIRED

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
| Privates historisches Originalrezept | Autorisierte Originaldaten und bekannte deployed Revision; freigegebener privater Test ohne Repository-/Loguebernahme von Inhalten | Quelle 1..8 privat erfassen; nach separat freigegebener Korrektur Preparation einmal am autorisierten Stand ausloesen und Rohinhalt/Response privat vergleichen | Alle Handlungen/Details korrekt ihrer Gruppe zugeordnet, gueltiger 200-Vorschlag und unveraenderte gespeicherte Quelle; keine private Inhaltsprotokollierung | OFFEN: Daten/Revision fehlen, heutige Fixture kein Replay |

Kein share-bundle-/Renderer-/Alpha-Erfolg wird hier abgeleitet. Solche End-to-End-/Releasepruefungen benoetigen einen separaten Auftrag nach erfolgreicher Abnahme; kein Deployment in Q-16.

## Findings

Finding key: Q16-PREPARATION-CONTENT-001
Plan reference: [v16-Plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md)
Acceptance criterion: AC-2; AC-5; US-10 AC-16
Subtask: B-16 / Q-16 Preparation-Inhaltsfix und Dreiernachweis
Description: Der genehmigte exklusive v2-Preparationprompt liefert am echten Pfad weiterhin unvollstaendigen Export. Eigener Serienlauf 1 verliert mittlere Hitze, zugedecktes Ruhen und Order 8/Servieren; Handler 422, Usage 0. Das separate Recipegate bestaetigt denselben vollstaendig gesicherten Rohbefund. Kein dreimaliger erfolgreicher 200-Nachweis, kein funktionierender gezielter Fix.
Criticality: Blocking
Severity: Blocking
Owner: Backend
Evidence: [Liveharness](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L260), [Fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L168), Synthetic Live Evidence und Tests dieses Reports: S/R jeweils Exit 1, Trace 1..7, Gruppenlaengen 66/73/65/56/62; fehlende Details trotz Count 5.
Recommendation: Befund an Orchestrator/Planner zur naechsten ausdruecklich freizugebenden Kandidatenentscheidung zurueckgeben; nicht als abgeschlossen markieren. Erst nach autorisierter Korrektur unveraenderte volle Rubrik und neu vorab festgelegte Handler-Serie pruefen. Keine Assertion-/Limitlockerung, Ersatzlaeufe oder ungepruefte weitere Architektur.

Finding key: Q16-IMPORT-GATE-002
Plan reference: [v16-Plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md)
Acceptance criterion: AC-6; AC-7 (allgemeine Findings offen halten)
Subtask: Q-16 separate Import-/Gesamtgateklaerung, ausserhalb B-16-Reparaturscope
Description: Das unveraenderte Import-v15-Pflichtgate scheitert aktuell mit 0/8 Imports separat und 1/8 im Gesamtgate. Countabweichungen, leere Beschreibung, Semantikverlust und G-Duplikattrace [1,2,3,4,5,1] sind belegt. FT-QA-2026-063 ist nicht geschlossen; Kausalitaet durch B-16 wird nicht behauptet.
Criticality: Blocking
Severity: Blocking
Owner: Backend
Evidence: [Importeval](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L137), Separate Import And Overall Gates dieses Reports, beide eigenen Befehle Exit 1; Importpromptkoerper gegen B-1-v15-Endstand identisch.
Recommendation: Importgate separat durch Orchestrator/Planner mit eigenem Reparaturauftrag klaeren; kein Importfix im aktuellen Preparationauftrag. Bis zu bestandenen Pflichtgates keine Paketabschluss-/Merge-/Releasefreigabe und keine allgemeine Finding-Schliessung.

Finding key: Q16-OVERALL-DAILY-GATE-003
Plan reference: [v16-Plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md)
Acceptance criterion: AC-6 (Gesamtgate)
Subtask: Q-16 Gesamtgate; fremder Daily-Insightbefund, kein Preparation-Reparaturauftrag
Description: Das Pflichtgesamtgate scheitert neben Recipe auch an Daily Insight phase-progress-open-day. Dieser fremde fehlgeschlagene Test verhindert Gesamtgate-PASS; die spezifische Ursache und vollstaendige Fehlermeldung sind hier nicht gesichert. Kein Kausalitaetsbeleg zum Preparationedit.
Criticality: Blocking
Severity: Blocking
Owner: Backend
Evidence: [Gesamteval-Konfiguration](../../../backend/vitest.eval.config.mts), eigener Befehl npm run test:eval --workspace=backend, Exit 1, 9 FAIL/30 PASS; Daily Insight 1 FAIL/17 PASS. Detailgrenze separat unter UNVERIFIED.
Recommendation: Separaten Daily-Insightanalyse-/Reparaturauftrag durch Orchestrator einholen und den konkreten Fehler dort erfassen. Nicht im Recipeauftrag reparieren oder ignorieren; das unveraenderte Gesamtgate vor Abschluss erneut bestehen lassen.

## Report Integrity

789 vorhandene Schutzdateien waren vor Reportanlage bytegleich zur eigenen QA-Ausgangserfassung. Abschliessende Reportvalidation prueft genau neun Kriterienzeilen, genau eine Verdictzeile, alle Findingpflichtfelder, lokale Links, synthetisches JSON, ASCII, geschuetzte Dateihashes und Rootdiff. Der Report ist die einzige neue nicht generierte QA-Datei; Buildausgaben sind ignorierte normale Gateartefakte. Keine privaten Daten, Endpoints oder Secrets in der Reportevidenz.
# US-10 - Recipe Export Preparation: V9-Nachlauf, QA und Alpha Functions

Status: Autorisierter, begrenzter Folgelauf; der aktuelle Quellstand ist noch nicht unabhaengig abgenommen und nicht releasefreigegeben.
Infrastructure Impact: Alpha
Mobile Build Impact: None

Datum: 2026-10-09

## 1. Auftrag und Bewertung

**Accept with modifications.** Der Nutzer autorisiert die Pruefung und den Abschluss des aktuellen V9-Kandidaten, eine notwendige, eng begrenzte Korrektur vor QA, einen unabhaengigen QA-Durchlauf und genau einen Alpha-Functions-Deploy nach bestandenem QA-Gate. Diese Freigabe gilt nur fuer die in diesem Plan beschriebene Runde. Sie erlaubt weder wiederholte Promptkandidaten noch erneute Gates bis zu einem Gruenlauf.

AI bleibt fuer die semantische Auswahl und Verdichtung eines gespeicherten Rezeptablaufs geeignet. Struktur, Quellreferenzen, Laengen und tatsaechliche Textgeometrie bleiben deterministisch geprueft. Das Ergebnis bleibt ein transienter Vorschlag; bestehende Bestaetigungs-, Save- und Share-Vertraege werden nicht geaendert.

Verbindliche Nutzerpraezisierungen:

- Preparation darf selbst entscheiden, welche Handlungen sie zusammenfasst oder weglasst, einschliesslich selbsterklaerender Schritte. Enthaltene Handlungen behalten ihre Quellenreihenfolge. Es gibt keine Pflicht, nur benachbarte Quellschritte zu gruppieren.
- Importanalyse und Exportvorschlag bleiben in einem Modellaufruf. Ihre Trennung wuerde einen zusaetzlichen Aufruf verursachen.
- Gespeicherte Recipe Preparation trennt den Erstellungsprompt von Korrekturprompts. Reiner Textueberlauf nutzt den kurzen Textkorrekturprompt; alle reinen Ueberlaufziele teilen einen Aufruf. Struktur-/Referenzfehler und gemischte Fehler nutzen einen vollstaendigen Korrekturaufruf mit Originalentwurf und Diagnosen. Derselbe Fehler erhaelt keinen separaten Kuerzungsaufruf.
- Hoechstens zwei Korrekturen bleiben erlaubt. Token-, Timeout-, Quota- und API-Vertrag bleiben unveraendert.
- Share und Renderer loesen keine KI-Aufrufe aus.

Keine offene Product-Owner-Entscheidung blockiert diesen Folgelauf. Es werden keine Domaenenregeln erfunden, keine semantischen Rubriken verkleinert und keine Importreparatur oder neue Promptversion ohne nachgewiesenen Bedarf autorisiert.

## 2. Freigabegrenze und Artefaktintegritaet

Der Nutzer hat fuer genau diese Runde ausdruecklich freigegeben:

1. Eine begrenzte Vor-QA-Korrekturrunde, falls die aktuelle Quell-/Dokumentationspruefung einen konkreten Defekt findet.
2. Eine unabhaengige QA-Runde. Wenn die Offline-Gates bestehen, werden Preparation-Fokus (F), vollstaendiger Recipe-Lauf (R) und gesamtes Live-Evalgate (G) jeweils genau einmal auf derselben eingefrorenen Kandidatenfassung ausgefuehrt. Nach einem normalen Assertion-FAIL werden die folgenden Gates trotzdem je einmal ausgefuehrt, damit die Runde vollstaendig dokumentiert ist. Kein Gate wird wiederholt und zwischen F/R/G wird der Kandidat nicht geaendert.
3. Genau einen Alpha-Backend-Functions-Deploy durch Infrastructure, aber nur wenn QA exakt das Verdict `PASS` meldet.
4. Keine weitere Nutzerbestaetigung fuer diese eine Sequenz.

`PASS WITH ISSUES`, `FAIL`, ein fehlender Pflichtlauf, ein nicht eingefrorener/abweichender Kandidat oder ein erforderlicher `UNVERIFIED`-Nachweis oeffnen das Deploy-Gate nicht. Bei einem solchen Ergebnis endet diese Runde ohne Korrektur nach QA, ohne neuen Kandidaten, ohne Wiederholung und ohne Deploy. Eine weitere Runde benoetigt eine neue ausdrueckliche Freigabe.

Dieser Folgelauf steht in einer neuen Datei, statt den [v19-Plan](PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) zu ueberschreiben: Der unveraenderte [Q-19-Bericht](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) und der spaetere [Q-1-ROUND1-Bericht](../../qa/reports/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md) referenzieren ihre jeweiligen damaligen Plan-/Kandidatenstaende. User Story, historische QA-Berichte, Backend-Handoffs, Findings-Register und Release-Records bleiben unveraendert. Der Planner aendert in dieser Aufgabe ausschliesslich diese neue Plan-Markdown-Datei.

## 3. Historische Befunde und aktueller Quellstand

### 3.1 Unveraenderliche v19-/B-19-/Q-19-Baseline

- Der v19-Plan und [B-19-Handoff](B-19_Recipe-Preparation_Handoff_2026-10-09.md) beschreiben den damaligen Preparation-v4-Kandidaten bei unveraendertem Import v16.
- Der unabhaengige [Q-19-Bericht](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) hat `FAIL`: Q19-01 dokumentiert einen strukturell akzeptierten Rice-Output mit geaenderter Fertiggarphase; Q19-02 dokumentiert fehlende erfolgreiche Rice-/Oven-Laeufe; Q19-03 und Q19-04 dokumentieren getrennte Import-/Daily-Gatefehler. Q19-05 ist eine Suggestion zu veralteten Testnamen.
- B-19s F/R/G-Livegates schlugen fehl. Die historischen Befunde werden weder durch spaetere lokale Tests noch durch einen anderen Kandidaten rueckwirkend bestanden oder geschlossen.

### 3.2 Unveraenderliche Feedback-Loop-Baseline

- [PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop](PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), [B-2 r3 / QA-R1-Handoff](B-2_Feedback-Loop_Handoff_2026-10-09-r3-QA-R1.md) und [Q-1-ROUND1](../../qa/reports/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md) beschreiben einen eingefrorenen v6-Kandidaten, nicht den derzeitigen v9-Quellstand.
- Fuer diesen v6-Kandidaten dokumentiert Q-1-ROUND1 F als `FAIL`; R/G wurden nicht ausgefuehrt (`NOT_RUN`). Der Bericht meldet `FAIL`, Release Gate `CLOSED` und einen offenen Q1-03-Blocker. B-2 r3 meldet ebenfalls einen fehlgeschlagenen erforderlichen F-Lauf. Nicht dokumentierte Testcounts oder Einzelfallresultate werden hier nicht abgeleitet.
- Diese F/R/G-/QA-Befunde gehoeren zum eingefrorenen v6-Kandidaten und werden nicht als Resultat des aktuellen v9-Kandidaten dargestellt. Sie bleiben historische FAIL-/NOT_RUN-Eintraege.

### 3.3 Aktueller Quell- und Promptstand

- [Recipe-Promptmodul](../../../backend/src/lib/prompts/recipeAnalyze.ts) exportiert aktuell `RECIPE_ANALYZE_PROMPT_VERSION = 'v16'` und `RECIPE_PREPARATION_PROMPT_VERSION = 'v9'`. [Recipe-Eval](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) erwartet dieselben Versionen. Das ist der zu pruefende Stand; ein Versionsguard-PASS allein ist kein Qualitaets-PASS.
- `analyzeRecipeText(text)` bleibt der Importpfad mit vollstaendiger `AiRecipeRaw`-Ausgabe, unveraenderter Normalisierung/Validierung und gemeinsamem Exportvorschlag in genau einem Modellaufruf.
- `prepareRecipeExport(context, options)` ist der gespeicherte Preparation-Pfad. Creation und strukturelle Korrektur verwenden getrennte v9-Prompts. Nur wenn alle aktuellen Fehler `TEMPLATE_FIELD_OVERFLOW` sind, sendet der kurze Textkorrekturpfad alle betroffenen Texte samt tatsaechlichem/erlaubtem Mass in einem Aufruf und ersetzt nur diese Texte. Struktur-/Referenzfehler oder gemischte Diagnosen verwenden einen vollstaendigen Korrekturaufruf mit `{ originalPreparation, latestDraft, validationErrors }`.
- [Preparation-Loop](../../../backend/src/lib/recipePreparation.ts), [Provider-Tests](../../../backend/src/lib/openai.recipeAnalyze.test.ts) und [Loop-Tests](../../../backend/src/lib/recipePreparation.test.ts) enthalten den aktuellen Dreiversuchsrahmen: Erstentwurf plus hoechstens zwei Korrekturen, vollstaendige Wiederpruefung nach jeder Antwort, maximal 75 Sekunden gesamt, maximal 20 Sekunden je Aufruf, `maxRetries: 0`, AbortSignal, einmalige Quota-Pruefung und Usage-Buchung erst nach validiertem Erfolg. Keine automatische Speicherung oder Rezeptwrites.
- [Weekly-Eval-Helfer](../../../backend/src/test-utils/weeklyInsightEvalSemantics.ts) vergleicht den Belegtext aktuell substring-genau, aber ohne Beachtung der Gross-/Kleinschreibung. Andere Text-/Zahlenabweichungen bleiben unbelegt; sie werden nicht normalisiert oder passend gemacht. [Regressionen](../../../backend/src/test-utils/weeklyInsightEvalSemantics.test.ts) pruefen Gross-/Kleinschreibungsvarianten und geaenderte Kalorien-/Prozentwerte.

### 3.4 Vorhandene, nicht ausreichende Laufbelege

- Das archivierte [V9-Live-Eval](../../../backend/output/recipe-preparation-v9-separated-prompts-eval-2026-10-09.json) enthaelt 42 Tests: 41 bestanden, 1 fehlgeschlagen, Exit 1. Die 12 Recipe-Fixture-Tests (8 Import, 4 Preparation) bestanden; beide Promptversionsguards bestanden ebenfalls. Der einzige aufgezeichnete Fehler ist der Weekly-Special-Activity-Belegvergleich unter effektivem Ziel, der nur an Gross-/Kleinschreibung scheiterte. Das Gesamteval ist damit kein PASS.
- Das nach der Helferaenderung gespeicherte [gezielte Weekly-Eval](../../../backend/output/weekly-insight-evidence-casefold-eval-2026-10-09.json) ist 3/3 bestanden. Es ist kein Ersatz fuer R oder G und klassifiziert den vorherigen 41/42-Lauf nicht rueckwirkend um.
- Die im Chat genannte Zahl von 1611 bestandenen Backend-Units ist in den aktuellen Workspace-Artefakten nicht dauerhaft belegt. Die auffindbaren B-2-Berichte enthalten aeltere 1600er-Laeufe. Der Planner behandelt 1611 deshalb nicht als verifiziert; QA fuehrt die Units auf der eingefrorenen Fassung erneut aus.
- Fruehere Typecheck-/Build-PASS-Angaben liegen vor der letzten Weekly-Helferaenderung. Fuer den aktuellen Kandidaten ist ein frischer Typecheck und `build:verify` erforderlich.
- `docs/kb/domain/07-ai-features.md` und die Uebersichtsstellen in `docs/kb/tech/06-ai-integrations.md` nennen noch Preparation v6, waehrend der Quell-/Eval-Guard v9 ist und `tech/06-ai-integrations.md` weiter unten bereits eine v9-Sektion enthaelt. `docs/kb/tech/08-testing.md` beschreibt den Helper-Vergleich korrekt, nennt aber noch den B-2-r3/v6-Stand als aktuell. `docs/kb/domain/06-recipes.md` enthaelt bereits v9-Details. Die widerspruechlichen aktuellen Uebersichtssaetze sind ein Dokumentationsabgleich vor QA, keine Aenderung an historischen v6-Befunden.
- Im Workspace ist kein Deploy des aktuellen v9-/Feedback-Loop-Kandidaten belegt. Der historische 14:12-Alpha-Release fuer Share-Overflow-Logging ist nicht dieser Kandidat.

## 4. Zielverhalten und technische Grenzen

1. Preparation erstellt einen selektiven, verstaendlichen Exportvorschlag. Das Modell darf selbsterklaerende/nachrangige Schritte auslassen und nicht benachbarte Quellhandlungen gruppieren; die Reihenfolge der enthaltenen Handlungen bleibt zur Quelle konsistent. Bestehende source-order-, first-reference-, Eindeutigkeits-, Output- und Produktionsgeometriepruefungen bleiben unveraendert.
2. Reiner gemessener Textueberlauf bleibt im kurzen Textkorrekturpfad. Mehrere reine Ueberlaufziele teilen einen Call. Struktur-/Referenz- und gemischte Diagnosen korrigiert ein vollstaendiger Preparation-Aufruf mit letztem Entwurf und Diagnosen. Keine getrennte zweite Kuerzungsrunde fuer denselben gemischten Fehler.
3. Der aktuelle initial-plus-zwei-Rahmen, 2048 Token, 20s/Aufruf, 75s gesamt, keine SDK-Retries, `recipe-analyze`-Quota, v2-Request/-Response, optionale ETag-Pruefung, Usage-Buchung nach validiertem Erfolg und No-write-Verhalten bleiben bestehen.
4. Import bleibt v16 und ein Modellaufruf fuer Analyse plus Exportvorschlag. Es gibt keine Importprompt-, Schema-, Normalisierungs- oder Referenzregelkorrektur in dieser Runde.
5. Share-Bundle und Renderer rufen keine KI auf. Es gibt keine Mobile-, Shared-, Cosmos-, Persistenz-, API-, Template-, Font-, Bicep- oder Dependency-Aenderung.
6. Fixture-Rubriken und QA pruefen die vereinbarten konkreten Source-/Cooking-Core-Beispiele. Das ist keine allgemeine Laufzeitgarantie fuer Kochsicherheit, Vollstaendigkeit oder abgeleitete Metadaten. Rubriken werden nicht gelockert; unbelegte PASS-Behauptungen sind unzulaessig.

Persistence Impact: Keine Dokument-, Repository- oder Container-Aenderung; keine Migration. Recipe Preparation bleibt transient. Quota-Usage ist die bestehende Buchung und wird nicht als Rezeptpersistenz behandelt.

## 5. Umfang und Nicht-Ziele

In Scope:

- Aktuellen v9-Preparation-/v16-Import-Code, Prompttrennung, Version-Guards und vorhandene Tests auf die verbindlichen Nutzerpraezisierungen abgleichen.
- Hoechstens eine konkrete Vor-QA-Korrektur an diesem Kandidaten, falls Source-/Offlinepruefung einen Defekt aufdeckt. Kein neuer Promptkandidat ohne notwendigen, belegten Defekt.
- Nur aktuelle v6-/B-2-r3-Uebersichtsangaben der relevanten KB vor QA mit dem bestehenden v9-Code abgleichen; historische Ergebnisabschnitte unveraendert lassen.
- Unabhaengige Pruefung aller v20-Kriterien sowie Zuordnung zu den einschlaegigen v19-/Feedback-Loop-Kriterien und US-10 AC-15/16.
- Backend-Fokus-Units, alle Backend-Units, Backend-Typecheck, `build:verify` und die drei festgelegten Live-Gates auf demselben Kandidaten.
- Genau ein Alpha-Functions-Deploy nach QA `PASS`, einschliesslich Artefakt-, Health- und Releasebericht.

Out of Scope:

- Story-, v19-/Feedback-Loop-Plan-, historische QA-Bericht-, Handoff-, Findings-Register- oder alte Evidence-Aenderungen.
- Importprompt/-schema/-Normalisierung/-Trace-Reparatur; Daily-/Weekly-Promptaenderungen; Ausweitung oder Abschwaechung semantischer Rubriken.
- Neue Promptversion, Modell-/Deployment-/API-/Token-/Timeout-/Quota-Aenderung ohne konkreten zwingenden Defekt.
- Neue KI-Aufrufe fuer Import, Share oder Renderer; neue Route, Vertrag, Persistenz, Cosmos-Migration, Dependency, Layout-/Fontaenderung oder Mobile Build.
- Unverbundene Dirty-Worktree-Dateien in den freigegebenen Deploykandidaten aufnehmen.
- Weitere Live-Runs, Korrekturrunden, Deployversuche oder QA-Neustarts nach dem festgelegten Durchlauf.

## 6. Bestaetigte Fakten und Annahmen

**Bestaetigt:** Quellcode ist fuer aktuelles Verhalten massgeblich. Die aktiven Guards sind Import v16 / Preparation v9. Der archivierte V9-Lauf ist 41/42 und der gezielte Weekly-Nachlauf 3/3. Die alten v19/Q-19- und B-2/Q-1-Reports bleiben FAIL/NOT_RUN-Historie. API, Quota-Key, Request/Response, Persistenz und Mobile sind unveraendert.

**Annahmen / Voraussetzungen:**

- Die aktuellen v9-Quell-/Testaenderungen sind der beabsichtigte Kandidat; Backend und QA muessen vor den Live-Gates den gesamten fuer den Functions-Build relevanten Source-/Dependency-/Asset-Stand erfassen. Ein alter B-2-Kandidatenhash gilt nicht fuer v9.
- Es existieren keine Credentials im Plan. Der offizielle Eval-Runner muss die vorhandene sichere Umgebung verwenden. Fehlende oder ungueltige Credentials bedeuten `UNVERIFIED`; kein Ersatzlauf.
- Die fruehere Zahl 1611 Backend-Units gilt bis zu einem frischen Report als unbestaetigt.
- Fuer den Alpha-Postdeploy-Preparation-Smoke darf nur ein dedizierter, bereits verfuegbarer synthetischer QA-Rezeptdatensatz verwendet werden. Keine private Rezeptrevision und keine persoenlichen Daten als Smoke-Fixture. Fehlt autorisierter Testkontext, wird dieser Smoke als `UNVERIFIED` berichtet, nicht als bestanden.
- Der Build-Release muss auf genau die eingefrorene und QA-gepruefte Kandidatenfassung begrenzt werden. Kann die bestehende Dirty-Worktree-/Artefaktlage keine saubere Kandidatenabgrenzung belegen, bleibt der Deploy gesperrt.

## 7. Work Packages

### B-20 - Kandidatenabgleich und eine begrenzte Korrektur

Agent: Backend

Goal: Den aktuellen v9-Kandidaten mit den Nutzerpraezisierungen, v20-ACs und unveraenderten API-/Importgrenzen abgleichen. Nur einen konkreten vor QA gefundenen Defekt im bestehenden Kandidaten minimal korrigieren; andernfalls keine Code-/Testaenderung erfinden.

Required Knowledge Base:
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

Required Repository Context:
- `backend/src/lib/prompts/recipeAnalyze.ts`
- `backend/src/lib/openai.ts` und `backend/src/lib/openai.recipeAnalyze.test.ts`
- `backend/src/lib/recipePreparation.ts` und `backend/src/lib/recipePreparation.test.ts`
- `backend/src/lib/recipeAnalyzeValidation.ts` und `backend/src/lib/recipeAnalyzeValidation.test.ts`
- `backend/src/functions/recipes.ts`, `backend/src/functions/recipes.test.ts`, `backend/src/functions/ai.test.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` und `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`
- `backend/src/test-utils/weeklyInsightEvalSemantics.ts` und `.test.ts`
- `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`
- `backend/scripts/run-eval.mjs`, `backend/package.json`
- Dieser Plan, v19-Plan, US-10, B-19-/B-2-Handoffs sowie Q-19-/Q-1-Berichte als unveraenderliche Historie

Required Skills:
- `azure-openai-feature-integration`

Relevant Acceptance Criteria:
- AC-1 bis AC-8

Dependencies: Keine; der aktuelle Workspace-Stand ist die Eingabe, nicht ein alter v6-Kandidatenhash.

Expected Handoff: Gepruefte aktuelle Versions-/Prompt-/Loopvertraege; exakte geaenderte Dateien und kleinster Owned-Diff oder ausdrueckliches No-code-change-Ergebnis; Hash-/Inventarnachweis fuer den vollstaendigen Backend-Deploykandidaten; betroffene Offlinechecks. Backend fuehrt keine Live-Eval-Gates und keinen Deploy aus. Bei einem nach dieser einen Vor-QA-Korrektur verbleibenden Defekt wird QA nicht durch einen weiteren Kandidaten ersetzt.

### D-20 - Aktuelle KB-Uebersicht abgleichen

Agent: Backend

Goal: Vor QA ausschliesslich die aktuellen Preparation-v6-Uebersichtsangaben in `docs/kb/domain/07-ai-features.md` und `docs/kb/tech/06-ai-integrations.md` auf den verifizierten Ist-Stand v9/Import v16 berichtigen. In `docs/kb/tech/08-testing.md` den aktuellen B-2-r3/v6-Status gegebenenfalls als historische Evidenz kennzeichnen und den gegenwaertigen Verifikationsstatus korrigieren. Die Helper-Semantik dort nur aendern, falls sie vom aktuellen Code abweicht. Alle historischen v6/v19/B-2-Ergebnisabschnitte unveraendert lassen.

Required Knowledge Base:
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- Aktuelle Preparation-/Importprompt-, Loop-, Eval-Guard- und Weekly-Eval-Helferdateien aus B-20
- Dieser Plan und B-20-Handoff

Required Skills: None

Relevant Acceptance Criteria:
- AC-2, AC-3, AC-4, AC-7, AC-11

Dependencies: B-20 abgeschlossen; nur aktuelle Uebersichtssaetze berichtigen, keine historische Evidenz aendern.

Expected Handoff: Exakte KB-Dateien/Abschnitte oder begruendetes No-op; dokumentierte aktuelle Versionen und Grenzen; B-20-Kandidatenhash bleibt unveraendert, da nur Dokumentation hinzukommt. Keine QA-Bericht-, Story-, Handoff- oder Registeraenderung.

### Q-20 - Unabhaengige QA und einmalige Live-Gates

Agent: QA

Goal: Den eingefrorenen Kandidaten gegen alle v20-ACs unabhaengig pruefen. Traceability umfasst die relevanten ACs 1-10 des v19-Plans, die Preparation-/Release-ACs des Feedback-Loop-Plans sowie US-10 AC-15/16. Wo v20 eine aeltere Ein-Aufruf-/Promptvorgabe aufgrund der ausdruecklichen Nutzerpraezisierung ersetzt, gilt v20. QA schliesst keine historischen Findings und repariert keine Implementierung.

Required Knowledge Base:
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

Required Repository Context:
- Dieser vollstaendige v20-Plan, US-10, v19-Plan, Feedback-Loop-Plan und B-19-/B-2-Handoffs
- Q-19- und Q-1-ROUND1-Berichte, `docs/qa/reports/README.md` und `docs/qa/findings.md` (read-only)
- B-20-/D-20-Handoffs sowie Kandidateninventar/Hashes; geaenderte Prompt-, Provider-, Loop-, Handler-, Validator-, Eval-/Fixture- und Weekly-Helferdateien
- `backend/package.json`, `backend/scripts/run-eval.mjs`, `backend/vitest.eval.config.mts`
- Archivierte V9-/Weekly-Ergebnisse zur Historieneinordnung; nicht als Ersatz fuer neue Gates

Required Skills:
- `azure-openai-feature-integration`

Relevant Acceptance Criteria:
- AC-1 bis AC-13; ausserdem die genannte v19-/Feedback-Loop-/US-10-Traceability

Dependencies: B-20 und D-20 abgeschlossen; ein einziger eingefrorener Kandidat fuer Offline- und Live-Gates. Fehlende Credentials oder unvollstaendige Eingaben werden als `UNVERIFIED` berichtet, nicht ergaenzt oder wiederholt.

Expected Handoff: Neuer `fittrack-qa-v1`-Bericht `docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v20.md` mit genau einem Verdict, allen v20-ACs in der Kriterienmatrix, jedem Kommando/Exit/Count, allen drei Live-Gates, strukturierten Findings und getrennten `UNVERIFIED`-Notizen. Q-19/Q-1-Berichte und `docs/qa/findings.md` bleiben unveraendert; Orchestrator verwaltet das Register.

### R-20 - Einmaliger Alpha Functions-Release

Agent: Infrastructure

Goal: Den einen ausdruecklich autorisierten Alpha-Backend-Functions-Deploy nach Q-20 `PASS` ausfuehren. Dies ist ein operativer Release-Handoff, kein Mobile- oder Infrastrukturfeature.

Required Knowledge Base:
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

Required Repository Context:
- `.github/instructions/infra-release.instructions.md`
- Q-20-Bericht, v20-Kandidateninventar und exakt eingefrorene Runtime-/Dependency-/Asset-Hashes
- `backend/package.json`, `backend/scripts/verify-build.mjs`, `backend/scripts/copy-instagram-assets.mjs`, `backend/host.json`
- `_deploy_staging/package.json`, Lockfile und `host.json`; `infra/` nur zur Feststellung eines tatsaechlichen, autorisierten Bicep-Diffs

Required Skills: None

Relevant Acceptance Criteria:
- AC-12 bis AC-13

Dependencies: Ausschliesslich Q-20 `Verdict: PASS` fuer denselben Kandidaten. QA `PASS WITH ISSUES`, `FAIL`, `UNVERIFIED`, Kandidatenabweichung oder fehlender Releasezugang bedeutet kein Deploy. Keine erneute Nutzerbestaetigung nach bestandenem Gate.

Expected Handoff: Ein Releasebericht unter `infra/release-records/Recipe-Export-Preparation-v9_Alpha-Functions_2026-10-09.md` mit Candidate-/Staging-Hashes, Build-/MIR-/Publish-/Function-/Health-/Smoke-Ergebnis, Deployzeit, Dev-Build-Entscheid und verbleibenden Grenzen. Kein weiterer Publishversuch in dieser Runde.

## 8. Test- und QA-Gates

QA friert zuerst den getesteten Kandidaten ein und bestaetigt, dass derselbe vollstaendige Backend-Source-/Dependency-/Asset-Stand in den spaeteren Release eingehen kann. Relevante Offline-Kommandos (aus dem Workspace-Root):

```powershell
npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/openai.recipeAnalyze.test.ts src/lib/recipePreparation.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts src/test-utils/weeklyInsightEvalSemantics.test.ts
npm run test --workspace=backend
npm run typecheck --workspace=backend
npm run build:verify --workspace=backend
```

Jeder Befehl wird fuer Q-20 einmal ausgefuehrt und mit Exit sowie Testergebnissen festgehalten. Ein Offline-FAIL verhindert Live-Aufrufe und Deploy; er wird nicht durch einen weiteren Kandidaten ersetzt. `build:verify` ist fuer jede Backend-Aenderung Pflicht. Die QA prueft ausserdem alle v20-Kriterien, Quota-/Usage-Reihenfolge, Request/Response und Save-/Share-Grenzen.

Wenn alle Offline-Gates bestehen, fuehrt QA diese drei Live-Gates in Reihenfolge aus; jedes genau einmal und auf identischen gehashten Dateien:

```powershell
node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"
node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts
npm run test:eval --workspace=backend
```

F umfasst den Preparation-v9-Guard und alle vier gespeicherten synthetischen Preparation-Fixtures (Rice, Oven, Pasta, erzwungener Dough-Textueberlauf). R umfasst den kompletten Recipe-Lauf mit Import- und Preparation-Fixtures sowie Versionsguards. G umfasst die gesamte vorhandene Live-Eval-Suite einschliesslich Weekly-/Daily-Evals. Normaler Assertion-FAIL in F oder R verhindert R/G nicht; beide verbleibenden Gates werden fuer diese eine genehmigte Runde je einmal ausgefuehrt. Kein Gate wird wiederholt oder durch einen spaeteren Run ersetzt. Ein nicht startbarer Lauf, fehlende Credentials, Exit 2, relevante Skips oder Kandidatenabweichung ist `UNVERIFIED`, niemals PASS.

Die QA muss finale Live-Outputs, Quellreferenzen, Mengen/Zeiten/Temperaturen und erlaubte Auslassungen gegen die bestehenden vollstaendigen Fixture-Rubriken pruefen. Fuer Oven ist `manualExportReview` im Fixture gesetzt; ein strukturell gueltiger HTTP-200-Output allein belegt dessen Semantik nicht. QA dokumentiert die tatsaechlich beurteilten Texte und erreicht/nichterreicht Assertions. Keine Rubrik wird reduziert oder durch ein Wortlaut-Golden ersetzt.

## 9. Abnahmekriterien

1. **AC-1 - Einmaliger Freigaberahmen:** Genau eine Vor-QA-Korrekturrunde, eine Q-20-Runde und hoechstens ein Alpha Functions-Deploy nach Verdict `PASS`. Kein QA-FIX, zweiter Kandidat, Wiederholung bis gruen oder weitere Nutzerfreigabe in dieser Runde.
2. **AC-2 - Versionierung:** Aktiver Import bleibt v16 und Preparation v9. Die zugehoerigen Version-Guards pruefen diese Werte. Eine Versionserhoehung ist nur bei einem konkreten, in B-20 dokumentierten Semantikdefekt zulaessig und muss vor dem eingefrorenen QA-Kandidaten mit passenden Tests/Evalreview abgeschlossen sein.
3. **AC-3 - Prompt-/Korrekturtrennung:** Creation v9 enthaelt keine Korrekturanweisungen. Reiner gemessener Textueberlauf nutzt den kurzen strikten Textkorrekturpfad und fasst alle Ueberlauftexte in einem Call zusammen. Struktur-/Referenz- und gemischte Diagnosen nutzen einen vollstaendigen v9-Korrekturaufruf mit Original, letztem Entwurf und Diagnosen; fuer denselben Fehler erfolgt kein anschliessender eigener Kuerzungsaufruf.
4. **AC-4 - Fachliche Grenzen:** Import erzeugt Analyse und Exportvorschlag weiterhin in einem Aufruf. Preparation darf gruppieren/auslassen, auch nicht benachbarte oder selbsterklaerende Schritte; die Reihenfolge erhaltener Handlungen bleibt quellenkonsistent. Keine neue Adjacent-only-Regel, erfundene Kochregel oder Abschwaechung bestehender semantischer Negativrubriken. Share/Renderer rufen keine KI auf.
5. **AC-5 - API, Loop und Quota:** V2-Request/-Response, Strict-Schema, sourceEtag-/ETag-Verhalten, `recipe-analyze`-Quota und Erfolgs-/Fehlerstatus bleiben gleich. Pro Preparation hoechstens drei logische Calls (Initial plus zwei Korrekturen), gleiche 2048-token-, 20s-pro-Aufruf- und 75s-Gesamtbudgets, `maxRetries: 0` und AbortSignal. Quota wird einmal vor AI geprueft, Usage einmal nach vollstaendig validiertem Erfolg gebucht; kein Rezept-/Export-/Diary-Write.
6. **AC-6 - Vollstaendige Validierung:** Jeder finale Entwurf wird nach jeder Korrektur erneut gegen gespeicherte Quelle, Schema, Referenzen und alle Teaser-/Schrittgeometrien geprueft, auch nach Count/Layout-Aenderung. Keine Sortierung, Padding-, ID- oder Textreparatur. Source bleibt unveraendert.
7. **AC-7 - Weekly-Eval-Helfer:** Die einzige neue Vergleichstoleranz ist Gross-/Kleinschreibungsunabhaengigkeit beim exakten vorhandenen Beleg-Substring. Geaenderte Zahlen/Inhalte bleiben `UNVERIFIED`; keine Normalisierung, Fuzzy-Suche, Prompt-/Produktionslogik- oder Grenzwertaenderung. Unit-Regressionen und der Weekly-Fall innerhalb des vollstaendigen G-Laufs bestehen; dafuer wird kein zusaetzlicher Live-Lauf angehaengt.
8. **AC-8 - Offline-Verifikation:** Alle vier in Abschnitt 8 genannten Offline-Kommandos bestehen auf der eingefrorenen Kandidatenfassung: fokussierte Tests, gesamter Backend-Unit-Lauf, Typecheck und `build:verify`. QA protokolliert echte Counts/Exits; der nicht dauerhaft belegte 1611-Claim ersetzt keinen Lauf.
9. **AC-9 - Preparation-Livegate:** F laeuft genau einmal; Version-Guard und vier Preparation-Fixtures bestehen. Finaler Rice-Output bewahrt geforderte Haupt-/Beilagenhandlungen und Reihenfolge; Oven besteht unabhaengige Inhalts-/Quellenbindungspruefung, nicht nur Fit/HTTP; Pasta erhaelt Sauce und separates Pasta-Kochen; Dough-Korrektur erhaelt Zutaten und Quellparameter. Keine unaufgeloeste Pflichtassertion oder manuelle Review bleibt `UNVERIFIED`.
10. **AC-10 - Recipe- und Gesamt-Livegate:** R und G laufen auf demselben Kandidaten jeweils genau einmal. Alle Recipe-Import-/Preparation-Assertions und Version-Guards bestehen; Import-Schutz (einschliesslich indeterminate spray-oil und unveraenderter Trace-Regeln) bleibt intakt. Das gesamte Evalgate besteht ohne relevante Skips, neue UNVERIFIED-Urteile oder Assertion-Fails. Out-of-scope Befunde bleiben getrennt und werden nicht repariert.
11. **AC-11 - Dokumentation und historische Befunde:** Aktuelle KB-Uebersichten nennen Preparation v9 / Import v16 und beschreiben die Prompttrennung sowie den eng begrenzten Weekly-Belegvergleich korrekt. Historische v6-/v19-/B-2-Ergebnisse bleiben als damalige Historie markiert. Kein alter QA-Bericht oder Registry-Eintrag wird geaendert oder in diesem Plan als geschlossen behauptet.
12. **AC-12 - QA-Verdict:** Q-20 schreibt einen neuen `fittrack-qa-v1`-Bericht mit jeder v20-AC-Zeile genau einmal, Traceability zu den benannten alten ACs, allen Commands/Exits/Counts und getrennten Findings/UNVERIFIED-Notizen. Nur exakt `PASS` und vollstaendige Kriterienabdeckung oeffnen R-20; `PASS WITH ISSUES`, `FAIL`, Pflicht-UNVERIFIED oder Kandidatenabweichung sperren Deploy.
13. **AC-13 - Alpha Functions Release:** Nach AC-12 `PASS` deployt Infrastructure denselben Kandidaten genau einmal nach Alpha: Azure-Session vor `az` pruefen; Infrastructure-Phase nur fuer einen tatsaechlich vorhandenen und autorisierten Bicep-Diff; clean build, `_deploy_staging`-Sync mit `robocopy /MIR`, Handler-/Asset-Pruefung und remote Publish mit Node 22. Kein Mobile/EAS Build. Danach Functionliste inkl. Preparation-/Healthhandler, `/api/health`=200, geschuetzte Route ohne Token=401 und verfuegbarer autorisierter synthetischer Preparation-Smoke samt Application-Insights-Pruefung dokumentieren. Fehlender Testkontext wird als `UNVERIFIED`, nicht als erfolgreicher Smoke ausgewiesen. Releasebericht nennt `Dev Build Required: NO`.

## 10. Infrastruktur und Release (Alpha)

Es gibt keine geplante Bicep-, Settings-, Cosmos- oder Ressourcen-Aenderung. `Infrastructure Impact: Alpha` bedeutet hier ausschliesslich den genehmigten Azure Functions Backend-Deploy. Infrastrukturagent prueft den tatsaechlichen Kandidatendiff: ohne autorisierten Bicep-Diff wird kein ARM-Deployment ausgefuehrt; ein unerklaerter oder fremder Diff stoppt die Releasefolge. Falls ein autorisierter Bicep-Diff tatsaechlich vorhanden ist, kommt Infrastructure zuerst und bestaetigt anschliessend den bestehenden `Node|22`-Runtimevertrag.

Functions-Release nach den [Infrastructure & Release Instructions](../../../.github/instructions/infra-release.instructions.md) und [Infrastructure-KB](../../../docs/kb/tech/07-infrastructure.md): aktive Azure-Session vor Azure-Kommandos pruefen; `backend/dist` und Buildcache cleanen; `npm run build:verify`; mit `robocopy /MIR` nach `_deploy_staging/dist` syncen; mindestens `backend/src/functions/recipes.js`, `health.js`, `instagramRecipe.js` und alle zehn Rendererassets inkl. Font-Lizenz in der Stagingstruktur bestaetigen; aus `_deploy_staging` remote veroeffentlichen mit `func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript`. Kein `--no-build`.

Postdeploy: Functionliste bestaetigen, GET `/api/health` muss 200 liefern, geschuetzte GET `/api/diary/meals` ohne Bearer muss 401 liefern. Ein authentifizierter Preparation-Smoke nutzt nur ein bereits verfuegbares synthetisches QA-Rezept; Quelle bleibt unveraendert, es erfolgt kein automatisches Speichern, und neue `*.failed`-Ereignisse werden in Application Insights geprueft. Fehlt der dedizierte Testkontext, wird das als Grenze im Releasebericht festgehalten. Ein Publish-/Healthfehler fuehrt zu keinem zweiten Deployversuch in dieser Runde; Infrastruktur berichtet Istzustand und Rollbackoptionen.

## 11. Risiken und Grenzen

- Der archivierte 41/42-Lauf ist fehlgeschlagen; der gezielte 3/3-Weekly-Lauf ist schmal. Erst G nach Helferfix entscheidet ueber das gesamte Livegate.
- Das alte Q-1 v6-F-FAIL und Q-19 v4-FAIL sind keine v9-Bewertung. Umgekehrt schliesst ein neuer v9-PASS keine historische Registry-Entscheidung automatisch.
- Der gespeicherte V9-Eval markiert Oven als `manualExportReview`; technische Assertions und Quellenbindung allein ersetzen keine tatsaechliche Inhaltspruefung.
- Eine Backend-Vollbuild kann unbeteiligte Dirty-Aenderungen einschliessen. Kandidateninventar und Artefaktpruefung sind releaseblockierend; kein stilles Bundling fremder Aenderungen.
- Ein Full-G-Fehler ausserhalb Recipe stoppt den Deploy, weil das vollstaendige Livegate ausdruecklich Teil dieser Freigabe ist. Dieser Plan autorisiert keine Reparatur fremder Import-/Daily-Fehler.
- Begrenzte Fixture-Rubriken sind keine universelle Koch-, Sicherheits- oder Metadatengarantie.
- Fehlende Azure/OpenAI-/Testkontexte ergeben `UNVERIFIED`, keine implizite Freigabe und keinen Ersatzlauf.

## 12. Empfohlene Ausfuehrungsreihenfolge

1. Orchestrator legt v20 samt bereits erteilter, exakt begrenzter Nutzerfreigabe aus; v19/Q-19/B-2/Q-1-Historie bleibt schreibgeschuetzt.
2. Backend fuehrt B-20 aus: aktuellen Code/Tests pruefen, falls noetig eine konkrete begrenzte Korrektur abschliessen, relevanten Offline-Slice pruefen und den vollstaendigen Deploykandidaten einfrieren.
3. Backend fuehrt D-20 aus: nur veraltete aktuelle KB-Uebersichten korrigieren; alle historischen Ergebnisabschnitte bleiben unveraendert.
4. QA friert/verifiziert die endgueltige Kandidatenfassung und fuehrt die Offline-Gates aus Abschnitt 8 aus.
5. Wenn Offline-Gates bestehen, QA fuehrt F, R und G jeweils einmal in Reihenfolge auf derselben Fassung aus, vervollstaendigt die unabhaengige semantische Review und schreibt den neuen Q-20-Bericht. Keine Reparatur und kein zweiter Lauf zwischen diesen Gates.
6. Nur bei Q-20 Verdict `PASS` uebergibt der Orchestrator R-20 einmalig an Infrastructure. Jeder andere Status beendet diese Runde ohne Alpha-Deploy.
7. Infrastructure veroeffentlicht einmal Functions-only, fuehrt Postdeploychecks aus und erstellt den Releasebericht. Kein Mobile Build, keine Wiederholung und keine automatische historische Finding-Schliessung.
8. Orchestrator berichtet dem Nutzer den Q-20-Verdict, gegebenenfalls den Deploy-/Postdeploystatus und weiterhin offene historische/UNVERIFIED-Befunde; QA liefert ihren unabhaengigen Bericht selbst.
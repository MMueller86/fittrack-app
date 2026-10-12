# B-2 Recipe Preparation v15 Handoff

Datum: 2026-10-09. Paket: ausdruecklich freigegebenes v15 B-2.
Status: Implementierung und Offlinegates vorhanden; LIVE FIXNACHWEIS FAIL, IMPORTREGRESSION FAIL. Paket nicht abnahmefaehig. Nach fehlgeschlagenem erstem Live-Lauf gestoppt; kein retry-until-green, keine neue Architektur, kein Deployment.

## Scope und Herkunft

Ausgangslage war ein schmutziger Worktree mit B-1 und frueherer Arbeit. Der gesamte HEAD-gegen-Worktree-Diff ist NICHT der B-2-Diff. Diese Tabelle bezeichnet nur die in dieser Bearbeitung hinzugefuegten/geaenderten Hunks:

| Datei | B-2-Hunks |
|---|---|
| [recipes.ts](../../../backend/src/functions/recipes.ts) | Einzigen Freitextbuilder durch strukturierte Kontextprojektion ersetzt; Handler ruft analyzeRecipeText mit leerem Importtext und explizitem internem Kontext auf. |
| [openai.ts](../../../backend/src/lib/openai.ts) | RecipePreparationContext und genau ein optionaler zweiter Parameter; JSON.stringify im Usermessage-Datenkanal, statischer Preparation-Zusatz im Systemkanal. |
| [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | Preparation-Version v1 und kurzer Preparation-Zusatz vor bestehendem Importprompt. Kein Edit am erhaltenen v15-Importpromptkoerper. |
| [recipes.test.ts](../../../backend/src/functions/recipes.test.ts) | Neuer Requestbindungstest und exakter AC-2-Handlertrace mit echtem Validator. |
| [ai.test.ts](../../../backend/src/functions/ai.test.ts) | Neuer SDK-Requesttest und explizite Importrequest-Kompatibilitaet. |
| [recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts) | Nur zusaetzlicher Typeimport und separate synthetische gespeicherte Preparationfixture mit Source-/Exportrubrik 1..8. Acht Importfixtures, Inputs, Constraints und vorhandener Helper unveraendert. |
| [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | Preparation-v1-Guard, getrennter Preparation-Aufrufzweig, synthetische Evidenz und Semantikcheck vor Counts; beim Import zusaetzlich voller Analyzevalidator nach bestehenden Assertions. |
| [recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) | Exakter AC-2-Validatortrace und synthetische Offline-Rubrik mit gueltigen Alternativgruppen/Mutationen. Runtimevalidator unveraendert. |
| Dieses Handoff | Eigenstaendige aktuelle Backend-Evidenz, keine KB-/QA-Arbeit. |

Keine Aenderungen an shared/mobile/infra, Ressourcen, SDK, Schema, Tokenbudget, Modellkonfiguration, Quota, Persistence, APIvertrag, Renderer oder Timeouts. Kein doppelter Builder, kein neuer Promptversionsspeicher, keine neue Testframework-Abstraktion. Keine ID-Auffuellung, Textreparatur oder Retry. Bestehende Validator-/Privacy-/Importtests und B-1-Hunks erhalten.

Importversion v15 dokumentiert die in B-1 belegte Ruecknahme der v14-Planungs-/Mehraktionszusaetze auf v13-Semantik, keine historische Wortlautrekonstruktion. Die drei im B-1-Handoff ausgesetzten vermischten Teilhunks bleiben unangetastet. Preparation hat die eigene Version v1 im selben Modul und einen eigenen Evalguard. PO-1 (exakt min(N,5) vs. maximal 5) bleibt offen; Counts/Constraints nicht abgeschwaecht.

KB-Konflikt bleibt: AI-KB nennt v13, Preparation-KB beschreibt keinen Promptzusatz. Kein KB-Edit, da dieses Paket KB-Arbeit ausdruecklich ausschliesst. Separate Angleichung durch das dafuer zustaendige Paket erforderlich.

## Request Red / Green

Alle Vitestbefehle hier im backend-Verzeichnis. Kurze Requestchecks verwenden gezielte Testselektion; deren bewusst abgewaehlte Tests sind KEIN Live-PASS.

| Check | Exit | Evidenz |
|---|---:|---|
| npx vitest run src/functions/recipes.test.ts -t 'binds preparation' | 1 | Erster Testvorbereitungsfehler: repo.upsert existiert nicht. Dieser Lauf zaehlt NICHT als Request-Red. Nur Testvorbereitung auf bestehendes repo.update korrigiert. |
| npx vitest run src/functions/recipes.test.ts -t 'binds preparation' --reporter=dot --silent | 1 | Echter Handler-Red um 09:33:18: erwartet zwei Argumente, leerer Importtext plus recipeContext/steps; erhalten ein Freitextargument. Gespeicherter Titel fehlte darin. Orders 7,3 wurden absichtlich unsortiert als Requestprobe verwendet, keine Behauptung gueltiger Runtime-Abnahme dieser Reihenfolge. |
| npx vitest run src/functions/ai.test.ts -t 'sends preparation JSON' --reporter=dot --silent | 1 | Echter SDK-Request-Red um 09:33:45: optionaler Kontext ignoriert; JSON.parse der leeren Usernachricht scheitert mit Unexpected end of JSON input. |
| npx vitest run src/functions/recipes.test.ts src/functions/ai.test.ts -t 'binds preparation\|sends preparation JSON\|keeps import requests' --reporter=dot --silent | 0 | Nach Implementierung um 09:34:22: 3/3. Handlerbindung, JSON/Systemtrennung, unveraenderter Importrequest. |

Handler liefert die originale gespeicherte Arrayreihenfolge und order/title/description; keine Sortierung/Neunummerierung/Neuschreibung. Metadaten/Zutaten sind recipeContext, ohne persistierte IDs oder private Nutzermetadaten. Client serialisiert den Kontext als JSON-Daten und mischt keine Rezepttexte in Systeminstruktionen. Import ohne Kontext behaelt Systemprompt und Originaltext. Ein Strict-Schema-Provideraufruf, Temperatur 0.2 und max_tokens 2048 bleiben bestehen. Requesttest prueft Unveraendertheit des Eingabekontexts.

## AC-2 Negativtrace

Gespeicherte Sourceorders: [1,2,3,4,5,6,7,8]. Exportgruppen: [1],[2],[3],[4],[6,7]. Flattened: [1,2,3,4,6,7].

Exakte Validator-/Handlerdiagnose:

```json
{
  "phase": "semantic",
  "code": "source_step_coverage_mismatch",
  "path": "exportSuggestion.steps",
  "sourceStepTrace": {
    "expectedOrders": [1,2,3,4,5,6,7,8],
    "actualOrders": [1,2,3,4,6,7],
    "firstMismatchPosition": 5,
    "expectedOrder": 5,
    "actualOrder": 6
  }
}
```

Handler: 422; ein Analyzeaufruf; kein trackUsage, update oder compareAndReplace; geladene Version/ETag unveraendert. Die KI-Quellliste wurde absichtlich auf [1,2,3,4,6,7] gesetzt: sie besteht fuer sich den Preparationvalidator, umgeht aber NICHT die gespeicherte Validierungsbasis. Diagnose im sicheren Log entspricht den obigen Zahlen, Exporttrace bleibt unrepariert. Dieser Negativtest ist kein Red/Green des Promptfixes. Bestehende Tests fuer fehlende/doppelte/unbekannte/vertauschte Referenzen und Leertext bleiben gruen.

## Synthetische Aktionsmatrix

Fixture: synthetic-saved-eight-steps-rice-serving. Ausschliesslich neu definierte synthetische Schritte, keine behaupteten historischen Rezeptdetails. Zutatenkontext: Haehnchen 350g, Reis 150g, Olivenoel 15g, Salz/Pfeffer unbestimmt; zwei Portionen. Reis ist Order 5, finales Servieren Order 8. Bestehende Kartoffel-/Bohnen-Importfixture und deren Rubrik bleiben separat erhalten.

| Source | Synthetische Handlung/Details | Exportrubrik und Live-Lauf-1-Restbefund |
|---:|---|---|
| 1 | Haehnchen in Wuerfel schneiden | Schneiden plus Haehnchen plus Wuerfel in referenzierender Gruppe; live fehlen Wuerfel. |
| 2 | Haehnchen mit Salz und Pfeffer wuerzen | Wuerzen, Haehnchen, Salz/Pfeffer; live nur wuerzen, Gewuerze fehlen. |
| 3 | Olivenoel in Pfanne erhitzen | Erhitzen, Olivenoel, Pfanne; live Oel erwaehnt, Erhitzen/Pfanne fehlen. |
| 4 | Haehnchen bei mittlerer Hitze 4 Min. je Seite braten | Braten, Haehnchen, mittlere Hitze, Zeit je Seite; live Braten vorhanden, Hitze/Zeit/Wendepunkt fehlen. |
| 5 | Reis separat 12 Min. in Salzwasser kochen und abgiessen | Kochhandlung mit Reis, separat, 12 Min., Salzwasser, Abgiessen; live erhalten. |
| 6 | Hitze senken, Haehnchen weitere 6 Min. garen | Senken, Hitze, Haehnchen, Garen, weitere 6 Min.; live erhalten. |
| 7 | Haehnchen aus Pfanne nehmen, zugedeckt 3 Min. ruhen | Entnahme, Haehnchen/Pfanne, zugedeckt, 3 Min., Ruhen; live fehlt Entnahme. |
| 8 | Haehnchen mit Reis als Beilage servieren | Servierhandlung und beide Komponenten mit Beilagenbeziehung; live erhalten. |

Vorhandenen test-only assertRecipeStepSemantics wiederverwendet, kein Runtime-Semantikschutz. Source- und Exportassertions decken jeweils alle Orders 1..8 ab und pruefen Texte genau ihrer Referenzgruppe, nicht andere Gruppen. Keine numerische Temperatur erfunden, kein vorgegebener Modellwortlaut oder feste Gruppengrenze.

Offline: zwei alternative angrenzende Partitionen bestehen: [1,2],[3,4],[5],[6,7],[8] und [1,2,3],[4],[5],[6,7],[8]. Alle Texte liegen unter dem unveraenderten 90-Zeichenlimit; Count jeweils 5.

20 Detailmutationen plus Reis-/Serviertextswap scheitern an der Rubrik. Mutationen betreffen Wuerfel, Wuerzen/Pfeffer, Oelerhitzen/Oel, mittlere Hitze, je Seite vs. insgesamt, Reiskochen statt Reisnennung, separates Kochen, 12 Min., Salzwasser/Abgiessen, Hitzereduktion, weitere Garzeit/6 Min., Abdeckung/3 Min. Ruhe, Servieren/Reis/Beilagenbeziehung. Jede neue Mutation prueft vor UND nach Aenderung Preparationvalidator.ok=true sowie nach Aenderung die exakte 1..8-Partition. Swap behaelt ebenfalls gueltige Struktur. Der erste Offline-Lauf hatte zwei ueberlange mutierte Texte; nur die synthetische Ausgangsbeschreibung wurde gekuerzt, bis auch diese Strukturchecks bestanden. Keine Lockerung des Limits.

## Aktuelle Gates

| Pflichtbefehl | Exit | Ergebnis |
|---|---:|---|
| npx vitest run src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/recipeAnalyzeValidation.test.ts | 0 | 293/293, drei Dateien; Start 09:37:13, 17.08s. Handler 102, AI 78, Validator/Rubrik 113. |
| npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts, Lauf 1 | 1 | Start 09:37:56, 84.25s. Guards 2/2 bestanden, Preparation 0/1, Import 1/8. Insgesamt 3 bestanden/8 fehlgeschlagen, kein Skip, echte Providerantworten. |
| Derselbe Befehl, Lauf 2 | nicht ausgefuehrt | Nach Fehler in Lauf 1 gestoppt. Dreiernachweis NICHT erbracht. |
| Derselbe Befehl, Lauf 3 | nicht ausgefuehrt | Nach Fehler in Lauf 1 gestoppt. Kein selektiver Ersatzlauf. |
| npm run test:eval (Gesamtgate) | nicht ausgefuehrt | Nach fokussiertem Livefehler gestoppt; Gesamt-Livegate UNVERIFIED. Kein aktueller DailyInsight-Livebefund, keine fremde Reparatur. |
| npx vitest run | 0 | 1406/1406, 66 Dateien; Start 09:39:52, 22.43s. Keine Renderer-/Timeout-/Skiplockerung. |
| npm run typecheck | 0 | Keine TypeScriptfehler. |
| npm run build:verify | 0 | Compile, Assetkopie, Modulaufloesung, doppelte Function-IDs bestanden. Erwartete Azure-Functions-Testmoduswarnungen sind kein Live-Skip. |
| root git diff --check | 0 | Keine Whitespacefehler; bestehende CRLF/LF-Hinweise. |

Live-Serie vorab als genau drei volle unmittelbar aufeinanderfolgende fokussierte Laeufe angekuendigt, jeweils acht Importfixtures plus neue Preparationfixture und zwei Guards. Beim ersten Fehler abgebrochen, kein weiterer Provideraufruf und keine inhaltliche Nachbesserung auf Verdacht. Ein neuer Dreiernachweis wuerde eine inhaltliche Korrektur und neue Festlegung voraussetzen. Kein universeller Zuverlaessigkeitsanspruch, kein Live-PASS.

Parameter: aktiver Deploymentname gpt-4o-mini, API-Version 2024-08-01-preview (nur diese nichtgeheimen Werte strukturiert aus bestehender Konfiguration ausgelesen). Temperatur 0.2, max_tokens 2048, bestehendes recipe_analyze Strict Schema/SDK/Ressourcen unveraendert. Keine Credentials oder Endpoints im Handoff. Credentialwrapper meldete keinen Exit 2; dieser Lauf war FAIL, nicht credentialbedingt UNVERIFIED.

## Vollstaendiger synthetischer Live-Exporttrace

Die folgenden Modelltexte stammen ausschliesslich aus den beiden synthetischen Fixtures in Lauf 1. JSON verwendet Unicode-Escapes, damit die Originaltexte ohne Encodingabhaengigkeit erhalten bleiben. Keine privaten Rezept-/Modell-/Fehlertexte. Zahlen/Längen wurden nach UTF-8-Decodierung bestimmt.

Preparation: modellseitige Quellschritte entsprechen der gespeicherten Liste samt vorhandenen Titeln und Beschreibungen; fehlende optionale Titel sind im Strict Output null. Geordnete Exportpartition 1..8, Count 5 und Laengen 57/65/56/45/43. Semantik scheitert VOR Countassertions an Wuerfelverlust; die gesamte Evidenz wurde davor ausgegeben, sodass die weiteren Detailverluste und Referenzbeziehungen unabhaengig davon sichtbar sind.

```json
[
  {"order":1,"sourceStepOrders":[1,2,3,4],"description":"Schneide das H\u00e4hnchen, w\u00fcrze es und brate es in Oliven\u00f6l.","ingredientKeys":["ingredient-1","ingredient-4","ingredient-5","ingredient-3"]},
  {"order":2,"sourceStepOrders":[5],"description":"Koche den Reis separat 12 Minuten in Salzwasser und gie\u00dfe ihn ab.","ingredientKeys":["ingredient-2"]},
  {"order":3,"sourceStepOrders":[6],"description":"Senke die Hitze und gare das H\u00e4hnchen weitere 6 Minuten.","ingredientKeys":["ingredient-1"]},
  {"order":4,"sourceStepOrders":[7],"description":"Lasse das H\u00e4hnchen zugedeckt 3 Minuten ruhen.","ingredientKeys":["ingredient-1"]},
  {"order":5,"sourceStepOrders":[8],"description":"Serviere das H\u00e4hnchen mit Reis als Beilage.","ingredientKeys":["ingredient-1","ingredient-2"]}
]
```

Import side-dish-and-serving-actions: Sourceorders 1..8 und Quellbeschreibungen aus unveraenderter nummerierter Eingabe erhalten, Exporttrace vollstaendig 1..8, aber Count 4 statt 5. Details unabhaengig vom Countbefund: Salzwasser/Abgiessen und Bissfestigkeit fehlen in Gruppe 1; Oelerhitzen/Pfanne, mittlere Hitze/4 Min. je Seite fehlen in Gruppe 2; weitere 6 Min. und Entnahme/zugedeckt/3 Min. Ruhe fehlen in Gruppe 3; ausdrueckliche Beilagenbeziehung fehlt in Gruppe 4. Laengen 62/74/76/68.

```json
[
  {"order":1,"sourceStepOrders":[1,2],"description":"Koche die Kartoffeln 18 Minuten und gare die Bohnen 8 Minuten.","ingredientKeys":["ingredient-2","ingredient-3"]},
  {"order":2,"sourceStepOrders":[3,4,5],"description":"W\u00fcrze die H\u00e4hnchenbrust mit Salz und Pfeffer und brate sie in Oliven\u00f6l an.","ingredientKeys":["ingredient-1","ingredient-4","ingredient-5","ingredient-6"]},
  {"order":3,"sourceStepOrders":[6,7],"description":"Gare das H\u00e4hnchen bei reduzierter Hitze 6 Minuten fertig und lasse es ruhen.","ingredientKeys":["ingredient-1"]},
  {"order":4,"sourceStepOrders":[8],"description":"Schneide das H\u00e4hnchen auf und serviere es mit Kartoffeln und Bohnen.","ingredientKeys":["ingredient-1","ingredient-2","ingredient-3"]}
]
```

## Acht unveraenderte Importfaelle in Lauf 1

| Fixture | Ergebnis / erster fehlgeschlagener Check |
|---|---|
| mixed-food-seasoning | FAIL: leere Exportbeschreibung. |
| borderline-classification | FAIL: 3 statt erwarteter 5 Exportschritte. |
| explicit-quantities-with-unit-conversion | FAIL: 4 statt erwarteter 5 Exportschritte. |
| missing-quantities-food-gets-estimated | FAIL: 3 statt erwarteter 5 Exportschritte. |
| indeterminate-spray-oil-stays-food | FAIL: 1 statt erwarteter 3 Exportschritte. |
| no-lost-or-invented-ingredients | FAIL: leere Exportbeschreibung. |
| full-recipe-output-fields | PASS: alle Assertions inklusive vollem Analyzevalidator. |
| side-dish-and-serving-actions | FAIL: Salzwasserverlust im Export; weitere Details und Countabweichung siehe vollstaendige Evidenz oben. |

Frueh abgebrochene Assertions beweisen keine erfolgreiche spaetere Zutatenvalidation fuer fehlgeschlagene Fixtures. Die Importanfragen benutzen weiterhin KEINEN Preparation-Kontext. Aus diesem Lauf folgt keine Kausalitaetsbehauptung, dass B-2 den Import verschlechtert hat; es fehlt ein aktueller bestandener Vorher-Livebaseline. Belegt ist ausschliesslich das Scheitern des erforderlichen aktuellen Importgates.

## Integritaet und Grenzen

Die bestehende Fixturedatei wurde vor/nach logisch verglichen: aus aktuellem Inhalt nur den neuen Preparation-Typeimport und den neuen Preparationfixtureblock entfernt. SHA-256 dieser rekonstruierten unveraenderten Vorherbytes: 4D428AE6DA6EEFF1DD9D84C98D3640280FC6043C761613AB59FC6A576347186E, exakt B-1-Ausgangshash. Das belegt unveraenderte acht Importinputs, Constraints und bisherigen Helper; kein neu behaupteter historischer Snapshot.

Historische B-1-Artefakte erneut byteweise gehasht und unveraendert:

| Artefakt | SHA-256 |
|---|---|
| [Ausgangsdiff](B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt) | 07FF1F0B20DE4D6590E0D7647975FA92414189FA71174D10B54F24C22CEBC767 |
| [Enddiff](B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch) | 76D9DFF2C42C47A5E4F6A82094B06DD596DD4BBD969242874F614A9C2FB05082 |
| [Ruecknahmediff](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch) | F61A4FB4CB75DF84BA82ECA9E43C2EEDDEEB2090E780338F12E5CDABB0DEB5AB |

Diff-/Versions-/Secretpruefung: Clientdiff enthaelt nur optionalen Kontext, Systemzusatz und JSON-Datenbindung; Schema, 0.2/2048, Modellwahl und Provideranzahl nicht geaendert. Keine neuen Secrets oder privaten Daten in den eigenen Hunks. Alle geaenderten Backenddateien ohne Editor-Diagnosen. Bestehende Privacyregression fuer alle erfassten log/warn/error-Argumente besteht, ebenso Auth-/ETag-/Quota-/422-/429-/502-/Usage-/Transienz-/Importvalidationstests. Abschliessender strukturierter Evidenzabgleich Exit 0: alle drei JSON-Bloecke parsebar, beide dokumentierten Exporttraces feldweise identisch mit Lauf 1, originale Preparationorders/titles/descriptions erhalten (nur fehlende Titel als null im Strict Output). Kein externer Sitzungsartefaktpfad zum Verstehen dieses Handoffs erforderlich.

Semantische Runtimegrenze bleibt ausdruecklich bestehen: valide Referenzen/Counts/Laengen garantieren NICHT die Erhaltung der Handlungen/Details. Der Runtimevalidator wurde nicht erweitert; die Rubrik ist nur Testevidenz. Preparation-Sourcevalidierung weiterhin gegen recipe.steps, nicht gegen KI-Schritte. Vollstaendigkeit unter den Limits ist offline fuer diese synthetische Fixture darstellbar, aber live nicht nachgewiesen. Keine Annahme neuer Provider-/Schema-/APIfaehigkeiten und kein Scopeausbau. Restbefund an Orchestrator: AC-3/AC-7 nicht erfuellt, weiterer inhaltlicher Beschluss erforderlich; dieses Paket liefert keine Freigabe.
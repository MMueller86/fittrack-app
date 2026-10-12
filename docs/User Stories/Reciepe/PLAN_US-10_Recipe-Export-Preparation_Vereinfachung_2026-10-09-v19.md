# US-10 - Recipe Export Preparation: Vereinfachung v19

Status: Kandidatenimplementierung vorhanden; unabhaengige QA offen; Plan-/Korrekturfreigabe und bedingter Alpha-Deploy vorab erteilt
Infrastructure Impact: Alpha
Mobile Build Impact: None

Datum: 2026-10-09

## 1. Auftrag und Bewertung

Diese Revision aktualisiert ausschliesslich den Plan zum bereits vorhandenen Kandidaten. Sie fuehrt weder eine neue Produktanforderung noch einen neuen Implementierungsauftrag ein. Die Implementierung ist Gegenstand der QA, nicht etwas, das an einen veralteten Plan angepasst werden soll.

Die bestaetigte Produktauslegung bleibt: Die KI liest das ganze gespeicherte Rezept und fasst es fuer die vorhandene Exportansicht in hoechstens fuenf Schritten mit maximal 90 Zeichen pro Schritt zusammen. Sie darf selbsterklaerende oder nachrangige Handlungen weglassen, selbst entscheiden, welche Handlungen sie gruppiert, und muss keine nur benachbarten Quellschritte gruppieren. Die Reihenfolge aller enthaltenen Handlungen bleibt relativ zum Original konsistent. Weniger als fuenf Schritte sind erlaubt.

Ziel ist eine brauchbare Kochkurzfassung, kein neuer Kochassistent, keine neue Importfunktion und keine allgemeine Bereinigung. Die Ausgabe bleibt ein Vorschlag zur Nutzerpruefung. Wesentliche Zubereitung und vollstaendiges Garen duerfen nicht durch eine blosse Zutaten- oder Komponentenbenennung ersetzt werden. Die bestehende technische Referenzvalidierung gespeicherter Preparation bleibt unveraendert; sie beweist fuer sich allein keine semantische Vollstaendigkeit.

AI ist fuer semantische Auswahl und sprachliche Verdichtung passend. Deterministisches First-five oder Abschneiden loest diese Aufgabe nicht. Struktur-, Laengen-, Template- und Referenzpruefungen bleiben deterministisch. Weder ein Live-Lauf noch ein bestandener Fixture-Lauf begruendet eine allgemeine stochastische Garantie fuer Kochqualitaet oder Lebensmittelsicherheit.

## 2. Offene Entscheidungen und Grenzen

Es gibt keine offene Product-Owner-Frage und keine neue Produktentscheidung. Der Nutzer hat Plan und erforderliche Korrekturen vorab freigegeben und den bedingten Deploy nach Alpha ausdruecklich beauftragt; fuer Plan-/Korrekturrunden oder den nach QA-PASS folgenden Deploy ist keine erneute Approval-Abfrage erforderlich. Diese Freigabe fuehrt jetzt keine Backend-Aenderung ein und autorisiert keine Arbeit ausserhalb des bestaetigten Scopes.

"Ziel Template oder Zielregeln" wird weiterhin durch die bestehenden textlichen Template-Regeln ausgedrueckt, nicht durch ein Bild, JSX, Fonts oder Renderer-Code im KI-Request. Die echte Renderermessung bleibt massgeblich fuer Pixelpassung.

Infrastructure Impact ist Alpha. Der bedingte Nutzerauftrag gilt fuer diesen Kandidaten: Deploy erst, wenn unabhaengige QA mit PASS abschliesst und alle in diesem Plan obligatorischen Offline-, Preparation-, Recipe- und Overall-Live-Gates nach den unveraenderten QA-Kriterien bestanden sind. Dann routet der Orchestrator ohne weitere Nutzerabfrage direkt `Deploy to Alpha` an FitTrack Infrastructure & Release. Bei QA FAIL oder UNVERIFIED kein Deploy. Infrastructure & Release fuehrt die vorgeschriebenen Auth-, Clean-Build-, Staging-/Artefaktpruefungs-, Remote-Publish- und Post-Deploy-Health-Checks aus; kein Expo Preview Build. Fuer andere Alpha-Aenderungen bleibt der uebliche ausdrueckliche Deploy-Auftrag erforderlich. Keine neuen Azure-Ressourcen, Dependencies, Mobile- oder Shared-Vertragsaenderungen.

## 3. Bestaetigter Ist-Zustand

- Der Import verwendet weiterhin `RECIPE_ANALYZE_PROMPT_VERSION = 'v16'` und erzeugt Quellrezept sowie Exportvorschlag in demselben `analyzeRecipeText`-Aufruf. Eine Trennung wuerde einen zusaetzlichen OpenAI-Aufruf verursachen.
- Gespeicherte Preparation verwendet `prepareRecipeExport` und den bestehenden kleinen Strict-Providervertrag `recipe_export_preparation`. Preparation-Promptversion ist v9. Die Prompttrennung hat Provider-Schema, Deployment, temperature 0.2 und max_tokens 2048 nicht geaendert.
- Der erste Preparation-Aufruf enthaelt nur Anweisungen fuer Erstellung und Zusammenfassung. Struktur-/Referenzfehler und gemischte Fehler werden im Folgeaufruf mit `RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT` v9 als ein vollstaendiger Entwurf korrigiert. Reiner gemessener Textueberlauf behaelt den kurzen Text-only-Prompt und das bestehende `recipe_text_correction`-Schema; mehrere betroffene Texte koennen in einem Aufruf behandelt werden.
- Die bestehende Schleife erlaubt unveraendert einen Entwurf und hoechstens zwei Korrekturen. Quota, SDK-Retry-Verhalten, Schema, API, Persistenz, Renderer und erlaubte Aufrufzahl wurden durch die Prompttrennung nicht erweitert. Share-Bundle und Bildrenderer loesen keine AI-Aufrufe aus.
- Der Preparation-Handler laedt die Quelle serverseitig und liefert den bestehenden Response V2. Quellreferenzen bleiben intern; Preparation schreibt weder Rezept noch bestaetigte Exportansicht. Templategrenzen und gespeicherte Preparation-Referenzvalidierung bleiben wie in v19 beschrieben.
- Nutzerziel und Prompt erlauben das Weglassen selbsterklaerender Schritte sowie freie, auch nicht-adjazente Gruppierung. Die enthaltenen Handlungen muessen die Originalreihenfolge bewahren. Das ist Promptabsicht, keine universelle semantische Laufzeitgarantie.
- Der v9-Gesamt-Livelauf vor dem Weekly-Eval-Harness-Fix hatte 41/42 Assertions; alle 14 Recipe-Assertions (8 Import-Fixtures, 4 Preparation-Fixtures, 2 Versionsguards) waren gruen. Der einzige Fehler war Weekly Insight `special-activity-under-effective-target`: Judge-Evidence begann mit `dein`, waehrend der generierte Quelltext `Dein` enthielt. Der Judge hatte `effective_target` / `within_effective_target` bewertet; die Aussage zu 3000/3600 = 83,3 % war inhaltlich passend.
- Der anschliessende Fix vergleicht Evidence im ausschliesslich fuer Evals genutzten `backend/src/test-utils/weeklyInsightEvalSemantics.ts` ohne Beachtung der Gross-/Kleinschreibung. Tests pruefen Gross-/Kleinschreibungsvarianten und lehnen weiterhin geaenderte Kalorien- oder Prozentwerte ab. Produktionsprompts und Berechnungen fuer Daily/Weekly Insight bleiben unberuehrt. Der fokussierte Weekly-Diagnostic-Lauf bestand danach 3/3; Backend-Unit-Tests bestanden 1611/1611.
- Der vollstaendige v9-Gesamtlivelauf wurde nach genau diesem Harness-Fix noch nicht wiederholt. Sein Gesamtgate ist daher offen. Die manuelle Inhaltspruefung des Ofen-Fixtures bleibt HUMAN/MANUAL REVIEW und darf nicht als automatisch semantisch verifiziert ausgewiesen werden.
- Der historische [v18-QA-Bericht](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Nachpruefung.md) bleibt FAIL und wird nicht umgeschrieben. Die lokale Rubrikkorrektur FT-QA-2026-072 schliesst keine unabhaengigen Preparation-, Import-, Daily- oder Capture-Befunde; FT-QA-2026-076 bleibt getrennt.

Die bestehende Implementierung ist die Referenz fuer den Ist-Zustand; wo sie vom alten Plantext abweicht, wird der Plan aktualisiert und nicht der Backend-Code zur Erfuellung eines ueberholten Entwurfs veraendert. Die immutable Story bleibt unangetastet. Ihre Auslegung als selektive Kochkurzfassung wird in der QA bewertet, einschliesslich Reihenfolge, Quelltreue und manueller Sichtung.

## 4. Scope und Nicht-Ziele

Scope dieser Revision: Plantext, Status, Evidenzstand, Abnahmekriterien und nachfolgende QA-/Release-Gates an den bereits vorhandenen Kandidaten angleichen. Die in v19 festgelegten fachlichen und technischen Anforderungen bleiben als QA-Massstab bestehen, soweit sie dem implementierten Verhalten entsprechen.

Nicht-Ziele:
- Backend-, Mobile-, Shared-, Test-, Eval-, Infrastructure- oder Renderer-Code aendern oder eine zweite Implementierungsrunde starten.
- Import v16, Preparation-Aufrufbudget, Quota, Provider-Schema, API, Persistenz, Template oder gespeicherte Referenzvalidierung veraendern.
- Neue Produktanforderungen, Promptvarianten, Retry-Schleifen, Provideraufrufe oder semantische Laufzeitvalidatoren einfuehren.
- Historische QA-Berichte, Findings, Register, User Story oder andere Plandateien umschreiben oder als geschlossen markieren.
- Alpha deployen, bevor unabhaengige QA mit PASS abschliesst und alle obligatorischen Offline-, Preparation-, Recipe- und Overall-Live-Gates nach den bestehenden QA-Kriterien bestanden sind.

Persistence Impact: Keine Aenderung an Dokumenten, Repositorys, Containern oder Migrationen. Dev-/Alpha-Rezepte und bestaetigte Exportansichten bleiben durch diesen Planabgleich unberuehrt.

## 5. Technische Loesung

### 5.1 Ein kleiner Preparation-Vertrag

Der kleine eigenstaendige Vertrag ist bereits in der vorhandenen [Provider-Datei](../../../backend/src/lib/openai.ts) umgesetzt: `prepareRecipeExport` verwendet den bestehenden `RecipePreparationContext`; `analyzeRecipeText` bleibt Import-only. Dies ist Bestandsbeschreibung, keine erneute Anweisung, Vertrag oder Call Sites umzubauen.

Die v9-Prompttrennung verwendet fuer Ersterstellung und Full-Draft-Korrektur dasselbe bestehende Strict-Schema `recipe_export_preparation`; reine Textkorrektur verwendet weiterhin das vorhandene Strict-Schema `recipe_text_correction`. Jede Objektebene des Preparation-Schemas weist Zusatzfelder zurueck. Die Implementierung nutzt denselben lazy Azure-Client, dieselbe Deploymentauswahl und temperature 0.2/max_tokens 2048. Die Promptaenderung hat weder Schema noch Aufrufbudget, SDK-Retry-Verhalten oder Quota veraendert.

Provider-Ausgabe exakt:

```ts
{
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: Array<{
    order: number;
    description: string;
    sourceStepOrders: number[];
  }>;
}
```

Keine Name-/Portions-/Tags-/Description-Neuausgabe, keine ingredients, ingredientKeys oder includedIngredientKeys. Die kleine backendinterne Type und das Schema verbleiben in `openai.ts`. Harte Schema-Constraints soweit vom bestehenden Azure-Structured-Output unterstuetzt; unabhaengig davon alle Limits serverseitig pruefen. Keine SDK-/API-Version-Aenderung zur Durchsetzung optionaler Schemafeatures.

Input weiterhin das vollstaendige, serverseitig gespeicherte Rezept in der bestehenden reduzierten JSON-Darstellung: Kontextmetadaten, alle Zutaten ohne private Persistenz-IDs und alle originalen order/title/description. Kein Clientrezept als Autoritaet. Nicht vorsortieren, nicht first-five vorfiltern, nicht abschneiden. Bestehende Datensparsamkeit erhalten.

### 5.2 Zielregeln und kurzer Preparation-Prompt

#### v9-Prompttrennung und unveraenderte Aufrufgrenzen

Das bestehende Promptmodul verwendet `RECIPE_PREPARATION_PROMPT_VERSION = 'v9'`; Import bleibt auf v16. Der initiale Preparation-Prompt enthaelt nur die Erstellungs-/Zusammenfassungsaufgabe. Bei Struktur-, Referenz- oder gemischten Fehlern verwendet der Folgeaufruf `RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT` v9 und fordert einen vollstaendigen korrigierten Entwurf. Bei ausschliesslichem gemessenem Textueberlauf bleibt der sehr kurze Text-only-Prompt aktiv; er kann mehrere betroffene Felder in einem Korrekturaufruf behandeln und ersetzt nur diese Texte.

Die bestehende Grenze bleibt ein initialer Entwurf plus hoechstens zwei Korrekturen. Diese Trennung fuehrt keine zusaetzlichen erlaubten Aufrufe ein und aendert weder Provider-Schemas noch Quota, Temperature/Tokenbudget, API, Persistenz, Save/Share oder Renderer. Der Import v16 erzeugt weiterhin den Exportvorschlag im selben Call, damit keine zweite OpenAI-Anfrage entsteht. Share-Bundle und beide Bildrenderer loesen keine AI-Aufrufe aus.

Die Promptanweisung erlaubt das eigenstaendige Weglassen selbsterklaerender Details und das Gruppieren beliebiger, auch nicht benachbarter Quellschritte. Enthaltene Handlungen muessen in der Reihenfolge des Originalrezepts bleiben. Der Prompt nutzt die bestehenden Shared-Templatewerte und behandelt Rezeptdaten als untrusted data; er verspricht weder pixelgenaue Passung ohne Renderer noch universelle semantische oder stochastische Qualitaet.

### 5.3 Referenzen fuer nachvollziehbare Gruppierung
Die folgende saved-Preparation-Referenzvalidierung ist der bestehende v19-Vertrag; sie wird durch die v9-Prompttrennung oder diese Planrevision nicht geaendert.

Die bestehende saved-Preparation-Validierung verwendet ihre eigene, abgegrenzte Referenzpolicy; die Importregeln bleiben unveraendert:

- Gespeicherte Sourceorders bleiben eindeutig und aufsteigend; bestehende fehlerhafte Quelle bleibt ein Validierungsfehler.
- Exportorders bleiben lueckenlos1..K. Jede Gruppe referenziert mindestens eine bekannte positive Originalorder. Innerhalb einer Gruppe sind Referenzen eindeutig und aufsteigend.
- Eine Quellhandlung darf hoechstens einer Exportgruppe zugeordnet sein: globale Eindeutigkeit bleibt Pflicht. Ausgelassene nachrangige Handlungen sind erlaubt.
- Gruppen werden nach ihrer ersten Quellreferenz aufsteigend ausgegeben. Die abgeflachte Liste muss NICHT mehr global monoton sein. Damit ist [1,4,6] gefolgt von [5] zulaessig; [5] vor [1,4,6] bleibt unzulaessig.
- Referenzen zeigen nur tatsaechlich zusammengefasste Handlungen, nicht alle gelesenen Details. Kochabhaengigkeiten muessen im Text verstaendlich bleiben, etwa durch quellgestuetzte parallele Formulierung. Die strukturelle Referenzpolicy allein beweist dies nicht.

Bestehende gemeinsame einfache Checks duerfen weiterverwendet werden; die unterschiedliche Gruppenreihenfolge muss explizit und testbar sein. Kein generisches konfigurierbares Validierungsframework. Import behaelt alle bisherigen lokalen/globalen Reihenfolgeregeln.

`validateRecipeExportPreparationOutput` validiert den kleinen Provider-Output gegen separat uebergebene gespeicherte Sourcesteps, statt einen kuenstlichen `AiRecipeRaw` aufzubauen. Schemafehler/Sourcefehler/Referenzfehler liefern weiterhin sichere phase/code/path-Diagnostik, ohne Rezepttexte zu loggen.

### 5.4 Handler und Fehlervertrag

Preparationhandler ruft nur `prepareRecipeExport` auf, validiert gegen das geladene Rezept und bildet die Ausgabe auf den bestehenden Response V2 ab. `sourceStepOrders` bleibt intern und erscheint nicht im App-Response. Kein Quota-Key-Wechsel.

Auth/Owner/ETag-vor-Quota, 429, Providerfehler502, Validierungsfehler422 und Usage nur nach Erfolg bleiben erhalten. Ein gespeichertes Rezept ohne Kochsteps wird ohne erfundene Ersatzanleitung mit422 abgelehnt und verbraucht keine AI-Usage; dafuer vor dem Provideraufruf pruefen. Keine neue Fehlermeldung mit privaten Rezeptinhalten.

Kein automatisches Speichern. Das Originalrezept, seine Zutaten, seine Schritte, sein ETag und eine bestaetigte Exportansicht bleiben durch Preparation unveraendert.

## 6. Akzeptanzkriterien

### Evidenz- und Gate-Matrix (Stand 2026-10-09)

| Evidenz | Ergebnis | Bedeutung fuer die Abnahme |
|---|---|---|
| v9-Gesamtliveeval vor dem Weekly-Harness-Fix | 41/42; alle 14 Recipe-Assertions bestanden | Historischer Vor-Fix-Lauf, kein PASS fuer den aktuellen Gesamtstand |
| Weekly-Diagnostic nach dem case-insensitiven Evidence-Fix | 3/3 bestanden | Fokusdiagnostik bestanden; ersetzt nicht das Gesamtgate |
| Backend-Unit-Tests nach dem Fix | 1611/1611 bestanden | Unit-Gate belegt; individuelle Prep-/Recipe- und Gesamt-Livegates bleiben erforderlich |
| Vollstaendiges Eval nach exakt diesem Fix | Noch nicht ausgefuehrt | Offenes Pflichtgate; bis dahin kein Gesamt-PASS |
| Ofen-Fixture | Ausgabe braucht menschliche Inhaltspruefung | HUMAN/MANUAL REVIEW; nicht als automatisch semantisch verifiziert werten |

Die eine Vor-Fix-Weekly-Abweichung war die Gross-/Kleinschreibung des Evidence-Texts (`dein` gegenueber `Dein`), nicht ein geaenderter Zahlenwert. Der Eval-Harness vergleicht den Textausschnitt jetzt case-insensitiv; gezielte Tests akzeptieren Schreibvarianten und verwerfen weiterhin geaenderte Kalorien-/Prozentwerte. Das aendert keine Produktionsprompt- oder Berechnungslogik. Ein einzelner erfolgreicher Livelauf begruendet keine allgemeine Zuverlaessigkeitsgarantie.

1. **AC-1:** Preparation verwendet den bestehenden eigenen kleinen Strict Provider-Vertrag mit den Feldern aus 5.1; Import verwendet weiterhin v16 und den vollen Analysevertrag samt Exportvorschlag in einem Aufruf. Der erste Preparation-Aufruf ist ein Erstellungsaufruf; Korrekturen verwenden nur die dafuer vorgesehene bestehende Prompt-/Schemaauswahl. Keine Import-/Preparation-Vollausgabekopplung bleibt im Preparation-Pfad.
2. **AC-2:** Der gesamte gespeicherte, reduzierte und ID-freie Rezeptkontext erreicht den Provider; Prompt v9 enthaelt die Template-Zielregeln aus Shared-Konstanten. Keine privaten Zutaten-IDs, First-five-Vorselektion oder Ausfuehrung von Instruktionen aus Rezeptdaten. Selbsterklaerende Handlungen duerfen entfallen, beliebige Gruppierungen sind erlaubt, die enthaltenen Handlungen bleiben in Originalreihenfolge.
3. **AC-3:** Die bestehenden Shared-Grenzen sind positiv/negativ geprueft: 1/5 Schritte und 90 Zeichen gueltig; 0/6 Schritte, 91 Zeichen, leere Texte, ungueltige Meta-/Zeitwerte oder unbekannte Felder ungueltig. Teaser 96/97 und positive Zeit/null sind geprueft. Rendererpruefungen fuer 1..5 Schritte mit Produktionsfonts und 1080x1350-PNG bleiben gruen.
4. **AC-4:** Die unveraenderte Preparation-Validierung akzeptiert `[1,4,6],[5]` und Gaps, lehnt leere/unbekannte/doppelte Referenzen, interne Umkehrung und umgekehrte Gruppenstarts ab. Import behaelt seine global monotone Trace-Regel. Keine Source-/Outputmutation und kein Auffuellen fehlender Referenzen.
5. **AC-5:** Die gespeicherte Acht-Schritt-Fixture wird unabhaengig im Handler-/SDK-Eval geprueft: Vorbereitung, Anbraten, separates Reiskochen und Fertiggaren muessen erkennbar und korrekt referenziert sein. Weglassen optionaler Details ist erlaubt; blosse Zutatennennung ersetzt keine Handlung. Ein Live-Ergebnis allein gilt nicht als semantischer Pass.
6. **AC-6:** Ofen- und Nudel-Fixtures bestehen die technischen Gates mit quellgestuetzter Backphase sowie wesentlicher Sauce und separatem Nudelkochen. Exakte Wortlaute oder genau fuenf Schritte sind nicht gefordert. Keine erfundenen Zeiten/Temperaturen oder Komponenten-/Textvertauschung. Die menschliche Inhaltspruefung des Ofen-Outputs wird separat als HUMAN/MANUAL REVIEW dokumentiert und nicht aus dem automatischen Eval abgeleitet.
7. **AC-7:** Auth/Owner/ETag, 429/502/422, bestehende Strict-Schemas, temperature 0.2/max_tokens 2048, Usage nur nach Erfolg und No-writes bleiben verifiziert. Aufrufbudget bleibt ein initialer Entwurf plus hoechstens zwei Korrekturen. Struktur-/Referenz- und gemischte Fehler nutzen je Korrekturrunde einen Full-Draft-Aufruf; reine Textueberlaeufe einen Text-only-Aufruf, der mehrere Felder behandeln kann. Leere Kochbasis bleibt 422 ohne Provider/Usage. Response V2 und Save/Share/Fingerprint bleiben unveraendert.
8. **AC-8:** Cooking-core-/Contradiction-Regressionen, Import-Schutztests, Backend-Unit-Suite, Typecheck und build:verify werden nach dem Harness-Fix im QA-Lauf berichtet. Die Weekly-Evidence-Aenderung bleibt auf Eval-Helper und Tests begrenzt; Produktionsprompts und Berechnungen bleiben unveraendert. Historische Findings werden nicht automatisch geschlossen.
9. **AC-9:** QA fuehrt nach dem Weekly-Harness-Fix jeweils einmal das einzelne Preparation-Livegate, das Recipe-Livegate und das gesamte bestehende Evalgate aus. Fokusfilter werden vorab am Runner verifiziert; alle beabsichtigten Tests muessen enthalten sein. All-skipped, fehlende Credentials oder abgebrochene Laeufe sind UNVERIFIED. Kein Retry-until-green. Das vorherige 41/42-Ergebnis ist kein Post-Fix-Gesamt-PASS.
10. **AC-10:** QA prueft die dokumentierte kleine Preparation-Ausgabe, Import-v16-Trennung, unveraenderte Referenzvalidierung/API und Grenzen der semantischen Runtimepruefung. Bestehende Knowledge-Base-Abschnitte mit v6-Angaben werden als Dokumentationsabweichung benannt, nicht stillschweigend als v9 oder PASS ausgegeben. Diese Planrevision aendert keine KB-, QA-, Findings- oder Registerdatei.

## 7. B-19 Status: Kandidatenstand vorhanden, keine neue Backend-Aufgabe

Die relevanten B-19-Loesungsbausteine sind in der aktuellen Arbeitsrealitaet vorhanden: kleiner Preparation-Providervertrag, gespeicherter Kontext, v9-Promptpfade, bounded Korrekturschleife, bestehende Referenzvalidierung, Handler/API V2 und Tests/Evals. Diese Feststellung ist keine unabhaengige QA-Abnahme und erklaert keine Acceptance Criteria oder Releasegates fuer bestanden.

Es gibt in dieser Planrevision kein aktives Backend-Arbeitspaket und keine Backend-Implementierung vor dem QA-Ergebnis. Backend-Code ist nicht an den alten Abschnitten 5.1/5.2 oder an der Einzelaufruf-Formulierung aus AC-7 auszurichten. QA verifiziert den vorhandenen Kandidaten gegen die aktualisierten ACs. Falls QA notwendige, scope-begrenzte Korrekturen feststellt, sind diese durch die bereits erteilte Nutzerfreigabe abgedeckt; der Orchestrator routet sie an den zustaendigen Owner und fordert danach erneut QA an. Keine erneute Approval-Abfrage und keine sachfremde Erweiterung.

## 8. Dokumentations- und Historiengrenzen

Die Knowledge Base enthaelt bereits v9-Details in `docs/kb/domain/06-recipes.md` und im Preparation-Abschnitt von `docs/kb/tech/06-ai-integrations.md`; zugleich stehen dort noch v6-Angaben, und `docs/kb/domain/07-ai-features.md` nennt Preparation v6. Das ist eine dokumentarische Abweichung vom Repository-Iststand. Diese vom Nutzer auf den bestehenden Plan beschraenkte Revision aendert keine Knowledge-Base-Datei; AC-10 verlangt, dass QA die Abweichung offen benennt und nicht als behoben ausgibt.

Der v18-QA-Bericht, bestehende Findings, Register, User Story und sonstige historische Berichte bleiben unveraendert. Historische PASS-/FAIL-/UNVERIFIED-Werte behalten ihren damaligen Geltungsbereich; insbesondere wird aus dem lokalen Weekly-Harness-Fix kein nachtraegliches Schliessen fachfremder Findings abgeleitet.

## 9. Q-19 - Unabhaengige QA und Vereinfachungsreview

Agent: QA

Goal: Alle 10 ACs unabhaengig gegen den vorhandenen Kandidaten, Tests/Evals und Dokumentation pruefen. Keine Implementierung, Promptreparatur oder eigene Produktentscheidung. Semantische Inhaltspruefung bleibt von Struktur-/Templatevalidierung getrennt.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- Dieser aktualisierte v19-Plan
- docs/User Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md
- docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Nachpruefung.md
- docs/qa/findings.md (read-only)
- docs/qa/reports/README.md
- backend/src/lib/openai.ts
- backend/src/lib/prompts/recipeAnalyze.ts
- backend/src/lib/recipeAnalyzeValidation.ts
- backend/src/lib/recipeAnalyzeValidation.test.ts
- backend/src/lib/recipePreparation.ts
- backend/src/lib/recipePreparation.test.ts
- backend/src/functions/recipes.ts
- backend/src/functions/recipes.test.ts
- backend/src/functions/ai.test.ts
- backend/src/lib/prompts/recipeAnalyze.eval.test.ts
- backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts
- backend/src/test-utils/weeklyInsightEvalSemantics.ts
- backend/src/test-utils/weeklyInsightEvalSemantics.test.ts
- backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts
- shared/types/recipeExport.ts
- shared/types/recipes.ts
- backend/scripts/run-eval.mjs
- backend/package.json
- backend/output/recipe-preparation-v9-separated-prompts-eval-2026-10-09.json (Vor-Fix-Evidenz, historisch)

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria: AC-1 through AC-10; US-10AC15/16 nach der bestaetigten Kurzfassungsauslegung.

Dependencies: Vorhandener Kandidat einschliesslich des Weekly-Eval-Harness-Fixes. Keine Backend-Neuimplementierung oder Freigabe dieses Plantexts als Runtime-Auftrag vorausgesetzt. Die v6/v9-Dokumentationsabweichung bleibt sichtbar.

Expected Handoff:
- Neuer unabhaengiger QA-Bericht mit genau einem Verdict, zehn AC-Zeilen plus Storyauslegung, Commands/Exitcodes, Counts und strukturierten Findings. Bestehende QA-Berichte und Findings werden nicht umgeschrieben.
- Eigene Offlinechecks und je ein eigener Preparation-, Recipe- und Gesamt-Livelauf nach dem Weekly-Harness-Fix; keine beliebigen Wiederholungen. Alle synthetischen Kurzfassungen und Kochkern-/Widerspruchsmatrix, ohne privates Originalreplay zu behaupten.
- Importbefunde ausserhalb des Scopes getrennt vom Preparationkandidaten halten. FT-071 nur mit unabhaengig bestandener Preparation-Kernpruefung als behoben empfehlen; FT-076 und alte Import-/Daily-/Capturebefunde nicht aufgrund anderer erfolgreicher Runs schliessen.
- Menschliche Inhaltsbewertung der synthetischen Kurzfassungen im Bericht: Ist der vorhandene Kochablauf ohne erfundene Handlungen nachvollziehbar? Der Ofen-Output bleibt bis zur dokumentierten Pruefung HUMAN/MANUAL REVIEW; nicht durchgefuehrte Bewertung ist MANUAL/UNVERIFIED, kein PASS.
- Die v6/v9-Dokumentationsabweichung sowie die Grenzen des Eval-Harness-Fixes explizit ausweisen. Keine allgemeine stochastische Garantie aus einem Lauf behaupten.
- Status-/Findingregister bleibt beim Orchestrator. Bei FAIL oder PASS WITH ISSUES erfolgt kein Deploy; notwendige, scope-begrenzte Korrekturen sind vorab genehmigt und laufen ueber den Orchestrator-Korrekturlauf ohne erneute Approval-Abfrage, gefolgt von erneuter QA. UNVERIFIED bedeutet kein Deploy und Handoff/Stop bis zur Verifikation. Nur ein abschliessender QA-PASS mit allen Pflichtgates darf zum Alpha-Deploy geroutet werden.

## 10. Testablauf und Ausfuehrungsreihenfolge

1. Diese Planrevision gleicht den dokumentierten Auftrag an den vorhandenen Kandidaten ab. Sie ist kein Code- oder Produktauftrag; keine Runtime-Datei, kein bestehender QA-Bericht und kein Register wird in diesem Schritt geaendert.
2. Q-19 wiederholt die erforderlichen Offline-Gates nach dem Weekly-Harness-Fix, einschliesslich `npx vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts src/test-utils/weeklyInsightEvalSemantics.test.ts` aus `backend`. Danach `npm run test --workspace=backend`, `npm run typecheck --workspace=backend` und `npm run build:verify --workspace=backend`.
3. Nach den Offline-Gates fuehrt QA je einmal das einzelne Preparation-Livegate, das Recipe-Livegate und das gesamte `npm run test:eval --workspace=backend` aus. Fokusfilter muessen am vorhandenen Runner verifiziert werden; Counts muessen alle beabsichtigten Tests enthalten. All-skipped, fehlende Credentials, Exit 2 oder abgebrochene Laeufe sind UNVERIFIED. Kein Retry-until-green; ein Live-Failure wird nicht durch einen spaeteren Lauf ueberschrieben.
4. Der v9-Gesamtlauf mit 41/42 bleibt die Vor-Fix-Baseline. Er belegt nicht den Zustand nach dem case-insensitiven Evidence-Fix. Recipe-/Preparation-Ergebnisse, Weekly-Diagnostic, Inhaltsreview des Ofen-Fixtures und Gesamtgate werden getrennt berichtet.
5. Q-19 liefert genau ein unabhaengiges Verdict. Deploy-Gate ist nur dann PASS, wenn Q-19 abschliessend `PASS` meldet und die obligatorischen Offline-Gates aus Schritt 2 sowie die je einmal ausgefuehrten Preparation-, Recipe- und Gesamt-Live-Gates aus Schritt 3/AC-9 nach den bestehenden QA-Kriterien bestanden sind. Erforderliche Korrekturen muessen durch erneute QA verifiziert werden; fuer QA `FAIL` oder `PASS WITH ISSUES` erfolgt kein Deploy, sondern bei notwendigen scope-begrenzten Korrekturen der vorab genehmigte Orchestrator-Korrekturlauf. Bei `UNVERIFIED` wird bis zur Verifikation gestoppt. Sobald das vollstaendige Deploy-Gate mit QA-PASS erfuellt ist, routet der Orchestrator ohne erneute Approval-Abfrage direkt den operativen Auftrag `Deploy to Alpha` an FitTrack Infrastructure & Release. Der Deploy-Subagent prueft Azure-Authentifizierung (`az account show`), fuehrt den Clean Build (`npm run build:verify`), Staging-Synchronisierung samt Artefaktverifikation, Remote Publish (`func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript`) und den vorgeschriebenen Post-Deploy-Health-Check aus. Es wird kein Expo Preview Build erstellt.

## 11. Risiken und Abnahmegrenzen

- Kleinerer Auftrag verbessert Fokus und Outputbudget, beweist aber nicht automatisch den Erhalt aller wichtigen Kochhandlungen. Livekernpruefung und nachvollziehbare Inhaltsbewertung sind zwingend.
- Komponentenbezogene Gruppierung erlaubt ueberlappende Quellenintervalle. Reihenfolge der ersten Referenzen plus Quelltreue begrenzt strukturelle Freiheit, garantiert aber keine kausale Kochreihenfolge. Fixture-Rubriken pruefen den jeweiligen Ablauf; keine Behauptung universeller Sicherheit.
- Das Char-Limit ist kein Pixelmass. Keine Template-Anpassung zur Rettung einer schlechten Ausgabe; Produktionsfonts, realerUmbruch und Overflownegative bleiben die Renderautoritaet.
- Bestehende Vollrezept-Roundtriptests fuerPreparation werden durch Tests des unveraenderten gespeicherten Rezepts und des kleinen Requests/Outputs ersetzt. Import-Source-Vollstaendigkeit und Inhaltsregressionen bleiben erhalten.
- Gesamt-Evals koennen ausserhalb dieses Scopes scheitern. Das ist weder eine automatische Erweiterung des Auftrags noch ein Grund fuer ein falsches GesamtPASS.
- Die private urspruengliche422-Rezeptrevision ist weiterhin nicht verfuegbar. SynthetischeGruenlaeufe sind kein historischer Replaybeweis.

Dieser revidierte Plan beschreibt den vorhandenen Kandidaten und seine noch offenen Abnahmegates. Er ist kein neuer Implementierungsauftrag und autorisiert keine v18-Wiederholung oder pauschalen Rollbacks. Der Nutzer hat Plan-/Korrekturfreigabe und den bedingten Alpha-Deploy bereits erteilt: Erst nach abschliessendem unabhaengigem QA-PASS und bestandenen Pflichtgates routet der Orchestrator ohne erneute Approval-Abfrage direkt an FitTrack Infrastructure & Release. Bei QA FAIL oder UNVERIFIED erfolgt kein Deploy; erforderliche Korrekturen muessen erneut durch QA bestehen.
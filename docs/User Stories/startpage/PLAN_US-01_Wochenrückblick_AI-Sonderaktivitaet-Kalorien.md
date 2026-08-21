# Revidierter Diagnose-Eval- und Korrekturplan: US-01 Wochenrückblick – AI und Sonderaktivität

**Bezug:** [US-01_Wochenrückblick.md](US-01_Wochenrückblick.md)  
**Revision:** verbindliche Red-Gate- und Direktkorrekturregel ergänzt  
**Status:** Ready for one-time approval; conditional correction is authorized only after a qualifying Red Gate  
**Root-Cause-Status:** UNVERIFIED — der aktuelle Repository-Stand enthält noch keinen reproduzierbaren roten Befund für die Datenpfad- oder AI-Theorie.

Infrastructure Impact: Dev  
Mobile Build Impact: None  
Persistence Impact: None — no document field, container, partition key, or migration is planned.

**Verbindliche Workflow-Genehmigung:** Ein einmaliges `APPROVE` gilt für den gesamten Plan einschließlich der hier beschriebenen bedingten Korrekturpfade. Der Backend-Agent schreibt als allerersten Implementierungsschritt den fokussierten Diagnose-/Reproduktionstest und führt ihn gegen den unveränderten Produktionsstand aus. Erst ein qualifizierendes Red Gate aus diesem Lauf darf eine Korrektur auslösen. Nach `RED_CONFIRMED_A` oder `RED_CONFIRMED_B` wird der passende Backend-Korrekturpfad ohne weiteres Nutzer-Approval veranlasst; ein zweites `APPROVE` darf nicht verlangt werden.

**Red-Gate-Definition:** Als Red Gate zählt ausschließlich ein reproduzierbarer, erwarteter Assertion-Fehler mit `gate: RED_CONFIRMED_A` (konkrete Abweichung im Berechnungs-/Provider-Payload) oder `gate: RED_CONFIRMED_B` (korrekter Payload plus echter, strukturierter und belegter semantisch falscher Azure-Output). Ein grüner Test, fehlende Credentials, Provider-/Judge-Fehler, Ambiguität, fehlende Evidenz oder ein nicht aussagekräftiger Runnerfehler autorisieren keine Korrektur.

Dieser Plan ändert in dieser Planner-Runde ausschließlich dieses Planartefakt. Der erste Implementierungsschritt ist das Schreiben eines fokussierten, ausführbaren Diagnose-/Reproduktionstests; der erste Ausführungsschritt ist dessen Lauf gegen den unveränderten Produktionsstand. Der Ablauf prüft zuerst deterministisch den Handler-/Provider-Payload und danach bei korrektem Payload den credentialed Azure-OpenAI-Prompt-Eval. Eine Produktionskorrektur wird nur aus dem strukturierten Befund `RED_CONFIRMED_A` oder `RED_CONFIRMED_B` abgeleitet.

**Konkrete Antwort auf die Nutzerkritik:** Der bisherige Plan war beim Diagnoseablauf nicht verbindlich genug. Die Payload-Prüfung als kausaler Vorrang bleibt richtig, wird aber jetzt als zuerst zu schreibender und gegen den aktuellen Stand auszuführender Test festgelegt. Danach ist bei korrektem Payload ein eigenständiger Prompt-Eval mit genau den beiden kritischen Fällen und einer maschinenprüfbaren Semantikassertion verpflichtend, sofern Credentials verfügbar sind. Eine bestätigte AI-These liegt nur bei echtem Azure-Output mit verifiziertem semantischem Fehlurteil vor.

**Produktionscode in dieser Planner-Runde:** keiner. Die verpflichtende Diagnose erweitert nur Test-/Eval-Artefakte. Produktionscode ist ausschließlich in den nachgelagerten, bedingten Korrekturzweigen betroffen.

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications.

Die Nutzeranforderung ist fachlich berechtigt: Eine Sonderaktivität erhöht das gültige Tagesziel; der AI-Text darf daraus keine Überschreitung ableiten, wenn der Verbrauch innerhalb des erhöhten Ziels liegt. Die technische Umsetzung muss jedoch mit einem reproduzierbaren Befund beginnen. Der aktuelle Repository-Stand belegt weder einen Verlust der Aktivitätswerte im Provider-Payload noch einen tatsächlich gespeicherten fehlerhaften Azure-Output.

**Verbindliche Workflow- und Akzeptanzvorgabe:** Der Backend-Agent muss zuerst einen fokussierten, ausführbaren Reproduktionstest schreiben. Dieser Test prüft nicht nur, ob ein erwartetes Objekt gleich serialisiert wird, sondern die konkrete Sonderaktivitätsrelation mit `3000 > 2300`, `3000 < 3600`, `3600 = 3600`, den daraus berechneten Prozentwerten und dem tatsächlich an den Weekly-Insight-Aufruf übergebenen Kontext. Wenn der deterministische Payload-Test grün ist, muss bei vorhandenen Credentials zusätzlich der echte Azure-Output semantisch geprüft werden. Eine Korrektur darf nur nach dem oben definierten Red Gate erfolgen; nach einem solchen Red Gate ist kein weiteres Approval zulässig.

**AI-Notwendigkeit:** Die Kalorien- und Zielberechnung ist deterministisch und bleibt serverseitig autoritativ. AI wird nur für die kurze sprachliche Interpretation des Wochenverlaufs verwendet. Deshalb sind beide Nachweise erforderlich: der Mock-Test für die Datenaufbereitung und der Live-Eval für die tatsächlich generierte Interpretation. Keiner der beiden Nachweise ersetzt den anderen.

**Gesundheits- und Vertrauensrisiko:** Eine als übermäßig bezeichnete Aufnahme an einem Tag mit erhöhtem Ziel kann zu einer falschen Bewertung des persönlichen Plans führen. Fehlende Zielwerte dürfen nicht durch AI-Schätzungen ersetzt werden.

**Open Product Owner Decisions:** None. Die fachliche Semantik ist in der User Story und der Knowledge Base festgelegt. Offen ist ausschließlich der technische Befund, der durch die Diagnosepakete erhoben wird.

## 2. Root-Cause-Status aus dem aktuellen Repository

### 2.1 Nachgewiesener Berechnungspfad

Der aktuelle Code enthält folgende konkrete Kette:

1. [`backend/src/functions/specialActivity.ts`](../../../backend/src/functions/specialActivity.ts), `setSpecialActivityHandler()`, liest das Tagesziel aus dem Profil und persistiert zusammen mit der Aktivität `dailyCalorieTarget` und das Ergebnis `activityBonus`.
2. [`backend/src/functions/diary.ts`](../../../backend/src/functions/diary.ts), `setDayTypeHandler()`, speichert bei einem expliziten Tageskontext ein historisches Basisziel über `resolveCalorieTargetSnapshot()` aus [`backend/src/lib/weeklyTargetSnapshot.ts`](../../../backend/src/lib/weeklyTargetSnapshot.ts).
3. [`backend/src/functions/weeklyInsight.ts`](../../../backend/src/functions/weeklyInsight.ts), `weeklyInsightHandler()`, lädt für jeden der sieben abgeschlossenen lokalen Kalendertage die Meals und das `DayMeta` und übergibt beides an `calculateWeeklyNutritionReview()`.
4. [`shared/lib/weeklyReviewCalculator.ts`](../../../shared/lib/weeklyReviewCalculator.ts), `resolveWeeklyTarget()`, verwendet zuerst den gültigen `calorieTargetSnapshot`, danach `specialActivity.dailyCalorieTarget`. Bei einer Aktivität setzt es `activityBonusCalories` auf den gespeicherten Bonus und berechnet `effectiveTargetCalories = baseTargetCalories + activityBonusCalories`.
5. `calculateWeeklyNutritionReview()` summiert die gespeicherten `MealItem.macros.calories` zu `consumedCalories` und berechnet `targetPercent = consumedCalories / effectiveTargetCalories * 100`.
6. [`backend/src/lib/weeklyInsight.ts`](../../../backend/src/lib/weeklyInsight.ts), `toPromptDay()` und `buildWeeklyInsightPromptContext()`, übernehmen `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories` und `targetPercent` in den Prompt-Kontext.
7. [`backend/src/lib/openai.ts`](../../../backend/src/lib/openai.ts), `generateWeeklyInsight()`, sendet den Kontext unverändert als `JSON.stringify(context)` in der User-Nachricht an Azure OpenAI. Die Provider-Anfrage enthält keine weitere Kalorientransformation.

### 2.2 Bestehende Testevidenz und Lücke

- [`shared/lib/weeklyReviewCalculator.test.ts`](../../../shared/lib/weeklyReviewCalculator.test.ts) prüft bereits einen Sonderaktivitätstag mit `2300` Basisziel, `1300` Bonus, `3600` effektivem Ziel und `3600` Verbrauch. Der erwartete Zielprozentsatz ist `100`.
- [`backend/src/lib/openai.weekly.test.ts`](../../../backend/src/lib/openai.weekly.test.ts) prüft, dass der serialisierte User-Content dem übergebenen Prompt-Kontext entspricht und enthält einen Bonusfall. Es ist jedoch kein End-to-End-Fall mit einem gespeicherten Sonderaktivitätstag und es gibt keine fachliche Aussageprüfung des freien Texts.
- [`backend/src/functions/weeklyInsight.test.ts`](../../../backend/src/functions/weeklyInsight.test.ts) prüft eine gespeicherte Sonderaktivität im HTTP-Response. Der tatsächlich an den gemockten Provider gesendete User-Content wird in diesem Sonderaktivitätstest nicht gegen alle geforderten Werte geprüft.
- [`backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`](../../../backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts) enthält keinen Diagnosefall mit `2300 / 1300 / 3600` und den beiden Verbräuchen `3000` und `3600`. Der vorhandene Aktivitätsfall `3150 / 3000 = 105 %` beweist die kritische Negativgrenze nicht.
- [`backend/src/lib/prompts/weeklyInsightV2.ts`](../../../backend/src/lib/prompts/weeklyInsightV2.ts) enthält bereits die Regel, die Kalorien relativ zum jeweiligen effektiven Tagesziel zu bewerten. Es fehlt aber ein Feldvertrag, der `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories` und `targetPercent` einzeln definiert und die Nicht-Doppelzählung des Bonus ausdrücklich beschreibt. Das ist eine überprüfbare Vertragslücke, aber noch kein Nachweis, dass sie den gemeldeten Azure-Output verursacht hat.
- [`backend/src/lib/openai.ts`](../../../backend/src/lib/openai.ts), `WEEKLY_INSIGHT_SCHEMA`, validiert derzeit nur JSON-Struktur, Nicht-Leerheit und Textlänge. Es gibt keine semantische serverseitige Prüfung, die einen widersprüchlichen freien Text zurückweist.
- [`backend/src/lib/prompts/weeklyInsight.eval.test.ts`](../../../backend/src/lib/prompts/weeklyInsight.eval.test.ts) führt bei vorhandenen Credentials echte Aufrufe über `generateWeeklyInsight()` aus und prüft derzeit nur Textlänge und `forbiddenPhrases`. Die Infrastruktur erkennt fehlende Credentials über [`backend/scripts/run-eval.mjs`](../../../backend/scripts/run-eval.mjs) und Exitcode `2` als `UNVERIFIED`, bietet aber noch keine strukturierte A/B/C-Diagnose oder konservative Semantikprüfung.

### 2.3 Schlussfolgerung

**Der gemeldete Root Cause ist mit dem aktuellen Repository nicht bewiesen.** Der Quellcode weist auf einen aktuell plausiblen Datenpfad hin, aber der konkrete Provider-Payload für die beiden geforderten Fälle und ein semantisch geprüfter fehlerhafter Provider-Output sind noch nicht als reproduzierbare Befunde vorhanden. Deshalb bleibt der Root-Cause-Status `UNVERIFIED`; ein Produktionsfix darf nicht aus der bloßen Existenz einer passenden Promptregel oder aus einem grünen Payload-Test abgeleitet werden.

Der Diagnoseablauf ist strikt sequenziell und beginnt mit dem Schreiben des fokussierten Tests. Danach wird der Test gegen den unveränderten Produktionsstand ausgeführt. Eine Payload-Abweichung ist ein direktes `RED_CONFIRMED_A`; bei korrektem Payload wird der echte Azure-Generator mit denselben beiden Fällen ausgeführt. Nur ein durch strukturierte Semantikbewertung belegter falscher Modelloutput ist `RED_CONFIRMED_B`. Ein Payload-PASS allein bestätigt die AI-These nicht.

**Red-Gate-Artefakt:** Das maßgebliche Artefakt ist das Handoff von `WP-B-DIAG-RUN` mit dem unveränderten Teststand, dem exakten Testkommando, Exitcode, tatsächlichen fehlgeschlagenen Assertion-Text beziehungsweise der begrenzten Text-Evidenz, dem ersten divergierenden Feld und der Root-Cause-Klassifikation. Das Handoff muss zusätzlich das maschinenlesbare Diagnose-Manifest mit `gate: RED_CONFIRMED_A | RED_CONFIRMED_B | NO_RED | UNVERIFIED` enthalten. Nur die beiden `RED_CONFIRMED_*`-Werte öffnen einen Korrekturpfad.

Die Diagnose unterscheidet die drei geforderten Fälle und liefert sie als strukturiertes Ergebnis, nicht als freie Interpretation im Handoff:

| Ergebnis des Diagnose-Evals | Einstufung | Mindeststatus | Konsequenz |
|---|---|---|---|
| Einer der beiden Payload-Fälle weicht bei den Sollwerten ab | **A — Datenaufbereitungsfehler** | `VERIFIED` durch deterministischen Mock-Test | Erste abweichende Stelle im Calculator-, Mapping- oder Sendepfad korrigieren; kein Promptfix als Ersatz. |
| Beide Payloads sind korrekt und der echte Azure-Output wird in mindestens einem Fall fachlich falsch eingeordnet | **B — Prompt-/AI-Vertragsfehler** | `VERIFIED` nur mit gültiger strukturierter Semantikbewertung und echtem Modelloutput | Bestehenden Feldvertrags-Gap beheben, Promptversion erhöhen und die semantische Regression absichern. |
| Beide Payloads sind korrekt und der AI-Text ist korrekt, nicht ausführbar oder semantisch nicht eindeutig prüfbar | **C — These nicht bestätigt** | `VERIFIED` bei korrekt bewerteten Texten, sonst `UNVERIFIED` | Keine spekulative Produktionsänderung. Fehlende Credentials, Providerfehler, ungültige Judge-Antworten und Ambiguität bleiben `UNVERIFIED`; insbesondere ist das kein PASS. |

Das Diagnoseergebnis muss mindestens diese maschinenlesbare Form haben (konkrete Werte und Evidenz werden je Fall ausgefüllt):

```json
{
	"diagnosis": "A | B | C",
	"status": "VERIFIED | UNVERIFIED",
	"payload": {
		"underEffectiveTarget": "PASS | FAIL",
		"atEffectiveTarget": "PASS | FAIL"
	},
	"ai": {
		"underEffectiveTarget": "CORRECT | INCORRECT | NOT_RUN | UNVERIFIED",
		"atEffectiveTarget": "CORRECT | INCORRECT | NOT_RUN | UNVERIFIED"
	},
	"evidence": {
		"promptVersion": "v2",
		"model": "<deployment-name-or-redacted>"
	}
}
```

`A` wird nur durch einen echten Soll-/Ist-Vergleich der Testdaten ausgelöst. `B` wird nur ausgelöst, wenn der Payload beider Fälle korrekt ist, der echte Generator ausgeführt wurde und die strukturierte Semantikbewertung einen widersprüchlichen Output mit belegter Textstelle meldet. `C` ist der verbleibende Befund; bei fehlenden Credentials oder ambiger Semantik lautet der Status ausdrücklich `UNVERIFIED`.

## 3. Current Behaviour

- `GET /api/ai/weekly-insight?date=YYYY-MM-DD` lädt die sieben abgeschlossenen lokalen Kalendertage.
- Historische Ziele werden snapshot-first aufgelöst. Eine gültige `calorieTargetSnapshot` hat Vorrang vor `specialActivity.dailyCalorieTarget`; für eine Aktivität ohne belastbares gespeichertes Ziel wird kein Profilziel erfunden.
- Der Shared-Calculator verwendet den Aktivitätsbonus für das effektive Tagesziel und nicht als konsumierte Kalorien.
- Der Weekly-Provider erhält nur aggregierte, sanitizierte Tageswerte und Totals. Rohdaten wie Meal-Namen, Produkttexte, User-ID und Cache-Daten werden nicht an Azure gesendet.
- Der aktive Prompt ist `WEEKLY_INSIGHT_PROMPT_VERSION = 'v2'` in `weeklyInsightV2.ts`. Seine bestehende Vergleichsregel nennt das effektive Ziel, definiert aber die JSON-Felder und die Nicht-Doppelzählung des Bonus nicht einzeln.
- Ein formal gültiger, aber fachlich widersprüchlicher freier AI-Text würde aktuell durch das Structured-Output-Schema akzeptiert und gecacht werden. Ob genau das passiert, ist im Repository nicht aufgezeichnet.

## 4. Desired Behaviour

Für einen Tag mit `baseTargetCalories: 2300`, `activityBonusCalories: 1300` und `effectiveTargetCalories: 3600` gilt:

- `consumedCalories` kommt ausschließlich aus den gespeicherten MealItem-Kalorien.
- `effectiveTargetCalories` ist der alleinige Nenner für die Einordnung.
- `targetPercent` ist der serverseitig berechnete Vergleichswert.
- `activityBonusCalories` ist eine zusätzliche Ziel-/Budgetkomponente, kein zusätzlicher Verbrauch und nicht nochmals zum effektiven Ziel zu addieren.
- Ein Verbrauch von `3000` ist `83.33333333333333 %` des effektiven Ziels und darf nicht als Überschreitung bewertet werden, nur weil `3000 > 2300` gilt.
- Ein Verbrauch von `3600` ist `100 %` des effektiven Ziels und darf nicht als Überschreitung bewertet werden.
- Ein fehlendes effektives Ziel oder ein fehlender Zielprozentsatz erlaubt keine erfundene Kalorienbewertung.

Die Diagnose muss diese Sollwerte zuerst im HTTP-Response und anschließend im tatsächlich gemockten Provider-Payload nachweisen. Erst danach darf der AI-Text bewertet werden.

Für den Live-Text gelten dieselben beiden Fälle als getrennte semantische Prüfungen:

- `3000 / 3600`: Der Text darf keine Überschreitung des effektiven Ziels behaupten. Eine Einordnung als über dem Basisziel, aber innerhalb des effektiven Aktivitätsziels, ist korrekt.
- `3600 / 3600`: Der Text darf keine Überschreitung oder „zu viele Kalorien“-Einordnung behaupten; `100 %` beziehungsweise genau am effektiven Ziel ist korrekt.

Die Prüfung darf weder eine bestimmte deutsche Formulierung noch die Erwähnung jedes Zahlenwerts verlangen. Sie muss aber die Relation zur `effectiveTargetCalories`-Komponente erfassen und eine Aussage, die allein `baseTargetCalories` als Tagesziel verwendet, als falsch oder ambig einstufen. Bei nicht eindeutigem Text gilt `UNVERIFIED`, nicht `CORRECT`.

## 5. Scope

### In Scope

- Repository-basierte Dokumentation des vollständigen Berechnungs-, Mapping- und Provider-Sendepfads.
- Fokussierter Handler-Test mit einem gespeicherten Sonderaktivitätstag und Provider-Mock.
- Zwei reproduzierbare Grenzfälle: `3000 / 3600 = 83.33333333333333 %` und `3600 / 3600 = 100 %`.
- Prüfung des JSON-User-Contents inklusive Feldnamen, Zahlenwerten und Sanitization.
- Verbindlicher Versuch eines credentialed Weekly-Prompt-Evals mit denselben beiden Zahlenfällen; fehlende Azure-Credentials werden ausgeführt und als `UNVERIFIED` beendet, nicht übersprungen.
- Kleine eval-only Semantikprüfung mit strukturiertem Urteil, geerdeten Evidenzstellen und konservativem `UNVERIFIED` bei Ambiguität.
- Strukturierter A/B/C-Diagnosebefund im Backend-Handoff und im QA-Nachweis.
- Bedingte Korrektur des zuerst abweichenden Datenpfads oder, bei korrekt befülltem Payload und reproduziertem AI-Fehler, des Prompt-/AI-Vertrags.
- QA-Nachweis des gewählten Diagnosezweigs und der nicht ausgeführten Zweige.

### Out of Scope

- Mobile-Code, UI-Texte, ViewModels, Navigation oder EAS-Builds.
- Änderung des öffentlichen Weekly-API-Vertrags, der Zielbandgrenzen, des Zeitraums, der Missing-Data-Semantik oder der `0 kcal`-Semantik.
- Änderung der historischen Snapshot-Priorität oder Einführung eines Profil-Fallbacks für eine Aktivität ohne gespeichertes Ziel.
- Änderung des Aktivitätsbonusmodells, der MET-Berechnung oder der gespeicherten `SpecialActivity`, sofern der Diagnose-Gate keinen Fehler dort nachweist.
- Neue Cosmos-Container, Dokumentfelder, Partition Keys oder Migrationen.
- Freies Text-Filtering anhand deutscher Wörter als primäre Korrektur.
- Promptversionserhöhung ohne reproduzierten provider-sichtbaren Vertragsfehler.
- Alpha-Deployment. Ein Development-Deploy ist nur für einen bestätigten Backend-Codefix vorgesehen.
- Eine Änderung des produktiven Weekly-Response-Schemas nur für den Diagnose-Eval. Der bestehende Generator bleibt im Diagnosezweig bei `{ text }`.

## 6. Confirmed Facts

- Die fachliche Zielsemantik steht in [`docs/kb/domain/02-diary.md`](../../../docs/kb/domain/02-diary.md), [`docs/kb/domain/01-nutrition-model.md`](../../../docs/kb/domain/01-nutrition-model.md) und [`docs/kb/tech/04-shared-library.md`](../../../docs/kb/tech/04-shared-library.md).
- Weekly Insight ist ein Backend-only-AI-Workflow mit `daily-insight`-Quota, Strict Structured Outputs und neutralem Fehlervertrag; maßgeblich sind [`docs/kb/domain/07-ai-features.md`](../../../docs/kb/domain/07-ai-features.md), [`docs/kb/tech/06-ai-integrations.md`](../../../docs/kb/tech/06-ai-integrations.md) und [`docs/kb/tech/09-api-reference.md`](../../../docs/kb/tech/09-api-reference.md).
- `calculateWeeklyNutritionReview()` berechnet `effectiveTargetCalories` und `targetPercent` deterministisch.
- `buildWeeklyInsightPromptContext()` gibt die relevanten Kalorienfelder an den Generator weiter.
- `generateWeeklyInsight()` sendet den Kontext als JSON-User-Nachricht und validiert derzeit nur die formale Textantwort.
- Die User Story verlangt ausdrücklich die Bewertung gegen das angepasste Tagesziel und verbietet, fehlende Daten als Unterversorgung zu interpretieren.
- Es gibt im Repository keinen gespeicherten Azure-Request oder fehlerhaften Wochenbewertungstext, der den gemeldeten Vorfall belegt.

## 7. Unbelegte Behauptungen und Diagnosevoraussetzungen

- Nicht belegt ist, dass `activityBonusCalories` im produktiven Provider-Payload fehlt oder falsch ist.
- Nicht belegt ist, dass Azure OpenAI bei den genannten Fällen tatsächlich eine Überschreitung wegen des Basisziels formuliert.
- Die bestehende v2-Regel ist eine fachliche Vorgabe zugunsten des effektiven Ziels. Sie darf nicht als bereits nachgewiesene Ursache interpretiert werden.
- Ein fehlendes `AZURE_OPENAI_ENDPOINT` oder `AZURE_OPENAI_API_KEY` macht den Live-Eval zu `UNVERIFIED`. Das ist ein fehlender Nachweis, kein Beleg für einen Promptfehler.
- Die Diagnose nutzt keine geheimen Werte in Tests, Logs oder Planartefakten. Credentials werden ausschließlich über die bestehende lokale beziehungsweise Azure-Konfiguration bezogen.

## 8. Existing Components to Reuse

- [`shared/lib/weeklyReviewCalculator.ts`](../../../shared/lib/weeklyReviewCalculator.ts): `resolveWeeklyTarget()` und `calculateWeeklyNutritionReview()`.
- [`backend/src/lib/weeklyInsight.ts`](../../../backend/src/lib/weeklyInsight.ts): `toPromptDay()` und `buildWeeklyInsightPromptContext()`.
- [`backend/src/functions/weeklyInsight.ts`](../../../backend/src/functions/weeklyInsight.ts): authentifizierter Wochenhandler, Cache, Quota und Provider-Orchestrierung.
- [`backend/src/lib/openai.ts`](../../../backend/src/lib/openai.ts): `generateWeeklyInsight()` und `__setOpenAiClientForTests()`.
- [`backend/src/lib/prompts/weeklyInsightV2.ts`](../../../backend/src/lib/prompts/weeklyInsightV2.ts): bestehender versionierter Prompt und Prompt-Kontexttyp.
- Bestehende In-Memory-Repositories und Test-Auth aus [`backend/src/functions/weeklyInsight.test.ts`](../../../backend/src/functions/weeklyInsight.test.ts).
- Bestehender Eval-Mechanismus in [`backend/src/lib/prompts/weeklyInsight.eval.test.ts`](../../../backend/src/lib/prompts/weeklyInsight.eval.test.ts) und [`backend/scripts/run-eval.mjs`](../../../backend/scripts/run-eval.mjs).
- Geplanter eval-only Semantikbaustein in `backend/src/test-utils/weeklyInsightEvalSemantics.ts` mit Unit-Test in `backend/src/test-utils/weeklyInsightEvalSemantics.test.ts`; dieser wird nicht von `weeklyInsightHandler()` oder `generateWeeklyInsight()` im Produktionspfad importiert.

## 9. Proposed Technical Solution

### 9.1 Deterministischer Payload-Gate

Der fokussierte Test wird als benannter, parameterisierter Handler-Test in `backend/src/functions/weeklyInsight.test.ts` ergänzt und ist der allererste Implementierungsschritt. Er richtet für jeden Fall ausschließlich den Tag `2026-08-13` mit einem gespeicherten `specialActivity`-Snapshot ein, verwendet ein MealItem mit dem jeweiligen Verbrauch und injiziert einen OpenAI-Mock. Es wird kein `calorieTargetSnapshot` gesetzt, damit die bestehende Snapshot-first-Regel und die kompatible Aktivitätsquelle sichtbar geprüft werden. Bis dieser Test geschrieben und einmal gegen den unveränderten Produktionsstand ausgeführt wurde, darf kein Produktionsfile geändert werden.

Der Test führt genau diese beiden Fälle aus und vergleicht sowohl den HTTP-Response als auch den geparsten `messages[1].content` des gemockten Provider-Requests:

| Fall | `consumedCalories` | `baseTargetCalories` | `activityBonusCalories` | `effectiveTargetCalories` | `targetPercent` | Totals `consumed/target/percent` |
|---|---:|---:|---:|---:|---:|---|
| `under-effective-target` | `3000` | `2300` | `1300` | `3600` | `83.33333333333333` | `3000 / 3600 / 83.33333333333333` |
| `at-effective-target` | `3600` | `2300` | `1300` | `3600` | `100` | `3600 / 3600 / 100` |

Die fünf Tagesfelder und drei Totals-Felder sind numerisch zu prüfen; für die periodische Fließkommadarstellung wird derselbe mathematische Wert beziehungsweise eine dokumentierte enge Toleranz verwendet, nicht eine grobe Rundung. Der Test muss zusätzlich die konkrete Theorie als Relation prüfen: Im ersten Fall gilt `3000 > 2300` und zugleich `3000 < 3600`, im zweiten Fall `3600 = 3600`; beide Fälle dürfen nicht als Überschreitung des effektiven Ziels klassifiziert werden. Er prüft den tatsächlich aus `messages[1].content` geparsten Provider-User-Content, nicht nur einen unabhängig erzeugten Fixture-Payload, sowie die fehlende Übermittlung von Meal-Namen, Produkttexten, User-ID, `consumedMacros` und technischen Cache-Werten.

Die erste Abweichung wird strukturiert festgehalten: Review falsch = Calculator-/Target-Aufbereitungsfehler; Review korrekt, Prompt-Kontext falsch = Mappingfehler in `toPromptDay()` oder `buildWeeklyInsightPromptContext()`; Prompt-Kontext korrekt, Request falsch = Sendepfadfehler in `generateWeeklyInsight()` oder seiner aktiven Prompt-Anbindung. Dieser Test ist deterministisch und kann unabhängig von Azure-Credentials `RED_CONFIRMED_A` bestätigen. Wenn er grün ist, beweist er ausdrücklich keine AI-/Prompt-Ursache; dann entscheidet ausschließlich der nachgelagerte credentialed Semantik-Eval über `RED_CONFIRMED_B`.

### 9.2 AI-Vertrags-Gate

Nur wenn der Payload-Gate beide Fälle bestätigt, werden genau diese beiden Fälle als eigene `WEEKLY_INSIGHT_DIAGNOSTIC_FIXTURES` in `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts` ausgeführt. Der verpflichtende Live-Eval wird über eine gezielte Datei ausgeführt:

```powershell
cd backend
npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts
```

Jede Diagnose-Fixture enthält einen vollständigen Sieben-Tage-Kontext mit sechs fehlenden Tagen und genau einem verfügbaren Aktivitätstag sowie eine maschinenlesbare Erwartung, etwa `expectedBasis: 'effective_target'` und `expectedRelation: 'within_effective_target'` beziehungsweise `'at_effective_target'`. `WEEKLY_INSIGHT_EVAL_FIXTURES` für die bestehenden allgemeinen Eval-Fälle bleibt erhalten; die beiden Diagnose-Fixtures dürfen nicht durch den bisherigen `3150 / 3000`-Fall ersetzt oder nur als verbotene Wortlisten modelliert werden.

Damit die bestehende Credential-/Exitcode-Logik auch die gezielte Vitest-Datei unterstützt, reicht `backend/scripts/run-eval.mjs` die zusätzlichen CLI-Argumente an Vitest weiter; die bestehende Prüfung bleibt unverändert: fehlende `AZURE_OPENAI_ENDPOINT` oder `AZURE_OPENAI_API_KEY` führen zu Exitcode `2` und `UNVERIFIED`, niemals zu einem bestandenen Live-Eval. `backend/scripts/run-eval.test.mjs` erhält dafür einen kleinen Argument-Weitergabe-Test, ohne Credential-Werte auszugeben.

`backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` ruft für beide Fixtures den echten `generateWeeklyInsight()`-Pfad auf. Der Generator bleibt beim produktiven Strict-Output `{ "text": string }`. Da dieser freie Text derzeit keine strukturierten Fachlabels liefert, unterstützt die vorhandene Eval-Infrastruktur die benötigte Semantikprüfung noch nicht sicher: `forbiddenPhrases` kann nur Negativwörter prüfen und ist kein Beweis für den verwendeten Nenner.

Dafür wird der kleine test-only Baustein `backend/src/test-utils/weeklyInsightEvalSemantics.ts` ergänzt. Er verwendet einen separaten, strikt strukturierten Azure-OpenAI-Eval-Judge ausschließlich für die Diagnose und validiert dessen Ergebnis anschließend deterministisch. Der Judge liefert je Fixture:

```json
{
  "basis": "effective_target | base_target_only | ambiguous",
  "relation": "within_effective_target | at_effective_target | exceeded_effective_target | ambiguous",
  "evidence": "exakter Ausschnitt aus dem erzeugten Text oder null"
}
```

Für `3000 / 3600` ist nur `basis: effective_target` plus `relation: within_effective_target` korrekt. Für `3600 / 3600` ist nur `basis: effective_target` plus `relation: at_effective_target` korrekt. Ein Hinweis, dass `3000` über `2300` liegt, ist zulässig, solange die abschließende Einordnung gegen `3600` erfolgt; `base_target_only` ist falsch. `exceeded_effective_target` ist in beiden Diagnosefällen falsch. `evidence` muss als nicht-leerer exakter Textausschnitt im erzeugten AI-Text vorkommen.

Der lokale Validator in `weeklyInsightEvalSemantics.ts` erzeugt `CORRECT` nur bei gültigem strukturiertem Judge-Output, passender Relation, `effective_target` als Bezugsbasis und belegter Evidenz. Er erzeugt `INCORRECT` nur bei einem klar widersprüchlichen, strukturierten und belegten Urteil. Ungültiges Judge-JSON, fehlende Evidenz, fehlender Generator-Output, Timeout, Providerfehler oder jede Ambiguität werden konservativ als `UNVERIFIED` klassifiziert. Ein Wörterbuch- oder `forbiddenPhrases`-Filter bleibt höchstens eine zusätzliche Warnung, niemals die alleinige Semantikprüfung.

Die Diagnose-Eval-Datei darf einen Provider-/Judge-Fehler nicht als `INCORRECT` fehlklassifizieren: `INCORRECT` ist nur ein explizit widersprüchliches, validiertes Ergebnis. Bei `CORRECT` wird der aggregierte Befund `C / VERIFIED`; bei `INCORRECT` wird `B / VERIFIED`; bei `UNVERIFIED` wird `C / UNVERIFIED`. Eine Vitest-Fehlermeldung oder ein nicht-null Exitcode allein ist daher kein Beweis für B. Der Handoff muss die strukturierte Klassifikation unabhängig vom Runner-Exitcode ausweisen. Bei fehlenden Credentials bleibt die bestehende Wrapper-Konvention maßgeblich: Exitcode `2`, `UNVERIFIED`, kein PASS.

Der Judge ist selbst modell- und deploymentabhängig. Deshalb bedeutet `B` eine reproduzierte falsche Einordnung unter dem konkret protokollierten Azure-Deployment, keine mathematische Garantie über alle Modelle. Der Eval erzwingt keine exakte deutsche Formulierung und verlangt nicht, dass der Generator bestimmte Wörter verwendet.

Die Live-Eval-Ausgabe wird je Fall und zusammengefasst als strukturierter Diagnosebefund mit Fixture-ID, Promptversion, Deploymentname ohne Secret, Generatorstatus, Judge-/Semantikstatus und begrenzter Evidenz dokumentiert. Bei fehlenden Credentials wird kein AI-Text erfunden und kein `PASS` gemeldet.

### 9.3 Red-Gate-Entscheidung vor jeder Korrektur

`WP-B-DIAG-RUN` muss den Baseline-Lauf in genau dieser Reihenfolge abschließen:

1. Der fokussierte Handler-/Provider-Payload-Test läuft gegen den aktuellen Produktionsstand. Ein erwarteter Assertion-Fehler mit konkreter Abweichung bei Berechnung, Mapping oder Provider-User-Content ist `RED_CONFIRMED_A`; der erste divergierende Pfad wird als Root Cause benannt.
2. Wenn beide Payload-Fälle PASS sind, läuft der credentialed Eval mit dem echten Weekly-Insight-Generator für `3000 / 3600` und `3600 / 3600`. Ein echter Modelloutput, den der strukturierte Judge als klare falsche Relation mit belegtem Textausschnitt klassifiziert, ist `RED_CONFIRMED_B`.
3. Ein grüner Payload-Test, ein korrekter AI-Text, fehlende Credentials, ein nicht ausgeführter Modellaufruf, Provider-/Judge-Ausfall, ungültiges Judge-JSON, fehlende Evidenz, Ambiguität oder ein nicht aussagekräftiger Test-/Runnerfehler ist kein Red Gate. Der Befund lautet `NO_RED` beziehungsweise `UNVERIFIED`; es wird kein Produktionsfix veranlasst.

Nur `RED_CONFIRMED_A` oder `RED_CONFIRMED_B` aus dem Handoff-Manifest autorisiert die passende Korrektur. Diese Autorisierung ist durch das einmalige Plan-Approval bereits erteilt; der Orchestrator routet danach direkt weiter und fordert kein zweites `APPROVE` an. Ein Planinvaliditäts- oder echter Prozessfehler wird nach den allgemeinen Orchestrator-Regeln gestoppt und ist nicht als Red Gate zu behandeln.

### 9.4 Bedingte Korrekturzweige

**Datenaufbereitungszweig:** Wenn der Payload-Gate eine Abweichung findet, wird ausschließlich die erste fehlerhafte Berechnungs- oder Transformationsstelle korrigiert. Der bestehende Snapshot-first-Vertrag bleibt erhalten. Im Zweig A gibt es keinen Promptfix und keinen Promptversionssprung; falls sich wider Erwarten ein zusätzlich erforderlicher provider-sichtbarer Vertragswechsel ergibt, ist der Zweig zu stoppen und als neue Planner-Entscheidung zu behandeln, nicht stillschweigend mit A zu vermischen.

**Prompt-/AI-Vertragszweig:** Wenn der Payload korrekt ist und der Live-Eval die falsche Einordnung reproduziert, erhält der aktive Prompt eine neue Version. Der Feldvertrag muss dann ausdrücklich festlegen:

- `consumedCalories` ist Aufnahme;
- `baseTargetCalories` ist nur die Vor-Aktivitäts-Referenz;
- `activityBonusCalories` ist zusätzliche Zielkomponente, nicht Aufnahme und bereits in `effectiveTargetCalories` enthalten;
- `effectiveTargetCalories` ist der alleinige Tagesnenner;
- `targetPercent` und die Totals sind serverseitig autoritativ;
- fehlende Werte dürfen nicht geschätzt werden.

Die aktive Promptversion muss von `v2` auf `v3` erhöht werden, damit Weekly-Caches mit der alten Interpretation nicht als aktuelle Texte gelten. Die v2-Datei bleibt als historische Version erhalten. Strict Structured Outputs, Schema, Quota-Reihenfolge, Sanitization, Cache-Hash und neutraler Fehlervertrag bleiben unverändert, sofern der Befund keine gegenteilige Ursache nachweist.

**Nicht-beweisbarer Zweig:** Wenn der Payload korrekt ist und kein fehlerhafter Azure-Output reproduziert wird, bleibt es bei einem Diagnoseartefakt. Es wird kein Prompttext, Calculator, API-Vertrag oder Cacheverhalten geändert.

Das gilt ausdrücklich auch für `C` mit korrektem AI-Text, fehlenden Credentials, Provider-/Judge-Ausfall oder ambiger Semantik. Ein korrekter Payload allein ist weder `B` noch eine Bestätigung der ursprünglichen These; ein fehlender echter Modelloutput ist ebenfalls kein Test-PASS.

## 10. Backend Work Packages

### WP-B-DIAG-WRITE: Fokussierten Red-Gate-Test schreiben

**Status:** Mandatory first implementation subtask; no conditional skip.  
**Agent:** Backend  
**Goal:** Einen fokussierten, ausführbaren Reproduktions-/Diagnosetest für die behauptete Sonderaktivitätsfehlinterpretation schreiben, bevor irgendein Produktionsfix oder Promptversionssprung möglich ist.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/vitest.eval.config.mts`
- `backend/package.json`
- `backend/scripts/run-eval.mjs`
- `backend/scripts/run-eval.test.mjs`
- `shared/lib/weeklyReviewCalculator.ts`
- `shared/lib/weeklyReviewCalculator.test.ts`

**Required Skills:** `azure-openai-feature-integration`  
**Relevant Acceptance Criteria:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-13, AC-14, AC-16, AC-17
**Dependencies:** None

**Implementation Constraints:**

- Dies ist der allererste Implementierungsschritt. Er darf ausschließlich Test-/Eval-Artefakte und die dafür notwendige Test-Runner-Argumentweitergabe ändern; keine Produktionsberechnung, keinen Handler, keinen aktiven Prompt und keine Promptversion.
- Der benannte Test `RED-GATE: special activity uses effective weekly target in provider context` in `backend/src/functions/weeklyInsight.test.ts` muss den authentifizierten Handler mit gespeichertem Sonderaktivitätstag und Provider-Mock ausführen. Er prüft die konkrete Relation `3000 > 2300`, `3000 < 3600` und `3600 = 3600`, nicht nur eine abstrakte Objektgleichheit.
- Für beide Fälle sind mindestens `baseTargetCalories: 2300`, `activityBonusCalories: 1300`, `effectiveTargetCalories: 3600`, `consumedCalories: 3000` beziehungsweise `3600`, `targetPercent: 83.33333333333333` beziehungsweise `100` sowie die Totals zu prüfen. Der Test muss den tatsächlich aus `messages[1].content` geparsten User-Kontext des Weekly-Insight-AI-Aufrufs prüfen und Sanitization bestätigen.
- Für die AI-Ebene sind dieselben beiden Fälle als eigenständige Diagnose-Fixtures und ein `weeklyInsight.special-activity.diagnostic.eval.test.ts` vorzubereiten. Die Semantikprüfung darf keinen Wörterbuch-/`forbiddenPhrases`-Filter als alleinigen Beweis verwenden; sie benötigt ein strukturiertes Urteil mit erwarteter Relation, Bezugsbasis und Text-Evidenz und klassifiziert Ambiguität konservativ als `UNVERIFIED`.
- Falls die bestehende Eval-Infrastruktur gezielte Dateiargumente nicht weiterreicht, darf `backend/scripts/run-eval.mjs` samt Test ausschließlich für diese Weitergabe angepasst werden. Der Wrapper muss fehlende Credentials weiter mit Exitcode `2` als `UNVERIFIED` ausweisen und darf keine Secrets ausgeben.

**Expected Handoff:**
- Liste der ausschließlich geänderten Test-/Eval-Dateien und Bestätigung, dass kein Produktionsfile geändert wurde.
- Exakter Name und exaktes Kommando für den deterministischen Red-Gate-Test sowie die vorbereitete Live-Eval-Datei und ihr Kommando.
- Beschreibung des erwarteten Diagnose-Manifests einschließlich `gate: RED_CONFIRMED_A | RED_CONFIRMED_B | NO_RED | UNVERIFIED`.
- Übergabe an `WP-B-DIAG-RUN`; noch keine Root-Cause-Behauptung und noch kein Korrekturvorschlag.

### WP-B-DIAG-RUN: Baseline gegen unveränderten Produktionsstand ausführen

**Status:** Mandatory immediately after WP-B-DIAG-WRITE and before every correction or release subtask.  
**Agent:** Backend  
**Goal:** Den geschriebenen Test gegen den aktuellen, unveränderten Produktionsstand ausführen, den behaupteten Fehler reproduzierbar nachweisen oder die Theorie ausdrücklich als nicht bestätigt/unverifiziert klassifizieren.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/test-utils/weeklyInsightEvalSemantics.ts`
- `backend/scripts/run-eval.mjs`
- `backend/package.json`
- `backend/vitest.eval.config.mts`
- `shared/lib/weeklyReviewCalculator.ts`

**Required Skills:** `azure-openai-feature-integration`  
**Relevant Acceptance Criteria:** AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-12, AC-13, AC-14, AC-16, AC-17
**Dependencies:** WP-B-DIAG-WRITE completed; production source is unchanged since the baseline under investigation.

**Execution and Red-Gate Constraints:**

- First run exactly `cd backend; npx vitest run src/functions/weeklyInsight.test.ts -t "RED-GATE: special activity uses effective weekly target in provider context"`.
- A failing assertion qualifies as `RED_CONFIRMED_A` only when the failure is the expected concrete mismatch in the review, the serialized Provider-User-Content, or its first mapping/send boundary. A test harness crash, missing fixture, type error, timeout, or unrelated failure is not a Red Gate.
- If both deterministic payload cases PASS, run exactly `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`. `RED_CONFIRMED_B` requires both a correct payload and a real Azure-generated text that the structured semantic judge and local validator classify as `INCORRECT` with an exact, present evidence excerpt. A free-text word match is insufficient.
- Missing credentials or unavailable provider/judge produces exitcode `2`/`UNVERIFIED` through the wrapper; valid but ambiguous or semantically non-provable output is also `UNVERIFIED`. Neither state permits a correction. A correct model output is `NO_RED`/`VERIFIED`, not `RED_CONFIRMED_B`.
- No production file, active prompt, prompt version, cache behavior, API contract, Mobile code, Cosmos model, or infrastructure file may be changed before this baseline handoff is complete.

**Expected Handoff:**
- Exact test command(s), exact exitcode(s), and the actual relevant assertion/output lines for each case; paraphrase alone is insufficient.
- Parsed actual provider context and expected values for both cases, including `2300`, `1300`, `3600`, `3000`, `3600`, `83.33333333333333`, `100` and totals.
- For live evaluation: fixture ID, prompt version, deployment name without secrets, generated-output status, structured judge result, exact bounded evidence excerpt, and per-case `CORRECT | INCORRECT | UNVERIFIED`.
- A machine-readable aggregate manifest with `diagnosis: A | B | C`, `status: VERIFIED | UNVERIFIED` and `gate: RED_CONFIRMED_A | RED_CONFIRMED_B | NO_RED | UNVERIFIED`.
- The exact first divergent path and Root Cause, or the explicit statement `Theorie mit dem aktuellen Repository nicht bestätigt` when no qualifying red result exists.
- Confirmation that no production correction has been made. Only a manifest with `RED_CONFIRMED_A` or `RED_CONFIRMED_B` may be passed to the matching correction subtask; all other results terminate correction routing.

### WP-B-DATA-CORRECTION: Erste nachgewiesene Datenabweichung beheben

**Status:** Conditional — only when WP-B-DIAG-RUN returns `gate: RED_CONFIRMED_A`.  
**Agent:** Backend

**Goal:** Die im Payload-Gate konkret lokalisierte Datenaufbereitungsabweichung beheben und mit demselben Sonderaktivitätsfall regressionssicher abdecken.

**Required Knowledge Base:** `docs/kb/domain/01-nutrition-model.md`, `docs/kb/domain/02-diary.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/04-shared-library.md`, `docs/kb/tech/08-testing.md`  
**Required Repository Context:** die von WP-B-DIAG-RUN benannte erste Abweichungsstelle sowie `shared/lib/weeklyReviewCalculator.ts`, `backend/src/lib/weeklyInsight.ts`, `backend/src/functions/weeklyInsight.ts`, `backend/src/functions/weeklyInsight.test.ts` und `shared/lib/weeklyReviewCalculator.test.ts`  
**Required Skills:** None  
**Relevant Acceptance Criteria:** AC-2, AC-4, AC-5, AC-8, AC-13  
**Dependencies:** WP-B-DIAG-RUN with `gate: RED_CONFIRMED_A`, exact failing assertion, and first divergent calculation/mapping/send boundary

**Approval Rule:** The single approval of this plan already authorizes this conditional correction. After the qualifying Red Gate, route directly here without requesting another `APPROVE`. If WP-B-DIAG-RUN returns any other gate, this package is skipped.

**Expected Handoff:** Korrigierte Produktionsstelle, fokussierter Regressionstest, Nachweis der Werte `2300`, `1300`, `3600`, `83.33333333333333` und `100`, sowie Bestätigung, dass Snapshot-Priorität, API-Form, Cache-/Quota-Vertrag und Prompttext unverändert geblieben sind, sofern nicht durch den Fehler erzwungen. Das Handoff muss bestätigen, dass die Korrektur aufgrund von `RED_CONFIRMED_A` ohne weiteres Approval begonnen wurde und an WP-B-POSTFIX-REGRESSION übergeben wird.

### WP-B-PROMPT-CORRECTION: Bestätigten AI-Vertragsfehler beheben

**Status:** Conditional — only when WP-B-DIAG-RUN returns `gate: RED_CONFIRMED_B`.  
**Agent:** Backend

**Goal:** Den nachgewiesenen Feldvertrags-Gap im Weekly-Prompt schließen, ohne die deterministische Berechnung oder die bestehenden AI-Sicherheitsverträge zu verändern.

**Required Knowledge Base:** `docs/kb/domain/01-nutrition-model.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/07-ai-features.md`, `docs/kb/domain/08-quota-system.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/06-ai-integrations.md`, `docs/kb/tech/08-testing.md`  
**Required Repository Context:** `backend/src/lib/prompts/weeklyInsightV2.ts`, `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`, `backend/src/lib/prompts/weeklyInsight.eval.test.ts`, `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`, `backend/src/test-utils/weeklyInsightEvalSemantics.ts`, `backend/src/lib/openai.ts`, `backend/src/lib/openai.weekly.test.ts`, `backend/src/lib/weeklyInsight.ts`, `backend/src/functions/weeklyInsight.ts`, `backend/scripts/run-eval.mjs`, `backend/scripts/run-eval.test.mjs` und die zugehörigen Tests
**Required Skills:** `azure-openai-feature-integration`  
**Relevant Acceptance Criteria:** AC-3, AC-5, AC-6, AC-7, AC-9, AC-10, AC-13  
**Dependencies:** WP-B-DIAG-RUN with correct provider payload and `gate: RED_CONFIRMED_B` from a credentialed, semantically evidenced model output

**Approval Rule:** The single approval of this plan already authorizes this conditional correction. After the qualifying Red Gate, route directly here without requesting another `APPROVE`. If the payload is correct but the live output is correct, ambiguous, unavailable, or otherwise not semantically proven wrong, this package is skipped.

**Implementation Constraints:**

- `weeklyInsightV2.ts` bleibt unverändert als historische Version; die aktive Version wird als `v3` veröffentlicht.
- Der neue Feldvertrag definiert `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories`, `consumedCalories`, `targetPercent` und Totals explizit.
- Der Bonus ist bereits im effektiven Ziel enthalten, kein Verbrauch und nicht nochmals zu addieren.
- Keine nachträgliche Suche oder Ersetzung deutscher Wörter im freien Text als primäre Validierung.
- Version-Guard, Cache-Invalidierung, Strict Structured Outputs, `additionalProperties: false`, Textgrenze, Sanitization, Quota vor Provider und Usage-Tracking erst nach valider Antwort bleiben erhalten.

**Expected Handoff:** Aktiver Prompt `v3`, aktualisierte aktive Imports, Regressionen für Provider-Payload, `3000 / 3600`, `3600 / 3600` und Cache-Invalidierung, erfolgreicher `npm run test:eval`-Nachweis oder `UNVERIFIED`, sowie aktualisierte AI-KB-Dokumentation nur für den bestätigten Vertragswechsel.

### WP-B-POSTFIX-REGRESSION: Red-Gate nach Korrektur grün bekommen

**Status:** Conditional — only after WP-B-DATA-CORRECTION or WP-B-PROMPT-CORRECTION has run.  
**Agent:** Backend  
**Goal:** Den ursprünglich roten Diagnosepfad nach der autorisierten Korrektur mit demselben Test grün bekommen und die konkrete Root Cause als dauerhafte Regression absichern.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/test-utils/weeklyInsightEvalSemantics.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/lib/openai.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `shared/lib/weeklyReviewCalculator.test.ts`

**Required Skills:** `azure-openai-feature-integration`  
**Relevant Acceptance Criteria:** AC-2, AC-3, AC-4, AC-8, AC-9, AC-10, AC-11, AC-13, AC-16, AC-17
**Dependencies:** Exactly one completed correction handoff: WP-B-DATA-CORRECTION or WP-B-PROMPT-CORRECTION.

**Implementation Constraints:**

- Den exakt benannten Red-Gate-Test erneut ausführen. Im Datenzweig A muss der deterministische Handler-/Provider-Test mit Exitcode `0` grün sein; im Promptzweig B müssen zusätzlich beide credentialed Semantikfälle korrekt bewertet werden.
- Die Regression deckt die konkrete Root Cause und beide Grenzfälle ab, statt nur einen allgemeinen Snapshot oder Stringvergleich zu wiederholen. Bestehende Tests dürfen nicht abgeschwächt werden.
- Wenn der B-Zweig mangels Credentials oder wegen ambiger Semantik nicht grün verifiziert werden kann, ist die Korrektur nicht als abgeschlossen oder releasereif zu melden; `UNVERIFIED` bleibt getrennt auszuweisen.
- Snapshot-Priorität, Sanitization, Strict Structured Outputs, Quota-/Cache-Vertrag und der Scope ohne Mobile-, Cosmos-, Bicep- oder API-Änderung bleiben regressionsgeprüft.

**Expected Handoff:** Exakte Nachweise, dass derselbe Red-Gate-Test nach der Korrektur grün ist, inklusive Kommando und Exitcode; die ergänzten Root-Cause-Regressionstests mit Pfaden; bei B der erfolgreiche credentialed Semantik-Eval mit Promptversion und Deployment ohne Secret; sowie eine Liste aller geänderten Dateien. Erst dieses Handoff darf an Infrastructure oder QA weitergereicht werden.

## 11. Frontend Work Package

Nicht erforderlich. Der Mobile-Client ruft den bestehenden Weekly-Endpunkt auf und stellt `evaluation.text` sowie die deterministischen Review-Werte dar. Es gibt keinen nachgewiesenen UI- oder API-Vertragsfehler.

## 12. Infrastructure & Release Work Package

### WP-I-DEV: Bestätigten Backendfix in Development verifizieren

**Status:** Conditional — only after WP-B-POSTFIX-REGRESSION confirms a production backend correction.  
**Agent:** Infrastructure

**Goal:** Den bestehenden Backend-Releaseweg für Development ausführen und bestätigen, dass der korrigierte Weekly-Pfad dort verfügbar ist. Es wird keine neue Azure-Ressource angelegt.

**Required Knowledge Base:** `docs/kb/tech/01-system-overview.md`, `docs/kb/tech/07-infrastructure.md`  
**Required Repository Context:** `backend/package.json`, `backend/src/functions/weeklyInsight.ts`, `_deploy_staging/`  
**Required Skills:** None  
**Relevant Acceptance Criteria:** AC-12  
**Dependencies:** WP-B-POSTFIX-REGRESSION with the same diagnostic test green, regression tests green, and `npm run build:verify`

**Stop Conditions:** Bei Compilefehler, fehlender synchronisierter Datei, Deployfehler oder fehlgeschlagener Releaseverifikation stoppen und den Fehler melden. Keine Alpha-Aktion ohne spätere ausdrückliche Nutzeranforderung.

**Expected Handoff:** Development-Deploy-/Verifikationsstatus oder begründeter Stop-Bericht und Bestätigung, dass keine Bicep-, Cosmos- oder App-Setting-Änderung erforderlich war.

## 13. QA Work Package

### WP-Q-WEEKLY-ACTIVITY-DIAGNOSIS

**Agent:** QA

**Goal:** Die vollständige Diagnoseentscheidung und, falls vorhanden, die daraus resultierende Korrektur gegen alle Acceptance Criteria prüfen. QA übernimmt nicht die Auswahl eines unbelegten Fixes.

**Required Knowledge Base:** `docs/kb/domain/01-nutrition-model.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/07-ai-features.md`, `docs/kb/domain/08-quota-system.md`, `docs/kb/tech/04-shared-library.md`, `docs/kb/tech/06-ai-integrations.md`, `docs/kb/tech/08-testing.md`, `docs/kb/tech/09-api-reference.md`  
**Required Repository Context:** dieses Planartefakt, `backend/src/functions/weeklyInsight.test.ts`, `backend/src/functions/weeklyInsight.ts`, `backend/src/lib/openai.ts`, `backend/src/lib/openai.weekly.test.ts`, `backend/src/lib/weeklyInsight.ts`, `backend/src/lib/prompts/weeklyInsightV2.ts`, `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`, `backend/src/lib/prompts/weeklyInsight.eval.test.ts`, `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`, `backend/src/test-utils/weeklyInsightEvalSemantics.ts`, `backend/src/test-utils/weeklyInsightEvalSemantics.test.ts`, `backend/scripts/run-eval.mjs`, `backend/scripts/run-eval.test.mjs`, `shared/lib/weeklyReviewCalculator.ts` und die betroffenen KB-Dateien  
**Required Skills:** `azure-openai-feature-integration`  
**Relevant Acceptance Criteria:** AC-1 through AC-17

**Dependencies:** WP-B-DIAG-WRITE and WP-B-DIAG-RUN; only the correction branch authorized by a qualifying Red Gate; WP-B-POSTFIX-REGRESSION when a correction ran; WP-I-DEV only when that post-fix handoff exists

**Verification Tasks:**

- Fokussierte Tests für Handler, Prompt-Kontext, OpenAI-Request und Shared-Calculator ausführen.
- `cd backend && npx vitest run src/functions/weeklyInsight.test.ts src/lib/weeklyInsight.test.ts src/lib/openai.weekly.test.ts` ausführen.
- Den verpflichtenden Diagnose-Test zuerst als geschriebenes Artefakt und anschließend als Baseline-Lauf gegen den unveränderten Produktionsstand prüfen. Das Red-Gate-Manifest, die tatsächliche Assertion/Ausgabe, das Kommando und den Exitcode mit dem Backend-Handoff abgleichen; keine Korrektur ohne `RED_CONFIRMED_A` oder `RED_CONFIRMED_B` als Gate akzeptieren.
- `cd backend && npx vitest run src/test-utils/weeklyInsightEvalSemantics.test.ts` ausführen; der Semantik-Validator muss klare, ambige und ungültige Judge-Ergebnisse unterscheiden.
- `cd backend && node --test scripts/run-eval.test.mjs` ausführen; die CLI-Argumentweitergabe darf Credential-Werte nicht ausgeben.
- Bei Änderungen in `shared/` den zuständigen Shared-Test und bei jedem Backend-Change `cd backend && npm run build:verify` ausführen.
- `cd backend && npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` ausführen. Exitcode `2` beziehungsweise fehlende Credentials als `UNVERIFIED` dokumentieren; ein fehlender Live-Output ist kein bestandenes Eval.
- Die strukturierte Semantikprüfung auf `effective_target`, `base_target_only`, die erwartete Relation und eine echte Text-Evidenz prüfen. Reine `forbiddenPhrases`-Treffer nicht als ausreichenden Nachweis akzeptieren.
- Den Provider-Payload gegen alle fünf Zahlenfelder und die beiden Totals-Fälle prüfen.
- Bei `NO_RED`/Diagnosezweig C bestätigen, dass kein spekulativer Produktionsfix, kein Promptversionssprung und kein KB-Update als implementierte Korrektur ausgegeben wurde. Bei einem qualifizierenden Red Gate bestätigen, dass kein zweites Approval angefordert wurde und der passende Korrekturzweig direkt lief.
- Bei Diagnosezweig A die erste abweichende Stelle und die passende Regression prüfen.
- Bei Diagnosezweig B den v3-Feldvertrag, Version-Guard, Cache-Invalidierung, beide semantischen Eval-Grenzen und den grünen Post-Fix-Lauf prüfen.
- Quota-Reihenfolge, Strict Structured Outputs, Sanitization, neutrale Fehlerantworten, `0 kcal`, fehlende Ziele, historische Snapshot-Priorität und Cache-Hit/Cache-Miss regressionsprüfen.

**Expected Handoff:** Dauerhafter QA-Report unter `docs/qa/reports/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md` mit genau einem Verdict (`PASS`, `PASS WITH ISSUES` oder `FAIL`), Kriterienmatrix für AC-1 bis AC-17, Red-Gate-Entscheidung, Testkommandos, Exitcodes sowie getrennten `UNVERIFIED`-/`MANUAL VALIDATION REQUIRED`-Hinweisen.

## 14. Shared Package Changes

Im Diagnosezweig C und im Promptzweig B ist keine Änderung in `shared/` vorgesehen. Im Datenzweig A darf nur die durch den Payload-Gate belegte Calculator-/Target-Abweichung in `shared/lib/weeklyReviewCalculator.ts` geändert werden. Eine solche Änderung erfordert den bestehenden Shared-Regressionstest und den Backend-`build:verify`-Check. Es wird kein Shared-Typ, kein API-Feld und keine persistierte Datenstruktur erweitert.

## 15. Documentation Updates

- In Diagnosezweig C werden die Knowledge-Base-Dateien nicht als geändert markiert, weil keine neue Implementierungsentscheidung getroffen wurde.
- In Datenzweig A wird nur dann ein betroffener AI-/Domain-Abschnitt aktualisiert, wenn sich die dokumentierte Zielauflösung oder Berechnung tatsächlich ändert. Die User Story bleibt unverändert.
- In Promptzweig B werden [`docs/kb/domain/07-ai-features.md`](../../../docs/kb/domain/07-ai-features.md) und [`docs/kb/tech/06-ai-integrations.md`](../../../docs/kb/tech/06-ai-integrations.md) auf die bestätigte aktive Promptversion und den expliziten effektiven-Ziel-Feldvertrag aktualisiert. Die Dokumentation darf den Vertragswechsel erst nach bestandenem Eval als implementiert beschreiben.

## 16. Test Strategy

### Deterministische Unit-/Handler-Ebene

Der Handler-Mock ist der primäre Beweis für die Datenaufbereitung. Er vergleicht für beide Fälle die HTTP-Reviewdaten und den geparsten `messages[1].content` mit denselben Sollwerten. Damit wird unterschieden, ob ein Fehler vor dem Prompt, beim Kontext-Mapping oder beim Provider-Sendepfad entsteht. Dieser Test läuft credential-frei und ist der erste ausführbare Diagnose-Schritt.

### Credentialed Prompt-Eval

Nach dem Payload-PASS werden die beiden Zahlenfälle gegen die aktive Promptversion geprüft. Der Generator-Output wird mit einem eval-only Structured-Output-Judge und einem lokalen konservativen Validator bewertet. Die Erwartungen stammen aus US-01 und der Weekly-Calculation-KB: Basisziel `2300` darf nicht der alleinige Nenner sein; `3000`/`3600` ist innerhalb des effektiven Ziels; `3600`/`3600` liegt genau am effektiven Ziel. Der Eval darf keine exakte deutsche Formulierung erzwingen. Bei fehlenden Credentials, fehlendem Provider-/Judge-Output oder Ambiguität gilt `UNVERIFIED`, nicht PASS. Ein fehlerhafter Output wird mit Fixture, Promptversion, Deploymentname ohne Secret und begrenzter Text-Evidenz im Handoff erfasst.

Der bestehende `forbiddenPhrases`-Mechanismus bleibt für Sicherheits-/Ton-Negativfälle verwendbar, ist aber für diese These nicht ausreichend. Die konkrete Anpassung betrifft nur Test-/Eval-Dateien: `weeklyInsight.eval.fixtures.ts`, `weeklyInsight.special-activity.diagnostic.eval.test.ts`, `weeklyInsightEvalSemantics.ts` samt Unit-Test sowie die Argumentweitergabe in `run-eval.mjs` samt Test. Kein Produktionshandler und kein Produktionsgenerator importiert den Judge.

### Regression und Release

Nach einem bestätigten Backendfix bleiben die bestehenden Tests für Quota, Cache, Sanitization, Strict Structured Outputs, Truncation, fehlende Daten und historische Ziele verpflichtend. Ein Development-Deploy erfolgt erst nach Tests und Build-Verifikation; ein Alpha-Deploy ist nicht Bestandteil dieses Plans.

## 17. Acceptance Criteria

**AC-1 – Exakter Berechnungspfad:** Der Plan und der fokussierte Test benennen `setSpecialActivityHandler()`, `setDayTypeHandler()`, `weeklyInsightHandler()`, `resolveWeeklyTarget()`, `calculateWeeklyNutritionReview()`, `toPromptDay()`, `buildWeeklyInsightPromptContext()` und `generateWeeklyInsight()` als konkrete Stellen des Datenflusses.

**AC-2 – Sonderaktivitätswerte im Review:** Für Basisziel `2300`, Bonus `1300` und Verbrauch `3000` liefert der Wochenpfad `effectiveTargetCalories: 3600` und `targetPercent: 83.33333333333333`; für Verbrauch `3600` liefert er `targetPercent: 100`.

**AC-3 – Provider-Payload:** Der gemockte Azure-Request enthält in beiden Fällen `consumedCalories`, `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories` und `targetPercent` mit exakt den genannten Werten. Keine relevante Roh- oder Cacheinformation wird gesendet.

**AC-4 – Totals:** Bei jeweils nur einem eingeschlossenen Tag lauten die Totals für die beiden Fälle `3000/3600/83.33333333333333` und `3600/3600/100` für Verbrauch/Ziel/Gesamtprozentsatz.

**AC-5 – Payload-Gate-Klassifikation:** Jede Abweichung wird an der ersten divergierenden Stelle als Datenaufbereitungsfehler lokalisiert und als `RED_CONFIRMED_A` nur mit tatsächlicher erwarteter Assertion-Abweichung dokumentiert; ein korrekter Payload wird nicht als Datenfehler bezeichnet.

**AC-6 – AI-Befund:** Ein Prompt-/AI-Vertragsfehler wird nur akzeptiert und als `RED_CONFIRMED_B` markiert, wenn der korrekte Payload und ein reproduzierter widersprüchlicher credentialed Provider-Output gemeinsam vorliegen. Der Output muss durch den strukturierten Judge und den lokalen Validator als `INCORRECT` mit belegter Evidenz klassifiziert sein. Ohne diesen Nachweis wird ausdrücklich `C — These nicht bestätigt` dokumentiert.

**AC-7 – Bestehende Eval-Infrastruktur:** Der Plan benennt `backend/src/lib/prompts/weeklyInsight.eval.test.ts`, `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`, `backend/scripts/run-eval.mjs` und `backend/vitest.eval.config.mts` als vorhandene Mechanik und weist nach, dass sie bislang nur formale/`forbiddenPhrases`-Assertions besitzt. Die Diagnose ergänzt deshalb `weeklyInsight.special-activity.diagnostic.eval.test.ts`, den eval-only Semantik-Validator samt Unit-Test und die notwendige CLI-Argumentweitergabe; `forbiddenPhrases` bleibt nicht die alleinige Lösung.

**AC-8 – Korrektur des Datenpfads:** Wenn AC-5 einen Datenfehler findet, korrigiert Backend die erste fehlerhafte Stelle und deckt sie mit einem fokussierten Regressionstest ab; ein unbeteiligter Promptfix wird nicht vorgenommen.

**AC-9 – Korrektur des Promptvertrags:** Wenn AC-6 einen AI-Vertragsfehler bestätigt, benennt die neue Promptversion die Feldsemantik, verwendet ausschließlich `effectiveTargetCalories` als Nenner, untersagt Bonus-Doppelzählung und besteht die beiden Eval-Grenzen.

**AC-10 – Promptversion und Cache:** Nur im bestätigten Promptzweig wird die aktive Version von `v2` auf `v3` erhöht. Ein alter v2-Cache wird nicht als aktuelle v3-Bewertung ausgeliefert.

**AC-11 – Bestehender AI-Vertrag:** Strict Structured Outputs, `additionalProperties: false`, Textgrenze, Sanitization, Quota vor Provider, Usage-Tracking erst nach valider Antwort und neutrale Fehlerantworten bleiben erhalten.

**AC-12 – Keine unbelegte Korrektur:** Bei korrektem Payload ohne reproduzierten fehlerhaften Provider-Output werden keine Produktionsdateien geändert und keine neue Promptversion veröffentlicht. Der Handoff enthält den vollständigen Diagnosebefund und die fehlende Reproduktionsvoraussetzung. Ein grüner Test oder `UNVERIFIED` ist kein Red Gate.

**AC-13 – Beweisgrenze:** Der Handler-/Provider-Payload-Test allein bestätigt nicht die AI-These. `B`/`RED_CONFIRMED_B` darf nur bei korrektem Payload plus echtem, semantisch als `INCORRECT` belegtem Azure-Text entstehen. Ein korrekter AI-Text, fehlende Credentials, ein nicht ausgeführter Modellaufruf, ein Provider-/Judge-Fehler oder ambige Semantik ergibt `C`; bei fehlendem oder nicht auswertbarem Live-Nachweis ist der Status `UNVERIFIED` und niemals `PASS`.

**AC-14 – Verpflichtende Reihenfolge und exakte Fälle:** WP-B-DIAG-WRITE ist der erste Implementierungsschritt und WP-B-DIAG-RUN der erste Ausführungsschritt. Der Lauf führt exakt `3000 / 3600` mit `83.33333333333333 %` und `3600 / 3600` mit `100 %` durch, prüft zuerst deterministisch den Handler-/Provider-Payload und führt bei Payload-PASS anschließend den echten Azure-Prompt-Eval aus. Kein Korrektur- oder Release-Work-Package läuft vorher.

**AC-15 – QA-Nachweis und Produktionsumfang:** QA erstellt den dauerhaften Report am vorgegebenen Pfad mit genau einem Verdict, Kriterienmatrix für AC-1 bis AC-17, Testkommandos, Exitcodes sowie separaten `UNVERIFIED`-/manuellen Prüfhinweisen. Das Handoff nennt ausdrücklich die konkrete Antwort auf die Nutzerkritik, die Planänderungen und ob Produktionscode betroffen ist; im Diagnosepass ist Produktionscode nicht betroffen.

**AC-16 – Exaktes Red-Gate-Artefakt:** Nur das Handoff-Manifest aus WP-B-DIAG-RUN mit exaktem Kommando, Exitcode, tatsächlicher Assertion beziehungsweise begrenzter Text-Evidenz, erstem divergierendem Pfad, Root Cause und `gate: RED_CONFIRMED_A` oder `gate: RED_CONFIRMED_B` autorisiert eine Korrektur. `NO_RED`, `UNVERIFIED`, ein korrekter Text, Ambiguität, fehlende Evidenz und Runner-/Infrastrukturfehler autorisieren keine Korrektur.

**AC-17 – Einmalige Freigabe und Red → Green:** Das einmalige Plan-Approval autorisiert die bedingte Direktkorrektur. Nach einem qualifizierenden Red Gate wird ohne zweites `APPROVE` direkt der passende Korrekturzweig ausgeführt. Danach bekommt Backend denselben Diagnose-Test grün und ergänzt Root-Cause-Regressionstests; ein B-Zweig ist ohne erfolgreichen credentialed Semantik-Eval nicht abgeschlossen.

## 18. Risks and Edge Cases

- **Snapshot-Priorität:** Ein vorhandener `calorieTargetSnapshot` bleibt vor `specialActivity.dailyCalorieTarget` maßgeblich. Der Test darf diese Regel nicht durch einen neuen Fallback verdecken.
- **Bonuswert `0`:** `0` ist ein valider Aktivitätsbonus ohne zusätzliche Zielerhöhung und darf nicht als fehlender Wert behandelt werden.
- **Fehlendes Ziel:** Eine Aktivität ohne belastbares gespeichertes Ziel bleibt nicht bewertbar; es darf kein aktuelles Profilziel als historische Aktivitätsbasis erfunden werden.
- **Validierbarer Verbrauch `0`:** Ein vorhandenes MealItem mit `0 kcal` bleibt ein valider Datenpunkt und ist unabhängig von der Aktivitätsdiagnose regressionszuprüfen.
- **Freier AI-Text:** Das formale Schema garantiert keine fachliche Aussage. Ein semantischer Fehler muss durch den credentialed Eval belegt werden; ein nachträglicher Wortfilter ist keine belastbare Primärlösung.
- **Eval-Judge:** Ein zweiter Azure-OpenAI-Judge ist selbst modell- und deploymentabhängig und kann nicht als mathematischer Beweis gelten. Der lokale Validator akzeptiert nur strikt erlaubte strukturierte Werte mit Text-Evidenz; bei Judge-Unsicherheit, widersprüchlichen Signalen oder fehlender Evidenz gilt `UNVERIFIED`.
- **Eval-Kosten und Credentials:** Generator und Judge sind außerhalb des Produktionspfads, benötigen Azure-Zugang und verursachen Providerkosten. Der Runner darf keine Secrets ausgeben; Exitcode `2` bleibt ein expliziter Unverified-Zustand.
- **Cache:** Eine bestätigte Promptänderung benötigt den Versionssprung; ein reiner Datenfix nutzt den bestehenden Input-Hash und darf nicht ohne Befund einen Promptversionssprung auslösen.
- **Live-Umgebung:** Fehlende Credentials oder ein nicht verfügbares Azure-Setup führen zu `UNVERIFIED`, nicht zu einem erfundenen PASS und nicht zu einem unbelegten Fix.
- **Rohaktivitätsdaten:** Der Weekly-Prompt benötigt für die Zielbewertung den Bonus und das effektive Ziel, nicht die vollständige Aktivitätsberechnung. Eine Änderung dieses Sanitization-Vertrags wäre eine separate, begründungspflichtige AI-Entscheidung.

## 19. Recommended Execution Order

Die Ausführung erfolgt strikt sequenziell; die bedingten Korrekturzweige sind durch das einmalige Plan-Approval vorautorisiert:

1. **Backend – WP-B-DIAG-WRITE:** Als allerersten Implementierungsschritt den fokussierten Test und die notwendige test-only Eval-Unterstützung schreiben. Exakt die beiden Fälle `3000 / 3600` und `3600 / 3600` abbilden, den tatsächlichen Weekly-Insight-Provider-Kontext prüfen und keinen Produktionscode, aktiven Prompt oder Promptversionswert ändern.
2. **Backend – WP-B-DIAG-RUN:** Den deterministischen Test am unveränderten Produktionsstand mit `cd backend; npx vitest run src/functions/weeklyInsight.test.ts -t "RED-GATE: special activity uses effective weekly target in provider context"` ausführen. Bei einer qualifizierenden Payload-Abweichung `RED_CONFIRMED_A` manifestieren. Bei Payload-PASS anschließend den echten Eval mit `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` ausführen und nur bei strukturierter, belegter falscher Modellinterpretation `RED_CONFIRMED_B` manifestieren. Exaktes Kommando, Exitcode, tatsächliche Assertion/Ausgabe, Root Cause und Manifest übergeben. Kein Korrektur-Subtask läuft vorher.
3. **Backend – WP-B-DATA-CORRECTION:** Nur wenn WP-B-DIAG-RUN `RED_CONFIRMED_A` meldet, den ersten nachgewiesenen Berechnungs-/Mapping-/Sendefehler beheben. Kein zweites `APPROVE` anfordern; bei jedem anderen Gate überspringen.
4. **Backend – WP-B-PROMPT-CORRECTION:** Nur wenn WP-B-DIAG-RUN `RED_CONFIRMED_B` meldet, den bestätigten AI-Vertragsfehler beheben und erst dann `v3` aktivieren. Kein zweites `APPROVE` anfordern; bei jedem anderen Gate überspringen.
5. **Backend – WP-B-POSTFIX-REGRESSION:** Nach dem tatsächlich gewählten Korrekturzweig denselben Red-Gate-Test grün bekommen und Root-Cause-Regressionstests ergänzen. Im Promptzweig müssen beide credentialed Semantikfälle grün sein; fehlende Credentials bleiben `UNVERIFIED` und schließen den Zweig nicht ab.
6. **Infrastructure – WP-I-DEV:** Nur nach einem erfolgreichen Post-Fix-Handoff den bestehenden Development-Releaseweg ausführen. Keine Bicep-, Cosmos-, App-Setting-, Mobile- oder Alpha-Aktion; ohne bestätigten Backendfix keine Infrastrukturaktion.
7. **QA – WP-Q-WEEKLY-ACTIVITY-DIAGNOSIS:** Den tatsächlich gewählten oder bewusst übersprungenen Zweig, die Red-Gate-Entscheidung, alle Acceptance Criteria und den dauerhaften Report prüfen. `NO_RED`/`UNVERIFIED` endet ohne Produktionsänderung; eine spätere Korrektur benötigt dann einen neuen reproduzierbaren Befund.

## 20. Planner Handoff

**Antwort auf die Nutzerkritik:** Der bisherige Plan war beim Ablauf nicht verbindlich genug. Die Revision legt zuerst das Schreiben und unmittelbar danach die Ausführung eines fokussierten Tests gegen den aktuellen Produktionsstand fest. Der Payload-Test bleibt der erste kausale Teil; bei korrektem Payload muss der echte Azure-OpenAI-Generator mit strukturierter Semantikbewertung geprüft werden. So wird weder aus einem korrekten Datenpaket fälschlich eine bestätigte AI-These noch aus einem beliebigen Testfehler eine Korrekturfreigabe.

**Änderungen am Plan:**

- WP-B-DIAG-WRITE ist der verpflichtende erste Implementierungsschritt; WP-B-DIAG-RUN ist der unmittelbar folgende Baseline-Lauf. Beide Fälle `3000 / 3600` sowie `3600 / 3600` werden mit den konkreten Ziel- und Prozentwerten ausgeführt.
- Der gemockte Handler-/Provider-Payload-Test prüft deterministisch `2300`, `1300`, `3600`, `3000`, `3600`, `83.33333333333333` und `100` einschließlich Totals und Sanitization.
- Der bestehende Live-Eval wird um zwei konkrete Diagnose-Fixtures, eine gezielte Runner-Datei und einen eval-only Structured-Output-Judge mit konservativem lokalem Validator erweitert. Wörterbuch-/`forbiddenPhrases`-Filter sind nicht die alleinige Lösung.
- Der Handoff muss A `Datenaufbereitungsfehler`, B `Prompt-/AI-Vertragsfehler` oder C `These nicht bestätigt` ausweisen und zusätzlich das Gate `RED_CONFIRMED_A`, `RED_CONFIRMED_B`, `NO_RED` oder `UNVERIFIED` enthalten. Fehlende Credentials, nicht ausgeführte Modelloutputs und Ambiguität sind `UNVERIFIED` und kein PASS.
- Der bestehende freie Produktions-Responsevertrag bleibt im Diagnosezweig unverändert. Ein Promptversionssprung auf `v3` ist nur im bedingten Zweig B zulässig; Zweig A ändert ausschließlich die nachgewiesene Datenaufbereitung.

**Planpfad:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md`  
**Bedingte Direktkorrektur abgedeckt:** Ja. Das einmalige Plan-Approval autorisiert nach einem qualifizierenden Red Gate die direkte Ausführung des passenden Korrekturpfads ohne ein zweites `APPROVE`; ohne qualifizierendes Red Gate bleibt der Produktionsstand unverändert.

**Produktionscode betroffen:** In dieser Planner-Runde und im verpflichtenden Diagnosepass: **Nein**. Betroffen sind zunächst ausschließlich Plan-/Test-/Eval-Dateien. Produktionscode ist nur bedingt betroffen: im Datenzweig A an der ersten nachgewiesenen Calculator-/Mapping-/Sendestelle; im Promptzweig B an der aktiven Promptversion und deren Vertrags-/Cacheanbindung. Bei C bleibt Produktionscode unverändert.

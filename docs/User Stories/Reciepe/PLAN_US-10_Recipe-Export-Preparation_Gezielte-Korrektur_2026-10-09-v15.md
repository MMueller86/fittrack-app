# PLAN_US-10: Export-Preparation - gezielte Korrektur v15

Status: Entwurf zur neuen ausdruecklichen Freigabe; keine Umsetzung, QA oder Deployment autorisiert.
Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Auftrag und Entscheidungsgrenze

Nutzeranforderung wortgetreu:
> Ich will erstmal diese Fehler korrigiert haben, nicht mehr, nicht weniger. Und dann möchte ich wissen, ob wir jetzt in der vergangneheit irgednwas overeingeneert haben, was wir zurückrollen sollten. Prüfe das, und mache gezielte korrekturen und ggf. Rollbacks.

Classification: Accept with modifications. Dieser Plan reduziert den breiten v14-Auftrag auf den belegten Vorbereitungsausfall, notwendige Regressionen und begruendete lokale Ruecknahmen. Die Ausfuehrung folgt erst nach neuer Freigabe; die v14-Freigabe deckt diesen geaenderten technischen Ansatz nicht ab. Orchestrator routet ausschliesslich, Backend implementiert, QA prueft unabhaengig.

Bei der Wiederaufnahme wurde kein v15- oder 2026-10-09-Planartefakt im Repository gefunden; `git status --short` zeigte nur die bisherigen Plaene/Handoffs. Daher neuer freier Pfad, keine Umbenennung oder Ueberschreibung vorhandener Dokumente. Alle vorgefundenen Code-, KB- und QA-Aenderungen bleiben bei dieser Planung unangetastet.

Open Product Owner Decisions:
- PO-1 [Open, optional]: Soll die historisch lokal eingefuehrte Forderung nach genau `min(N,5)` Exportgruppen wieder auf hoechstens fuenf zurueckgenommen werden? Story AC-15/16 verlangt keine exakte Anzahl, aktuelle KB und v13/v14-Plaene jedoch schon. Empfehlung: fuer diesen Fix unveraendert lassen; kein Ursachenbeleg fuer den konkreten 422. Eine Ruecknahme waere eine zusaetzliche Produkt-/Vertragsentscheidung und ist nicht Bestandteil der Standardfreigabe dieses Plans. Kein Paket ist hiervon blockiert, solange die Regel erhalten bleibt.
- Die interne Vorbereitungsspezialisierung in Abschnitt 4 weicht bewusst von der KB-Aussage "same analyzer / does not change the prompt" ab. Ihre Genehmigung ist Bestandteil der v15-Freigabe. Ein neues Provider-Schema, neuer Endpunkt oder export-only Generator ist dagegen nicht freigegeben; bei Bedarf anhalten und revidieren.

## 2. Evidenz, aktueller Stand und fehlende Fakten

Verbindliche Referenzen:
- [v14-Arbeitsplan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-08-v14.md), laut Nutzer freigegeben; Artefaktstatus selbst noch Entwurf.
- [B-2-Handoff](B-2_Recipe-Analyze-v14_Handoff_2026-10-08.md): BLOCKED, candidate only.
- [v13-QA-Bericht](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md): FAIL.
- [Vorgaengerplan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md) dokumentiert denselben urspruenglichen Preparation-Ausfall.
- [US-10](US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md), besonders AC-15/16; [QA-Register](../../qa/findings.md), nur FT-QA-2026-063.

Historische Fehlermeldung laut Nutzer: um 12:48:42 UTC, `recipes-prepare-export-view`, HTTP 422, operation_Id `a9f0b3adf10d2c4e2ab866d38d6b65ae`. Quellorders 1..8; Exportgruppen `[1],[2],[3],[4],[6,7]`; flach `[1,2,3,4,6,7]`. Fehlende Quellhandlungen: 5 = Reis separat kochen; 8 = abschliessendes Servieren. Erster Mismatch an Position 5: erwartet 5, erhalten 6. Kein `recipes-share-bundle`-Aufruf; Fehler vor Rendering.

Diese Meldung wurde hier nicht erneut aus Telemetrie abgerufen. Privater Originaltext, genaue Saetze/Zutaten/Zeitangaben aller acht Schritte, deployed Revision, Providerrequest und Modellantwort liegen nicht vor. Deshalb kein historischer Inhaltsreplay und keine Behauptung ueber Tokenmangel, Temperaturursache oder die konkrete modellinterne Ursache. Synthetische Regressionen werden als solche markiert.

Kontrollierender aktueller Pfad:
- `backend/src/functions/recipes.ts`: `buildRecipePreparationText()` serialisiert das gespeicherte Rezept als Freitext; `prepareRecipeExportViewHandler` ruft `analyzeRecipeText(preparationInputText)` auf. Erst danach ersetzt er `analysis.steps` durch `recipe.steps` fuer die Validierung, waehrend die generierte Exportzuordnung unveraendert bleibt.
- `backend/src/lib/openai.ts`: derselbe Importprompt und dasselbe volle `RECIPE_ANALYZE_SCHEMA` erzeugen erneut Metadaten, Zutaten, Quellschritte und Export. Der Provider kennt keinen ausdruecklichen Preparation-Modus; aktuell Temperatur 0, 2048 Tokens, ein Aufruf.
- `backend/src/lib/recipeAnalyzeValidation.ts`: geordnete, eindeutige gespeicherte Sourceorders und exakter flacher Trace werden fail-closed geprueft. Nur maximal fuenf Exportgruppen, nicht genau `min(N,5)`, werden serverseitig erzwungen. Der Validator prueft keine allgemeine sprachliche Handlungsaequivalenz.

Lokale falsifizierbare Hypothese: Freitext-Reextraktion und erst nachtraegliche Bindung an gespeicherte Sourceorders schaffen einen unnoetigen Identitaetswechsel im Vorbereitungspfad. Ein expliziter Preparation-Kontext mit unveraenderter gespeicherter Quellliste kann diese Mehrdeutigkeit begrenzen, ohne Importverhalten oder Validation zu lockern. Das ist eine begruendete technische Hypothese, keine bewiesene historische Modellursache.
Billiger diskriminierender Check: Requesttest muss die gespeicherte JSON-Schrittliste samt Orders 1..8 und Preparation-Anweisung nachweisen; Handler-/Validatortest muss den exakten historischen numerischen Trace trotz abweichender KI-Quellliste mit Mismatch 5/5/6 zurueckweisen. Ob die Korrektur wirklich bessere Texte liefert, entscheidet erst die neue fokussierte Live-Pruefung am realen Preparation-Aufrufpfad, nicht ein Mock.

Workflowstand laut Nutzer: B-1 abgeschlossen; B-2 blockiert; B-3/D-1/QA nicht gestartet. B-1-Historie: Datenschutz-Red/Green, 103 fokussierte Tests, 1287 Vollsuite. B-2-Handoff: 1378 Unit-Tests, Typecheck/Build PASS; Live 0/8 bei 0.2, nach gleichzeitig geaendertem Prompt und Temperatur 0 nur 2/8, ueberwiegend Gruppenanzahlfehler. Dies sind historische Handoffangaben, keine aktuell ausgefuehrten Gates oder Stabilitaetsevidenz. Die acht bisherigen Fixtureinputs blieben unveraendert.

## 3. Behalten / Entfernen / Ungeklaert

| Entscheidung | Massnahme und Beleg | Historie / Eigentumsgrenze |
|---|---|---|
| Behalten | Fail-closed Trace-/Schema-/Zeichenlimits, gespeicherte Schritte als Validierungsreferenz; `recipes.ts`, `recipeAnalyzeValidation.ts`. Sie erkennen den gemeldeten Verlust korrekt. | Gespeicherte Referenz und numerische Mismatchdiagnose sind lokale Vor-B-2-Aenderungen gegen HEAD; nicht B-2 zuzuschreiben oder zurueckrollen. |
| Behalten | B-1-Entfernung von `validationContext`/`validationOutput` und ausschliesslicher Kuerzungshilfe; negative Datenschutzregression ueber alle `log/warn/error`-Argumente, sichere Codes/Pfade/beschraenkte numerische Orders. | Inhaltslogging wurde in `b637ee5` (2026-10-07) committed; B-1 entfernt es bereits. Keine erneute Inhaltslogging-/Retentionmassnahme. |
| Behalten | Vollstaendige vorhandene Source-/Export-Semantikrubrik 1..8, Offline-Verlustproben, Duplikat-/Boundarytests und kleiner test-only Assertionhelper in bestehender Fixturedatei. | B-2-Handoff benennt diese lokalen Aenderungen; sinnvolle Absicherung des Inhaltsverlusts, kein Beleg fuer ueberfluessige Abstraktion. Nicht mit dem Promptversuch entfernen. |
| Entfernen | Nur B-2-spezifische gescheiterte Importprompt-Stabilisierung: zusaetzliche exakte-M-Planungsanweisungen, Mehrfachhandlungs-/Duplikatbeispiele und Wiederholungen auf dokumentierten v13-Inhalt zurueckfuehren. | HEAD-Prompt ist v11 (`da3c45c`, 2026-10-03); v12/v13/v14 liegen zusammen uncommitted vor. v13 ist kein per Git auscheckbarer Rollbackpunkt. Hunkweise Rekonstruktion aus v13-Plan/QA und B-2-Handoff; fruehere Source-/Beilagen-/Servierkorrekturen erhalten. Bei nicht eindeutiger Hunkzuordnung nur diesen Hunk stoppen und Herkunft klaeren. |
| Entfernen | Recipe-Analyze-lokalen Temperatur-0-Versuch auf vorherige 0.2 zuruecknehmen und passende Requestassertion anpassen. Kein globaler Temperaturwechsel. | `git diff openai.ts` zeigt nur 0.2 -> 0; B-2 nennt es gescheiterten Kandidaten. Prompt/Temperatur wurden gemeinsam geaendert, kein isolierter Wirksamkeitsnachweis. Ruecknahme ist keine Stabilitaetsgarantie. |
| Entfernen | Breiten v14-Stabilisierungsauftrag und vorsorgliches B-3-Renderer-Testtuning nicht fortsetzen. | Keine B-3-Implementierung laut Workflow; also Auftragsruecknahme, kein Code-Rollback. Normale Vollsuite bleibt Pflicht, reale erneute Fehler separat eskalieren. |
| Ungeklaert | Genau `min(N,5)` statt maximal fuenf als Produktregel: PO-1. Bestehenden Evalcheck nicht still entfernen, Reihenfolge der Checks darf den Inhaltsnachweis nicht verdecken. | HEAD v11 nutzt maximal fuenf; v13-KB/Plan bereits genau M, B-2 fuegt erstmals expliziten Evalcount hinzu. Lokale v13-Einfuehrung, kein committed v14-Ursprung. Gemeldeter Fehler hat bereits fuenf Gruppen und ist damit kein Countfehler. |
| Behalten, vorerst | Volles Provider-Schema und gemeinsame Clientfunktion, obwohl Preparation unbenoetigte Importfelder erzeugt. | Schema-/Featureeinbau in `da3c45c`, Diagnoseausbau in `b637ee5`; Quota/Transienz dokumentiert. Export-only Schema waere plausibel, aber eine weitere Architektur-/Providervertragsaenderung, fuer diesen ersten Fix nicht erforderlich belegt. |
| Ungeklaert | Andere lokale KB-, QA- und Testaenderungen sowie tatsaechlich deployed Revision. | `git status` belegt gemischten Dirty Worktree, nicht Urheberschaft/Deployment. Keine pauschalen Restores, Commit-Reverts oder fremden Hunkruecknahmen; nur eindeutig durch Handoff zugeordnete Aenderungen. |

## 4. Kleinster vorgeschlagener Fix und Grenzen

1. Bestehende Clientfunktion `analyzeRecipeText` um genau einen optionalen internen Preparation-Kontext ergaenzen; Importaufruf ohne Kontext behaelt seine bisherigen Aufgaben. Kein generisches Modussystem, kein neuer Service/Endpoint.
2. Preparation uebergibt serverseitig geladene Schritte strukturiert als JSON mit originalen `order`, `title` und `description`; Metadaten/Zutaten nur als Rezeptkontext. Keine Renummerierung, Sortierung oder Neuschreibung der gespeicherten Schritte. Den bisherigen Freitextbuilder nur ersetzen, soweit der Preparation-Aufruf ihn nicht mehr benoetigt; keinen doppelten Builder behalten.
3. Im bestehenden Promptmodul einen kurzen, versionierten Preparation-Zusatz vorsehen, der die gespeicherte Liste als verbindliche Exportbasis benennt: keine erneute Extraktion/Teilung/Verschmelzung der Quellidentitaeten, Zuordnung an originalen Orders, nur benachbarte Gruppen, jede Handlung samt vorhandenen Details im referenzierenden Exporttext; Reiszubereitung und Servieren duerfen nicht entfallen. Systeminstruktion und JSON-Rezeptdaten trennen, Rezepttext nicht als vertrauenswuerdige Instruktion behandeln.
4. Dasselbe Strict Structured Output Schema und derselbe einmalige Provideraufruf bleiben erhalten; unbenoetigte Importfelder sind kein Anlass fuer neue Klassifikationsarbeit. Handler validiert weiterhin gegen gespeicherte `recipe.steps`, nie gegen KI-reextrahierte Schritte. Kein Auffuellen von IDs, keine Textreparatur und kein Retry nach 422.
5. Identitaeten bewusst setzen: neuer Importpromptstand `RECIPE_ANALYZE_PROMPT_VERSION = 'v15'` dokumentiert die hunkweise Ruecknahme auf v13-Semantik, nicht eine neue Importoptimierung; Preparation-Zusatz bekommt eigene Version `v1` im selben Modul samt Guard. Kein neuer Cosmos-Promptversionsspeicher fuer transiente Vorschlaege.

AI assessment: KI bleibt fuer kurze deutsche Formulierungen und vorhandene Metadatenableitung erforderlich; deterministische Sourceidentitaet und Validation werden nicht an sie delegiert. Kein neuer AI-Use-Case, weiter `recipe-analyze`, advisory und explizite Nutzerbestaetigung. Provider/Parse/Leerfehler 502, Quota 429, ungueltiger Trace 422; Auth/ETag-Reihenfolge unveraendert. Schema `strict: true` und `additionalProperties: false` bleibt unveraendert. Modell, Tokenbudget, SDK und Ressourcen bleiben unveraendert.

Persistence Impact: None; kein Dokumentfeld, Repositoryverfahren, Container, Migration oder Rueckfuellung; Dev/Alpha-Daten unveraendert. Keine neuen Dependencies, keine Mobile-/Shared-Aenderung. Nach Abnahme/Merge bedarf Alpha eines separat explizit beauftragten Deployments; dieser Plan autorisiert kein Deployment und kein Infrastrukturdesignpaket. Dev-Verifikation im bestehenden lokalen Setup.

Out of Scope: Renderer-/Asset-/Layouttuning, share-bundle-Fix, AC-11-Neuaufrollung, neue Produkt-/Ernaehrungsregeln, Quota-/Authaenderung, Limitslockerung, exakt festgelegte Gruppengrenzen, automatischer Fallback, weiterer KI-Aufruf, universal semantischer Validator, globale Bereinigung, irrelevante Daily-Insight-Evalreparaturen, Registerpflege oder historische Berichtsaenderung. Kein universelles AI-Zuverlaessigkeitsversprechen.

## 5. Akzeptanzkriterien

- AC-1 Preparation-Bindung: Realer Handler-/Clientrequest benutzt den expliziten Preparation-Kontext und die gespeicherten Schritte unveraendert; import ohne Kontext bleibt kompatibel. Versionsguards erfassen Import v15 und Preparation v1. JSON-Input dient als Daten, nicht als neue Systeminstruktion.
- AC-2 Exakter Tracefehler: Gespeicherte 1..8 mit `[1],[2],[3],[4],[6,7]` ergeben weiterhin 422 und `source_step_coverage_mismatch`, Position 5/erwartet 5/erhalten 6; kein Usage, keine Persistenz, kein zweiter Call. KI-Quellliste darf diesen Check nicht umgehen; Input/Output werden nicht repariert. Fehlende, doppelte, unbekannte, vertauschte Referenzen und leere Texte bleiben ungueltig.
- AC-3 Handlungserhaltung: Klar synthetischer gespeicherter Acht-Schritt-Fall mit 5 = Reis separat kochen und 8 = finales Servieren liefert im Preparation-Pfad eine vollstaendige geordnete Partition innerhalb der bestehenden Anzahl-/90-Zeichenlimits. Jede Handlung 1..8, Zutatenbeziehung sowie im synthetischen Input vorhandene Zeit/Hitze/Wendepunkte bleiben im jeweils referenzierenden Exporttext nachweisbar; Reisnennung allein ist keine Kochhandlung. Keine erdachten historischen Details oder fest vorgeschriebenen Saetze/Gruppengrenzen.
- AC-4 Kein ID-Scheinfix: Verlust-/Vertauschungsproben fuer Reis/Servieren und repraesentative weitere Handlungen/Details muessen die Reviewrubrik trotz korrekter Counts/IDs scheitern lassen. Rubrik ist Testevidenz, kein behaupteter Runtime-Semantikschutz. Gueltige alternative benachbarte Gruppierungen bestehen; die bestehende 1..8-Rubrik bleibt erhalten. Bei unmoeglicher Darstellung innerhalb der Limits stoppen, nicht Inhalt verwerfen.
- AC-5 Ruecknahmen: Nur eindeutig B-2-zugeordnete Promptversuche und lokale Temperatur 0 werden entfernt; v13-Source-/Semantikregeln, Countregel samt Eval, sichere Diagnosen, gespeicherte Validierungsbasis, B-1-Datenschutz und sinnvolle Offline-Tests bleiben. Handoff zeigt Herkunft pro Hunk und keine fremden Ruecknahmen; PO-1 bleibt offen.
- AC-6 Invarianten: Auth vor Repository-/Quota-/Providerarbeit gemaess bestehendem Handler, optionales ETag vor Quota; 422/429/502, Strict Schema, ein Providercall, einmal Usage nur nach validem Erfolg, Text-only V2 und Transienz unveraendert. Keine privaten Rezept-/Modell-/Fehlertexte in allen erfassten log/warn/error-Argumenten. Import behaelt volle Analyze-/Zutatenvalidierung.
- AC-7 Gates: Neue Preparation-Liveprobe besteht drei vorab festgelegte unmittelbar aufeinanderfolgende vollstaendige fokussierte Laeufe; bestehende acht Importfixtures bestehen den fokussierten Live-Lauf mit unveraenderten Inputs/Constraints. Alle vorgeschriebenen Repositorygates in Abschnitt 7 bestehen neu; fehlende Credentials/fehlender Nachweis = UNVERIFIED, kein PASS. Zufallspasses ersetzen keine Fehlschlagaufklaerung. Keine stabilitaetsgarantierende Auslegung dieser endlichen Stichprobe.
- AC-8 Unabhaengige Abnahme: KB beschreibt tatsaechlichen neuen Preparation-Zweig, Versionen, verbleibende Privacydiagnose und Testgrenzen korrekt. QA prueft Fix und Ruecknahmen selbst, trennt historischen 422, synthetische Regression und aktuelle Gates; offene allgemeine v13/v14-Findings werden nicht allein wegen erfolgreichem Preparationfall geschlossen.

## 6. Ausfuehrbare Arbeitspakete

### B-1 - Abgrenzung und gezielte Versuchsruecknahme
Agent: Backend
Goal: Vor Bearbeitung Dirty Worktree und betroffene Hunks als unveraenderte Ausgangsevidenz erfassen; B-2-Handoff gegen den Diff abgleichen. Nur klar identifizierte v14-Promptversuche auf v13-Semantik zurueckfuehren, bewusst v15/Guard setzen; Recipe-Analyze-Temperatur auf 0.2 und zugehoerige Requestassertion zuruecknehmen. Keine ganze Datei aus HEAD v11 herstellen, kein Git-Revert. Bestehende Rubrik/Tests und B-1-Datenschutzarbeit erhalten. Bei uneindeutiger Herkunft nur betroffenen Hunk aussetzen und konkret melden.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/06-ai-integrations.md
Required Repository Context:
- backend/src/lib/prompts/recipeAnalyze.ts
- backend/src/lib/prompts/recipeAnalyze.eval.test.ts
- backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts
- backend/src/lib/openai.ts (nur analyzeRecipeText)
- backend/src/functions/ai.test.ts
- v13-Vorgaengerplan, v14-Plan, B-2-Handoff und v13-QA-Bericht aus Abschnitt 2
- git diff und fokussierte Historie da3c45c/b637ee5 fuer diese Dateien
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-5, AC-6, AC-7
Dependencies: ausdrueckliche v15-Freigabe
Expected Handoff: Hunkmatrix mit Behalten/Ruecknahme/Herkunft, bewusste Versionierung, aktueller fokussierter Testbefund; kein behaupteter Fix durch Ruecknahme allein.
Recommended Execution Order: 1, nach Freigabe; danach B-2.

### B-2 - Gespeicherte Schritte an Preparation binden
Agent: Backend
Goal: Den kleinen internen Kontext-/Promptzusatz aus Abschnitt 4 implementieren; echte Requestbindung zuerst durch failing Requesttest sichtbar machen und danach korrigieren. Exakten numerischen Trace aus AC-2 in bestehendem Validator-/Handlertest absichern (dieser Negativtest darf schon vorher gruen sein und ist allein kein Red/Green des Fixes). Eine klar synthetische Preparationfixture 1..8 mit Reis und Servieren in der bestehenden Fixturedatei aufnehmen; im bestehenden Live-Evalfile am neuen Preparation-Aufrufzweig auswerten, getrennt von den acht Importfixtures/deren Inputs. Vorhandenen test-only Helper wiederverwenden; Source-/Exportbeziehungen und Details vor Counts oder unabhaengig von fruehem Countabbruch berichten. Offline-Mutationen brauchen nachweislich gueltigen strukturellen Trace, damit Verlustproben nicht versehentlich wegen IDs scheitern. Keine neue Testframework-Abstraktion. Live-Fixnachweis und Importregression erbringen; bei anhaltenden Fehlern stoppen und Restbefund statt neuer Architektur liefern.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/09-api-reference.md (Preparation V2)
- docs/kb/tech/08-testing.md
Required Repository Context:
- backend/src/functions/recipes.ts (Builder und prepareRecipeExportViewHandler)
- backend/src/functions/recipes.test.ts (V2, gespeicherte Referenz, Privacy und Usage)
- backend/src/lib/openai.ts (Client, Schema und analyzeRecipeText)
- backend/src/functions/ai.test.ts (Import-/Providerrequestregression)
- backend/src/lib/recipeAnalyzeValidation.ts und backend/src/lib/recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts und recipeAnalyze.eval.fixtures.ts
- backend/package.json, backend/vitest.config.mts, backend/vitest.eval.config.mts
- B-1-Handoff und dieser Plan AC-1 bis AC-7
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7
Dependencies: B-1-Handoff; bei Provider-Schema-/APIbedarf neue Entscheidung, kein stiller Scopeausbau
Expected Handoff: minimaler Preparation-Diff, Request-Red/Green, exakter Negativtrace, synthetische Aktionsmatrix 1..8 mit Offline-Mutationen, aktuelle Live-/Unit-/Buildresultate und Parameter/Exitcodes; verbleibende semantische Runtimegrenze explizit. Keine privaten Texte oder Secrets im Handoff.
Recommended Execution Order: 2; danach D-1.

### D-1 - Nur betroffene KB angleichen
Agent: Backend
Goal: Nach tatsaechlichem Fix Preparation-Zusatz/JSON-Sourcebasis statt unveraendertem Importprompt dokumentieren; Import v15 mit v13-Semantik und Preparation v1 korrekt nennen. Ueberholte Inhaltslogging-/16000-Zeichen-/30-Tage-Passage auf sichere verbleibende Diagnosen berichtigen; keine Retentionpolicy erfinden. Semantikrubrik und fehlende universelle Runtime-Semantikvalidierung ehrlich beschreiben. Countregel bleibt unveraendert. Historische Plaene/Story/Reports/Register nicht bearbeiten.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/09-api-reference.md
Required Repository Context:
- B-1/B-2-Handoffs und betroffene Diffs
- backend/src/functions/recipes.ts, backend/src/lib/openai.ts, backend/src/lib/prompts/recipeAnalyze.ts
- dieser Plan, insbesondere Evidenzgrenzen und AC-8
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-5, AC-6, AC-8
Dependencies: B-2-Handoff
Expected Handoff: eng begrenzter KB-/Codeabgleich und konsolidierte neue Gate-Evidenz an QA, keine heutigen Erfolgsaussagen aus historischen Testzahlen.
Recommended Execution Order: 3, vor dokumentationspruefender QA.

### Q-1 - Unabhaengige Fix- und Ruecknahme-QA
Agent: QA
Goal: Den realen Vorbereitungspfad und die hunkgenauen Ruecknahmen unabhaengig pruefen; Test-Red/Green, Sourcebindung, Semantikverlust bei formal korrekten IDs, Live-Fix und Importregression selbst verifizieren. AI-Skill Section 6 und referenzierte QA-Checklist anwenden. Neue frische Evidence/Report nach normalem QA-Prozess; keine Implementierung oder Registeraenderung durch diesen Auftrag. FT-QA-2026-063 und allgemeine v13-FAIL-Befunde nicht pauschal schliessen; ausserhalb der engen Korrektur verbleibende Punkte separat ausweisen.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/08-testing.md
Required Repository Context:
- dieser Plan und B-1/B-2/D-1-Handoffs samt Ausgangs-/Enddiff
- backend/src/functions/recipes.ts, recipes.test.ts und ai.test.ts
- backend/src/lib/openai.ts, recipeAnalyzeValidation.ts und recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts und recipeAnalyze.eval.fixtures.ts
- backend/package.json und beide betroffenen Vitestconfigs
- v13-QA-Bericht und docs/qa/findings.md nur FT-QA-2026-063
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1 bis AC-8; US-10 AC-15 und AC-16 nur betroffene Schrittvollstaendigkeit
Dependencies: neue v15-Freigabe und D-1-Handoff
Expected Handoff: eigener Verdict mit AC-Matrix, neu ausgefuehrten Befehlen/Exitcodes, numerischem Fehlernachweis, synthetischer Inhaltsmatrix, Ruecknahme-/Privacybewertung und offenen FAIL/UNVERIFIED-Gates. Keine Deploymentfreigabe oder historische Reproduktionsbehauptung ableiten.
Recommended Execution Order: 4; bei FAIL/UNVERIFIED keine abgeschlossene Fehlerkorrektur.

## 7. Risikogerechte Pruefungen und Pflichtgates

Ausfuehrung ausschliesslich nach Freigabe durch Backend/QA, Befehle einzeln im Verzeichnis `backend`, keine erleichterte Runnerkonfiguration:
1. Failing Requestbindungstest -> kleiner Fix -> derselbe Test gruen. Exakter AC-2-Trace gegen gespeicherte 1..8 mit echter Validation, auch wenn KI-steps fehlen oder davon abweichen; Mismatch 5/5/6 und Unveraendertheit pruefen. Bestehenden B-1-Datenschutztest ueber alle Loggerargumente rerunnen.
2. Synthetische acht gespeicherte Aktionen einschliesslich getrenntem Reiskochen und gemeinsamem finalem Servieren. Vollstaendiger alternativer benachbarter Trace als Positivfall; fehlende Reis-/Servierhandlung bei IDs 1..8 muss Rubrik negativ machen. Weitere vorhandene Zeit-/Hitze-/Beziehungsproben risikogerecht behalten, keine erfundenen historischen Zeiten/Temperaturen.
3. `npx vitest run src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/recipeAnalyzeValidation.test.ts`. Import-Request/Preparation-Zusatzguard/offline Rubrik hier ausfuehren, nicht aus einem im Unitrunner ausgeschlossenen Evalfile als bestanden ableiten.
4. `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` drei unmittelbar aufeinanderfolgende vollstaendige Laeufe mit dem neuen Preparationfall und den acht bestehenden Importfixtures. Jede Szenariogruppe, Guard, Parameter und Exitcode getrennt ausweisen. Vorab feste Anzahl, kein selektives retry-until-green; bei Fehler stoppen, Befund erhalten und nur nach inhaltlicher Korrektur neuen Dreiernachweis beginnen.
5. `npm run test:eval` als verpflichtendes Gesamtgate gemaess AI-Skill. Fremde Daily-Insight-Fehler ausweisen/eskalieren, nicht hier reparieren; Gesamtgate bleibt bei Fehler offen. Fehlende Credentials / Runnerexit 2 / Skips sind UNVERIFIED, kein Erfolg.
6. `npx vitest run`, `npm run typecheck`, `npm run build:verify`; am Root `git diff --check`. Keine Rendereroptimierung, pauschale Timeouterhoehung, Skips oder Assertionlockerung, falls die normale Suite scheitert; konkreten Befund gesondert entscheiden lassen.
7. Manueller enger Diff-/KB-/Secretreview, Versionsguards und Hunkprovenienz; historische Plaene/QA-Reports/Register unangetastet. Keine neuen Cosmos-Contract-, Mobile-, Rendererbild- oder Assetgates noetig, da ihre Eigentumsbereiche nicht geaendert werden. Bei unerwartetem Eingriff in diese Bereiche Scope neu freigeben.

Keine Gates wurden vom Planner erneut ausgefuehrt. Planartefaktpruefung ist keine Implementierungs- oder QA-Evidenz. Ein gruener synthetischer Fall belegt die begrenzte Korrektur, nicht das private Originalrezept. Eine spaetere echte Nutzerrezeptpruefung ist nur mit gesondert verfuegbarem privatem Input im autorisierten Testkontext moeglich, ohne ihn in Repository oder Telemetrie zu uebernehmen.

## 8. Recommended Execution Order

1. Nutzer gibt v15 ausdruecklich frei; PO-1 bleibt ohne gesonderte Entscheidung unberuehrt. Bis dahin nur dieses Planartefakt.
2. B-1: Ursprung abgrenzen und lokale gescheiterte Versuche gezielt zuruecknehmen.
3. B-2: Preparation-Sourcebindung, enger Fix, Regressionen und neue Pflichtgates.
4. D-1: tatsaechlichen Stand in betroffener KB berichtigen.
5. Q-1: unabhaengige Abnahme von Fix und Ruecknahmen; verbleibende allgemeine Findings getrennt ausweisen.
6. Erst nach erfolgreicher QA/Abnahme und Merge separat autorisierter Alpha-Deploy durch zustaendigen Releaseprozess. Kein Deployment in diesem Auftrag.
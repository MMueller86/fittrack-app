# PLAN_US-10: Export-Kurzfassung und technisches Serienreview v18

Status: Freigabeentwurf vom 2026-10-09; neues ausdrueckliches APPROVE fuer v18 erforderlich. v17 ist nicht freigegeben oder implementiert. Dieser Auftrag erstellt nur diesen Plan, keine Implementation, QA, KB-/Registryaenderung oder Deployment.
Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Auftrag und Produktentscheidung

Classification: Accept as proposed. Die Kurzfassung bleibt das Ziel; hinzu kommt ein unabhaengiges technisches Review des gesamten relevanten Aenderungsbestands der Korrekturserie, keine globale Projektbereinigung.

Verbindliche Nutzerklarstellung wortgetreu:
> Es war schon immer eine kurzfassung, ist es ja schlicht nich möglich, den selben inhalt, aber deutlich gekürzt wiederzuspiegeln. Die wichtigsten schritte, wie man das Rezept kocht, sollen enthalten sein. Also ja, eine kurze zusammenfassung, der nach den Vorgaben des Render Templates passt.

Zusaetzlicher Reviewauftrag wortgetreu:
> Bitte füge auch eine Überprüfung der Änderung mit ein, ich weiß nicht, ob man in den X Korrektur versuchen zuviel overengineering hat. Der STand soll sauber sein. Ein gesamtes Technischen review der Änderungen wäre meines erachten sinnvoll, um zu schauen, wo man etwas wieder vereinfachen kann, falls notwendig.

Der vollstaendig gelesene [v17-Entwurf](PLAN_US-10_Recipe-Export-Preparation_Kurzfassung_2026-10-09-v17.md) bleibt als historischer Entwurf unveraendert. v18 ersetzt nach Freigabe dessen Ausfuehrungsauftrag und uebernimmt den Kurzfassungsvertrag, die explizit begruendeten lokalen Ruecknahmen und Sicherheitsgrenzen. Keine v17-Freigabe wird aus diesem Reviewauftrag abgeleitet. Historische v12..v16-Vertraege und FAILs werden nicht rueckwirkend neu bewertet oder umgeschrieben.

Open Product Owner Decisions: Keine neue Produktfrage fuer den beschriebenen Kurzfassungsfix. Maximal statt exakt fuenf und die fixturebezogene Wichtigkeitsrubrik sind technische Vorschlaege zur neuen Planfreigabe, keine bereits umgesetzten Regeln. Noch unbekannte Vereinfachungsbefunde sind NICHT mitfreigegeben; Abschnitt 6 verlangt eine konkrete, endliche Findingentscheidung. Neue Fachregeln oder weitere Vertrags-/Architekturaenderungen benoetigen eine neue Planfreigabe.

## 2. Bestaetigter Stand und Evidenzgrenzen

Git-Basis: HEAD `b637ee5b59a4f72b7d822443680c1951a01f9dc4`, Recipe-Importprompt im Commit v11. Aktuell neun Backenddateien und fuenf KB-Dateien dirty; dazu das fremd zu erhaltende QA-Register und untracked Serienartefakte. Der HEAD-Worktree-Diff ist ein kumulierter Vergleich, kein B-16-Diff und kein eindeutiger v12/v13/v14-Ursprungsnachweis.

Workflowstand: B-16 und D-16 umgesetzt, unabhaengige Q-16 FAIL, kein Deployment. [Q-16](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md) belegt 294 fokussierte / 1407 normale Units und Typecheck/Build PASS, aber Preparation-, Import- und Gesamt-Live FAIL. Diese Zahlen sind historische Evidenz, keine heute ausgefuehrten Planner-Gates. Requestisolation ist belegt; hinreichende Vollerhaltwirkung, Modellursache oder Tokenmangel sind nicht belegt.

S/R-QA-Ausgabe: Source 1..8, Exportreferenzen 1..7, fuenf Texte mit 66/73/65/56/62 Zeichen, Handler 422, ein Call, Usage 0, unveraendertes Rezept. Fehlende mittlere Hitze, Abdeckung und Servieren waren unter v16 Fehler. Unter dem neuen Ziel sind Auslassungen frisch nach Kernrubrik zu pruefen; der alte FAIL bleibt bestehen. Korrekte IDs/Laengen belegen weder Kochqualitaet noch reale Renderpassung.

Historischer Nutzertrace: recipes-prepare-export-view, 422 um 12:48:42 UTC, operation_Id `a9f0b3adf10d2c4e2ab866d38d6b65ae`, gespeicherte 1..8, Export [1],[2],[3],[4],[6,7]. Privater Originaltext und deployed Revision fehlen. Synthetischer Test ist kein privater Replay, kein Alpha-/Shareerfolg.

[Register](../../qa/findings.md) FT-QA-2026-063..069 / VER-2026-015 nur lesen. FT-063/068 enthalten weiterhin echte Duplikat-/Reorder-/Leertextbefunde. FT-064/065/066 betreffen historische Semantik, Privacy und Suiteprobleme und gehoeren in die Serienabgrenzung. FT-069 ist ein fremder Daily-Insight-Pflichtgatefehler; dessen genaue Ursache teilweise UNVERIFIED. Kein automatischer Findingabschluss oder Registryedit.

### Repository-backed Quellen fuer das Serieninventar

- [v12-QA](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md), [v13-Plan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md), [v13-QA](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07-v13.md), [v14-Plan](PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-08-v14.md), [B-2-v14](B-2_Recipe-Analyze-v14_Handoff_2026-10-08.md): frueher Schrittverlustfix, Source-/Exporttrennung, Trace-, Semantik-, Privacy- und Testarbeit; nicht als separate Git-Snapshots ausgeben.
- [v15-Plan](PLAN_US-10_Recipe-Export-Preparation_Gezielte-Korrektur_2026-10-09-v15.md), [B-1-Handoff](B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md), [Ausgangsdiff](B-1_Recipe-Analyze-v15_Ausgangsdiff_2026-10-09.txt), [Enddiff](B-1_Recipe-Analyze-v15_Enddiff_2026-10-09.patch), [Ruecknahmediff](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch), [B-2-v15](B-2_Recipe-Preparation-v15_Handoff_2026-10-09.md): belegte Versuchsruecknahmen, Kontextbindung und verbleibende Importhunks. Ausgangs-/Enddiff sind kumuliert; Ruecknahmediff ist nachtraeglich abgeleitet, nicht historisch aufgezeichneter Editdiff.
- [v16-Plan](PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md), [B-16-Handoff](B-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [B-16-EigenerDiff](B-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch), [D-16-Handoff](D-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [D-16-EigenerDiff](D-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch), Q-16: exklusiver Preparationprompt, Liveharness und enger Fuenfdateien-KB-Abgleich mit eigener Hunkevidenz.
- Vollstaendiger v17-Entwurf und dieser v18-Plan: geplante Aenderungen gesondert erfassen, nicht als implementierte Hunks oder bestandene Tests.

Planner hat v17, B-1/B-2-v15/B-16/D-16-Handoffs, B-1-Diffs, B-16-/D-16-EigenerDiffs, Q-16 und relevante Registereintraege gelesen; v12..v14 und v15/v16 dienen zusaetzlich als referenzierte Reviewinputs, deren vollstaendige technische Abnahme hier nicht behauptet wird. Aktueller Diff von Validator, Preparationhandler und Client bestaetigt den kontrollierenden Pfad. Weitere hunkgenaue Zuordnung ist das geplante Review, keine bereits erledigte QA.

Herkunftsluecke: Ein eigenstaendiger v13-vor-v14-Snapshot fehlt fuer drei vermischte Import-Teilhunks (M-/Mehraktionszuordnung, description-/Wortabbruchregel, letzte JSON-Pruefregel). D-16s strikter Reverse-Kontextcheck scheiterte; exakter LF-Inhaltsvergleich und whitespace-toleranter Kontextcheck bestanden. Das beweist keine byteidentische historische Rekonstruktion. Fehlende Herkunft darf nicht durch Kopfstand v11 oder Hunkloeschung ersetzt werden.

## 3. Weitergeltender Kurzfassungsvertrag

1. Source-steps bleiben vollstaendige normale Rezeptbasis: explizit nummerierter Import 1:1/geordnet, nicht auf fuenf begrenzt. Preparation liefert gespeicherte order/title/description und Arrayreihenfolge unveraendert als JSON-Daten im Userkanal; fehlender title wird im bestehenden Provideroutput null. Kein neues Reextrahieren oder Rueckschreiben.
2. Export ist eine selektive deutsche Kochkurzfassung: 1..5 nichtleere Texte, jeweils <=90 Zeichen, lueckenlose Exportorders 1..K. Auch N<=5 darf verdichtet werden; kein exakt min(N,5), Padding, Abschneiden, Wortabbruch oder mechanisches first-five.
3. Jede sourceStepOrders-Liste ist nichtleer und enthaelt gueltige positive Originalorders. Abgeflacht bilden alle Referenzen eine eindeutige streng aufsteigende Teilfolge der geordneten Sourcebasis; Luecken innerhalb und zwischen Gruppen sind erlaubt. Unknown, Duplicate, Reorder und leere Referenzlisten bleiben ungueltig, Vollabdeckung entfällt.
4. Referenzen bezeichnen tatsaechlich zusammengefasste Quellhandlungen, nicht alle gelesenen Details. Keine IDs fuer weggelassene Schritte auffuellen. Eine Sourceorder verlangt nicht jedes Detail ihres Texts. Runtime prueft Struktur, Referenzen und Limits, keine universelle sprachliche Wichtigkeit/Aequivalenz.
5. Wesentlich sind zentrale Zubereitungs-/Garmethode der Hauptkomponente, eigenstaendige Zubereitung wesentlicher Beilage/Sauce und notwendige Uebergaenge zum fertigen Gericht. Quelle und Komponenten/Reihenfolge muessen nachvollziehbar bleiben. Keine neuen Zutaten, Methoden, Mengen, Zeiten oder Temperaturen; Weglassen ist nicht widerspruechliches Ersetzen.
6. Zeiten/Hitze/Ruhen/Abdeckung/Schnittform/Wuerzmittel/Servieren sind nicht pauschal Pflicht oder pauschal unwichtig. Behalten, wenn fuer die ausgewaehlte Kochphase entscheidend; sonst zugunsten des Budgets auslassbar. Keine Gar-/Sicherheitsklassifikation oder behauptete sichere Zubereitung aus der Kurzfassung.
7. Fixturebezogener Kern der unveraenderten synthetischen Haehnchen-Reis-Preparation: Haehnchen vorbereiten/schneiden, anbraten, Reis eigenstaendig kochen, Haehnchen fertig garen. Keine Pflicht zu separater Serviergruppe, Wuerfelform, Salz/Pfeffer, separatem Oelerhitzen, mittlerer Hitze, Salzwasser/Abgiessen oder zugedecktem Ruhen. Reisnennung ersetzt kein Kochen. Das ist keine allgemeine Rezepttaxonomie oder Goldenformulierung.
8. MIN_STEPS=1 auch in beiden bestehenden AI-Zod-Exportlisten ausdruecklich anwenden; derzeit nur max(5). Ohne Kochbasis kontrolliertes 422 statt erfundener Anweisung/Order; kein neuer Fallback.

Renderer unveraendert: Shared-Limits 1..5/90, Teaser 96, reale Breiten-/Hoehengates, Produktionsfonts, 1080x1350; bestehender Wechsel grosse Darstellung 1..4 / kompakt 5. Zeichenlimit garantiert keine Renderpassung. [US-10](US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md) AC-15 verlangt hoechstens fuenf, AC-16 formuliert zugleich starke Inhaltserhaltung. Die ausdrueckliche Nutzerklarstellung hat nach neuer Freigabe Vorrang fuer die Exportauslegung; Sourceerhaltung bleibt. Genehmigte Story und historische QA unveraendert, spaeter nur betroffene KB nachziehen.

## 4. Technischer Fix und bereits konkret begruendete Vereinfachungen

Lokale falsifizierbare Hypothese: validateExportStepTrace vergleicht derzeit flattenedSourceOrders exakt mit allen Sourceorders; dadurch wird eine gueltige selektive Kurzfassung allein wegen fehlender Servierorder mit 422 abgewiesen. Gueltiger Teiltrace entfernt diesen Ablehnungsgrund, beweist aber keine Kochqualitaet.

Billiger Check nach Freigabe: im bestehenden Validator-/Handlertest dieselbe synthetische Kurzfassung ohne Servierorder als Regression; aktueller Code scheitert an Coverage, korrigierter Code akzeptiert. Duplicate/Unknown/Reorder bleiben negativ. Kein Livecall fuer dieses Red/Green erforderlich.

| ID | Vorgegebene Aktion / Ort | Herkunft und begrenzte Begruendung |
|---|---|---|
| K-1 | Vereinfachen: validateExportStepTrace in backend/src/lib/recipeAnalyzeValidation.ts auf Mitgliedschaft plus globale Eindeutigkeit/strenge Reihenfolge umstellen; Source-/Exportordnungschecks behalten, MIN_STEPS ausdruecklich verwenden. | Bestehende Vollpartition widerspricht Abschnitt 3; wirkt auf Importexport und Preparation, nicht Sourceextraktion. Neue stabile Codes duplicate_export_source_reference / export_source_trace_not_ascending; lokale Unknown-/Ascendingcodes erhalten. Keine Mutation/IDreparatur. |
| K-2 | Entfernen: nur coverage-only sourceStepTrace, Mismatchaufbereitung und exklusiv ungenutzte boundedOrderSequence/sourceTraceDiagnosticLogFields in recipes.ts samt ausschliesslichen Coverageassertions. | Aktueller HEAD-Diff/B-1-Privacyarbeit belegen diesen Diagnosepfad. Numerische Vollcoverage hat keinen neuen Fehlerauftrag; generische begrenzte phase/code/path-Diagnose und Datenschutztests bleiben, echte Referenzfehler loesen sie aus. Verwendung vor Loeschung pruefen. |
| K-3 | Vereinfachen: Exportbloecke beider Prompts im bestehenden recipeAnalyze.ts; exact-M/Vollpartition/ALL-details-Packplanung und Wiederholungen durch Abschnitt 3 ersetzen. Import v16 / Preparation v3 und passende eigene Guards. | B-1/B-16-Diffs belegen die konkurrierenden Regeln. Kein neues Promptframework, keine neue Datei oder gemeinsame Generalabstraktion nur fuer zwei Texte. Nicht-Export-Importregeln erhalten; isolierten Preparationprompt nicht zurueck auf Importaddendum bauen. |
| K-4 | Vereinfachen: bestehende Export-Detailverlusttests/-constraints auf wenige aussagekraeftige Kern-/Widerspruchsfaelle umstellen; Sourceassertions separat voll erhalten. | B-2-v14/v15 und B-16 dokumentieren Detailbatterie und blanket-Kopie der Sourcepatterns. Nur nach neuem Ziel ungueltige Erwartungen ersetzen, nicht Sicherheit oder Regressionen ausduennen. Entfernte Tests mit Zweck/Nachfolger/gleichwertiger Abdeckung dokumentieren; keine feste Reduktionsquote. |
| K-5 | Behalten: optionaler PreparationContext, JSON-Projektion, exklusiver Promptzweig, gespeicherte Validierungsbasis, voller AiRecipeRaw-/Strict-Providervertrag. | B-2-v15/B-16 belegen kleine Ownershiploesung. Ueberfluessige Pflichtfelder/Promptduplikation werden reviewed, aber kein export-only Schema oder neuer Providervertrag vorab autorisiert. Modell, 0.2/2048, ein Call erhalten. |
| K-6 | Behalten und pruefen: bestehender realer Handler-/Client-/Provider-Liveharness und test-only Semantikhelper. | B-16/B-2 belegen Nutzen fuer Request, Quota, V2 und no writes. Matrix nur auf neue Kernrubrik ausrichten. Weitere strukturelle Vereinfachung nur nach konkretem Findingentscheid, nicht automatisch Spies/Assertions entfernen. |
| K-7 | Behalten: B-1-Ruecknahmen, Wordabbruch-/Keine-Erfindungsschutz, Ingredient-/Whitelist-/Save-/Sharevertrag, Auth/ETag/Quota/Privacy/Transienz. | Keine Wiederholung von Temperatur-0-Ruecknahme; keine neue Klassifikation/Frontend-/Sharedimplementierung. Drei ungeklaerte Importhunks nur hinsichtlich ausdruecklich genehmigter neuer Exportsemantik aendern, niemals als rekonstruierter v13-Restore. |
| K-8 | Vereinfachen/angleichen: nur fuenf D-16-KB-Dateien nach tatsaechlichem neuem Code aktualisieren. | Eigener D-16-Diff grenzt betroffene Recipe-Aussagen ein. Aktuelle Versionen, max/Teiltrace, Quell-/Exporttrennung und Evidenzgrenzen konsistent, alte FAILs bleiben Geschichte. Keine neue Dokuablagestruktur. |

Explizite Vertragsaenderung zur Freigabe: sourceStepOrders bedeutet referenzierte Auswahl statt Vollpartition; erlaubte Auslassung nicht mehr coverage-bedingtes 422. Keine Route/Methode/Body-/DTO-Shapeaenderung, Strict JSON-Schema/maxItems/maxLength unveraendert. V2 und Shared RecipeExportStep bleiben order/description ohne Trace; keine neuen Savechecks oder Promptversionspersistenz.

AI Assessment: Bestehende KI fuer sprachliche Auswahl/Verdichtung sinnvoll; keine belegte universelle deterministische Wichtigkeitsregel. Ergebnis advisory und transient, Nutzerreview/Bestaetigung erhalten. AiFeature recipe-analyze, ein Call; Auth/404/400/412 unveraendert, 429 vor Call, Recipe-Provider-/Leer-/Parsefehler 502, echte Struktur-/Referenz-/Limitfehler 422 ohne Usage, Erfolg Usage einmal. Die generische Skill-Fehlertabelle nennt teils 500; fuer diese bestehenden Recipehandler gilt der repository-backed 502-Vertrag. Kein neuer Retry/Fallback/Packer/Semantikklassifikator, keine Dependencies.

Persistence Impact: None; keine Dokument-/Repository-/Container-/Partition-/Migrationsaenderung, keine Cosmos-Promptversionsfelder fuer transiente Ergebnisse. Dev bestehendes lokales Setup, Alpha erst nach bestandenen Gates/Merge separat beauftragter Backendrelease, keine neuen Ressourcen oder Mobile-/Nativebuilds.

## 5. Unabhaengiges Reviewgate fuer die gesamte Serie

Owner QA: passend wegen bestehendem technischen Reviewauftrag, AI-Checklist und durablem Berichtvertrag; separater Durchlauf, nicht Implementierungsagent/Selbstabnahme. QA vereinfacht keinen Produktionscode und repariert keine Prompt-Evals. Das Review startet vor B-18, um Herkunft und Zweck einmal festzuhalten und unnoetige neue Arbeit zu vermeiden. Nach B-18/D-18 prueft QA den gesamten resultierenden Serienbestand erneut, nicht nur den neuen Diff.

### Inventar und Vollstaendigkeitsnachweis

Q-18R erfasst lesend aktuelle HEAD-ID, git status --short, tracked/staged/unstaged/untracked-relevante Diffs und Handoffevidenz. Ausgangsstand mit Dateien, Blob-/Dateihashes und passenden Hunkpositionen einfrieren; nur relevante Serienartefakte, keine neue globale 800-Dateien-Hashpipeline als Feature. Vorgegebene Reviewoberflaeche:

- backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts, recipeAnalyze.eval.fixtures.ts: beide Prompts, Versionsguards, Source-/Exportconstraints, Semantikhelper, Fixtures und Liveharness.
- backend/src/lib/recipeAnalyzeValidation.ts und recipeAnalyzeValidation.test.ts: Struktur-/Tracechecks, Diagnostics und alle serienbezogenen Offlinepositiv-/Mutationstests.
- backend/src/lib/openai.ts, backend/src/functions/recipes.ts und recipes.test.ts, backend/src/functions/ai.test.ts; ai.ts als angrenzender unveraenderter owning Importpfad. Client-/Providervertrag, Contextbuilder, gespeicherte Basis, Fehler-/Usage-/Privacytests.
- docs/kb/domain/06-recipes.md, 07-ai-features.md; docs/kb/tech/02-backend.md, 06-ai-integrations.md, 09-api-reference.md: nur serienbezogene Aussagen und Referenzen. Handoff-/Diff-/Testhilfen aus Abschnitt 2, einschliesslich nachtraeglicher Rekonstruktion; keine Historienbereinigung.
- backend/src/test-utils/http.ts, backend/package.json, vitest.config.mts, vitest.eval.config.mts, scripts/run-eval.mjs und Renderer-/Shared-/Savevertraege nur als Boundary-/Coveragekontext. Erweiterung des Inventars nur, wenn ein weiterer konkreter Serienhunk durch Diff/Handoff nachgewiesen ist; fremde Daily-/Rendererlayoutarbeit nicht aufnehmen.

Pro Datei alle relevanten logischen Hunks der kumulierten Serie inventarisieren, nicht nur Git-Hunkheader zaehlen. Relevanter unzugeordneter Hunk wird ebenfalls aufgenommen, mit Herkunft Ungeklaert; fremde/nichtserielle Hunks separat explizit ausgeschlossen. Erfasste Hunks gegen aktuelle Diffs abgleichen; historische Ruecknahmen und nur geplante v17/v18-Regeln als solche markieren. Keine pauschale Annahme, jede dirty Zeile sei Serienarbeit.

Jede Inventarzeile enthaelt: stabile ID; workspace-relativer Pfad und aktuelle Zeilenposition/Symbol; Hunk-/Artefaktanker und Zeitpunkt/Basis; Zustand implementiert/zurueckgenommen/geplant; Herkunft belegte Serie/fremd/ungeklaert samt konkretem Beleg; urspruenglicher Zweck; heutiger Nutzen unter Abschnitt 3; Entscheidungsvorschlag Behalten / Vereinfachen / Entfernen / Ungeklaert; konkrete Empfehlung und Alternative; Criticality plus Aenderungs-/Regressionsrisiko; genau einen Owner; Abdeckungsnachweis/Nachfolger; offene Frage und vorgesehenen Gatecheck. Auch Behalten und Kein Befund muessen begruendet sein. Herkunft und technische Bewertung getrennt: erkennbare Zielwidrigkeit beweist keine historische Urheberschaft.

### Verpflichtende Reviewaspekte

1. Ownership und Abstraktionen: Ist Verhalten beim passenden Handler/Validator/Client? Hat jeder Contextbuilder/helper einen notwendigen Auftrag und echte Nutzung? Kein generisches Modussystem/Service nur als neue Verpackung.
2. Providervertrag und Promptduplikation: bestehende volle Strict-Shape versus ungenutzte Preparationfelder; notwendige Kompatibilitaet von ueberfluessigen Anweisungen unterscheiden, Widersprueche/Wiederholungen benennen. Schemaaufspaltung nur als ausserhalb Scope liegende Empfehlung, nicht implementieren.
3. Validierungskomplexitaet: Sourceidentitaet getrennt von Exportteiltrace; redundante Schleifen/Diagnoseaufbereitung und unerreichbare Pfade nur mit Nutzungsevidenz bewerten. Schutz gegen echte Fehler nicht entfernen, keine regexbasierte universelle Kochsemantik einbauen.
4. Unrealistische Semantikgarantien: Vollreferenz, 200 oder ein Live-PASS beweisen keine Wichtigkeit/Inhaltstreue/Stabilitaet. Promptintent, deterministic checks, fixturebezogene Qualitaetsrubrik und Nutzerreview klar auseinanderhalten.
5. Testanzahl versus Signal: fuer jede Batterie belegen, welchen unterschiedlichen Fehler sie faengt. Zielwidrige All-details-/Servierpflicht ersetzen; Sourceverlust, Widerspruch/Swap, Unknown/Duplicate/Reorder, Limits, Auth/ETag/Quota/Usage/no writes/Privacy erhalten oder gleichwertig abdecken.
6. Fixture-/Evalharnesskomplexitaet: Vitest-Assertionen im Fixturemodul, wiederholte Muster/Matrizen, delegierende SDK-Spies, Boundarysetup und fail-fast-Verdeckung pruefen. Test-only helper nicht in Runtime verschieben; keine neue Frameworkabstraktion, selektive Ersatzlaeufe oder erneute riesige Detailmatrix.
7. Debug/Privacy: saemtliche log/warn/error-Argumente einschliesslich verschachtelter Werte, Request-/Provider-/Fehlertexte, IDs und Testevidenz betrachten. Nur synthetische Rohdaten im Bericht; generische sichere Diagnosen nicht durch Inhaltslogs ersetzen.
8. Doku-/Versionskonsistenz: Import v15/Preparation v2 Iststand gegen geplantes v16/v3, Guards und KB; Planrevision v18 ist kein Promptversionsname. Historische Dokumente behalten Datums-/Vertragskontext und FAIL/UNVERIFIED, keine Rueckdatierung zu Erfolg.

## 6. Endlicher Finding-Decisionflow, keine Refactoringvollmacht

1. Nach ausdruecklicher v18-Freigabe Q-18R: einmal vollstaendiges Inventar und technische Empfehlungen, keine Produktionssimplifizierung oder neue Live-Promptserie. Fehlende Evidenz offen erfassen; keine unendliche Provenienzrekonstruktion.
2. K-1..K-8 sind mit v18-Freigabe konkret vorab autorisierbar. Reviewer prueft sie gegen die Evidence; widerlegt er eine Schutz-/Vertragsannahme, genau diesen Teil stoppen und zum Planner zurueckgeben. Bekannter aktueller Feature-/Live-FAIL ist kein Verbot des freigegebenen Korrekturschritts und kein Review-PASS.
3. Weitere Vereinfachungen: Planner erstellt einmal ein begrenztes Decisionartefakt unter docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Reviewentscheid_2026-10-09-v18.md. Je Finding ID, Dateiposition/Hunks, Aktion oder begruendetes Behalten/No-op, Invarianten, Risiko, gleichwertige Testabdeckung, Backendowner und Checks. Nutzer genehmigt ausdruecklich nur diese konkrete Liste; Schweigen/Reviewempfehlung/APPROVE des heutigen Plans genehmigt keine unbekannten Edits.
4. Kein belegter Overengineeringbefund ueber K-1..K-8 hinaus: dokumentierter No-op, keine Zusatzvereinfachung und kein B-18C/D-18C/Q-18C. Bei begruendetem Behalten keine willkuerliche Zeilen-/Test-/Dateireduktionsquote. Ungeklaerte Hunks unveraendert lassen; Review kann dennoch vollstaendig sein, ohne Herkunft als geklaert auszugeben.
5. B-18 fuehrt den Kurzfassungsfix und nur vorab genehmigte Zusatzliste aus; danach D-18 und unabhaengige Q-18A. QA darf weder simplifizieren noch ihre eigenen Findings selbst als behoben abnehmen. Vorschlaege ohne Entscheidung bleiben sichtbar, blockierende echte Defekte nicht als optional ablegen.
6. Zeigt Q-18A eine nicht vollzogene genehmigte Vereinfachung oder dadurch verursachte lokale Regression, maximal EIN begrenzter Korrekturdurchlauf B-18C -> D-18C -> Q-18C. Orchestrator liefert genaue Findingliste innerhalb desselben genehmigten Vertrags; neuer Vorschlag braucht neue konkrete Freigabe. Keine neue Promptnachbesserungsserie oder allgemeine Importstabilisierung in dieser Schleife.
7. Weitere/ausserhalb Scope liegende Befunde oder erneut FAIL nach diesem Durchlauf: Befundhandoff und Stop, neuer Auftrag/Planfreigabe statt weiterer Korrekturrunden. PASS WITH ISSUES erlaubt keine automatische Akzeptanz von Vorschlaegen. Kein Abschluss/Merge/Release bei ausgefuehrtem fehlgeschlagenem Pflichtgate.

Sauber bedeutet: zugeordneter und konsistenter Serienstand, keine unbegruendete Restkomplexitaet in genehmigten Hunks, dokumentierte Entscheidungen, erhaltene Schutz-/Regressionsabdeckung und ehrliche offene Punkte. Es bedeutet weder clean git status im fremden Dirtyworktree noch kuenstliches Gruen durch Assertionverlust, Skips oder umgedeutete FAILs.

## 7. Akzeptanzkriterien

1. **AC-1 Teiltrace:** Beide Runtimevalidators akzeptieren gueltige geordnete eindeutige Teilreferenzen mit Luecken innerhalb/zwischen Gruppen bei 1..5 Texten. Regression ohne Servierorder ist vorhanden und besteht; Sourceunique/ascending, Exportcontiguous, Duplicate innerhalb/zwischen Gruppen, Unknown, Reorder und leere Referenzen werden weiterhin geprueft, ohne Mutation.
2. **AC-2 Templategrenzen:** 1/4/5 Texte und 90 Zeichen gueltig, 0/6 und 91/Leertext ungueltig; keine exact-min-Assertion/Padding. Reale bestehende Renderer-/Fontmessung fuer eine synthetische Kurzfassung und 1080x1350 bestehen, Layout-/Asset-/Overflowgates unveraendert.
3. **AC-3 Kochkern:** Unveraenderte gespeicherte Haehnchen-Reis-Fixture erfuellt Abschnitt 3.7 ohne feste Formulierung/Gruppierung. Erlaubte Detail-/Servierauslassung positiv; fehlendes Reiskochen qualitativ negativ, nicht universeller Runtimefehler.
4. **AC-4 Kein Scheinfix:** Gueltige IDs plus fehlende Kernhandlung, falsche Komponente, vertauschter Kochtext oder erfundene numerische Temperatur bestehen die fixturebezogene Inhaltsrubrik nicht. Erhaltene Aussagen stimmen mit Source ueberein; kein pauschales Numeric-temperature-Verbot fuer Quellen, die solche Werte tatsaechlich enthalten.
5. **AC-5 Quell-/Prompttrennung:** Import v16 / Preparation v3 und Guards konsistent, beide Exportregeln aus Abschnitt 3. Preparation exklusiv/JSON/unveraenderte gespeicherte Quelle; nummerierter Import vollstaendig 1:1. Nicht-Export-Zutaten-/Kategorien-/Mengen-/Keyregeln, Freitextinput und Wordabbruchschutz erhalten; exact-M/Vollpartition/Vollerhalt-Packstrategie weg.
6. **AC-6 Schutzinvarianten:** Auth/Ownership, optionales exaktes ETag vor Quota, 429/502/echte 422, Strict/ein Call/Usage nur nach Erfolg, V2 Text-only, no writes, Nutzerbestaetigung und Save-/Share-/Fingerprintvertrag erhalten. Privacytests pruefen alle Loggerargumente bei echten Fehlern; keine privaten Texte, Secrets oder IDreparatur.
7. **AC-7 Hunkbewahrung:** Eigene Vorher-/Nachherdiffs und Hunkmatrix weisen jeden Edit K-ID oder ausdruecklich genehmigter Finding-ID zu. Fremde Arbeit, Historie und B-1-Ruecknahmen erhalten; ungeklaerte Herkunft nicht durch Restore/Revert/Hunkloeschung gelöst. Neue Exportsemantik ist neue Autorisation, kein behaupteter v13-Restore.
8. **AC-8 Gates:** Fokussierte Units, reale Preparationprobe (200/V2/ein Usage/no writes), Recipeeval, normale Vollsuite, Typecheck/Build, Diff und Gesamt-Live neu ausgefuehrt, Commands/Exitcodes getrennt. Nur genehmigte neue Kurzfassungsassertions ersetzen alte Vollerhaltregeln; echte Fehler FAIL. Credentials/Exit 2/Skips/fehlende Evidence UNVERIFIED, nie PASS; offenes Pflichtgate kein Abschluss/Merge/Release.
9. **AC-9 Doku/Abnahme:** Fuenf betroffene KB-Dateien beschreiben tatsaechlichen Vertrag/Versionen und Runtimequalitaetsgrenze. Unabhaengige QA prueft kompletten finalen Serienbestand und US-10 AC-15/16 nach genehmigter Klarstellung; alte FAILs/Registry unveraendert, kein Alpha-/Privatreplay-/Shareerfolg aus Synthetik.
10. **AC-10 Reviewvollstaendigkeit:** Dauerhafter Q-18R-Bericht enthaelt alle Oberflaechen aus Abschnitt 5 und alle acht Reviewaspekte, Inventar mit begruendetem Behalten/Vereinfachen/Entfernen/Ungeklaert. Jede ausgeschlossene Oberflaeche nennt einen Beleg; kein Review nur des letzten Prompts oder Chatlisten.
11. **AC-11 Herkunft:** Jeder relevante logische Hunk und jede geplante Regel hat stabilen Inventaranker und getrennte Herkunfts-/Nutzenbewertung. Kumulierte HEAD-Diffs nicht als eigene Diffs ausgeben; drei offene Importhunks, fehlender Zwischenstand und LF-/Bytegrenzen ausdruecklich erfasst, fremde Hunks ausgeschlossen/bewahrt.
12. **AC-12 Entscheidungsgrenze:** Jede Empfehlung nennt Dateiposition/Symbol, Criticality, Risiko, konkreten Owner, Alternative, Folgechecks und Testabdeckung. Ueber K-1..K-8 hinaus kein Edit ohne freigegebene endliche Findingliste; keine Befunde bedeutet belegter No-op. Shape-/Architektur-/Produkt-/Scopeexpansion stoppt fuer neue Planfreigabe.
13. **AC-13 Vereinfachung und erneute QA:** Genehmigte notwendige Vereinfachungen sind implementiert und gegen ihre Risiken getestet; entfernte Tests haben dokumentierte gleichwertige Abdeckung oder zielbedingt entfallenen Zweck. QA fuehrt keine Produktionssimplifizierung aus und nimmt nicht selbst ab. Jeder B-18C-Edit folgt mit Dokuabgleich und neuer unabhaengiger Q-18C; maximal ein Folgezyklus.
14. **AC-14 Sauberer Abschluss:** Finales Inventar gleicht Q-18R-Basis mit finalem Serienstand ab, jede Empfehlung hat begruendete Disposition/Evidence, keine unerledigte genehmigte Pflichtvereinfachung oder unbegruendete neue Hilfsschicht. Offene Herkunft, externe Gates und manuelle Grenzen sind mit Owner/naechster benoetigter Entscheidung sichtbar; kein pauschales 'alles sauber', kein Registryabschluss oder Release bei echten offenen Blockingbefunden.

## 8. Teststrategie und Berichtvertrag

Alle Befehle hier sind Auftraege nach neuer Freigabe, keine heutigen Planner-Tests. Bestehende Dateien/Helper wiederverwenden. Quellen/Inputs der acht Importfixtures und gespeicherten Preparationfixture unveraendert; nur genehmigte Exportconstraints anpassen. Vollstaendige Sourceextraktionsrubrik getrennt behalten. Kleine Positiv-/Negativmenge nach AC-1..6 statt neue Detailbatterie/Goldenformulierung.

- Backend direkt nach erster Validatoraenderung: `npx vitest run src/lib/recipeAnalyzeValidation.test.ts`; danach Handler-/Clientslice `npx vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts src/lib/recipeValidation.test.ts`.
- Exakter historischer numerischer Teiltrace [1],[2],[3],[4],[6,7] bei 1..8 strukturell erlaubt; synthetischer Text ohne Reiskochen qualitativ negativ. Modellsource darf gespeicherte Basis nicht ersetzen. Privaten Originalinhalt nicht rekonstruieren.
- Bestehender Rendercheck `npx vitest run src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`; geeigneten vorhandenen Fall nutzen, ansonsten hoechstens eine Kurzfassungsprobe mit Produktionsrenderer/fonts, kein Rendererlayoutedit.
- Ein vorab festgelegter Preparationlauf ueber echten Handler/Client/Provider: `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"`. Dann separat `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts`, danach `npm run test:eval`. Kein Dreier-Vollerhaltnachweis mehr, kein retry-until-green oder zweiter Call pro Request; Stichprobe keine Zuverlaessigkeitsgarantie. Bei FAIL vollstaendigen Befund liefern, keine spontane Promptserie.
- Abschlussgates im backend: `npx vitest run`, `npm run typecheck`, `npm run build:verify`; Root `git diff --check`. QA fuehrt erforderliche Gates selbst aus, keine Handoffzahlen als eigene Evidence. Bei spaeterem B-18C alle betroffenen Fokus-/Pflichtgates erneut, Prompt-/Schemaaenderung immer Gesamt-Live. Unveraenderte Daily-/Runner-/Timeoutgates nicht lockern; fremde Fehler separat beauftragen.

### Durable Reports und Phasegrenzen

Orchestrator liefert den exakten workspace-relativen Reportpfad aus dem jeweiligen Paket. Jeder QA-Bericht nach [fittrack-qa-v1](../../qa/reports/README.md): Format, genau EIN Verdict PASS / PASS WITH ISSUES / FAIL, Scope, komplette AC-1..14-Matrix je ID genau einmal mit Result/Evidence, US-10 AC-15/16 gesondert, eigene relevante Commands/Exitcodes/Result, Findings oder ausdruecklich 'No actionable findings.', Verification Notes/Limits getrennt. Jeder Findingblock: Finding key, Plan reference, Acceptance criterion, Description, Criticality (Blocking / Non-blocking / Suggestion), Owner, Evidence, Recommendation; zusaetzlich konkrete Dateiposition/Symbol, Risiko und Inventar-ID. Manifest nichtleer: `QA report: <exakter Pfad>` und `Verdict: <ein Verdict>`.

Q-18R ist technische Vorpruefung, keine Implementierungsabnahme: AC-1..9/13/14, soweit noch nicht implementiert, ausdruecklich NOT IMPLEMENTED / NOT YET VERIFIED mit Phasenbegruendung; weder PASS noch Umweltlimit vortaeuschen. Nach QA-Vertrag fehlende Implementation ergibt FAIL fuer Gesamtbereitschaft. Separat `Review gate: READY | BLOCKED` fuer vollstaendiges AC-10..12-Inventar/keine unbehandelte Planinvaliditaet. READY trotz erwarteten Feature-FAIL autorisiert allein die freigegebene Korrektur, nie Abschluss/Merge/Release; fehlendes Inventar oder Scope-/Schutzkonflikt BLOCKED. Kein zweites Verdict.

Q-18A/Q-18C bewerten alle ACs am tatsaechlichen finalen Stand; Inventar/Disposition integriert im dauerhaften Report. Umgebungs-/Toollimits nach QA-Regeln ausserhalb actionable Findings: UNVERIFIED/MANUAL VALIDATION REQUIRED mit Voraussetzungen, Schritten, Erwartung und offenem Resultfeld; sie allein senken nicht den Verdict, ersetzen aber keinen verifizierten Live-/Releasebeleg. Echte ausgefuehrte FAILs bleiben Blocking, kein Slice-PASS als Gesamt-PASS.

Bericht und Inventar verwenden nur Repositoryevidenz, keine externen Sitzungs-/Tempdateien, privaten Original-/Providertexte oder Secrets. Q-18R-Historie unveraendert, Q-18A und bedingte Q-18C eigene Folgepfade. Bei Wiederholung eines Reports mit gleichem Pfad nur nach expliziter Orchestratorvorgabe; kein Ueberschreiben alter v12..v16-Berichte.

## 9. Ausfuehrbare Agentpakete

### Q-18R - Unabhaengiges Gesamtinventar vor dem Fix
Agent: QA
Goal: Einmal den gesamten relevanten Serienbestand seit urspruenglichem Schrittverlustfix einschliesslich v12..v16 und geplanter v17/v18-Regeln nach Abschnitten 2/5 reviewen; dauerhaftes hunkbezogenes Inventar und praezise Empfehlungen, keine Implementation. Read-only Historie/Diffs pruefen, bekannte FAILs und Herkunftsluecken erhalten. Keine neue Live-Promptserie fuer diese Vorpruefung.
Required Knowledge Base: docs/kb/tech/01-system-overview.md; docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md (Recipe Analyzer); docs/kb/tech/02-backend.md (Preparationdiagnose); docs/kb/tech/06-ai-integrations.md (Recipe Analyzer); docs/kb/tech/09-api-reference.md (Analyze/Preparation/Save/Share); docs/kb/tech/08-testing.md.
Required Repository Context: Dieser volle v18-Plan und v17; alle in Abschnitt 2 verlinkten Serienplaene, Handoffs, eigenen/kumulierten Diffs und QA-Berichte; saemtliche konkret in Abschnitt 5 genannten Code-/Test-/KB-/Boundarydateien; docs/qa/reports/README.md; .github/instructions/qa.instructions.md; US-10 aus Abschnitt 3; docs/qa/findings.md nur FT-063..069/VER-015. Diffs von HEAD/Index/Worktree und relevante untracked Artefakte als Eingangsbestand.
Required Skills: azure-openai-feature-integration (Section 6 und references/implementation-checklist.md).
Relevant Acceptance Criteria: AC-10..12, AC-7; Gesamtmatrix AC-1..14 und US-10 AC-15/16 mit Vorpruefungsstatus nach Abschnitt 8.
Dependencies: Neues ausdrueckliches v18-APPROVE; Orchestrator liefert Originalstory, diesen Plan, handoff_store/ausgefuehrte und nicht ausgefuehrte Pakete, bekannte Limits und exakten Pfad.
Expected Handoff: docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Vorreview.md, fittrack-qa-v1 plus Serieninventar/Abgrenzung/Hunkbasis, ein Verdict, Review gate READY/BLOCKED, Empfehlungen nach Abschnitt 5, nichtleeres Report/Verdictmanifest. Fehlende Herkunft benennen, kein Registeredit/Feature-PASS.
Recommended Execution Order: 1 nach Freigabe, danach Findingentscheid nach Abschnitt 6; vor B-18.

### B-18 - Kurzfassungsfix und konkret freigegebene Vereinfachungen
Agent: Backend
Goal: K-1..K-8 im vorab geprueften Bestand implementieren; zusaetzlich nur explizit genehmigte endliche Q-18R-Findingliste. Eigene Ausgangs-/Endhunks sichern, Red/Green Teiltrace zuerst, danach Prompts/Tests und jeweilige fokussierte Validation. Keine ungeklaerte Hunkloeschung, neue Framework-/Schemaarchitektur oder Dailyarbeit.
Required Knowledge Base: docs/kb/tech/01-system-overview.md; docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md (Recipe Analyzer); docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md (betroffene Vertraege); docs/kb/tech/08-testing.md.
Required Repository Context: Voller v18-Plan; Q-18R-Report/Inventar; freigegebenes Decisionartefakt aus Abschnitt 6 oder dokumentierter No-op; B-1-/B-2-v15-/B-16-/D-16-Handoffs/Diffs und Q-16 aus Abschnitt 2. backend/src/lib/recipeAnalyzeValidation.ts/.test.ts; backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts, recipeAnalyze.eval.fixtures.ts; backend/src/lib/openai.ts; backend/src/functions/recipes.ts/recipes.test.ts, ai.ts/ai.test.ts; backend/src/lib/recipeValidation.ts/.test.ts; shared/types/recipeExport.ts und recipes.ts; backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts und __tests__/recipeDetailsTemplate.test.ts; backend/src/test-utils/http.ts; backend/package.json, vitest.config.mts, vitest.eval.config.mts, scripts/run-eval.mjs.
Required Skills: azure-openai-feature-integration.
Relevant Acceptance Criteria: AC-1..8, AC-11..13; AC-9/14 fuer Handoff.
Dependencies: v18-APPROVE; vollstaendiges Q-18R mit Review gate READY; Entscheidung ueber weitere Findings vor deren Edit. Widerlegte K-Annahme blockiert nur betroffenen Teil bis Plannerklaerung; kein Paketabschluss bei FAIL.
Expected Handoff: docs/User Stories/Reciepe/B-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md plus eigener Diff, Mapping Edit->K-/genehmigte Finding-ID, Versionsguards, Testentfernungs-/Ersatzmatrix, Red/Green und alle Commands/Exitcodes, synthetischer Raw-/Kern-/Call-/Status-/Usage-/No-writebeleg, offene FAIL/UNVERIFIED. Kein QA-/Registry-/Deploymentabschluss.
Recommended Execution Order: 2 nach Q-18R/Findingentscheid, dann D-18.

### D-18 - Konsistenter enger KB-Abgleich
Agent: Backend
Goal: Nur tatsaechlich geaenderte Recipepassagen der fuenf D-16-KB-Dateien an Teiltrace/max/Kochkern, Import v16/Preparation v3, Source-/Exporttrennung und verbleibende Diagnose-/Qualitaetsgrenzen angleichen. Genehmigte Zusatzvereinfachung dokumentieren, wenn sie diese Aussagen betrifft; kein historischer FAIL-Rewrite.
Required Knowledge Base: docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md; docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md.
Required Repository Context: Voller v18-Plan; Q-18R-Inventar und konkreter Findingentscheid; B-18-Handoff/eigener Diff; D-16-Handoff/EigenerDiff; backend/src/lib/recipeAnalyzeValidation.ts, openai.ts, prompts/recipeAnalyze.ts; backend/src/functions/recipes.ts und ai.ts; backend/src/lib/recipeValidation.ts; shared/types/recipes.ts.
Required Skills: azure-openai-feature-integration.
Relevant Acceptance Criteria: AC-9, AC-14; AC-5/6/11 fuer Versions-/Vertragsabgleich.
Dependencies: Vollstaendiger B-18-Handoff; auch bei FAIL nur tatsaechlichen Code und offene Gates dokumentieren.
Expected Handoff: docs/User Stories/Reciepe/D-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md und eigener enger KB-Diff mit Inventar-ID-Bezug/Versionsabgleich, offene Gates an QA. Keine Story-/Registry-/historischen Reportedits.
Recommended Execution Order: 3 nach B-18, vor dokumentationspruefender Q-18A.

### Q-18A - Unabhaengige Abnahme von Fix und gesamtem Serienstand
Agent: QA
Goal: Alle ACs selbst gegen Code/Tests/KB und den kompletten verbleibenden Serienbestand pruefen, Inventar Q-18R->Endstand abgleichen, genehmigte Vereinfachungen und erhaltene Schutzabdeckung kontrollieren. Pflichtgates selbst ausfuehren; erlaubte Auslassungen von Kernverlust/Widerspruch/echten Strukturfehlern unterscheiden. Keine Implementation oder Selbstabnahme.
Required Knowledge Base: docs/kb/tech/01-system-overview.md; docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md; docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md; docs/kb/tech/08-testing.md.
Required Repository Context: Voller freigegebener v18-Plan, Q-18R und freigegebene Findingliste/No-op, B-18-/D-18-Handoffs/eigene Diffs; alle Serienartefakte aus Abschnitt 2 fuer nicht erledigte Herkunftsfragen; alle in Abschnitt 5 benannten Code-/Test-/KB-/Boundarydateien. US-10 aus Abschnitt 3; docs/qa/reports/README.md; .github/instructions/qa.instructions.md; docs/qa/findings.md nur FT-063..069/VER-015 read-only.
Required Skills: azure-openai-feature-integration (Section 6 und references/implementation-checklist.md).
Relevant Acceptance Criteria: AC-1..14; US-10 AC-15/16 mit genehmigter Kurzfassungsauslegung, AC-13/14/17 nur unveraenderte Templategrenzen.
Dependencies: Vollstaendige B-18-/D-18-Handoffs und Q-18R/Decisionevidenz; FAIL blockiert Abschluss, nicht Befunderstellung. Orchestrator liefert exakten Reportpfad und handoff_store.
Expected Handoff: docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md nach Abschnitt 8, kompletter finaler Inventarabgleich/Dispositionen, Commands/Exitcodes/Findings/Risiken/Limits und nichtleeres Report/Verdictmanifest. Keine Registry-/Historienedits oder Deploymentfreigabe.
Recommended Execution Order: 4 nach D-18, danach Ende/Stop oder exakt begrenzter Findingauftrag B-18C.

### B-18C - Bedingter einzelner Backend-Korrekturdurchlauf
Agent: Backend
Goal: Nur Q-18A-belegte fehlende genehmigte Vereinfachung oder deren lokale Regression innerhalb der eingefrorenen Vertrags-/Hunkgrenze korrigieren. Ein Durchlauf, keine freie Suche nach Refactorings und keine neue Promptserie; fokussierte und erforderliche Pflichtgates erneut ausfuehren.
Required Knowledge Base: docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md; docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md; docs/kb/tech/08-testing.md.
Required Repository Context: Voller v18-Plan, Q-18A-Report und exakte beauftragte Finding-/Hunkliste samt urspruenglicher Nutzerfreigabe, Q-18R-Inventar, B-18-/D-18-Handoffs/Diffs. Nur betroffene Dateien aus backend/src/lib/{recipeAnalyzeValidation.ts,recipeAnalyzeValidation.test.ts,openai.ts}, backend/src/lib/prompts/{recipeAnalyze.ts,recipeAnalyze.eval.test.ts,recipeAnalyze.eval.fixtures.ts}, backend/src/functions/{recipes.ts,recipes.test.ts,ai.test.ts}; angrenzende unveraenderte Source-/Save-/Provider-/Testhelpervertraege aus Abschnitt 5 nach Findingbezug; backend/package.json und bestehende Vitest-/Evalkonfiguration.
Required Skills: azure-openai-feature-integration.
Relevant Acceptance Criteria: AC-13/14 und im Finding genannte AC-1..12; keine selbststaendige AC-Ausweitung.
Dependencies: Q-18A, konkreter Orchestrator-Korrekturauftrag innerhalb bereits genehmigter K-/Findingliste. Neue Aktion oder Produkt-/Architektur-/Vertragsfrage Status: Blocked bis neuer ausdruecklicher Freigabe. Ohne passenden Befund dokumentierter No-op.
Expected Handoff: docs/User Stories/Reciepe/B-18C_Recipe-Kurzfassung-Review_Korrektur_Handoff_2026-10-09.md plus eigener Diff, Findingmapping, erhaltene Coverage, Commands/Exitcodes und offene Grenzen; maximal ein Folgezyklus, kein Selbst-PASS.
Recommended Execution Order: 5 nur falls Abschnitt 6.6 zutrifft, danach D-18C und zwingend Q-18C.

### D-18C - Bedingter Dokumentationsnachlauf
Agent: Backend
Goal: Nur Aussagen der fuenf KB-Dateien nach tatsaechlichen B-18C-Aenderungen angleichen; falls keine Aussage betroffen, dokumentierter No-op mit Abgleich. Keine weitere KB-Bereinigung.
Required Knowledge Base: docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md; docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md.
Required Repository Context: Voller v18-Plan; konkrete Korrekturfreigabe, Q-18A und B-18C-Handoff/eigener Diff; D-18-Handoff/Diff; nur B-18C-betroffene Codepfade aus dessen Manifest und die fuenf genannten KB-Dateien.
Required Skills: azure-openai-feature-integration.
Relevant Acceptance Criteria: AC-9/13/14 und dokumentationsrelevante Finding-ACs.
Dependencies: B-18C abgeschlossen oder vollstaendiger FAIL-Handoff; kein erfundener Erfolgsstand.
Expected Handoff: docs/User Stories/Reciepe/D-18C_Recipe-Kurzfassung-Review_Korrektur_Handoff_2026-10-09.md, eigener enger Diff oder begruendeter Dokumentations-No-op, offene Gates. Keine Registry-/Historienedits.
Recommended Execution Order: 6 nur nach ausgefuehrtem B-18C, vor Q-18C.

### Q-18C - Bedingte erneute unabhaengige Abnahme
Agent: QA
Goal: B-18C/D-18C unabhaengig erneut gegen kompletten Plan und finalen Serienstand pruefen; jeder Korrekturedit benoetigt diesen Review. Fokus-/Pflichtgates selbst wiederholen, Inventar und Dispositionen fortschreiben; bei erneutem FAIL Stop statt weiterer Schleife.
Required Knowledge Base: docs/kb/tech/01-system-overview.md; docs/kb/domain/06-recipes.md; docs/kb/domain/07-ai-features.md; docs/kb/tech/02-backend.md; docs/kb/tech/06-ai-integrations.md; docs/kb/tech/09-api-reference.md; docs/kb/tech/08-testing.md.
Required Repository Context: Voller v18-Plan und genehmigter Findingentscheid/Korrekturauftrag; Q-18R/Q-18A; B-18-/D-18-/B-18C-/D-18C-Handoffs und eigene Diffs; alle Dateien und Serienartefakte aus Abschnitten 2/5 zum finalen Gesamtinventarabgleich; US-10; docs/qa/reports/README.md; .github/instructions/qa.instructions.md; docs/qa/findings.md nur read-only relevante Eintraege.
Required Skills: azure-openai-feature-integration (Section 6 und references/implementation-checklist.md).
Relevant Acceptance Criteria: AC-1..14; US-10 AC-15/16 nach Klarstellung und unveraenderte Templategrenzen.
Dependencies: Konkrete Freigabe, B-18C-/D-18C-Handoffs; Orchestrator liefert exakten Folgepfad/handoff_store. Nie durch Backend-/Dokumentationsselbstabnahme ersetzen.
Expected Handoff: docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Nachpruefung.md nach Abschnitt 8 mit kompletten ACs, finalem Inventar, Commands/Exitcodes, Findings/Limits und Report/Verdictmanifest; keine Registryedits, Q-18A unveraendert.
Recommended Execution Order: 7 nur nach B-18C/D-18C; danach Abschlussentscheidung oder Stop/neuer Auftrag, keine weitere Runde.

## 10. Reihenfolge, Stopgrenzen und offene Punkte

1. Neues ausdrueckliches v18-APPROVE; bis dahin nur dieses Planartefakt. Alle Pakete sind geplant, keines wird in diesem Auftrag ausgefuehrt.
2. Q-18R -> dokumentierte endliche Findingentscheidung/No-op -> B-18 -> D-18 -> Q-18A. Vorteil: Herkunft/Komplexitaet vor neuem Edit geklaert, finaler Zustand dennoch unabhaengig geprueft. Kein Live-Vorhergate zur vermeintlichen Gruenbaseline noetig, historische FAILs genuegen als bekannte Ausgangsgrenze.
3. Nur fuer belegte genehmigte Folgekorrekturen einmal B-18C -> D-18C -> Q-18C. Keine neuen Befunde automatisch implementieren. Bei keiner Zusatzvereinfachung ist der Zusatzpfad No-op, Kurzfassungsfix/Abnahme bleiben erforderlich.
4. Out of Scope: DailyInsight, globale Bereinigung, andere Importstabilisierung ausser bezeichnetem Exportvertrag, Frontend-/Sharedcode, Rendererlayout/assets/fonts/canvas, share-bundle-Fix, neue Schema-/Provider-/API-Shapes, Modell-/Budget-/Timeouttuning, weitere Calls/Retry/Fallback, Cosmos-/Ressourcen-/Nativeaenderung, Registry- und Historienedits.
5. Bei notwendiger Produkt-/Architektur-/Vertrags-/Scopeerweiterung ueber Abschnitt 4 hinaus stoppen und neue Freigabe einholen. Fremde Hunks bewahren; keine Dateirestores, Reverts oder ungeklaerte Hunkloeschungen. Ein Gesamtgate-FAIL durch Daily ist separat zu beauftragen, nicht innerhalb dieser Serie wegzubereinigen.
6. Offen bleiben drei historische Importhunk-Urspruenge, genaue Dailyfehlerursache und privates Originalrezept/deployed Revision. Reviewer muss festhalten, welche Luecke konkrete Edits blockiert und welche nur historischen Nachweis begrenzt; kein globaler Stop allein wegen nicht rekonstruierbarer Historie. Menschliche Privatvalidation nur spaeter autorisiert, ohne Inhaltsuebernahme in Repo/Logs.
7. Ende: unabhaengige QA, nachvollziehbares finales Inventar/Dispositionen und ehrliche Gates; kein 'sauber' durch Testverlust. Kein Pflichtgate-PASS/Abschluss/Merge/Release bei echten offenen Blockingfehlern. Alpha-Deploy erst nach erfolgreicher Abnahme/Merge als separat beauftragter operativer Release, kein Deployment in diesem Plan.

Nur dieser neue Plan wird jetzt angelegt. Link-/Struktur-/Whitespace-/Unveraendertheitspruefung des Planartefakts ist keine Implementation, QA-Ausfuehrung, Runtimevalidation oder Freigabe.
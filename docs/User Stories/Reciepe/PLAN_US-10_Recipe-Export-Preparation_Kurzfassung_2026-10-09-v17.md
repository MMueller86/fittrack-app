# PLAN_US-10: Selektive Export-Kurzfassung v17

Status: Freigabeentwurf; neues ausdrueckliches APPROVE erforderlich. Nur Planung, keine Implementation, QA oder Deployment autorisiert.
Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Produktklarstellung und Freigabegrenze

Classification: Accept as proposed. Der Auftrag bleibt Fehlerkorrektur und begruendete lokale Overengineering-Ruecknahmen, keine Featureausweitung.

Neue Nutzerklarstellung wortgetreu:
> Es war schon immer eine kurzfassung, ist es ja schlicht nich möglich, den selben inhalt, aber deutlich gekürzt wiederzuspiegeln. Die wichtigsten schritte, wie man das Rezept kocht, sollen enthalten sein. Also ja, eine kurze zusammenfassung, der nach den Vorgaben des Render Templates passt.

Vorherige Nutzerfrage wortgetreu:
> Ich meine es ist eine reduzierung, man kann in einer reduzierten form nicht alle Schritte beibehalten, sondern man reduziert sich auf die wichtigsten schritte. Ist das Konzept der Validierung überhaupt zielführend?

Diese ausdrueckliche Produktklarstellung ersetzt die vollstaendige Export-Inhaltserhaltung aus v15/v16. Die vorausgehende Orchestratorerklaerung war Kommunikation, keine technische Vertragsfreigabe. Auch die fruehere v16-Freigabe autorisiert v17 nicht. Erst APPROVE fuer diesen Plan genehmigt die unten bezeichneten Validator-, Prompt- und Testaenderungen einschliesslich der Exportseite des Imports.

Open Product Owner Decisions: None fuer den abgegrenzten Entwurf. Vorgeschlagen sind hoechstens fuenf statt exakt min(N,5) und die qualitative Auswahlrubrik aus Abschnitt 4; sie werden erst mit Planfreigabe zum technischen Vertrag. Keine neue universelle Liste obligatorischer Kochdetails oder medizinisch/lebensmitteltechnisch bestaetigte Sicherheitsklassifikation wird als Nutzerentscheidung ausgegeben.

Die Produktprioritaet ist eine brauchbare kurze Kochzusammenfassung. Das ist eine begruendete Zielkorrektur, kein stilles Lockern fuer gruene Gates. Kein weiteres Tuning des v16-Vollerhaltungs-Kandidaten.

## 2. Gelesene Evidenz und Iststand

Vollstaendig gelesenes Working Artifact: [v16-Plan](PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md). Vollstaendig gelesen: [v16-QA](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Inhaltserhaltung_2026-10-09-v16.md), [B-16-Handoff](B-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [B-16-EigenerDiff](B-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch), [D-16-Handoff](D-16_Recipe-Preparation-v2_Handoff_2026-10-09.md), [D-16-EigenerDiff](D-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch). Fuer Herkunft und Freigabegrenzen ebenfalls gelesen: [v15-Plan](PLAN_US-10_Recipe-Export-Preparation_Gezielte-Korrektur_2026-10-09-v15.md), [B-1-Ruecknahmehandoff](B-1_Recipe-Analyze-v15_Ruecknahme_Handoff_2026-10-09.md) und [B-1-Ruecknahmediff](B-1_Recipe-Analyze-v15_Ruecknahmediff_2026-10-09.patch). Ausgangs-/Enddiff sind fuer die spaetere hunkgenaue Umsetzung referenziert, nicht als erneut vollstaendig gelesene Evidenz behauptet.

Das [Register](../../qa/findings.md) wurde fuer FT-QA-2026-063/067/068/069 und VER-2026-015 nur gelesen. In diesem Auftrag keine Registry-, Story-, historischen Plan-, Handoff- oder Reportedits und keine Finding-Schliessung.

- v16 war laut Nutzer/Workflow freigegeben. B-16: exklusiver Preparationprompt v2, optionaler Clientkontext mit unveraenderten gespeicherten Steps; Importprompt v15 unveraendert. D-16: fuenf KB-Dateien auf diesen Code abgeglichen, ohne Live-Erfolgsgarantie.
- Unabhaengige Q-16: 294 fokussierte / 1407 normale Units, Typecheck/Build PASS; Preparation, Import und Gesamt-Live FAIL. Das sind historische QA-Ergebnisse, keine Planner-Ausfuehrung und keine heutige gruene Baseline.
- S/R-Liveoutput: Source 1..8, Exportreferenzen 1..7, fuenf Texte mit Laengen 66/73/65/56/62; mittlere Hitze, zugedecktes Ruhen und Servieren fehlen. Handler 422 allein schon wegen der fehlenden Referenz 8. Fehlende Details waren nach v16 ungueltig; ihr Fehlen ist nach v17 nicht automatisch ein Qualitaetsfehler. Die neue Rubrik muss dies frisch bewerten.
- Historischer Nutzerfehler: recipes-prepare-export-view, 422, 12:48:42 UTC, operation_Id a9f0b3adf10d2c4e2ab866d38d6b65ae; Source 1..8, Export [1],[2],[3],[4],[6,7], fehlend 5 = Reis separat kochen / 8 = Servieren. Kein share-bundle. Privater Originaltext und deployed Revision fehlen: keine Rekonstruktion konkreter historischer Kochdetails.
- FT-QA-2026-068 umfasst Countfehler, exakten Trace, Semantik und echte Strukturfehler. Count/Vollabdeckung sind neu zu beurteilen; Duplikattrace [1,2,3,4,5,1] und Leertext bleiben ungueltig. FT-QA-2026-069 ist ein fremder Daily-Insight-Gatefehler; Ursache/Detailmeldung teilweise UNVERIFIED, keine Reparatur in diesem Plan.

### Kontrolling Code und kleine falsifizierbare Hypothese

[validateExportStepTrace](../../../backend/src/lib/recipeAnalyzeValidation.ts#L134) vergleicht die abgeflachte Referenzfolge exakt mit allen Sourceorders und wird von Importvollvalidator und Preparationvalidator gemeinsam verwendet. [Preparationhandler](../../../backend/src/functions/recipes.ts#L816) validiert gegen gespeicherte recipe.steps, nicht Modellsource. [Beide Prompts](../../../backend/src/lib/prompts/recipeAnalyze.ts) erzwingen Vollabdeckung und exakt M; der Runtimevalidator selbst erzwingt nur die Obergrenze, nicht exakt M.

Hypothese: Die exakte Coveragepruefung erzeugt einen vermeidbaren 422 fuer eine ansonsten strukturell gueltige selektive Kurzfassung. Ein gueltiger, streng geordneter Teiltrace beseitigt diesen Ablehnungsgrund, ohne unbekannte, doppelte oder vertauschte Referenzen zuzulassen. Er garantiert keine Kochqualitaet.

Billiger diskriminierender Check nach Freigabe: bestehende Validator-/Handlertests um eine synthetische gueltige Kurzfassung ohne Servierorder 8 ergaenzen; am aktuellen Code muss genau Coverage scheitern, nach lokalem Validatorfix muss derselbe Test bestehen. Duplikat/Unknown/Tausch-Negativfaelle muessen weiterhin scheitern. Kein Livecall fuer diesen Red/Green-Nachweis noetig.

## 3. Belegte Templategrenzen und Entstehung der Fehlannahme

- [US-10 Produktentscheidung 7](US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md#L48), Templateabschnitt und AC-13/14/15 verlangen bis zu fuenf Schritte, grosse Darstellung bei 1..4 und kompakte bei 5. Sie verlangen kein exakt M.
- [Shared-Konstanten](../../../shared/types/recipeExport.ts): MIN_STEPS=1, MAX_STEPS=5, MAX_STEP_LENGTH=90, MAX_TEASER_LENGTH=96. [Save-/Share-Schema](../../../backend/src/lib/recipeValidation.ts) fordert bereits 1..5 Texte. [Detailtemplate](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts#L351) wechselt bei genau fuenf in kompakte Darstellung; seine [Messfelder](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts#L522) behalten reale Breiten-/Hoehengates. Output bleibt 1080 x 1350.
- Zeichenlimits sind keine Layoutgarantie. Ein echter bestehender Satori/Resvg-Proberender bleibt entscheidend; keine Schrift-, Canvas-, Layout-, Timeout- oder Assetaenderung zur Anpassung von Texten.
- US-10 nennt bereits Verdichtung, fordert aber im KI-Abschnitt und AC-16 gleichzeitig die Erhaltung von Handlungen, Temperaturen, Zeiten und Wendepunkten. Deshalb ist nicht belegt, dass selektives Weglassen schon immer eindeutig dokumentierter Vertrag war. Die neue Nutzerklarstellung loest diese Spannung ausdruecklich zugunsten der Kurzfassung; genehmigte Story bleibt unveraendert, v17 dokumentiert den Vorrang fuer Export-AC-16.
- [Rezept-KB](../../kb/domain/06-recipes.md#L324) und [AI-KB](../../kb/domain/07-ai-features.md#L174) fuehren exakt min(N,5) und Vollpartition als geerbte v13-Regeln. B-1 belegt lokale v13/v14-Vermischung und erhaltene exakte Mappingregel; v15 PO-1 liess ihre Ruecknahme offen. v16 Abschnitt 2.3 verschaerfte den Kandidaten ausdruecklich zu ALLEN Handlungen/Details; B-16-Diff belegt den konkreten Einbau, D-16 dessen Dokumentation.
- Die Verschiebung von 'hoechstens fuenf, semantisch verdichten' zu 'vollstaendige Partition plus jedes Detail im referenzierten Text' ist repository-backed belegt. Eine exakte historische Urheberschaft jedes uncommitted Importhunks ist es nicht. HEAD ist v11; kein whole-file Restore oder erfundener v13-Snapshot.

## 4. Neuer Kurzfassungsvertrag zur Freigabe

### Zwei getrennte Listen und Referenzbedeutung

1. Quell-steps bleiben die vollstaendige normale Rezeptbasis. Beim Import bleiben explizit nummerierte Anweisungen 1:1 und geordnet erhalten; Sourceextraktion ist keine Exportkurzfassung. Bei Preparation bleiben gespeicherte order/title/description im JSON-Kontext unveraendert, fehlender title im verlangten Provideroutput null. Keine aendernde Rueckschreibung oder neue Reextraktion der gespeicherten Quelle.
2. exportSuggestion.steps ist eine selektive deutsche Kochkurzfassung mit 1..5 nichtleeren Texten und jeweils hoechstens 90 Zeichen. Ihre Laenge wird nach sinnvollen Kochphasen gewaehlt, nicht nach exakt min(N,5); auch bei N<=5 darf zusammengefasst oder Unwesentliches weggelassen werden. Keine Paddingtexte, Ellipsen, Wortabbrueche oder mechanische Auswahl der ersten fuenf Sourceorders.
3. Exportorders bleiben lueckenlos 1..K. sourceStepOrders bleibt je Exporttext eine nichtleere Liste gueltiger positiver Originalorders. Die gesamte abgeflachte Liste ist eine eindeutige, streng aufsteigende Teilfolge der gueltigen geordneten Quellliste. Luecken sind erlaubt, auch innerhalb einer zusammengefassten Gruppe; keine Pflicht zu unmittelbar benachbarten Originalorders. Keine Quelle darf in mehreren Exportgruppen referenziert werden.
4. Referenzen bezeichnen die im jeweiligen Text tatsaechlich zusammengefassten Quellhandlungen, nicht alle vom Modell gelesenen Schritte. Keine IDs fuer weggelassene Schritte auffuellen. Eine referenzierte Sourceorder bedeutet nicht, dass jedes ihrer Details enthalten sein muss. Unbekannte/doppelte/vertauschte Referenzen bleiben 422; fehlende Vollabdeckung allein nicht.
5. Leerexport bleibt ungueltig. Das bestehende MIN_STEPS=1 wird auch in beiden AI-Runtimevalidators ausdruecklich verwendet; derzeit steht dort nur max(5). Ohne vorhandene Kochbasis laesst sich keine belegte nichtleere Kurzfassung erzeugen: kontrolliertes 422 statt erfundener Sourceorder oder Kochanweisung. Kein neues Empty-/Fallbackproduktverhalten.

### Qualitative Wichtigkeit, keine neue Fachautomatik

Die folgenden Kriterien operationalisieren die Nutzerklarstellung zur Planfreigabe. Sie sind Prompt- und Reviewkriterien, keine neue Runtimeheuristik oder pauschale fachliche Sicherheitsfreigabe:

- Wesentlich sind die zentrale Zubereitungs-/Garmethode der Hauptkomponente, eigenstaendige Zubereitung einer wesentlichen Beilage/Sauce und notwendige Uebergaenge bis zum fertigen Gericht. Der Text soll erkennen lassen, was mit welcher Komponente gekocht wird und in welcher nachvollziehbaren Reihenfolge.
- Erhaltene Aussagen muessen aus der Quelle stammen. Keine neuen Zutaten, Garmethoden, Mengen, Zeiten oder Temperaturen; keine vertauschte Komponente und keine Umdeutung wie '4 Minuten je Seite' zu '4 Minuten insgesamt'. Weglassen und widerspruechliches Ersetzen sind unterschiedliche Faelle.
- Zeiten, Hitze, Ruhen, Abdeckung, Schnittform, Wuerzmittel und Servierhinweise sind nicht global immer verpflichtend und nicht global immer unwichtig. Sie bleiben, wenn sie fuer die ausgewaehlte Kochphase bzw. das beschriebene Gericht entscheidend sind; ansonsten duerfen sie zugunsten des Budgets entfallen. Keine neuen Gar-/Sicherheitswerte erfinden, keine behauptete sichere Zubereitung aus einer Kurzfassung ableiten.
- Fuer die vorhandene synthetische Haehnchen-Reis-Fixture ist der freizugebende Mindestkern: Haehnchen vorbereiten/schneiden, anbraten, Reis als eigenstaendige Komponente kochen, Haehnchen fertig garen. Keine pauschale Pflicht zu Wuerfelform, Salz/Pfeffer, separatem Oelerhitzen, 'mittlere Hitze', Salzwasser, Abgiessen, zugedecktem Ruhen oder eigener Serviergruppe. Diese Auswahl ist fixturebezogen, keine allgemeine Rezepttaxonomie.
- Reis nur als Zutat oder Beilage zu nennen ersetzt in dieser Fixture nicht sein Kochen. Ob Servieren/Ruhen in einem anderen Rezept zentral ist, muss die jeweilige Reviewbegruedung zeigen. Keine feste Erfolgsfolge 1..8 und keine Pflicht, jede Quelle in der Exportsemantikmatrix abzuhaken.
- Ergebnis bleibt ein editierbarer, transienter Vorschlag im vorhandenen Nutzerreview. Runtime validiert Struktur/Referenzen/Limits, nicht universelle sprachliche Wichtigkeit oder Handlungsaequivalenz. Ein 200 ist keine Inhalts- oder Rendergarantie.

## 5. Konkrete Behalten / Entfernen / Ersetzen-Matrix

| Entscheidung | Konkrete Regel / Aenderungsstelle | Begruendung und Herkunft |
|---|---|---|
| Behalten | Gespeicherte Sourcebasis, JSON im Userkanal, optionaler Preparationkontext und exklusiver Preparationzweig; recipes.ts/openai.ts | B-2-v15 und B-16-Clienthunks beseitigen Identitaetswechsel/konkurrierenden Importauftrag. Kleine bestehende Ownershiploesung, kein Vollerhalt-Zwang. Nicht auf Addendum/Freitext zurueckbauen. |
| Ersetzen | Exakten Gleichstand sourceOrders == flattenedSourceOrders in validateExportStepTrace durch gueltige streng geordnete eindeutige Teilfolge | Alte gemeinsame Vollpartition ist mit selektiver Kurzfassung unvereinbar; betrifft Preparation UND Importexport explizit. Sourcevalidierung selbst bleibt. |
| Behalten | Unique/ascending Sourceorders, positive Integer, nichtleere Referenzlisten, contiguous Exportorders, Unknown-/Duplicate-/Reorder-Abweisung | Herkunft im vorhandenen Validator/v13-Tracekorrekturen; verhindert uneindeutige/erfundene Zuordnung, unabhaengig von Vollabdeckung. |
| Ersetzen | source_step_coverage_mismatch und nur dafuer existierende sourceStepTrace-/Expected-Mismatch-Auswertung in recipes.ts samt Tests | Fuer ausgelassene Sourceorders nicht mehr korrekte Fehlersemantik. Stattdessen klare Duplicate-/Reordercodes fuer echte Referenzfehler; generische begrenzte code/path-Diagnose bleibt. Keine ungenutzten Coveragehilfen stehen lassen. |
| Ersetzen | Beide Promptbloecke zu exakt M, 1:1 Export bei N<=5, lueckenlosen Originalintervallen, Endgruppe bei N und Verbot jeder Auslassung | Import v15 erbt v13/v14-Regeln laut B-1; Preparation v2 durch B-16 belegt. Ersetzen durch Abschnitt 4, nicht Herkunft als v14-Rollback vortaeuschen. |
| Entfernen | B-16-Strategie 'ZUERST vollstaendige Texte ALLER Details, ERST DANACH M Gruppen, Grenzen bis Vollerhalt verschieben' | Exakter B-16-EigenerDiff vorhanden; zielwidrige Vollerhalt-Packplanung. Keine neue Packingfunktion oder Promptnachbesserungsserie. |
| Ersetzen | Export-All-Details-/Servierpflicht in beiden Prompts, Exportcount/Exacttrace in eval.test.ts, automatische Kopie aller Sourcepatterns in Exportconstraints | Neue begruendete Mindestkernrubrik plus erlaubte Auslassungen und Widerspruchsverbote. Import-Sourceextraktionsconstraints bleiben separat vollstaendig. |
| Entfernen/Ersetzen | Exportdetailverlustbatterien in recipeAnalyzeValidation.test.ts inkl. 20 Preparationmutationen, 1..8-Exportpflichtmatrix und B-16-v15-Negativfall als pauschale Fehlerdefinition | Herkunft B-2-v14/B-2-v15 und expliziter B-16-Testhunk. Nur Tests entfernen, deren einzige Fehlerursache erlaubtes Weglassen ist; repraesentative echte Widerspruchs-/Swap-/Erfindungsfaelle behalten oder fokussiert ersetzen. Kein Sourceextraktionsverlusttest blind mitloeschen. |
| Behalten, vereinfachen | B-16-Handler-Liveharness mit echter SDK-Delegation, Rohoutput vor V2, Call/Quota/No-write-/Responsechecks | Wertvoller Test des owning Pfads. Nur All-Detailsmatrix/Exactcount/-coverage ersetzen; kein neuer Harness/Framework und keine Rueckkehr zu ausschliesslich gemocktem Liveerfolg. |
| Behalten | Strict volle AiRecipeRaw-Shape, provider maxItems/maxLength, Modell, 0.2/2048, Zutatenkeys/Whitelist im Import, nullable Previewmetadaten | Keine neue Schemaarchitektur; B-1-Temperatur-0-Ruecknahme bleibt. Vorbereitung blockiert weiterhin nicht an ungenutzten Zutatenkeys. Keine neue Klassifikationsarbeit. |
| Ergaenzen | min(MIN_STEPS) fuer Exportliste im vorhandenen gemeinsamen Zodschema und Preparation-Schemaoverride | Bestehende Save-/Renderuntergrenze 1 bisher nicht ausdruecklich in AI-Zod gespiegelt; durch Wegfall Coverage darf [] nicht versehentlich gueltig werden. Kein exakt M. |
| Behalten | Auth/Partition/ETag, Quota, ein Call, Usage nur nach gueltigem Erfolg, Transienz/Nutzerbestaetigung, Privacy ueber alle log/warn/error-Argumente | Vorbestehende Sicherheits-/B-1-Privacyarbeit; kein Rezept-/Kontext-/Providertextlogging wiederherstellen. |
| Ersetzen, spaeter | Nur entsprechende aktueller-Code-Aussagen in den fuenf D-16-KB-Dateien | D-16-Diff grenzt zugeordnete Aussagen ein; nach B-17 Teiltrace/Maxcount/Qualitaetsgrenze dokumentieren. Historische v16-FAIL-Evidenz behalten, nicht rueckwirkend gruen schreiben. |
| Nicht wiederholen | Bereits ausgefuehrte B-1-Ruecknahmen zu Temperatur 0 und eindeutig v14-zugeordneten Beispielen | Belegter B-1-Ruecknahmediff; drei damals ausgesetzte Importhunks bleiben historisch ungeklaert. Nur heute zielwidrige Teilregeln werden neu autorisiert ersetzt, Wortabbruchschutz bleibt. Kein whole-file Restore aus HEAD v11. |

## 6. Kleinste Umsetzung, API- und Persistenzgrenzen

Nach APPROVE im vorhandenen Validator zuerst Red/Green des Teiltraces; danach Prompt-/Evalkorrektur. Keine neue Datei/Abstraktion fuer fachliche Auswahl. In validateExportStepTrace die Source-/Exportordnungschecks behalten, Referenzmitgliedschaft pruefen und ueber die gesamte abgeflachte Folge Duplikate und nichtaufsteigende Reihenfolge abweisen. Fehlende Quellorders nicht als Issue ausgeben. Fuer neue globale Fehler stabile Codes duplicate_export_source_reference / export_source_trace_not_ascending benutzen; vorhandene lokale Unknown-/Ascendingcodes erhalten. Input nicht mutieren, keine IDs/Textreparatur.

Die coverage-only sourceStepTrace-Struktur und ihre exklusiven Handlerloghelfer hunkweise entfernen, soweit keine verbleibende Verwendung existiert; generische diagnostic phase/code/path und deren Privacygrenzen erhalten. Keine neue Observabilitypipeline. Privacytests mit echten weiter ungueltigen Duplikat-/Unknown-/Reorderoutputs ausloesen, nicht mit nun erlaubter Auslassung.

Im selben Promptmodul die Exportanweisungen beider Prompts kurz und konsistent auf Abschnitt 4 zurueckfuehren. Nicht-Export-Importregeln unveraendert. Preparation behielt den vollen Providervertrag aus Kompatibilitaet; dessen notwendigen Feldauftrag behalten, nicht in ein neues export-only Schema umbauen. Bewusst neue Promptstaende: Import v16, Preparation v3, mit passenden getrennten Evalguards; Planversion v17 ist kein Promptversionsname. Neue Versionen beschreiben neue Interpretation, kein behaupteter historischer Restore.

**Explizite Vertragsaenderung:** Die vorhandenen sourceStepOrders-Felder im Provider-/Analyzevertrag wechseln von Vollpartition zu referenzierter Auswahl. Die Analyze-/Preparation-Validierung akzeptiert dadurch erlaubte Auslassungen statt coverage-bedingter 422; 422 bleibt fuer echte Struktur-/Referenzfehler. Keine Route, Methode, Body- oder DTO-Shape aendern. Strict JSON-Provider-Schema und dessen maxItems/maxLength bleiben unveraendert; die Untergrenze wird im Runtime-Zod durch vorhandene Shared-Konstante ausgedrueckt, keine neue Structured-Output-Shape/Versionsgabel.

Die [Shared-Exportsteps](../../../shared/types/recipes.ts#L24) und Save-/Sharevertraege enthalten nur order/description, keine sourceStepOrders. V2 projektiert weiterhin nur Text. Save benoetigt ausdrueckliches confirm, echte Zutaten-IDs und serverseitigen Fingerprint; kein neuer Trace-Savecheck, kein erneuter KI-Aufruf, keine Preview-Keypersistenz. Saved Exportviews mit 1..5 Texten bleiben unveraendert lesbar; keine Rueckfuellung. Frontend-/Shareddateien benoetigen keine Implementation. Der Importclient bleibt derselbe; nur seine Exportsemantik aendert sich, nicht Zutatenmapping oder Sourceextraktion.

AI assessment: Vorhandene KI fuer sprachliche Auswahl/Verdichtung weiterhin sinnvoll; keine deterministisch belegbare universelle Wichtigkeitsregel vorhanden. Ergebnis advisory, Nutzerreview/Bestaetigung erhalten. AiFeature bleibt recipe-analyze. Fehlervertrag: Auth/404/400/412 wie bisher; Quota 429 vor Call; Provider-/Leer-/Parsefehler 502; ungueltige Struktur/Referenz/Limit 422 ohne Usage. Ein gueltiger Erfolg trackt einmal. Kein zweiter Call, Retry, Fallback, Runtime-AI-Semantikklassifikator oder neue Services/Dependencies.

Persistence Impact: None; keine Cosmos-Dokument-, Repository-, Container-, Partitions- oder Migrationsaenderung. Keine neuen Promptversionsfelder in Cosmos fuer transiente Ergebnisse. Dev im bestehenden lokalen Setup, Alpha nach Abnahme/Merge nur separat beauftragter Backendrelease. Keine Infrastrukturdesignarbeit oder Mobile-/Nativeaenderung.

Out of Scope: DailyInsight-Reparatur, allgemeine Importstabilisierung ausser den bezeichneten Exportregeln, Renderer/Layout/Assets, share-bundle-Fix, Schemaaufspaltung, Budget-/Modelltuning, automatische Aufrufe, Registrypflege, historische Rewrites und Deployment. Bei erforderlicher Shape-/Layout-/Fachregel-/Scopeaenderung stoppen und neue Entscheidung verlangen.

## 7. Nummerierte Akzeptanzkriterien

1. **AC-1 Teiltrace:** Beide Runtimevalidators akzeptieren gueltige geordnete Teilreferenzen mit Luecken bei 1..5 Exporttexten; Red/Green belegt den entfallenen Coverage-422. Sourceorders bleiben eindeutig/aufsteigend, Exportorders contiguous; Duplicate innerhalb/zwischen Gruppen, Unknown, Reorder und leere Referenzliste bleiben ungueltig. Keine Reparatur/Mutation.
2. **AC-2 Darstellungsgrenzen:** 1, 4 und 5 Texte sowie 90 Zeichen werden akzeptiert, 0/6 Texte und 91 Zeichen/Leertext abgewiesen. Keine exakt-min(N,5)-Assertion, kein Padding. Bestehende Templatezahl, Teaser-/Metadatengrenzen und reale Render-Overflowpruefung unveraendert; ein begrenzter synthetischer Kurzfassungs-Proberender benutzt Produktionsrenderer/fonts.
3. **AC-3 Kurzfassungsqualitaet:** Bestehende synthetische Preparationfixture trifft den Mindestkern aus Abschnitt 4: Haehnchen vorbereiten, anbraten, Reis kochen, Haehnchen fertig garen, nachvollziehbare Komponenten/Reihenfolge. Servierorder und Detailauslassungen sind als positive Gegenbeispiele moeglich. Weglassen des Reiskochens scheitert an der Reviewrubrik, nicht automatisch am Strukturvalidator. Keine Goldenformulierungen oder festen Gruppen.
4. **AC-4 Keine Erfindung/Scheinloesung:** Bei korrekten IDs bleibt ein synthetischer Text ohne Reiskochhandlung qualitativ negativ. Ebenso widerspruechliche Komponente, vertauschter Kochtext und erfundene numerische Temperatur; ausgewiesene Details duerfen nicht falsch ersetzt werden. IDs allein sind kein Qualitaetsnachweis. Alle ausgewerteten Kriterien betreffen den jeweiligen referenzierenden Text; keine universelle Runtime-Semantikgarantie.
5. **AC-5 Prompts/Quelltrennung:** Import v16 und Preparation v3 samt Guards verlangen denselben Kurzfassungsvertrag; Preparation ausschliesslich eigener Prompt, gespeicherter JSON-Kontext unveraendert. Import behaelt vollstaendige 1:1 Extraktion expliziter nummerierter Sourceanweisungen, Zutaten-/Kategorien-/Mengen-/Keyregeln und Freitextinput. Exakt M/Vollpartition/Vollerhalt-Packstrategie sind entfernt, Wortabbruch-/Keine-Erfindungsschutz bleibt.
6. **AC-6 Sicherheitsinvarianten:** Auth/Ownership, optionales exaktes ETag vor Quota, 429/502/echte 422, Strict Schema/ein Call/Usage nur nach Erfolg, V2 Text-only und keine Preparationwrites bleiben. Privacy prueft alle Loggerargumente auch bei echten Fehlern. Coverage-only Diagnosen entfallen ohne Rueckkehr zu privaten Textlogs. Save-/Share-/Fingerprintvertraege unveraendert.
7. **AC-7 Herkunft/Ruecknahmen:** Handoff weist jeden eigenen Hunk der Matrix zu, bewahrt B-1-Ruecknahmen und fremde Dirtyarbeit. Drei historisch ungeklaerte Importhunks werden nur fuer ausdruecklich bezeichnete neue Exportsemantik angefasst, nicht als v13-Restore ausgegeben. Ueberstrenge Exporttests werden begruendet ersetzt, nicht Source-/Securitytests blind geloescht.
8. **AC-8 Evidenz/Gates:** Fokussierte Units, neue kleine qualitative Recipeevals, normale Vollsuite, Typecheck/Build und Diff neu ausgefuehrt und getrennt dokumentiert. Vorbereitung am echten Handler/Client/Provider erbringt 200/V2/ein Usage/no writes mit kurzer Kernrubrik. Pflicht-Recipe-/Gesamteval bleibt ehrlich; angepasste zielwidrige Assertions haben eine genehmigte Begruendung, echte verbleibende Fehler sind FAIL, Credentials/Skips/fehlende Nachweise UNVERIFIED. Kein Abschluss/Merge/Release bei offenem Pflichtgate.
9. **AC-9 Doku/unabhaengige QA:** Betroffene KB beschreibt Teiltrace, max statt exakt, Quell-/Exporttrennung, neue Versionen und Qualitaetsgrenze nach tatsaechlichem Code. Unabhaengige QA bewertet AC-1..9 und den neu geklaerten Exportanteil von US-10 AC-15/16; v16-FAIL/Registry bleibt historisch erhalten. Kein historischer privater Replay, Alpha-/Shareerfolg oder Findingabschluss aus synthetischem PASS abgeleitet.

## 8. Tests, Reproduktionen und Grenzen

Alle folgenden Befehle sind Auftraege nach Freigabe, keine heutigen Planner-Gates. Bestehende Testdateien/Helper wiederverwenden, keine neue Testframework-Abstraktion und keine umfassende Detailverlustmatrix 1..8.

1. In recipeAnalyzeValidation.test.ts gueltige synthetische Teilfassung ohne reine Serviergruppe und mit weniger als min(N,5) Texten als Red hinzufuegen; lokale Validatoraenderung, denselben Check sofort Green. Danach dieselben Referenzfaelle im Importvalidator und Preparationhandler pruefen. Representative Luecke innerhalb Gruppe und zwischen Gruppen, Cross-group-Duplikat/Unknown/Reorder, Grenzen aus AC-2.
2. Historischen numerischen Trace [1],[2],[3],[4],[6,7] bei gespeicherten 1..8 als **strukturell erlaubt** testen; nicht mehr exakt 422/5/5/6 verlangen. Dazu bewusst synthetischer Text ohne Reiskochen: Qualitaetsrubrik negativ. Originaltexte fehlen, daher weder historische Qualitaet noch Erfolg behaupten. Separater Referenzfehler gegen gespeicherte Source statt verkurzter Modellsource bleibt negativ.
3. Kleine positive Kurzfassung derselben unveraenderten synthetischen Eingabe mit Kernhandlungen und ohne Servierorder; Detailverzicht positiv, fehlendes Reiskochen/erfundene Temperatur/falsche Komponente/Textswap negativ. Vollstaendige Sourceextraktionsrubrik fuer nummerierten Import separat behalten. Bestehenden v15-Offlineoutput und v16-S/R-Rohoutput nur nach neuer Rubrik frisch einordnen, nicht alte FAIL-Berichte aendern.
4. `npx vitest run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts src/lib/recipeValidation.test.ts` in backend. SDKrequest/Guards, Privacy/Ownership/ETag/Quota, Success/No-write sowie unveraenderte Saveuntergrenze pruefen. Keine neue Save-Semantikvalidierung.
5. Bestehendes recipeDetailsTemplate.test.ts um hoechstens einen synthetischen Kurzfassungs-Proberender ergaenzen, falls kein geeigneter bestehender Fall dieselben Texte abdeckt; Produktionsrenderer/fonts, erfolgreiche reale Messung und 1080x1350 PNG pruefen. Vorhandene 1..4/5-Layoutfaelle verwenden, nicht neu als volle Renderbatterie aufbauen. Command: `npx vitest run src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`. Kein neuer Share-/Device-E2Eauftrag.
6. Bestehende acht Importinputs und Preparationinput unveraendert lassen; nur bezeichnete Exportcount/-coverage/-qualityconstraints neu begruenden. Rezeptausgaben ohne explizite Kochanweisung sind keine erfundenen historischen Rezepte. Generierte Sourceextraktion bei solchen bisherigen Importfixtures bleibt ausserhalb dieser engen Reparatur unveraendert; harte Zutaten-/Mengenconstraints weiter pruefen.
7. Ein vorab festgelegter fokussierter Preparationlauf ueber realen Handler/Client/Provider, danach separat einmal das Recipegate: `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"`, danach `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts`. Rohsynthetik, ausgewaehlte Referenzen/Texte, Kernkriterien, Counts/Laengen, 200/V2/Usage/no writes getrennt erfassen. Kein dreimaliger Vollerhalt-/Stabilitaetsnachweis mehr; eine Stichprobe beweist keine Zuverlaessigkeitsgarantie. Kein retry-until-green oder zweiter Call pro Request. Bei FAIL Befund liefern, keine weitere Promptserie.
8. Pflichtgesamtgate `npm run test:eval`, normale `npx vitest run`, `npm run typecheck`, `npm run build:verify` in backend; Root `git diff --check`. Fremde Dailytests/Runnerconfig/Timeouts nicht aendern. AI-Skill verlangt Gesamt-PASS fuer Paketabschluss; getrennte Slice-PASS-Befunde bei Gesamt-FAIL duerfen dokumentiert werden, ersetzen ihn nicht. Unabhaengige QA fuehrt diese Gates selbst aus, keine Handoffzahlen als eigene Tests.

### Befunddisposition ohne Registryedit

| Bestehender Befund | v17-Behandlung |
|---|---|
| FT-QA-2026-067 Preparation | Fehlende Vollcoverage/pauschale Details sind unter neuem Ziel nicht automatisch Fehler. Historischer FAIL bleibt; frische Kernqualitaet und Handler200 neu pruefen. Kein Status 'behoben' ohne neue QA. |
| FT-QA-2026-068 Import | Countabweichung <min(N,5), erlaubte Luecken und optionales Salzwasser/Servieren nicht laenger automatisch rot. Duplikate, Unknown/Reorder, Leertext und echte qualitative Kernverluste bleiben FAIL. Neue Assertions verhindern bisherige fruehe Countabbruch-Verdeckung; spaetere ungetestete Zutatenchecks nicht als PASS ausgeben. |
| FT-QA-2026-063 Trace | Vollabdeckungsanteil neu geklaert; beobachtete doppelte/out-of-order Orders weiterhin echter Fehler. Keine automatische Schliessung. |
| FT-QA-2026-069 Daily | Unveraendert offen/fremd. Gesamtgate bleibt bei erneutem Fehler rot; separater Auftrag notwendig, keine Recipe-Scopeausweitung. |
| VER-2026-015 | Alte gestoppte Laeufe und nicht erfasste Rohdaten bleiben UNVERIFIED. Neue kurze Stichprobe ersetzt nicht rueckwirkend die alte Serie; Originalrezept/deployed Revision weiterhin unbekannt. |

## 9. Agentpakete

### B-17 - Vertragskorrektur und gezielte Ruecknahmen
Agent: Backend
Goal: Ausschliesslich Abschnitte 4..8 implementieren. Vor Edit aktuellen eigenen Ausgangsstand und Hunkzuordnung erfassen; Validator-Red/Green zuerst, dann kleinste Prompt-/Testkorrektur mit jeweiliger fokussierter Validation. Source-/Securityarbeit erhalten, Export-All-Detailsbatterie fokussiert ersetzen. Keine Importoptimierung ausser genehmigter Exportsemantik, keine Daily-/Rendererlayoutreparatur. Auch bei FAIL vollstaendigen Befundhandoff liefern, kein Paketabschluss behaupten.
Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md (Preparationdiagnose)
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (Analyze, Preparation, Save/Share)
- docs/kb/tech/08-testing.md
Required Repository Context:
- Dieser v17-Plan; v16-Plan und Q-16-Report aus Abschnitt 2
- B-16-Handoff/EigenerDiff und B-1-Ruecknahmehandoff/Ruecknahmediff; bei Hunkbedarf dessen Ausgangsdiff/Enddiff, kein HEAD-Restore
- backend/src/lib/recipeAnalyzeValidation.ts und recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.ts, recipeAnalyze.eval.test.ts, recipeAnalyze.eval.fixtures.ts
- backend/src/lib/openai.ts (analyzeRecipeText, AiRecipeRaw, Strict Schema)
- backend/src/functions/recipes.ts, recipes.test.ts; ai.ts, ai.test.ts (nur Recipe Analyze)
- backend/src/lib/recipeValidation.ts, recipeValidation.test.ts; shared/types/recipeExport.ts, shared/types/recipes.ts (read-only Vertrag)
- backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts und __tests__/recipeDetailsTemplate.test.ts (bestehender Rendercheck, kein Layoutedit)
- backend/src/test-utils/http.ts; backend/package.json, vitest.config.mts, vitest.eval.config.mts, scripts/run-eval.mjs
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-1 bis AC-8; AC-9 (Code-/Evidenzhandoff)
Dependencies: Neues ausdrueckliches APPROVE fuer v17; keine weitere Produktentscheidung fuer den beschriebenen Slice. Bei notwendiger Scope-/Shapeaenderung zurueck zum Planner.
Expected Handoff: Neues B-17-Handoff unter docs/User Stories/Reciepe samt eigenem Vorher-/Nachherdiff, Hunkmatrix aus Abschnitt 5, Promptversionen/Guards, Red/Green, neu begruendeten Fixturekriterien, synthetischer Kernqualitaet/Rawtrace/Call-/Status-/Usage-/No-writeevidenz, Befehlen/Exitcodes und getrennten FAIL/UNVERIFIED-Grenzen. Keine privaten Texte, Secrets oder Finding-Schliessung.
Recommended Execution Order: 1 nach Freigabe, dann D-17.

### D-17 - Betroffene KB auf tatsaechlichen Kurzfassungsvertrag bringen
Agent: Backend
Goal: Nur die fuenf betroffenen KB-Dokumente eng an tatsaechliche B-17-Aenderungen anpassen: 1..5/max statt exakt, geordnete Teilreferenzen statt Vollpartition, vollstaendige Sourcebasis versus selektiver Export, neue Promptversionen, verbleibende echte Fehler/Privacydiagnose und keine universelle Qualitaets-/Rendergarantie. Neue Produktklarstellung und Vorrang gegen bisherige US-10-AC-16-Vollerhaltung kenntlich machen. Historische v16-Gates bleiben historische Evidenz, keine Rueckdatierung von PASS.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md (Preparationdiagnose)
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (Analyze, Preparation, Save/Share)
Required Repository Context:
- Dieser Plan Abschnitte 1..8; B-17-Handoff und eigener Diff
- D-16-Handoff/EigenerDiff fuer eng zugeordnete Aussagen
- backend/src/lib/recipeAnalyzeValidation.ts, prompts/recipeAnalyze.ts, openai.ts; backend/src/functions/recipes.ts und ai.ts (nur betroffene Pfade)
- backend/src/lib/recipeValidation.ts und shared/types/recipes.ts (unveraenderter Save-/V2-Vertrag)
Required Skills: azure-openai-feature-integration
Relevant Acceptance Criteria: AC-9; AC-1, AC-5, AC-6, AC-8 (Dokumentationsabgleich)
Dependencies: Vollstaendiger B-17-Handoff; auch bei FAIL nur tatsaechlichen Code und offene Gates dokumentieren.
Expected Handoff: Neues D-17-Handoff unter docs/User Stories/Reciepe mit engem eigenem KB-Diff, Versions-/Vertragsabgleich und weiterhin offenen Gates an QA. Keine Story-, Registry-, historischen Artefaktedits und keine neue Erfolgsbehauptung.
Recommended Execution Order: 2 nach B-17, vor dokumentationspruefender QA.

### Q-17 - Unabhaengige Kurzfassungs- und Ruecknahmepruefung
Agent: QA
Goal: Den freigegebenen v17-Vertrag unabhaengig gegen Code/Tests/KB pruefen. Erlaubten Detailverzicht von zentralem Kochverlust, fehlerhafter Aussage und echten Struktur-/Referenzfehlern trennen; keine selbststaendige Rubriklockerung oder Implementation. Fokus-/Live-/Pflichtgates selbst ausfuehren, Provenienz und Privacy pruefen. Historische Findings getrennt disponieren, Registry nur lesen; Gesamt-FAIL nicht durch Slice-PASS ersetzen.
Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/domain/07-ai-features.md (Recipe Analyzer)
- docs/kb/tech/02-backend.md (Preparationdiagnose)
- docs/kb/tech/06-ai-integrations.md (Recipe Analyzer)
- docs/kb/tech/09-api-reference.md (betroffene Vertraege)
- docs/kb/tech/08-testing.md
Required Repository Context:
- Vollstaendiger freigegebener v17-Plan, B-17-/D-17-Handoffs und eigene Diffs
- v16-Plan/Q-16-Report, B-16-/D-16-Handoffs/EigenerDiffs; B-1-Ruecknahmehandoff/Ruecknahmediff (Herkunftsgrenzen)
- docs/User Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md (AC-13..17 mit v17-Klarstellung)
- backend/src/lib/recipeAnalyzeValidation.ts, backend/src/lib/recipeAnalyzeValidation.test.ts
- backend/src/lib/prompts/recipeAnalyze.ts, backend/src/lib/prompts/recipeAnalyze.eval.test.ts, backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts
- backend/src/functions/recipes.ts, backend/src/functions/recipes.test.ts, backend/src/functions/ai.ts, backend/src/functions/ai.test.ts; backend/src/lib/openai.ts
- backend/src/lib/recipeValidation.ts, backend/src/lib/recipeValidation.test.ts; shared/types/recipeExport.ts, shared/types/recipes.ts
- backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts und __tests__/recipeDetailsTemplate.test.ts
- backend/package.json, backend/vitest.config.mts, backend/vitest.eval.config.mts, backend/scripts/run-eval.mjs
- docs/qa/findings.md ausschliesslich FT-QA-2026-063/067/068/069 und VER-2026-015 (read-only)
Required Skills: azure-openai-feature-integration (Section 6 und references/implementation-checklist.md)
Relevant Acceptance Criteria: AC-1 bis AC-9; US-10 AC-15/16 mit freigegebener Kurzfassungsauslegung, AC-13/14/17 nur unveraenderte Darstellungsgrenzen.
Dependencies: Neues v17-APPROVE und vollstaendige B-17-/D-17-Handoffs. Gate-FAIL blockiert PASS/Abschluss, nicht Befunderstellung.
Expected Handoff: Frischer Report docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung_2026-10-09-v17.md nach fittrack-qa-v1, genau ein Verdict, komplette AC-Matrix, eigene Befehle/Exitcodes, genehmigte Assertionaenderungen und offene Fremd-/Tracefehler getrennt, Verification Limits/MANUAL VALIDATION REQUIRED; nichtleeres Manifest mit Reportpfad/Verdict. Keine Registry-/Historienedits, keine Deploymentfreigabe.
Recommended Execution Order: 3 nach D-17, dann Orchestratorentscheidung.

## 10. Recommended Execution Order und Releasegrenzen

1. Nutzerfreigabe fuer genau v17 inklusive neuer Exportsemantik, qualitativer Rubrik und gezielter Ruecknahmen; bis dahin nur dieses neue Planartefakt.
2. B-17: lokale Vertragskorrektur -> unmittelbar fokussierte Validation -> Prompt-/Testkorrektur und vorgeschriebene Evidenz. Bei echter Planinvaliditaet stoppen; keine eigenstaendige Featureausweitung.
3. D-17: ausschliesslich tatsaechlichen Code in betroffener KB abgleichen, auch offene FAIL/UNVERIFIED ehrlich dokumentieren.
4. Q-17: unabhaengige Abnahme nach neuem Ziel und allen Pflichtgates. Reihenfolge ausschliesslich Backend -> KB -> unabhaengige QA.
5. Orchestrator bewertet Befunde; keine automatische Schliessung FT-QA-2026-063..069 oder Aenderung VER-2026-015. Echte verbleibende Import-/Dailyfehler brauchen separaten Auftrag. Ohne Pflichtgate-PASS kein Paketabschluss/Merge-/Release; kein im Plan implizit genehmigter Waiver.
6. Nach erfolgreicher Abnahme/Merge separat beauftragter Alpha-Backenddeploy im vorhandenen Releaseprozess. Kein Deployment, Mobilebuild oder Ressourcenedit in diesem Plan.

Privater Originalrezeptnachweis bleibt MANUAL VALIDATION REQUIRED, sofern Originaldaten/Revision spaeter autorisiert vorliegen; dann privat gegen das neue Kurzfassungsziel pruefen, ohne Rezept-/Modelltexte ins Repository oder Logging zu uebernehmen. Synthetische Tests und Proberender beweisen weder den historischen Fehlerfix auf Alpha noch echten Multi-Image-Share.

Planner hat nur gelesen und dieses neue Planartefakt erstellt. Artefakt-/Link-/Strukturpruefung ist keine Implementation, Testsuite, Live-QA oder Abnahme. Keine anderen Dateien werden in diesem Planungsauftrag geaendert.
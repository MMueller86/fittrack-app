# Definition: Templategebundener Rezept-Exporttext

Status: [Planned] Spezifikationsentwurf zur Freigabe, keine Implementierung oder Feature-Abnahme.
Datum: 2026-10-09

> [Deprecated] Historischer Entwurf, fuer die aktuelle Preparation durch den
> [am 2026-10-09 nutzerfreigegebenen Feedback-Loop-Plan](PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md)
> ersetzt. Ein-Aufruf-Vorgabe, Zutaten-Auslassungsstrategie, neue Pauschalbudgets
> und Drei-Zeilen-Produktregel unten sind kein aktueller Implementierungsvertrag.
> Siehe [aktuellen KB-Vertrag](../../kb/tech/06-ai-integrations.md#preparation-feedback-loop-current-r2):
> [Partial] implementiert, nicht abgenommen, F FAIL / R/G NOT_RUN, kein Loop-Alpha-Release.
> Der historische Entwurf bleibt unveraendert dokumentiert.

## Ziel und feste Randbedingungen

Die Vorbereitung liefert nur einen transienten KI-Entwurf, dessen generierte Exporttexte in das unveraenderte Instagram-Detailtemplate passen. Es bleibt bei einem KI-Aufruf pro Vorbereitung, einem festen Bildformat und der bestehenden Nutzerpruefung. Kein Font-Fallback, kein anderes Template, keine weiteren Bilder, kein Abschneiden, kein automatischer KI-Korrekturaufruf und keine Speicherung ohne Bestaetigung.

Die Garantie gilt fuer die geometrische Passung akzeptierter Exporttexte unter derselben Template-, Font-, Renderer- und Textlayoutversion. Sie ist keine Garantie, dass jeder Provideraufruf einen akzeptierbaren Entwurf liefert, dass dessen Kochinhalt semantisch korrekt ist oder dass der spaetere Bilddownload und native Renderer immer verfuegbar sind.

## Nachgewiesenes Problem

Der aktuell erlaubte Umfang von 90 Zeichen garantiert keine Passung. Dieser reale Alpha-Text hat 76 Zeichen und keine expliziten Zeilenumbrueche:

> Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.

Bei vier Schritten verwendet das Template Inter Medium 22 px und lineHeight 1.25. Die Produktionsmessung meldete 300 x 112 px bei erlaubten 302 x 105 px. Eine lokale Satori-Messung mit der Produktionsschrift reproduzierte 112 px Hoehe. Die Ablehnung ist korrekt; die bisherige Zeichenvorgabe ist nicht ausreichend. Dieser Satz wird ein verbindlicher Regressionstest, kein alleiniger Nachweis einer allgemeinen Zeichengrenze.

## Verbindliche geometrische Definition

Quelle: `backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts`, `render.ts` und `detailTextLayout.ts`.

| Schrittanzahl | Layout | Schrift | lineHeight | Textbreite | Maximale Zeilenhoehe |
|---|---|---|---|---|---|
| 1 bis 4 | large | Inter Medium, 22 px, Gewicht 500 | 1.25 | 302 px | 105 px |
| 5 | compact | Inter Medium, 18 px, Gewicht 500 | 1.17 | 318 px | 84 px |

"Zeilenhoehe" bezeichnet hier die gesamte Hoehe einer Schrittzeile im Template, nicht die Hoehe einer einzelnen Textzeile.

Die harte Annahmeregel fuer jeden Schritt lautet: Die echte Produktionsmessung muss endliche Werte liefern und Breite sowie Hoehe muessen innerhalb der unveraenderten Renderergrenzen liegen. Die aktuelle numerische Rundungs-/Toleranzregel des Renderers wird wiederverwendet, nicht durch eine zweite abweichende Pruefung ersetzt. Eine fehlende Messung ist niemals Erfolg.

Als einheitliches Erzeugungsziel sind hoechstens drei umgebrochene Textzeilen vorgesehen. Vier Zeilen passen im large-Layout nachweislich nicht; die nominale Rechnung fontSize * lineHeight ersetzt nicht die Satori-Messung. Die tatsaechliche Hoehe bleibt entscheidend.

Auch der KI-generierte Teaser muss im bestehenden Beschreibungsbereich passen, einschliesslich seiner bestehenden Layoutregeln. Das bisherige Limit von 96 Zeichen ist ebenfalls nur eine strukturelle Grenze, kein geometrischer Nachweis. Gespeicherte Titel, Zutaten und sonstige nicht generierte Inhalte werden nicht stillschweigend umgeschrieben. Ein passender Exportschritt allein garantiert deshalb nicht die Passung des gesamten Detailbilds.

## Textregeln fuer Prompt und Server

1. Ein bis fuenf nichtleere Schritte; Reihenfolge und Referenzregeln bleiben unveraendert.
2. Jeder Schritt ist eine kurze, verstaendliche deutsche Kochanweisung im aktiven Imperativ. Die Vorgabe eines vollstaendigen Satzes bleibt bestehen.
3. Keine expliziten Zeilenumbrueche, Tabs, Steuerzeichen, Emojis oder unsichtbaren Layoutzeichen in generierten Schritttexten und Teaser. Einfache Leerzeichen trennen Woerter; Texte sind getrimmt. Die genaue erlaubte Zeichenmenge muss vor Aktivierung festgelegt werden, einschliesslich deutscher Umlaute, ss/Eszett, Zahlen und notwendiger Temperatur-/Satzzeichen.
4. Zutatenlisten aus dem Zutatenbereich nicht mechanisch im Schritt wiederholen. Komponenten duerfen eindeutig zusammengefasst werden, sofern ihre Zuordnung verstaendlich bleibt. Die KI darf zum Beispiel "Vermische die Teigzutaten zu einem Teig." formulieren, wenn die Quelle diesen Bezug eindeutig traegt. Das ist ein Formulierungsbeispiel, kein Ersatz fuer Quellenpruefung.
5. Zentrale Vorbereitung, notwendiges Garen, wesentliche eigenstaendige Beilagen/Saucen und notwendige Uebergaenge erhalten. Erhaltene Zeiten, Temperaturen und Methoden duerfen nicht widerspruechlich veraendert werden. Referenzgueltigkeit allein beweist keinen Kochkern.
6. Nicht passende Texte vollstaendig kuerzer formulieren. Kein Wortabbruch, kein Abschneiden und keine erfundenen Abkuerzungen, Zeiten, Temperaturen oder Ersatzhandlungen.
7. Ein neues Zeichen- und Wortlaengenbudget gilt erst nach dem unten beschriebenen Nachweis. Es wird aus einer zentralen Definition in Prompt und Serverpruefung uebernommen; keine unabhaengig gepflegten Zahlen.

## Herleitung des sicheren KI-Budgets

Ein neues pauschales Limit wie 60 oder 70 Zeichen wird hier bewusst nicht als bewiesen festgelegt.

Vor Aktivierung muss die Implementierung folgende Nachweise liefern:

1. Erlaubte Zeichenmenge, Normalisierung, Leerzeichenregel und maximale Wortlaenge eindeutig definieren. Reale Temperatur-/Zeitangaben und deutsche Kochbegriffe muessen darstellbar bleiben.
2. Beide Schrittlayouts mit den vorhandenen Fontdateien und derselben Satori-/Hyphenationslogik untersuchen. Der schlechteste Fall ueber beide Layouts bestimmt das einheitliche Budget.
3. Glyphenbreiten, Shaping/Kerning, Leerzeichen, ganze Woerter, Umbruchverluste und gegebenenfalls eingefuegte Trennzeichen in einer konservativen oberen Schranke beruecksichtigen. "Zeichenanzahl mal breiteste Glyphe" oder durchschnittliche Saetze allein sind kein hinreichender Nachweis fuer mehrzeiligen Wortumbruch.
4. Eine ausreichende Schranke fuer maximal drei Textzeilen und die gemessenen Hoehengrenzen herleiten. Die Ableitung muss die erlaubten Eingaben abdecken, nicht nur eine Stichprobe.
5. Die Schranke gegen Produktionsmessungen testen: breite Buchstabenfolgen, lange erlaubte Woerter, viele kurze Woerter, Interpunktion, Umlaute, Temperaturen und Grenzwerte. Property-/Fuzztests ergaenzen den Nachweis, ersetzen ihn aber nicht.
6. Das resultierende Zeichen-/Wortbudget und seine Version in dieser Definition dokumentieren. Wenn eine ausreichend sichere pauschale Schranke sprachlich unbrauchbar ist, dies als Entscheidungspunkt vorlegen; nicht heimlich das Template aendern oder die Garantie behaupten.

[Open] Numerische neue Zeichen- und Wortlaengengrenzen sowie die vollstaendige erlaubte Zeichenmenge sind noch nicht hergeleitet. Dieser Abschnitt ist eine Aktivierungssperre fuer die Behauptung "alle regelkonformen Texte passen ohne weitere Messung". Die exakte geometrische Annahmeregel oben ist bereits definiert und bleibt in jedem Fall erforderlich.

## Promptvertrag

Der Preparation-Prompt erhaelt einen expliziten Zielblock mit beiden Layouts, dem gemeinsamen nachgewiesenen Zeichen-/Wortbudget und diesen Anweisungen:

> Das Ziel ist das feste Instagram-Detailtemplate. Schreibe kurze, quelltreue Kochanweisungen mit hoechstens drei visuellen Textzeilen. Halte das vorgegebene Zeichen- und Wortbudget sowie die erlaubten Zeichen ein. Keine expliziten Zeilenumbrueche. Wiederhole keine vollstaendigen Zutatenlisten. Bei Platzmangel formuliere neu; schneide nichts ab und veraendere keine notwendigen Garparameter. Die Pixelpassung wird serverseitig gemessen; eine eigene Behauptung "passt" ist kein Nachweis.

Die konkreten Zahlen werden erst nach dem Budgetnachweis eingesetzt. Der Prompt verlangt keine Pixelberechnung durch das Sprachmodell und keine zusaetzlichen Felder wie fitsTemplate. Die bestehende kleine Strict-Structured-Output-Form bleibt erhalten. Unterstuetzte JSON-Schema-Grenzen werden verwendet; nicht unterstuetzte String-/Layoutregeln werden verbindlich im Backend geprueft. Provider-Schema-Unterstuetzung ist vor einer Aenderung zu verifizieren.

## Validierungsablauf und Fehlervertrag

1. Authentifizierung, Request-/Quellpruefung und Quotenpruefung wie bisher vor dem Provideraufruf.
2. Genau ein Preparation-Aufruf. Keine zweite Analyse und kein Reparaturaufruf.
3. Bestehende Schema-, Quellenreferenz- und Metadatenpruefungen sowie die neuen Textregeln anwenden.
4. Den Vorschlag mit demselben Adapter/Textlayout wie beim Teilen messen. Zu pruefen sind mindestens alle KI-generierten Schritte und der Teaser. Keine parallele vereinfachte Messlogik, keine Pixelpruefung anhand von Zeichenanzahl und kein PNG-/Blobdownload allein fuer die Textpruefung.
5. Erst nach erfolgreicher Validierung den transienten Entwurf zur Nutzerpruefung zurueckgeben und die bestehende erfolgreiche Nutzungsbuchung genau einmal ausfuehren. Auf Ablehnung keine Nutzungsbuchung und keine Persistenz.
6. Beim spaeteren Teilen die vorhandene Renderpruefung beibehalten. Nutzertexte, anderer Schrittumfang, andere Zutaten-/Titeldaten oder eine neue Templateversion koennen die fruehere Pruefung ungueltig machen.

[Planned] Ein geometrisch unpassender KI-Entwurf fuehrt bei der Vorbereitung zu HTTP422 mit einem stabilen maschinenlesbaren Fehlercode. Vorgeschlagener Code: RECIPE_EXPORT_TEXT_DOES_NOT_FIT. Die bestehende Fehlerhuelle wird wiederverwendet; vor Implementierung ist die Mobile-Kompatibilitaet abzustimmen. Die Antwort enthaelt keine Diagnosetexte oder Messpayloads. Ein bestehender Entwurf und das gespeicherte Rezept bleiben unveraendert. Keine automatische Wiederholung derselben Anfrage.

Fehlende Fonts, fehlgeschlagene Messung, Provider-/Asset-/Rendererstoerungen sind technische Fehler nach dem vorhandenen Fehlervertrag, keine behauptete Textueberschreitung. HTTP429 bleibt die Quotenreaktion. Der Provider kostet auch bei spaeterer Ablehnung Ressourcen; das ist von der Nutzerquotenbuchung zu unterscheiden.

## Fehlerdiagnostik

[Planned] Fuer einen geometrisch abgelehnten Preparation-Text gelten dieselben gezielten Diagnoseprinzipien wie fuer den bereits implementierten Share-Schrittueberlauf: Stadium, Fehlercode, Prompt-/Textbudgetversion, Feld/Index, betroffener Text, Schrittanzahl/Layout, Textlaenge, maximale Wortlaenge und gemessene versus erlaubte Breite/Hoehe. Nur der betroffene generierte Text wird protokolliert, nicht das gesamte Rezept, Quelltext, Request oder Providerpayload. Keine Geheimnisse und keine Textpayloads in Erfolgslogs oder HTTP-Fehlerantworten.

Die aktuelle KB schliesst Preparation-Texte in Fehlerlogs noch aus. Die gezielte Ausnahme fuer diese neue geometrische Pruefung muss zusammen mit der Implementierung dokumentiert und getestet werden; sie ist derzeit nicht implementiert.

## Abnahmekriterien

| ID | Nachweis |
|---|---|
| AC-1 | Template, Fontgroessen, feste Bildanzahl und Format bleiben unveraendert. |
| AC-2 | Numerisches Textbudget und erlaubte Zeichen sind mit dokumentierter konservativer Umbruch-/Hoehenschranke hergeleitet; keine unbewiesene neue Zeichenzahl. |
| AC-3 | Alle erlaubten Schrittanzahlen 1 bis 5 werden mit Produktionsfonts/-layout geprueft; auch Teaser und fehlende Messungen sind abgedeckt. |
| AC-4 | Der reale 76-Zeichen-Satz wird bei vier Schritten bereits in Preparation abgelehnt. Eine quelltreue kuerzere Teig-Anweisung besteht die geometrische Pruefung. |
| AC-5 | Ein akzeptierter, unveraenderter Entwurf besteht dieselbe Textpruefung beim Teilen unter gleicher Templateversion. Das ist keine Garantie fuer andere gespeicherte Bildfelder oder technische Verfuegbarkeit. |
| AC-6 | Bei 422 kein Entwurfserfolg, kein Schreibzugriff, keine Nutzungsbuchung, kein zweiter Provideraufruf; bestehende Daten bleiben unveraendert. |
| AC-7 | Lange Woerter, breite Zeichen, Leerzeichen, Unicode-/Steuerzeichen, Grenzfaelle und technische Probe-/Fontfehler besitzen fokussierte Tests. |
| AC-8 | Fehlerlogs sind reproduzierbar und auf betroffene Texte beschraenkt; keine Textwerte in HTTP-Antworten oder Erfolgslogs. |
| AC-9 | Live-Evals pruefen Renderpassung und separat Kochkern/Quelltreue. Kleinere Texte duerfen bisherige semantische QA-Fehler nicht verdecken. |
| AC-10 | Promptversion und bewusst gepruefte Eval-Version werden aktualisiert; Backend-Units, Build-Verifikation und erforderliche Live-Evals bestehen vor Abnahme. |

## Umsetzung und Scope

Diese Definition autorisiert keine Deploymentausfuehrung und ist kein freigegebener subsystemsuebergreifender Implementierungsplan. Vor Umsetzung ist ein Planner-/Orchestrator-Paket fuer Prompt/Textbudget, wiederverwendete Textmessung, Preparation-Handler, Fehlervertrag, Tests und KB erforderlich. Mobile muss die neue Preparation-Ablehnung verstaendlich behandeln; kein neues Response-Erfolgsformat und keine Cosmos-Migration sind vorgesehen. Import-Exportvorschlaege sind ein weiterer Erzeugungspfad und erhalten durch diese Preparation-Definition noch keine Rendergarantie.

## Referenzen

- [Systemarchitektur](../../kb/tech/01-system-overview.md)
- [Backend- und aktueller Preparation-Vertrag](../../kb/tech/02-backend.md)
- [KI-Fachregeln](../../kb/domain/07-ai-features.md)
- [Preparation-v19-Plan](PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md)
# Anforderungsuebergabe: Recipe Preparation Feedback-Loop

Status: Nutzer bestaetigt das Verhalten und fordert Umsetzung mit anschliessendem Alpha-Functions-Deployment. Kein Planner-Implementierungsplan, kein implementierter oder gepruefter Release.

## Bestaetigte Anforderungen

- Das bestehende Instagram-Template und seine Schrift-/Layoutregeln bleiben unveraendert.
- Die konservative 23-Zeichen-/11-Zeichen-Wortgrenze ist vom Nutzer verworfen und darf nicht als neue Produktregel implementiert werden.
- Preparation erzeugt einen Erstentwurf und validiert ihn einschliesslich der tatsaechlichen Template-Textpassung.
- Bei korrigierbaren Validierungsfehlern sind maximal zwei KI-Korrekturversuche erlaubt: Erstentwurf plus zwei Korrekturen, maximal drei logische Provideraufrufe.
- Jede Korrektur erhaelt den urspruenglichen Rezeptkontext, den letzten Entwurf und konkrete strukturierte Validierungsfehler. Bei Textueberlauf enthalten diese das betroffene Feld/den Index sowie gemessene und erlaubte Abmessungen und das Layout.
- Die Anweisung lautet sinngemaess: Korrigiere den betroffenen Text so, dass die angegebenen Grenzen eingehalten werden; erhalte Kochhandlung, notwendige Garparameter und Quellenzuordnung; lasse bereits passende Schritte unveraendert.
- Keine Anweisung, Zutatenlisten nicht zu wiederholen oder eine bestimmte Kuerzungsstrategie zu verwenden. Die KI entscheidet selbst, wie sie den Text korrigiert.
- Jede korrigierte Ausgabe wird vollstaendig erneut geprueft. Die KI bestaetigt die Passung nicht selbst. Struktur, Referenzen und bestehende Validierungsregeln bleiben verbindlich.
- Kein Abschneiden, keine Endlosschleife, kein Layout-Fallback, keine automatische Speicherung und kein zusaetzlicher Aufruf nach ausgeschöpften zwei Korrekturen.
- Nach der zweiten erfolglosen Korrektur wird der relevante abgelehnte Text zusammen mit den Fehlerdiagnosen protokolliert, sodass die Ursache reproduzierbar ist. Keine kompletten Requests, Rezeptquellen, Providerpayloads, Bilder oder Geheimnisse loggen.
- Erfolgreich validierte Vorbereitung wird einmal als Erfolg gezaehlt; gescheiterte Entwuerfe werden nicht gespeichert. Quotenbehandlung muss den bestehenden Erfolg-/Fehlervertrag erhalten.
- Technische Provider-, Font-/Mess-, Auth- und Quotenfehler sind keine Aufforderung zur Textkorrektur. Der Loop muss ausserdem ein begrenztes Gesamtzeitbudget besitzen; SDK-interne Retries sind im Aufrufbudget ausdruecklich zu beruecksichtigen.
- Nach abgeschlossener Korrektur und erfolgreicher Verifikation ist das Azure-Functions-Deployment nach Alpha vom Nutzer autorisiert. Kein Mobile-Build und keine Infrastruktur-Aenderung angefordert.

## Reproduktionsfall

Alpha-Ereignis vom 2026-10-09T14:14:10.876Z:

> Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.

Vier Schritte; large-Layout; 76 Zeichen; gemessen 300 x 112 px; erlaubt 302 x 105 px. Die lokale Produktionsfont-Probe reproduziert 112 px Hoehe bei Inter Medium 22 px/lineHeight1.25. Dieser Fall muss den Korrekturpfad testen, nicht nur einen kuenstlichen Mockfehler.

## Relevante Implementierungsanker

- [Preparation-Handler](../../../backend/src/functions/recipes.ts): prepareRecipeExportViewHandler.
- [Provider](../../../backend/src/lib/openai.ts): prepareRecipeExport und RecipeExportPreparationOutput.
- [Prompt](../../../backend/src/lib/prompts/recipeAnalyze.ts): Preparation v4; Import v16 ist ein separater Pfad.
- [Outputvalidierung](../../../backend/src/lib/recipeAnalyzeValidation.ts).
- [Produktionsrenderer](../../../backend/src/lib/instagramRenderer/render.ts), [Template](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts) und [Textlayout](../../../backend/src/lib/instagramRenderer/detailTextLayout.ts).
- [Backend-Vertrag und Logginggrenzen](../../kb/tech/02-backend.md): Preparation schliesst Textwerte bisher aus; die gezielte Abschlussfehler-Ausnahme ist mit Implementierung und Tests zu dokumentieren.
- [Vorheriger Definitionsentwurf](SPEC_Recipe-Export_Template-Textvertrag_2026-10-09.md): Die Ein-Aufruf-Vorgabe und die vorgeschlagene pauschale Worst-Case-Grenze werden durch die neuesten Nutzeranforderungen ersetzt, nicht implementiert.

## Erforderliche Verifikation fuer das Umsetzungspaket

Erfolg beim Erstentwurf, Erfolg nach Korrektur 1 und 2 sowie vollstaendige Ausschoepfung mit maximal drei logischen Aufrufen testen. Der Provider muss jeweils letzte Ausgabe und konkrete Fehler erhalten. Erfolgsbuchung einmal, bei finaler Ablehnung keine Buchung und keine Schreibzugriffe. Abschlusslogs enthalten den betroffenen letzten Text und Fehlerwerte, aber keine unbeteiligten Payloads. Technische Fehler und Timeout beenden den Loop ohne weitere Textkorrektur. Echte Font-/Layoutpruefung fuer alle Schrittanzahlen und den Teaser verwenden; geaenderte Schritte und Referenzen erneut pruefen. Semantische Kochkern-Evals bleiben unabhaengig vom geometrischen Erfolg erforderlich.

Backend-Units, Typecheck, build:verify und erforderliche Prompt-Live-Evals muessen vor dem Release berichtet werden. Bestehende v19-QA-Fehler nicht als behoben ausweisen, sofern diese nicht separat nachgewiesen sind.

## Prozessblocker und Release-Uebergabe

Die Backend-Rolle verlangt fuer diese subsystemuebergreifende Aenderung ein freigegebenes Planner-/Orchestrator-Task-Paket und fuehrt keine Deployments aus. In dieser Sitzung ist kein Tool zum Aufrufen der benannten Planner-/Release-Subagenten verfuegbar. Diese Datei ist deshalb eine dauerhafte Anforderungsuebergabe, keine behauptete Agentenbeauftragung.

Naechste Verantwortliche: Planner/Orchestrator erstellt und routet das Umsetzungspaket; Backend implementiert; QA prueft; Infrastructure & Release fuehrt den vom Nutzer angeforderten Alpha-Functions-Release aus. Release-Gates: sauberer build:verify, robocopy-/MIR-Sync nach _deploy_staging, Artefaktpruefung, Linux Node22 Remote-Publish, Functionliste, health200 und geschuetzte Route401; authentifizierten Rezeptflow und finale Fehlerlogs soweit ein Testkontext verfuegbar ist pruefen. Releasebericht und verbleibende Verifikationsgrenzen dokumentieren.
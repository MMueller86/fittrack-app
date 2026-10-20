Lege das als User STory an,  und lasse es umsetzen

# User Story – Dynamische KI-Begrüßung mit FitTrack Insight

## 1. User Story

Als FitTrack-Nutzer möchte ich auf dem Homescreen eine persönliche KI-Begrüßung mit einer relevanten Erkenntnis erhalten, damit ich direkt beim Öffnen der App einen hilfreichen Impuls bekomme.

## 2. Produktentscheidungen

- Die bisherige statische Begrüßung wird durch eine **KI-generierte Begrüßung mit integriertem Insight** ersetzt.
- Die KI erzeugt:

- Eine kurze, persönliche Begrüßung mit passendem Emoji.
- Einen vollständigen Satz mit einer konkreten Erkenntnis oder Empfehlung.
- Über **„Mehr lesen“** öffnet sich der vollständige FitTrack Insight.
- Die separate Insight-Karte entfällt.
- Die Trainingstagsauswahl bleibt rechts in der Begrüßungskarte.
- Die bestehende Insight-Generierung und Aktualisierungslogik wird weiterverwendet.
- Bei fehlendem Insight erscheint eine statische Begrüßung.

## 3. Darstellung

Beispiel:

**Guten Morgen, Micha! 🚴**

Heute steht deine lange Radtour an. Denk daran, ausreichend Kohlenhydrate einzuplanen!

**Mehr lesen ›**

Die Karte bleibt kompakt und entspricht dem bestehenden FitTrack-Design.

## 4. Akzeptanzkriterien

1. Begrüßung und Kurz-Insight werden gemeinsam durch die KI generiert.
2. Die Kurzfassung besteht aus genau einem verständlichen, vollständigen Satz.
3. Die Aussage basiert ausschließlich auf verfügbaren FitTrack-Daten.
4. „Mehr lesen“ öffnet den vollständigen Insight.
5. Die bisherige Insight-Aktualisierungslogik bleibt erhalten.
6. Die separate Insight-Karte wird entfernt.
7. Die Begrüßungskarte bleibt auf kleinen Smartphones übersichtlich.

## 5. Verbindliche PO-Klarstellungen vor Approval (2026-10-16)

Status: Geplant; kein APPROVE vorhanden, keine Implementierungs-, Lösch-, Migrations- oder Deploy-Freigabe. Die Originalanforderung oben bleibt wörtlich erhalten; die folgenden Klarstellungen ersetzen abweichende illustrative Beispiele und bisherige offene Planner-Vorschläge.

Neue Produktentscheidungen des Users VERBATIM:

```text
"PO-1: Ich folge der Empfehlung:
PO-2:  wir müssen nicht aus legacy rücksicht nehmen... "
```

- PO-1 entschieden: Die KI erzeugt gemeinsam mit Kurz-Insight und Volltext eine tageszeitneutrale persönliche Begrüßung nach dem Muster „Hallo, <Name>! <Emoji>“. Keine neuen Refresh-Trigger; die statische Fallback-Begrüßung bleibt wie bisher.
- PO-2 entschieden: Keine zusätzliche Legacy-Rücksicht. Der bisherige Vorschlag „statische Begrüßung plus Mehr lesen zum alten Volltext bis regulärer Erneuerung“ entfällt. Es gibt keine besondere Alt-Insight-Präsentation, keine Versionsausnahme für diese Erweiterung und keine zusätzliche Legacy-Kompatibilitätsmatrix. Das berechtigt weder zum Löschen noch zu Migration/Backfill oder Zwangsgenerierung und verändert keine bestehende Generierungs-/Refresh-Regel.
- Allgemeiner Fallback, keine Legacy-Sonderlösung: Nur ein verfügbarer Insight mit beiden gültigen neuen Kurzfeldern wird integriert angezeigt; fehlen Insight oder vollständiges Feldpaar, erscheint die bestehende statische Begrüßung ohne Kurzsatz und ohne „Mehr lesen“. Dafür wird weder Volltext abgeschnitten noch ein zusätzlicher Request ausgelöst. Unveränderte optionale Lesbarkeit gespeicherter Dokumente bleibt technische Datensicherheit, keine zugesagte Legacy-UX.
- „Mehr lesen“ öffnet bei gültiger integrierter Anzeige den vollständigen zugehörigen Insight einschließlich bestehender CTAs und Feedback. Die Trainingstagsauswahl bleibt rechts; die separate Insight-Karte entfällt.
- Das illustrative Beispiel mit „Guten Morgen“ und zwei Sätzen ist nicht verbindlich: Die KI-Begrüßung ist tageszeitneutral, der Kurz-Insight genau ein vollständiger Satz.
- Die acht maßgeblichen, testbaren ACs sowie Scope, Arbeitspakete und Gates stehen im [vollständigen Plan](docs/User%20Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md). Keine offenen PO-Punkte; der Orchestrator muss den vollständigen aktualisierten Plan unverändert präsentieren und erst danach explizit APPROVE erfragen.
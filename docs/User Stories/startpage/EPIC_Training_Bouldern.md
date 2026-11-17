# FitTrack: Trainingsbereich und Boulder-Tracking

Stand: 16.11.2026  
Status: Fachliches Epic als Grundlage für Planung und Story-Erstellung  
Projekt: Gesundheits APP / FitTrack

## 1. Vision und Ziel

FitTrack erweitert die bisherige Erfassung von Ernährung und Gesundheitsdaten um Sport-Tracking. Nutzer sollen Training einfach dokumentieren, vergangene Einheiten nachvollziehen und sportartspezifisch Fortschritte verfolgen können.

Bouldern ist die erste Sportart. Die Navigation und die gemeinsame Trainingsstruktur sollen weitere Sportarten aufnehmen können, ohne für jede Sportart einen neuen Haupttab einzuführen. Krafttraining oder Radfahren sind mögliche spätere Erweiterungen, kein Bestandteil der ersten Umsetzung.

Dieses Epic beschreibt die abgestimmte fachliche Richtung und die gewünschten Abläufe. Der Planner konkretisiert daraus UI, Architektur, Umsetzungsschritte und einzelne User Stories mit Akzeptanzkriterien. Offene Produktentscheidungen sind in Abschnitt 9 ausdrücklich getrennt aufgeführt.

## 2. Zentrale Produktentscheidungen

- Ein gemeinsamer Hauptbereich „Training“ bündelt alle Sportarten.
- Die erste Version enthält eine Trainingsübersicht, einen Verlauf und einen nutzbaren Boulderbereich mit Hallen und Projekten.
- Normale Boulder werden innerhalb einer Session erfasst. Nur als Projekt markierte Boulder werden über mehrere Sessions weitergeführt.
- Die Erfassung während des Trainings soll mit wenigen Eingaben möglich sein. Zusatzinformationen bleiben optional.
- Hallen haben eigene Schwierigkeitsskalen. Deren Reihenfolge wird ausdrücklich festgelegt.
- Ein eigener Bereich „Fortschritt“ gehört zur Vision. Detaillierte Auswertungen werden später fachlich spezifiziert.

## 3. Einbettung in die App

### 3.1 Hauptnavigation und Trainingsübersicht

„Training“ wird ein eigener Hauptbereich der App. Die konkrete Position in der bestehenden Navigation und die Wiederverwendung vorhandener Komponenten ermittelt der Planner anhand des aktuellen App-Stands.

Die Trainingsübersicht bietet:

- Einen direkten Einstieg „Bouldern starten“, solange Bouldern die einzige genutzte Sportart ist.
- Eine deutlich sichtbare Aktion „Training fortsetzen“, wenn eine Session läuft.
- Die letzten Trainingseinheiten mit Zugang zur jeweiligen Zusammenfassung.
- Einen Zugang zum Boulderbereich mit Hallenverwaltung und offenen Projekten.

Mit weiteren Sportarten soll der Einstieg die zuletzt genutzten Sportarten direkt anbieten. Ein zusätzlicher Auswahldialog bei jedem Start soll dadurch vermeidbar sein.

### 3.2 Verlauf

Der Verlauf zeigt Trainingseinheiten chronologisch. Die Struktur unterstützt später einen Filter nach Sportart; bei ausschließlich Bouldern ist eine zusätzliche Filterinteraktion nicht erforderlich.

Eine Einheit kann geöffnet werden, um Ergebnisse anzusehen und fehlerhafte Angaben zu korrigieren.

### 3.3 Sportartspezifische Verwaltung

Hallen, Schwierigkeitsskalen und Boulderprojekte werden innerhalb des Trainingsbereichs bei Bouldern verwaltet. Spätere Sportarten erhalten dort ihre jeweiligen Inhalte, beispielsweise Trainingspläne und Übungen für Krafttraining.

### 3.4 Verbindung zur Startseite

Während einer laufenden Session erscheint auf der Startseite eine kompakte Karte „Bouldern läuft · Training fortsetzen“. Sie führt unmittelbar zurück in die Erfassung. Der Wechsel in andere App-Bereiche erhält die Session und ihre bisherigen Einträge.

Eine kurze Zusammenfassung nach dem Training ist eine optionale spätere Ergänzung. Die detaillierte Erfassung und Auswertung bleiben im Trainingsbereich.

## 4. Boulderhalle und Schwierigkeitsskala

Nutzer können eine Halle mit Namen und eigener Schwierigkeitsskala anlegen.

| Skalentyp | Fachliche Konfiguration |
| --- | --- |
| Farben | Frei konfigurierbare Farbstufen mit festgelegter Reihenfolge von leicht nach schwer |
| Zahlen | Zahlenstufen von 1 bis zu einer bei der Hallenanlage festgelegten Obergrenze |

Die Skala wird bei der Hallenanlage mitgegeben und bei der Erfassung verwendet. Farbstufen müssen eindeutig auswählbar und erkennbar sein; konkrete Beschriftung und Darstellung arbeitet der Planner aus.

Die Stufen gelten innerhalb der jeweiligen Halle. Eine hallenübergreifende Gleichsetzung von Farben oder Zahlen ist fachlich nicht definiert.

## 5. Session und schnelle Erfassung

### 5.1 Session starten

1. Nutzer wählt „Bouldern starten“.
2. Nutzer wählt die Halle; die zuletzt genutzte Halle ist vorausgewählt.
3. Falls erforderlich, kann eine neue Halle samt Skala angelegt werden.
4. Die Session wird mit Datum und Halle geführt.
5. Die Erfassung zeigt die Schwierigkeitsstufen dieser Halle und einen direkten Zugang zu ihren offenen Projekten.

Eine Session lässt sich beenden und anschließend als Zusammenfassung aufrufen. Details zu Zeiterfassung und nachträglicher Session-Anlage sind noch zu konkretisieren.

### 5.2 Angaben je Boulder

| Angabe | Fachliche Bedeutung |
| --- | --- |
| Schwierigkeit | Stufe aus der Skala der ausgewählten Halle |
| Versuche | Anzahl der Versuche in dieser Session, inklusive erfolgreichem Versuch |
| Ergebnis | „Offen“, „Geschafft“ oder „Flash“ |
| Fortschrittsstatus | Optionale vordefinierte Angabe zum erreichten Fortschritt |
| Kommentar | Optionaler Freitext, beispielsweise ein technischer Hinweis |
| Projekt | Kennzeichnung für die Weiterführung bei einem späteren Besuch |
| Wiedererkennung | Optional Foto, Hallenbereich oder kurze Bezeichnung, insbesondere für Projekte |

Ein normaler Eintrag benötigt keine dauerhafte Identifikation des Boulders über verschiedene Besuche hinweg.

### 5.3 Schnellaktionen und Ergebnislogik

Nach Auswahl der Schwierigkeit stehen zwei große Aktionen zur Verfügung:

- „Fehlversuch +1“ erhöht die Versuchszahl um eins.
- „Geschafft“ erfasst den erfolgreichen Versuch und setzt das Ergebnis entsprechend.

Ein Erfolg nach zwei Fehlversuchen ergibt somit drei Versuche insgesamt. Die Versuchszahl und das Ergebnis bleiben korrigierbar. Versehentliche Einträge können gelöscht werden.

„Flash“ bedeutet Erfolg beim allerersten Versuch an diesem Boulder. Bei normalen Einträgen kennt die App frühere Besuche nicht: Erfolg beim ersten erfassten Versuch kann als Flash vorgeschlagen werden, muss aber abwählbar sein. Der Nutzer kann stattdessen „Geschafft“ wählen.

Bei Projekten werden die bekannten früheren Versuche berücksichtigt. Ein Erfolg im ersten Versuch der aktuellen Session ist nach früheren Fehlversuchen kein Flash. Ergebnisangaben müssen konsistent bleiben, auch nach einer Korrektur.

### 5.4 Fortschritt und Kommentar

Fortschrittsstatus und Freitext sind getrennte optionale Angaben. Vorgesehene Statuswerte:

- Einstieg geschafft
- Etwa zur Hälfte geschafft
- Kurz vor dem Top
- Top erreicht, nicht gehalten

Diese Angaben ergänzen das Ergebnis „Offen“ und dienen der Orientierung beim nächsten Versuch. Das Projektmerkmal ist davon unabhängig.

## 6. Projekte über mehrere Sessions

Ein erfasster Boulder kann als Projekt markiert werden, wenn der Nutzer bei einem späteren Besuch daran weiterarbeiten möchte.

### Projekt fortsetzen

1. Nutzer startet eine Session in derselben Halle.
2. Die offenen Projekte dieser Halle sind direkt erreichbar.
3. Nutzer wählt ein Projekt und sieht die bisherigen Versuche sowie Fortschritt und Kommentare.
4. Neue Versuche werden der aktuellen Session zugeordnet und zusätzlich in der Projektgesamtzahl berücksichtigt.

Frühere Session-Einträge und Kommentare bleiben nachvollziehbar. Das Fortsetzen erzeugt kein zweites unabhängiges Projekt.

### Projekt abschließen oder archivieren

- Bei Erfolg verschwindet der Boulder automatisch aus den offenen Projekten.
- Der Erfolg und die bisherigen Versuche bleiben in der Historie nachvollziehbar.
- Entfernte oder umgeschraubte Boulder können archiviert werden; sie erscheinen anschließend nicht mehr als offene Projekte.
- Historische Trainingsdaten bleiben beim Archivieren erhalten.

## 7. Zusammenfassung und spätere Auswertungen

Die erste Version bietet je Session:

- Anzahl der erfassten beziehungsweise versuchten Boulder.
- Gesamtzahl der Versuche.
- Anzahl geschaffter Boulder, einschließlich Flashs.
- Flashs zusätzlich separat ausgewiesen, ohne sie doppelt als Erfolge zu zählen.
- Verteilung der Boulder und Ergebnisse nach Schwierigkeit.

Ein eigener Bereich „Fortschritt“ kann später sportartspezifische Entwicklungen zeigen, beispielsweise die Entwicklung geschaffter Schwierigkeitsstufen. Kennzahlen, Zeiträume und Vergleichsregeln sind vor dessen Umsetzung gesondert festzulegen. Die offenen Projekte sind bereits in der ersten Version im Boulderbereich verfügbar.

## 8. Verbindung zu Gesundheitsdaten und besonderer Aktivität

Ein erfasstes Training soll keine zusätzliche manuelle Erfassung derselben Aktivität unter „Besondere Aktivität“ erfordern. Bei einer späteren Berücksichtigung in Tagesbilanz oder Insight müssen beide Erfassungswege dieselbe Aktivität ohne Doppelzählung abbilden können.

Die konkrete Wirkung auf das Kalorienziel ist noch nicht festgelegt. Regelmäßiges Training kann bereits im Profil berücksichtigt sein. Aus einer erfassten Boulder-Session folgt deshalb in diesem Epic noch keine Regel für zusätzliche Kalorien.

Der Planner untersucht die bestehenden Zusammenhänge und legt eine konkrete Empfehlung vor. Insbesondere müssen Aktivitätsanrechnung, Tagesbilanz und gegebenenfalls Insight konsistent bleiben. Die Trainingsplanung kann unabhängig von der noch offenen Kalorienentscheidung ausgearbeitet werden.

## 9. Offene Punkte für die Konkretisierung

Das fachliche Grundkonzept ist ausreichend, um Planung und Story-Erstellung zu starten. Folgende Punkte sind noch zu entscheiden beziehungsweise vom Planner mit einem konkreten Vorschlag vorzulegen:

| Punkt | Klärungsauftrag |
| --- | --- |
| Trainingsdauer | Genügen Datum und Session-Abschluss, oder werden Start, Ende und eine korrigierbare Dauer benötigt? Pausenzeiten und deren Bedeutung bei einer möglichen Kalorienberechnung berücksichtigen. |
| Nachträgliche Erfassung | Vorschlag für das Anlegen vergangener Sessions und die Datumsänderung ausarbeiten. |
| Hallen und Skalen ändern | Verhalten bei Umbenennung, geänderter Skala und nicht mehr genutzten Hallen festlegen. Historische Einträge müssen weiterhin verständlich bleiben. |
| Hallenbesitz | Für die erste Version persönliche Hallenverwaltung als Vorschlag prüfen. Ein gemeinsamer Hallenkatalog oder das Teilen von Hallen ist bisher nicht beschlossen. |
| Projekt-Korrekturen | Verhalten beim Entfernen des Projektmerkmals sowie nach Korrektur oder Löschung eines erfolgreichen Projekt-Eintrags definieren. |
| Kalorien und besondere Aktivität | Bestehende Anrechnung prüfen; Empfehlung zur Verknüpfung und zur Vermeidung doppelter Kalorienanrechnung vorlegen. Produktentscheidung vor Umsetzung der Anrechnung einholen. |
| Session-Sicherung | Konkretes Verhalten bei App-Neustart, Verbindungsverlust und erneutem Öffnen festlegen. Bereits erfasste Versuche sollen zuverlässig erhalten bleiben. |

Diese Punkte sind keine bereits beschlossenen Zusatzfunktionen. Der Planner trennt technische Detailentscheidungen von Produktfragen und bündelt notwendige Rückfragen mit Empfehlungen.

## 10. Auftrag an den Planner

1. Aktuelle Navigation, UI-Komponenten, Datenhaltung und Aktivitätslogik im Repository prüfen.
2. Das Epic in überschaubare fachliche User Stories mit konkreten Abläufen und prüfbaren Akzeptanzkriterien zerlegen.
3. Gemeinsame Trainingsbestandteile und boulderspezifische Inhalte so strukturieren, dass weitere Sportarten ergänzbar sind. Den Umfang auf den tatsächlichen Bedarf der ersten Sportart begrenzen.
4. In jeder UI-Story Navigation, Interaktionen, Zustände und wiederverwendete Komponenten ausdrücklich benennen. Bestehendes FitTrack-Layout und vorhandene Interaktionsmuster verwenden.
5. Architektur, erforderliche Backend- und Mobile-Arbeiten, Abhängigkeiten und sinnvolle Umsetzungsreihenfolge konkret beschreiben.
6. Offene Produktfragen aus Abschnitt 9 mit Vorschlägen vorlegen und Annahmen deutlich kennzeichnen.
7. Die Stories und den Plan zur fachlichen Prüfung vorlegen. Die Implementierung ist ein nachgelagerter Schritt.

### Orientierung für die Story-Zerlegung

- Trainingsbereich und Navigation.
- Hallenanlage und Schwierigkeitsskalen.
- Boulder-Session mit schneller Erfassung und Korrektur.
- Projekte über mehrere Sessions.
- Trainingsverlauf und Session-Zusammenfassung.
- Fortsetzen einer Session über Startseite und Trainingsbereich.
- Integration in bestehende Aktivitätslogik nach Klärung der Anrechnung.

Dies ist eine thematische Orientierung, keine fertige Story-Liste oder technische Arbeitspaketplanung.

## 11. Fachliche Prüfkriterien für das spätere Review

- Ein erster Hallenbesuch lässt sich einschließlich Hallenanlage und Boulder-Erfassung vollständig abbilden.
- Bei einem weiteren Besuch kann der Nutzer direkt starten und offene Projekte wiederfinden.
- Normale Boulder benötigen keine zusätzliche dauerhafte Routenverwaltung.
- Versuchszahlen, Erfolge und Flashs bleiben auch über mehrere Projekt-Sessions konsistent.
- Optionaler Fortschritt, Freitext und Projektmerkmal haben klar getrennte Bedeutungen.
- Archivierte Projekte und geänderte Hallen führen nicht zu unverständlicher Trainingshistorie.
- Weitere Sportarten passen in den Trainingsbereich, ohne neue Haupttabs zu benötigen.
- Die geplante Aktivitätsanrechnung berücksichtigt vorhandene Profilannahmen und verhindert Doppelzählung.

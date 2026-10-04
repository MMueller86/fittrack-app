# User Story – Mehrfachauswahl im Ernährungstagebuch

## User Story

Als FitTrack-Nutzer möchte ich im Ernährungstagebuch mehrere Lebensmittel oder ganze Mahlzeiten auswählen können, damit ich vorhandene Aktionen gesammelt auf mehrere Einträge anwenden kann.

Die Story beschreibt das gewünschte Produktverhalten. Die technische Integration in die bestehende Tagebuchfunktion wird durch den Planner festgelegt.

## Produktverhalten

Im Ernährungstagebuch kann ein **Auswahlmodus** aktiviert werden.

Innerhalb dieses Auswahlmodus können ausgewählt werden:

- einzelne Lebensmittel-Einträge
- ganze Mahlzeiten
- mehrere Einträge gleichzeitig
- Kombinationen aus Einträgen verschiedener Mahlzeiten

Die Auswahl muss für den Nutzer eindeutig sichtbar sein.

Wird eine ganze Mahlzeit ausgewählt, gelten alle zu dieser Mahlzeit gehörenden Lebensmittel-Einträge als ausgewählt.

Für die aktuelle Auswahl stehen folgende Aktionen zur Verfügung:

- **Löschen**
- **Verschieben …**
- **Auf anderen Tag kopieren**

Die bereits vorhandenen Funktionen für Löschen, Verschieben und Kopieren sollen dabei auch mit einer Mehrfachauswahl funktionieren.

## Verhalten der Aktionen

### Löschen

Alle ausgewählten Einträge werden gemeinsam gelöscht.

Vor dem endgültigen Löschen erfolgt die bestehende bzw. übliche Löschbestätigung.

### Verschieben …

Alle ausgewählten Einträge werden gemeinsam auf das ausgewählte Ziel verschoben.

Das bestehende Verhalten zum Verschieben eines einzelnen Eintrags dient als fachliche Grundlage.

### Auf anderen Tag kopieren

Alle ausgewählten Einträge werden auf einen vom Nutzer ausgewählten Tag kopiert.

Die ursprünglichen Einträge bleiben unverändert bestehen.

Die kopierten Einträge entsprechen den ausgewählten Originaleinträgen und können anschließend wie normale Tagebuch-Einträge bearbeitet werden.

## Akzeptanzkriterien

1. Der Nutzer kann im Ernährungstagebuch einen Mehrfachauswahlmodus starten.
2. Einzelne Lebensmittel-Einträge können ausgewählt und wieder abgewählt werden.
3. Ganze Mahlzeiten können ausgewählt und wieder abgewählt werden.
4. Es können mehrere Lebensmittel und/oder Mahlzeiten gleichzeitig ausgewählt werden.
5. Die aktuelle Auswahl ist jederzeit eindeutig erkennbar.
6. Die Aktionen **Löschen**, **Verschieben …** und **Auf anderen Tag kopieren** können auf die gesamte Auswahl angewendet werden.
7. Beim Kopieren bleiben die ursprünglichen Einträge bestehen.
8. Beim Verschieben werden die ursprünglichen Einträge an das gewählte Ziel verschoben.
9. Beim Löschen werden ausschließlich die ausgewählten Einträge entfernt.
10. Nach Abschluss oder Abbruch einer Aktion wird der Auswahlmodus beendet bzw. die Auswahl zurückgesetzt.

## Nicht Bestandteil dieser Story

- Freunde oder Kontakte
- Zugriff auf Ernährungstagebücher anderer Nutzer
- Übernahme von Einträgen anderer Nutzer
- neue Kopier-, Lösch- oder Verschiebelogik außerhalb der notwendigen Unterstützung der Mehrfachauswahl

Diese Funktionen bauen später auf der hier geschaffenen Mehrfachauswahl auf.

# User Story – Eigene Boulderhallen und Schwierigkeitsskalen

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitt 5.5), Screens S2 und S2b in [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md).

## 1. User Story

Als Boulderer möchte ich meine eigenen Boulderhallen mit ihrer Schwierigkeitsskala anlegen, damit ich beim Training nur die Stufen der jeweiligen Halle sehe, egal an welchen Orten ich unterwegs bin.

## 2. Produktentscheidungen

- Hallen sind persönlich. Jeder Nutzer legt seine Hallen für sich an; andere Nutzer sehen sie nicht. Ein gemeinsamer Hallenkatalog ist eine mögliche spätere Erweiterung und nicht Teil dieser Story.
- Eine Halle hat einen Namen und optional einen Ort (hilft bei Ketten mit mehreren Standorten oder bei Reisen). Gibt es unter den eigenen Hallen schon dieselbe Kombination aus Name und Ort, wird die vorhandene Halle angeboten.
- Skalentyp `Farben` oder `Zahlen`, einmal festgelegt und danach nicht mehr änderbar.
  - Farben: aus einer festen Palette mit zwölf benannten Farben (Weiß, Gelb, Orange, Grün, Türkis, Blau, Lila, Pink, Rot, Braun, Grau, Schwarz), jede Farbe höchstens einmal je Halle, Reihenfolge von leicht nach schwer, optional eigene Beschriftung. Jede Farbe hat ein Kürzel.
  - Zahlen: Stufen 1 bis zur gewählten Obergrenze (Vorbelegung 7, maximal 20).
- Stufen werden nie gelöscht. Nicht mehr benötigte Stufen werden deaktiviert und erscheinen nur noch in der Historie.
- Eine Halle lässt sich löschen, solange keine Session und kein Projekt sie verwendet. Verwendete Hallen bleiben erhalten.
- Die Liste der eigenen Hallen ist durchsuchbar (Name, Ort). Es wird kein Standort abgefragt.
- Die Sortierung der Stufen ändert der Nutzer mit Pfeil-Buttons nach oben und unten (statt Drag), damit kein neues natives Modul nötig ist.

## 3. Akzeptanzkriterien

1. Im Training-Hub gibt es einen Zugang zur Hallenliste. Sie zeigt die eigenen Hallen mit Name und Ort und eine Suche.
2. Die Suche filtert die eigenen Hallen nach Teilen von Name oder Ort, unabhängig von Groß-/Kleinschreibung und Umlauten.
3. `Halle anlegen` erfordert einen Namen und einen Skalentyp mit mindestens zwei Stufen; der Ort ist optional.
4. Eine Halle mit gleichem Namen und Ort wie eine eigene bestehende Halle kann nicht noch einmal angelegt werden; stattdessen wird die vorhandene angeboten.
5. Bei Farben können Farben aus der Palette hinzugefügt, entfernt (vor dem Speichern), umsortiert und optional beschriftet werden. Jede Farbe ist je Halle nur einmal wählbar.
6. Bei Zahlen kann die Obergrenze zwischen 2 und 20 gewählt werden; die Stufen werden als `1` bis `N` angezeigt.
7. Der Nutzer kann Name, Ort, Beschriftungen, Farben, Reihenfolge und Aktiv-Status der Stufen ändern und neue Stufen ergänzen. Er kann keine Stufe löschen und den Skalentyp nicht ändern.
8. Eine Halle ohne Sessions und Projekte lässt sich löschen; eine verwendete Halle nicht (verständliche Meldung).
9. Andere Nutzer sehen die Hallen nicht und können sie nicht abrufen.
10. Farbstufen sind auch ohne Farbwahrnehmung unterscheidbar (Name oder Kürzel sichtbar).

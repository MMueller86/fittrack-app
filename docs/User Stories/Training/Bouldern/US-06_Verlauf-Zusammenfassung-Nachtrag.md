# User Story – Verlauf, Zusammenfassung und nachträgliche Session

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitte 5.6, 6), Screens S7, S8, S9 in [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md).

## 1. User Story

Als Boulderer möchte ich meine vergangenen Sessions mit einer Zusammenfassung ansehen, falsche Angaben korrigieren und eine vergessene Session nachtragen, damit mein Trainingsverlauf vollständig und richtig ist.

## 2. Produktentscheidungen

### Verlauf

- Der Verlauf zeigt beendete Sessions chronologisch (neueste zuerst), gruppiert nach Monat. Eine Zeile zeigt Datum, Halle, Dauer sowie Anzahl Boulder und Versuche.
- Er ist über den Training-Hub erreichbar (`Letzte Einheiten`, `Alle anzeigen`).
- Laufende Sessions erscheinen nicht im Verlauf.
- Die Liste lädt seitenweise nach.
- Die Struktur lässt später einen Filter nach Sportart zu (noch nicht vorhanden).

### Zusammenfassung

Die Zusammenfassung einer Session zeigt:

- Datum, Halle, Zeitraum und Dauer.
- Anzahl der erfassten Boulder und Gesamtzahl der Versuche.
- Anzahl geschaffter Boulder (einschließlich Flash) und die Flashs zusätzlich separat, ohne doppelte Zählung als Erfolg.
- Die schwerste geschaffte Stufe.
- Die Verteilung nach Stufe mit der Zahl der Boulder und der geschafften Boulder.
- Die Liste der Einträge.

Beim Beenden einer Session erscheint nach dem Beenden-Sheet diese Zusammenfassung.

### Korrigieren

- Einträge einer beendeten Session lassen sich wie in der Erfassung korrigieren und löschen.
- Datum, Beginn und Ende lassen sich ändern. Die Dauer ergibt sich aus Beginn und Ende. Ein Ende vor dem Beginn ist nicht möglich.
- Die Halle einer Session lässt sich nicht ändern. Eine Session in der falschen Halle wird gelöscht und neu angelegt.
- Eine ganze Session lässt sich löschen (mit Bestätigung).

### Nachträgliche Session

- Im Verlauf legt `Session nachtragen` eine vergangene Session an: Datum (Standard gestern, kein Zukunftsdatum), Halle, optional Beginn und Ende.
- Danach erfasst der Nutzer die Boulder mit der gleichen Oberfläche wie live, ohne laufenden Timer und mit dem Hinweis `Nachtrag · <Datum>`.
- `Speichern` beendet den Nachtrag. Der Tagestyp-Bereich zeigt das Datum der Session.
- Ein Nachtrag ohne Einträge wird beim Verlassen verworfen.

## 3. Akzeptanzkriterien

1. Der Verlauf listet beendete Sessions nach Datum absteigend, mit Monatsüberschriften, und lädt weitere Seiten beim Scrollen nach.
2. Jede Zeile zeigt Datum, Halle, Dauer (oder `–` ohne Zeiten), Anzahl Boulder und Versuche.
3. Ein Tap auf eine Zeile öffnet die Zusammenfassung der Session.
4. Die Zusammenfassung zeigt die in Abschnitt 2 genannten Kennzahlen, wobei Flashs in der Zahl der geschafften Boulder enthalten sind und zusätzlich separat stehen.
5. Nach `Session beenden` öffnet sich die Zusammenfassung dieser Session.
6. Einträge der Zusammenfassung lassen sich antippen und bearbeiten sowie durch Wischen löschen; die Kennzahlen aktualisieren sich.
7. Datum, Beginn und Ende lassen sich ändern; Ende vor Beginn und ein Zukunftsdatum werden abgelehnt.
8. Die Halle einer Session ist nicht änderbar.
9. `Session löschen` fragt in einem Bestätigungs-Sheet nach und entfernt die Session samt Einträgen aus dem Verlauf.
10. `Session nachtragen` legt eine beendete Session für das gewählte Datum an, ein Zukunftsdatum ist nicht wählbar.
11. Im Nachtragsmodus zeigt die Erfassung `Nachtrag · <Datum>` statt eines Timers und `Speichern` statt `Beenden`.
12. Ein Nachtrag ohne Einträge wird beim Verlassen automatisch gelöscht.
13. Der Tagestyp-Bereich beim Speichern eines Nachtrags bezieht sich auf das Datum der Session.
14. Der Verlauf zeigt bei fehlenden Sessions `Noch keine Einheiten.`; bei Ladefehlern `Erneut versuchen`.

# User Story – Trainingstag aus der Session ableiten

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitt 5.7), [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md) (S6).

## 1. User Story

Als Boulderer möchte ich beim Beenden meiner Session mit einem Tap festlegen, dass dieser Tag ein Bouldern-Trainingstag ist, damit ich ihn nicht zusätzlich auf dem Homescreen eintragen muss und mein Tagesziel zu meinem Training passt.

## 2. Produktentscheidungen

- Aus einer Session entstehen **keine** zusätzlichen Kalorien. Es wird nur der Tagestyp des Session-Datums gesetzt.
- Im Sheet beim Beenden erscheint je nach Zustand des Tages:

| Zustand des Tages | Anzeige |
|---|---|
| Kein Tagestyp gesetzt oder ausdrücklich Ruhetag | Chip `Heute als Trainingstag (Bouldern) eintragen`, **vorbelegt**, abwählbar. Hinweis: `Es gilt dein Trainingstag-Ziel.` |
| Trainingstag ohne Workout-Typ | Chip `Als Bouldern eintragen`, vorbelegt, abwählbar. Das Tagesziel ändert sich nicht. |
| Trainingstag mit Workout-Typ Bouldern | Nichts. |
| Trainingstag mit anderem Workout-Typ (z. B. Gym) | Einzelauswahl `Welches Training gilt für heute?` mit den beiden Typen, vorbelegt mit dem bestehenden. Die Wahl bestimmt das Icon auf Home und im Wochenrückblick. Das Tagesziel ändert sich nicht. |

- Eine Besondere Aktivität (Wandern, Radfahren) ist unabhängig und ändert diese Regeln nicht.
- Eine Mehrfachauswahl mehrerer Workout-Typen gibt es nicht.
- Die Auswahl ist Teil des Beenden-Sheets (kein Pop-up). Die Session wird immer beendet, auch wenn das Setzen des Tagestyps fehlschlägt; dann erscheint ein Hinweis mit `Erneut versuchen`.
- Für eine nachträgliche Session (andere Story) gilt dieselbe Regel für das Datum der Session.

## 3. Akzeptanzkriterien

1. Ohne gesetzten Tagestyp zeigt das Beenden-Sheet den vorbelegten Chip; `Session beenden` setzt den Tag auf Trainingstag mit Workout-Typ Bouldern.
2. Bei ausdrücklich gesetztem Ruhetag verhält es sich genauso.
3. Wird der Chip abgewählt, bleibt der Tagestyp unverändert.
4. Bei Trainingstag ohne Workout-Typ erscheint der Chip `Als Bouldern eintragen`; das Setzen ändert nur den Workout-Typ.
5. Bei Trainingstag mit Bouldern erscheint kein zusätzliches Element.
6. Bei Trainingstag mit anderem Workout-Typ erscheint die Einzelauswahl, vorbelegt mit dem bestehenden Typ; die Wahl von Bouldern setzt den Workout-Typ auf Bouldern; die Wahl des bestehenden Typs ändert nichts.
7. Eine vorhandene Besondere Aktivität ändert Anzeige und Verhalten nicht und wird nicht verändert.
8. Nach dem Beenden zeigt Home den neuen Tagestyp, ohne dass die App neu gestartet werden muss.
9. Schlägt das Setzen des Tagestyps fehl, ist die Session trotzdem beendet und ein Hinweis mit `Erneut versuchen` erscheint.
10. Die Kalorienziele werden außerhalb der bestehenden Tagestyp-Logik nicht verändert.

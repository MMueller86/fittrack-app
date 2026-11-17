# User Story – Boulder-Session starten, erfassen und beenden

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitte 2, 4, 5.1 bis 5.3, 5.8), Klickfolgen in [KONZEPT_02_Klickfolgen.md](KONZEPT_02_Klickfolgen.md), Screens S1, S3, S4, S6 in [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md).

## 1. User Story

Als Boulderer möchte ich während des Trainings meine Boulder mit möglichst wenigen Taps erfassen, damit ich meine Session festhalte, ohne dass mich das Handy vom Klettern abhält.

## 2. Produktentscheidungen

### Starten

- Im Training-Hub startet `Starten` die Session sofort in der zuletzt genutzten Halle (ein Tap). `Andere Halle` öffnet die Hallenauswahl. Ohne letzte Halle öffnet `Starten` die Hallenauswahl.
- Pro Nutzer läuft höchstens eine Session. Läuft eine, zeigt der Hub `Training fortsetzen`.
- Starten braucht eine Verbindung. Ohne Verbindung erscheint ein Hinweis.

### Erfassen

- Hauptweg: erst klettern, dann eintragen. Stufe wählen, Versuchszahl mit einem Tap auf einen Zahlenchip (1 bis 5) oder mit `−` und `+`, dann `Geschafft` oder `Offen`.
- Wer nach jedem Versuch zählt, tippt `+` nach jedem Versuch und am Ende `Geschafft` oder `Offen`.
- Die Versuchszahl ist die Gesamtzahl einschließlich des erfolgreichen Versuchs, Startwert 1.
- `Geschafft` bei einem Versuch ergibt automatisch `Flash`. Ein Hinweis mit `Kein Flash` erlaubt die Korrektur auf `Geschafft`.
- Nach `Geschafft` oder `Offen` bleibt die Stufe gewählt und der nächste Boulder beginnt mit einem Versuch.
- Wechselt der Nutzer die Stufe, nachdem er die Versuchszahl geändert, aber kein Ergebnis gewählt hat, wird der Boulder als `Offen` gespeichert (mit `Rückgängig`). Bei unveränderter Versuchszahl 1 wird nichts gespeichert.
- Jeder Eintrag lässt sich korrigieren: Zeile antippen öffnet ein Detail-Sheet (Versuche, Ergebnis, Fortschritt, Zone, Kommentar). Wischen nach links löscht mit `Rückgängig`.
- Fortschritt (`Einstieg geschafft`, `Etwa zur Hälfte geschafft`, `Kurz vor dem Top`, `Top nicht kontrolliert`), Zone und Kommentar sind immer optional und nie blockierend. Fortschritt gilt nur für nicht geschaffte Boulder.
- Keine Pflichtangaben, keine Tastatur und keine Bestätigungsdialoge in der Erfassung.
- Der Bildschirm bleibt während der Session an, jede gespeicherte Aktion gibt haptisches Feedback, und die Tab-Leiste ist ausgeblendet. Zurück verlässt die Erfassung, die Session läuft weiter.

### Beenden

- `Beenden` öffnet ein Sheet mit Kurzbilanz und `Session beenden` (zwei Taps insgesamt). Ohne Einträge steht dort `Session verwerfen`.
- Das Beenden setzt die Endzeit. Die Verknüpfung mit dem Tagestyp folgt in einer eigenen Story.

### Verbindung

- Jede Aktion wird sofort gesendet. Schlägt das Senden fehl, steht an der Zeile `Nicht gespeichert · Erneut senden`.
- Eine Offline-Zwischenspeicherung gibt es noch nicht: Wird die App beendet, bevor Aktionen gesendet wurden, gehen sie verloren. Bei Verbindungsverlust zeigt die Erfassung einen Hinweis.
- Beim erneuten Öffnen der App ist die laufende Session wieder da.

## 3. Akzeptanzkriterien

1. `Starten` im Hub startet die Session in der letzten Halle mit einem Tap; ohne letzte Halle führt es zur Hallenauswahl, nach der Wahl startet die Session.
2. Eine zweite Session kann nicht gestartet werden, solange eine läuft; stattdessen wird die laufende fortgesetzt.
3. Ein Boulder im ersten Versuch geschafft ist mit zwei Taps erfasst (Stufe, `Geschafft`) und als `Flash` gespeichert.
4. Ein Boulder nach fünf Versuchen geschafft ist mit drei Taps erfasst (Stufe, Chip `5`, `Geschafft`) und als `Geschafft` mit fünf Versuchen gespeichert.
5. `Offen` speichert den Boulder als nicht geschafft mit der gewählten Versuchszahl.
6. Das Zählen mit `+` führt zum gleichen Ergebnis wie der Zahlenchip.
7. Nach einem Eintrag bleibt dieselbe Stufe gewählt und die Versuchszahl steht wieder auf 1.
8. Ein Wechsel der Stufe mit geänderter Versuchszahl (mindestens 2) und ohne Ergebnis speichert `Offen`; ohne Änderung wird nichts gespeichert.
9. `Kein Flash` im Hinweis ändert einen Flash in `Geschafft` bei einem Versuch; `Rückgängig` entfernt den eben erstellten Eintrag.
10. Im Detail-Sheet lassen sich Versuche, Ergebnis, Fortschritt, Zone und Kommentar ändern; `Flash` ist nur bei genau einem Versuch wählbar; Fortschritt ist nur bei `Offen` wählbar.
11. Wischen nach links löscht einen Eintrag; `Rückgängig` stellt ihn wieder her.
12. Die Statuszeile zeigt Boulder, Versuche und geschaffte Boulder der Session; die Kopfzeile zeigt Halle und die laufende Dauer.
13. Schlägt das Senden fehl, ist der betroffene Eintrag markiert und mit `Erneut senden` wiederholbar, ohne dass ein Eintrag doppelt entsteht.
14. Schließen und erneutes Öffnen der App stellt die laufende Session mit allen gesendeten Einträgen wieder her.
15. `Beenden` öffnet ein Sheet mit Kurzbilanz; `Session beenden` setzt die Endzeit, `Session verwerfen` (ohne Einträge) löscht die Session.
16. Während der Erfassung bleibt der Bildschirm an, die Tab-Leiste ist ausgeblendet und Zurück verlässt die Erfassung, ohne die Session zu beenden.
17. Alle Haupt-Ziele (Stufen, Zahlenchips, `Offen`, `Geschafft`) sind mindestens 48 dp hoch, `Offen` und `Geschafft` mindestens 56 dp.
18. Bei der Kontolöschung werden Sessions und Einträge gelöscht.
19. Die Datenschutzerklärung nennt die Trainingsdaten und deren Löschung bei der Kontolöschung.

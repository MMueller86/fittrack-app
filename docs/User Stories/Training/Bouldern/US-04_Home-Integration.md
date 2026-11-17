# User Story – Training auf dem Homescreen

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitte 3.4, 5.1), [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md) (Home-Karte).

## 1. User Story

Als Boulderer möchte ich auf der Startseite meine laufende Session sofort fortsetzen oder eine neue mit einem Tap starten können, damit ich im Training nicht erst durch die App navigieren muss, und ich möchte erinnert werden, wenn ich vergessen habe, eine Session zu beenden.

## 2. Produktentscheidungen

- **Läuft eine Session:** Eine kompakte Karte `Bouldern läuft · <Dauer>` mit Halle und Anzahl Boulder führt mit einem Tap zurück in die Erfassung.
- **Läuft keine Session:** Hat der Nutzer für heute den Tagestyp Trainingstag mit Workout-Typ Bouldern gesetzt und existiert für heute noch keine Boulder-Session (weder laufend noch beendet noch nachgetragen), erscheint eine kompakte Karte `Bouldern starten · <Halle>` mit dem Button `Starten`. Er startet die Session in der zuletzt genutzten Halle. Gibt es noch keine zuletzt genutzte Halle, heißt der Button `Halle wählen` und öffnet die Hallenauswahl (mit Anlegen einer neuen Halle); nach der Wahl startet die Session. In allen anderen Fällen zeigt Home keine Trainingskarte. Nur der Button startet, nicht die ganze Karte.
- Beide Karten stehen direkt unter der Begrüßungskarte, haben die Kartenbreite der übrigen Home-Karten und sind kompakt gehalten.
- Der Wechsel in andere App-Bereiche und zurück erhält die Session.
- **Vergessene Session:** Liegt die letzte Aktivität einer laufenden Session zwei Stunden oder länger zurück, erscheint beim Öffnen von Home oder Training und beim Zurückkehren in die App ein Hinweis: `Noch laufende Session · Beenden um <Uhrzeit der letzten Aktivität>?` mit `Beenden`, `Fortsetzen` und `Verwerfen`. `Beenden` setzt die Endzeit auf die letzte Aktivität (ohne Einträge: auf die Startzeit). `Fortsetzen` schließt den Hinweis bis zum nächsten Rückkehren in die App. Es gibt keine Push-Benachrichtigung.
- Schlägt das Laden der Session fehl, bleibt die Karte unsichtbar und Home bleibt unverändert benutzbar.

## 3. Akzeptanzkriterien

1. Bei laufender Session zeigt Home die Karte `Bouldern läuft` mit Dauer, Halle und Boulder-Anzahl; ein Tap öffnet die Erfassung.
2. Ist für heute der Tagestyp Trainingstag mit Workout-Typ Bouldern gesetzt, läuft keine Session und existiert für heute keine Session, zeigt Home die Karte `Bouldern starten · <Halle>`; der Button `Starten` startet die Session und öffnet die Erfassung; ein Tap auf den Kartentext startet nichts.
3. Ohne zuletzt genutzte Halle zeigt die Karte den Button `Halle wählen`; er öffnet die Hallenauswahl und nach der Wahl startet die Session.
3a. In allen anderen Fällen (anderer oder kein Tagestyp, anderer Workout-Typ, heute schon eine Session vorhanden) zeigt Home keine Trainingskarte.
4. Die Karten haben dieselben Außenkanten wie die Nachbarkarten und beeinträchtigen die Ladezeit der übrigen Home-Karten nicht.
5. Schlägt die Abfrage fehl, wird keine Karte und kein Fehler angezeigt.
6. Eine laufende Session mit Aktivität vor mindestens zwei Stunden löst den Hinweis aus; vor weniger als zwei Stunden nicht.
7. `Beenden` im Hinweis beendet die Session mit der Zeit der letzten Aktivität; `Verwerfen` löscht sie; `Fortsetzen` lässt sie unverändert und der Hinweis erscheint nicht erneut, bis die App aus dem Hintergrund zurückkehrt.
8. Der Hinweis nutzt die App-eigene Sheet-/Overlay-Darstellung (kein `Alert.alert`).

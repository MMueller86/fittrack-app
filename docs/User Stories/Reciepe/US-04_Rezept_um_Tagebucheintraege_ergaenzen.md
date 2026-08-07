# User Story – Rezept um Tagebucheinträge ergänzen

## User Story

Als Nutzer möchte ich bei der Neuanlage eines Rezeptes zusätzlich geeignete Einträge aus meinem Ernährungstagebuch übernehmen können, damit ich vorhandene Lebensmittel wiederverwenden und das Rezept über den bestehenden Freitext-Flow vervollständigen kann.

## Akzeptanzkriterien

1. Der Nutzer kann einen Tag auswählen und daraus einzelne geeignete Tagebucheinträge oder komplette Mahlzeiten selektieren.
2. Es werden ausschließlich die ausgewählten Einträge übernommen.
3. Normale Lebensmitteleinträge werden als bereits aufgelöste Zutaten in die bestehende Zutatenliste eingefügt.
4. Eingetragene Rezepte werden entsprechend der im Tagebuch erfassten Menge in ihre zugrunde liegenden Einzelzutaten aufgelöst und übernommen.
5. KI-Schätzungen können nicht als Zutatenquelle ausgewählt werden.
6. Übernommene Zutaten können wie jede andere Rezeptzutat bearbeitet, ersetzt, gelöscht oder in ihrer Menge angepasst werden.
7. Der Freitext bleibt vollständig nutzbar und wird durch die bestehende KI-Logik analysiert.
8. Freitext und Tagebucheinträge sind unabhängig voneinander optional. Mindestens eine der beiden Eingabequellen muss jedoch verwendet werden.
9. Tagebucheinträge und Ergebnisse aus dem Freitext werden zu einer gemeinsamen Zutatenliste zusammengeführt. Doppelt erkannte Zutaten sollen bei eindeutiger Zuordnung automatisch zusammengeführt werden. Ist die Zuordnung nicht eindeutig, bleiben beide Einträge erhalten.
10. Für ergänzende Zutaten aus dem Freitext gelten dieselben Regeln zur Zutatenklassifizierung und Produktsuche wie im Standard-Flow.
11. Die bestehende Bearbeitung, Vorschau und Speicherung werden weiterverwendet.

## Hinweise für den Planner

- Die Tagebuchauswahl ist eine Erweiterung des bestehenden Recipe Builders und darf keinen separaten Erstellungsflow erzeugen.
- Für eingetragene Rezepte ist zu prüfen, wie der zum Tagebucheintrag gehörende Zutatenstand zuverlässig rekonstruiert wird.

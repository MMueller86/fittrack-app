# US-01: Gewichtsmessungen bearbeiten und nachtragen

## User Story
Als FitTrack-Nutzer möchte ich heutige und im Kalender ausgewählte Gewichtsmessungen ansehen, gezielt bearbeiten oder für einen leeren Tag nachtragen, damit Korrekturen keine zusätzliche Messung erzeugen und andere Messungen desselben Tages unverändert bleiben.

## Akzeptiertes Verhalten
- Ohne heutigen Eintrag zeigt die Progress-Karte die kompakte Gewichtseingabe. Sobald heute mindestens ein Eintrag vorliegt, verschwinden die dauerhaften Eingabefelder und die heutigen Werte werden einzeln antippbar angezeigt.
- Eine dezente Kalenderaktion öffnet die Datums- und Tagesansicht. Für den ausgewählten Tag werden alle vorhandenen Messungen einzeln angezeigt.
- Das Bearbeiten einer ausgewählten Messung öffnet den vorhandenen Wert und bietet `Aktualisieren`; ein neuer Eintrag bietet `Speichern`.
- Mehrere Messungen pro Tag bleiben möglich. Eine Änderung betrifft ausschließlich die ausgewählte Messung.

## Akzeptanzkriterien
1. Heute ohne Messung: kg-Eingabe und `Speichern` sind sichtbar. Nach erfolgreichem Eintragen erscheint der Wert als Bearbeiten-Auslöser und die dauerhafte Eingabe wird ausgeblendet.
2. Heute mit einer oder mehreren Messungen: alle Werte sind einzeln erkennbar und gezielt auswählbar; kein bestehender Wert wird automatisch als Updateziel angenommen.
3. Kalenderauswahl erlaubt heute und vergangene Tage. Bestehende Werte des gewählten Tages werden angezeigt; leere Tage können nachgetragen werden.
4. Beim Bearbeiten heißt die Aktion `Aktualisieren` und ändert nur die ausgewählte Messungs-ID. ID, Datum, Einheit und Erfassungszeit bleiben erhalten.
5. Eine ausdrücklich neu angelegte Messung bleibt ein eigener Eintrag; Einträge anderer Messungs-IDs desselben Tages bleiben unverändert.

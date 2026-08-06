# HC-3 – Ernährung mit Health Connect synchronisieren

## Ziel

Als Nutzer möchte ich meine in FitTrack dokumentierten Ernährungseinträge an Google Health Connect übertragen, damit Kalorien, Makronährstoffe, Ballaststoffe, Zeitpunkt und Mahlzeitenkategorie anderen kompatiblen Gesundheits-Apps zur Verfügung stehen.

## Architekturhinweise – durch den Planner zu validieren

- Die bestehende Synchronisationslösung aus HC-2 soll für Ernährung erweitert und wiederverwendet werden.
- Für jeden Ernährungseintrag soll die stabile interne FitTrack-ID zur Ableitung der `clientRecordId` verwendet werden. Es sollen keine zusätzlichen oder zufällig generierten Synchronisations-IDs eingeführt werden.
- Änderungen verwenden eine steigende `clientRecordVersion`.
- Der Planner validiert `WRITE_NUTRITION`, `NutritionRecord`, die Mahlzeitentypen, `clientRecordId`, `clientRecordVersion` und die erforderlichen Metadaten anhand der aktuellen Google-Dokumentation.
- Der Planner prüft insbesondere, welche Nährwertfelder optional sind und wie fehlende Werte gemäß aktuellen Health-Connect-Best-Practices abzubilden sind.
- Der Planner prüft die empfohlene Umsetzung für idempotente Re-Exporte sowie für Änderungen, Löschungen und Änderungen der Mahlzeitenkategorie.
- Der in HC-2 festgelegte persistente Retry-Mechanismus soll wiederverwendet werden.
- Der historische Export soll bei größeren Datenmengen in geeigneten Batches erfolgen und nach Unterbrechungen fortgesetzt werden können.

## Akzeptanzkriterien

- Der Nutzer kann die Ernährungssynchronisation im Health-Connect-Tab aktivieren.
- Vor der Aktivierung wird verständlich erklärt, dass alle vorhandenen Ernährungseinträge sowie zukünftige Änderungen und Löschungen mit Google Health Connect synchronisiert werden.
- Die Synchronisation erfolgt ausschließlich von FitTrack zu Google Health Connect. Ein Import von Ernährungsdaten aus Google Health Connect ist nicht Bestandteil dieser Story.
- Es wird ausschließlich die erforderliche Schreibberechtigung `WRITE_NUTRITION` angefordert.
- Für jeden FitTrack-Tagebucheintrag wird genau ein `NutritionRecord` erstellt.
- Es werden folgende Informationen übertragen:
  - Name des Ernährungseintrags
  - Kalorien
  - Protein
  - Kohlenhydrate
  - Fett
  - Ballaststoffe
  - Erfassungszeitpunkt
  - Zeitzone
  - Mahlzeitenkategorie
  - erforderliche Metadaten
- Rezepte, KI-Schätzungen und zusammengefasste Einträge werden entsprechend ihrer Darstellung als einzelner FitTrack-Tagebucheintrag synchronisiert.
- Fehlende optionale Nährwertfelder führen nicht zum Abbruch der Synchronisation und werden nicht künstlich mit `0` befüllt.
- Nach erfolgreicher Aktivierung werden alle vorhandenen Ernährungseinträge exportiert.
- Neue, geänderte und gelöschte Ernährungseinträge werden automatisch synchronisiert.
- Wird ein Ernährungseintrag einer anderen Mahlzeit zugeordnet (z. B. von Frühstück zu Mittagessen), wird diese Änderung ebenfalls automatisch mit Google Health Connect synchronisiert. Der Planner prüft, ob hierfür ein Update des bestehenden `NutritionRecord` oder ein Löschen und anschließendes Neuanlegen gemäß aktueller Health-Connect-Best-Practices empfohlen wird.
- Die Synchronisation erfolgt asynchron im Hintergrund und ohne zusätzliche Nutzeraktion. Das Speichern, Bearbeiten oder Löschen eines Ernährungseintrags in FitTrack wird dadurch nicht blockiert.
- Fehlgeschlagene Synchronisationsaufträge werden persistent gespeichert und abhängig von der Fehlerart erneut ausgeführt. Für das MVP erfolgt der erneute Versuch beim nächsten App-Start, beim Wechsel der App in den Vordergrund oder bei einem weiteren geeigneten Synchronisationsereignis.
- Wird die Berechtigung entzogen, wird der Nutzer informiert und die Ernährungssynchronisation in FitTrack deaktiviert.
- Bereits übertragene Daten bleiben bei Deaktivierung oder Berechtigungsentzug in Google Health Connect bestehen.
- Nach einer Neuinstallation oder einem Gerätewechsel muss der Nutzer die Ernährungssynchronisation erneut aktivieren. Anschließend erfolgt ein vollständiger, idempotenter Re-Export aller Ernährungseinträge.
- Erneute Exporte erzeugen keine zusätzlichen Health-Connect-Dubletten.
- Änderungen in FitTrack ersetzen den zuvor übertragenen Stand.
- Löscht der Nutzer einen Ernährungseintrag in FitTrack, wird der zugehörige `NutritionRecord` ebenfalls gelöscht.
- Änderungen anderer Apps an Health-Connect-Daten werden nicht nach FitTrack übernommen.
- Tages- oder Mahlzeitensummen werden nicht zusätzlich als eigene `NutritionRecord`s übertragen.
- Es wird keine Synchronisationsanzeige an einzelnen Ernährungseinträgen dargestellt.
- Die Dev-Build ermöglicht den vollständigen fachlichen Flow, ohne Daten in das reale Google Health Connect zu schreiben.

# User Story: Profil und Konto dauerhaft löschen

**Status:** Zur Umsetzung nach ausdrücklicher Planfreigabe durch den Orchestrator  
**Zugehöriger Plan:** [PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md](PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md)

## User Story

Als FitTrack-Nutzer möchte ich mein Profil und meine persönlichen FitTrack-Daten löschen können und entscheiden, ob meine veröffentlichten Community-Rezepte erhalten bleiben oder ebenfalls gelöscht werden, damit meine persönlichen Daten nicht weiter in FitTrack aktiv gespeichert sind.

Die automatisierte Funktion löscht keine Microsoft-Entra-External-ID/CIAM-Identität. Der Nutzer behandelt die Entra-Kontolöschung nach erfolgreicher FitTrack-Fachdatenlöschung als manuellen Folgeschritt außerhalb dieser Funktion.

## Akzeptanzkriterien

### AC-1: Bestehende Profilaktion aktivieren

Die derzeit deaktivierte Konto-Löschaktion im Profil ist aktiv und öffnet ein Bestätigungs-Overlay. Sie startet nicht schon beim Öffnen einen Löschrequest.

### AC-2: Auf die Löschung hinweisen

Das Overlay trägt den Titel **„Profil endgültig löschen?“** und zeigt den verbindlichen Hinweistext:

> Dein Profil, dein Anmeldekonto und deine persönlichen Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
>
> Gib zur Bestätigung DELETE ein.

Zusätzlich erklärt ein separater Hinweis, dass FitTrack das Microsoft-Entra-Anmeldekonto nicht automatisch löscht und der Nutzer es nach erfolgreicher FitTrack-Datenlöschung manuell löschen muss. Die Aussage „nicht rückgängig“ bezieht sich auf die in FitTrack verfügbare Anwendungslöschung; sie behauptet keine sofortige physikalische Entfernung von Azure-Plattform-Retention.

### AC-3: Community-Rezepte optional löschen

Hat der Nutzer eigene veröffentlichte Community-Rezepte, erscheint der Toggle **„Auch meine Community Rezepte löschen“**.

- Der Toggle steht bei jedem Öffnen des Overlays standardmäßig auf **„Nein“**.
- Der ergänzende Hinweis lautet exakt: **„Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.“**
- Nur wenn der Nutzer den Toggle auf **„Ja“** setzt, werden auch seine veröffentlichten Community-Rezepte gelöscht.
- Ohne eigene veröffentlichte Community-Rezepte werden Toggle und ergänzender Hinweis ausgeblendet.

### AC-4: Bewusste Bestätigung verlangen

Das Overlay enthält ein Eingabefeld sowie die Aktionen **„Abbrechen“** und **„Endgültig löschen“**.

- „Endgültig löschen“ ist erst aktiviert, wenn der Eingabewert exakt `DELETE` in Großbuchstaben entspricht.
- Erst ein anschließender Klick auf „Endgültig löschen“ startet die Löschung.
- Abbrechen, Schließen, Backdrop oder Plattform-Back vor dem Start verändern keine Daten und senden keinen Request.

### AC-5: Aktive FitTrack-Fachdaten löschen; Entra manuell nachgelagert

Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität.

Die automatisierte Funktion ruft Microsoft Graph nicht auf und löscht, deaktiviert oder widerruft die Entra External ID/CIAM-Identität nicht. Der Nutzer löscht diese Identität manuell nach erfolgreicher FitTrack-Fachdatenlöschung. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.

### AC-6: Bilder und Dateien löschen

Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten.

Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.

### AC-7: Erhaltene Community-Rezepte anonym anzeigen

Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar.

- Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer.
- Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt.
- Der Autor wird als **„Anonymous“** angezeigt.

### AC-8: Ausgewählte Community-Rezepte löschen

Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar.

Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.

### AC-9: Löschvorgang und Fehler behandeln

Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte.

Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.

### AC-10: App in den Erstnutzungszustand versetzen

Nach erfolgreicher FitTrack-Löschung werden lokale persönliche App-Daten, Health-Connect-Sync-Warteschlangen und lokale Sync-Diagnoseeinträge sowie Anmeldetokens entfernt. Die App zeigt den Login ohne automatische Wiederanmeldung. Nach einer späteren manuellen Anmeldung führt ein fehlendes Profil in den bestehenden Erstnutzungs-Wizard.

Bereits nach Health Connect exportierte Daten und Health-Connect-Berechtigungen werden nicht durch diese Kontolöschung entfernt.

### AC-11: Erneute Registrierung nach manueller Entra-Löschung

Eine Neuregistrierung mit derselben E-Mail ist erst nach der manuellen Entra-Kontolöschung relevant. Sie ist kein Implementierungs- oder QA-Blocker für die automatisierte FitTrack-Löschung. Frühere FitTrack-Daten und Community-Zuordnungen werden nicht wiederhergestellt.

### AC-12: Retention-Ausnahmen

- Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage.
- Bestehende Backups werden nicht verändert.
- Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

## Umfangsgrenzen

- Die Story automatisiert ausschließlich FitTrack-Fachdatenlöschung; es gibt keinen Microsoft-Graph-Aufruf.
- Freundschaften sind nicht Teil der heutigen Datenlöschung.
- Fremde Favoriten und Tagebuch-Snapshots bleiben selbst dann bestehen, wenn das referenzierte Community-Rezept gelöscht wird.
- Ein sicherer Retry setzt eine noch gültige Session voraus. Es wird kein automatischer Wiederanlauf nach Geräte-/Sitzungsausfall versprochen.

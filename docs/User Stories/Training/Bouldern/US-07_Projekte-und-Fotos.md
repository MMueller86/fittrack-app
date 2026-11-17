# User Story – Boulder-Projekte und Fotos

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md) (Abschnitte 5.2 bis 5.4, 7), Screens S3, S5, S10, S11 in [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md).

## 1. User Story

Als Boulderer möchte ich schwere Boulder als Projekt merken, mit einem Foto wiedererkennen und bei späteren Besuchen mit allen bisherigen Versuchen weiterführen, damit ich meinen Fortschritt an einem Boulder über mehrere Sessions sehe.

## 2. Produktentscheidungen

### Projekt anlegen

- Ein Boulder wird zum Projekt durch den Stern `★` auf der aktuellen Karte oder im Detail-Sheet.
- Wird ein Boulder mit drei oder mehr Versuchen als `Offen` gespeichert, bietet der Hinweis `Als Projekt merken` an. Dieselbe Aktion erscheint auf der Karte, sobald die Versuchszahl 3 oder höher ist. Der Stern bleibt immer verfügbar.
- Ein Projekt gehört zu Halle und Stufe, hat optional eine Zone und ein Foto und führt Versuche, Fortschritt und Kommentare je Session.

### Foto

- Das Kamera-Symbol auf der Karte und im Detail-Sheet öffnet die vorhandene Kamera-Erfassung. Ein Eintrag hat höchstens ein Foto (JPEG oder PNG, höchstens 8 MB, vor dem Hochladen verkleinert).
- Fotos sind privat. Das jüngste Foto eines Projekts ist sein Titelbild. Ein Foto lässt sich ersetzen oder löschen.
- Wird ein Foto aufgenommen, bevor der Eintrag gespeichert ist, wird es nach dem Speichern des Eintrags hochgeladen.

### Projekt fortsetzen

- Die Zeile `Projekte (n)` in der Erfassung öffnet die offenen Projekte der Halle der Session, sortiert nach zuletzt bearbeitet. Ein Tap auf ein Projekt übernimmt Stufe und Zone in die aktuelle Karte und zeigt `Bisher 7 Versuche · Kurz vor dem Top`.
- Die Erfassung läuft wie sonst (Zahlenchips, `Offen`, `Geschafft`). Die Versuche zählen für die aktuelle Session und zusätzlich für die Gesamtzahl des Projekts.
- Ein Erfolg im ersten Versuch dieser Session ist nach früheren Versuchen kein Flash.
- Bei Erfolg verschwindet das Projekt aus den offenen Projekten. Erfolg und bisherige Versuche bleiben in der Historie.

### Projekt verwalten

- Der Training-Hub zeigt `Offene Projekte` mit Vorschaubildern. Die Projektübersicht trennt `Offen`, `Geschafft` und `Archiv`. Das Projekt-Detail zeigt Foto, Gesamtversuche, Sessions, Fortschritt und den Verlauf je Session.
- Entfernte oder umgeschraubte Boulder werden archiviert (mit Bestätigung). Archivierte und geschaffte Projekte sind lesbar, aber nicht mehr fortsetzbar.

### Korrekturen

- Projektmerkmal entfernen: Gibt es das Projekt nur in der aktuellen Session, wird der Eintrag wieder normal und das Projekt gelöscht. Gibt es Einträge aus früheren Sessions, wird stattdessen `Archivieren` angeboten.
- Löschen oder Zurücksetzen eines erfolgreichen Projekt-Eintrags öffnet das Projekt wieder. Gesamtversuche und Flash/Geschafft ergeben sich aus den verbleibenden Einträgen.
- Wird eine Session oder ein Eintrag gelöscht, bleiben Projekte mit Einträgen aus anderen Sessions bestehen; Projekte ohne Einträge werden entfernt.

### Datenschutz

- Projekte, Kommentare und Fotos sind privat und werden bei der Kontolöschung mitgelöscht. Die Datenschutzerklärung wird mit dieser Story angepasst (nach Freigabe).

## 3. Akzeptanzkriterien

1. Der Stern auf der Karte legt ein Projekt an; der Eintrag erscheint in der Session mit Projektmarkierung.
2. Ein als `Offen` gespeicherter Boulder mit 3 oder mehr Versuchen bietet im Hinweis `Als Projekt merken` an; mit weniger als 3 Versuchen nicht; bei `Geschafft` nicht.
3. Das Kamera-Symbol nimmt ein Foto auf; das Foto erscheint am Eintrag; ein zweites ersetzt das erste; `Foto löschen` entfernt es.
4. Ein Foto über 8 MB oder mit anderem Typ als JPEG/PNG wird abgelehnt; die App zeigt eine verständliche Meldung.
5. Wird ein Foto vor dem Speichern des Eintrags aufgenommen, wird der Eintrag zuerst, das Foto danach gespeichert; es entsteht kein Foto ohne Eintrag.
6. `Projekte (n)` zeigt die offenen Projekte der Halle der Session mit Titelbild, Stufe, Zone, Gesamtversuchen und Anzahl Sessions.
7. Ein ausgewähltes Projekt füllt Stufe und Zone der Karte und zeigt die bisherigen Versuche; die neuen Versuche werden als Eintrag der aktuellen Session gespeichert und zählen zur Projektsumme.
8. `Geschafft` bei einem Projekt mit früheren Versuchen ergibt nie `Flash`; ein Projekt ohne frühere Versuche folgt der normalen Flash-Regel.
9. Nach einem Erfolg erscheint das Projekt unter `Geschafft` und nicht mehr in den offenen Projekten; die Historie bleibt erhalten.
10. Für ein geschafftes oder archiviertes Projekt lassen sich keine neuen Versuche erfassen.
11. Das Entfernen des Projektmerkmals löscht das Projekt, wenn alle Einträge aus der aktuellen Session stammen; gibt es Einträge aus früheren Sessions, bietet die App `Archivieren` an und ändert nichts an den Einträgen.
12. Wird der erfolgreiche Eintrag eines Projekts gelöscht oder auf `Offen` gesetzt, ist das Projekt wieder offen und die Summen stimmen mit den verbleibenden Einträgen überein.
13. Das Löschen einer Session oder eines Eintrags entfernt zugehörige Fotos; Projekte ohne Einträge werden entfernt, Projekte mit Einträgen aus anderen Sessions bleiben.
14. Die Projektübersicht trennt `Offen`, `Geschafft`, `Archiv`; das Projekt-Detail zeigt Foto, Gesamtversuche, Sessions, Fortschritt und den Verlauf je Session.
15. `Archivieren` verlangt eine Bestätigung; archivierte Projekte erscheinen nicht mehr unter den offenen und nicht in der Projektliste einer Session.
16. Der Hub zeigt `Offene Projekte` mit bis zu drei Vorschaubildern.
17. Fotos und Projekte anderer Nutzer sind nicht abrufbar; bei der Kontolöschung werden Projekte, Einträge und Fotos gelöscht.
18. Die Datenschutzerklärung nennt Trainingsdaten, Boulderfotos und deren Löschung bei der Kontolöschung (nach Freigabe).

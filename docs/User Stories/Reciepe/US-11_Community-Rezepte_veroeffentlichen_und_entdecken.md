# User Story – Community-Rezepte veröffentlichen und entdecken

## User Story

Als FitTrack-Nutzer möchte ich meine Rezepte standardmäßig privat halten oder bewusst für andere angemeldete FitTrack-Nutzer freigeben und Community-Rezepte ansehen, favorisieren und ins Tagebuch eintragen können, damit ich Rezepte mit der FitTrack-Community teilen und geeignete Rezepte für meine Ernährung nutzen kann.

Diese Story beschreibt das gewünschte Produktverhalten, nicht die technische Umsetzung. Community-Rezepte sind ausschließlich innerhalb von FitTrack für angemeldete Nutzer sichtbar. Sie sind nicht öffentlich im Internet abrufbar. Die Community-Freigabe ist vom bestehenden Instagram-Teilen und dessen Exportansicht getrennt. Der technische Plan wird nach Freigabe dieser Story separat erstellt.

## Produktentscheidungen

1. Die Rezeptübersicht enthält die Bereiche **Deine Rezepte** und **Community-Rezepte**. Beim Öffnen bleibt **Deine Rezepte** die Standardansicht.
2. Neue Rezepte und bestehende Rezepte ohne explizite Community-Freigabe sind privat. Die persönliche Übersicht enthält die eigenen privaten und veröffentlichten Rezepte.
3. Der Eigentümer kann ein eigenes Rezept veröffentlichen oder wieder privat stellen. Vor der erstmaligen Veröffentlichung wird bestätigt, dass andere angemeldete FitTrack-Nutzer den Rezeptinhalt einschließlich Texten, Zutaten, Zubereitung und hochgeladener Bilder ansehen können. Abbrechen lässt das Rezept privat.
4. Bei der Veröffentlichung wird pro Rezept gefragt, ob der FitTrack-Anzeigename bei diesem Rezept angezeigt werden darf. Nur bei ausdrücklicher Zustimmung wird der hinterlegte Anzeigename gezeigt. Ohne Zustimmung oder ohne verfügbaren Anzeigenamen erscheint **Anonymous**. Die Namensfreigabe ist standardmäßig nicht aktiviert.
5. Community-Rezepte dürfen Open-Food-Facts-Zutaten, persönliche beziehungsweise manuell erfasste Zutaten und KI-Schätzungen enthalten. Die Rezeptansicht weist auf vorhandene manuelle Zutaten und KI-Schätzungen hin. Die Hinweise stellen keine Prüfung oder Bestätigung der Nährwertgenauigkeit durch FitTrack dar.
6. **Favorisieren** speichert das Rezept als persönliche Favoriten-Referenz. Es kopiert weder das Rezept in die eigenen Rezepte noch dessen Zutaten in die persönliche Lebensmittelsammlung.
7. Beim Eintragen eines Community-Rezepts ins Tagebuch werden Rezeptname, Portion und die zum Eintragszeitpunkt gültigen Nährwerte als Tagebuch-Snapshot gespeichert. Zutaten werden nicht in die Lebensmittelsammlung kopiert.
8. Wird ein Rezept privat gestellt oder gelöscht, bleiben bereits protokollierte Tagebucheinträge unverändert erhalten. Eine gespeicherte Favoriten-Referenz gewährt keinen Zugriff auf ein inzwischen privates Rezept.
9. Nur der Eigentümer darf ein Rezept bearbeiten, löschen, Bilder verwalten oder dessen Sichtbarkeit ändern. Änderungen am veröffentlichten Rezept sind für die Community sichtbar, solange es veröffentlicht bleibt.

## Akzeptanzkriterien

1. Die Rezeptübersicht bietet die Bereiche **Deine Rezepte** und **Community-Rezepte**. Beim Öffnen ist **Deine Rezepte** ausgewählt.
2. **Deine Rezepte** zeigt sämtliche Rezepte des angemeldeten Nutzers, unabhängig davon, ob sie privat oder veröffentlicht sind. Der Veröffentlichungsstatus ist für den Eigentümer erkennbar.
3. Neu erstellte Rezepte sind privat, solange der Eigentümer die Community-Freigabe nicht ausdrücklich aktiviert.
4. Auch vorhandene Rezepte ohne Freigabe bleiben privat und erscheinen nicht in der Community-Übersicht.
5. Der Eigentümer kann bei einem eigenen Rezept zwischen privat und Community wechseln. Andere Nutzer können diese Einstellung nicht ändern.
6. Vor einer erstmaligen Community-Freigabe wird verständlich angezeigt, dass angemeldete FitTrack-Nutzer die Rezepttexte, Zutaten, Zubereitung und Bilder sehen können. Bei Abbruch bleibt das Rezept privat; bei Bestätigung wird es veröffentlicht.
7. Bei der Veröffentlichung kann der Eigentümer für dieses Rezept ausdrücklich zustimmen, dass sein FitTrack-Anzeigename angezeigt wird. Ist die Zustimmung nicht erteilt oder kein Anzeigename verfügbar, erscheint in der Community-Rezeptansicht **Anonymous**.
8. **Community-Rezepte** enthält ausschließlich veröffentlichte Rezepte und ist nur für angemeldete FitTrack-Nutzer erreichbar.
9. Ein angemeldeter Nutzer kann ein Community-Rezept öffnen und dessen gespeicherte Rezeptinformationen ansehen: Name, Beschreibung, Portionen, Zutaten, Zubereitung, Nährwerte und verfügbare Bilder.
10. Die Community-Rezeptansicht zeigt den freigegebenen Anzeigenamen oder **Anonymous**. Sie zeigt keine persönlichen Verwaltungsaktionen wie Bearbeiten, Löschen oder Bildverwaltung für fremde Rezepte.
11. Enthält ein Rezept KI-geschätzte Zutaten, wird in der Rezeptansicht **Enthält KI-Schätzungen** angezeigt. Enthält es manuell erfasste Zutaten, wird **Enthält manuell erfasste Zutaten** angezeigt. Sind beide Arten vorhanden, werden beide Hinweise gezeigt. Die Hinweise behaupten nicht, dass FitTrack die Werte verifiziert hat.
12. Der Nutzer kann ein Community-Rezept zu seinen Favoriten hinzufügen und wieder daraus entfernen. Favorisieren legt keine eigene Rezeptkopie und keine neuen Lebensmitteleinträge an.
13. Der Nutzer kann ein Community-Rezept wie ein eigenes Rezept portionsweise in ein Tagebuch eintragen. Die Nährwerte werden zum Zeitpunkt des Eintrags als Snapshot gespeichert.
14. Wird ein Community-Rezept nach dem Tagebucheintrag privat gestellt oder gelöscht, bleiben Name, Portion und Nährwert-Snapshot des bestehenden Tagebucheintrags erhalten.
15. Wird ein veröffentlichtes Rezept privat gestellt, verschwindet es aus der Community-Übersicht. Andere Nutzer können es anschließend weder über einen direkten Rezeptaufruf noch über eine gespeicherte Favoriten-Referenz ansehen oder neu ins Tagebuch eintragen.
16. Die Sichtbarkeitsprüfung gilt serverseitig für Community-Liste, Rezeptdetail und Tagebuch-Eintrag. Eine Nutzeroberfläche oder eine bekannte Rezept-ID allein gewährt keinen Zugriff auf private Rezepte.
17. Die Funktion **In eigene Rezepte übernehmen** ist nicht Bestandteil dieser Story. Ebenso werden beim Ansehen, Favorisieren oder Tagebuch-Eintrag keine Zutaten in die persönliche Lebensmittelsammlung kopiert.

## Nicht Bestandteil dieser Story

- Community-Rezepte in eigene Rezepte kopieren oder daraus ein neues Rezept erstellen.
- Zutaten aus einem Community-Rezept in die persönliche Lebensmittelsammlung übernehmen.
- Öffentlicher, anonymer Webzugriff außerhalb von FitTrack.
- Instagram-Export, Exportansicht oder Instagram-Teilen.
- Zusätzliche Moderations-, Melde- oder Administrationsoberflächen.

## Hinweise für den Planner

- Das aktuelle Rezeptmodell kennt nur private Rezepte. Der Plan muss die Community-Sichtbarkeit und die serverseitige Zugriffskontrolle berücksichtigen, ohne die Eigentümerrechte auf private Daten aufzuweichen.
- Die Herkunft einer Zutat muss für die Hinweise zu manuellen Zutaten und KI-Schätzungen verlässlich erkennbar bleiben. Bei vorhandenen Rezepten, deren Herkunft nicht eindeutig gespeichert ist, darf die Oberfläche keine falsche Herkunft behaupten.
- Der Anzeigename ist im FitTrack-Profil optional. Die Zustimmung zur Anzeige muss an die jeweilige Rezeptveröffentlichung gebunden sein; fehlende Zustimmung darf nicht aus dem Authentifizierungstoken oder anderen Profilfeldern abgeleitet werden.
- Tagebucheinträge verwenden gespeicherte Nährwert-Snapshots. Das Zurückziehen oder Löschen eines Community-Rezepts darf diese historischen Einträge nicht nachträglich verändern.

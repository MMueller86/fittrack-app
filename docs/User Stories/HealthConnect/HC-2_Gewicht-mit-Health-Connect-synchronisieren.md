# HC-2 -- Gewicht mit Health Connect synchronisieren

## Ziel

Als Nutzer möchte ich meine in FitTrack gespeicherten Gewichtsdaten an
Google Health Connect übertragen, damit sie anderen kompatiblen
Gesundheits-Apps zur Verfügung stehen.

## Scope

-   Einrichtungsflow für die Gewichtssynchronisation im Tab **„Health
    Connect"**.
-   Vor der Aktivierung wird erklärt:
    -   alle vorhandenen Gewichtseinträge werden übertragen,
    -   zukünftige Gewichtseinträge werden automatisch übertragen,
    -   Erfassungszeitpunkt und Zeitzone werden mitgesendet,
    -   spätere Änderungen und Löschungen werden ebenfalls
        synchronisiert.
-   Die Synchronisation erfolgt ausschließlich von **FitTrack zu Google
    Health Connect**.
-   Ein Import von Gewichtsdaten aus Google Health Connect nach FitTrack
    ist ausdrücklich **nicht** Bestandteil dieser Story.
-   Anforderung der Schreibberechtigung `WRITE_WEIGHT`.
-   Verwendung des Health-Connect-Datentyps `WeightRecord`.
-   Übertragung von:
    -   Gewicht
    -   Erfassungszeitpunkt
    -   Zeitzone
    -   erforderlichen Metadaten
-   Export aller bereits vorhandenen Gewichtseinträge nach der
    Aktivierung.
-   Automatische Synchronisation neuer, geänderter und gelöschter
    Gewichtseinträge.
-   Die Synchronisation erfolgt asynchron im Hintergrund und ohne
    zusätzliche Nutzeraktion.
-   Das Speichern, Bearbeiten oder Löschen eines Gewichts in FitTrack
    darf durch die Synchronisation nicht blockiert werden.
-   Nach erfolgreicher Speicherung in FitTrack wird automatisch ein
    Synchronisationsauftrag erzeugt.
-   Fehlgeschlagene Synchronisationen werden persistent vorgemerkt und
    abhängig von der Fehlerart erneut ausgeführt.
-   Wird die Berechtigung entzogen, wird der Nutzer informiert und die
    Gewichtssynchronisation in FitTrack deaktiviert.
-   Bereits übertragene Daten bleiben bei Deaktivierung oder
    Berechtigungsentzug in Google Health Connect bestehen.
-   Nach einer Neuinstallation oder einem Gerätewechsel muss der Nutzer
    die Gewichtssynchronisation erneut aktivieren. Anschließend erfolgt
    ein vollständiger, idempotenter Re-Export aller Gewichtseinträge.
-   Die Synchronisationslösung ist so auszulegen, dass weitere
    Health-Connect-Datentypen später ergänzt werden können.

## Synchronisationsregeln

-   FitTrack ist das führende System für Gewichtsdaten.
-   Erneute Exporte dürfen keine Health-Connect-Dubletten erzeugen.
-   Änderungen in FitTrack ersetzen den zuvor übertragenen Stand.
-   Löscht der Nutzer einen Gewichtseintrag in FitTrack, wird der
    zugehörige, von FitTrack erzeugte `WeightRecord` ebenfalls gelöscht.
-   Änderungen anderer Apps an Health-Connect-Daten werden nicht nach
    FitTrack übernommen.
-   Fehler werden mindestens unterschieden in:
    -   temporärer Fehler
    -   fehlende Berechtigung
    -   dauerhaft nicht synchronisierbarer Datensatz

## Darstellung auf der Progressseite

-   Erfolgreich synchronisierte Gewichtseinträge erhalten einen
    Synchronisationsindikator.
-   Noch ausstehende Einträge erhalten einen Wartestatus.
-   Fehlgeschlagene Synchronisationen erhalten einen Warnstatus.
-   Dauerhaft fehlgeschlagene Synchronisationen werden für den Nutzer
    verständlich gekennzeichnet und erfordern gegebenenfalls eine
    Nutzeraktion.
-   Der Planner entwickelt ein konsistentes UX-Konzept für einzelne
    Einträge und gruppierte Darstellungen wie Wochen-Akkordeons.
-   Es sind das bestehende FitTrack-Designsystem und die vorhandene
    Iconbibliothek zu verwenden.
-   Emojis sind nicht zulässig.

## Architekturhinweise -- durch den Planner zu validieren

-   Für jeden Gewichtseintrag soll die stabile interne FitTrack-ID zur
    Ableitung der `clientRecordId` verwendet werden. Es sollen keine
    zusätzlichen oder zufällig generierten Synchronisations-IDs
    eingeführt werden.
-   Änderungen verwenden eine steigende `clientRecordVersion`.
-   Der Planner validiert `WRITE_WEIGHT`, `WeightRecord`,
    `clientRecordId`, `clientRecordVersion` und die erforderlichen
    Metadaten anhand der aktuellen Google-Dokumentation.
-   Der Planner prüft die empfohlene Umsetzung für idempotente
    Re-Exporte sowie für Änderungen und Löschungen gemäß aktueller
    Health-Connect-Best-Practices.
-   Der Planner wählt einen persistenten Retry-Mechanismus nach
    aktuellen Android-Best-Practices.

## Akzeptanzkriterien

-   Der Nutzer kann die Gewichtssynchronisation im Health-Connect-Tab
    aktivieren.
-   Vor der Aktivierung wird der Umfang der Synchronisation verständlich
    erklärt.
-   Es wird ausschließlich die erforderliche Schreibberechtigung für
    Gewicht angefordert.
-   Nach erfolgreicher Aktivierung werden alle vorhandenen
    Gewichtseinträge exportiert.
-   Neue Gewichtseinträge werden ohne zusätzliche Nutzeraktion
    synchronisiert.
-   Änderungen eines Gewichtseintrags werden in Google Health Connect
    übernommen.
-   Löschungen eines Gewichtseintrags werden in Google Health Connect
    übernommen.
-   Ein erneuter vollständiger Export erzeugt keine zusätzlichen
    Health-Connect-Dubletten.
-   Der FitTrack-Workflow funktioniert auch bei fehlgeschlagener
    Synchronisation uneingeschränkt weiter.
-   Fehlgeschlagene Synchronisationsaufträge bleiben erhalten und werden
    entsprechend ihrer Fehlerart behandelt.
-   Wird die Berechtigung entzogen, wird der Nutzer informiert und die
    Gewichtssynchronisation deaktiviert.
-   Erfolgreiche, ausstehende und fehlgeschlagene Synchronisationen sind
    auf der Progressseite anhand ihres Status eindeutig erkennbar.
-   Die Dev-Build ermöglicht den vollständigen fachlichen Flow, ohne
    Daten in das reale Google Health Connect zu schreiben.

# HC-4 -- Health-Connect-Synchronisation durch Abgleich ersetzen

Status: Entwurf, nicht freigegeben. Folgt auf HC-2 und HC-3 und ersetzt deren
Wiederholungsmechanismus. Der Plan wird vom Planner erstellt.

## Ziel

Als Nutzer möchte ich, dass FitTrack Gewicht und Ernährung zuverlässig an
Google Health Connect überträgt, ohne dass die App meine Gesundheitsdaten in
einer lokalen Warteschlange zwischenspeichert, damit nur Daten gesendet
werden, die der aktuell angemeldete Nutzer sehen und übertragen darf.

## Hintergrund

Heute merkt sich die App fehlgeschlagene Übertragungen als vollständige
Einträge in `hc:weight:sync` bzw. `hc:nutrition:sync` und wiederholt sie bei
jedem Vordergrundwechsel. Die Warteschlange hat keinen Nutzerbezug, speichert
Gesundheitswerte lokal und prüft die Berechtigung nicht vor dem Senden
(`hasPermissions` wird nirgends aufgerufen). Dadurch können alte Einträge nach
Kontolöschung, Abmeldung oder Nutzerwechsel erneut an Health Connect gehen.

FitTrack ist das führende System, die Schreibzugriffe sind idempotent
(`clientRecordId`). Eine Warteschlange ist daher nur ein Zwischenspeicher für
Daten, die auf dem Server bereits vorliegen.

## Scope

-   Die persistente Warteschlange mit vollständigen Gewichts- und
    Mahlzeitendaten entfällt.
-   Die Synchronisation erfolgt als Abgleich gegen die Serverdaten des aktuell
    angemeldeten Nutzers und sendet nur das Delta.
-   Auslöser:
    -   Ereignis: Speichern, Ändern oder Löschen eines Gewichts oder einer
        Mahlzeit sendet sofort, ohne die Speicheraktion zu blockieren.
    -   Wechsel der App in den Vordergrund, höchstens alle 15 Minuten
        (Sicherheitsnetz für fehlgeschlagene oder verpasste Übertragungen).
    -   Aktivieren der Synchronisation und der bestehende manuelle
        Voll-Export.
-   Lokal gespeichert werden nur:
    -   Nutzer-ID, für die die Synchronisation aktiviert wurde,
    -   pro Datentyp ein Wasserzeichen (Zeitpunkt, bis zu dem alles
        erfolgreich übertragen wurde),
    -   eine Liste ausstehender Löschungen, die ausschließlich IDs enthält
        (keine Gesundheitswerte).
-   Das Wasserzeichen rückt erst vor, wenn alle Schreibvorgänge des
    Abgleichs erfolgreich waren. Gibt es kein Delta, wird nichts gesendet.
-   Vor jedem Senden gilt:
    -   die Synchronisation ist aktiviert,
    -   die Schreibberechtigung wird über `hasPermissions` aktuell bestätigt,
    -   die gespeicherte Nutzer-ID entspricht dem angemeldeten Nutzer.
    Andernfalls wird nichts gesendet. Bei abweichender oder fehlender
    Nutzer-ID wird der lokale Synchronisationsstand verworfen und die
    Synchronisation deaktiviert; eine erneute Aktivierung mit neuer
    Berechtigungsabfrage ist nötig.
-   Fehlende oder entzogene Berechtigung deaktiviert die Synchronisation und
    informiert den Nutzer wie in HC-2/HC-3 beschrieben.
-   Die Löschung von Gewichts- und Mahlzeitenwerten in Health Connect bleibt
    wie in HC-2/HC-3 gefordert; fehlgeschlagene Löschungen werden anhand der
    ID-Liste wiederholt.
-   Der Server stellt für Gewicht und Mahlzeiten eine Delta-Abfrage bereit
    (Änderungen seit einem Zeitpunkt). Das Gewicht erhält dafür einen
    Änderungszeitstempel `updatedAt`. Der Planner klärt Persistenzklasse,
    Abwärtskompatibilität und das Verhalten bei fehlendem Wert in
    Bestandsdaten.
-   Die Statusanzeigen aus HC-2/HC-3 (Synchronisationsindikator,
    Wartestatus, Warnstatus, `SyncStatusSheet`) basieren heute auf den
    Warteschlangeneinträgen. Der Planner legt fest, welche Statuswerte ohne
    Warteschlange sinnvoll und verständlich ableitbar sind, und passt die
    Anzeige entsprechend an. Das bestehende Designsystem und die vorhandene
    Iconbibliothek werden verwendet, Emojis sind nicht zulässig.
-   Das lokale Diagnoseprotokoll (`syncLogger`) bleibt bestehen.
-   Die Knowledge Base (`docs/kb/tech/03-mobile.md` und weitere betroffene
    Seiten) beschreibt den neuen Mechanismus, die lokal gespeicherten Daten
    und den Wegfall der Warteschlange.

## Synchronisationsregeln

-   FitTrack ist das führende System. Erneutes Senden desselben Eintrags
    erzeugt keine Dubletten.
-   Der Server speichert keinen Übertragungsstatus pro Gerät, da Health
    Connect gerätegebunden ist.
-   Änderungen anderer Apps an Health-Connect-Daten werden nicht übernommen.
-   Bereits übertragene Daten und Berechtigungen in Health Connect werden
    durch FitTrack nicht entfernt, außer durch die in HC-2/HC-3 beschriebene
    Löschsynchronisation.
-   Es gibt keinen Hintergrunddienst und keinen Zeitgeber außerhalb der
    laufenden App.

## Akzeptanzkriterien

1.  Die Schlüssel `hc:weight:sync` und `hc:nutrition:sync` enthalten keine
    Gewichts- oder Mahlzeitenwerte mehr. Bestehende lokale Warteschlangen
    werden beim ersten Start nach dem Update verworfen, ohne ihre Daten zu
    senden.
2.  Ein neu gespeichertes, geändertes oder gelöschtes Gewicht beziehungsweise
    Mahlzeitenelement wird sofort synchronisiert. Schlägt das fehl, wird es
    beim nächsten Abgleich nachgeholt.
3.  Beim Wechsel in den Vordergrund sendet die App höchstens alle 15 Minuten
    und nur, wenn seit dem Wasserzeichen Änderungen vorliegen. Ohne Änderungen
    findet kein Schreibzugriff auf Health Connect statt.
4.  Das Wasserzeichen rückt nur nach vollständigem Erfolg vor.
5.  Vor jedem Schreibzugriff wird die Berechtigung über `hasPermissions`
    bestätigt. Fehlt sie, wird nichts gesendet, die Synchronisation
    deaktiviert und der Nutzer informiert.
6.  Meldet sich ein anderer Nutzer an, oder fehlt die gespeicherte Nutzer-ID,
    werden keine Daten gesendet, der lokale Stand wird verworfen und die
    Synchronisation ist deaktiviert, bis der Nutzer sie erneut aktiviert.
7.  Löschungen werden anhand einer reinen ID-Liste bis zum Erfolg wiederholt;
    die Liste enthält keine Gesundheitswerte.
8.  Das Gewicht besitzt `updatedAt`, Mahlzeiten und Gewicht bieten eine
    Delta-Abfrage. Bestandsdaten ohne `updatedAt` bleiben lesbar und werden
    beim Voll-Export berücksichtigt.
9.  Aktivierung, manueller Voll-Export und Re-Export nach Neuinstallation
    bleiben idempotent und funktionsgleich zu HC-2/HC-3.
10. Die Statusanzeigen sind konsistent zum neuen Mechanismus, enthalten keine
    veralteten Warteschlangenbegriffe und verwenden keine Emojis.
11. Die Knowledge Base ist aktualisiert und beschreibt Mechanismus, lokal
    gespeicherte Daten, Auslöser, Berechtigungsprüfung und Nutzerbindung.
12. Fachlogik, Berechtigungsprüfung, Nutzerbindung, Delta-Abfrage und
    ID-Löschliste sind durch Unit-Tests abgedeckt.

## Nicht Bestandteil

-   Import von Daten aus Health Connect nach FitTrack.
-   Speicherung eines Übertragungsstatus in der Datenbank.
-   Hintergrund-Synchronisation außerhalb der laufenden App.
-   Löschen bereits exportierter Health-Connect-Daten oder von
    Berechtigungen im Rahmen der Kontolöschung.
-   Änderungen am Konto-Löschablauf. Dieser wird nach HC-4 vereinfacht
    fortgeführt (Best-Effort-Bereinigung mit einmaligem Hinweis, kein
    dauerhafter Retry-Marker).

## Offene Fragen für den Planner

-   Wie werden pro Eintrag Statusindikatoren und Fehleranzeigen ohne
    Warteschlange abgeleitet?
-   Persistenzklasse und Rollout von `updatedAt` am Gewicht sowie Form der
    Delta-Abfrage beider APIs.
-   Umgang mit Zeitabweichungen zwischen Gerät und Server beim Wasserzeichen.
-   Der Vordergrund-Abgleich soll höchstens alle 15 Minuten laufen; ob das
    Intervall konfigurierbar sein soll, ist nicht gefordert.
-   Auswirkung auf Infrastruktur und Mobile-Build (erwartet: keine neue
    Ressource, keine nativen Änderungen).

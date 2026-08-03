# HC-1 -- Health Connect Grundintegration

## Ziel

Als Nutzer möchte ich sehen, ob Google Health Connect auf meinem Gerät
verfügbar ist und welchen Status die Integration in FitTrack hat.

## Scope

-   Neuer Tab **„Health Connect"** im Benutzerprofil.
-   Eigener Health-Connect-Statusscreen.
-   Prüfung der Verfügbarkeit von Google Health Connect auf dem Gerät.
-   Anzeige der für diese Story relevanten Zustände:
    -   verfügbar
    -   nicht verfügbar
    -   Installation oder Aktualisierung erforderlich
    -   Status konnte nicht ermittelt werden
-   Keine Berechtigungsanfrage und keine Synchronisation von
    Gesundheitsdaten.

## Architekturhinweise -- durch den Planner zu validieren

-   Als vorgeschlagene Lösung verwendet die Dev-Build eine
    Mock-/Staging-Implementierung, damit alle Health-Connect-Screens und
    Zustände ohne Zugriff auf das reale Health Connect entwickelt und
    getestet werden können.
-   Die Alpha-Build verwendet den produktiven
    Google-Health-Connect-Client.
-   Die produktive Implementierung soll durch Unit-Tests mit Googles
    `FakeHealthConnectClient` abgesichert werden.
-   Der Planner prüft explizit das vorgeschlagene Staging- und
    Mocking-Konzept anhand der aktuellen Google-Dokumentation, des State
    of the Art und aktueller Best Practices.
-   Dabei sind auch geeignete Lösungen von Google sowie etablierte
    Open-Source-Bibliotheken zu prüfen.

## Akzeptanzkriterien

-   Im Benutzerprofil steht der neue Tab **„Health Connect"** zur
    Verfügung.
-   Beim Öffnen des Tabs wird der aktuelle Verfügbarkeitsstatus
    angezeigt.
-   Eine notwendige Installation oder Aktualisierung wird verständlich
    dargestellt.
-   Nicht unterstützte Geräte erhalten einen verständlichen Hinweis.
-   Kann der Status nicht ermittelt werden, erhält der Nutzer einen
    verständlichen Hinweis.
-   In der Dev-Build ist der Tab vollständig nutzbar, ohne auf das reale
    Google Health Connect zuzugreifen.

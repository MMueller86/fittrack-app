# User Story – Trainingsbereich und Navigation

Teil des Epics [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md). Konzept: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md), Screens: [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md).

## 1. User Story

Als FitTrack-Nutzer möchte ich einen eigenen Bereich „Training“ in der Hauptnavigation haben, damit ich Sport getrennt von Ernährung finde und weitere Sportarten später dort ergänzt werden können, ohne dass die Navigation unübersichtlich wird.

## 2. Produktentscheidungen

- Die Hauptnavigation hat weiterhin genau fünf Tabs: `Home`, `Ernährung`, `Training`, `Progress`, `Profil`.
- Der Tab `Rezepte` entfällt. Rezepte sind ein Segment im Tab `Ernährung`: `Tagebuch | Rezepte`.
- Beim Öffnen von `Ernährung` erscheint das zuletzt genutzte Segment. Ein Wechsel ist ein Tap.
- Alle bestehenden Rezeptfunktionen (Liste, Detail, Wizard, Community, Einkaufsfluss über den Hub) bleiben unverändert erreichbar.
- Der Tab `Training` zeigt den Trainings-Hub. In dieser Story ist der Hub ein Rahmen ohne Boulderfunktion: Titel, Karte „Bouldern“ mit dem Hinweis, dass die Funktion folgt.
- Das Tab-Icon für Training ist neu und folgt dem Stil der vorhandenen Tab-Icons.

## 3. Akzeptanzkriterien

1. Die Tab-Leiste zeigt in dieser Reihenfolge `Home`, `Ernährung`, `Training`, `Progress`, `Profil`.
2. Es gibt keinen Tab `Rezepte` mehr.
3. `Ernährung` zeigt oben ein Segment `Tagebuch | Rezepte`; der aktive Eintrag ist hervorgehoben.
4. Ein Tap auf `Rezepte` zeigt die Rezeptliste, ein Tap auf `Tagebuch` das Tagebuch.
5. Nach dem Wechsel in einen anderen Tab und zurück erscheint das zuletzt gewählte Segment.
6. Aus der Rezeptliste sind Rezeptdetail, Rezept anlegen und Rezept bearbeiten wie zuvor erreichbar; Zurück führt in die Rezeptliste.
7. Der Tab `Training` zeigt einen Screen mit Titel `Training` und einer Karte `Bouldern` im Card-Stil der App.
8. Alle Abstände, Farben und Schriftarten stammen aus den Theme-Tokens.
9. Alle vorhandenen Tests zu Rezepten und Tagebuch laufen weiter.

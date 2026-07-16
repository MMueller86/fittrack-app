# Food Entry Vision & UX Principles

## Einleitung

Dieses Dokument beschreibt die langfristige Produktvision des neuen Food Entry Systems der FitTrack App.

Es dient als fachliche Grundlage für alle nachfolgenden User Stories und ersetzt die bisherige Betrachtung einzelner Screens (Home, Ernährungstagebuch, Suche usw.).

Das Ziel dieses Dokuments ist ausdrücklich **nicht**, eine Implementierung zu planen.

Es beschreibt ausschließlich:

- Produktvision
- UX-Philosophie
- Informationsarchitektur
- Interaktionsprinzipien
- Wiederverwendbare Komponenten

Die eigentliche Umsetzung erfolgt anschließend in mehreren, bewusst klein geschnittenen User Stories.

---

# Rolle

Du agierst als **Senior Product Architect** und **Senior Software Architect**.

Deine Aufgabe besteht ausdrücklich nicht darin, diese Vision möglichst schnell umzusetzen.

Bewerte sie stattdessen kritisch hinsichtlich:

- UX
- Konsistenz
- Erweiterbarkeit
- technischer Machbarkeit
- Wartbarkeit
- Architektur
- Risiken
- zukünftiger Skalierbarkeit

Stelle zunächst alle notwendigen Rückfragen.

Zeige mögliche Probleme oder Widersprüche offen auf.

Erst nach Klärung aller offenen Punkte soll später die eigentliche Umsetzung geplant werden.

---

# Vision

Die Lebensmittelerfassung soll sich zukünftig wie **ein einziger zusammenhängender Workflow** anfühlen.

Der Nutzer soll niemals überlegen müssen,

welcher Screen,

welche Funktion

oder

welche Technologie

für seine Aufgabe die richtige ist.

Der Nutzer verfolgt lediglich ein Ziel:

> Ich möchte möglichst schnell ein Lebensmittel meinem Ernährungstagebuch hinzufügen.

Alle technischen Möglichkeiten ordnen sich diesem Ziel unter.

---

# Produktphilosophie

Der Food Entry Hub ist:

- keine klassische Produktsuche
- kein Menü
- kein neuer Screen
- kein Dialog

Er ist ein temporärer **Workspace**.

Innerhalb dieses Workspaces erledigt der Nutzer seine komplette Lebensmittelerfassung.

Der Workspace bleibt geöffnet, bis der Nutzer ihn bewusst verlässt.

---

# Einstiegspunkte

Der Food Entry Flow besitzt mehrere Einstiegspunkte.

Beispiele:

- Home Screen
- Ernährungstagebuch
- zukünftige Widgets
- zukünftiger AI Coach
- zukünftige weitere Bereiche

Alle Einstiegspunkte führen in denselben Food Entry Workflow.

Es existieren keine unterschiedlichen Food Entry Prozesse.

---

# Food Entry Search Bar

Die Search Bar ist die zentrale Einstiegskomponente des gesamten Food Entry Systems.

Sie wird projektweit wiederverwendet.

Sie besitzt drei Primäreinstiege:

- Produktsuche
- AI-Schätzung
- Barcode

Die Search Bar besitzt einen kontextabhängigen Placeholder.

Beispiele:

Home

> Lebensmittel hinzufügen...

Frühstück

> Zum Frühstück hinzufügen...

Mittagessen

> Zum Mittagessen hinzufügen...

Dadurch kennt der Nutzer jederzeit den aktuellen Zielkontext.

---

# Workspace

Der Food Entry Hub wird als Workspace gestaltet.

Er erscheint als hochwertige Arbeitsfläche über dem aktuellen Kontext.

Er ersetzt keinen Screen.

Der Hintergrund bleibt teilweise sichtbar.

Der Workspace besitzt:

- eigene Elevation
- eigene Hintergrundfarbe
- großzügige Rundungen
- Handle
- hochwertige Animationen

Er soll sich bewusst wie eine neue Arbeitsebene anfühlen.

---

# Zustände

Der Workspace besitzt genau drei Zustände.

## Idle

- Suchfeld nicht aktiv
- Tastatur geschlossen

Anzeige:

Schnellzugriff

Heute:

Favoriten

Langfristig:

intelligente Quick Picks

---

## Suchmodus

Suchfeld fokussiert

Tastatur geöffnet

Suchfeld leer

Anzeige:

Kürzlich hinzugefügt

---

## Suchergebnisse

Sobald Suchtext vorhanden ist:

Anzeige ausschließlich:

Suchergebnisse

Alle anderen Hilfsbereiche verschwinden.

---

# Quick Picks

Quick Picks bestehen zunächst ausschließlich aus Favoriten.

Sie erscheinen als kompakte Chips.

Sie dienen ausschließlich als Schnellzugriffe.

Langfristig kann dieser Bereich intelligent erweitert werden.

Die Überschrift lautet:

"Schnellzugriff"

Nicht:

"Favoriten"

Dadurch bleibt die Oberfläche auch bei zukünftigen Erweiterungen konsistent.

---

# Suchergebnisse

Die Suchergebnisse werden als moderne Listenansicht dargestellt.

Jeder Treffer besitzt:

- Produktbild
- Produktname
- Marke
- Makrozeile
- Referenz (100 g oder Portion)
- Herkunft (Eigen / OFF)
- Favoritenstatus

Die Makrozeile besitzt folgendes Format:

251 kcal · EW 8 g · KH 43 g · F 3 g

Dadurch kann der Nutzer bereits während der Suche fundierte Entscheidungen treffen.

---

# Produktdialog

Der Produktdialog dient ausschließlich der Bestätigung des Hinzufügens.

Er beantwortet lediglich drei Fragen:

- Wie viel?
- Wohin?
- Hinzufügen?

Er besitzt unter anderem:

- Produktbild
- Produktname
- Mahlzeit
- Portionsauswahl
- Makrokarte
- Favoriten
- Hinzufügen-Button

Nach erfolgreichem Hinzufügen:

- Dialog schließt
- Snackbar erscheint
- Workspace bleibt geöffnet
- Suchfeld bleibt aktiv
- Nutzer kann unmittelbar das nächste Lebensmittel hinzufügen

---

# Suchstrategie

Die klassische Produktsuche besitzt immer Vorrang.

Die AI dient als intelligente Unterstützung.

Die Reihenfolge lautet:

1. Produktsuche
2. AI-Schätzung
3. OCR / Label Scan
4. Manuelle Eingabe

OCR und manuelle Eingabe gehören bewusst nicht zu den Primäreinstiegen.

Sie werden ausschließlich als Kontextaktionen angeboten,

wenn die Suche nicht erfolgreich war,

oder später über den Floating Action Button.

---

# Produktprinzip

Der Nutzer entscheidet niemals über Technologien.

Er entscheidet ausschließlich über sein Ziel.

FitTrack schlägt automatisch den komfortabelsten nächsten Schritt vor.

Es existieren keine Sackgassen.

Jeder Suchprozess besitzt immer einen sinnvollen Ausweg.

---

# Live UX

Der Workspace reagiert unmittelbar auf jede Benutzeraktion.

Beispiele:

- Favoriten erscheinen sofort
- Suchranking aktualisiert sich
- Kürzlich hinzugefügt wird sofort aktualisiert
- Snackbar bestätigt jede Aktion

Der Nutzer soll niemals auf Reloads warten.

---

# Wiederverwendbare Komponenten

Diese Vision definiert mehrere wiederverwendbare Komponenten.

Beispiele:

- Food Entry Search Bar
- Food Entry Workspace
- Quick Pick Chips
- Suchergebnis-Zelle
- Makrokarte
- Produktdialog
- Snackbar
- Badges

Diese Komponenten sollen projektweit konsistent verwendet werden.

---

# Nicht Bestandteil dieser Vision

Dieses Dokument beschreibt bewusst keine Implementierung.

Die Umsetzung erfolgt anschließend in mehreren unabhängigen User Stories.

Beispiele:

- Workspace
- Search Integration
- Suchergebnisse
- Produktdialog
- Favoriten
- Live UX
- Cleanup

Bitte versuche ausdrücklich nicht, diese Stories bereits jetzt technisch auszuarbeiten.

---

# Aufgabe

Bitte analysiere diese Vision kritisch.

Bewerte insbesondere:

- UX
- Informationsarchitektur
- Produktphilosophie
- technische Machbarkeit
- Erweiterbarkeit
- Risiken
- Konsistenz
- Wiederverwendbarkeit der Komponenten

Stelle zunächst alle offenen Rückfragen.

Zeige mögliche Schwachstellen auf.

Bewerte anschließend, ob diese Vision aus Sicht eines Senior Product Architects langfristig tragfähig ist.

Erstelle ausdrücklich **noch keinen Implementierungsplan**.

Die eigentliche Umsetzung erfolgt später in mehreren unabhängigen User Stories.
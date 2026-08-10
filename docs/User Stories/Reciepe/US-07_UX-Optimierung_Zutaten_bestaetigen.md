# User Story – UX-Optimierung „Zutaten bestätigen”

## User Story

Als Nutzer möchte ich die vom Recipe Builder erkannten Zutaten schnell verstehen, prüfen und bei Bedarf korrigieren können, damit ich mit möglichst wenig Aufwand ein korrektes Rezept erstellen kann.

## Akzeptanzkriterien

1. Oberhalb der Zutatenliste wird ein kurzer Erklärungstext angezeigt, der den Zweck des Screens beschreibt und erklärt, dass Hauptzutaten geprüft bzw. zugeordnet werden, während Gewürze automatisch übernommen werden.
2. Die Fortschrittsanzeige verwendet eine verständliche Formulierung und macht eindeutig erkennbar, wie viele Zutaten bereits verarbeitet sind und wie viele noch eine Aktion benötigen.
3. Eine offene `food`-Zutat zeigt klar getrennt den erkannten Rezepttext inklusive Menge, den Suchbegriff und den aktuellen Auflösungsstatus.
4. Der erkannte Zutatenname und der Suchbegriff werden nicht als zwei identische, unbeschriftete Texte direkt untereinander dargestellt.
5. Suchtreffer stehen dem Nutzer unmittelbar nach dem Öffnen einer Zutat zur Verfügung. Ein zusätzliches Laden der Suchergebnisse beim Öffnen einer Zutat findet nicht statt.
6. Ist eine Zutat noch nicht aufgelöst, ist eindeutig erkennbar, ob Suchtreffer vorhanden sind, eine KI-Schätzung verwendet werden kann oder noch eine Verarbeitung läuft.
7. Die Aktion zur KI-Schätzung wird mit einem verständlichen Kontext dargestellt.
8. Für eine bereits ausgewählte Zutat funktionieren die Aktionen „Ersetzen“ und „Entfernen“.
9. „Ersetzen“ öffnet den bestehenden Search Hub.
10. Nach dem Entfernen einer Zutat verschwindet diese aus dem Rezeptentwurf und der Nutzer erhält eine sichtbare Rückmeldung.
11. „Zutat hinzufügen“ öffnet den bestehenden Search Hub.
12. Die Navigation zum nächsten Schritt verwendet eine eindeutige Bezeichnung.
13. Die primäre Aktion zum Fortfahren bleibt während des Scrollens gut erreichbar.
14. `seasoning`-Zutaten werden kompakter als normale `food`-Zutaten dargestellt.
15. Für `seasoning`-Zutaten bleibt die Aktion „Ersetzen“ verfügbar.

## Beobachtete Probleme

- Fortschrittsanzeige ist nicht selbsterklärend.
- Dem Screen fehlt eine kurze Einführung.
- Suchtreffer werden erst beim Öffnen geladen.
- Erkannte Zutat und Suchbegriff erscheinen teilweise doppelt.
- Die KI-Schätzung ist nicht ausreichend erklärt.
- „Ersetzen“ funktioniert aktuell nicht zuverlässig.
- „Entfernen“ gibt keine sichtbare Rückmeldung.
- Zwischen Aktionen fehlen teilweise Abstände.
- „Zutat hinzufügen“ besitzt aktuell keine Funktion.
- „Weiter zu den Schritten“ ist missverständlich.
- Gewürze nehmen aktuell unverhältnismäßig viel Platz ein.

## Hinweise für den Planner

- Bestehende Komponenten und UX-Patterns der App sollen bevorzugt wiederverwendet werden.
- Prüfen, wie Suchtreffer bereits während der Rezeptanalyse oder einer anderen geeigneten Phase vorbereitet werden können, sodass sie beim Öffnen einer Zutat ohne zusätzliche Wartezeit zur Verfügung stehen. Die konkrete technische Umsetzung (z. B. parallele Suchen, Prefetching, Caching oder eine andere Architektur) ist vom Planner zu bewerten.
- Die konkrete UX-Lösung (z. B. Gruppierung von Gewürzen, Swipe-Gesten, Sticky-CTA oder alternative Darstellungen) ist im Rahmen des UX- und Architektur-Reviews zu bewerten.

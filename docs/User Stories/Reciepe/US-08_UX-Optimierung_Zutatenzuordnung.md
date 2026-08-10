# User Story – UX-Optimierung der Zutatenzuordnung

## User Story

Als Nutzer möchte ich die vom Recipe Builder erkannten Zutaten mit möglichst wenig Aufwand prüfen und bestätigen können, damit ich mich auf die tatsächlich relevanten Entscheidungen konzentrieren kann.

## Akzeptanzkriterien

1. Zutaten, die keine Produktsuche benötigen (`seasoning`), werden in einem eigenen Bereich **„Automatisch erkannt“** zusammengefasst.
2. Der Bereich **„Automatisch erkannt“** befindet sich oberhalb der Hauptzutaten und ist standardmäßig eingeklappt.
3. Für jede automatisch erkannte Zutat wird eine von der KI vorgeschlagene, küchenübliche Mengenangabe angezeigt (z. B. `1 TL`, `1 Prise`, `½ TL`, `1 Handvoll` oder `nach Geschmack`).
4. Hauptzutaten (`food`) werden kompakt in derselben Ergebnisdarstellung wie im Ernährungstagebuch angezeigt. Die dort etablierte Darstellung von Lebensmittel, Portions-/Mengeneinheit, Kalorien und Protein wird wiederverwendet.
5. Eine Hauptzutat zeigt mindestens die erkannte Rezeptmenge, das ausgewählte Lebensmittel, Portions- bzw. Mengeneinheit, Kalorien und Protein.
6. Das Antippen einer Hauptzutat öffnet den bestehenden Search Hub.
7. Der Search Hub wird mit dem von der KI erkannten Suchbegriff vorinitialisiert.
8. Wird im Search Hub ein Suchergebnis normal ausgewählt, bleibt der bestehende Standard-Suchflow unverändert: Nach der Produktauswahl öffnet sich der bestehende Mengeneingabe-Screen. Die von der KI erkannte Menge ist dort bereits vorinitialisiert. Nach Bestätigung wird die Zutat übernommen und der Search Hub geschlossen.
9. Die bestehende **„So wie immer“**-Option wird als Schnellauswahl wiederverwendet. Die von der KI ermittelte Menge (z. B. `500 g`) wird vorinitialisiert angezeigt. Wählt der Nutzer diese Option, wird das Suchergebnis unmittelbar mit der vorgeschlagenen Menge übernommen und der Search Hub geschlossen.
10. Kann kein passendes Lebensmittel gefunden werden, zeigt die Hauptzutat einen entsprechenden Hinweis an. Das Antippen öffnet den Search Hub mit dem vorinitialisierten Suchbegriff.
11. Der Search Hub bleibt vollständig funktionsfähig. Sämtliche vorhandenen Funktionen (z. B. Suchbegriff ändern, KI-Schätzung, Barcode, eigenes Lebensmittel oder manuelle Anlage) stehen unverändert zur Verfügung.
12. Für die Zutatenzuordnung existiert keine eigene Such-, Mengen- oder Empty-State-Logik außerhalb des Search Hubs.
13. Der Search Hub wird mit derselben Animation, Darstellung, Höhe und Interaktion geöffnet wie im Ernährungstagebuch. Für den Nutzer darf kein Unterschied zwischen beiden Einstiegen erkennbar sein.

## Hinweise für den Planner

- Ziel ist eine möglichst hohe Wiederverwendung des bestehenden Search Hubs.
- Der Recipe Builder soll ausschließlich den Einstieg in den Search Hub orchestrieren. Suche, Mengenlogik und alternative Erfassungsmethoden verbleiben vollständig im Search Hub.
- Der Search Hub ist als bestehende Komponente vollständig wiederzuverwenden. Der Einstieg aus dem Recipe Builder darf sich hinsichtlich Animation, Darstellung, Höhe, Bedienung und Funktionsumfang nicht vom Einstieg aus dem Ernährungstagebuch unterscheiden.
- Die konkrete Gestaltung der Bereiche **„Automatisch erkannt“** und **Hauptzutaten** soll im Rahmen eines UX-Reviews optimiert werden, solange die beschriebenen Bedienprinzipien erhalten bleiben.

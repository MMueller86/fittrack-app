# User Story – Makro-Zielbereiche und Anpassung der Visualisierung

## 1. User Story

Als FitTrack-Nutzer möchte ich **Protein und Kohlenhydrate über flexible Zielbereiche statt feste Einzelwerte steuern**, damit ich meine Ernährungsziele flexibler erreichen kann.

## 2. Produktentscheidungen

### Protein – Zielbereich

- Zielbereich: **1,5–2,0 g pro kg Körpergewicht**.
- Jeder Wert innerhalb des Bereichs gilt als Zielerreichung.
- Die Grenzen werden in Gramm gerundet.

### Kohlenhydrate – flexibler Richtbereich

- Der feste Zielwert wird durch einen Richtbereich ersetzt.
- Berechnung anhand von Kalorienziel, Proteinbereich und Fettziel.
- Grundlage: Protein und Kohlenhydrate jeweils 4 kcal/g, Fett 9 kcal/g.
- Die obere Proteingrenze ergibt die untere Kohlenhydratgrenze und umgekehrt.
- Der Bereich dient als Orientierung, nicht als striktes Limit.

### Fett, Ballaststoffe und Kalorien

- Behalten ihre bisherigen festen Zielwerte und Berechnungsgrundlagen.

## 3. Appweite Integration

Der Planner soll **alle betroffenen Stellen im Repository analysieren** und einen konkreten Anpassungsvorschlag erstellen.

Insbesondere:

- **Berechnungen und Datenmodelle:** Makroziele, Kalorienbedarfs-Wizard und APIs.
- **KI-Prompts:** Alle Prompts, die Makroziele verwenden, bewerten oder Empfehlungen daraus ableiten.
- **Regeln und Hint Engine:** Zielerreichung und Ernährungsempfehlungen.
- **Insights und Coaching:** Tagesbewertungen und aktivitätsbezogene Empfehlungen.
- **Benutzeroberfläche:** Alle Anzeigen und Bewertungen von Makrozielen.

Die Zielbereichslogik soll möglichst zentral definiert werden, damit alle Komponenten dieselben Werte verwenden.

**Vor der Implementierung erstellt der Planner eine Impact-Analyse mit Umsetzungsvorschlag zur Freigabe.**

## 4. Anpassung der Makro-Balken auf dem Homescreen

Die bestehenden Fortschrittsbalken bleiben erhalten und werden vereinfacht.

**Protein und Kohlenhydrate**

- Anzeige von Ist-Wert und Zielbereich.
- Durchgehend farbige Fortschrittsbalken.
- Zielbereich durch dezente Schraffierung markiert.

**Fett und Ballaststoffe**

- Feste Zielwerte bleiben erhalten.
- Zielwert durch dezente vertikale Markierung dargestellt.

**Einheitliche Skalierung**

- Die oberen Bereichsgrenzen und festen Zielwerte liegen auf derselben horizontalen 100-%-Position.
- Rechts davon bleibt Platz für Überschreitungen.
- Balkenfüllung proportional zum tatsächlichen Ist-Wert.

**Vereinfachung**

- Keine Prozentwerte, Restmengen, Status-Texte oder Badges.
- Bestehender Kalorienring bleibt unverändert.

## 5. Akzeptanzkriterien

1. Protein verwendet appweit einen Zielbereich von 1,5–2,0 g/kg.
2. Kohlenhydrate verwenden einen dynamisch berechneten Richtbereich.
3. Fett, Ballaststoffe und Kalorien bleiben unverändert.
4. Alle betroffenen Berechnungen, KI-Prompts, Regeln, Insights und UI-Komponenten berücksichtigen die neue Logik.
5. Proteinwerte innerhalb des Zielbereichs gelten als Zielerreichung; Kohlenhydrat-Richtbereiche werden nicht als starre Limits bewertet.
6. Die Homescreen-Balken visualisieren Zielbereiche, feste Ziele und Überschreitungen mathematisch korrekt.
7. Die Balken bleiben kompakt und verzichten auf zusätzliche Status- und Prozentangaben.
8. Vor der Implementierung liegt eine Impact-Analyse mit Umsetzungsvorschlag zur Freigabe vor.
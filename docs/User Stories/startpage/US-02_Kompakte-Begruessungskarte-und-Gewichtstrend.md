# User Story – Kompakte Begrüßungskarte und Gewichtstrend auf dem Homescreen

## 1. User Story

Als FitTrack-Nutzer möchte ich meine Trainingstagsauswahl und meinen Gewichtstrend kompakt auf dem Homescreen sehen, damit ich meinen aktuellen Tagesstatus und meine Gewichtsentwicklung schnell erfassen kann.

## 2. Produktentscheidungen

### Begrüßungskarte verkleinern

Die bisherige obere Karte wird deutlich kompakter gestaltet.

- Persönliche Begrüßung bleibt links.
- Trainingstagsauswahl wird nach rechts verschoben.
- Die bestehende Umschaltung zwischen Trainings- und Ruhetag bleibt erhalten.
- Aktuelles Gewicht und Gewichtsdiagramm werden aus dieser Karte entfernt.
- Die Karte soll möglichst wenig vertikalen Platz beanspruchen.

### Gewichtstrend in die Kalorienkarte verschieben

Der Gewichtstrend wird rechts neben dem bestehenden Kalorienring platziert.

**Angezeigte Informationen:**

- Aktuelles Gewicht in kg.
- Kleines Trenddiagramm (Sparkline).
- Berechnete Gewichtsveränderung in **kg/Woche**, beispielsweise `−0,3 kg/Woche`.

Der bisherige Vergleich zum Vortag entfällt vollständig.

### Berechnung des Gewichtstrends

- Grundlage sind die Gewichtsmessungen der letzten **14 Kalendertage**.
- Der Trend wird mittels linearer Regression berechnet.
- Die Regressionssteigung wird auf **kg/Woche** umgerechnet.
- Die bestehende Berechnungslogik aus dem Progress-Bereich soll nach Möglichkeit wiederverwendet werden.
- Bei weniger als sieben Messungen wird kein Trendwert angezeigt.
- Kleine Schwankungen sollen nicht als relevante Trendänderung interpretiert werden.

### Darstellung des Diagramms

- Kompakte Sparkline ohne Achsen, Beschriftungen oder Gitternetz.
- Tatsächliche Gewichtsmessungen werden als dezente Linie dargestellt.
- Eine etwas deutlichere Trendlinie visualisiert die berechnete Entwicklung.
- Bestehende FitTrack-Farbpalette verwenden.
- Keine rote oder grüne Bewertung der Gewichtsentwicklung.
- Die Skalierung soll auch kleine Gewichtsveränderungen erkennbar machen, ohne Schwankungen übertrieben darzustellen.

### Integration in die Kalorienkarte

- **Links:** bestehender Kalorienring mit Kalorienanzeige.
- **Rechts:** aktuelles Gewicht, Sparkline und kg/Woche.
- **Darunter:** bestehende Makro-Fortschrittsbalken.
- Eine dezente vertikale Trennung zwischen Kalorien und Gewicht ist vorgesehen.
- Die Karte bleibt kompakt und auf kleinen Smartphones lesbar.

## 3. Akzeptanzkriterien

1. Die Begrüßungskarte enthält nur noch die Begrüßung und die Trainingstagsauswahl.
2. Die Trainingstagsauswahl befindet sich rechts und behält ihre bisherige Funktion.
3. Das aktuelle Gewicht wird rechts neben dem Kalorienring angezeigt.
4. Der Gewichtstrend basiert auf einer linearen Regression über die letzten 14 Kalendertage.
5. Die Trendsteigung wird als kg/Woche mit einer Nachkommastelle dargestellt.
6. Die Sparkline zeigt Gewichtsmessungen und berechnete Trendlinie.
7. Der bisherige Gewichtsvergleich zum Vortag entfällt.
8. Bei unzureichender Datenbasis wird kein Trendwert ausgegeben.
9. Die Makro-Balken bleiben unterhalb des Kalorien- und Gewichtsbereichs.
10. Die Darstellung ist kompakt, responsiv und entspricht dem abgestimmten FitTrack-Design.

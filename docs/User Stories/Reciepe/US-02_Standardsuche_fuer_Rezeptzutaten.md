# User Story – Standardsuche für Rezeptzutaten

## User Story

Als Nutzer möchte ich, dass beim Zuordnen von Rezeptzutaten der bestehende Search Hub verwendet wird, damit ich appweit dieselbe Suchlogik, Darstellung und Bedienung erlebe.

## Akzeptanzkriterien

1. Die Zuordnung von Rezeptzutaten erfolgt über den bestehenden Search Hub.
2. Suchlogik, Ranking und Ergebnisdarstellung entsprechen der Standardsuche.
3. Die Ergebnisliste ist nicht auf eine feste Anzahl von Treffern beschränkt.
4. Der Nutzer kann den vorgeschlagenen Suchbegriff jederzeit anpassen und erneut suchen.

## Hinweise für den Planner

- Der Rezeptbereich darf keine eigene Such- oder Suchergebnislogik mehr besitzen.
- Ziel ist eine möglichst hohe Wiederverwendung des bestehenden Search Hubs.
- Ob eine vollständige Wiederverwendung möglich ist oder einzelne Anpassungen aus UX- oder Architekturgründen erforderlich sind, soll im Rahmen der Architektur- und UX-Prüfung bewertet werden.
- Prüfen, ob das bestehende Such-Scoring für automatische Zuordnungen geeignet ist. Falls erforderlich, eine separate Match-Confidence entwickeln.
- Die Mengen- und Einheitenlogik im Zusammenspiel von KI-Erkennung, Produktsuche, Produktportionen und Rezeptdarstellung soll überprüft und konsistent umgesetzt werden.

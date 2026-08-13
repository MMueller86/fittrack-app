# User Story – Rezept für gewünschte Portionsanzahl nachkochen

## User Story

Als Nutzer möchte ich ein Rezept temporär für eine andere Portionsanzahl skalieren, ohne das Originalrezept zu verändern.

## Akzeptanzkriterien

1. Die Rezeptansicht erhält **„Nachkochen für“** mit `−` / `+` zur Auswahl der gewünschten Portionsanzahl.

2. **„Portionen“** und **„Nachkochen für“** sind getrennte Werte:
   - `Portionen`: Portionsanzahl des gespeicherten Originalrezepts. Änderungen beeinflussen nur die Nährwerte pro Portion, nicht die Zutatenmengen.
   - `Nachkochen für`: temporäre Ziel-Portionsanzahl für die Skalierung.

3. **„Nachkochen für“** startet mit der gespeicherten Portionsanzahl.

4. Änderungen an **„Nachkochen für“** skalieren alle strukturierten Zutatenmengen sofort und deterministisch.

5. Bestehende Einheiten (`g`, `ml`, `Stück`, Produkt-Portionsgrößen etc.) bleiben beim Skalieren erhalten.

6. Beschreibung und Zubereitungsschritte werden per KI an die neuen Mengen angepasst. Währenddessen wird für diese Texte ein dezenter Ladezustand angezeigt. Die Zutaten bleiben sichtbar und nutzbar.

7. Temperatur-, Zeit- und andere Angaben werden nur angepasst, wenn dies aufgrund der geänderten Mengen fachlich erforderlich ist. Andernfalls bleiben sie unverändert.

8. `+` / `−` darf nicht pro Klick sofort einen KI-Call auslösen. Schnell aufeinanderfolgende Änderungen sind nach Best Practices zusammenzufassen. Bei parallelen Requests wird nur das Ergebnis für die zuletzt gewählte Portionsanzahl übernommen.

9. Wird **„Nachkochen für“** auf die Original-Portionsanzahl zurückgesetzt, werden die ursprünglichen Mengen und Texte wieder angezeigt.

10. **„Nachkochen für“** verändert keine gespeicherten Rezeptdaten.

11. Über **„Nachkochen für“** ist dauerhaft ein Tooltip erreichbar. `−` / `+` öffnen den Tooltip nicht:

   **Für wie viele kochst du?**  
   Zutatenmengen und Zubereitung werden automatisch an die gewählte Portionszahl angepasst. Dein Originalrezept bleibt unverändert.

## Hinweise für den Planner

- Zutatenmengen deterministisch skalieren; keine KI für Berechnungen.
- Der KI werden Originaltexte und bereits berechnete Zielmengen übergeben.
- Die KI prüft semantisch, welche Textangaben durch die Skalierung betroffen sind. Nicht betroffene Angaben bleiben unverändert.
- Zutaten sofort aktualisieren; Textanpassung läuft unabhängig davon.
- Konzept für Debouncing, Request-Abbruch und/oder veraltete Responses im Plan beschreiben und begründen.
- Fehler der KI-Textanpassung dürfen die skalierten Zutaten nicht zurücksetzen.
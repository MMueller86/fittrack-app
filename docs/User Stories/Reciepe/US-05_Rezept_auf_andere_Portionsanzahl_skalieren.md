# User Story – Rezept auf andere Portionsanzahl skalieren

## User Story

Als Nutzer möchte ich die Portionsanzahl eines Rezeptes vor dem Nachkochen ändern können, damit alle Zutaten automatisch auf die gewünschte Menge angepasst werden.

## Akzeptanzkriterien

1. Der Nutzer kann die gewünschte Portionsanzahl eines Rezeptes ändern.
2. Alle Zutatenmengen werden entsprechend der neuen Portionsanzahl automatisch angepasst.
3. Die ursprüngliche Standard-Portionsanzahl des Rezeptes bleibt unverändert.
4. Der Nutzer kann jederzeit zur ursprünglichen Portionsanzahl zurückkehren.
5. Mengenbezogene Angaben in Zubereitungsschritten und Beschreibungen werden entsprechend angepasst.
6. Temperatur-, Zeit- und andere nicht mengenabhängige Angaben bleiben unverändert.
7. Beim Eintragen in das Ernährungstagebuch wird die tatsächlich gewählte Portionsanzahl verwendet.

## Hinweise für den Planner

- Mengen sollen deterministisch anhand des Skalierungsfaktors berechnet werden.
- KI soll nur eingesetzt werden, wenn unstrukturierte Texte semantisch angepasst werden müssen.

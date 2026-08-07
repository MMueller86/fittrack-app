# User Story – Intelligente Zutatenklassifizierung

## User Story

Als Nutzer möchte ich, dass die KI Zutaten bei der Neuanlage oder Bearbeitung eines Rezeptes intelligent klassifiziert und Mengen sinnvoll interpretiert, damit ich nur noch tatsächlich relevante Zutaten manuell zuordnen muss und der Erstellungsprozess deutlich schneller wird.

## Akzeptanzkriterien

1. Jede erkannte Zutat wird als `food` oder `seasoning` klassifiziert.
2. `food` sind kalorien- bzw. nährwertrelevante Lebensmittel und werden an die Produktsuche übergeben.
3. `seasoning` sind Zutaten, die typischerweise nur in kleinen Mengen verwendet werden und deren Naehrwerte fuer die Rezeptberechnung vernachlaessigbar sind. Sie bleiben Bestandteil des Rezeptes, werden in der Zutatenliste angezeigt, werden jedoch nicht an die Produktsuche uebergeben. Der Nutzer kann jederzeit ueber die Funktion **"Ersetzen"** dennoch eine Produktsuche ausfuehren.
4. Mengenangaben aus dem Rezepttext werden unveraendert uebernommen.
5. Liegen keine direkten Mengenangaben vor, soll die KI uebliche Kuechenangaben oder fehlende Mengen passend zum jeweiligen Rezeptkontext schaetzen.
6. Alle Mengen werden in Gramm oder Millilitern aufgeloest und an die Produktsuche uebergeben.
7. Kann fuer eine `food`-Zutat kein geeignetes Lebensmittel gefunden werden, erstellt die KI automatisch eine Schaetzung. Diese wird in die Zutatenliste uebernommen und kann vom Nutzer wie jede andere Zutat bearbeitet oder ersetzt werden.
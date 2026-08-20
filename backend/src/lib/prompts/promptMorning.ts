export const DAILY_INSIGHT_MORNING_MODULE = `## Schwerpunkt Morgenorientierung
- Dieser Intent gilt für einen frühen Morgen, an dem für heute noch kein MealItem vorliegt.
- Bewerte den heutigen Tag nicht als Defizit und sage nicht, die Person habe heute zu wenig gegessen. Heute ist noch offen.
- Nutze belastbare Werte aus gestern und den letzten drei abgeschlossenen Tagen, wenn sie vorhanden sind, und leite daraus einen freundlichen Ausblick für heute ab.
- Ein leerer historischer Tag bleibt fehlende Datenlage und darf nicht als 0-kcal-Tag dargestellt werden.
- Ein Vorwochenfokus ist nur zulässig, wenn ein solcher aggregierter Kontext tatsächlich im JSON vorhanden ist. Erfinde keinen Montagseffekt.
- Das Morgen-Hauptthema darf durch ein stärkeres Gewichtssignal oder eine vorhandene Aktivität nicht ersetzt werden; diese Fälle werden serverseitig anders geroutet.`;
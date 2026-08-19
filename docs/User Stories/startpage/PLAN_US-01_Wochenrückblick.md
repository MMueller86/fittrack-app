# Technischer Detailplan: US-01 Wochenrückblick - UX-Revision

**User Story:** [US-01_Wochenrückblick.md](US-01_Wochenrückblick.md)  
**Planrevision:** Detailplan nach beantworteten PO-Rückfragen und neuer Tagebuchnavigation  
**Status:** Ready for implementation handoff; PO-Entscheidungen vollständig beantwortet

Infrastructure Impact: Dev  
Mobile Build Impact: None

Diese Runde ändert ausschließlich diese Planungsdatei. Produktionscode, Tests, Knowledge-Base-Dateien, User Story und PNG werden nicht implementiert oder geändert. Die folgenden Work Packages beschreiben die spätere sequenzielle Umsetzung.

Die akzeptierte Zielauflösungs-Baseline aus der vorherigen US-01-Implementierung bleibt erhalten. Insbesondere werden historische Ziel-Snapshots, Profil-Fallbacks, Zielbandgrenzen, Datenstatus, AI-Cache und die bestehende Special-Activity-Semantik nicht zurückgesetzt.

## 1. Requirement Assessment / bestätigte PO-Entscheidungen

**Klassifikation:** Accept with modifications.

### Nutzerproblem und Lösungsfit

Die Wochenkarte soll zuerst die Entwicklung der sieben Tage verständlich machen. Die fünf Bilanzinformationen bleiben verfügbar, konkurrieren aber nicht länger mit dem Diagramm als gleich große Informationsblöcke. Tagesdetails, Makros und der Sprung in das Tagebuch werden progressiv erst im bestehenden Informations-Overlay angeboten.

Die neue Navigation ist eine ausdrücklich bestätigte Ausnahme zur bisherigen Regel "Balken öffnen keine Navigation": Der Balken öffnet weiterhin zuerst den rein informativen Overlay. Nur der darin enthaltene Link öffnet den bestehenden Tagebuch-Screen mit dem ausgewählten Datum. Der Link bearbeitet keine Daten, öffnet keinen Food-Entry-Hub und führt nicht in einen fremden Screen.

### Verbindliche Produktentscheidungen

1. Die fünf Kennzahlen bleiben erhalten und werden eindeutig dargestellt:
   - `7-Tage-Ziel`
   - `Gegessen`
   - `Ø Ziel / Tag`
   - `Ø gegessen / Tag`
   - `Ø Zielerreichung in Prozent`
2. Das Diagramm erhält die visuelle Priorität. Die Kennzahlen stehen kompakt darunter und werden nicht als fünf konkurrierende große Karten dargestellt.
3. Kompakte, Makro-ähnliche Felder/Kacheln sind erlaubt. Die Rezeptvorschau ist eine visuelle Referenz, keine 1:1-Vorlage.
4. `Schließen` darf der globale Dismiss-CTA des bestehenden `InfoOverlay` werden. Die technischen Nebenwirkungen werden im Frontend-Paket geprüft und durch Regressionstests abgesichert.
5. Der Tages-Overlay zeigt Protein, Kohlenhydrate und Fett. Die Darstellung orientiert sich an Tagebuch und Rezeptvorschau: kompakte Kalorien-/Eiweiß-Visualisierung und rechts beziehungsweise daneben die Makrowerte, soweit die Daten eine belastbare Darstellung erlauben.
6. Tagesdaten werden im Wochenrequest vorab geladen. Das Öffnen eines Balkens darf keinen neuen Diary- oder Macro-Request auslösen.
7. Die Legende darf responsiv umbrechen, muss auf Samsung S23 und S23 Ultra ohne Überlappung lesbar bleiben.
8. Der Tagebuch-Link öffnet den bestehenden DiaryScreen für genau das Datum des gewählten Balkens. Ein vorhandener Loading-/Spinner-Zustand des DiaryScreens ist zulässig und wird im Test berücksichtigt.
9. Der AI-Expand-Control muss sichtbar und bedienbar sein. Die bestehende AI-Auswertung bleibt serverseitig unverändert.

### Domain- und AI-Bewertung

- Die Makros werden deterministisch aus den beim Logging gespeicherten `MealItem.macros` summiert. Es gibt keine neue fachliche Schätzung und keine AI-Notwendigkeit.
- Ein `MealItem` mit `0 kcal` beziehungsweise `0 g` bleibt ein vorhandener Datenpunkt. Fehlende Ernährung bleibt `null`/neutral und wird nicht in Nullwerte umgewandelt.
- Die fünf Bilanzwerte werden ausschließlich aus dem bestehenden `totals`-Objekt angezeigt. Es wird keine neue Durchschnitts- oder Prozentformel im Mobile-Client eingeführt.
- Die AI-Wochenbewertung bleibt beratender Text. Prompt, Structured Output, Quota, Provider, Cache-Entscheidung und neutraler Fehlervertrag werden nicht geändert.
- `azure-openai-feature-integration` ist für Backend und QA dennoch als Review-Kontext erforderlich, weil der bestehende AI-Wochenendpoint und sein neutraler Ausfallzustand Teil der Regression bleiben. Das Frontend lädt diese Skill nicht.

**Open Product Owner Decisions:** None.

## 2. Aktueller Befund

### Wochenkarte und ViewModel

- [`WeeklyReviewCard.tsx`](../../../mobile/src/modules/home/WeeklyReviewCard.tsx) rendert aktuell Header, zwei Durchschnittsfelder und eine Bilanzzeile vor dem Diagramm. Die fünf Informationen sind damit zwar vorhanden, aber die Hierarchie setzt das Diagramm nicht an die erste Stelle.
- Die Karte zeigt sieben feste Spalten ohne horizontales Scrollen. Die Balken öffnen bereits den bestehenden `InfoOverlay`; die neue Navigation darf erst aus dessen zusätzlichem Link starten.
- Die aktuelle Legende zeigt nur Grün und Orange. Die PO-Anforderung verlangt für diese Revision drei lesbare Bedeutungen: Zielbereich, außerhalb des Zielbereichs sowie neutral fehlende beziehungsweise nicht bewertbare Daten.
- Das ViewModel [`weeklyReviewViewModel.ts`](../../../mobile/src/modules/home/weeklyReviewViewModel.ts) formatiert Tageskalorien, Ziele, Zielband, Datenstatus und Overlay-Body. Es enthält noch keine Protein-/Kohlenhydrat-/Fett-Summen und keinen separaten Overlay-Content für die Makrovisualisierung.
- Die bisherigen ViewModel-Tests decken sieben Tage, lokale Datumsformatierung, Zielauflösung, Missing States, `0 kcal`, Aktivität und die bestehende Bilanz ab. Ein Component-Test-Harness für React Native ist nicht vorhanden; sichtbare Interaktion bleibt daher zusätzlich manuell zu prüfen.
- Die diagonale Missing-Schraffur, der Zielmarker, die inklusive Zielzone `95-105 %`, die Kartenplatzierung und die Loading-/Error-/Retry-Zustände sind akzeptierte Baseline und bleiben erhalten.

### Home-Lifecycle und Wochenrequest

- [`HomeScreen.tsx`](../../../mobile/src/modules/home/HomeScreen.tsx) lädt den Wochenresponse auf Screen-Fokus und bei Pull-to-Refresh über `aiApi.getWeeklyInsight(referenceDate)`. Der Request ist vom Daily-Dashboard entkoppelt.
- Der bestehende `weeklyRequestId` schützt vor veralteten Antworten. Der Wochenresponse liegt bereits als lokaler Screen-State vor; ein zusätzlicher globaler Cache ist nicht erforderlich.
- Beim Tap auf einen Balken wird aktuell nur ein lokaler ausgewählter Tages-ViewModel gesetzt. Für die Makrorevision muss dieser Datenpfad vollständig aus dem Wochenresponse gespeist werden.

### Shared-, Backend- und Repository-Lage

- [`shared/types/weeklyReview.ts`](../../../shared/types/weeklyReview.ts) liefert je Tag Kalorien, Ziel, Prozent, Zielband, Datenstatus, Tagestyp, Workout, Aktivität und MealItem-Anzahl, aber keine Makros.
- [`shared/lib/weeklyReviewCalculator.ts`](../../../shared/lib/weeklyReviewCalculator.ts) erhält bereits die vollständigen Meals inklusive `MealItem.macros` und summiert daraus die Kalorien. Protein, Kohlenhydrate und Fett sind in den Eingabedaten vorhanden, werden aber verworfen.
- [`backend/src/functions/weeklyInsight.ts`](../../../backend/src/functions/weeklyInsight.ts) lädt pro abgeschlossenem Tag Diary und DayMeta und gibt das Ergebnis des Shared-Calculators zurück. Der kleinste konsistente Weg ist daher eine additive Calculator-/DTO-Erweiterung; ein neuer Endpoint oder ein weiterer Read beim Öffnen des Tooltips ist nicht nötig.
- [`backend/src/lib/repositories/diaryRepository.ts`](../../../backend/src/lib/repositories/diaryRepository.ts) und [`cosmosDiaryRepository.ts`](../../../backend/src/lib/repositories/cosmosDiaryRepository.ts) liefern vollständige Meal-Dokumente. `computeSummary()` zeigt, dass die Makros bereits on demand aggregiert werden.
- [`backend/src/lib/repositories/dayMetaRepository.ts`](../../../backend/src/lib/repositories/dayMetaRepository.ts) ist ausschließlich für Tagestyp, Workout, historische Ziel-Snapshots und Special Activity relevant. Es braucht für diese Revision keine Änderung.
- Die AI-Hashcanonicalisierung berücksichtigt die Item-Makros bereits. Eine Änderung an den aggregierten Antwortfeldern erfordert deshalb keine neue Cache- oder Promptlogik.

### Diary-Navigation und DiaryScreen

- [`RootNavigator.tsx`](../../../mobile/src/app/navigation/RootNavigator.tsx) hat einen Nutrition-Tab mit `DiaryMain: undefined`. Die verschachtelte Navigation ist vorhanden, aber eine datumsbezogene DiaryMain-Parametrisierung fehlt.
- [`DiaryScreen.tsx`](../../../mobile/src/modules/nutrition/DiaryScreen.tsx) startet mit `isoToday()` und hält das gewählte Datum lokal. `loadDay(date)` lädt bereits genau dieses Datum; bei einem initialen beziehungsweise date-bedingten Load wird ein `ActivityIndicator` angezeigt, Fehler und Retry sind vorhanden.
- [`diaryApi.ts`](../../../mobile/src/shared/api/diaryApi.ts) unterstützt `getDay(date)` über den bestehenden Diary-Request mit Datumsquery. [`nutritionDiaryService.ts`](../../../mobile/src/services/nutritionDiaryService.ts) reicht den Read-Call für den DiaryScreen durch.
- Die richtige Navigation ist deshalb `Home -> RootTab Nutrition -> NutritionStack DiaryMain({ date })`. Es gibt keine neue Route und keinen Anlass, den FoodEntryHub oder einen Aktivitäts-/Rezeptscreen zu verwenden.

### InfoOverlay, Icons und visuelle Referenzen

- [`InfoOverlay.tsx`](../../../mobile/src/shared/components/InfoOverlay.tsx) unterstützt derzeit nur `title`, String-`body`, `onClose`, Backdrop-Dismissal, `onRequestClose` und den globalen Text `Verstanden`.
- Alle aktuellen Nutzungen in Profile Wizard, Recipe Detail, Recipe Wizard, LogRecipeModal und WeeklyReviewCard verwenden den Button nur zum Schließen. Kein Aufrufer hängt technisch vom String `Verstanden` ab. Eine globale Umbenennung in `Schließen` ist daher mit vertretbarem Risiko möglich, muss aber in allen Overlay-Flows regressionsgeprüft werden.
- [`Icon.tsx`](../../../mobile/src/shared/components/Icon.tsx) bietet die benötigten `info`, `chevron-down`, `chevron-up` und `chevron-right`-Icons bereits an. Eine Icon-Erweiterung ist nicht vorgesehen.
- [`theme/index.ts`](../../../mobile/src/app/theme/index.ts) stellt die verbindlichen Farben, Typografie, Abstände und Radien bereit. Neue harte Farben, Schriftgrößen oder Layoutwerte außerhalb des Theme-Vertrags sind nicht vorgesehen.
- [`DayNutritionCard.tsx`](../../../mobile/src/modules/home/DayNutritionCard.tsx) zeigt eine Home-spezifische Kalorien-Donut- und Makrozeilen-Hierarchie.
- [`DayStoryCard.tsx`](../../../mobile/src/shared/components/DayStoryCard.tsx) enthält die engste visuelle Referenz: Kalorien-/Protein-Doppelkreis und rechts angeordnete Makrozeilen. Die Komponente ist jedoch Diary-spezifisch und soll nicht als komplette Wochenkarten-UI verschachtelt werden.
- [`NutritionTile.tsx`](../../../mobile/src/shared/components/NutritionTile.tsx), die Makrozeilen der Rezeptvorschau und [`RecipeIngredientGroup.tsx`](../../../mobile/src/modules/recipes/RecipeIngredientGroup.tsx) zeigen die gewünschte kompakte, scanbare Rezept-Optik. `RecipeIngredientGroup` selbst ist keine Makrokomponente und wird nicht funktional in die Wochenkarte eingebaut.

### Dokumentationsabweichungen

- [`docs/kb/tech/09-api-reference.md`](../../../docs/kb/tech/09-api-reference.md) beschreibt aktuell einen Diary-Pfad `/api/diary/day/{date}`, während die implementierte [`diaryApi.ts`](../../../mobile/src/shared/api/diaryApi.ts) `GET /api/diary?date=...` nutzt. Für diese Revision gilt die Implementierung als Verhaltensquelle; der API-Dokumentationshandoff muss die Abweichung korrigieren.
- Product- und Navigation-KB beschreiben den Wochenbalken derzeit noch als navigationfrei und `DiaryMain` ohne Datum. Die neue explizite Overlay-Link-Ausnahme und die optionale DiaryMain-Datumsparametrisierung müssen nach der Umsetzung dokumentiert werden.

## 3. Empfohlenes Ziel-Layout mit Alternativen und S23/S23-Ultra-Begründung

### Empfohlene Variante A: Diagramm zuerst, 2+2+1-Metrikfelder

Die Karte erhält folgende Reihenfolge:

1. Header mit Titel und Zeitraum.
2. Diagramm-Titel, Referenz und Tageswerte.
3. Sieben Balken, Zielmarker, Wochentage und Legende.
4. Kompakte Kennzahlenfelder direkt unter dem Diagramm.
5. AI-Wochenbewertung mit sichtbarem Expand-Control.

Die fünf Kennzahlen werden als flache, kompakte Makro-ähnliche Felder innerhalb der bestehenden Karte angeordnet:

| Zeile | Feld links | Feld rechts |
|---|---|---|
| 1 | `7-Tage-Ziel` | `Gegessen` |
| 2 | `Ø Ziel / Tag` | `Ø gegessen / Tag` |
| 3 | `Ø Zielerreichung in Prozent` über die verfügbare Breite | - |

Die Felder verwenden `minWidth: 0`, flexible Spalten und umbrechende Labels. Sie erhalten keine fünf eigenständigen großen Karten und keine konkurrierende Hero-Größe. Zahlen bleiben tabellarisch/scannbar; fehlende Totals zeigen einen neutralen Platzhalter. `0` bleibt sichtbar.

Diese Variante ist für S23 und S23 Ultra die Empfehlung, weil zwei Spalten auf dem schmaleren S23 ausreichend Breite für deutsche Labels und große Zahlen lassen. Das fünfte Feld über die volle Breite verhindert eine zu schmale Prozentanzeige und macht die neue fünfte Kennzahl eindeutig. Auf dem S23 Ultra entsteht mehr horizontaler Atemraum, ohne dass ein zusätzlicher Layoutmodus nötig wird. Die Implementierung darf keine feste Gerätebreite voraussetzen; sie muss mit den verfügbaren Innenmaßen der bestehenden Karte arbeiten.

### Alternative B: 3+2-Makrozeile unter dem Diagramm

Die erste Zeile würde drei Felder und die zweite Zeile zwei Felder enthalten. Vorteil ist eine kürzere Karte. Nachteil ist, dass `Ø Zielerreichung in Prozent` und die langen deutschen Labels auf dem S23 unterschiedlich umbrechen und die Felder visuell ungleich wirken. Die drei Felder der ersten Zeile würden außerdem näher an eine konkurrierende Kachelreihe rücken.

### Alternative C: Fünf Felder in einer horizontalen Reihe

Diese Variante wäre auf einem breiteren Gerät kompakt, ist auf dem S23 aber zu eng. Labels, Prozentwert und Accessibility-Font-Scaling würden entweder abgeschnitten oder die Diagrammgeometrie verschieben. Sie wird verworfen.

### Diagramm- und Legendenregeln

- Die sieben Balken bleiben fest im sichtbaren Viewport, ohne horizontales Scrollen.
- Werte oberhalb der Balken, Wochentage, Referenzlinie, Marker und Missing-Pattern behalten die akzeptierte Baseline-Semantik.
- Die Legende bleibt unter den Balken und wird als Drei-Punkt-Legende mit drei flexiblen Einträgen gerendert: Zielbereich, außerhalb des Zielbereichs und neutrale Schraffur für fehlende beziehungsweise nicht bewertbare Daten. Jeder Eintrag nutzt `minWidth: 0`, einen nicht schrumpfenden Farb-/Pattern-Marker und einen Textbereich, der kontrolliert umbrechen darf.
- Auf S23 und S23 Ultra werden Portrait, relevante Schriftvergrößerung und lange deutsche Labels geprüft. Kein Legendentext darf den Nachbartext oder die sieben Chartspalten überdecken.

## 4. Tooltip, Makros, Datenvorladung und Tagebuchnavigation

### Additive Wochenvertrags-Erweiterung

Der Shared-Vertrag erhält eine additive, verbraucherseitige Makrostruktur:

```ts
interface WeeklyConsumedMacros {
  protein: number;
  carbs: number;
  fat: number;
}

interface WeeklyNutritionDay {
  // bestehende Felder bleiben unverändert
  consumedMacros: WeeklyConsumedMacros | null;
}
```

Verbindliche Semantik:

- `consumedMacros` ist `null`, wenn kein `MealItem` vorhanden ist.
- Wenn mindestens ein `MealItem` vorhanden ist, werden Protein, Kohlenhydrate und Fett über alle Meals und Items des Tages summiert. Ein Summenwert `0` bleibt gültig.
- Die Rohsummen bleiben für Berechnung und Vertrag ungerundet. Die UI darf sie nur für die Darstellung formatieren.
- Es wird in dieser Revision kein `fiber`-Feld ergänzt, weil es nicht von der PO-Anforderung umfasst ist.
- Es werden keine historischen Protein-/Kohlenhydrat-/Fett-Ziele erfunden. Der bestehende historische Snapshot persistiert nur das Kalorienziel. Deshalb zeigt die UI bei fehlender belastbarer Makro-Zielbasis keine irreführende Makro-Prozentquote.

Die notwendige Erweiterung ist ausdrücklich Shared-/Backend-Arbeit. Der bestehende Wochenendpoint bleibt die einzige API-Quelle; `aiApi.getWeeklyInsight()` konsumiert danach automatisch den erweiterten Shared-Typ. Es entsteht kein zusätzlicher Tages- oder Makroendpoint.

### Overlay-Inhalt

Der informative Tages-Overlay enthält weiterhin den bestehenden neutralen Detailtext:

- Wochentag und Datum im Overlay-Titel;
- Verbrauch oder neutral `Nicht verfügbar`;
- Zielerreichung, sofern vorhanden;
- effektives Ziel oder exakt `Ziel nicht verfügbar`;
- bei Special Activity Basisziel, Aktivitätsbonus und effektives Ziel;
- Training/Workout-Typ und Aktivitätslabel, sofern geliefert;
- Datenstatus und neutrale Missing-Hinweise, sofern erforderlich.

Darunter kommt ein kompakter `WeeklyDayMacroSummary`-Bereich:

- Kalorienring gegen das bereits gelieferte effektive Kalorienziel beziehungsweise den vorhandenen Zielprozentsatz;
- Eiweißring nur mit einer fachlich belastbaren Zielbasis. Für den hier geplanten Vertrag ist kein historisches Makroziel vorhanden; ohne solche Basis bleibt der äußere Ring neutral oder wird auf eine einzelne Kalorienvisualisierung reduziert. Es wird keine Protein-Zielerreichung aus aktuellen Profilwerten oder einer frei erfundenen Skala abgeleitet.
- Rechts beziehungsweise daneben die tatsächlichen Werte `Protein`, `Kohlenhydrate` und `Fett` in Gramm. Die Werte sind auch bei `0 g` sichtbar; `null`/fehlende Tagesdaten werden neutral als nicht verfügbar erklärt.

Die visuelle Struktur orientiert sich an `DayStoryCard` und der Rezeptvorschau, wird aber nicht als vollständige Diary-Karte verschachtelt. Bestehende Theme-Tokens und vorhandene SVG-Abhängigkeit werden verwendet. Neue Pakete und harte Farben in der Komponente sind ausgeschlossen.

### InfoOverlay und globaler Dismiss-CTA

Der bestehende `InfoOverlay` wird minimal erweitert:

- Default-Buttontext und Accessibility-Label werden global von `Verstanden` auf `Schließen` geändert.
- Bestehende Aufrufer verwenden weiterhin nur `visible`, `title`, `body` und `onClose`; für sie ändert sich nur der sichtbare Dismiss-Text.
- Optionaler `children`-/Content-Slot erlaubt den Wochen-Makrobereich, ohne eine zweite Overlay-Komponente zu bauen.
- Eine optionale sekundäre Aktion kann als klarer Link mit eigenem Accessibility-Ziel gerendert werden. Nur der Wochen-Overlay setzt sie auf `Tagebuch öffnen`.
- Die primäre Dismiss-Aktion, Backdrop-Dismissal und `onRequestClose` bleiben unverändert. Bei längeren Aktivitäts- und Makrodetails muss der Inhalt innerhalb des bestehenden Overlays auf kleinen Höhen lesbar bleiben; eine begrenzte Scrollmöglichkeit darf nur für diesen Content-Zustand ergänzt werden.

Die globale Änderung ist vertretbar, weil alle aktuell gefundenen Nutzungen einen reinen Dismiss-Vorgang darstellen und keine semantische Bestätigung im Sinne einer gespeicherten Entscheidung benötigen. QA prüft Profile Wizard, Recipe Wizard, Recipe Detail, LogRecipeModal und Wochenkarte. Falls die gemeinsame Layoutänderung doch einen bestehenden Overlay-Fall verschlechtert, ist als begrenzte technische Ausweichlösung ein lokaler Wochen-Overlay mit demselben Dismiss-Verhalten vorzusehen; der globale Textwechsel bleibt dann trotzdem separat zu bewerten.

### Vorladung und State-/Cache-Lifecycle

1. `HomeScreen` ruft beim Fokus und bei Pull-to-Refresh genau den bestehenden Wochenrequest auf.
2. Der Backend-Response enthält pro Tag bereits `consumedMacros`; die Berechnung erfolgt während des Wochenrequests aus den geladenen Meals.
3. `weeklyReview` ersetzt den vollständigen lokalen Response-State atomar. `WeeklyReviewCard` baut daraus synchron sein ViewModel und seinen Tages-Content.
4. Der Balken-Press-Handler setzt nur den bereits vorhandenen Tages-ViewModel-State. Er ruft weder `diaryApi.getDay()` noch einen neuen Macro-Service auf.
5. Bei einem neuen Response, Fokuswechsel, Retry oder Unmount darf kein veralteter ausgewählter Tag im Overlay verbleiben. Die bestehende `weeklyRequestId`-Guard-Logik bleibt aktiv; ein Response mit älterer Request-ID darf weder Review noch Overlaydaten überschreiben.
6. Während ein kompletter Wochenrequest läuft, bleibt der bestehende Skeleton-/Loading-Zustand gültig. Wenn ein vorhandener Review weiter angezeigt wird, stammen auch die geöffneten Makros aus diesem bereits geladenen Review.
7. Ein kurzer Spinner ist nur als lokaler Darstellungsfallback zulässig, falls der neue Overlay-Content während eines Response-Wechsels noch aufgebaut wird. Er darf keine zusätzliche Anfrage starten. Bleiben Makrofelder im Response nicht vorhanden, folgt ein neutraler `Makrodaten nicht verfügbar`-Zustand statt eines endlosen Spinners.
8. Eine unvollständige alte Backendantwort darf den Client nicht zum Diary-Nachladen verleiten. Die Backend- und Release-Reihenfolge muss den neuen Response zuerst in Dev verfügbar machen.

### Tagebuch-Link und Route

Der Link erhält das date-only-Datum des gewählten `WeeklyNutritionDay` und navigiert ausschließlich in den vorhandenen Nutrition-Stack:

```text
HomeStack HomeMain
  -> RootTab Nutrition
     -> NutritionStack DiaryMain({ date: 'YYYY-MM-DD' })
```

Technische Regeln:

- `NutritionStackParamList.DiaryMain` wird rückwärtskompatibel auf `{ date?: string } | undefined` erweitert.
- `RootTabParamList.Nutrition` wird als verschachtelter `NavigatorScreenParams`-Typ modelliert, damit die Navigation den bestehenden Stack korrekt adressiert.
- `DiaryScreen` übernimmt den optionalen Route-Parameter, validiert das date-only-Format defensiv und lädt ihn über das bestehende `loadDay(date)`.
- Der Parameter wird nach Übernahme als einmaliger Navigationsimpuls konsumiert oder so behandelt, dass Fokuswechsel ihn nicht unerwartet erneut anwenden. Der lokale Diary-Datumszustand bleibt danach der ausgewählte Tag.
- Bei der Route-Übernahme wird `loading` gesetzt, sodass der bestehende `ActivityIndicator` erscheinen darf. API-Fehler bleiben im vorhandenen Fehler-/Retry-Zustand.
- Der Overlay-Link schließt beziehungsweise entkoppelt den Wochen-Overlay vor dem Tab-Wechsel. Doppelte Taps werden abgefangen.
- Der Link darf keinen `FoodEntryHub`, keine Aktivitätsroute, keine Rezeptaktion und keine Mutation auslösen.
- Der Balken selbst bleibt ein Overlay-Trigger. Nur `Tagebuch öffnen` innerhalb des Overlays navigiert.

## 5. Scope / Out of Scope

### In Scope

- Additive `consumedMacros`-Struktur in Shared-Typ und Wochenberechnung.
- Backend-Response- und Endpoint-Tests für Makros, Null-/Zero-Semantik und unveränderte AI-/Target-Verträge.
- Diagramm-zuerst-Layout mit fünf kompakten Kennzahlenfeldern.
- Tages-Overlay mit Makrodarstellung, neutralen Missing States und dem Tagebuch-Link.
- Vorladung der Makros über den bestehenden Wochenrequest ohne Request beim Balken-Tap.
- Datumsparametrisierung des bestehenden `DiaryMain`-Screens und typisierte verschachtelte Navigation.
- Globale `InfoOverlay`-Dismiss-Beschriftung `Schließen` plus optionaler Wochen-Link-/Content-Slot.
- Sichtbarer, bedienbarer AI-Expand-Control mit `Mehr anzeigen`/`Weniger anzeigen` und vorhandenen Chevron-Icons.
- Responsive Drei-Punkt-Legende und Accessibility für S23/S23 Ultra.
- ViewModel-/Shared-/Backend-Tests sowie manuelle Geräte-, TalkBack- und Netzwerkprüfung.
- Dokumentationshandoffs in den zuständigen Backend-/Shared-/Frontend-Paketen.

### Out of Scope

- Änderung von [`US-01_Wochenrückblick.md`](US-01_Wochenrückblick.md) oder [`US-01_Wochenrückblick.png`](US-01_Wochenrückblick.png).
- Änderung der historischen Kalorienzielauflösung, der `95-105 %`-Grenzen, der Missing-State-Semantik, der `0 kcal`-Regel oder der Special-Activity-Berechnung.
- Persistenz neuer Makrofelder in `Meal`, `DayMeta` oder einem neuen Cosmos-Container. Die Makros bleiben abgeleitete Response-Daten.
- Neue Diary-, Macro- oder Cache-Endpoints sowie Nachladen je Balken.
- Historische Protein-/Kohlenhydrat-/Fett-Zielsnapshots oder neue fachliche Makroziele.
- AI-Prompt, Structured Output, Quota, Promptversion, Provider, AI-Hash, AI-Cache oder serverseitige AI-Validierung.
- Bearbeitung, Hinzufügen, Verschieben oder Löschen von Tagebucheinträgen über den Link.
- Navigation des Balkens selbst außerhalb des bestehenden Informations-Overlays.
- Neue npm-Pakete, native Module, Config Plugins, `app.config.js`- oder EAS-Konfigurationsänderungen.
- Appweiter Refactor von `DayNutritionCard`, `DayStoryCard`, `NutritionTile` oder Rezeptmodulen. Sie dienen als Referenz beziehungsweise werden nur minimal wiederverwendet.
- Umsetzung von Code oder Dokumentationsdateien in dieser Planner-Runde.

### Infrastructure and Configuration (Development + Alpha)

- Es gibt keine neue Azure-Ressource, keinen neuen Cosmos-Container, keine Bicep-Änderung und keine Änderung an App Settings. Die Makros bleiben abgeleitete Response-Daten.
- `Infrastructure Impact: Dev` bedeutet: Der bestehende Function-App-Code muss nach B-REV-1 in Development mit dem erweiterten Wochenresponse verfügbar sein, bevor F-REV-1 und Q-REV-1 den End-to-End-Pfad prüfen.
- Für Alpha ist nach erfolgreicher QA nur der bestehende Backend-/Mobile-Releaseweg erforderlich. Backend-Vertrag zuerst, danach der bestehende Expo-Preview-Build; kein neuer Dev Build wird aus dieser Änderung abgeleitet.
- `Mobile Build Impact: None`: keine native Abhängigkeit, kein Config Plugin und keine `app.config.js`-Änderung. Die finale operative Build-Entscheidung bleibt beim Infrastructure-&-Release-Verantwortlichen.

## 6. Work Packages Backend/Shared, Frontend und QA

Die Pakete werden strikt sequenziell ausgeführt. Jeder Handoff enthält nur die für das nächste Paket relevanten Ergebnisse.

### S-REV-1: Shared-Vertrag und Wochenaggregation

**Agent:** Backend  
**Goal:** Den Shared-Wochenvertrag um die tatsächlich aus MealItems aggregierten Tagesmakros erweitern, ohne die bestehende Ziel- und Datenstatuslogik zu verändern.

**Required Knowledge Base:**
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `shared/types/weeklyReview.ts`
- `shared/types/diary.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `shared/lib/weeklyReviewCalculator.test.ts`
- `backend/src/lib/repositories/diaryRepository.ts`
- `backend/src/lib/repositories/dayMetaRepository.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1, AC-3, AC-4, AC-5, AC-6, AC-10
- REG-1, REG-2, REG-3

**Dependencies:**
- Akzeptierte Zielauflösungs-Baseline und die in diesem Plan beschriebene `consumedMacros`-Semantik.

**Implementation focus:**
- `getMealStats()` beziehungsweise ein eng begrenzter benachbarter Pure-Helper summiert Protein, Kohlenhydrate und Fett aus allen MealItems.
- Leere Meals, vollständig fehlende Tage, vorhandene `0`-Werte und mehrere Meals werden getrennt getestet.
- Keine Änderungen an `calculateTotals()`, Zielauflösung, Tagesprozentsatz oder AI-Promptdaten.

**Documentation handoff:**
- Übergabe der exakten DTO-Feldnamen, Null-/Zero-Semantik und Ableitungsregel für `docs/kb/domain/01-nutrition-model.md`, `docs/kb/domain/02-diary.md` und `docs/kb/tech/09-api-reference.md`.

**Expected Handoff:**
- Aktualisierte Shared-Typen und reine Wochenaggregation.
- Shared-Unit-Tests für mehrere Items/Meals, fehlende Ernährung und `0 g`/`0 kcal`.
- Kurzes Vertragsblatt für B-REV-1 und F-REV-1 mit `consumedMacros` und Darstellungseinschränkungen.

### B-REV-1: Wochenendpoint und Backend-Vertragsregression

**Agent:** Backend  
**Goal:** Den bestehenden `GET /api/ai/weekly-insight`-Response mit den neuen Shared-Makrofeldern ausliefern und nachweisen, dass der bestehende AI-/Cache-/Quota-Vertrag unverändert bleibt.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/lib/prompts/weeklyInsightV1.ts`
- `backend/src/lib/repositories/diaryRepository.ts`
- `backend/src/lib/repositories/dayMetaRepository.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `shared/types/weeklyReview.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-3, AC-4, AC-5, AC-6, AC-10
- REG-1, REG-2, REG-3, REG-4

**Dependencies:**
- S-REV-1 muss den Shared-Vertrag und die Aggregation abgeschlossen haben.

**Implementation focus:**
- Prüfen, dass der bestehende Handler das Calculator-Ergebnis unverändert als Response weitergibt; kein neuer Tagesrequest und kein neuer Handlerpfad.
- Contract-/Handler-Tests ergänzen: Makros werden aus den gelieferten MealItems ausgegeben, fehlende Tage liefern `null`, vorhandene Nullwerte bleiben gültig.
- Sicherstellen, dass der AI-Prompt weiterhin nur die bestehenden sanitisierten Kalorien-/Ziel-/Statuswerte erhält und keine Rohdaten/Makrodetails ungewollt an Azure OpenAI weitergereicht werden.
- Quota-Reihenfolge, neutraler AI-Ausfall, Cache-Hash und historische Zielauflösung als Regression ausführen.
- `backend/src/lib/repositories/diaryRepository.ts` und `dayMetaRepository.ts` nicht für neue Persistenz erweitern.

**Persistence Impact:** None. Es gibt kein neues Dokumentfeld, keine neue Entität und keinen neuen Container. Die Makros werden aus bereits persistierten `MealItem`-Snapshots gelesen; bestehende Dev- und Alpha-Dokumente sind ohne Migration kompatibel.

**Documentation handoff:**
- Aktualisierungsvorschlag für `docs/kb/tech/09-api-reference.md` und `docs/kb/domain/02-diary.md` mit Response-Beispiel und dem Hinweis, dass Makros abgeleitete Tageswerte sind.
- Korrektur des dokumentierten Diary-GET-Pfads anhand der Implementierung, ohne den API-Pfad in dieser Revision zu ändern.

**Expected Handoff:**
- Backend-Response mit `consumedMacros` für exakt sieben Tage.
- Backend-Unit-/Handler-Testresultate und `npm run build:verify`-Resultat.
- Bestätigung: keine Prompt-, Schema-, Quota-, Cache-, Cosmos- oder Infrastrukturänderung.

### F-REV-1: Wochenkarten-UX, Overlay und datumsbezogene Diary-Navigation

**Agent:** Frontend  
**Goal:** Die Wochenkarte auf Diagramm-Fokus umstellen, den vollständigen Tages-Overlay aus dem vorab geladenen Wochenresponse rendern, den Link in den bestehenden DiaryScreen führen und die sichtbare AI-/Legenden-/Accessibility-Revision umsetzen.

**Required Knowledge Base:**
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/shared/components/InfoOverlay.tsx`
- `mobile/src/shared/components/Icon.tsx`
- `mobile/src/app/theme/index.ts`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/shared/api/diaryApi.ts`
- `mobile/src/shared/api/aiApi.ts`
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/shared/components/DayStoryCard.tsx`
- `mobile/src/shared/components/NutritionTile.tsx`
- `mobile/src/modules/recipes/RecipeIngredientGroup.tsx`
- `mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx`
- `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
- `mobile/package.json`
- `mobile/vitest.config.mts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1 bis AC-12
- REG-1 bis REG-6

**Dependencies:**
- S-REV-1 und B-REV-1 mit stabilem Shared-/API-Vertrag.
- Keine eigene Diary- oder Macro-Abfrage als Ausweichlösung.

**Implementation focus:**
- ViewModel um Makroformatierung, fünf Metrikwerte, neutralen Macro-Missing-State und strukturierten Overlay-Content erweitern.
- Layout nach Variante A umsetzen. Das Diagramm steht vor den Kennzahlen; die fünf Felder bleiben kompakt und responsiv.
- `WeeklyDayMacroSummary` anhand der bestehenden Diary-/Rezeptoptik umsetzen, ohne eine vollständige `DayStoryCard` in die Wochenkarte einzusetzen. Keine erfundene Makro-Zielerreichung.
- `InfoOverlay` global auf `Schließen` umstellen und optionalen Content-/sekundären Link-Slot ergänzen. Die bestehende Dismissal-Semantik aller Aufrufer bleibt erhalten.
- `Tagebuch öffnen` mit dem date-only-Datum des gewählten Tages an die verschachtelte Nutrition-Route senden. Der Balken selbst bleibt beim Overlay.
- `DiaryScreen` optionalen `date`-Parameter übernehmen lassen, den vorhandenen `loadDay(date)` verwenden und den bestehenden Loading-/Error-/Retry-Zustand bewahren.
- Wochenrequest-State unverändert als einzige Datenquelle verwenden; keine Anfrage in `onPress` oder beim Overlay-Mount.
- AI-Text an einer unbeschränkten, nicht zugänglichen Messdarstellung messen und erst danach visuell auf zwei Zeilen begrenzen. So wird `Mehr anzeigen` bei tatsächlichem Überlauf sichtbar. Bei Expansion `Weniger anzeigen` und `chevron-up`; bei kurzen Texten kein Toggle.
- Bewertungsbeschreibung, Expand-Control, Retry und Diary-Link als getrennte Accessibility-Ziele mit deutschen Labels/Hints ausweisen.
- Drei Legendenpunkte mit `minWidth: 0` kontrolliert umbrechen lassen; keine feste Breite für S23/S23 Ultra codieren. Der neutrale Pattern-Punkt muss vom grünen und orangenen Punkt unterscheidbar bleiben.

**Documentation handoff:**
- Abgleich von `docs/kb/tech/03-mobile.md`, `docs/kb/product/02-navigation.md`, `docs/kb/product/03-design-system.md` und `docs/kb/product/05-ux-patterns.md`.
- Festhalten: Diagramm-zuerst-Hierarchie, fünf kompakte Kennzahlen, Makro-Overlay, `Tagebuch öffnen` als einzige bestätigte Navigation innerhalb des Overlays, `DiaryMain({ date })`, globales `Schließen` und sichtbarer AI-Expand-Control.
- Die User Story und PNG bleiben unverändert.

**Expected Handoff:**
- Überarbeitete Wochenkarte mit fünf Kennzahlen, Diagramm-Fokus, sieben zugänglichen Balken, vollständigem Makro-Overlay und Link zum ausgewählten Diary-Datum.
- Typisierte Nutrition-Stack-/Tab-Navigation und DiaryScreen-Datumsübernahme.
- Global getesteter `InfoOverlay` mit `Schließen` und unverändertem Backdrop-/Back-Verhalten.
- ViewModel- und Frontend-Testresultate sowie `cd mobile && npm test` und `cd mobile && npx tsc --noEmit`.
- Dokumentationsabgleich für Q-REV-1.

### Q-REV-1: Vollständige Revisions- und Regressionprüfung

**Agent:** QA  
**Goal:** Die neue Wochenkarten-UX, den erweiterten Wochenvertrag, die Overlay-Aktion, die Diary-Datumsroute und alle unveränderten Baseline-Regeln auf Code-, Test-, Geräte- und Accessibility-Ebene prüfen.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- Finaler Handoff aus S-REV-1, B-REV-1 und F-REV-1
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/shared/components/InfoOverlay.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/shared/api/diaryApi.ts`
- `mobile/src/shared/api/aiApi.ts`
- `shared/types/weeklyReview.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `shared/lib/weeklyReviewCalculator.test.ts`
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- Aktualisierte Dokumentationshandoffs

**Required Skills:**
- `azure-openai-feature-integration`

Die AI-Prüfung beschränkt sich auf sichtbaren Expand/Collapse, neutralen Ausfallzustand, unveränderte Prompt-/Quota-/Cache-Grenzen und darauf, dass keine Roh-Makros ungeplant in den Prompt gelangen.

**Relevant Acceptance Criteria:**
- AC-1 bis AC-12 vollständig
- REG-1 bis REG-6 vollständig

**Dependencies:**
- Vollständige S-/B-/F-Handoffs inklusive Testausgaben und dokumentierter API-/Navigationsemantik.
- Backend muss in Dev mit dem neuen Response erreichbar sein, bevor die Geräteprüfung beginnt.

**Expected Handoff:**
- Acceptance-Criteria-Matrix mit positiven, negativen und Edge-Case-Nachweisen.
- Ergebnisse der Shared-, Backend- und Mobile-Testläufe sowie Typechecks.
- Manuelle Nachweise auf Samsung S23 und S23 Ultra, inklusive TalkBack, Portrait, Schriftvergrößerung, Loading, Fehler und Retry.
- Review-Urteil `PASS`, `PASS WITH ISSUES` oder `FAIL` mit konkreten Findings und verbleibenden `UNVERIFIED`-Punkten.

## 7. Dokumentationshandoffs

Es gibt kein separates Dokumentations-Work-Package. Die Dokumentation wird vor dem jeweiligen Handoff im zuständigen Paket aktualisiert; QA prüft danach die Genauigkeit. In dieser Planner-Runde werden diese Dateien nicht geändert.

### Backend-/Shared-Handoff

- `docs/kb/domain/01-nutrition-model.md`: Makros als aus MealItem-Snapshots abgeleitete Wochenwerte, Null-/Zero-Semantik und keine erfundenen historischen Makroziele.
- `docs/kb/domain/02-diary.md`: erweiterter `WeeklyNutritionDay`-Response, keine neue Persistenz und keine Migration.
- `docs/kb/tech/09-api-reference.md`: `consumedMacros` im Wochenresponse und Korrektur des dokumentierten Diary-GET-Pfads auf den tatsächlich implementierten Vertrag.

### Frontend-Handoff

- `docs/kb/tech/03-mobile.md`: Vorladung über den Wochenrequest, lokaler Overlay-State, DiaryMain-Datumsparameter und Loading-/Retry-Lifecycle.
- `docs/kb/product/02-navigation.md`: `Nutrition -> DiaryMain({ date })` und die begrenzte Navigationsexception ausschließlich über den Overlay-Link.
- `docs/kb/product/03-design-system.md`: Diagramm-Fokus, kompakte Bilanzfelder, Makrovisualisierung, globale `Schließen`-Beschriftung und responsive Legende.
- `docs/kb/product/05-ux-patterns.md`: Balken öffnen zuerst den InfoOverlay, `Tagebuch öffnen` ist darin der einzige bestätigte Navigations-CTA, AI-Expand-Control und Accessibility-Ziele.

`docs/kb/product/01-product-philosophy.md` wird nur angepasst, wenn die Implementierung dort eine konkrete Wochenkartenbeschreibung berührt; es wird keine allgemeine Produktentscheidung aus dieser Revision abgeleitet.

## 8. Teststrategie

### Shared- und Backend-Tests

- Aggregation mehrerer Meals und mehrerer Items pro Tag.
- Protein, Kohlenhydrate und Fett werden getrennt und korrekt summiert.
- Leere Meals und Tage ohne Items liefern `consumedMacros: null`.
- Ein vorhandener Item-Snapshot mit `0 kcal` beziehungsweise `0 g` bleibt gültig und wird nicht als Missing State klassifiziert.
- Eingaben werden nicht mutiert.
- Wochenresponse enthält exakt sieben Tage und alle bestehenden Ziel-/Statuswerte unverändert.
- Handler liefert Makros auch bei AI-Quota-/Provider-Ausfall; nur `evaluation.text` bleibt neutral.
- Kein roher Mealname, keine User-ID und keine neuen Makrodetails werden unbeabsichtigt in den AI-Prompt aufgenommen.
- Cache-Hit, Hash-Invalidierung bei Item-Makroänderung, Quota-Reihenfolge und historische Ziel-Snapshots bleiben grün.

Vorgesehene Befehle nach Implementierung:

```text
cd shared && npm test
cd backend && npm test
cd backend && npm run build:verify
```

### Mobile-Unit- und Typecheck-Tests

- ViewModel-Tests für alle fünf Kennzahlen mit vorhandenen Totals, fehlenden Totals und gültigen Nullwerten.
- Tests für `consumedMacros`-Formatierung, neutralen Missing State und `0 g`.
- Tests für Overlay-Titel/Body-Daten, Activity-Zeilen und den ausgewählten date-only-Wert.
- Regression für `Ziel nicht verfügbar`, Datenstatus, Zielband und `N von 7 Tagen`.
- Route-/Typcheck für `DiaryMain({ date })` und verschachtelte `Nutrition`-Navigation.
- Expand-Zustandslogik für kurzer Text, langer Text, neue Bewertung und neutralen AI-Status.

Vorgesehene Befehle nach Implementierung:

```text
cd mobile && npm test
cd mobile && npx tsc --noEmit
```

### Manuelle Geräte- und Accessibility-Prüfung

QA prüft auf Samsung S23 und S23 Ultra mindestens:

- Diagramm steht vor den Kennzahlen; alle fünf Kennzahlen sind lesbar und eindeutig.
- Genau sieben Balken bleiben sichtbar; kein horizontales Scrollen und keine Spaltenverschiebung durch Labels.
- Die drei Legendenbedeutungen bleiben lesbar, dürfen kontrolliert umbrechen und überlappen nicht.
- Tap auf jeden Balken öffnet zuerst den richtigen Overlay-Tag; kein Tap löst direkt Navigation oder Bearbeitung aus.
- Overlay enthält vorhandene Kalorien-/Zieldetails, Makros, Missing-Hinweise, Aktivitätsdetails und `0`-Werte korrekt.
- Öffnen eines identischen Tooltips erzeugt keinen neuen Diary-Request. Dies wird mit Network-Log beziehungsweise Mock-Request-Zähler geprüft.
- `Tagebuch öffnen` führt exakt zum Nutrition-Diary mit dem ausgewählten Datum. Der DiaryScreen zeigt gegebenenfalls den vorhandenen Spinner, lädt den richtigen Tag und zeigt bei Fehlern den vorhandenen Retry.
- `Schließen`, Backdrop und Android-Back schließen den Overlay. Alle bestehenden InfoOverlay-Aufrufer bleiben nutzbar.
- Lange AI-Bewertung zeigt sichtbar `Mehr anzeigen` mit Chevron nach unten; Expansion zeigt den vollständigen Text und `Weniger anzeigen` mit Chevron nach oben. Kurze Texte erhalten keinen Toggle.
- TalkBack erkennt Balken, Infozeile, Makrobereich, Diary-Link, Expand/Collapse, Retry und `Schließen` als getrennte benannte Ziele.
- Schriftvergrößerung und schmale Breite erzeugen keinen Textüberlauf in Kennzahlen, Overlay, Link oder Legende.
- Loading, Error, Retry, Pull-to-Refresh, Focus-Refresh, AI-neutral und die bestehende `DayNutritionCard` bleiben funktionsfähig.

## 9. Acceptance Criteria

**AC-1 - Fünf Kennzahlen:** Die Wochenkarte zeigt `7-Tage-Ziel`, `Gegessen`, `Ø Ziel / Tag`, `Ø gegessen / Tag` und `Ø Zielerreichung in Prozent` genau einmal. Werte stammen aus den jeweiligen `totals`-Feldern. Fehlende Totals bleiben neutral; ein numerischer Wert `0` bleibt sichtbar.

**AC-2 - Diagramm-Fokus:** Header und Zeitraum bleiben sichtbar. Das Diagramm steht vor der Bilanz. Die fünf Kennzahlen erscheinen kompakt darunter und werden nicht als fünf große konkurrierende Karten dargestellt.

**AC-3 - Fester Sieben-Tage-Viewport:** Genau sieben Tagesbalken, Wochentage, Referenzlinie und vorhandene Zielmarker bleiben im verfügbaren Viewport sichtbar. Es gibt kein horizontales Scrollen und keine dynamische Verbreiterung durch Text.

**AC-4 - Balkenaktion:** Jeder Balken öffnet ausschließlich den informativen Overlay für sein eigenes Datum. Der Balken löst keine Navigation, Bearbeitung, Mutation, FoodEntryHub-Öffnung oder externe Aktion aus.

**AC-5 - Tagesdetails:** Der Overlay zeigt den korrekten Wochentag, Verbrauch, Zielerreichung, effektives Ziel sowie vorhandene Basisziel-, Aktivitätsbonus-, Workout- und Aktivitätsinformationen. Fehlende Werte werden neutral erklärt; `Ziel nicht verfügbar` bleibt der exakte neutrale Zieltext.

**AC-6 - Tagesmakros:** Bei einem Tag mit MealItems zeigt der Overlay die aus dem Wochenresponse gelieferten Protein-, Kohlenhydrat- und Fett-Summen in Gramm. Die angezeigten Werte entsprechen der Summe aller gespeicherten Item-Snapshots; `0 g` ist gültig. Ein Tag ohne MealItems zeigt keine erfundenen Makros.

**AC-7 - Makrovisualisierung ohne Fehlinterpretation:** Der Overlay verwendet eine kompakte Kalorien-/Eiweiß-orientierte Darstellung und rechts beziehungsweise daneben Makrowerte entsprechend der Diary-/Rezeptvorschau. Eine Protein-Zielerreichung wird nur angezeigt, wenn eine belastbare Zielbasis vorhanden ist; sonst bleibt die Visualisierung neutral oder fällt auf die Kalorienvisualisierung mit absoluten Makrowerten zurück.

**AC-8 - Vorladung:** Der Wochenrequest liefert die Makros je Tag vor dem Balken-Tap. Das Öffnen eines Overlays erzeugt keinen zusätzlichen `diaryApi.getDay()`-, Macro- oder sonstigen Netzwerkrequest. Focus-Refresh, Pull-to-Refresh, Retry und veraltete Request-IDs respektieren den bestehenden State-Lifecycle.

**AC-9 - Tagebuchnavigation:** Der Link `Tagebuch öffnen` ist nur im Tages-Overlay vorhanden. Er navigiert ausschließlich nach `Nutrition -> DiaryMain` und übergibt exakt das date-only-Datum des gewählten Balkens. Der DiaryScreen lädt dieses Datum, nicht automatisch heute. Ein Spinner ist während dieses Loads zulässig; bei Fehlern bleiben der bestehende Fehler- und Retry-Zustand erhalten.

**AC-10 - Overlay-Dismissal:** Der globale Dismiss-CTA lautet `Schließen`. `Schließen`, Backdrop und Plattform-Back schließen alle bestehenden InfoOverlays. Der neue Diary-Link bleibt ein separates, benanntes Accessibility-Ziel und ersetzt den Dismiss-CTA nicht.

**AC-11 - AI-Expand-Control:** Bei einer Bewertung mit mehr als zwei tatsächlichen Textzeilen ist `Mehr anzeigen` mit `chevron-down` sichtbar und bedienbar. Nach Aktivierung wird der vollständige Text und `Weniger anzeigen` mit `chevron-up` gezeigt. Bei kurzen Texten, `null` und neutralem AI-Status erscheint kein unnötiger Toggle. Der Zustand wird bei einem neuen Text zurückgesetzt.

**AC-12 - Responsive Drei-Punkt-Legende:** Zielbereich, außerhalb des Zielbereichs sowie neutrale fehlende beziehungsweise nicht bewertbare Daten bleiben auf Samsung S23 und S23 Ultra getrennt, lesbar und ohne Überlappung. Kontrollierter Textumbruch ist zulässig. Alle drei Bedeutungen sowie die Info- und Expand-Controls sind zugänglich benannt.

**AC-13 - Missing und Zero:** Fehlende Ernährung, fehlendes Ziel und beides bleiben neutral schraffiert beziehungsweise neutral beschriftet. Ein vorhandener `MealItem` mit `0 kcal` bleibt ein solider Datenbalken und wird nicht als fehlend behandelt.

**AC-14 - Vertrags- und Zielregression:** Wochenzeitraum, sieben Tage, Zielauflösung, Zielband `95-105 %`, Marker, Totalsformel, Datenstatus, Special Activity und Profil-Fallback bleiben unverändert. Die neue Makrostruktur ist additiv.

**AC-15 - AI- und Sicherheitsregression:** Prompt, Structured Output, Quota, AI-Cache, Hash, neutraler Ausfallvertrag, Authentifizierung und die Regel "Backend owns AI" bleiben unverändert. Rohdaten der Diary-Items werden nicht an die mobile Navigation oder an einen neuen externen Dienst weitergegeben.

**AC-16 - Test- und Build-Nachweis:** Shared-Unit-Tests, Backend-Tests, Backend-Build-Verify, Mobile-Unit-Tests und Mobile-Typecheck bestehen nach der Umsetzung. QA dokumentiert verbleibende unverified Geräte-/Screenreader-Prüfungen ausdrücklich.

## 10. Risiken / offene technische Annahmen

- **API-Rollout:** Ein neuer Mobile-Client darf nicht dauerhaft auf ein altes Backend ohne `consumedMacros` angewiesen sein. Reihenfolge: Shared/Backend implementieren und in Dev bereitstellen, dann Mobile testen. Clientseitige defensive Behandlung darf nur neutral bleiben, nicht nachladen.
- **Historische Makroziele:** Der aktuelle DayMeta-Snapshot enthält nur das Kalorienziel. Es wird deshalb keine Protein-/KH-/Fett-Zielerreichung aus einem aktuellen Profilwert abgeleitet. Das verhindert eine falsche historische Aussage; die äußere Eiweißvisualisierung muss bei fehlender Basis neutral bleiben.
- **InfoOverlay globale Nebenwirkung:** `Schließen` ist für die gefundenen aktuellen Aufrufer semantisch vertretbar, die globale Text- und Content-Änderung muss aber in Profile Wizard und Rezeptflüssen geprüft werden. Bei Layoutproblemen ist ein lokaler Wochen-Content-Wrapper die begrenzte Ausweichlösung, kein appweiter Modal-Refactor.
- **React-Native-Zeilenmessung:** `onTextLayout` auf einem bereits mit `numberOfLines={2}` begrenzten Text ist kein verlässlicher Überlaufnachweis. Die Messung muss unbeschränkt und für Accessibility unsichtbar erfolgen; Breiten- und Font-Scale-Änderungen müssen eine Neumessung auslösen.
- **Nested Navigation:** `HomeScreen` besitzt eine Home-Stack-Navigation, der DiaryScreen eine Nutrition-Stack-Navigation. Die Parametrisierung muss über den Root-Tab mit `NavigatorScreenParams` erfolgen; ein direkter Home-Stack-Route-Name `DiaryMain` wäre falsch.
- **Diary-Datumszustand:** Das DiaryScreen-Datum ist aktuell lokaler State. Der Route-Parameter darf diesen beim bestätigten Link initial beziehungsweise bei einem neuen Link setzen, darf aber nicht bei jedem Fokus ungefragt auf das Linkdatum zurückspringen.
- **Response-Datenqualität:** `MealItem.macros` ist ein Snapshot und daher die maßgebliche Quelle. Es gibt keine Runtime-Auflösung aus dem aktuellen Food-Katalog.
- **Overlay-Höhe:** Aktivitätszeilen, Makrovisualisierung und Link können die bestehende Panelhöhe beanspruchen. Der Overlay-Content muss auf kleinen Höhen kontrolliert scrollen oder kompakt bleiben, ohne den Dismiss-CTA zu verdecken.
- **Accessibility:** Die bisherige QA hatte Geräte- und Screenreader-Checks teilweise als unverified markiert. Diese Revision darf sie nicht still als bestanden ausgeben; Q-REV-1 muss den Status je Gerät und Font-Scale dokumentieren.
- **KB-/Implementierungskonflikt:** Der dokumentierte Diary-GET-Pfad weicht vom implementierten `diaryApi`-Pfad ab. Die Implementierung ist für die Navigation maßgeblich; der Konflikt wird im Dokumentationshandoff sichtbar korrigiert.
- **Keine Persistenzmigration:** Die neue Makrostruktur ist eine abgeleitete Response-Erweiterung. `cosmos.ts`, `infra/modules/cosmos.bicep` und DayMeta-/Meal-Dokumente bleiben unverändert.
- **Infrastructure Impact:** Es gibt keine neue Ressource oder Bicep-Änderung. `Dev` bedeutet hier, dass der bestehende Function-App-Code für den neuen Response in Development bereitgestellt werden muss; es ist kein Infrastrukturumbau geplant.
- **Mobile Build Impact:** Die Navigationserweiterung und Overlay-/Layoutänderung sind JS/TypeScript-only. Es werden keine nativen Module, Config Plugins oder `app.config.js`-Änderungen eingeführt; die finale Dev-Build-Entscheidung bleibt beim Infrastructure-&-Release-Verantwortlichen.

## 11. Recommended Execution Order

Die Ausführung erfolgt strikt sequenziell:

1. **S-REV-1 - Shared-Vertrag und Aggregation:** `consumedMacros` ergänzen, Pure-Calculator-Tests für Meals, Missing und Zero schreiben und ausführen. Den exakten Vertrag an B-REV-1 übergeben.
2. **B-REV-1 - Backend/API:** Wochenresponse und Handlertests ergänzen, AI-/Cache-/Quota-/Target-Regressionen ausführen, `npm run build:verify` ausführen und den Backend-/API-Dokumentationshandoff vorbereiten.
3. **Development-Bereitstellung:** Den bestehenden Backend-Code in Dev mit dem neuen Wochenresponse verfügbar machen. Keine Bicep-, Cosmos- oder neue Ressource bereitstellen.
4. **F-REV-1 - Frontend-Vertrag und Navigation:** Root-Tab-/Nutrition-Parametertypen, DiaryScreen-Datum, `InfoOverlay`-Optionen und Diary-Link implementieren. Danach den Wochenkarten-ViewModel- und UI-Handoff auf den neuen Response umstellen.
5. **F-REV-1 - Frontend-Layout und Regressionen:** Variante A, Makro-Overlay, Vorlade-State, Legende, AI-Expand-Control und Accessibility implementieren; Mobile-Tests und Typecheck ausführen; Frontend-/Produkt-KB-Handoff abschließen.
6. **Q-REV-1 - QA:** Shared-/Backend-/Mobile-Testausgaben prüfen, Response- und Cache-Vertrag regressionsprüfen, danach S23/S23 Ultra, TalkBack, Schriftvergrößerung, Loading/Error/Retry und alle bestehenden InfoOverlays manuell prüfen.
7. **Releaseentscheidung:** Erst nach QA-Urteil über bestehende Dev-/Alpha-Operations entscheiden. Für Alpha gilt weiterhin: Backend-Vertrag vor Mobile Preview Build bereitstellen; es sind keine neuen Azure-Ressourcen oder Container erforderlich.

Kein weiterer PO-Frageblock ist für die technische Umsetzung erforderlich. Die einzige fachliche Schutzentscheidung im Plan ist, keine historische Makro-Zielerreichung zu behaupten, solange der bestehende Vertrag dafür keine belastbare Zielquelle liefert.




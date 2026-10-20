# Design System

Source of truth: `mobile/src/app/theme/`

Reference screen: `DiaryScreen` — the current highest-quality screen in the app. All new components should match its visual language.

Reference apps: Apple, Spotify, Raycast, Notion, Linear.

---

## Color Tokens

Dark-only app. No light mode.

```ts
background:      '#0B0F0C'   // Page background — deepest level
surface:         '#141A15'   // Cards, main containers
surfaceElevated: '#1B231D'   // Elevated elements inside modals
surfaceMuted:    '#212B23'   // Subtle containers, inputs

border:          '#2A352C'   // All dividers, card borders

primary:         '#67B23E'   // Main action color (green)
primaryBright:   '#8FD157'   // Tab bar active icon
primarySoft:     'rgba(103,178,62,0.18)' // Chip backgrounds, AI badges
primaryDark:     '#3F7A2E'

text:            '#F2F4F1'   // Primary text, product names
textSecondary:   '#A6B0A4'   // Secondary info (brand, kcal meta)
textMuted:       '#7E8B7C'   // Labels, timestamps, placeholders
textDisabled:    '#4A5249'   // Near-invisible elements

positive:        '#67B23E'   // = primary
warning:         '#F59E0B'   // outside weekly target range
negative:        '#E26B6B'   // Errors, active heart icon
neutral:         '#A6B0A4'
overlay:         'rgba(0,0,0,0.6)' // Scrim behind modal sheets (ConfirmSheet, SyncStatusSheet)
```

[Rule] Never hardcode hex values in components. Always use `colors.*` tokens from the theme.

`colors.chart.average` bleibt unverändert `#8FA9CB`. `colors.chart.specialActivityOutline` ist `#C4A1FF` und wird als lila Akzent für Sonderaktivitätsmarker im Wochenrückblick verwendet. Trainingsmarker und Wochentagskürzel bleiben neutral; Balkenfüllungen verwenden weiterhin ihre Zielstatusfarben.

---

## Elevation System

Four levels only — no custom values:

1. `background` → Page
2. `surface` → Cards (`mealCard` level)
3. `surfaceElevated` → Elements inside modals
4. `surfaceMuted` → Inputs, subtle backgrounds

---

## Information Overlay

Short contextual explanations use the shared mobile `InfoOverlay` pattern. The overlay is app-owned and follows the FitTrack visual language:

- Full-screen backdrop using `colors.background` with controlled opacity
- Centered panel using `colors.surfaceElevated`, `colors.border`, `radius.xl`, and `spacing.lg`
- Title in `typography.h3`, explanation in `typography.body2`
- One clear primary dismissal action `Schließen` using `typography.button` and `colors.primary`
- Optional scrollable content slot for longer contextual detail with intrinsic height until the panel maximum is reached; the content `ScrollView` is the sole scroll owner, and the footer places `Schließen` below it with a small bottom-panel gap. The panel respects the device safe area. An optional secondary link action remains in the shared header beside the title, separate from the `Schließen` dismissal CTA; link, retry and dismissal actions provide an effective 48pt touch target
- Dismissal by the action, the backdrop, or the platform back action
- `animationType="fade"` for a quiet appearance without disrupting the current task

[Rule] Never use standard Android alerts (`Alert.alert`) for FitTrack information, instructions, confirmations, or action choices. These must use an app-owned overlay such as `InfoOverlay` or the appropriate FitTrack bottom sheet.

---

## Wochenrückblick-Karte

Die `WeeklyReviewCard` steht direkt nach `DayNutritionCard` auf dem Homescreen. Sie folgt der Card-DNA mit Theme-Tokens und zeigt genau sieben feste, flexible Tagescontainer ohne horizontales Scrollen. Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label und mit kleinem Abstand zur Kartenkante. Die beiden unteren Bilanzzeilen entfallen. Über jedem Balken stehen der Prozentwert und der Tagesverbrauch ohne wiederholte `kcal`-Einheit; die Accessibility-Beschreibungen behalten die vollständigen Einheiten und die Verbrauch-/Zielbedeutung. Gegessene Aggregate verwenden die bestehende Gesamt-Zielbandsemantik einschließlich gültiger `0`-Werte, Zielwerte bleiben neutral. Textuelle Diagrammüberschriften links/rechts und die sichtbare Tageszählung entfallen. Jeder Balken ist ein zugänglicher Trigger für das bestehende `InfoOverlay`; nur der darin enthaltene Link `Tagebuch öffnen` navigiert für das ausgewählte date-only-Datum nach `Nutrition -> DiaryMain({ date })`. Zeitraum im Header und Wochentag bleiben sichtbar; das einzelne Tagesdatum sowie Tagesziel-, Ziel- und Statuszeilen werden nicht im engen Raster gezeigt. Die Balkenhöhe basiert auf dem serverseitig gelieferten Tagesprozentsatz; eine gemeinsame `100 %`-Referenz und genau ein Marker-Slot pro Tag machen das individuelle Ziel sichtbar. Training und besondere Aktivitäten erhalten kompakte, platzstabile Marker innerhalb der Spalte; bei einer Kombination werden beide nebeneinander gerendert. Sonderaktivitätsmarker werden lila dargestellt; Trainingsmarker und Wochentagskürzel bleiben neutral, Balkenfüllungen behalten ihre Zielstatusfarben. Bei fehlendem Ziel wird kein Zielmarker gerendert; es werden keine Zielzahl oder Zielerreichung erfunden.

Die zentrale Shared-Farbklasse `in_range` wird für `95–105 %` inklusive auf `colors.primary` abgebildet. `outside_range` verwendet den semantischen Token `colors.warning`; die Grenze wird nicht in der React-Native-Komponente neu berechnet. Fehlende Ernährung, fehlendes Ziel und fehlende beides werden als neutrale diagonale Schraffur ohne Höhen-Semantik dargestellt und nicht als `0 kcal`-Balken interpretiert. Ein vorhandener MealItem mit `0 kcal` bleibt ein solider normaler Balken. Die links ausgerichtete Legende zeigt drei responsive, kontrolliert umbrechende Einträge: `Im Ziel (95–105 %)`, `Nicht im Ziel` und `Keine Daten`; die neutrale Schraffur bleibt als Marker unterscheidbar.

Die reale Reihenfolge im Diagrammraster lautet `Balken -> Wochentag -> Markerbereich -> Markerlegende -> Farblegende`; die Markerlegende wird nur bei mindestens einer Sonderaktivität gerendert. Die sieben flexiblen Tagescontainer und ihre Markerzellen liegen stabil unterhalb der Wochentagslabels; die Markerzellen liegen außerhalb von `barTrack`. Bekannte Trainingsmarker verwenden den gemeinsamen monochromen Katalog aus `mobile/src/modules/home/homeTrainingPresentation.ts`: `Gym`/`weight-lifter`, `Bouldern / Klettern`/`human-handsup`, `Laufen`/`run`, `Radfahren`/`bike` und `Sonstiges`/`dots-horizontal`. Ein fehlender oder unbekannter Workout-Wert fällt neutral auf `Training`/`activity` zurück; ein Ruhetag ohne Sonderaktivität erhält keinen Marker. Sonderaktivitäten verwenden `Radtour`/`bike` für `cycling`, `Wanderung`/`hiking` für `hiking` und neutral `Sonderaktivität`/`info` für unbekannte Werte. `cycling` als Training bleibt mit `Radfahren` und der Markerart `training` vom Sonderaktivitätsmarker `Radtour` mit der Markerart `activity` unterscheidbar. Training plus Sonderaktivität zeigt beide Marker in dieser Reihenfolge nebeneinander; nur das Sonderaktivitäts-Icon erhält den lila Akzent, Trainingsmarker und Wochentagskürzel bleiben neutral. Ein konkretes Datum wird nicht unter den Balken gerendert, sondern nur im Tagesdetail-Overlay verwendet. Markerzellen und Marker-Symbole bleiben dekorativ und bieten keine eigenen TalkBack-Aktionsziele. Die Markerlegende wird unabhängig vom konkreten Sonderaktivitätstyp auf genau einen Eintrag `Sonderaktivität` dedupliziert. Die vollständige Farblegende mit `Im Ziel`, `Nicht im Ziel` und `Keine Daten` bleibt links ausgerichtet, vertikal zentriert und bricht ihre Einträge kontrolliert responsiv mit flexiblen Breiten um.

Der Bewertungsbereich unter dem Diagramm zeigt ausschließlich `evaluation.text`, initial mit höchstens zwei sichtbaren Textzeilen. Die Überlaufentscheidung basiert auf einer unbeschränkten, nicht zugänglichen Messung mit identischer Typografie, realer Containerbreite und aktueller Font Scale; nur bei tatsächlichem Überlauf erscheinen `Mehr anzeigen` und ein Chevron. Der vollständig geöffnete Text hat keine native Zeilenbegrenzung und kann mit `Weniger anzeigen` wieder eingeklappt werden. Bei neuem Review, Text, verfügbarer Breite oder Font Scale wird Messung und Expand-Zustand zurückgesetzt; bei `null` bleibt er neutral und ohne Toggle. Die Tagesdetails inklusive vorhandener Aktivitäts-, Basisziel-, Bonus-, Workout- und Makroinformationen werden im begrenzt scrollbaren `InfoOverlay` erklärt. Bei einem Refresh-Fehler bleibt eine vorhandene Karte sichtbar und bietet dezent `Erneut versuchen`; ohne Review bleibt der bestehende Fehlerzustand erhalten. Die PNG-Referenz ist nur eine visuelle Orientierung für Hierarchie, Dichte, Marker und Anordnung; Beispielzahlen sowie die dort grün dargestellten Werte über `105 %` werden nicht als Design- oder Produktlogik übernommen.

Im Tages-Overlay ist der Kalorienzielvergleich eine kompakte Fortschrittsleiste mit Verbrauch, effektivem Ziel und Zielprozentsatz. Diese Werte bleiben aus dem erklärenden Body entfernt und werden nur in der Visualisierung beziehungsweise ihrer Accessibility-Beschreibung angeboten. Die Leiste verwendet die bestehenden Zielbandfarben, hält den Zielmarker sichtbar und fällt neutral zurück, wenn Ernährung und Ziel nicht vergleichbar sind. Makrowerte bleiben absolut und unabhängig zugänglich; `0 g` ist ein gültiger Anzeigewert und historische Makroziele werden nicht gezeigt. Special-Activity- und Trainingdetails erscheinen als kompakte Label-/Wert-Gruppen ausschließlich in der Reihenfolge `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel`, `Sonderaktivität` im Sonderaktivitätskontext (`Aktivität` nur bei Training ohne Sonderaktivität); `Tagestyp`, `Workout-Typ` und `Datenstatus` sind weder sichtbar noch accessibility-relevant. Fehlende Werte sind `Nicht verfügbar`, gültige Nullen bleiben sichtbar. `Tagebuch öffnen` ist ein sekundärer Header-Link; `Schließen` bleibt der separate Dismiss-CTA unterhalb des einzigen Content-ScrollViews mit 48-dp-Touchhöhe und geringem Abstand zum unteren Panelrand.

Der Home-Katalog wird in Picker, Coachingkarte und Wochenmarkern verwendet. Sonderaktivitätsmarker nutzen den lila Akzent `colors.chart.specialActivityOutline`; Trainingsmarker und Wochentagskürzel bleiben neutral, Balkenfüllungen und Nachbarspalten bleiben ohne lila Hervorhebung.

**Aktueller Implementierungsstand (2026-08-19):** Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label und mit kleinem Abstand zur rechten Kartenkante. Die beiden unteren Bilanzzeilen, einschließlich `Ø Ziel / Tag`, entfallen. Über jedem Balken stehen Prozentwert und Tagesverbrauch ohne wiederholte `kcal`-Einheit; die Accessibility-Beschreibungen behalten die vollständigen Einheiten. Diese Regel ersetzt die frühere Beschreibung der zwei unteren Bilanzzeilen.

**Aktueller Implementierungsstand (2026-10-15):** Das Wochenraster zeigt pro Tag nur den Zielprozentsatz über einem `16 dp` breiten und `72 dp` hohen Balken; Tages-kcal stehen im Tagesdetail-Overlay. Balkenspuren erhalten keinen flächigen Hintergrund. Fehlende Daten bleiben durch eine kleine neutrale Schraffur von `8 x 8 dp` erkennbar, ohne als Verbrauch oder Zielverfehlung zu erscheinen. Die Markerzeile entfällt, wenn alle sieben Tage markerfrei sind; andernfalls bleiben ihre sieben Zellen ausgerichtet. Diese kompakte Darstellung ersetzt frühere Angaben zu Tages-kcal über den Balken und einer immer reservierten Markerzeile.

**Visuelle Verfeinerung (2026-10-16):** Der Kartenkopf beginnt direkt mit `Letzte 7 Tage` und Zeitraum, ohne dekoratives Diagramm-Icon oder Icon-Badge; auch der Ladezustand reserviert dafür keinen Platz. Zwischen Header und Diagramm stehen `16 dp`, zwischen Balken und Wochentagen `4 dp`, zwischen Wochentagen und Aktivitätsicons `2 dp`. Die Markerzeile ist `16 dp` hoch; Icons sind einheitlich `12 dp` groß, ohne Hintergrund-Badges, in festen `16 x 16 dp`-Slots. Zwei Marker stehen ohne Umbruch nebeneinander; Training bleibt neutral, Sonderaktivität lila. Zur Legende folgen nur `4 dp` Außenabstand und `4 dp` oberer Innenabstand. Die Legende enthält ausschließlich `Im Ziel`, `Außerhalb` und `Keine Daten`; die separate Sonderaktivitätslegende entfällt. Aktivitätsdetails bleiben in den zugänglichen Tagesbeschreibungen und im Tages-Overlay erhalten. Diese Angaben ersetzen die früheren Beschreibungen der Markerlegende und längeren Legendentexte; die Zielbandlogik von `95–105 %` bleibt unverändert.

**Tage ohne vergleichbare Daten:** Fehlt Ernährung oder Ziel, erscheint im Tagesdiagramm nur die kleine neutrale Schraffur an der Basis. Helle 100-%-Zielmarker und Prozent-Platzhalter entfallen für diese Tage, auch wenn ein Ziel ohne Ernährung vorhanden ist. Der feste Prozent-Slot bleibt leer erhalten, damit alle sieben Spalten ausgerichtet bleiben. Vorhandene Einträge mit `0 %` bleiben gültige Daten und zeigen weiterhin Prozentwert, normalen Mindestbalken und Zielmarker. Tagesdetails und Accessibility-Beschreibungen bleiben verfügbar. Diese Regel ersetzt die frühere Anzeige eines Zielmarkers allein aufgrund eines vorhandenen Ziels.

## Tages-Nutrition-Karte (Home)

Die kompakte `CoachingHeroCard` enthält die persönliche Begrüßung links und den vorhandenen Tagesart-Selector rechts. Liegt ein gültiges, vollständiges `greeting`/`shortInsight`-Paar einer `fresh`/`cached`-Antwort vor, ersetzt die gelieferte KI-Begrüßung den statischen Gruß. Darunter erscheinen der Kurzsatz und der mindestens `48 dp` hohe Toggle `Mehr anzeigen`; er klappt den vollständigen Insight-Inhalt inline in derselben Karte auf und wechselt zu `Weniger anzeigen` mit Chevron nach oben. Es gibt kein Detail-Popup. Eine neue Insight-Version oder ein Datumswechsel klappt den Inhalt wieder zu. Texte werden nicht abgeschnitten; der Umschalter verwendet Theme-Tokens und dieselbe visuelle Behandlung wie die Wochenbewertung. Sonst bleibt nur die statische Begrüßung. Die frühere separate Insight-Karte am Ende des Home-Screens entfällt. Hint, Gewicht, Vergleich und Chart entfallen in dieser Karte. Im oberen Bereich der `DayNutritionCard` bleiben Kalorien-Donut und Kalorieninformationen unverändert. Auf mindestens `380 dp` stehen aktuelle kg und Gewichtssparkline rechts neben einem dezenten Trenner; die Trennlinie folgt derselben Zweidrittelposition wie die 100-%-Referenz in den Makro-Tracks. Die Sparkline ist in dieser breiten Zeile 96 dp breit. Unter `380 dp` stapeln sich Kalorien- und Gewichtsbereich, damit Werte nicht gequetscht werden. Der aktuelle Wert stammt aus dem neuesten vollständigen Gewichtsverlauf und wird bei `lbs` in kg umgerechnet; er bleibt auch ohne Messungen im 14-Tage-Fenster sichtbar. Enthält der Tag keine `MealItem`s, entfällt der leere Kalorien-Donut. Stattdessen zeigt die Kalorienseite den Kontext `Ernährung heute` und den Hinweis `Deine Übersicht erscheint hier, sobald du etwas einträgst.`; ein zusätzlicher CTA entfällt, da die Suchleiste bereits den zentralen Einstieg zum Hinzufügen bietet. Der Gewichtsbereich bleibt sichtbar und die Makro-Tracks bleiben ausgeblendet. Der Leerzustand richtet sich nach vorhandenen `MealItem`s, nicht nach `0 kcal`, damit ein echter Eintrag mit 0 kcal als erfasster Tag dargestellt wird.

Die Gewichtssparkline verwendet `calculateWeightTrendRegressionSeries` für genau 14 lokale Kalendertage und platziert Messungen anhand ihrer Kalenderdaten. Sie zeichnet die normalisierten tatsächlichen Messungen dezent und die unveränderten mathematischen Regressionsendpunkte stärker neutral; es gibt keine Achsen, Labels, Raster, Legende oder richtungsabhängige Rot-/Grün-Farben. Bei genau einer Messung im 14-Tage-Fenster bleibt nur das aktuelle kg sichtbar; Sparkline und Marker entfallen. Bei zwei bis sechs Messungen sowie bei mindestens sieben Messungen ohne definierte Regression bleiben die tatsächlichen Messungen sichtbar, aber Trendzahl und Regressionslinie entfallen. SVG-Elemente sind dekorativ; aktuelles kg und ein vorhandener Trend bilden einen Accessibility-Wert. Die genehmigte PO-1-Anzeigeregel zeigt bei `abs(rawWeeklySlope) < 0,05 kg/Woche` `0,0 kg/Woche`; ab der Grenze wird der tatsächliche vorzeichenbehaftete Wert auf eine Dezimalstelle mit deutschem Dezimalkomma gerundet. Gerundete Null wird normalisiert und negative Werte verwenden ein typografisches Minus. Die Regel darf weder Regression noch Chartgeometrie ändern. `formatWeeklyTrendLabel` ist der isolierte Präsentationspunkt dafür.

Die `DayNutritionCard` behält den Kalorien-Donut und seine Berechnung mit effektivem Kalorienziel einschließlich Aktivitätsbonus bei. Darunter stehen vier lineare Makro-Tracks für `Protein`, `Kohlenhydrate`, `Fett` und `Ballaststoffe`. Jeder Track skaliert bis `150 %` seines Ziels; die `100 %`-Referenz liegt bei zwei Dritteln der Trackbreite, ohne zusätzliche Prozentbeschriftung oder dafür reservierte Abstandszeile. Makro-Zielbereiche erscheinen als halbtransparent getönte, fein umrandete Zielkorridore in der jeweiligen Makrofarbe, die höher als die Fortschrittsfüllung sind. Die Untergrenze erhält einen dezenten farbigen Strich; die Obergrenze und die festen Ziele von Fett und Ballaststoffen erhalten dieselbe kontrastreiche helle Ziellinie mit dunkler Kontur. Korridor und Ziellinie bleiben auch bei gefülltem oder überschrittenem Ziel sichtbar. Ist-Wert und Ziel beziehungsweise Zielbereich bleiben rechtsbündig in Gramm; die Beschriftungen können bei schmaler Breite umbrechen. Die Füllung behält ihre Makrofarbe und wird am Ende des `150 %`-Tracks begrenzt.

Bei verfügbarem Protein-Ziel steht eine kleine dekorative karierte Rennsport-Zielflagge (`flag-checkered` aus dem bestehenden MaterialCommunityIcons-Katalog, Größe `sm`) mit `50 %` Deckkraft in derselben Infozeile wie `Protein` und die Grammwerte, zentriert oberhalb der 100-%-Ziellinie. Flagge und Ziellinie verwenden dieselbe relative Position über die volle Zeilen-/Trackbreite, unabhängig von Wertlänge und Bildschirmbreite. Es gibt keine zusätzliche Flaggenzeile und keinen zusätzlichen oberen Track-Abstand. Der Zahlenblock bleibt rechtsbündig im Bereich rechts von der Flagge mit kleinem Kollisionsabstand; bei Bedarf passt sich seine Schriftgröße einzeilig an. Die Ziellinie bleibt unverändert.

**Visuelle Verfeinerung (2026-10-16):** Die tatsächliche Gewichtslinie verwendet `colors.textMuted` mit `45 %` Deckkraft und `1 dp` Strichstärke; Messpunkte verwenden denselben Token mit `60 %` Deckkraft und `1,25 dp` Radius. Die Regression wird darüber in `colors.text` mit `2,5 dp` Strichstärke gezeichnet. Beide bleiben richtungsneutral. Makro-Zielkorridore und ihre Untergrenzen verwenden `40 %` Deckkraft; die bestehende Flächentönung innerhalb des Korridors verwendet zusätzlich `12 %` Deckkraft statt einer Schraffur. Fortschrittsfüllung und helle Ziellinie bleiben unverändert.

Ist-Werte, feste Makroziele und Zielbereichsgrenzen werden auf Home ausschließlich zur Anzeige mit `Math.round` auf ganze Gramm gerundet, einschließlich der Accessibility-Texte. Rohwerte, Zielwerte und daraus berechnete Balkengeometrie bleiben präzise und unverändert. Diese Anzeigeregel betrifft keine Gewichtsangaben oder Aktivitätsbonus-kcal.

Ein positiver Aktivitätsbonus erscheint zusätzlich als eigene `Aktivitätsbonus`-Zeile in kcal, nicht als fünfter Makro-Track. Sie zeigt die bereits verbrauchten kcal oberhalb des Basisziels im Verhältnis zum Bonusziel. Diese Zeile ändert weder den effektiven Kalorienzielwert noch die Berechnung des Kalorienrings.

## Progress Screen

`ProgressHeroCard` rendert zwei eigenständige, gleich breite Karten vor dem Diagramm. Beide verwenden `surface`, `radius.xl`, einen feinen `border`-Rahmen und `spacing.md` Innen- und unteren Außenabstand. Die Progress-Seite setzt außen `16 dp` horizontalen Abstand, wie Tagebuch, Profil und Rezeptübersicht.

Die Progress-Seite beginnt mit einer kompakten Zusammenfassung der neuesten nicht-zukünftigen Messung in kg; eine separate Heute-Zusammenfassung gibt es nicht. Relative Labels sind `Heute` und `Vor 1 Tag` in `primaryBright`, `Vor 2 Tagen` in `warning`; ab Tag drei erscheint das absolute Datum neutral. Fehlt heute ein Eintrag, steht darunter das Inline-Formular. Der Monatskalender bleibt geschlossen und wird über ein zugängliches Kalender-Icon als Modal-Sheet geöffnet. Er schließt über seine Schließen-Aktion, den Backdrop oder die System-Zurückaktion und nach Datumswahl automatisch. Der Kalender verwendet eine stabile Montag-bis-Sonntag-Anordnung mit sieben gleich breiten Spalten, 48-dp-Tageszielen und 48-dp-Monatsnavigation. Tage mit Einträgen erhalten einen Marker ohne sichtbare oder zugängliche Zählung, heute eine neutrale Umrandung und der ausgewählte Tag `primarySoft`. Tage aus angrenzenden Monaten bleiben sichtbar und auswählbar; Zukunftstage und Navigation in zukünftige Monate sind deaktiviert. Kalender und Sheet verwenden die vorhandenen `surface`-, `border`-, Radius-, Typografie- und Abstands-Tokens.

Die erste `ProgressHeroCard` zeigt die neueste Messung einmal mit kg-Wert und passendem Datumslabel; `Tagesmessungen`, `Messung 1` und weitere Messungsordinale erscheinen nicht. Es gibt keine Plus- oder Hinzufügen-Mehrfachmessungsaktion. Fehlt heute ein Eintrag, zeigt die Karte `Heute eintragen` und das kg-Formular. Das zugängliche Kalender-Icon öffnet das Monats-Sheet; die Auswahl eines Datums schließt es und öffnet einen kompakten Editor mit denselben Feldern wie das Inline-Formular. Für einen belegten Tag wird der vorhandene Wert geladen und die Änderung über die exakte ID gespeichert; für einen leeren Tag wird ein Eintrag mit dem ausgewählten Datum angelegt. Der Editor bleibt beim Öffnen der Tastatur oberhalb der Tastatur und sein Formular ist bei knapper Höhe scrollbar. Bearbeiten aus der `HistoryList` öffnet denselben Editor. Die `HistoryList` erhält immer sämtliche Einträge einschließlich heute und blendet auch die gerade bearbeitete Zeile nicht aus; ihre Mittelwerte und Zählungen verwenden weiterhin alle Einträge. Verlaufszeilen haben keine Bearbeiten- oder Löschen-Icons: Tippen öffnet den Editor, links Wischen startet die bestehende Löschbestätigung. Das kg-Formular behält den pillenförmigen `surfaceElevated`-Stil, den festen `kg`-Suffix, Platzhalter `0,0`, Fokus-/Fehlerrahmen und eine flexible Basisbreite von `128 dp`. Neue Einträge werden mit `Speichern`, Änderungen mit `Aktualisieren` gesichert. Beide Aktionen bleiben einzeilig und haben mindestens `48 dp` Höhe. Aktive Aktionen verwenden `primaryBright` mit dunklem Inhalt; deaktivierte Aktionen sind neutral. Beim Speichern sind Formulareingabe und Aktion gesperrt; Fehler stehen direkt am Formular und werden zugänglich angekündigt. Es gibt keine separate Heute-Karte und keine zusätzliche Zusammenfassung neben dem einzelnen letzten Gewicht.

Unter dem Eingabebereich folgt der kompakte Wochenvergleich ohne eigene Überschrift und in drei gleich breiten Spalten: `Letzte 7 Tage`, `Letzte Woche` und `Veränderung`. Zwischen den Spalten stehen feine vertikale Trennlinien. Die ersten beiden Spalten sind zentriert; die Veränderung steht rechtsbündig auf einer Linie mit Zielwert und Fortschrittsbalken. Ein passender Richtungspfeil steht mit kleinem Abstand direkt vor dem Vorzeichen und Wert (`↘ − 1,0 kg`, `↗ + 1,0 kg`, `→ = 0,0 kg`). Datumsbereiche, Messungsanzahlen und die ausgeschriebene Bedeutung bleiben in den Accessibility-Labels. `Letzte 7 Tage` umfasst heute minus sechs Tage bis einschließlich heute; `Letzte Woche` ist die zuletzt abgeschlossene Montag-bis-Sonntag-Kalenderwoche. Beide verwenden exakt die arithmetischen Mittelwerte der entsprechenden Abschnitte der Verlaufsliste. Die Fenster können sich wie in der Liste überschneiden. Mehrere Messungen an einem Tag zählen einzeln; eine einzige Messung pro Zeitraum genügt. Fehlt ein Vergleichswert, erscheint stattdessen der neutrale Regressions-Trend über die letzten sieben lokalen Kalendertage, sofern mindestens zwei verschiedene Messtage vorhanden sind. Fehlende Kalenderwochen werden nicht durch ältere ersetzt; sind auch Regression und Vergleich nicht berechenbar, entfällt der Block ohne Fehlhinweis.

Der Zielbereich ist ohne separate Außenkarte in die `ProgressHeroCard` integriert und erscheint nur bei verfügbarem Zielgewicht; eine zweite Karte und deren zusätzliche Trennlinie entfallen. Restgewicht, neutraler Prozentwert und zugängliche Fortschrittsleiste stehen vor der Start-/Zielgewichtzeile. Zielberechnung und Diagrammdurchschnitt bleiben unabhängig.

Die Zeitraumsteuerung des Diagramms bietet `7T`, `30T`, `90T` und `Alle`; `7T` ist initial aktiviert. Die begrenzten Zeiträume umfassen die jeweilige Anzahl lokaler Kalendertage einschließlich heute; `Alle` zeigt die gesamte Historie. `7T` spannt die X-Achse ausdrücklich von heute minus sechs Tagen bis heute auf. In allen Zeiträumen skaliert die Y-Achse nach Messwerten, gleitendem Durchschnitt und verfügbarem Zielgewicht. Das Diagramm zeigt dann die gestrichelte Zielmarke samt kg-Kennzeichnung und den Eintrag `Ziel` in der Legende, auch wenn das Ziel außerhalb des Messbereichs liegt. Die Legende zeigt außerdem Gewicht und den gleitenden Durchschnitt mit drei klaren blauen Strichsegmenten. Das Diagramm hat keine eigene Überschrift; die vier Zeitraumschalter stehen direkt darüber und haben jeweils ein stabiles `48 dp`-Touchziel. Bei weniger als zwei Messungen im gewählten Zeitraum bleiben die Schalter sichtbar und das Diagramm zeigt einen neutralen Hinweis. Gewichtsangaben verwenden kg mit deutschem Dezimalkomma. Trendpfeil und Statistik bleiben neutral.

## Typography

```ts
display:  { fontSize: 44, fontWeight: '800', letterSpacing: -1 }
h1:       { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 }
h2:       { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 }
h3:       { fontSize: 18, fontWeight: '600' }
body1:    { fontSize: 16, fontWeight: '400' }
body2:    { fontSize: 14, fontWeight: '400' }
caption:  { fontSize: 12, fontWeight: '500', letterSpacing: 0.4 }
overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }  // Section labels
button:   { fontSize: 15, fontWeight: '600', letterSpacing: 0.4 }
```

[Rule] Never hardcode `fontSize`. Always use `typography.*`.

---

## Spacing

```ts
xs:  4   // pt
sm:  8
md:  16
lg:  24
xl:  32
xxl: 48
```

---

## Border Radius

```ts
sm:   6
md:   12
lg:   18
xl:   24   // Cards (mealCard radius)
full: 9999 // Pills (chips, badges, search field)
```

---

## Card DNA (Standard Card Pattern)

Used by `mealCard` and all similar cards:

```ts
backgroundColor: colors.surface,
borderRadius:    radius.xl,
borderWidth:     1,
borderColor:     colors.border,
shadowColor:     '#000',
shadowOffset:    { width: 0, height: 2 },
shadowOpacity:   0.15,
shadowRadius:    6,
elevation:       3,
```

### Kartenbreite und Außenabstände

[Rule] Hauptkarten auf Tab-Screens haben links und rechts jeweils `spacing.md` (`16 dp`) Abstand zur verfügbaren Screen-Inhaltskante. Sie füllen die verbleibende Breite flexibel aus; bei voller Screen-Inhaltsbreite entspricht die Kartenbreite somit `verfügbare Breite - 2 * spacing.md`. Alle Karten derselben vertikalen Liste müssen dieselben Außenkanten haben, auch in Lade-, Leer-, Fehler- und befüllten Zuständen.

Genau eine Ebene setzt den horizontalen Außenabstand: entweder der Screen mit `paddingHorizontal: spacing.md` beziehungsweise einem Wrapper mit `marginHorizontal: spacing.md`, oder die Karte selbst mit `marginHorizontal: spacing.md`. Beide Ebenen dürfen ihn nicht gleichzeitig setzen. Karten dürfen keine feste Bildschirmbreite und kein `width: '100%'` zusätzlich zu horizontalen Margins verwenden. Der Karten-Innenabstand (`padding: spacing.md`) ist davon unabhängig und ersetzt den Außenabstand nicht.

Auf Home setzen die bestehenden eigenständigen Karten ihren Außenabstand selbst. Die wiederverwendeten `ActivityCard` und `ActivityCtaCard` bleiben dagegen ohne eigenen horizontalen Außenabstand; `HomeScreen` gibt beiden Zuständen denselben `activitySection`-Wrapper mit `marginHorizontal: spacing.md`. Neue oder wiederverwendete Karten müssen vor der Integration auf diese Layout-Zuständigkeit und die Kanten ihrer Nachbarkarten geprüft werden. Der Home-Layout-Regressionstest sichert beide Aktivitätszustände und den Abgleich mit den Nachbarkarten ab.

---

## Badge Pattern (primarySoft-Badge)

For: AI badges, favorites chips, context badges, active status indicators.

```ts
backgroundColor:   colors.primarySoft,
borderRadius:      radius.full,
paddingHorizontal: spacing.sm,
paddingVertical:   2,
color:             colors.primary,
fontWeight:        '600',
```

---

## Search Field / Input Rule

- Shape: Pill (`borderRadius: radius.full`)
- Height: 52pt
- Background: `colors.surfaceMuted`
- No `borderWidth`
- Search icon: left, 16pt, `colors.textMuted`
- Clear button: right, visible only when text present
- Placeholder color: `colors.textMuted`

---

## Animation Rules

- Library: `react-native-reanimated` (`useSharedValue` + `useAnimatedStyle`)
- No `LayoutAnimation`
- Simple fades / position changes: 150–250ms
- Layout changes: 300–400ms
- Easing: `easeOut` for enter, `easeIn` for exit
- Animations are part of Definition of Done for new UI components

---

## Information Hierarchy

Every UI element belongs to one of three levels:

1. **Primary task** — large, bright (search field, main action button)
2. **Secondary task** — medium weight (favorites chips, recents list)
3. **Tertiary task** — muted / disabled (fallback actions: barcode, AI, manual)

[Rule] Every element must match its level visually. A tertiary action must not use `colors.primary`.

## Primary Tab Screens and Headers

All five primary tab screens start their first visible control or content block `spacing.md` (16 dp) below the top safe area. Home and Nutrition apply this spacing to their sticky search containers, not to `FoodEntrySearchRow` itself; Recipes, Progress, and Profile use the same top content spacing. Do not add a second top inset inside the shared search row.

The root `SafeAreaView` of Home, Nutrition, Recipes, Progress, and Profile uses `edges={['top']}`. The non-overlay bottom tab navigator already reserves the bottom system inset; screens must not reserve it again outside their scroll viewport. This avoids a fixed background strip above the tab bar cutting off the visible chart or list. Bottom padding inside scrollable content remains available for end-of-content breathing room; the Android/iOS system navigation safe area is preserved by the tab navigator.

The diary date selector is a quiet context row below the unchanged Home-style search row: date label left in `typography.body2` and `colors.textSecondary`, paired previous/next chevron icons right with 48-dp touch targets. Do not center the date between fixed-width spacer columns or present it as a second page heading. Arrow buttons have no filled tile background; selection-mode cancellation remains beside the date controls.

The bottom tab bar is the location cue for the five primary areas. Root tab screens do not repeat the active tab label as a large page title and do not add a FitTrack logo/name banner. Start with the screen's task-specific content or controls instead. Home keeps its food-entry search row and in-content greeting; Nutrition starts with the identical `FoodEntrySearchRow`, followed by its date selector; Recipes keeps its own/Community selector as a flat tab row with `colors.primaryBright` active text and underline. Recipe creation is an inline plus action in the first own-list heading, or a labeled primary action in the empty state, not a floating button. Progress starts with the weight-entry card; Profile starts with its summary or state card.

Do not introduce a shared app-wide header solely for branding or location. Keep contextual headers on pushed detail, edit, and review flows when they provide a back action or screen-specific action. Use theme typography and spacing tokens; contextual one-line titles use `typography.h3`, primary content headings use `typography.h2`, and subordinate headings use `typography.h3`. Avoid hardcoded font sizes and one-off title margins.

---

## Reusable Recipe Components

Recipe creation, detail, and logging reuse shared mobile components instead of defining parallel visual patterns:

| Component | Reusable behaviour |
|---|---|
| `MealChip` | Two-state selectable tag for meal types. The selected state uses a check mark and `colors.primarySoft`; the unselected state uses the surface and border tokens. |
| `NutritionTile` | Compact bordered tile for a nutrient value and unit. It is reused by recipe detail and the logging preview. |
| `InfoOverlay` | App-owned contextual and error dialog with a dark backdrop, elevated panel, fade transition, a `Schließen` action, optional scrollable content, and an optional secondary link. It is used for wizard guidance, recipe loading/logging errors, and the weekly macro detail. |
| `ConfirmSheet` | Shared bottom-sheet confirmation pattern for leaving the wizard and destructive recipe actions. |
| `Snackbar` | Shared transient feedback at the bottom of the screen with optional `Rückgängig` action; the wizard uses it when ingredients or steps are removed. |

[Rule] New recipe screens should compose these shared components and theme tokens rather than introducing screen-local copies of chips, nutrition tiles, overlays, confirmations, or undo feedback.

## Forbidden Patterns

| Pattern | Reason |
|---|---|
| Hardcoded hex colors outside `theme/index.ts` | Breaks theming |
| `backgroundColor: 'white'` or any light color | Dark-only app |
| `fontSize` hardcoded numbers | Must use `typography.*` |
| `borderWidth > 1` (except current-meal indicator: 3pt) | Visual inconsistency |
| New color values not in the token list | Every color must come from the palette |
| `LayoutAnimation` | Use reanimated instead |
| Custom shadow values | Use Card DNA pattern |

---

## DiaryScreen Reference Components

| Component style | Used as reference for |
|---|---|
| `mealCard` | Card DNA — all cards |
| `aiBadge` | primarySoft Badge — AI/source badges |
| `itemRow` | Recents-style list rows |
| `addMealChip` | Chip base structure |
| `inlineAddBtnText` | Action links in `colors.primary` |
| Meal header | Context badge pattern |

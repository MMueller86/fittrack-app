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

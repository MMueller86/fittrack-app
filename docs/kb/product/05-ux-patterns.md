# UX Patterns

Recurring UX patterns used across the FitTrack app. Apply these consistently for new screens and features.

---

## Bottom Sheet Pattern

Library: `@gorhom/bottom-sheet` v5

### Standard Configuration

- Backdrop: `BottomSheetBackdrop` with `appearsOnIndex={0}` and `opacity={0.10}`
- Content scroll: `BottomSheetScrollView` for scrollable content
- Keyboard: do not use `keyboardBehavior` — use `ScrollView` + auto-scroll to focused element instead

### Snap Points

| Context | Snap Points | Notes |
|---|---|---|
| FoodEntryHub | `['85%']` | Default hub sheet height |
| FoodEntryHub direct subflow | `['100%']` | Used when a Home-screen direct subflow needs the visible sheet to occupy the full screen |
| Edit / action sheets | `['50%', '92%']` | Stacked over hub when needed |

### Stacking

Bottom sheets can be stacked (e.g., `QuantityView` previously used a `ProduktDialog` on top of the Hub). The preferred pattern is now to replace the Hub's content area inline rather than stacking a second modal.

---

## Information Overlays

Use the shared `InfoOverlay` for short, contextual explanations that do not require a decision or a list of actions.

An information overlay must:
- use a dark FitTrack backdrop and `surfaceElevated` for the panel
- use token-based typography (`h3` for the title, `body2` for the explanation)
- provide one clear dismissal action, `Schließen`
- keep longer content within a bounded scroll area while preserving intrinsic height for short content; the content `ScrollView` is the sole scroll owner, the panel respects the device safe area, and its footer places `Schließen` below the content with a small bottom-panel gap. Optional secondary links remain in the shared header, separately from the `Schließen` dismissal CTA; link, retry and dismissal actions use an effective 48pt touch target
- close when the user taps the backdrop or presses the platform back action
- preserve the current screen and use a quiet fade transition

[Rule] Standard Android alerts must never be used for FitTrack product UI. In particular, do not use `Alert.alert` for information, instructions, confirmations, or action choices. Use `InfoOverlay`, `ConfirmSheet`, or the appropriate bottom-sheet pattern instead.

## Recipe Scale Preview

The recipe detail view presents the saved `Portionen` and the temporary `Nachkochen für` value separately. The target uses a one-step `−`/`+` control within the shared `1–50` bounds. A separate information trigger opens an `InfoOverlay` with the title `Für wie viele kochst du?` and explains that ingredients and preparation are adapted temporarily while the original recipe remains unchanged.

Changing the target projects ingredients immediately and leaves them visible during the approximately 400 ms debounce and the AI request. The old description and steps are hidden in both states; the screen shows exactly: `Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.` A complete response replaces both text sections atomically. If the request fails, the projected ingredients remain, the original texts return, and a friendly German `InfoOverlay` explains the fallback. Returning to the saved portion count restores the original view without an AI request. Pending debounce timers and requests are invalidated on a new target, reset, reload, or unmount.

## Wizard Back Confirmation

Multi-phase flows use the shared `ConfirmSheet` for both the in-screen back action and the Android hardware back action. Returning from the initial input phase leaves the wizard immediately; back is blocked while an analysis is running. In later phases, the sheet explains that unsaved progress would be lost and offers one destructive `Zurück` action plus the standard dismissal. Both back entry points use the same phase transition, so the user receives identical navigation semantics.

## Sticky Wizard Actions

Wizard phases with a primary action keep the scrollable content and the action footer as sibling areas inside the keyboard-avoiding layout. The primary button is rendered only inside that footer, with no content-level bottom CTA or inherited top margin. On screens whose footer owns the bottom action area, the outer `SafeAreaView` uses the top edge only; applying a bottom edge there introduces a visible gap below the footer on devices with a bottom safe-area inset.

---

## Swipe-to-Remove

Use `SwipeableRow` when a removable row needs the same interaction language as an entry in the nutrition diary:

- Swipe left to reveal the destructive `Entfernen` action
- Keep the gesture one-sided unless the opposite direction has a distinct, useful action
- Trigger the existing undo snackbar after removal
- Do not use a second swipe direction only for visual symmetry or duplicate an action already available by tapping the row

---

## Edit Sheets

Lightweight bottom sheets for editing existing items without leaving the current screen.

Pattern:
- Slide up over current content
- Shows current values pre-filled
- "Speichern" (confirm) + close gesture (dismiss)
- No navigation — returns to same screen after save

Examples: `EditItemSheet.tsx`, `CopyItemSheet.tsx`, `MoveItemSheet.tsx`

---

## Search Result Rows

Standard food search result row (from `SearchState`):

```
[Thumbnail 52pt]  [Product Name — body1 bold]     [❤ toggle]
                  [Brand] [Badge] [⚠ optional]
                  [251 kcal · EW 8g · KH 43g · F 3g]
                  [je 100 g / pro Portion (X g)]
```

Rules:
- Thumbnail: 52pt square, letter-avatar fallback (first letter, `primarySoft` BG)
- Macro line hidden if all macros are null
- Portion line hidden for AI estimates (`isAiEstimate: true`)
- `React.memo` wrapper for performance
- `⚠` shown when `isComplete: false`

---

## Bottom Fallback Section

Used as `ListFooterComponent` in search results. Always visible regardless of result count.

```
0 results:   "Kein Treffer für '{query}' — Wir haben ein paar andere Ideen:"
≥1 results:  "Nicht das passende dabei?"
             [KI-Schätzung] · [Label Scan] · [Manuell erfassen]
```

This pattern replaces sticky action bars. Fallback actions are below content, not above it.

---

## Snackbar Pattern

Temporary feedback after a successful action.

Standard format:
```
"{Item} hinzugefügt"    [Rückgängig]  [Weiteres]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (5s progress bar)
```

Rules:
- Auto-dismiss: 5s
- Progress bar shows remaining time
- "Rückgängig" performs the inverse action (DELETE)
- "Weiteres" resets to search state with keyboard focused
- No "Fertig" button
- Undo disabled if item ID cannot be safely determined

---

## Context-Dependent Placeholders

Input fields and search fields use context-aware placeholder text.

Examples:
- Search field without context: `"Lebensmittel suchen…"`
- Search field with meal type: `"Für Frühstück suchen…"` / `"Für Mittagessen suchen…"`

This pattern applies to any field where the context (target meal, date, goal) is known.

---

## Review Screens (AI Confirmation)

All AI features use a dedicated review screen before saving.

Pattern:
- Full-screen or modal
- Shows AI output with editable fields
- Displays confidence and warnings prominently
- Explicit "Speichern" or "Hinzufügen" CTA
- Optional re-estimation trigger (e.g., "✨ Neu" button)
- Two save modes where applicable: "Als Produkt speichern" vs "Einmalig hinzufügen"

[Rule] Review screens must never be skipped, even if confidence is high.

---

## Optimistic Updates

On delete operations (diary items, weight entries): remove from local state immediately, roll back on error.

Pattern used in `WeightDetailScreen` (optimistic delete on weight entries).

---

## Empty States

When a list is empty (before first use or after filtering):

- Clear visual indicator (icon + short message)
- Actionable suggestion (e.g., "Tippe um zu suchen", auto-focus keyboard)
- No generic "No items" text

---

## Error Handling

- Network/API errors: friendly German message, no technical details exposed to user
- Quota exceeded (429): show reset date in user-friendly format (e.g., "Morgen wieder verfügbar")
- Auth errors (401): silent refresh attempted first; logout only on repeated failure
- AI unavailable: graceful fallback (especially for daily insight — never shows an error card)

---

## Wochenrückblick

Der Wochenrückblick steht direkt nach der Tages-Nutrition-Karte auf dem Homescreen. Während des Requests wird eine kompakte Skeleton-Karte angezeigt; bei einem recoverable Netzwerkfehler bleibt die Tagesansicht intakt und die Karte bietet `Erneut versuchen`. Wenn ein vorhandener Wochenrückblick beim Refresh erhalten bleibt, zeigt die Karte zusätzlich dezent `Aktualisierung fehlgeschlagen` mit demselben Retry-Callback. Die Wochenkarte zeigt immer sieben flexible Tagescontainer ohne horizontales Scrollen. Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label und mit kleinem Abstand zur Kartenkante. Die beiden unteren Bilanzzeilen entfallen. Über jedem Balken stehen Prozentwert und Tagesverbrauch ohne wiederholte `kcal`-Einheit; die Accessibility-Beschreibung behält Verbrauch, Ziel und vollständige Einheiten. Textuelle Diagrammüberschriften und die sichtbare Tageszählung entfallen. Jeder Balken ist ein zugänglicher Trigger und öffnet zuerst ausschließlich das bestehende `InfoOverlay` mit Tagesdetails; nur `Tagebuch öffnen` darin navigiert für das ausgewählte date-only-Datum über `Nutrition -> DiaryMain({ date })`. Es gibt keine Navigation vom Balken selbst, keine Bearbeitung und keine FoodEntryHub-Aktion.

Der Header zeigt den Zeitraum, unter dem Diagramm bleibt nur der Wochentag als sichtbare Tageszuordnung; das einzelne Tagesdatum sowie Tagesziel-, Ziel- und Statuszeilen entfallen aus dem engen Raster. Training und besondere Aktivitäten erhalten kompakte Marker innerhalb ihrer Spalte; bei einer Kombination bleiben beide Marker sichtbar, ohne die Chartgeometrie zu verschieben. Sonderaktivitätsmarker werden lila dargestellt, während Trainingsmarker und Wochentagskürzel neutral bleiben. Das Overlay zeigt, sofern vorhanden, Wochentag sowie Verbrauch, Zielerreichung und effektives Ziel in der kompakten Kalorienvisualisierung; diese drei Werte erscheinen nicht zusätzlich im erklärenden Body. Bei besonderer Aktivität oder Training zeigt das Overlay nur die kompakten Label-/Wert-Gruppen `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel` und die vorhandene `Aktivität`; `Tagestyp`, `Workout-Typ` und `Datenstatus` entfallen sichtbar und accessibility-relevant. Fehlende Werte heißen `Nicht verfügbar`, gültige `0`-Werte bleiben sichtbar. Der Header-Link `Tagebuch öffnen` bleibt vom separaten `Schließen`-CTA getrennt und öffnet nur das Tagebuch des ausgewählten date-only-Datums; der Content-ScrollView bleibt der einzige Scroll-Owner, und der Footer setzt `Schließen` mit 48-dp-Touchhöhe tiefer unter den Content, aber mit kleinem Abstand zum Panelrand. Die inklusive Zielzone `95–105 %` ist grün, Werte außerhalb sind orange. Pro Tag gibt es einen Zielmarker; bei fehlendem historischem Ziel wird nur ein neutraler Marker-Slot ohne Zielzahl und ohne Prozentsatz gezeigt. Fehlende Ernährung, fehlendes Ziel und vollständig fehlende Daten werden als neutrale diagonale Schraffur ohne Höhen-Semantik dargestellt und weder als `0 kcal` noch als positive oder negative Bewertung behandelt. Ein vorhandener MealItem mit `0 kcal` bleibt dagegen ein gültiger solider `0 kcal`-Balken.

Die gerenderte Reihenfolge lautet `Balken -> Wochentag -> Markerbereich -> Markerlegende -> Farblegende`; wenn im Sieben-Tage-Zeitraum eine Sonderaktivität vorkommt, wird dazwischen genau ein deduplizierter Legendeneintrag `Sonderaktivität` gezeigt. Der Markerbereich besteht aus sieben stabilen Zellen unterhalb der Wochentagslabels und liegt nicht in `barTrack`. Bekannte Workout-Typen verwenden die gemeinsamen Kataloglabels und -icons `Gym`, `Bouldern / Klettern`, `Laufen`, `Radfahren` und `Sonstiges`; ein fehlender oder unbekannter Workout-Wert wird neutral als `Training` markiert. Ein Ruhetag ohne Sonderaktivität bleibt markerfrei. Sonderaktivitäten erhalten bei `cycling` den Marker `Radtour`, bei `hiking` den Marker `Wanderung` und bei unbekannten Werten den neutralen Marker `Sonderaktivität`. `cycling` als Training ist mit `Radfahren` und der Trainingsmarkerart von `Radtour` als Sonderaktivitätsmarker unterscheidbar; bei einer Kombination bleiben beide in der Reihenfolge Training, Sonderaktivität nebeneinander sichtbar. Nur das Sonderaktivitäts-Icon trägt den lila Akzent `colors.chart.specialActivityOutline`; Trainingsmarker, Wochentagskürzel, Balkenfüllungen und Nachbarspalten bleiben monochrom beziehungsweise neutral. Unter den Balken wird kein konkretes Datum gerendert. Die Marker sind dekorativ und keine eigenen TalkBack-Aktionsziele. Die vollständige Farblegende mit `Im Ziel`, `Nicht im Ziel` und `Keine Daten` bleibt erhalten, vertikal zentriert und wird über kontrollierten responsiven Umbruch an die verfügbare Breite angepasst.

Das Overlay zeigt, sofern vorhanden, die vorab geladenen absoluten Makros Protein, Kohlenhydrate und Fett ohne erfundene Zielwerte; fehlende Makros bleiben neutral. Unterhalb des Diagramms wird nur der zusammenhängende Text aus `evaluation.text` angezeigt. Die KI-Wochenbewertung wird mit identischer Typografie und realer Breite unbeschränkt, aber unsichtbar gemessen und ist initial auf höchstens zwei sichtbare Textzeilen begrenzt; nur bei tatsächlichem Überlauf erscheinen `Mehr anzeigen` und ein Chevron. Im geöffneten Zustand gibt es keine native Zeilenbegrenzung. Der Text lässt sich mit `Weniger anzeigen` wieder einklappen. Bei neuem Text, Review, verfügbarer Breite oder Font Scale wird der Expand-Zustand zurückgesetzt. Bei `null`, Quota- oder Providerfehlern erscheint ausschließlich ein neutraler Nicht-verfügbar-Hinweis, niemals eine deterministische Ersatzbewertung. Die PNG ist eine reine Layout- und Dichte-Referenz; ihre Beispielwerte und die fehlerhafte Farbgebung oberhalb von `105 %` sind nicht maßgeblich.

Das Tages-Overlay hält Kalorienvergleich und absolute Makrowerte als getrennte deutsche Accessibility-Ziele. Die Kalorienziel-Leiste verwendet das effektive Ziel oder den gelieferten Zielprozentsatz; fehlende Vergleichsdaten bleiben neutral, während `0 kcal` und `0 g` gültige Werte bleiben. Vorhandene Special-Activity- und Bonusdetails erscheinen in den vier kompakten Gruppen `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel` und `Sonderaktivität`; `Tagestyp`, `Workout-Typ` und `Datenstatus` werden vollständig entfernt. Der Kalorienvergleich bleibt in seiner Kachelvisualisierung verfügbar, auch wenn der erläuternde Body leer ist.

**Aktueller Implementierungsstand (2026-08-19):** Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label. Die beiden unteren Bilanzzeilen entfallen. Über jedem Balken stehen Prozentwert und Tages-kcal ohne wiederholte `kcal`-Einheit; die Einheit bleibt im Header und in den Accessibility-Beschreibungen erhalten. Diese Regel ersetzt die frühere Beschreibung von zwei Bilanzzeilen unter dem Diagramm.

## Favorite Heart Toggle

- Shown on search result rows
- Immediate visual feedback (toggle state)
- Persisted via `POST /api/favorites` / `DELETE /api/favorites/{foodRef}`
- [Current] Fully functional — favorite management UI is a separate future story

---

## Section Labels

```ts
// overline typography
{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }
// color: colors.textMuted
```

Used above content sections. Example: "SCHNELLZUGRIFF", "KÜRZLICH HINZUGEFÜGT".

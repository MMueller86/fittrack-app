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
- provide one clear dismissal action, normally `Verstanden`
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

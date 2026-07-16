# Food Entry Hub

## Concept

The Food Entry Hub is a temporary **workspace** for the single task: adding food to the diary.

It is not a screen, a dialog, or a menu. It is a bottom sheet that overlays the current context. The user works inside it until the task is complete, then dismisses it.

Key UX principle: the user never thinks about which feature to use — they just describe or search for food and the hub guides them to the right result.

## Entry Points

Any part of the app can open the Hub:
- Diary screen → meal button (mealId + mealType known)
- Home screen → quick-add button (no mealId, mealType from time)

All entry points open the same hub with the same workflow.

## State Machine (`hubReducer.ts`)

```ts
type HubMode =
  | { mode: 'idle' }
  | { mode: 'search'; query: string }
  | { mode: 'product'; product: FoodSearchResult; previousMode: 'idle' | 'search'; previousQuery: string }
  | { mode: 'subflow'; flow: 'barcode' | 'ai' | 'label' | 'manual'; previousMode: 'idle' | 'search'; previousQuery: string }
```

### Actions

| Action | Transition |
|---|---|
| `OPEN_SEARCH` | idle → search |
| `SET_QUERY` | search → search (updates query) |
| `SELECT_PRODUCT` | search/idle → product (saves previousMode + query) |
| `CLOSE_PRODUCT` | product → previousMode (restores query) |
| `OPEN_SUBFLOW` | any → subflow |
| `CLOSE_SUBFLOW` | subflow → previousMode (restores query) |
| `RESET` | any → idle |

## Screens / Views Inside the Hub

| Mode | Component | Notes |
|---|---|---|
| `idle` | `IdleState.tsx` | Favorites chips + recents list |
| `search` | `SearchState.tsx` | Results + bottom fallback section |
| `product` | `QuantityView.tsx` | Quantity selection + nutrition preview |
| `subflow: barcode` | `BarcodeSubFlow.tsx` | Delegates to `BarcodeScannerScreen` |
| `subflow: ai` | `AISubFlow.tsx` | Food estimate flow |
| `subflow: label` | `LabelSubFlow.tsx` | Label scan flow |
| `subflow: manual` | `ManuellerSubFlow.tsx` | Manual entry form |

## Store (`useFoodEntryHubStore`)

Zustand store. Global — mountable from any screen.

```ts
open(params?: {
  mealId?: string         // undefined from Home
  date?: string           // default: today
  mealType?: MealType     // default: getSuggestedMealType() (time-based)
  onSuccess?: () => void
  autoFocusSearch?: boolean
})
```

## Bottom Sheet Configuration

Library: `@gorhom/bottom-sheet` v5

- Hub snap points: `['85%', '90%']`
- Backdrop: `BottomSheetBackdrop` with opacity 0.10 (8–12% dimming)
- `ProduktDialog` (superseded by `QuantityView`) snap points: `['50%', '92%']`

## IdleState

Shows when mode = `idle`:
- Favorites chips (horizontal scroll, `primarySoft` background)
- Recents list ("Kürzlich hinzugefügt") — sorted by `lastUsedAt` DESC
- Section label: "Schnellzugriff" (not "Favoriten")

Recents are loaded by `FoodEntryHub.tsx` and passed as props. `RecentItem.tsx` is the extracted row component.

## SearchState

Shows when mode = `search`:
- Results `FlatList` using `ResultRow` component
- Search results cached in `FoodEntryHub.tsx` (`cachedResults` state)
  - Prevents 300ms blank flash when navigating back from `QuantityView`
- **Bottom fallback section** (always visible as `ListFooterComponent`):
  - 0 results: "Kein Treffer für '…' — Wir haben ein paar andere Ideen:"
  - ≥1 results: "Nicht das passende dabei?"
  - Actions: KI-Schätzung · Label Scan · Manuell

## Result Row Format

Four lines per result:
1. Product name (`body1`, bold) + heart toggle
2. Brand + source badge + `⚠` if `isComplete: false`
3. `"251 kcal · EW 8g · KH 43g · F 3g"` (caption, bold, tabular-nums) — hidden if all macros null
4. `"je 100 g"` or `"pro Portion (150 g)"` — hidden for AI estimates

Thumbnail: 52pt, letter avatar fallback (first letter of product name, `primarySoft` BG).

Source badges:
- `[OFF]` — Open Food Facts
- `[✨ KI]` — AI estimate
- `[Eigen]` — User's personal library

## QuantityView

Inline component shown when mode = `product`.

- Regular `ScrollView` (not `BottomSheetScrollView`)
- Auto-scroll to Add button when keyboard opens
- `selectTextOnFocus` on the quantity input
- Portion toggle: gram / portion mode (only shown when item has portion data)
- "1 Portion = X g" hint
- Live nutrition preview (updates as amount changes)
- Disabled Add button + warning if `isComplete: false`

## Snackbar (Post-Add)

After a successful add:
- Text: "[Produktname] hinzugefügt"
- Actions: "Rückgängig" + "Weiteres"
- Auto-dismiss: 5s with progress bar
- "Rückgängig": `DELETE /api/diary/meals/{mealId}/items/{itemId}` + calls `onSuccess()`
- "Weiteres": `RESET` action + auto-focus search field
- `itemId` determined by matching the last item in the returned meal with the product ID
- Undo button disabled if `itemId` cannot be determined safely

## Back Navigation (QuantityView → SearchState)

When user navigates back from `QuantityView`:
- `CLOSE_PRODUCT` restores `previousMode` and `previousQuery`
- `cachedResults` prevents blank FlatList

Android: `BackHandler.addEventListener` active when `isOpen && mode === 'product'`. Dispatches `CLOSE_PRODUCT` and returns `true` (consumes back event).

## Meal Type Default

`mealTimeRules.ts` — `getSuggestedMealType()` returns a `MealType` based on the current local time.

When entering from a diary meal button: `mealType` is the button's meal type (fixed, not time-based).

In `QuantityView`, the meal type is always editable by the user.

## Search Field Placeholder

Context-dependent:
- Meal type known: `"Für Frühstück suchen…"` (localized to meal type)
- No meal type: `"Lebensmittel suchen…"`

## Finalized Decisions (2026-07-08)

These UX decisions are final and must not be reversed without explicit product discussion:

- Search field height: 52pt (not 44pt)
- Barcode + AI icons: outside the pill, as standalone icons next to the search field
- Barcode + AI icon color: `colors.primary` (green, not muted)
- Quick actions in IdleState: removed (barcode + AI in search row is sufficient)
- Sticky CompactActionBar above results: removed (replaced by bottom fallback section)
- Snap points: `['85%', '90%']`
- Recents loading: moved from `IdleState` to `FoodEntryHub` level (passed as props)
- `RecentItem` extracted to `hub/RecentItem.tsx`

## Key Files

| File | Purpose |
|---|---|
| `hub/FoodEntryHub.tsx` | Main bottom sheet component |
| `hub/hubReducer.ts` | State machine |
| `hub/useFoodEntryHubStore.ts` | Global open/close Zustand store |
| `hub/IdleState.tsx` | Idle view |
| `hub/SearchState.tsx` | Search results view |
| `hub/QuantityView.tsx` | Quantity selection view |
| `hub/BarcodeSubFlow.tsx` | Barcode sub-flow wrapper |
| `hub/AISubFlow.tsx` | AI estimation sub-flow |
| `hub/LabelSubFlow.tsx` | Label scan sub-flow |
| `hub/ManuellerSubFlow.tsx` | Manual entry sub-flow |
| `hub/mealTimeRules.ts` | Time-based meal type suggestion |
| `hub/RecentItem.tsx` | Recent item row component |
| `hub/AlleFavoritenModal.tsx` | Full favorites overlay |

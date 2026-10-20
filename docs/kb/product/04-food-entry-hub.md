# Food Entry Hub

## Concept

The Food Entry Hub is a temporary **workspace** for food selection and nutrition entry. Its default purpose is adding food to the diary; in recipe-ingredient context it reuses the same search and single-food AI affordances without mutating diary data.

It is not a screen, a dialog, or a menu. It is a bottom sheet that overlays the current context. The user works inside it until the task is complete, then dismisses it.

Key UX principle: the user never thinks about which feature to use — they just describe or search for food and the hub guides them to the right result.

## Entry Points

Any part of the app can open the Hub:
- Diary screen → persistent search row (selected date, no mealId) or meal button (mealId + mealType known)
- Home screen → quick-add button (no mealId, mealType from time)
- Recipe wizard ingredient row → ingredient search context (`purpose: 'recipeIngredient'`)

Diary entry points open the same hub with the same diary workflow. Recipe entry points open the hub as an ingredient picker: product selection and explicit single-food AI estimation call back into `RecipeWizardScreen`, and diary mutations are disabled.

Home and Nutrition use the same search/action row layout and header height. The Food Entry Hub is pinned to the top of that row in both tabs so its sheet starts at the same screen position.

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
| `idle` | inline in `FoodEntryHub.tsx` (filter header + `FoodList.tsx` with `RelationRow.tsx`) | Quick Entry list; no separate idle component |
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
  purpose?: 'diary' | 'recipeIngredient'
  mealId?: string         // undefined from Home
  date?: string           // default: today
  mealType?: MealType     // default: getSuggestedMealType() (time-based)
  onSuccess?: () => void
  autoFocusSearch?: boolean
  initialSubflow?: 'barcode' | 'ai'
  initialQuery?: string
  prefillAmount?: { mode: 'grams' | 'portion'; amount: number } | null
  onSelectIngredient?: (product, mode, amount) => void
  onEstimateIngredient?: (estimate, query) => void
})
```

If ingredient callbacks are supplied and `purpose` is omitted, the store infers `purpose: 'recipeIngredient'`. In recipe mode, only the AI subflow can be opened directly; barcode, label scan, manual entry, and direct diary saves remain diary-only behaviours.

## Bottom Sheet Configuration

Library: `@gorhom/bottom-sheet` v5

- Default hub snap point: `['85%']`
- Full-height snap point: `['100%']` when Home or Diary direct entry needs the sheet to occupy the full screen after it becomes visible
- Backdrop: `BottomSheetBackdrop` with opacity 0.10 (8–12% dimming)
- `QuantityView` is inline hub content, not a separate product dialog.

### Full-Screen Subflows

The barcode scanner and AI estimate open as full-screen native modals. This is intentional: the scanner needs the camera preview area, and the AI flow includes input and review steps. When launched from an active Hub, closing a subflow returns to the still-open Hub; a direct Home launch can open the same modal without presenting the Hub sheet. Modal headers use the app-level top safe-area inset; the Hub's `topInset` also includes the Home/Diary header height and must not be reused for modal content.

## Idle view

Shows when mode = `idle`. The hub's personal Quick Entry list. It is rendered inline in `FoodEntryHub.tsx` (filter header, filter modal `Ansicht wählen`) and uses `FoodList.tsx` with `RelationRow.tsx`; the former `IdleState.tsx` and `AlleFavoritenModal.tsx` components no longer exist.

Data source: `favoritesApi.listFavoritesRanked(mealType, localDate)` (`GET /api/favorites?context=…&localDate=…`) → already ranked by the backend (`sortByRelevance()` in `backend/src/lib/favoritesScoring.ts`). The context meal type is `context.mealType` or, if absent, the time-of-day suggestion. The result is kept in session order until the list is reloaded.

**Layout:**
- Header: active filter name (h3) + chevron — tapping opens filter modal
- Subtitle: context hint (e.g. "Passend zur Mittagszeit") — visible in "Für dich" filter only
- Content: `RelationRow` list via `FoodList.tsx`

**Filter options:**
- **Für dich** (default) — backend-ranked favorites; shows last-usage info in line 3
- **Zuletzt verwendet** — auto-selected on search focus; shows recency info
- **Mahlzeit filters** (Frühstück, Mittagessen, etc.) — ranked favorites that have at least one `usageDates` entry for the meal type, sorted descending by the number of such entries (`sortByMealTypeUsage()`)
- **Alle** — favorites + personal library + recipes, alphabetical; shows macros

**State transitions during search:**
- Keyboard focus → filter switches to "Zuletzt verwendet", SearchState shown
- Active query → header shows "Suchergebnisse", filter modal not accessible
- Blur without selection → filter resets to "Für dich"

**RelationRow layout (3 lines + thumbnail):**
- Line 1: `displayName` + heart icon (right)
- Line 2: `displayBrand` / "Eigenes Rezept" / "Eigenes Lebensmittel" (fallback by foodRefType)
- Line 3: contextual secondary info (last usage or macro reference) + optional "+ N g" direct-add pill

**Direct-Add ("Wie immer?"):**
- Visible in "Für dich" when `preferredInputAmount > 0`
- For catalog and personal food references, bypasses QuantityView and calls `diaryApi.addItem()` with the preferred amount and cached nutrition
- Without `context.mealId`, resolves or creates a meal for the Hub date and meal type; a temporary meal ID falls back to QuantityView
- For recipe references, direct-add is available only for a saved portion preference. It reloads the current owner/community recipe and calls `POST /api/recipes/{id}/log`; recipe nutrition caches are never used for a client diary write
- Without a saved recipe portion preference, the Hub opens the recipe-specific portion view; a saved gram preference is converted with the existing recipe portion-weight rule and its 300 g fallback, while a saved portion preference is prefilled unchanged. Its final write also uses the recipe-log endpoint
- An unavailable recipe reference is shown as `Rezept nicht verfügbar` without a stale image, nutrition preview, or direct-add action; it cannot be opened or logged, but its favorite can still be removed

In `recipeIngredient` context, recipe references are omitted from favorites and recents and guarded from ingredient callbacks. Only selected foods or an explicit single-food AI estimate can return to the recipe wizard.

**Key files:**
- `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx` — filter state, data loading, hub wiring
- `mobile/src/modules/nutrition/hub/FoodList.tsx` — generic list component
- `mobile/src/modules/nutrition/hub/RelationRow.tsx` — unified list row
- `mobile/src/modules/nutrition/hub/FoodEntryHub.utils.ts` — `computeLastUsageText()`, `computeDirectAddLabel()`, `computeMacroText()`, `sortByMealTypeUsage()`, `buildDirectAddItemInput()`, `relativeUsage()`

## SearchState

Shows when mode = `search`:
- Results `FlatList` using `ResultRow` component
- Search results cached in `FoodEntryHub.tsx` by normalized query
  - Returning from `QuantityView` restores results without another request when the query is unchanged
  - A changed query does not reuse results from the previous search
- **Bottom fallback section** (always visible as `ListFooterComponent`):
  - 0 results: "Kein Treffer für '…' — Wir haben ein paar andere Ideen:"
  - ≥1 results: "Nicht das passende dabei?"
  - Actions: KI-Schätzung · Label Scan · Manuell

In recipe-wizard mode, the KI action uses the current search text for a single-food estimate instead of the meal estimate flow. The result is returned to the wizard, the hub closes, and the ingredient is shown there as explicitly confirmed with a KI badge. No estimate is started automatically when a search has no result.

`SearchState` is not exclusive to diary entry. It also supports FoodEntryHub's recipe-ingredient context, where ingredient callbacks are used and diary mutations remain disabled.

Recipe-ingredient context deliberately separates Recipe AI from Food AI: recipe analysis happens in `RecipeWizardScreen` through `POST /api/ai/recipe-analyze`; the hub's AI action estimates exactly one unresolved food through the food-estimate flow and returns that estimate to the wizard.

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

The Hub's actual text input remains context-dependent:
- Meal type known: `"Für Frühstück suchen…"` (localized to meal type)
- No meal type: `"Lebensmittel suchen…"`

The Home/Diary entry pill is a button that opens the Hub, not a text input; its visible text and accessibility label are `"Lebensmittel hinzufügen"`. The AI action uses a `KI` monogram in its circular mark with the one-line caption `"Schätzen"`. The barcode action keeps its barcode icon and uses the one-line caption `"Scan"`. Their accessibility labels remain `"KI schätzen"` and `"Barcode scannen"` in both the entry row and Hub.

## Finalized Decisions (2026-07-08)

These UX decisions are final and must not be reversed without explicit product discussion:

- Search field height: 52pt (not 44pt)
- Barcode icon + KI monogram: outside the pill, as standalone circular action marks next to the search field; each labeled action stays within the 52pt row height
- Barcode icon + KI monogram color: `colors.primary` (green, not muted)
- Quick actions in the idle view (formerly `IdleState`, no longer exists): removed (barcode + AI in search row is sufficient)
- Sticky CompactActionBar above results: removed (replaced by bottom fallback section)
- Snap point: `['85%']` for the default hub sheet
- Recents loading: moved from the former `IdleState` component (no longer exists) to `FoodEntryHub` level (passed as props)
- Recents rows render through `hub/RelationRow.tsx` (via `hub/FoodList.tsx`); the former `RecentItem` component no longer exists

## Key Files

| File | Purpose |
|---|---|
| `hub/FoodEntryHub.tsx` | Main bottom sheet component; contains the idle view (filter header) and the filter modal inline |
| `hub/hubReducer.ts` | State machine |
| `hub/useFoodEntryHubStore.ts` | Global open/close Zustand store |
| `hub/FoodList.tsx` | Generic list used by the idle view |
| `hub/SearchState.tsx` | Search results view |
| `hub/QuantityView.tsx` | Quantity selection view |
| `hub/BarcodeSubFlow.tsx` | Barcode sub-flow wrapper |
| `hub/AISubFlow.tsx` | AI estimation sub-flow |
| `hub/LabelSubFlow.tsx` | Label scan sub-flow |
| `hub/ManuellerSubFlow.tsx` | Manual entry sub-flow |
| `hub/mealTimeRules.ts` | Time-based meal type suggestion |
| `hub/RelationRow.tsx` | Unified quick-entry / recents row component (52 pt thumbnail) |

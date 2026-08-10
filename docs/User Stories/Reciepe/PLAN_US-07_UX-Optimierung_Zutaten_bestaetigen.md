# PLAN: US-07 — UX-Optimierung „Zutaten bestätigen"

**User Story:** [US-07_UX-Optimierung_Zutaten_bestaetigen.md](US-07_UX-Optimierung_Zutaten_bestaetigen.md)  
**Status:** Ready for implementation  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None

---

## Requirement Assessment

**Classification: Accept with modifications**

The User Story and its Acceptance Criteria are sound. All 15 ACs are implementable as frontend-only changes. One proposed solution (pre-loading search results) requires a different technical approach than what the User Story hints at (prefetching/caching during analysis). The recommended approach is simpler and eliminates all additional network requests.

**Key deviation from User Story hint:** The User Story asks the Planner to evaluate "parallel searches, prefetching, caching" for pre-loading search results. After analysing the code, none of these are necessary. The backend's `analyzeRecipe` response already returns a `candidates: FoodSearchResult[]` array for every `needsSelection` item — identical to what `IngredientSearchResults` would fetch. The correct solution is to pass these existing candidates directly to the search component, making the pre-loaded results a zero-cost byproduct of the existing analysis call.

**No product decisions are blocked.** All content and behaviour questions are resolved by the User Story or by the existing implementation.

---

## Independent UX Review

This review is based on a full read of `RecipeWizardScreen.tsx`, `IngredientSearchResults.tsx`, `AddIngredientModal.tsx`, `ingredientBuilders.ts`, `aiApi.ts`, and the design system documentation. Issues are numbered I-1 through I-18 and cross-referenced to Acceptance Criteria where applicable.

### Confirmed UX Problems

| # | Problem | Severity | Related AC |
|---|---|---|---|
| I-1 | No intro/context text in the `ingredients` phase. The user is dropped directly into a list of cards with no explanation of the task. | Medium | AC-1 |
| I-2 | Progress indicator (`{confirmed} von {total} bestätigt`) counts auto-matched and seasoning items as "bestätigt" but doesn't distinguish "needs action" items. A user with 3 auto-matched + 2 needs-selection reads "3 von 5 bestätigt" with no indication that 2 items need explicit action. | Medium | AC-2 |
| I-3 | `ing.parserItem.displayName` (card title) and `ri.displayName` (resolved row) are both unlabelled. For auto-matched items where both are equal, two identical strings appear without context. For `needs-selection` items where the AI name differs from the product name, the difference is opaque. | High | AC-3, AC-4 |
| I-4 | `needs-selection` items hide search results behind a "Treffer anzeigen" toggle. The user must tap to expand, which mounts `IngredientSearchResults` and fires a new search request. This adds a 200–600ms loading gap for each ingredient. | High | AC-5 |
| I-5 | `parserItem.candidates` (populated by the backend during analysis) is completely ignored in the `needs-selection` render path. `IngredientSearchResults` fetches the same data again from the same endpoint with the same query. | High | AC-5 |
| I-6 | The `needs-selection` state has no inline status message. The user sees the card title and a toggle button; there is no text explaining that multiple products were found and a selection is needed. | Medium | AC-6 |
| I-7 | The `needs-ai` state shows only "✦ KI-Schätzung verwenden". The button gives no context: why isn't there a catalog match? What will the AI estimate do? For most items this button is never shown (batch AI runs immediately), but when it is shown (batch failed), it's unexplained. | Low | AC-7 |
| I-8 | Both "Ersetzen" and "Entfernen" use `styles.changeLink` which applies `colors.negative` (red). Replacing an ingredient is not a destructive action. The identical visual treatment creates false urgency and contradicts the design system's information hierarchy rule. | High | AC-8 |
| I-9 | "Ersetzen" and "Entfernen" are rendered as inline `caption`-sized text links (12px). The tap target is below the 44pt minimum recommended for mobile. | High | AC-8 |
| I-10 | `handleRemoveIngredient` filters the ingredient from state with no confirmation and no snackbar. The item disappears silently. There is no way to undo an accidental removal. | High | AC-10 |
| I-11 | The "Zutat hinzufügen" button opens `AddIngredientModal` without an `initialQuery`. The modal opens with an empty `SearchState` (no recents, no pre-loaded results). The user sees a blank search field with no guidance. The button works functionally but the UX is disorienting. | Medium | AC-11 |
| I-12 | The primary CTA "Weiter zu den Schritten →" is rendered at the bottom of the `ScrollView`'s content container. When the ingredient list is long, the button is invisible until the user scrolls to the bottom. There is no fixed/sticky affordance. | High | AC-13 |
| I-13 | "Weiter zu den Schritten →" is ambiguous: "Schritten" could mean wizard navigation steps or cooking steps. The next wizard phase is called "Zubereitungsschritte", making the label marginally clearer in context but still unnecessarily vague. | Low | AC-12 |
| I-14 | Seasoning items use the full card layout including: header, resolved row, g/Portion toggle, amount input field (read-only), kcal display, and "Ersetzen" link. A seasoning like "Salz" renders identically to "500g Hackfleisch" despite containing no meaningful nutritional contribution. This creates visual noise and makes long recipes harder to scan. | High | AC-14 |
| I-15 | Resolved seasoning items do not show "Entfernen". The guarded block `{ing.status !== 'seasoning' && ...}` excludes seasoning from removal. Seasonings can only be replaced, not removed. | Medium | AC-15 |

### Additional UX Problems (Beyond User Story Scope, for Information)

| # | Problem | Recommendation |
|---|---|---|
| I-16 | The header-level "✕" (remove) for unresolved items and the resolved-row "Entfernen" are two different interaction patterns for the same action. A user who removes an unresolved item via "✕" gets no feedback; a user who removes a resolved item via "Entfernen" (after this fix) would get a snackbar. Inconsistency in same screen. | Unify: use snackbar feedback for both remove paths. |
| I-17 | When batch AI estimation is running (many `ai-estimating` items), the screen shows multiple spinning `ActivityIndicator`s simultaneously with no aggregate progress indication. | Out of scope for this plan; acceptable for MVP. |
| I-18 | `amountEdits` accumulates stale entries when ingredients are removed (old IDs remain in the map). This is a memory leak, not a functional bug, and only accumulates over a single session. | Out of scope; negligible impact. |

---

## Feature Summary

A focused UX overhaul of the `ingredients` phase in `RecipeWizardScreen`. The changes are frontend-only, affect no API contracts, require no infrastructure work, and introduce no new native modules.

The overhaul covers six areas:
1. Screen orientation (intro text, progress indicator)
2. Pre-loaded search candidates (zero-cost, uses existing backend response)
3. Ingredient card information hierarchy (labelled source text, search term, status)
4. Action bar redesign (semantically correct colours, mobile tap targets, snackbar feedback)
5. Seasoning compact row
6. Sticky CTA and navigation label

---

## Current Behaviour

- `ingredients` phase: no intro text; progress pill shows `N von M bestätigt`.
- `needs-selection` items: results hidden behind a lazy toggle; `parserItem.candidates` ignored; search re-fetched on every expand.
- Card resolved row: `ri.displayName` and `ing.parserItem.displayName` both shown without labels; can appear as duplicate text.
- "Ersetzen" and "Entfernen": both rendered as red `caption` text links; minimum tap target not met.
- "Entfernen": no snackbar, no undo; item disappears silently.
- "Zutat hinzufügen": opens modal with empty search state.
- CTA: inside ScrollView content, unreachable without scrolling to bottom.
- Seasonings: full card layout with read-only amount input; no "Entfernen" action available.
- AI estimate button: labelled "✦ KI-Schätzung verwenden" without context.

---

## Desired Behaviour

- Intro text above ingredient list explains the task and the seasoning auto-accept rule.
- Progress indicator uses the pattern `{pendingCount} ausstehend · {confirmed}/{total}` and hides when all resolved.
- `needs-selection` items show candidates immediately (from `parserItem.candidates`) without a lazy toggle; the item's `rawText` (what the AI extracted from the recipe), the search term, and the resolution status are labelled separately.
- The resolved row labels are: source ingredient text + "Erkannt aus Rezept"; resolved product + "Zugeordnet".
- "Ersetzen" uses `colors.primary` (green); "Entfernen" uses `colors.negative` (red); both are accessible-height `body2` buttons.
- "Entfernen" shows a `Snackbar` with an "Rückgängig" action that re-adds the removed ingredient at its original position.
- "Zutat hinzufügen" opens `AddIngredientModal` pre-labelled "Zutat hinzufügen" (no pre-filled query); `SearchState` idle state visible immediately with keyboard auto-focus.
- CTA is a sticky footer outside the `ScrollView`, always visible; labelled "Zur Zubereitung →"; disabled (greyed) when unresolved items remain; enabled when all ingredients resolved.
- Seasonings render as compact single-row items: badge + name + "Ersetzen" + "Entfernen". No amount editor.

---

## Scope

- `mobile/src/modules/recipes/RecipeWizardScreen.tsx` — `ingredients` phase only
- `mobile/src/modules/recipes/IngredientSearchResults.tsx` — add `initialResults` prop
- No changes to other wizard phases (`input`, `analyzing`, `steps`, `preview`)
- No changes to `AddIngredientModal`, `ingredientBuilders.ts`, `recipeApi.ts`, `aiApi.ts`, backend, shared library

---

## Out of Scope

- Recipe Wizard phases other than `ingredients`
- `AddIngredientModal` internals (the modal works; only its invocation context is changed)
- Aggregate progress animation during batch AI estimation (I-17)
- `amountEdits` stale-entry cleanup (I-18)
- Backend changes of any kind
- Shared library changes
- Infrastructure or EAS build changes

---

## Confirmed Facts

From repository:

1. `aiApi.analyzeRecipe()` returns `AiRecipeAnalysis` where `ingredients: MealParserPreviewItem[]`. Each item has `candidates: FoodSearchResult[]` populated by the backend during analysis (same fan-out search as `foodApi.search`).
2. `initWizardIngredient` maps `needsSelection` items to `{ status: 'needs-selection' }` and preserves `parserItem` (including `parserItem.candidates`). The candidates are never read downstream.
3. `IngredientSearchResults` fires an API request on mount (via `useEffect`) and on every user query change. It has no `initialResults` prop.
4. `SearchState` (`nutrition/hub/SearchState.tsx`) accepts an `initialResults?: FoodSearchResult[]` prop and skips the initial search when provided. This pattern already exists in the codebase.
5. `Snackbar` and `useSnackbar()` exist in `mobile/src/shared/components/Snackbar.tsx` and are not currently used by `RecipeWizardScreen`.
6. `ConfirmSheet` exists in `mobile/src/shared/components/ConfirmSheet.tsx` and provides a FitTrack-styled confirmation bottom sheet.
7. `colors.primary` (green) and `colors.negative` (red) are the correct semantic tokens per the design system.
8. `typography.body2` (14px) is the minimum recommended text size for interactive elements.
9. The `RecipeWizardScreen` CTA is inside `ScrollView`'s `contentContainerStyle`; there is no sticky footer pattern currently used in this screen.
10. The `Snackbar` component renders absolutely positioned, `zIndex: 9999`, and is designed to overlay screen content.

From Knowledge Base:

11. Snackbar pattern: message + "Rückgängig" + 5s timer bar. Auto-dismiss. (docs/kb/product/05-ux-patterns.md)
12. Information hierarchy: primary / secondary / tertiary levels with corresponding visual weight. Tertiary actions must not use `colors.primary`. (docs/kb/product/03-design-system.md)
13. Minimum tap target for mobile is implied by the design system (44pt for touch elements).
14. `Snackbar` "Rückgängig" performs the inverse action. For ingredient removal, the inverse is re-insertion at the original index. (docs/kb/product/05-ux-patterns.md)

---

## Assumptions and Open Questions

| # | Assumption | Impact if wrong |
|---|---|---|
| A-1 | "Ersetzen" for a resolved `food` ingredient opens `AddIngredientModal` (the existing Search Hub) with a pre-populated query. No alternative approach is required. | None — confirmed from code. |
| A-2 | "Zutat hinzufügen" should open the Search Hub with keyboard auto-focus and an empty query, consistent with the existing `AddIngredientModal` search-first flow. | Low — alternative (pre-fill with placeholder) would be a small variation. |
| A-3 | The snackbar "Rückgängig" for ingredient removal re-inserts the ingredient at the same list index it occupied before removal. | Medium — if PO prefers appending at the end, this changes the implementation slightly but not the AC. |
| A-4 | The progress indicator uses the format `{pendingCount} ausstehend` (hiding confirmed count) when `pendingCount > 0`, and `Alle {total} Zutaten bereit ✓` when zero. A "loading" state during batch AI estimation is shown by the indicator. | Low — exact wording is implementation detail; the AC requires "eindeutig erkennbar, wie viele noch ausstehend". |
| A-5 | Seasoning compact row shows "Ersetzen" and "Entfernen" as icon-only buttons (or minimal text) to stay compact. "Entfernen" for seasonings also triggers the snackbar with undo. | Low — exact visual of seasoning row is implementation detail within AC-14/AC-15. |

**No open Product Owner decisions block this plan.**

---

## Existing Components to Reuse

| Component | Where | Usage in this plan |
|---|---|---|
| `Snackbar` / `useSnackbar()` | `mobile/src/shared/components/Snackbar.tsx` | Feedback after "Entfernen" (AC-10) |
| `ConfirmSheet` | `mobile/src/shared/components/ConfirmSheet.tsx` | Not required — snackbar + undo is preferred over confirm dialog per UX patterns |
| `AddIngredientModal` | `mobile/src/modules/recipes/AddIngredientModal.tsx` | Reused unchanged for "Ersetzen" (AC-9) and "Zutat hinzufügen" (AC-11) |
| `IngredientSearchResults` | `mobile/src/modules/recipes/IngredientSearchResults.tsx` | Extended with `initialResults` prop; reused for `needs-selection` candidates display |
| `colors.primary`, `colors.negative` | theme | Semantic action colours |
| `typography.body2` | theme | Minimum text size for interactive elements |
| `spacing.*`, `radius.*` | theme | All spacing and radius values |

---

## Proposed Technical Solution

### Pre-loaded Candidates (AC-5)

**Decision: Pass `parserItem.candidates` as `initialResults` to `IngredientSearchResults`.**

No prefetching, no caching, no parallel searches. The backend already performs the catalog search during `analyzeRecipe` and returns the results as `item.candidates`. This data is available on `parserItem.candidates` for the full duration of the `ingredients` phase.

**Change 1:** Add `initialResults?: FoodSearchResult[]` prop to `IngredientSearchResults`. When provided:
- Skip the initial `doSearch()` call on mount (do not fire a network request).
- Populate `results` state with `initialResults` immediately.
- Continue to support user-driven debounced search (user can refine by modifying the query field).

**Change 2:** Remove the lazy "Treffer anzeigen / Treffer verbergen" toggle for `needs-selection` items in `RecipeWizardScreen`. Show `IngredientSearchResults` inline always for expanded `needs-selection` cards. Auto-expand the first unresolved `needs-selection` card on mount (or after batch AI completes).

**Rationale for rejecting parallel prefetch:** `parserItem.candidates` is already the pre-fetched data. A parallel `foodApi.search()` call would duplicate the same backend work and introduce additional network latency and quota usage. The `SearchState` pattern (with `initialResults`) already implements this pattern for the Food Entry Hub — reusing it is consistent and requires no new abstractions.

### Sticky CTA (AC-13)

Move the CTA button outside the `ScrollView`. New layout within `KeyboardAvoidingView`:

```
KeyboardAvoidingView
  ScrollView  (flex: 1)
    [all ingredients, including the add button]
  View (stickyFooter)
    [Zur Zubereitung → ]
```

The sticky footer uses a top border (`borderTopWidth: 1, borderTopColor: colors.border`) and `paddingVertical: spacing.md`. It is placed inside `KeyboardAvoidingView` so it rises with the keyboard.

### Snackbar for "Entfernen" (AC-10)

Use `useSnackbar()` to obtain a snackbar `ref` and `show()` function. Mount `<Snackbar ref={snackbarRef} />` inside `SafeAreaView`, above the `<AddIngredientModal />`. On ingredient removal:
1. Capture the removed ingredient and its original index from the list.
2. Call `setIngredients(prev => prev.filter(...))` immediately (optimistic).
3. Call `snackbar.show({ message: '"${name}" entfernt', undoLabel: 'Rückgängig', onUndo: () => re-insert at original index, durationMs: 3500 })`.
4. Undo handler: `setIngredients(prev => { const next = [...prev]; next.splice(originalIndex, 0, removedIngredient); return next; })`.

Remove the header-level `✕` button for unresolved items — unify all removal through "Entfernen" in the resolved/unresolved row, triggering the same snackbar flow.

### Card Information Architecture (AC-3, AC-4)

For `needs-selection` items:
- Primary line: `ing.parserItem.rawText` (what the AI extracted) — labelled with an overline `AUS REZEPT`
- Secondary line: search query (= `ing.parserItem.displayName`) — labelled with an overline `SUCHE`
- Status line: `{candidates.length} Treffer gefunden — bitte auswählen` (or appropriate state description)

For resolved `food` items:
- The product name (`ri.displayName`) is shown with label `ZUGEORDNET`
- The original recipe text (`ing.parserItem.rawText`) is shown with label `AUS REZEPT` as a secondary line if it differs from the product name
- If `rawText === displayName`, only show one line (no duplication)

For `needs-ai` items (batch failed / manual trigger):
- Status description: "Kein Katalogtreffer — KI schätzt Nährwerte"

For `ai-estimating` items (batch in progress):
- Status description: "KI schätzt Nährwerte…" + `ActivityIndicator`

### Seasoning Compact Row (AC-14, AC-15)

Replace the full card with a compact row:

```
[Gewürz badge] [parserItem.displayName — body2] [Ersetzen] [Entfernen]
```

Visual: horizontal flex row, `backgroundColor: colors.surfaceMuted`, `borderRadius: radius.md`, `paddingVertical: spacing.xs`, `paddingHorizontal: spacing.md`. No amount editor. No calorie display (seasonings have zero/negligible nutritional contribution in the recipe model).

"Entfernen" for seasonings also triggers the snackbar with undo.

---

## Work Packages

---

### WP-F1 — `IngredientSearchResults`: Add `initialResults` prop

**Agent:** Frontend

**Goal:** Extend `IngredientSearchResults` with an optional `initialResults` prop. When provided, pre-seed the results list and skip the on-mount API fetch. Retain all user-driven search behaviour unchanged.

**Required Knowledge Base:**
- docs/kb/product/05-ux-patterns.md (search result row pattern)

**Required Repository Context:**
- mobile/src/modules/recipes/IngredientSearchResults.tsx
- mobile/src/modules/nutrition/hub/SearchState.tsx (reference: existing `initialResults` pattern)

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-5: Suchtreffer stehen unmittelbar nach dem Öffnen zur Verfügung.

**Dependencies:** None

**Expected Handoff:**
- `IngredientSearchResults` accepts `initialResults?: FoodSearchResult[]`
- When `initialResults` is provided and non-empty, no API fetch fires on mount
- `results` state initialises to `initialResults ?? []`
- Debounced search still fires when the user edits the query field
- Existing behaviour unchanged when `initialResults` is not provided

---

### WP-F2 — `RecipeWizardScreen`: Ingredients phase UX overhaul

**Agent:** Frontend

**Goal:** Implement all 15 Acceptance Criteria for the `ingredients` phase through a sequence of targeted subtasks. Each subtask maps to a distinct, independently testable area.

**Dependencies:** WP-F1 (for subtask F2-B)

---

#### Subtask F2-A — Intro text + progress indicator

**Agent:** Frontend

**Goal:** Add a context-setting introduction above the ingredient list. Replace the progress pill with a meaningful status indicator.

**Required Knowledge Base:**
- docs/kb/product/03-design-system.md (typography, spacing, overline pattern)
- docs/kb/product/05-ux-patterns.md (section labels)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — `ingredients` phase render block (lines ~575–600 and styles section)

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1: Erklärungstext oberhalb der Zutatenliste
- AC-2: Fortschrittsanzeige verständlich, zeigt ausstehende Aktionen

**Dependencies:** None

**Implementation notes:**
- Intro text: `typography.body2`, `colors.textSecondary`, `lineHeight: 22`, placed above the progress indicator. Content: "Prüfe die erkannten Hauptzutaten und ordne sie bei Bedarf zu. Gewürze werden automatisch übernommen."
- Remove the existing `progressPill` / `progressRow` style block.
- New progress indicator:
  - Compute `pendingCount = ingredients.filter(i => i.status === 'needs-selection' || i.status === 'needs-ai').length`
  - When `pendingCount > 0`: pill with `colors.primarySoft` background, text `{pendingCount} ausstehend · {confirmed}/{total}` using `typography.caption`
  - When `pendingCount === 0` and `ingredients.length > 0`: pill with `colors.primarySoft` background, text `Alle {total} Zutaten bereit ✓` using `typography.caption`
  - When AI batch is still running (`ai-estimating` items present): include a compact `ActivityIndicator` (size `'small'`) inside the pill row

**Expected Handoff:**
- Intro text rendered above ingredient list
- Progress indicator correctly counts pending (needs-selection + needs-ai) vs resolved items
- `ai-estimating` items are not counted as "pending" in the action sense but are shown as "in Bearbeitung"

---

#### Subtask F2-B — Pre-loaded candidates for `needs-selection`

**Agent:** Frontend

**Goal:** Remove the lazy expand toggle for `needs-selection` items and pass `parserItem.candidates` as `initialResults` to `IngredientSearchResults`, eliminating all on-demand search requests.

**Required Knowledge Base:** None

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — `needs-selection` render block
- mobile/src/modules/recipes/IngredientSearchResults.tsx — after WP-F1 changes

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-5: Keine zusätzliche Ladeverzögerung beim Öffnen einer Zutat
- AC-6: Eindeutig erkennbar, ob Suchtreffer vorhanden sind

**Dependencies:** WP-F1 (for `initialResults` prop)

**Implementation notes:**
- Remove the `candidateToggleBtn` / `expandedIngId` toggle UI entirely from `needs-selection` render.
- Remove the `expandedIngId` state variable (or verify it's not used elsewhere; if used by other states, keep the variable but stop using it for `needs-selection`).
- Render `IngredientSearchResults` inline always within a `needs-selection` card, passing `initialResults={ing.parserItem.candidates}` and `initialQuery={ing.parserItem.displayName}`.
- When `ing.parserItem.candidates.length === 0`: render `IngredientSearchResults` without `initialResults`; it will fire a live search automatically (edge case — backend should always return candidates for `needsSelection`).
- The status description line (from F2-A) in the card shows candidate count: `{candidates.length} Treffer — auswählen oder Suche verfeinern`.

**Expected Handoff:**
- `needs-selection` cards always show search results inline without toggle
- No network request fires when the card is visible (results from backend)
- `expandedIngId` state removed or scoped away from `needs-selection`

---

#### Subtask F2-C — Card information architecture

**Agent:** Frontend

**Goal:** Fix the duplicate text issue in ingredient cards. Label the source recipe text and the resolved product separately. Add clear status descriptions for each `IngStatus` state.

**Required Knowledge Base:**
- docs/kb/product/03-design-system.md (overline pattern, typography hierarchy)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — card render block and StyleSheet
- shared/types/recipes.ts (RecipeIngredient fields for reference)

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-3: Erkannter Rezepttext, Suchbegriff und Auflösungsstatus klar getrennt
- AC-4: Erkannter Name und Suchbegriff nicht als zwei identische, unbeschriftete Texte
- AC-6: Eindeutig erkennbar, ob Suchtreffer vorhanden sind, KI-Schätzung verfügbar oder Verarbeitung läuft
- AC-7: KI-Schätzung mit verständlichem Kontext

**Dependencies:** None (can proceed alongside F2-B)

**Implementation notes:**

**Card title area (all statuses):**
- Replace bare `cardTitle` with a two-line block:
  - Line 1: `ing.parserItem.rawText` — `typography.body1`, `fontWeight: '600'`, `colors.text` — this is what the AI extracted from the recipe text
  - Line 2 (conditional, only if `rawText !== displayName`): `ing.parserItem.displayName` — `typography.caption`, `colors.textMuted` — this is the normalised name used for search
  - Overline `AUS REZEPT` (overline style, `colors.textMuted`) above line 1 — only show if `rawText` and `displayName` both exist and differ; otherwise omit the overline to avoid unnecessary noise

**Resolved row (`isResolved && ri`):**
- Remove the current single-line `resolvedRow` layout.
- New layout:
  - Label `ZUGEORDNET` (overline, `colors.textMuted`, `marginTop: spacing.xs`)
  - `ri.displayName` — `typography.body2`, `colors.text` (product name)
  - If `ri.isAiEstimate`: show `✦ KI-Schätzung` badge (primarySoft badge pattern) instead of the display name line
- The original recipe text (`rawText`) is already shown in the card title area above; do not repeat it in the resolved row.
- Action row (Ersetzen + Entfernen): moved below the resolved product display; see F2-D.

**Status description line (between card title and resolved row):**
- `needs-selection` (handled in F2-B): `{N} Treffer — auswählen oder Suche verfeinern`
- `needs-ai`: `Kein Katalogtreffer — KI schätzt Nährwerte automatisch` (do not show the manual "KI-Schätzung verwenden" button for batch-estimable items; only show it if batch has failed and item reverted to `needs-ai`)
- `ai-estimating`: Row with `ActivityIndicator` (small) + `Schätze Nährwerte mit KI…`
- `confirmed` / `auto-matched` / `seasoning`: no status description (resolved state is self-evident)

**AI estimate button (for `needs-ai` state after batch failure):**
- Replace bare button text "✦ KI-Schätzung verwenden" with a labelled call-to-action:
  - Above the button: `typography.caption`, `colors.textMuted`: "Kein Produkt im Katalog gefunden. Die KI schätzt Nährwerte auf Basis des Namens."
  - Button: standard `aiBtn` style, text "✦ Nährwerte schätzen"

**Expected Handoff:**
- Cards correctly distinguish `rawText` (recipe extraction) from `displayName` (search/resolved product)
- No two identical unlabelled text strings appear in any card state
- Each `IngStatus` has a visible, descriptive status line
- AI estimate button includes contextual explanation

---

#### Subtask F2-D — Action bar redesign + snackbar feedback

**Agent:** Frontend

**Goal:** Correct the semantic colours of "Ersetzen" and "Entfernen"; meet the 44pt tap target minimum; add snackbar feedback with undo for ingredient removal; unify the two removal paths (header `✕` and resolved-row "Entfernen") into one consistent flow.

**Required Knowledge Base:**
- docs/kb/product/05-ux-patterns.md (Snackbar pattern, Optimistic Updates)
- docs/kb/product/03-design-system.md (information hierarchy: tertiary actions must not use colors.primary)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — action handlers and resolvedRow render
- mobile/src/shared/components/Snackbar.tsx

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-8: "Ersetzen" und "Entfernen" funktionieren; Aktionen klar getrennt
- AC-9: "Ersetzen" öffnet Search Hub
- AC-10: Nach "Entfernen" sichtbare Rückmeldung

**Dependencies:** F2-C (action row placement within the refactored card layout)

**Implementation notes:**

**Remove header `✕` button:** Delete the unresolved-item header removal button (`{!isResolved && ...} <TouchableOpacity onPress={handleRemoveIngredient}>`). Removal is now exclusively via the "Entfernen" action available in all card states.

For unresolved items (`needs-selection`, `needs-ai`, `ai-estimating`): add an action row at the bottom of the card containing "Entfernen" (see button spec below). Do not show "Ersetzen" for unresolved items — they have no resolved ingredient to replace yet.

**Action row for resolved items:**
```
[Ersetzen (primary)]  [Entfernen (negative)]
```

**Button spec:**
- Both: `TouchableOpacity`, `minHeight: 36`, `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`, `borderRadius: radius.sm`
- "Ersetzen": `backgroundColor: colors.primarySoft`, text `colors.primary`, `typography.body2`, `fontWeight: '600'`
- "Entfernen": `backgroundColor: transparent`, `borderWidth: 1`, `borderColor: colors.negative`, text `colors.negative`, `typography.body2`, `fontWeight: '600'`
- Row: `flexDirection: 'row'`, `gap: spacing.sm`, `marginTop: spacing.sm`

**Snackbar integration:**
- Add `const { ref: snackbarRef, show: showSnackbar } = useSnackbar()` at the top of `RecipeWizardScreen`.
- Render `<Snackbar ref={snackbarRef} />` as the last child inside `SafeAreaView`, above `AddIngredientModal`.
- Refactor `handleRemoveIngredient`:
  ```ts
  const handleRemoveIngredient = (ingId: string) => {
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    const originalIndex = ingredients.findIndex(i => i.id === ingId);
    // Optimistic remove
    setIngredients(prev => prev.filter(i => i.id !== ingId));
    setAmountEdits(prev => { const next = { ...prev }; delete next[ingId]; return next; });
    // Snackbar with undo
    showSnackbar({
      message: `„${ing.parserItem.displayName}" entfernt`,
      undoLabel: 'Rückgängig',
      onUndo: () => {
        setIngredients(prev => {
          const next = [...prev];
          next.splice(originalIndex, 0, ing);
          return next;
        });
        if (ing.resolvedIngredient) {
          setAmountEdits(prev => ({
            ...prev,
            [ing.id]: amountEdits[ing.id] ?? {
              mode: ing.resolvedIngredient!.inputMode,
              value: String(ing.resolvedIngredient!.inputAmount),
            },
          }));
        }
      },
      durationMs: 3500,
    });
  };
  ```

**Note on `amountEdits` capture:** `onUndo` captures `amountEdits` at the time of removal. This is correct — restoring the ingredient restores the exact edit state the user had before deletion.

**Expected Handoff:**
- "Ersetzen" is visually primary (green tinted), "Entfernen" is visually destructive (red outline)
- Both buttons meet 44pt minimum height
- Header `✕` button removed
- Snackbar appears after removal with 3.5s undo window
- Undo re-inserts ingredient at original position

---

#### Subtask F2-E — Seasoning compact row

**Agent:** Frontend

**Goal:** Replace the full card layout for `seasoning` items with a compact single-row design. Add "Entfernen" for seasonings.

**Required Knowledge Base:**
- docs/kb/product/03-design-system.md (surfaceMuted, badge pattern)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — seasoning card render block and styles

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-14: Seasoning-Zutaten kompakter dargestellt
- AC-15: Aktion "Ersetzen" bleibt für Seasonings verfügbar

**Dependencies:** F2-D (snackbar is available for seasoning removal)

**Implementation notes:**

Replace the `ing.status === 'seasoning'` rendering branch entirely. New compact row:

```
[GEWÜRZ badge] [displayName — body2, colors.text, flex: 1] [Ersetzen] [Entfernen]
```

Layout:
- `backgroundColor: colors.surfaceMuted` (instead of `colors.surface` used for food cards)
- `borderRadius: radius.md`
- `paddingVertical: spacing.sm`
- `paddingHorizontal: spacing.md`
- `flexDirection: 'row'`
- `alignItems: 'center'`
- `marginBottom: spacing.xs` (tighter gap than food cards which use `spacing.sm`)

Badge: existing `seasoningBadge` / `seasoningBadgeText` styles (already defined, no change needed).

"Ersetzen" button: icon-only or text-only compact variant:
- `TouchableOpacity`, `paddingHorizontal: spacing.sm`, `paddingVertical: spacing.xs`
- Text: `typography.caption`, `colors.primary`

"Entfernen" button: same compact variant, `colors.negative` — calls `handleRemoveIngredient(ing.id)` (snackbar applies).

No calorie display, no amount editor, no amount toggle. `resolvedIngredient` for seasonings already carries the correct fixed-gram amount from `buildIngFromSeasoning`; no user editing is needed.

**Expected Handoff:**
- Seasonings render as a compact single row
- "Ersetzen" and "Entfernen" both available for seasonings
- Removal triggers the snackbar from F2-D
- Visual distinction between seasoning rows (surfaceMuted) and food cards (surface) is clear

---

#### Subtask F2-F — Sticky CTA + navigation label

**Agent:** Frontend

**Goal:** Move the primary CTA button outside the `ScrollView` to make it persistently reachable. Rename the button label to be unambiguous.

**Required Knowledge Base:**
- docs/kb/product/03-design-system.md (primaryBtn pattern, disabled state)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx — `KeyboardAvoidingView`, `ScrollView`, CTA button, and styles

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-12: Eindeutige Bezeichnung der Navigation zum nächsten Schritt
- AC-13: Primäre Aktion bleibt beim Scrollen erreichbar

**Dependencies:** None (can proceed in parallel with other subtasks; final integration into layout requires F2-D/F2-E to be complete to avoid merge conflicts)

**Implementation notes:**

Current structure:
```jsx
<KeyboardAvoidingView style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={styles.scroll}>
    {/* ingredients list */}
    <TouchableOpacity style={[styles.primaryBtn, ...]}>Weiter zu den Schritten →</TouchableOpacity>
  </ScrollView>
</KeyboardAvoidingView>
```

New structure:
```jsx
<KeyboardAvoidingView style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={styles.scroll}>
    {/* ingredients list — no CTA here */}
    <TouchableOpacity style={styles.addBtn} onPress={...}>+ Zutat hinzufügen</TouchableOpacity>
  </ScrollView>
  {/* Sticky footer — only for ingredients phase */}
  <View style={styles.stickyFooter}>
    <TouchableOpacity
      style={[styles.primaryBtn, !allIngredientsResolved && styles.primaryBtnDisabled]}
      onPress={() => setPhase('steps')}
      disabled={!allIngredientsResolved}
      activeOpacity={0.8}
    >
      <Text style={styles.primaryBtnText}>Zur Zubereitung →</Text>
    </TouchableOpacity>
  </View>
</KeyboardAvoidingView>
```

`stickyFooter` style:
```ts
stickyFooter: {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.background,
}
```

`paddingBottom` of the `scroll` contentContainerStyle: remove the `paddingBottom: spacing.xxl` that was there to ensure the CTA was visible; replace with a smaller `paddingBottom: spacing.md`.

Button label: `"Zur Zubereitung →"` — unambiguous reference to the "Zubereitungsschritte" wizard phase.

**Note on `allIngredientsResolved`:** The derived constant already exists in the component. No change to the computed value is needed. The sticky footer inherits the same disabled logic.

**Expected Handoff:**
- CTA is visible at all scroll positions within the ingredients phase
- CTA is disabled (greyed) when unresolved items remain
- Button label reads "Zur Zubereitung →"
- "Zutat hinzufügen" button remains in the scroll area above the sticky footer

---

### WP-Q1 — QA Review

**Agent:** QA

**Goal:** Verify that all 15 Acceptance Criteria are met and that no regressions were introduced in the `ingredients` phase or adjacent phases of `RecipeWizardScreen`.

**Required Knowledge Base:**
- docs/kb/tech/08-testing.md
- docs/kb/product/05-ux-patterns.md (snackbar, optimistic delete, tap targets)
- docs/kb/product/03-design-system.md (colour tokens, typography, information hierarchy)

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/modules/recipes/IngredientSearchResults.tsx
- mobile/src/modules/recipes/ingredientBuilders.test.ts (existing unit tests — must not regress)
- mobile/src/shared/components/Snackbar.tsx

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1 through AC-15

**Dependencies:** WP-F1, WP-F2 (all subtasks complete)

**Test scope:**

1. **AC-1 — Intro text:** Present above ingredient list. Mentions main ingredients and seasoning auto-accept. Not shown in other phases.
2. **AC-2 — Progress indicator:** Shows correct count of "ausstehend" items (`needs-selection` + `needs-ai`). Updates immediately when an item is resolved. Shows "Alle N Zutaten bereit ✓" when all resolved. Shows estimating indicator when `ai-estimating` items are present.
3. **AC-3 / AC-4 — Card information architecture:** For a `needs-selection` item where `rawText !== displayName`: both are shown with distinct labels, no duplicate strings. For a resolved item: product name shows under "ZUGEORDNET" label; recipe text appears in card title area. For an item where `rawText === displayName`: only one string is shown.
4. **AC-5 — Pre-loaded candidates:** Open a `needs-selection` card → results appear immediately (no spinner, no delay). Verify no `foodApi.search()` request fires on open (inspect network or mock). Verify debounced search fires when user edits query.
5. **AC-6 — Status indicators:** `needs-selection` card shows candidate count text. `needs-ai` card shows explanation text. `ai-estimating` card shows spinner + text. Resolved cards show no status description.
6. **AC-7 — AI estimate context:** When `needs-ai` state is shown after batch failure, explanation text is present above the button. Button is labelled "✦ Nährwerte schätzen" (not the old label).
7. **AC-8 / AC-9 — Action buttons:** "Ersetzen" uses green tint (`colors.primarySoft` BG, `colors.primary` text). "Entfernen" uses red outline. Both have minimum 36pt height. "Ersetzen" tapped → `AddIngredientModal` opens with pre-filled query. User selects new product → ingredient replaced in list.
8. **AC-10 — Entfernen feedback:** Remove an ingredient → it disappears immediately → snackbar appears with ingredient name and "Rückgängig". Undo restores the ingredient at its original position. Snackbar auto-dismisses after 3.5s.
9. **AC-11 — Zutat hinzufügen:** Button opens `AddIngredientModal` with empty query. User can search and add; new ingredient appears at end of list. `replacingIngId` is null when this flow is used.
10. **AC-12 — CTA label:** Button reads "Zur Zubereitung →" in all states.
11. **AC-13 — Sticky CTA:** CTA visible without scrolling when list has > 5 ingredients. Disabled when any ingredient is `needs-selection` or `needs-ai`. Enabled when all resolved.
12. **AC-14 — Seasoning compact row:** Seasoning items are visually smaller than food cards. No amount editor shown. `backgroundColor: colors.surfaceMuted` used.
13. **AC-15 — Seasoning actions:** "Ersetzen" tapped on seasoning → `AddIngredientModal` opens with seasoning name. "Entfernen" tapped → snackbar appears.

**Regression tests:**
- `input` phase: unaffected — verify recipe text entry and analysis still works.
- `analyzing` phase: unaffected — spinner and text unchanged.
- `steps` phase: unaffected — no layout changes.
- `preview` phase: unaffected — confirm ingredient list still populated from confirmed ingredients.
- `ingredientBuilders.test.ts`: all existing tests pass without modification.
- `AddIngredientModal`: confirm no behavioural change (only invocation context changes in the caller).

**Expected Handoff:** QA sign-off. Implementation ready for Alpha deployment.

---

## Acceptance Criteria

_(Source: User Story US-07, verbatim — reproduced here for traceability)_

1. Oberhalb der Zutatenliste wird ein kurzer Erklärungstext angezeigt, der den Zweck des Screens beschreibt und erklärt, dass Hauptzutaten geprüft bzw. zugeordnet werden, während Gewürze automatisch übernommen werden.
2. Die Fortschrittsanzeige verwendet eine verständliche Formulierung und macht eindeutig erkennbar, wie viele Zutaten bereits verarbeitet sind und wie viele noch eine Aktion benötigen.
3. Eine offene `food`-Zutat zeigt klar getrennt den erkannten Rezepttext inklusive Menge, den Suchbegriff und den aktuellen Auflösungsstatus.
4. Der erkannte Zutatenname und der Suchbegriff werden nicht als zwei identische, unbeschriftete Texte direkt untereinander dargestellt.
5. Suchtreffer stehen dem Nutzer unmittelbar nach dem Öffnen einer Zutat zur Verfügung. Ein zusätzliches Laden der Suchergebnisse beim Öffnen einer Zutat findet nicht statt.
6. Ist eine Zutat noch nicht aufgelöst, ist eindeutig erkennbar, ob Suchtreffer vorhanden sind, eine KI-Schätzung verwendet werden kann oder noch eine Verarbeitung läuft.
7. Die Aktion zur KI-Schätzung wird mit einem verständlichen Kontext dargestellt.
8. Für eine bereits ausgewählte Zutat funktionieren die Aktionen „Ersetzen" und „Entfernen".
9. „Ersetzen" öffnet den bestehenden Search Hub.
10. Nach dem Entfernen einer Zutat verschwindet diese aus dem Rezeptentwurf und der Nutzer erhält eine sichtbare Rückmeldung.
11. „Zutat hinzufügen" öffnet den bestehenden Search Hub.
12. Die Navigation zum nächsten Schritt verwendet eine eindeutige Bezeichnung.
13. Die primäre Aktion zum Fortfahren bleibt während des Scrollens gut erreichbar.
14. `seasoning`-Zutaten werden kompakter als normale `food`-Zutaten dargestellt.
15. Für `seasoning`-Zutaten bleibt die Aktion „Ersetzen" verfügbar.

---

## Risks and Edge Cases

| # | Risk | Mitigation |
|---|---|---|
| R-1 | `parserItem.candidates` is empty for a `needsSelection` item (edge case: backend returned the status but no candidates). | `IngredientSearchResults` falls back to live search when `initialResults` is undefined or empty. This is already handled by the proposed implementation. |
| R-2 | The `Snackbar` `onUndo` closure captures `amountEdits` at removal time. If a later render produces a stale reference, the undo may restore wrong amount state. | The closure captures `amountEdits[ing.id]` at the moment of removal. Since the entry is deleted before `onUndo` could fire, it reads from the pre-deletion snapshot passed as a closure variable. This is correct and safe. |
| R-3 | Moving the CTA outside the `ScrollView` breaks the `KeyboardAvoidingView` behaviour when the keyboard is open (CTA is pushed up). | This is intentional and desirable — the CTA should still be visible and above the keyboard. The `behavior='padding'` on iOS handles this correctly. On Android, no `KeyboardAvoidingView` behavior is set (existing pattern). |
| R-4 | Removing the header `✕` button for unresolved items removes the only removal path for `ai-estimating` items. | Per the proposed design, `ai-estimating` items should not be removable while estimation is in progress (it would create a dangling async operation). If the batch fails and items revert to `needs-ai`, "Entfernen" is available at that point. This is acceptable UX — the user waits for estimation to complete before removing. |
| R-5 | The `expandedIngId` state variable is used for both `needs-selection` expand state and (potentially) other interaction states. | Audit all usages of `expandedIngId` before removal. From the current code, it is only used for the `needs-selection` toggle. If confirmed, the variable can be removed entirely. |

---

## Recommended Execution Order

1. **WP-F1** — `IngredientSearchResults` prop extension. Small, isolated, no dependencies.
2. **F2-A** — Intro text + progress indicator. No dependencies, no visual conflicts with other subtasks.
3. **F2-C** — Card information architecture. Can proceed after F2-A; provides the card layout that F2-D builds on for action placement.
4. **F2-B** — Pre-loaded candidates. Requires WP-F1. Can proceed after F2-C (card structure) or in parallel if the same developer handles both.
5. **F2-D** — Action bar redesign + snackbar. Requires F2-C for action row placement. Provides the snackbar hook used by F2-E.
6. **F2-E** — Seasoning compact row. Requires F2-D (snackbar available). Isolated visual change.
7. **F2-F** — Sticky CTA + label rename. No content dependencies; final layout integration should happen after F2-D and F2-E to avoid merge conflicts in the `ingredients` phase render block.
8. **WP-Q1** — QA review after all Frontend work is complete.

---

## Persistence Impact

None. This plan introduces no changes to Cosmos DB documents, containers, or backend data models.

---

## Documentation Updates

The following Knowledge Base document should be updated after implementation:

- **docs/kb/domain/06-recipes.md** — Update the "Recipe Wizard" section to reflect: (a) the `ingredients` phase UX patterns (intro text, progress indicator, seasoning compact row), (b) the pre-loaded candidates architecture (backend `candidates` array used client-side without re-fetch), (c) the sticky CTA pattern introduced for this screen. This update is out of QA scope — it should be completed by the Frontend agent as part of the implementation.

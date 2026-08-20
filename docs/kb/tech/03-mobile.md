# Mobile App

## Framework

React Native (Expo SDK), TypeScript. Dark-only app — no light mode.

## Directory Structure

```
mobile/src/
├── app/
│   ├── App.tsx              Root component — wraps NavigationContainer
│   ├── ErrorBoundary.tsx    Top-level error boundary
│   ├── navigation/
│   │   ├── RootNavigator.tsx  Bottom tab shell + all stacks
│   │   └── index.ts
│   └── theme/               Design tokens (colors, typography, spacing, radius)
├── assets/                  Static assets (icons, images, brand)
├── modules/                 Feature modules
│   ├── auth/                Login screen, auth guards
│   ├── healthConnect/       HealthConnectScreen (Integrationen)
│   ├── home/                HomeScreen
│   ├── nutrition/           DiaryScreen, FoodEntryHub, AI flows
│   ├── onboarding/          (planned — currently part of profile)
│   ├── profile/             ProfileScreen, ProfileWizard, Library
│   ├── progress/            ProgressScreen, weight chart
│   ├── recipes/             RecipeListScreen, detail, wizard create/edit flow
│   ├── scanner/             BarcodeScannerScreen
│   └── weight/              WeightDetailScreen
├── services/
│   ├── health/              Health platform abstraction (HC-1, HC-2a, HC-2b)
│   │   ├── IHealthPlatformService.ts   Interface + types
│   │   ├── MockHealthPlatformService.ts
│   │   ├── HealthConnectService.ts     Android implementation
│   │   ├── healthPlatformService.ts    Factory (Mock vs Real)
│   │   └── healthSyncService.ts        Sync state machine (AsyncStorage)
│   ├── authConfig.ts        CIAM OAuth config (from env vars)
│   ├── authService.ts       Token storage, refresh, expiry check
│   ├── imageService.ts      Image picker utility
│   ├── insightService.ts    Daily insight polling
│   └── weightsService.ts    Weights data service
└── shared/
    ├── api/                 Typed API clients (per domain)
    ├── components/          Shared UI components (WeightChart, NutritionTile, MealChip, etc.)
    └── viewModels/          Pure view-model helpers for shared mobile flows
```

## Navigation

Built with React Navigation. Architecture: one bottom tab navigator containing a native stack per tab.

### Bottom Tabs

| Tab | Stack Root | Notes |
|---|---|---|
| Home | `HomeScreen` | Entry point; weight detail accessible from here |
| Nutrition | `DiaryScreen` | FoodEntryHub overlays from here |
| Recipes | `RecipeListScreen` | Full CRUD through detail + wizard stack |
| Weight | `ProgressScreen` | Visible tab label: `Progress`; weight chart, trend indicators |
| Profile | `ProfileScreen` | Settings, library, my products |

### Additional Screens (inside stacks)

- `WeightDetailScreen` — from Home or Progress
- `RecipeDetailScreen`, `RecipeWizardScreen` — in Recipes stack; `RecipeWizardScreen` handles both create and edit (`editId?`)
- `ProfileEditScreen`, `MyProductsScreen`, `LibraryScreen` — in Profile stack
- `ProfileWizardScreen` — shown as full-screen modal on first launch (no profile exists)
- `BarcodeScannerScreen` — camera barcode scanner, navigated to from FoodEntryHub

### First Launch

On app start, `RootNavigator` checks for an existing profile via `AsyncStorage` (`SKIP_WIZARD_KEY`). If absent, `ProfileWizardScreen` is presented as a modal.

## API Client

`mobile/src/shared/api/client.ts` — Axios instance with:
- `baseURL` from `EXPO_PUBLIC_API_URL` (required env var — fails loudly if missing)
- 15s timeout
- **Request interceptor:** attaches Bearer access token; proactively refreshes if token is expired
- **Response interceptor:** on 401, attempts one silent refresh + retry; on second 401, clears tokens (logout)
- **429 handling:** surfaces `isQuotaExceededError` flag with quota metadata

Typed API clients (one per domain):
- `aiApi.ts` — AI features (parse meal, estimate food, label scan, estimate meal, recipe analysis, recipe scale preview, daily insight, weekly insight)
- `diaryApi.ts` — diary CRUD
- `favoritesApi.ts` — favorites + recents
- `foodApi.ts` — food search
- `profileApi.ts` — profile CRUD
- `recipeApi.ts` — recipe CRUD
- `reusableItemsApi.ts` — personal food library

## State Management

| Pattern | Usage |
|---|---|
| `useState` / `useReducer` | Local screen state (form data, loading flags) |
| Zustand store | Cross-screen / global state only |
| `useFoodEntryHubStore` | Hub open/close state + entry params |
| `useDayTypeStore` | Day type (rest/training) selection for diary |

No global state library for server data — screens fetch on mount and refresh on focus.

**Current weekly-card summary layout:** The left header title is `Letzte 7 Tage`; the right side shows one line `Zielerreichung: <Wert>`. Directly below it, only right-aligned consumed/target totals with the visible `kcal` unit remain, without a visible target label and with a small inset from the card edge. The two lower metric rows, including average target per day, are removed. Each day column shows the consumed calorie number without repeating `kcal` above the bar; accessibility labels retain the full units. This supersedes the earlier two-row description.

`HomeScreen` loads the typed weekly review through `aiApi.getWeeklyInsight(referenceDate)` on screen focus and pull-to-refresh. The request runs independently from the daily dashboard, while response, loading, recoverable error, and neutral evaluation state remain separate. `WeeklyReviewCard` renders `Letzte 7 Tage` on the left of the header and one right-aligned line `Zielerreichung: <Wert>` on the right. Directly below, only consumed/target totals with the visible `kcal` unit remain, without a visible target label and with a small inset from the card edge. The two lower metric rows, including average target per day, are removed; seven stable flexible day columns remain without horizontal scrolling. Consumed aggregate colors use the existing `overallTargetPercent`/`getWeeklyTargetBand()` semantics, including valid `0 %`; target values remain neutral. Textual chart headings and the visible included-day count are omitted. Each bar is an accessible trigger for the existing `InfoOverlay`; the bar itself has no navigation or mutation, and only `Tagebuch öffnen` navigates through `Nutrition -> DiaryMain({ date })`. The visible grid keeps the header period, daily calorie value, percentage, and weekday; daily calorie values omit the repeated `kcal` unit while accessibility labels retain full units. Missing values use a neutral diagonal SVG hatch without height semantics; a valid `0 kcal` MealItem remains a solid bar. Training and special activities retain their compact markers and the special-activity frame. The AI evaluation remains measured unbounded and invisibly at the real container width and exposes `Mehr anzeigen`/`Weniger anzeigen` only when text actually overflows. Route dates remain defensively validated and are consumed once through the existing DiaryScreen lifecycle.

The weekly request derives its `referenceDate` with `mobile/src/shared/date/localDate.ts` from the device's local calendar components. This helper is used only for the weekly request's reference date. Existing date derivation for daily diary, activity, food-entry, and recipe flows remains unchanged; this is not an app-wide date or UTC refactor.

`RecipeDetailScreen` keeps recipe scaling local to the screen. `targetPortions` is temporary and starts at the saved recipe value; the saved `Recipe`, its nutrition, and the independent diary logging flow are never replaced by the preview. Ingredients are projected synchronously with the shared pure `scaleRecipeIngredients()` function. Text preview requests use a roughly 400 ms debounce, an `AbortController`, and a monotone revision plus recipe `id`/`updatedAt` guard. Reset to the original portions, recipe reload, and unmount invalidate timers and requests. While debounce or loading is active, the old description and steps are hidden; a single atomic text state either accepts the complete response or restores the original texts on error.

The weekly day overlay also renders a compact calorie comparison from the response-provided consumed calories, effective target, and target percentage. It keeps the absolute protein, carbohydrate, and fat values separate and never invents historical macro targets. Day type and workout type are separate context values; special-activity and bonus details remain visible when supplied, while a missing workout type on a training day is shown neutrally as `Nicht verfügbar`.
The weekly day overlay also renders a compact calorie comparison from the response-provided consumed calories, effective target, and target percentage. It keeps the absolute protein, carbohydrate, and fat values separate and never invents historical macro targets. Special-activity and training details are rendered as ordered label/value groups only for `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel`, and `Sonderaktivität` for special-activity context (`Aktivität` only when training is present without a special activity); `Tagestyp`, `Workout-Typ`, and `Datenstatus` are removed from visible and accessibility-relevant detail groups. Missing values use `Nicht verfügbar` and valid zeroes remain visible. If a refresh fails while a review is retained, the card keeps the review visible and exposes `Aktualisierung fehlgeschlagen` with the existing retry callback; without a review, the existing full error state remains.

The rendered weekly grid follows `bars -> weekday -> marker area -> marker legend -> color legend`; the marker legend appears only when at least one special activity is present and is reduced to one deduplicated `Sonderaktivität` entry. Day containers and marker cells are seven stable flexible cells below the weekday labels and marker cells are separate from `barTrack`. `mobile/src/modules/home/homeTrainingPresentation.ts` is the shared Home catalog for `WorkoutTypePicker`, `CoachingHeroCard`, and known weekly training markers: `rest`/`Ruhetag`/`sleep`, `gym`/`Gym`/`weight-lifter`, `bouldering`/`Bouldern / Klettern`/`human-handsup`, `running`/`Laufen`/`run`, `cycling`/`Radfahren`/`bike`, and `other`/`Sonstiges`/`dots-horizontal`. A missing or unknown workout value uses a neutral generic `Training` marker; a rest day without a special activity has no marker. Special-activity markers use `Radtour` for `cycling`, `Wanderung` for `hiking`, and neutral `Sonderaktivität` for unknown activity values. Training `cycling` therefore remains distinct from special-activity `Radtour` by label and marker kind; special-activity icons use `colors.chart.specialActivityOutline`, while training markers and weekday labels remain neutral. A training marker followed by a special-activity marker is rendered in that order, and both remain visible when combined. No concrete date is rendered below the bars; the date-only value is reserved for the day-detail overlay. Markers are monochrome decorative elements apart from the purple special-activity accent and do not create their own TalkBack action targets. The full color legend remains `Im Ziel`, `Nicht im Ziel`, and `Keine Daten`, vertically centered with controlled responsive wrapping.

The Home picker, coaching card, and training markers render catalog icons in a neutral monochrome color. `colors.chart.specialActivityOutline` (`#C4A1FF`) is used for special-activity marker icons and their legend entry, not for training markers, weekday labels, bar fills, or column outlines. `colors.chart.average` remains unchanged (`#8FA9CB`).

## Authentication (Mobile Side)

Uses `expo-auth-session` for PKCE OAuth2 flow against Entra CIAM.

- `authConfig.ts` — OIDC discovery URL, token endpoint, scopes (constructed from env vars)
- `authService.ts` — stores tokens in `expo-secure-store`; implements `isTokenExpired()` (client-side decode only, backend re-validates); `refreshAccessToken()` hits CIAM token endpoint

See [tech/05-authentication.md](05-authentication.md) for full flow.

## Key Feature Modules

### Nutrition Module (`modules/nutrition/`)

- `DiaryScreen.tsx` — daily diary view with meal cards and hint display
- `hub/` — FoodEntryHub (bottom sheet workspace for food entry)
- `MealParserReviewScreen.tsx` — review AI-parsed meal text before saving
- `FoodEstimateReviewScreen.tsx` — review/edit AI food estimates
- `LabelScanReviewScreen.tsx` — review OCR + AI extracted nutrition label
- `MealEstimateReviewScreen.tsx` — review AI meal image estimate
- `AddItemModal.tsx` — [legacy, being superseded by FoodEntryHub]
- `ProductEditor.tsx` — edit reusable item details
- `EditItemSheet.tsx`, `CopyItemSheet.tsx`, `MoveItemSheet.tsx` — item management sheets

See [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) for Hub architecture.

In recipe-ingredient context the same hub is opened as an ingredient picker. `useFoodEntryHubStore` carries `purpose: 'recipeIngredient'`, optional initial query/prefilled amount, and ingredient callbacks; successful product selection or explicit single-food AI estimation returns to `RecipeWizardScreen` instead of adding a diary item.

### Recipes Module (`modules/recipes/`)

- `RecipeListScreen.tsx` — recipe overview
- `RecipeDetailScreen.tsx` — recipe detail, temporary portion scaling, diary logging, image display
- `RecipeWizardScreen.tsx` — single create/edit wizard; replaces the removed `RecipeCreateScreen`
- `RecipeWizardInputPhase.tsx`, `RecipeWizardIngredientsPhase.tsx`, `RecipeWizardStepsPhase.tsx`, `RecipeWizardPreviewPhase.tsx` — phase views controlled by `RecipeWizardScreen`
- `recipeWizardImageMutations.ts` — client-side sequencing for image delete/upload/reorder after recipe save

`RecipeCreateScreen` and the `RecipeCreate` navigation route are removed. New recipe creation and existing recipe editing both use `RecipeWizardScreen`; edit mode is selected by passing `editId`.

### Progress Module (`modules/progress/`)

- `ProgressScreen.tsx` — weight trend chart, progress signals
- `WeightDetailScreen.tsx` in `modules/weight/`

## Theme

`mobile/src/app/theme/` — exports design tokens consumed by all components.

[Rule] Never hardcode hex colors, font sizes, or spacing values. Always use theme tokens.

See [product/03-design-system.md](../product/03-design-system.md) for the full design system.

## Environment Variables (Mobile)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL (include `/api` suffix) |
| `EXPO_PUBLIC_AUTH_CLIENT_ID` | CIAM app client ID |
| `EXPO_PUBLIC_AUTH_TENANT_ID` | CIAM tenant ID |
| `EXPO_PUBLIC_AUTH_CIAM_HOST` | CIAM hostname |
| `EXPO_PUBLIC_AUTH_API_SCOPE` | API access scope URI |

**Per environment:**

| Variable | Dev | Alpha |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:7071/api` (emulator) or local IP | Azure Function App URL |
| Auth variables | Same CIAM tenant for all environments | Same CIAM tenant |

Dev values: `mobile/.env` (gitignored). Alpha and future production values: EAS build profiles (`mobile/eas.json`).

See [tech/01-system-overview.md](01-system-overview.md#runtime-environments) for the full environment model.

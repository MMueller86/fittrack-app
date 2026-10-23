# Mobile App

## Framework

React Native (Expo SDK), TypeScript. Dark-only app — no light mode.

## Directory Structure

```
mobile/src/
├── app/
│   ├── App.tsx              Root component — wraps NavigationContainer
│   ├── ErrorBoundary.tsx    Top-level error boundary; displays JS and React component stacks
│   ├── navigation/
│   │   ├── RootNavigator.tsx  Bottom tab shell + all stacks
│   │   └── index.ts
│   └── theme/               Design tokens (colors, typography, spacing, radius)
├── assets/                  Static assets (icons, images, brand)
├── modules/                 Feature modules
│   ├── auth/                Login screen, auth guards
│   ├── healthConnect/       HealthConnectScreen (Integrationen)
│   ├── home/                HomeScreen
│   ├── legal/               Impressum / Datenschutzerklärung (In-App, legalTexts.ts)
│   ├── nutrition/           DiaryScreen, FoodEntryHub, AI flows
│   ├── onboarding/          (planned — currently part of profile)
│   ├── profile/             ProfileScreen (Hub), ProfileDetails, ProfileEdit, ProfileWizard, LibraryScreen
│   ├── progress/            ProgressScreen, weight chart
│   ├── recipes/             RecipeListScreen, detail, wizard create/edit flow
│   ├── scanner/             BarcodeScannerScreen
│   └── weight/              WeightDetailScreen
├── services/
│   ├── health/              Health platform abstraction and server reconciliation (HC-1, HC-2a, HC-2b, HC-4)
│   │   ├── IHealthPlatformService.ts   Interface + types
│   │   ├── MockHealthPlatformService.ts
│   │   ├── HealthConnectService.ts     Android implementation
│   │   ├── healthPlatformService.ts    Factory (Mock vs Real)
│   │   ├── healthSyncService.ts        Weight sync state machine (AsyncStorage)
│   │   └── nutritionSyncService.ts     Meal sync state machine (AsyncStorage)
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
| Recipes (`Rezepte`) | `RecipeListScreen` | Visible tab label `Rezepte`; full CRUD through detail + wizard stack |
| Weight | `ProgressScreen` | Visible tab label: `Progress`; weight chart, trend indicators |
| Profile | `ProfileScreen` | Visible tab label: `Profil` (route id `Profile` unchanged; constants in `app/navigation/profileTab.ts`); hub starts with one tappable `Profil & Tagesziele` summary card and navigation groups, without a repeated page title |

### Additional Screens (inside stacks)

- `WeightDetailScreen` — from Home or Progress
- `RecipeDetailScreen`, `RecipeWizardScreen` — in Recipes stack; `RecipeWizardScreen` handles both create and edit (`editId?`)
- `ProfileDetailsScreen`, `ProfileEditScreen`, `LibraryScreen`, `HealthConnectScreen`, `ImprintScreen`, `PrivacyPolicyScreen` — in Profile stack (routes `ProfileDetails`, `ProfileEdit`, `Library`, `HealthConnect`, `Imprint`, `PrivacyPolicy`); there is no `MyProducts` route
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
- `reusableItemsApi.ts` — personal food library

Daily Insight display, fallback, and inline-expansion rules are defined in the
[central rulebook](../domain/09-daily-insight.md) and the
[API reference](09-api-reference.md).

## State Management

| Pattern | Usage |
|---|---|
| `useState` / `useReducer` | Local screen state (form data, loading flags) |
| Zustand store | Cross-screen / global state only |
| `useFoodEntryHubStore` | Hub open/close state + entry params |
| `useDayTypeStore` | Day type (rest/training) selection for diary |

No global state library for server data — screens fetch on mount and refresh on focus.

**Home coaching card and weight trend:** `CoachingHeroCard` contains the personal greeting and the existing day-type selector aligned on the right. For a valid complete `greeting`/`shortInsight` pair on a `fresh` or `cached` Daily Insight (greeting at most 120, short insight at most 240 characters), the server greeting replaces the static one and the card shows the short sentence plus a `Mehr anzeigen` toggle. The toggle expands the full insight inline within the card and changes to `Weniger anzeigen`; a new insight version or date resets the expanded state. `HomeScreen` passes the response, its date, and the feedback callback and no longer renders a separate Insight card. Daily Insight has no action/navigation CTA. Loading, `unavailable`, `quota_exceeded`, network errors, and missing or invalid fields keep the static greeting without short text or detail action. During a same-day focus or pull-to-refresh reload the previous valid pair stays visible until the new response arrives (no flicker to the static greeting); a new response without a valid pair, a request error, or a date change then shows the static greeting. `DayNutritionCard` places the current weight and trend beside the calorie ring on screens at least 380 dp wide; narrower layouts stack the calorie and weight regions. In the wide layout, the separator is aligned with the macro tracks' two-thirds 100% reference; the sparkline is 96 dp wide to fit the weight column. Current weight comes from the newest full-history entry and is normalized to kg. The chart uses `calculateWeightTrendRegressionSeries(entries, 14, referenceDate)` over the 14 local calendar dates, maps x positions by date, and plots its raw measurements and fitted endpoints without axes or direction colors. The trend value and fitted line require at least seven in-window measurements and a defined regression. One in-window measurement shows only current weight, with no sparkline or marker. With two to six measurements, or at least seven measurements without a defined regression, actual measurements remain visible without a trend. Current weight remains visible even when the window is empty. The SVG is decorative and the weight/trend is exposed as one accessibility value. `formatWeeklyTrendLabel` applies the approved numeric rule: `abs(rawWeeklySlope) < 0.05 kg/Woche` displays `0,0 kg/Woche`; values at or above the threshold are rounded to one decimal using German punctuation, a typographic minus, and normalized negative zero. This rule does not change the shared slope or plotted line. On days without `MealItem`s, the empty calorie ring is omitted; the calorie area shows `Ernährung heute` and `Deine Übersicht erscheint hier, sobald du etwas einträgst.`, without a second add-food CTA because the top search row is the standard add entry point. Macro tracks remain hidden. Entry presence, not calorie total, determines this state, so real zero-calorie entries are treated as logged.

**Home daily nutrition freshness:** `HomeScreen` reloads `GET /api/diary` on every focus and pull-to-refresh. Diary, profile, and weight requests settle independently, so a profile or weight failure cannot discard a successful diary response. A monotonically increasing request id ignores results from an older overlapping load. If the diary request itself fails, the prior snapshot is marked with a retryable error; an initial failed load does not present an empty diary as current data.

**Tab root titles and search placement:** the bottom tab label is the location cue. Home, Nutrition, Recipes (`Rezepte` in the UI), Progress, and Profile do not repeat it as a page-title row or branded logo header. Home and Nutrition start with the same `FoodEntrySearchRow`; Nutrition places its compact date navigation below the search row. The FoodEntryHub uses the safe-area top inset on both screens. Pushed detail/edit flows keep their contextual back/action headers.

**Tab root bottom safe area:** all five main screen roots use `SafeAreaView` with `edges={['top']}`. `RootNavigator` uses the standard, non-absolute bottom tab bar, which already owns the bottom system inset. Applying the bottom inset again in a screen reduces the scroll viewport and leaves a fixed background band above the tab bar; Progress no longer applies that duplicate inset. Home, Diary, RecipeList, Progress, and Profile are guarded together in `HomeScreen.layout.test.ts`. Scroll-content bottom padding is not a fixed obstruction and remains unchanged; system navigation protection stays with the tab navigator.

**Current weekly-card summary layout:** The left header title is `Letzte 7 Tage`; the right side shows one line `Zielerreichung: <Wert>`. Directly below it, only right-aligned consumed/target totals with the visible `kcal` unit remain, without a visible target label and with a small inset from the card edge. The two lower metric rows, including average target per day, are removed. Each day column shows the consumed calorie number without repeating `kcal` above the bar; accessibility labels retain the full units. This supersedes the earlier two-row description.

`HomeScreen` loads the typed weekly review through `aiApi.getWeeklyInsight(referenceDate)` on screen focus and pull-to-refresh. The request runs independently from the daily dashboard, while response, loading, recoverable error, and neutral evaluation state remain separate. `WeeklyReviewCard` renders `Letzte 7 Tage` on the left of the header and one right-aligned line `Zielerreichung: <Wert>` on the right. Directly below, only consumed/target totals with the visible `kcal` unit remain, without a visible target label and with a small inset from the card edge. The two lower metric rows, including average target per day, are removed; seven stable flexible day columns remain without horizontal scrolling. Consumed aggregate colors use the existing `overallTargetPercent`/`getWeeklyTargetBand()` semantics, including valid `0 %`; target values remain neutral. Textual chart headings and the visible included-day count are omitted. Each bar is an accessible trigger for the existing `InfoOverlay`; the bar itself has no navigation or mutation, and only `Tagebuch öffnen` navigates through `Nutrition -> DiaryMain({ date })`. The visible grid keeps the header period, daily calorie value, percentage, and weekday; daily calorie values omit the repeated `kcal` unit while accessibility labels retain full units. Missing values use a neutral diagonal SVG hatch without height semantics; a valid `0 kcal` MealItem remains a solid bar. Training and special activities retain their compact markers and the special-activity frame. The AI evaluation remains measured unbounded and invisibly at the real container width and exposes `Mehr anzeigen`/`Weniger anzeigen` only when text actually overflows. Route dates remain defensively validated and are consumed once through the existing DiaryScreen lifecycle.

Mobile date-only flows use `mobile/src/shared/date/localDate.ts` as their local calendar boundary. `getLocalDateContext()` provides the current local date together with a validated `currentHour` (`number | null`), and `addLocalDays()` performs calendar-day arithmetic without UTC rollover or DST-sensitive elapsed-time arithmetic. The Home dashboard, Diary reads and navigation, DayType writes, and weight-history/relation windows use this context. Diary reads send the requested `date` separately from the current local `localDate` and optional `localHour`. Activity-input labels, copy-item date strips, recipe logging, and FoodEntryHub defaults use `getLocalIsoDate()` and `addLocalDays()` for local date-only values; technical timestamps remain UTC ISO instants.
Home actions that open or mutate current-day data resolve the local date again when the action executes; explicit historical Diary routes remain unchanged. Progress date-only labels use calendar-day differences instead of elapsed millisecond durations.

`RecipeDetailScreen` keeps recipe scaling local to the screen. `targetPortions` is temporary and starts at the saved recipe value; the saved `Recipe`, its nutrition, and the independent diary logging flow are never replaced by the preview. Ingredients are projected synchronously with the shared pure `scaleRecipeIngredients()` function. Text preview requests use a roughly 400 ms debounce, an `AbortController`, and a monotone revision plus recipe `id`/`updatedAt` guard. Reset to the original portions, recipe reload, and unmount invalidate timers and requests. While debounce or loading is active, the old description and steps are hidden; a single atomic text state either accepts the complete response or restores the original texts on error.

The weekly day overlay also renders a compact calorie comparison from the response-provided consumed calories, effective target, and target percentage. It keeps the absolute protein, carbohydrate, and fat values separate and never invents historical macro targets. Day type and workout type are separate context values; special-activity and bonus details remain visible when supplied, while a missing workout type on a training day is shown neutrally as `Nicht verfügbar`.
The weekly day overlay also renders a compact calorie comparison from the response-provided consumed calories, effective target, and target percentage. It keeps the absolute protein, carbohydrate, and fat values separate and never invents historical macro targets. Special-activity and training details are rendered as ordered label/value groups only for `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel`, and `Sonderaktivität` for special-activity context (`Aktivität` only when training is present without a special activity); `Tagestyp`, `Workout-Typ`, and `Datenstatus` are removed from visible and accessibility-relevant detail groups. Missing values use `Nicht verfügbar` and valid zeroes remain visible. If a refresh fails while a review is retained, the card keeps the review visible and exposes `Aktualisierung fehlgeschlagen` with the existing retry callback; without a review, the existing full error state remains.

The rendered weekly grid follows `bars -> weekday -> marker area -> marker legend -> color legend`; the marker legend appears only when at least one special activity is present and is reduced to one deduplicated `Sonderaktivität` entry. Day containers and marker cells are seven stable flexible cells below the weekday labels and marker cells are separate from `barTrack`. `mobile/src/modules/home/homeTrainingPresentation.ts` is the shared Home catalog for `WorkoutTypePicker`, `CoachingHeroCard`, and known weekly training markers: `rest`/`Ruhetag`/`sleep`, `gym`/`Gym`/`weight-lifter`, `bouldering`/`Bouldern / Klettern`/`human-handsup`, `running`/`Laufen`/`run`, `cycling`/`Radfahren`/`bike`, and `other`/`Sonstiges`/`dots-horizontal`. A missing or unknown workout value uses a neutral generic `Training` marker; a rest day without a special activity has no marker. Special-activity markers use `Radtour` for `cycling`, `Wanderung` for `hiking`, and neutral `Sonderaktivität` for unknown activity values. Training `cycling` therefore remains distinct from special-activity `Radtour` by label and marker kind; special-activity icons use `colors.chart.specialActivityOutline`, while training markers and weekday labels remain neutral. A training marker followed by a special-activity marker is rendered in that order, and both remain visible when combined. No concrete date is rendered below the bars; the date-only value is reserved for the day-detail overlay. Markers are monochrome decorative elements apart from the purple special-activity accent and do not create their own TalkBack action targets. The full color legend remains `Im Ziel`, `Nicht im Ziel`, and `Keine Daten`, vertically centered with controlled responsive wrapping.

The Home picker, coaching card, and training markers render catalog icons in a neutral monochrome color. `colors.chart.specialActivityOutline` (`#C4A1FF`) is used for special-activity marker icons and their legend entry, not for training markers, weekday labels, bar fills, or column outlines. `colors.chart.average` remains unchanged (`#8FA9CB`).

**Progress screen:** `ProgressHeroCard` shows the latest non-future measurement once, in kg, with `Heute`, `Vor 1 Tag`, or `Vor 2 Tagen`; the first two labels use the positive color, the two-day label uses the warning color, and from day three onward the date is shown neutrally. The summary has no `Tagesmessungen` or ordinal labels and no add-multiple controls. If today has no measurement, the kg-only `WeightEntryForm` appears inline. The accessible calendar icon opens a closed-by-default monthly calendar sheet. Selecting a date closes the calendar and opens a compact editor sheet that reuses the same `WeightEntryForm`; an existing entry is prefilled and updated by its exact ID, while an empty date is created through `POST /api/weights` with the selected date. The editor uses `KeyboardAvoidingView` (`height` on Android, `padding` on iOS) and a bounded scroll area so it stays above the software keyboard. Future dates are rejected both at selection and immediately before saving. `HistoryList` always receives every entry, including today's and the entry being edited, so the summary never hides a history row; history averages and counts continue to use every record. Tapping a history row opens its editor; swiping left starts deletion through the existing `ConfirmSheet`, with no edit/delete icons in the rows. The comparison below the entry area presents the rolling seven-calendar-day mean and the most recently completed Monday–Sunday mean in centered columns; the right-aligned change column pairs a directional arrow closely with `−`, `+` or `=` before its value, with vertical dividers between all three columns. Dates, counts and the written interpretation remain accessible. If the comparison is unavailable, Progress uses the seven-calendar-day regression fallback when at least two distinct dates exist. Goal progress is integrated into the same card. Both cards use standard surface/border/radius tokens and the screen's single 16-dp horizontal gutter. Writes use the returned `WeightEntry` and `healthSyncService.syncWeightUpsert`; failed updates preserve the entry and editor input and do not sync. Deletion continues to use `ConfirmSheet`.

**Progress chart windows:** `7T` is the initial selection alongside `30T`, `90T` and `Alle`. `getProgressEntriesInWindow` filters exactly the selected number of local calendar dates, including today and excluding future dates; `Alle` retains full history. The chart-header shows only the selected-window mean at the right of the period controls, with the selected period in its accessibility label. The blue line follows 7/30/90 calendar days and uses 90 days for `Alle`; its legend calls it a rolling average and uses three short dash segments. When a goal weight is available, Progress passes it to `WeightChart` in every range; the y-axis includes the goal and the chart shows its dashed target line, kg badge, and `Ziel` legend entry. The chart has no heading; its four 48-dp period controls sit directly above it. Existing fewer-than-two-measurements empty states remain. These additive chart props default to the previous behavior for other consumers; its seven-measurement moving average is unchanged.

**Progress goal placement:** Goal progress is integrated into the primary weight summary card and shown only when a valid directional goal is available. The goal section and the chart-period average are calculated independently.

**Progress day calendar and editor:** `ProgressScreen` opens a Monday-first monthly `ProgressCalendar` from an accessible calendar icon in a modal sheet; it is closed by default and supports close action, backdrop and platform back dismissal. Local date-only arithmetic keeps the calendar stable across time zones and DST. Days with any entry show a marker without announcing a measurement count; past and adjacent-month dates through today are selectable, while future dates and future-month navigation are disabled. Selecting a date closes the calendar and opens the editor sheet. If that date has an entry, the sheet pre-fills the latest matching kg entry and saves with `PUT /api/weights/{id}`; if it is empty, it creates the entry with `POST /api/weights` and the selected `date`. The same `WeightEntryForm` component powers this sheet and the inline today form. Edits from `HistoryList` open the same sheet and preserve exact-ID updates; HistoryList rows are never filtered out, and accessible labels do not use per-day ordinals. The screen rejects future dates both in the calendar callback and immediately before saving, and defensively updates an entry already present for the selected date instead of posting a duplicate. Progress accepts kg edits only and does not convert non-kg entries. Successful mutations replace or append the returned `WeightEntry` and call `healthSyncService.syncWeightUpsert`; failed updates preserve the entry and input and do not sync. Health Connect upserts the existing `clientRecordId` for edits. `weightsService.updateWeight` uses the shared `apiClient`, URL-encodes the entry ID, and returns the typed response. Focused coverage lives in `ProgressScreen.test.tsx`, `ProgressCalendar.test.tsx`, `ProgressHeroCard.test.ts`, `progressUtils.test.ts`, and `weightsService.test.ts`.

## Authentication (Mobile Side)

Uses `expo-auth-session` for PKCE OAuth2 flow against Entra CIAM.

- `authConfig.ts` — OIDC discovery URL, token endpoint, scopes (constructed from env vars)
- `authService.ts` — stores tokens in `expo-secure-store`; implements `isTokenExpired()` (client-side decode only, backend re-validates); `refreshAccessToken()` hits CIAM token endpoint

See [tech/05-authentication.md](05-authentication.md) for full flow.

## Key Feature Modules

### Health Connect Synchronization (HC-4)

`healthSyncService` and `nutritionSyncService` reconcile the authenticated
FitTrack weight and meal data with Health Connect. Activation and manual
re-export use the existing full-list APIs; foreground runs use the authenticated
weight and paginated meal delta APIs. The AppState listener starts a foreground
run on authentication and when the app becomes active. There is no background
worker or timer.

Each datatype stores control state only in its own AsyncStorage key:
`hc:weight:sync` and `hc:nutrition:sync`. The allowed fields are `enabled`,
`pendingDeleteIds`, and optional `userId`, `watermark`, and
`lastForegroundAttemptAt`; no weight or meal snapshots are queued locally.
Both timestamps must be canonical UTC `Date.toISOString()` values. Invalid or
unrecognized state, including numeric epoch values and legacy snapshot queues,
is removed and reset to disabled without sending records. Every run and write
requires the authenticated user ID to match the stored binding; a mismatch
stops synchronization and discards that datatype's stored state. A missing
authenticated user stops synchronization. `pendingDeleteIds` contains only
Health Connect client record IDs, never record payloads. IDs remain pending
when a Health Connect delete fails and are removed after a successful delete.
Deactivation preserves the watermark and pending IDs; account deletion resets
both datatype keys.

Before every Health Connect upsert or delete, Mobile verifies that sync is
enabled, the current authenticated user ID matches the stored binding, and the
current write permission is granted. Delta watermarks advance only after every
page and corresponding write/delete succeeds. Failed deletes retain their IDs.
Successful diary mutations trigger `nutritionDiaryService` fire-and-forget;
recipe logging triggers only after `recipeApi.log` succeeds. Successful weight
create, update, and delete mutations trigger their corresponding weight sync.
Each datatype's foreground attempt time is persisted as a canonical UTC ISO
string before its delta flow starts. A missing timestamp permits the first run;
a stored timestamp is loaded after app restart and suppresses another attempt
until at least 15 minutes have elapsed. Failed attempts count. Weight and
nutrition throttle independently because they use separate persisted states.
Mutation triggers and activation/manual full exports are not throttled and do
not change `lastForegroundAttemptAt`. The colocated sync-service tests cover
the boundary just below, exactly at, and just above 15 minutes, cold-start
throttling after a failed attempt, independent datatype throttles, and these
unthrottled trigger paths.

`HealthConnectScreen` presents the aggregate F1 status in a shared details
sheet, with separate `Gewicht` and `Ernährung` sections. The PO-approved status
allowlist is exactly `enabled`, `permissionRevoked`, `pendingDeleteCount`, and
optional `lastSuccessfulSyncAt`; a false `permissionRevoked` value is shown as
`Nicht als entzogen gemeldet`, not as confirmed permission. The aggregate view
gets `lastSuccessfulSyncAt` from the stored watermark; it does not persist a
separate run timestamp. The aggregate view does not synthesize global
in-progress or failed states and does not show per-entry badges, queue-entry
errors, raw error details, stacks, or emojis. Loading and feedback remain
scoped to the manual action that caused them.

### Nutrition Module (`modules/nutrition/`)

- `DiaryScreen.tsx` — daily diary view with meal cards and hint display
- Current-day Home and diary macro views use the selected profile day's `macroRanges` for protein and carbohydrates. The diary selects `restDay` or `trainingDay` from the response's `dayType`; if profile targets have not hydrated, it loads them from the profile API. The Home protein hint compares consumption with `proteinG.minG` and appears only when more than 20 g remain. Activity bonuses affect calorie targets only.
- Historical diary views do not receive current profile targets: the diary response has no historical macro-target snapshot, so protein and carbohydrate consumption remain visible without an implied goal.
- `hub/` — FoodEntryHub (bottom sheet workspace for food entry)
- `MealParserReviewScreen.tsx` — review AI-parsed meal text before saving
- `FoodEstimateReviewScreen.tsx` — review/edit AI food estimates
- `LabelScanReviewScreen.tsx` — review OCR + AI extracted nutrition label
- `MealEstimateReviewScreen.tsx` — review AI meal image estimate
- `AddItemModal.tsx` — [legacy, being superseded by FoodEntryHub]
- `ProductEditor.tsx` — edit reusable item details
- `EditItemSheet.tsx`, `CopyItemSheet.tsx`, `MoveItemSheet.tsx` — item management sheets

The diary and its copy/move sheets render meal names from the typed `MealType`
using the shared German label catalog. They do not display `Meal.name`, which
may contain an English API default.

The diary's multi-selection mode is local to `DiaryScreen` and scoped to the
displayed date. Selection references combine `mealId` and `itemId`; meal
checkboxes derive none/partial/all from their current items, empty meals cannot
be selected, and refresh keeps only references that still exist. Cancel and
date changes clear the mode. A long press on an item starts selection with
that item selected immediately and light haptic feedback. The filled meal
options sheet offers `Einträge auswählen` as an explicit entry point with an
empty selection; the diary header shows `Abbrechen` only while selection mode
is active. A normal item tap still opens its edit sheet. Delete, Move, and
Copy each send one typed bulk request for the complete selection; Delete uses
one confirmation. Explicitly
dismissing that confirmation or backing out of Move/Copy also clears the mode
and selected references. Move reuses
`MoveItemSheet` for an existing same-day meal or an in-transaction new meal,
and a single-item Move sends the same request with one reference. Copy reuses
`CopyItemSheet` for the source date as an explicit Same-Day target or any other
selected date and one explicitly selected target meal. The source date is
offered independently of the rolling date-strip range, and selecting it loads
that exact day. The source Meal itself and other existing same-day Meals remain
selectable; a new meal is passed as `newMealType` and created atomically with
the copies. Exactly one target selector is sent. A single-item Copy sends the
same snapshot-copy request with one reference. After a successful
mutation, the screen reloads the displayed source day and ends selection mode.
On failure, Mobile maps the API error to a German message, reloads the source
day, and keeps still-valid references selected; a failed request is not an
explicit cancellation. Health Connect sync starts
only after a successful mutation: Delete removes returned IDs, Move removes
old IDs and upserts new target IDs, and Copy upserts only copied IDs from the
returned target meal. Mobile does not write Food Usage; Delete and Move leave
existing usage history and source counters unchanged, while copy tracking is
owned by the server-side PO-3 flow.

See [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) for Hub architecture.

In recipe-ingredient context the same hub is opened as an ingredient picker. `useFoodEntryHubStore` carries `purpose: 'recipeIngredient'`, optional initial query/prefilled amount, and ingredient callbacks; successful product selection or explicit single-food AI estimation returns to `RecipeWizardScreen` instead of adding a diary item.

### Recipes Module (`modules/recipes/`)

- `RecipeListScreen.tsx` — recipe overview
- The own/Community selector is a flat tab row with `colors.primaryBright` active text and underline. Recipe creation uses an inline plus action in the first own-list heading or a labeled primary action in the empty state; there is no floating action button.
- Community cards expose the favorite action only; copying is available from a foreign community recipe's detail page through the authenticated bodyless `POST /api/community-recipes/{id}/copy`. The copy action is hidden for own community recipes; both `200` and `201` open the returned owner recipe ID without reloading the source. Community list and detail show only numeric current `totalTimeMinutes`; missing or `null` values have no time row.
- `RecipeDetailScreen.tsx` — recipe detail, temporary portion scaling, diary logging, crop-consistent image display
- `RecipeWizardScreen.tsx` — single create/edit wizard; replaces the removed `RecipeCreateScreen`
- `RecipeWizardInputPhase.tsx`, `RecipeWizardIngredientsPhase.tsx`, `RecipeWizardStepsPhase.tsx`, `RecipeWizardPreviewPhase.tsx` — phase views controlled by `RecipeWizardScreen`
- `recipeWizardImageMutations.ts` — client-side sequencing for image delete/upload/reorder after recipe save

When an Instagram/detail share preview fails, `RecipeDetailScreen` logs the
render stage, error message/stack, and available Axios HTTP/API error fields to
Metro before showing the generic retry notice. It does not log Axios request
configuration or authorization headers.

`RecipeCreateScreen` and the `RecipeCreate` navigation route are removed. New recipe creation and existing recipe editing both use `RecipeWizardScreen`; edit mode is selected by passing `editId`.

#### Share-triggered recipe export review [US-10 F-1/F-2/F-3]

The ordinary Create/Edit wizard preview contains recipe fields, ingredients,
and steps only; it has no export tab, export inputs, or export-confirm action.
Normal recipe create/update requests omit `exportViewAction` and `exportView`,
so an ordinary edit preserves an existing confirmed export view.

For a new recipe, `RecipeWizardScreen` carries the analyzer suggestion to
`RecipeDetailScreen` as a serializable, unconfirmed local draft. It contains
the teaser, nullable time and difficulty, ordered export steps, and only
ingredient IDs uniquely resolved to user-confirmed, non-seasoning ingredients.
It contains no AI `analysisKey`, candidates, resolution state, or client
fingerprint and is not sent as a confirmed view when the recipe is created.

Tapping `Teilen` starts a guarded preparation before the paired preview opens.
Mobile chooses, in order: an existing confirmed
`exportView` whether `current` or `stale`; an unconfirmed export draft already
held locally from new-recipe analysis or an earlier V2 preparation while the
detail screen remains mounted; or one call to
`POST /api/recipes/{id}/export-view/prepare` when neither is available.
Duplicate taps do not start duplicate preparation requests. Reopening Share
while the detail screen remains mounted reuses its pending draft.

Preparation sends exactly `{ "contractVersion": 2 }`. Mobile does not send an
`If-Match` header or require/compare `sourceEtag`; the response is transient
export text and does not map AI keys or names to saved ingredient IDs. Show
`Exportvorschau wird vorbereitet.` when no provider call is needed. Show the
AI-specific notice only while a provider call is in progress:

> Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide Bilder checken und die Texte noch anpassen.

The Share preview shows both 1080:1350 PNGs side by side: Instagram and recipe
details render together and remain visible while the user reviews the pair.
Sharing is offered only when the recipe has a stored image. The entry callback
also checks that prerequisite before preparation or rendering. A backend
`NO_RECIPE_IMAGE` response closes the share preview and shows `Rezeptfoto fehlt`
with `Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.`;
there is no render-retry action. The local image list is cleared to reflect
the server response, so sharing stays hidden until a refreshed recipe has a photo.

Each rendered thumbnail opens a full-screen, safe-area-aware image viewer.
The selected PNG is shown proportionally without cropping; the native horizontal
paging ScrollView supports swiping between the two images, with a page counter
and accessible previous/next controls. A single image has no paging controls.
Closing or Android Back returns to the paired preview. The viewer's
`Optionen & Texte bearbeiten` CTA opens the existing unified editor without a
save, render, or AI call. Thumbnails remain disabled during rendering or saving.
Image rendering has its own spinner state, separate from preparation: empty
previews show `Vorschau wird erstellt…`; existing images show
`Wird gerendert…` or `Wird aktualisiert…` during a render. The first paired
render starts as soon as a draft is available; it uses request-only data and
does not require prior text confirmation or write the recipe. When both images
are ready, show this review hint below the pair:

> Check beide Bilder kurz durch. Texte, Ausschnitt und Tags kannst du jederzeit anpassen.

The dialog is titled `Rezept teilen` in the paired view and `Bilder anpassen`
in the editor. The paired view shows both images on one shared card with
captions; its actions are the secondary `Optionen & Texte bearbeiten` and the
primary `Speichern & teilen`. `Ausschnitt anpassen` is not a paired-view
action; it exists only in the editor under `Titelbild`.

One `Optionen & Texte bearbeiten` action opens a unified editor in that same
dialog. A compact `Titelbild` / `Detailbild` selector shows only the selected
PNG (centered on a stage card) and only its fields; both images stay mounted
and the unselected one is hidden, so the detail image renders reliably after a
refresh. `Titelbild` contains `Ausschnitt anpassen`, preparation
time, difficulty, tags, and highlight; `Detailbild` contains the teaser,
optional ingredient selection, and export steps. Teaser and export steps show
remaining characters against their 96 and 90 character limits. There is no
separate options sheet or pre-render text-confirmation action. The editor has a
single action, `Vorschau aktualisieren`: when export fields are new or changed
and valid for saving, it first saves them and then renders again; otherwise it
only renders. On success the dialog returns to the paired view; if saving
fails the editor stays open. Leaving the editor with the back arrow without
refreshing marks the preview as outdated after text, tag, or highlight
changes: the paired view shows a hint and `Speichern & teilen` stays disabled
until the next refresh. A transient analyzer/preparation
draft is sent only as request data for each bundle render that uses it. The optional
top-level `exportViewDraft` property uses the shared
`RecipeShareBundleExportDraft` type; it does not persist recipe data, invoke AI
or consume quota, and does not change the atomic paired PNG response. When the
property is omitted, Backend uses the stored confirmed view whether its status
is `current` or `stale`. The ingredient chooser appears only when the recipe
has more than 20 ingredients; at 20 or fewer, current included IDs remain
unchanged without switches. Nullable preparation metadata stays blank and is
renderable as `null`; the existing `exportViewAction: 'confirm'` plus
`exportView` PUT pair requires valid non-null metadata and is sent only when
`Vorschau aktualisieren` runs and export fields are new or changed. A stale
status alone does not cause a PUT: if the export fields are unchanged,
refreshing sends no PUT. A successful save triggers a fresh paired render.
Presentation-only changes and transient preview/share never write recipe data.
The server-owned fingerprint is never sent by Mobile, and
export text never replaces the ordinary recipe description or steps. A
`recipe_revision_conflict` reloads the recipe for review without automatic
merge or retry. A defensive `MISSING_EXPORT_VIEW` is recovered inside Share,
not by returning to the wizard. The existing tag, highlight, crop, paired
image, media-library, and native-share flow remains in place.

#### Recipe images: camera, gallery and Hero-Crop

The recipe wizard offers a FitTrack-owned source picker through
`RecipeImageSourcePicker`:

- **Camera:** Uses the existing `expo-camera` `CameraView` integration. The
    preview shows a responsive `1080:1015` frame, dims the area outside the
    frame, accounts for top and bottom safe-area insets, and displays the hint
    `Motiv im Rahmen platzieren`.
- **Gallery:** Uses `expo-image-picker` with `allowsEditing: false`. The
    selected image is handed over without a system `4:3` crop. The picker uses a
    normal JPEG quality setting, but does not create a spatially cropped Hero
    file.

Both sources enter the same `RecipeImageHeroCropEditor`. The editor keeps the
    source URI and lets the user move the image with one-finger pan and change
    the zoom with pinch. The minimum scale fully covers the frame and panning is
    clamped so that no empty space appears. Only normalized presentation
    metadata is produced; the editor neither rewrites image bytes nor creates a
    second Blob. The lower part of the frame contains a non-destructive
    `Titel- und Tag-Zone` Safe-Area hint for the renderer's text area. It is a
    visual aid only and is not persisted as a separate value.

The shared image contract is closed and versioned:

```ts
interface RecipeImageHeroCrop {
    version: 1;
    frame: 'instagram-recipe-v1';
    focusX: number;
    focusY: number;
    zoom: number;
}
```

`focusX` and `focusY` are finite normalized coordinates in `[0, 1]` on the
visually oriented source image. `zoom` is finite and at least `1`. The
`instagram-recipe-v1` frame describes the `1080 x 1015` photo/hero area of the
existing renderer. It is not the complete share image: the Instagram output
remains exactly `1080 x 1350` PNG. The older `1080 x 880` reference is not a
runtime contract because it ends before the renderer's tag zone.

Legacy images without `heroCrop` use the same central effective default on
Mobile and Backend:

```ts
{
    version: 1,
    frame: 'instagram-recipe-v1',
    focusX: 0.5,
    focusY: 0.46,
    zoom: 1,
}
```

The default is applied when an existing recipe is mapped into wizard state and
when images are rendered. A saved crop is loaded again when an existing image
is reopened in the editor. The wizard draft stores `uri`, MIME type and
`heroCrop`; the edit bootstrap, preview thumbnails, `RecipeDetailScreen` and
`RecipeListScreen` use the same crop-aware image presentation. Delete and
reorder continue through the existing image mutation sequence, so remaining
images retain their metadata and a deleted image loses it with the image.

The Mobile API client mirrors the Backend contract:

- `POST /api/recipes/{id}/images` sends the image plus optional `heroCrop` as
    a JSON multipart field. The Backend validates the closed version/frame,
    finite focus values, normalized range and `zoom >= 1` before storing one
    user-scoped image Blob.
- `PUT /api/recipes/{id}/images/{imageId}/hero-crop` updates only metadata for
    an existing image of the authenticated user's recipe. It returns the
    confirmed `RecipeImage` and a fresh read-only URL; it never rewrites the
    Blob.
- The saved/effective crop is the Instagram renderer default. Individual
    request presentation fields may override only their own values; omitted
    fields continue to come from the saved crop or the central legacy default.
    Backend EXIF orientation is normalized in memory, while Mobile coordinates
    continue to refer to the visually oriented source image.

#### Instagram share draft and local media handoff [F-1/F-2/F-3]

The Mobile API client retains the transient
`POST /api/recipes/{id}/instagram-render` wrapper, but the production US-10
share flow uses `POST /api/recipes/{id}/share-bundle`. Its request sends the
selected image ID when available, saved tags and the explicit
`'high-protein' | null` highlight; it does not send a client recipe-metadata
copy. The initial bundle omits `presentation`; a confirmed crop adds the
complete normalized presentation. The JSON response contains separate
Instagram and recipe-detail PNG assets.

`recipeShareDraftState.ts` keeps the share draft screen-local and
non-persistent. It selects the crop-editor source from the server-equivalent
primary-image rule (`order`, then image-ID tie-breaker), keeps the effective
stored crop, validates both PNG payloads and dimensions, and creates two
distinct local preview URIs before atomically marking the pair ready. It
aborts superseded renders, ignores responses from older revisions, cleans up
partial or late preview files, and preserves the last complete pair while a
replacement is pending or fails. Pan and pinch do not issue render requests;
each confirmed crop starts one final bundle render, while duplicate submits
during that request are ignored. The legacy single-image API wrapper is not
used by the production share flow.

`services/recipeShareMediaService.ts` provides the F-3 handoff for the
temporary PNG pair, the local media library and the native share sheet. The
production Android path uses `expo-file-system@19.0.24` for distinct temporary
PNG files, `expo-media-library@18.2.1` for permissions and album assets, and
`react-native-share@12.3.1` for the native multi-image chooser. `expo-sharing`
is not used by this flow. The `expo-media-library` config plugin requests photo
access; these native modules and permission settings require a new Android
native build before device verification.

The adapter requests photo read/write access before saving because it looks up
the exact album name `FitTrack` and then creates or adds the asset. On Android
13+, the native build declares `READ_MEDIA_IMAGES` and
`READ_MEDIA_VISUAL_USER_SELECTED` for this lookup; write-only access is
insufficient. `canAskAgain: true` is a retryable denial;
`canAskAgain: false` is a settings-only denial. It creates that album only
after a missing lookup, and never uses names such as `FitTrack (1)` or changes
another album. A newly created asset is
removed best effort on an album/asset failure; if the adapter created the
album too, it removes assigned assets, deletes both newly created assets, and
then attempts to delete that empty album. A failure while saving the second
image therefore rolls back the first image's album assignment as well. In all
failure cases no share sheet is opened and both temporary previews remain
available to the caller for retry.

`createSession(instagramUri, detailUri)` requires two distinct local PNG URIs.
The session memoizes the successful two-asset save, so a canceled or failed
native share can be retried without creating duplicate media. On Android, the
production service calls `openNativeMultiImageShareCandidate`, which validates
the pair and invokes exactly one `Share.open({ urls: [instagramUri, detailUri] })`.
There is no single-image or second-dialog fallback. Failed sharing preserves
both temporary files and the FitTrack album assets; successful sharing or
explicit close cleanup attempts to remove both temporary files. The adapter
does not upload to Google Photos, Instagram or FitTrack persistence.

#### Recipe image permissions and failure states

- Canceling the camera, gallery or editor flow does not create an empty draft.
- While camera permission is being checked, the camera view shows a loading
    state. If permission is denied, the screen explains whether the user can
    retry or must allow access in device settings; `Abbrechen` leaves the wizard
    usable, and the gallery remains available when the source picker is opened
    again.
- A denied gallery permission distinguishes a retryable denial from a setting
    that must be changed in the device settings. Failure to open the gallery or
    an unusable asset shows a German error with `Erneut versuchen` where
    applicable. A canceled gallery result is ignored.
- A failed camera capture can be retried. While the editor image is loading,
    the confirm action is disabled; an unreadable image shows
    `Das Bild konnte nicht geladen werden.` without creating a draft.
- For an existing image, a failed Hero-Crop metadata update keeps the last
    confirmed crop and shows an app-owned error overlay. Upload, delete and
    reorder failures after recipe save are reported by the wizard as photos that
    were not fully saved. The server-side `8 MB` image limit remains in force;
    an oversized upload is rejected rather than silently cropped or partially
    stored.

#### Native configuration and dependencies

`mobile/app.config.js` configures the existing `expo-camera` plugin. Its
permission description explicitly includes recipe photos alongside the
Barcode-Scanner and AI use cases; microphone recording remains disabled. A
change to this native permission configuration has **potential native build
impact**: a new Dev Build may be necessary even though the exact decision is
environment- and release-dependent. The Infrastructure release gate decides
whether a new build is required.

The Android native handoff uses these direct dependencies:

- `react-native-share@12.3.1` — React Native autolinking includes its Android
    FileProvider; `Share.open({ urls })` maps file URLs to `ACTION_SEND_MULTIPLE`.
- `expo-file-system@19.0.24` — writes each bundle PNG to a separate cache file.
- `expo-media-library@18.2.1` — permission request, exact `FitTrack` album
    lookup, asset creation and rollback.

The `expo-media-library` plugin in `mobile/app.config.js` keeps
`granularPermissions: ['photo']` and the German photo/save permission strings.
The generic Android chooser does not need targeted-package queries or the
package's Base64-storage option, so no `react-native-share` config-plugin
options are set. The preflight-only `extra.nativeShareCandidate` public-config
metadata has been removed. `mobile/eas.json` is unchanged: the existing
development and preview profiles already produce Android APKs. Including the
native module and permission manifest requires a fresh Android Dev Build or
Preview Build; no build or device verification is claimed here.

#### Android native multi-image share [US-10 F-3]

The production share session is connected to
`mobile/src/services/nativeShareCandidate.ts`. It accepts exactly two distinct
local `.png` URIs and calls `Share.open({ urls: [instagramUri, detailUri] })`
once per attempt. `react-native-share@12.3.1` implements this Android request
with `ACTION_SEND_MULTIPLE`; a rejected or canceled call is retryable and does
not trigger a second share dialog. The production adapter is Android-gated;
no iOS share path is added.

Automated service tests cover the real singleton-to-candidate call, pair asset
creation, FitTrack rollback, permission denial, retry without duplicate media,
and cleanup of both temporary URIs. These mocked tests are not device evidence.
Android device behavior remains **UNVERIFIED** pending U-1; no full Done or
release claim is made before that gate.

### Profile Module (`modules/profile/`) and Legal Module (`modules/legal/`)

- `ProfileScreen.tsx` — Profil-Hub: one `Profil & Tagesziele` summary card opens `ProfileDetails`; navigation groups below use `ProfileGroup.tsx` (`ProfileGroup` / `ProfileRow`). `Bibliothek`, `Integrationen` and `Rechtliches` render in every state; `Profil einrichten` opens `ProfileWizardScreen` locally.
- `ProfileDetailsScreen.tsx` — read-only profile and target details (route `ProfileDetails`, param `undefined`): header with back and title, content `Alltag & Training`, `Ziel`, `Tagesziele`, and icon-only `Profil bearbeiten` header action. No delete action is rendered here. Reloads on focus so values are current after `ProfileEdit`.
- `ProfileSummaryCards.tsx` — `BasicDataCard` (hub), `LifestyleCard`, `GoalCard`, `TargetsSection` (details) and their label maps.
- Profile target display — the wizard preview and `TargetsSection` show each rest/training day's `macroRanges.proteinG` and `macroRanges.carbsG` as gram ranges. Calories, fat and the existing fiber presentation are unchanged; Mobile does not derive ranges and falls back to scalar protein/carbohydrate values only when `macroRanges` is absent.
- `useProfileData.ts` — loads `GET /api/profile` on focus for hub and details (`status: loading | ready | error`, `profile`, `targets`, `refresh`, `retry`); after a successful first load a failed refresh keeps the data and shows a snackbar.
- `ProfileStateViews.tsx` — `ProfileLoadingState`, `ProfileErrorState`, `ProfileEmptyState` (setup button only when `onSetup` is passed).
- `profileHubGroups.ts` — fixed group order `Bibliothek` → `Integrationen` → `Gemeinsam` → `Rechtliches` via `getProfileHubGroups({ entries })`; empty groups are not rendered. Profile details are opened from the summary card rather than a repeated navigation row. `Gemeinsam` (friends / shared household, working name) is `[Planned]` and has no entries yet.
- `app/navigation/profileTab.ts` — `PROFILE_TAB_ROUTE = 'Profile'` and `PROFILE_TAB_LABEL = 'Profil'`, consumed by `RootNavigator`. The label decision (`Profil` instead of `Mehr`) is documented in [product/02-navigation.md](../product/02-navigation.md#tab-label-profil-entscheidung).
- `ProfileScreen.tsx` — the only entry point for account deletion is the fixed red outlined `Konto löschen` action above the bottom tab bar, shown only after a profile loads. `ProfileDetailsScreen.tsx` and `ProfileEditScreen.tsx` do not render the action. `ProfileDeletionAction.tsx` hosts the existing flow: opening the confirmation checks whether the user has published Community recipes but does not submit a deletion request. The dialog requires the exact uppercase text `DELETE`; the prompt is immediately above the fixed-height confirmation field, whose Android native underline is disabled. The dialog states that data already saved in Health Connect remains unaffected. Cancel, backdrop, and Android Back dismiss without deleting. For published recipes, `Auch meine Community Rezepte löschen` defaults to `Nein` on every open and shows the approved anonymous-author helper. Submission locks controls; on server error the entered confirmation and exact request payload remain available for retry. After `204`, `completeAccountDeletionLocally()` makes one best-effort attempt to remove the wizard preference, both Health Connect queues, the sync diagnostic log, and both SecureStore tokens, while resetting in-memory sync state. It logs out and returns to Login despite partial failures; a detected failure shows one transient notice in the running session. A local failure never repeats `DELETE /api/profile`; there is no durable cleanup marker, startup gate, or local retry. After force-close, a surviving token may authenticate again, and a surviving queue may drain to Health Connect when the app becomes active. Queue operations target Health Connect, not the FitTrack API. Health Connect records and permissions are not removed.
- `LibraryScreen.tsx` — single canonical library entry (hub entry `Favoriten & Eigene Lebensmittel`) with tabs `Favoriten` (`FavoritesView`) and `Eigene Lebensmittel` (`OwnFoodsView`). Shared list state in `useLibraryList.ts`, loading/empty/error states in `LibraryStateView.tsx`. `ownFoodItems.ts` filters out `sourceType: 'openFoodFacts'`, so `Eigene Lebensmittel` contains only self-created items. The former `MyProductsScreen` / `MyProducts` route was removed.
- `LibraryFoodCard.tsx` — shared card container of `FavoritesView` and `OwnFoodsView` (main area, optionally tappable, plus a right 48 pt action button).
- `favoriteFoodSummary.ts` — pure mapping `UserFoodRelation` → `FoodProductSummary` props (`favoriteSummaryProps`) for `FavoritesView`: origin badge, recipe brand fallback, `Rezept nicht verfügbar` for unavailable recipes, `nutritionBasis` fixed to `per100g`. `FavoritesView` has a single action, removing the favorite (heart, `ConfirmSheet`, snackbar on failure); the former `n× verwendet` line is gone. Product-display and favorites UX rules: [product/05-ux-patterns.md](../product/05-ux-patterns.md#favoriten-in-der-bibliothek).
- `shared/components/FoodProductSummary.tsx` — presentational product summary (52 pt thumbnail, name, brand, origin badge, nutrition) used by the Search Hub result row (`SearchState.ResultRow`), `OwnFoodsView` and `FavoritesView`. The thumbnail shows an image only for a loadable remote URL (`isRemoteImageUri`); otherwise, or on load failure, it shows the letter avatar. `ResultRow` sends `imageUrl` to `POST /api/favorites` only for remote URLs, otherwise `null`.
- `modules/healthConnect/HealthConnectScreen.tsx` — Integrationen entry; user-facing copy lives in `healthConnectCopy.ts` and names the target as `Health Connect auf deinem Gerät`.
- `modules/legal/` — `ImprintScreen` / `PrivacyPolicyScreen` (`LegalScreens.tsx`) render native, scrollable in-app text via `LegalDocumentView.tsx`. The text is held in `legalTexts.ts`; the imprint and privacy text outside the account-deletion section match `docs/legal/*.md` (enforced by `legalTexts.test.ts`). The privacy screen uses the approved account-deletion paragraph and best-effort local-device note; the separate Health Connect section is unchanged. `LoginScreen` and `ProfileWizardScreen` (welcome step and preview) show the privacy policy locally via component state (no navigator, no auth required), so it is reachable before the profile is first saved.

**Known limitations / open points:**

- [Open] PO-1 — photos of own foods: the API returns only a blob path (`<userId>/<itemId>.jpg`) in `imageUrl`, not a loadable URL. Search Hub, `Eigene Lebensmittel` and `Favoriten` therefore show the letter avatar. Option C (parity with the Search Hub, avatar fallback) was chosen; there is no backend plan to resolve blob paths.
- `ProfileWizardScreen` still uses `Alert.alert` and emoji/unicode glyphs. This is deliberately out of scope of the profile redesign (R1/R2) and still conflicts with the design-system rule on app-owned dialogs.
- Blob-path `imageUrl` in the Food Entry Hub: investigated and fixed. The own-product blob path (`<userId>/<itemId>.jpg`, see PO-1) reached URL-validating endpoints (`POST /api/favorites`, `POST /api/diary/meals/:id/items`) from `QuantityView` (favorite toggle, add), `FoodEntryHub` direct add (`buildDirectAddItemInput`) and `RelationRow` (favorite toggle, `buildRelationFavoriteInput`). All of them now send `imageUrl` only when `isRemoteImageUri` is true, otherwise `null`. Remaining: the recipe-ingredient product built in `FoodEntryHub` still carries the relation's `imageUrl` unchanged, but the ingredient flow does not send it to an endpoint; `QuantityView` renders `product.imageUrl` as `Image` without the remote-URL check, so a blob path there is not shown as the letter avatar (not changed here).
- Device behaviour of the `ConfirmSheet` inside `LabelScanReviewScreen` (nested modal; edit-save choice `Nur Produkt` / `Produkt + Tagebuch-Einträge`) is only covered by a mocked test — MANUAL VALIDATION REQUIRED on a device.

### Progress Module (`modules/progress/`)

- `ProgressScreen.tsx` — weight trend chart, progress signals
- `WeightDetailScreen.tsx` in `modules/weight/`

## Theme

`mobile/src/app/theme/` — exports design tokens consumed by all components.

[Rule] Never hardcode hex colors, font sizes, or spacing values. Always use theme tokens.

`colors.overlay` (`rgba(0, 0, 0, 0.6)`) is the shared scrim token for modal backdrops; `ConfirmSheet` and `SyncStatusSheet` use it instead of local `rgba` literals.

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

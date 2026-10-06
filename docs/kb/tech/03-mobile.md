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

Mobile date-only flows use `mobile/src/shared/date/localDate.ts` as their local calendar boundary. `getLocalDateContext()` provides the current local date together with a validated `currentHour` (`number | null`), and `addLocalDays()` performs calendar-day arithmetic without UTC rollover or DST-sensitive elapsed-time arithmetic. The Home dashboard, Diary reads and navigation, DayType writes, and weight-history/relation windows use this context. Diary reads send the requested `date` separately from the current local `localDate` and optional `localHour`. Activity-input labels, copy-item date strips, recipe logging, and FoodEntryHub defaults use `getLocalIsoDate()` and `addLocalDays()` for local date-only values; technical timestamps remain UTC ISO instants.
Home actions that open or mutate current-day data resolve the local date again when the action executes; explicit historical Diary routes remain unchanged. Progress date-only labels use calendar-day differences instead of elapsed millisecond durations.

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

> Check beide Bilder kurz durch. Die Texte kannst du jederzeit noch anpassen.

One `Optionen & Texte bearbeiten` action opens a unified editor in that same
preview. `Titelbild` contains `Ausschnitt anpassen`, preparation
time, difficulty, tags, and highlight; `Detailbild` contains the teaser,
optional ingredient selection, and export steps. There is no separate options
sheet or pre-render text-confirmation action. A transient analyzer/preparation
draft is sent only as request data for each bundle render that uses it. The optional
top-level `exportViewDraft` property uses the shared
`RecipeShareBundleExportDraft` type; it does not persist recipe data, invoke AI
or consume quota, and does not change the atomic paired PNG response. When the
property is omitted, Backend uses the stored confirmed view whether its status
is `current` or `stale`. The ingredient chooser appears only when the recipe
has more than 20 ingredients; at 20 or fewer, current included IDs remain
unchanged without switches. Nullable preparation metadata stays blank and is
renderable as `null`; the existing `exportViewAction: 'confirm'` plus
`exportView` PUT pair requires valid non-null metadata and is sent only after
the user presses `Speichern` and export fields are new or changed. A stale
status alone does not cause a PUT: if the export fields are unchanged,
`Speichern` sends no PUT. A successful save triggers a fresh paired render.
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

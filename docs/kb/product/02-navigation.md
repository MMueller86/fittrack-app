# Navigation

## Structure

React Navigation with one `BottomTabNavigator` and per-tab native stacks.

```
RootNavigator (NavigationContainer)
├── Tab: Home
│   └── HomeStack
│       └── HomeMain → HomeScreen
├── Tab: Nutrition
│   └── (NutritionStack — DiaryScreen is the root)
│       ├── DiaryMain → DiaryScreen
│       ├── HikingInput → HikingInputScreen (param: date, existing?)
│       └── CyclingInput → CyclingInputScreen (param: date, existing?)
├── Tab: Recipes
│   └── RecipeStack
│       ├── RecipeList → RecipeListScreen
│       ├── RecipeDetail → RecipeDetailScreen (param: id, transient intent?)
│       └── RecipeWizard → RecipeWizardScreen (param: editId?; create or edit)
├── Tab: Progress
│   └── (ProgressStack)
│       └── ProgressMain → ProgressScreen
└── Tab: Profile
    └── ProfileStack
        ├── ProfileMain → ProfileScreen
        ├── ProfileEdit → ProfileEditScreen (param: profile)
        ├── MyProducts → MyProductsScreen
        ├── Library → LibraryScreen
        └── HealthConnect → HealthConnectScreen

Modals (overlaid on top):
├── ProfileWizardScreen — shown on first launch (no SKIP_WIZARD_KEY in AsyncStorage)
└── FoodEntryHub — BottomSheetModal, open from any screen via useFoodEntryHubStore
```

## Navigation Theme

The `NavigationContainer` uses a custom dark theme derived from `DarkTheme`:

```ts
background → colors.background   (#0B0F0C)
card       → colors.surface      (#141A15)
text       → colors.text         (#F2F4F1)
border     → colors.border       (#2A352C)
primary    → colors.primary      (#67B23E)
```

## Tab Icons

Custom SVG icons in `mobile/src/assets/icons/TabIcons.tsx`:
- `HomeIcon`, `NutritionIcon`, `RecipesIcon`, `ProfileIcon`, `ProgressIcon`

Active tab icon uses `colors.primaryBright` (`#8FD157`). Inactive uses `colors.textMuted`.

## FoodEntryHub — Global Entry Point

The `FoodEntryHub` is a `BottomSheetModal` that can be opened from any screen.

Opening from code:
```ts
const { open } = useFoodEntryHubStore();
open({
  mealId?: string,    // if known (from diary meal button)
  date?: string,      // default: today
  mealType?: MealType, // default: time-based suggestion
  onSuccess?: () => void,
  autoFocusSearch?: boolean,
});
```

The hub must be mounted in the root navigation tree so it overlays any tab.

In recipe-ingredient mode the hub is opened with `purpose: 'recipeIngredient'` or ingredient callbacks. This keeps the hub as an overlay while disabling diary mutations and returning the selected product or explicit single-food AI estimate to `RecipeWizardScreen`.

### Wochenrückblick auf HomeMain

`HomeScreen` rendert die `WeeklyReviewCard` unmittelbar nach `DayNutritionCard`. Die Karte bleibt Teil des bestehenden Home-Scroll-Inhalts und erzeugt keine neue Route. Sie zeigt sieben feste Spalten im verfügbaren Viewport ohne horizontales Scrollen; jeder Balken ist ein zugänglicher Trigger für das bestehende `InfoOverlay` und öffnet zuerst ausschließlich informative Tagesdetails. Nur die sekundäre Aktion `Tagebuch öffnen` im Overlay navigiert über den Root-Tab nach `Nutrition -> DiaryMain({ date })`; der Balken selbst navigiert nicht, bearbeitet keine Daten und löst keine Mutation oder FoodEntryHub-Aktion aus. Nur der Kartenfehlerzustand bietet die bestehende Retry-Aktion zum erneuten Laden an.

Der Wochenrequest wird beim Fokus des Home-Screens und bei Pull-to-Refresh ausgelöst. Sein lokales Referenzdatum dient nur dem Wochenvertrag; die Darstellung selbst verändert keine Navigation und ersetzt keine Tages-, Aktivitäts- oder Food-Entry-Flows.

## First Launch Flow

```
App starts
  → RootNavigator checks AsyncStorage for SKIP_WIZARD_KEY
  → Not found → ProfileWizardScreen shown as modal
  → User completes wizard → POST /api/profile → SKIP_WIZARD_KEY set
  → User skips → SKIP_WIZARD_KEY set (skip permanently)
  → Next launch → go directly to bottom tabs
```

### ProfileWizardScreen — 6 Steps

| Step | Content |
|---|---|
| 0 | Welcome — dismiss option (skips wizard permanently) |
| 1 | Basisdaten (age, height, weight, target weight) |
| 2 | Alltag (steps or activity level; "Kenne ich nicht" shows activity picker) |
| 3 | Training (frequency, duration, sports) |
| 4 | Ziel (goal type + intensity) |
| 5 | Vorschau — calculated targets with inline tooltips (BMR, PAL, goal adjustment) |

Navigation: swipe left/right (PanResponder) + Cancel (X) on steps 1–4 with confirmation dialog. No data is persisted until step 5 is confirmed. Weight field pre-filled from last 7 diary entries (new profiles only).

## Navigation Parameter Types

```ts
HomeStackParamList = {
  HomeMain: undefined;
  HikingInput: { date: string; existing?: SpecialActivity };
  CyclingInput: { date: string; existing?: SpecialActivity };
}

NutritionStackParamList = {
  DiaryMain: { date?: string } | undefined;
  HikingInput: { date: string; existing?: SpecialActivity };
  CyclingInput: { date: string; existing?: SpecialActivity };
}

ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: { profile: UserProfile | null };
  MyProducts: undefined;
  Library: undefined;
  HealthConnect: undefined;
}

RecipeStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: string; intent?: 'openLogRecipeModal' };
  RecipeWizard: { editId?: string } | undefined;
}

RootTabParamList = {
  Home: undefined;
  Nutrition: NavigatorScreenParams<NutritionStackParamList> | undefined;
  Recipes: undefined;
  Weight: undefined;
  Profile: undefined;
}
```

### Recipe Create/Edit and transient logging intent

For both recipe creation and editing, `RecipeWizardScreen` saves the recipe and then replaces the wizard with `RecipeDetail`, passing `{ id, intent: 'openLogRecipeModal' }`. Normal navigation from the recipe list passes only `{ id }`.

`RecipeDetailScreen` loads the recipe first. Once the recipe is available, it consumes the transient intent once via a ref, clears the route parameter with `navigation.setParams({ intent: undefined })`, and opens `LogRecipeModal`. Focus refreshes and later returns to the detail screen therefore cannot open the modal again. After successful logging, the modal closes and the detail view reloads.

## Weight Screen

The bottom tab route is named `Weight` and renders `ProgressScreen`; the visible tab label is `Progress`.

## Related Documents

- [product/04-food-entry-hub.md](04-food-entry-hub.md) — Hub state machine and UX
- [tech/03-mobile.md](../tech/03-mobile.md) — mobile app module structure

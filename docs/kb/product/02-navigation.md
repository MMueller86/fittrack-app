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
│       └── DiaryMain → DiaryScreen
├── Tab: Recipes
│   └── RecipeStack
│       ├── RecipeList → RecipeListScreen
│       ├── RecipeDetail → RecipeDetailScreen (param: id)
│       ├── RecipeCreate → RecipeCreateScreen (param: editId?)
│       └── RecipeWizard → RecipeWizardScreen
├── Tab: Progress
│   └── (ProgressStack)
│       └── ProgressMain → ProgressScreen
└── Tab: Profile
    └── ProfileStack
        ├── ProfileMain → ProfileScreen
        ├── ProfileEdit → ProfileEditScreen (param: profile)
        ├── MyProducts → MyProductsScreen
        └── Library → LibraryScreen

Modals (overlaid on top):
├── ProfileWizardScreen — shown on first launch (no SKIP_WIZARD_KEY in AsyncStorage)
├── FoodEntryHub — BottomSheetModal, open from any screen via useFoodEntryHubStore
├── BarcodeScannerScreen — full-screen camera, navigated from FoodEntryHub
└── WeightDetailScreen — accessible from Home or Progress
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
HomeStackParamList = { HomeMain: undefined }

ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: { profile: UserProfile | null };
  MyProducts: undefined;
  Library: undefined;
}

RecipeStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: string };
  RecipeCreate: { editId?: string };
  RecipeWizard: undefined;
}

RootTabParamList = {
  Home: undefined;
  Nutrition: undefined;
  Recipes: undefined;
  Progress: undefined;
  Profile: undefined;
}
```

## Weight Screen

`WeightDetailScreen` is accessible from the Home screen (not a dedicated tab). This follows the product decision from `docs/screen_flows.md`.

## Related Documents

- [product/04-food-entry-hub.md](04-food-entry-hub.md) — Hub state machine and UX
- [tech/03-mobile.md](../tech/03-mobile.md) — mobile app module structure

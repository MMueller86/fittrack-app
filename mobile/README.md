# mobile/

Expo bare React Native app for FitTrack. Android-first, iOS compatible.

## Structure

```
src/
├── app/
│   ├── App.tsx          Root component + auth gate
│   ├── navigation/      Bottom tabs (Home|Nutrition|Recipes|Profile) + stack navigators
│   └── theme/           Colors, typography, spacing tokens
├── modules/
│   ├── auth/            LoginScreen, auth state (Zustand)
│   ├── onboarding/      Multi-step wizard (collected in M2)
│   ├── home/            HomeScreen — macro progress bars/cards + today summary
│   ├── weight/          WeightDetailScreen (pushed from Home, not a tab)
│   ├── nutrition/       DiaryScreen, MealDetailScreen, AddItemSheet (3 modes)
│   ├── recipes/         RecipeListScreen, RecipeDetailScreen, RecipeFormScreen
│   └── profile/         ProfileScreen
├── shared/
│   ├── api/             Axios client + JWT interceptor (auto-refresh on 401)
│   └── components/      Shared UI primitives + AI preview bottom sheet
└── services/
    ├── authService.ts   SecureStore, token lifecycle
    └── imageService.ts  Image picker + POST to backend (no Blob credentials on device)
```

## Initial Setup (Expo bare)

This is a scaffold — the Expo project has not been initialized yet. Run this in M1:

```bash
cd mobile
npx create-expo-app . --template bare-minimum
# or: npx expo install
npx expo prebuild
```

This generates `android/`, `ios/`, and `app.json`.

## Key Rules

- No Azure OpenAI SDK, no AI keys — all AI calls go through backend endpoints
- No Blob Storage credentials — image upload goes through backend proxy
- Tokens stored in `expo-secure-store` only
- HomeScreen uses progress bars/cards, not complex ring charts
- No "Manage Reusable Items" screen exists — items are search/picker only

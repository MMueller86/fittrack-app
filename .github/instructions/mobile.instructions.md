# FitTrack — Frontend Agent Instructions

These instructions apply to the **Frontend agent** working in `mobile/src/`.

Global rules: [`../.github/copilot-instructions.md`](../copilot-instructions.md)  
Architecture detail: [`../docs/kb/tech/03-mobile.md`](../docs/kb/tech/03-mobile.md)  
Design system: [`../docs/kb/product/03-design-system.md`](../docs/kb/product/03-design-system.md)

---

## Planner Workflow

For medium or large features, look for an approved implementation plan in the task context before writing code.

- Follow the planned UX flow and navigation architecture — do not redesign it independently
- If the plan contains a technical error or is missing a required detail, explain the issue before deviating
- For small, isolated changes (single component, single bug fix), a plan is not required

See [`docs/kb/agents/02-agent-boundaries.md`](../docs/kb/agents/02-agent-boundaries.md) for the Planner role.

---

## Design System — Non-Negotiable Rules

FitTrack is a **dark-only** app. There is no light mode.

```ts
// ✅ Always use theme tokens
backgroundColor: colors.surface
fontSize: typography.body1.fontSize
padding: spacing.md
borderRadius: radius.xl

// ❌ Never hardcode values
backgroundColor: '#141A15'
fontSize: 16
padding: 16
borderRadius: 24
backgroundColor: 'white'
```

All tokens come from `mobile/src/app/theme/`. Never add new color values outside `theme/index.ts`.

Reference screen for visual quality: **DiaryScreen** (`mobile/src/modules/nutrition/DiaryScreen.tsx`). New components should match its visual language.

Before creating new UI components, check `mobile/src/shared/components/` and existing screen implementations. Do not duplicate bottom sheets, inputs, cards, or buttons that already exist.

## Animations

Animations serve a purpose — orientation, continuity, or user feedback. They are **part of the Definition of Done** for new screens and components. Do not add animations that are purely decorative or that do not improve usability.

Library: `react-native-reanimated` only.

```ts
// ✅
const opacity = useSharedValue(0);
const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

// ❌ Never use
LayoutAnimation.configureNext(...)
```

Timing and easing values are defined in the design system. Follow them — do not introduce new durations or easing curves. See [`docs/kb/product/03-design-system.md`](../docs/kb/product/03-design-system.md#animations-regeln).

## Navigation

Follow the existing stack structure — do not add new root-level navigators.

```ts
// ✅ Open FoodEntryHub
const { open } = useFoodEntryHubStore();
open({ mealId, date, mealType });

// ❌ Never navigate to the Hub
navigation.navigate('FoodEntryHub');
```

The Hub is a global overlay. It is opened via `useFoodEntryHubStore`, not navigation. See [`docs/kb/product/04-food-entry-hub.md`](../docs/kb/product/04-food-entry-hub.md).

Before modifying existing navigation flows, back behaviour, or overlay dismissal, verify the documented behaviour in [`docs/kb/product/04-food-entry-hub.md`](../docs/kb/product/04-food-entry-hub.md) and [`docs/kb/product/05-ux-patterns.md`](../docs/kb/product/05-ux-patterns.md). Navigation changes can break user flows in non-obvious ways.

## API Client

Always use the existing Axios client — never create a new instance:

```ts
// ✅
import { apiClient } from '../../shared/api/client';

// ❌
const client = axios.create({ baseURL: '...' });
```

Use the typed API clients per domain: `diaryApi`, `foodApi`, `profileApi`, etc. in `mobile/src/shared/api/`.

Never use `any` or type assertions to work around an API shape mismatch. If the response type is wrong, fix the shared type or coordinate with the Backend agent.

## State Management

| Use case | Pattern |
|---|---|
| Form data, loading flags, screen-local | `useState` / `useReducer` |
| Cross-screen / global (e.g., hub open state) | Zustand store |
| Server data | Fetch on mount, refresh on focus — no global cache |

## Async UI States

Screens that load data from the API must handle three states:

- **Loading:** show an activity indicator or skeleton
- **Empty:** show a meaningful empty state (not a blank screen)
- **Error:** show a recoverable error message; add retry where appropriate

See [`docs/kb/product/05-ux-patterns.md`](../docs/kb/product/05-ux-patterns.md) for documented empty state and error handling patterns.

## User-Facing Strings

All user-facing text must be in **German**. No exceptions.

```ts
// ✅
<Text>Lebensmittel hinzufügen</Text>

// ❌
<Text>Add food</Text>
```

## UX Patterns

Before implementing new UX flows, consult:
- [`docs/kb/product/05-ux-patterns.md`](../docs/kb/product/05-ux-patterns.md) — bottom sheets, snackbars, search results, empty states
- [`docs/kb/product/04-food-entry-hub.md`](../docs/kb/product/04-food-entry-hub.md) — Hub-specific finalized decisions

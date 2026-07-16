# Design System

Source of truth: `mobile/src/app/theme/`

Reference screen: `DiaryScreen` — the current highest-quality screen in the app. All new components should match its visual language.

Reference apps: Apple, Spotify, Raycast, Notion, Linear.

---

## Color Tokens

Dark-only app. No light mode.

```ts
background:      '#0B0F0C'   // Page background — deepest level
surface:         '#141A15'   // Cards, main containers
surfaceElevated: '#1B231D'   // Elevated elements inside modals
surfaceMuted:    '#212B23'   // Subtle containers, inputs

border:          '#2A352C'   // All dividers, card borders

primary:         '#67B23E'   // Main action color (green)
primaryBright:   '#8FD157'   // Tab bar active icon
primarySoft:     'rgba(103,178,62,0.18)' // Chip backgrounds, AI badges
primaryDark:     '#3F7A2E'

text:            '#F2F4F1'   // Primary text, product names
textSecondary:   '#A6B0A4'   // Secondary info (brand, kcal meta)
textMuted:       '#7E8B7C'   // Labels, timestamps, placeholders
textDisabled:    '#4A5249'   // Near-invisible elements

positive:        '#67B23E'   // = primary
negative:        '#E26B6B'   // Errors, active heart icon
neutral:         '#A6B0A4'
```

[Rule] Never hardcode hex values in components. Always use `colors.*` tokens from the theme.

---

## Elevation System

Four levels only — no custom values:

1. `background` → Page
2. `surface` → Cards (`mealCard` level)
3. `surfaceElevated` → Elements inside modals
4. `surfaceMuted` → Inputs, subtle backgrounds

---

## Typography

```ts
display:  { fontSize: 44, fontWeight: '800', letterSpacing: -1 }
h1:       { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 }
h2:       { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 }
h3:       { fontSize: 18, fontWeight: '600' }
body1:    { fontSize: 16, fontWeight: '400' }
body2:    { fontSize: 14, fontWeight: '400' }
caption:  { fontSize: 12, fontWeight: '500', letterSpacing: 0.4 }
overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }  // Section labels
button:   { fontSize: 15, fontWeight: '600', letterSpacing: 0.4 }
```

[Rule] Never hardcode `fontSize`. Always use `typography.*`.

---

## Spacing

```ts
xs:  4   // pt
sm:  8
md:  16
lg:  24
xl:  32
xxl: 48
```

---

## Border Radius

```ts
sm:   6
md:   12
lg:   18
xl:   24   // Cards (mealCard radius)
full: 9999 // Pills (chips, badges, search field)
```

---

## Card DNA (Standard Card Pattern)

Used by `mealCard` and all similar cards:

```ts
backgroundColor: colors.surface,
borderRadius:    radius.xl,
borderWidth:     1,
borderColor:     colors.border,
shadowColor:     '#000',
shadowOffset:    { width: 0, height: 2 },
shadowOpacity:   0.15,
shadowRadius:    6,
elevation:       3,
```

---

## Badge Pattern (primarySoft-Badge)

For: AI badges, favorites chips, context badges, active status indicators.

```ts
backgroundColor:   colors.primarySoft,
borderRadius:      radius.full,
paddingHorizontal: spacing.sm,
paddingVertical:   2,
color:             colors.primary,
fontWeight:        '600',
```

---

## Search Field / Input Rule

- Shape: Pill (`borderRadius: radius.full`)
- Height: 52pt
- Background: `colors.surfaceMuted`
- No `borderWidth`
- Search icon: left, 16pt, `colors.textMuted`
- Clear button: right, visible only when text present
- Placeholder color: `colors.textMuted`

---

## Animation Rules

- Library: `react-native-reanimated` (`useSharedValue` + `useAnimatedStyle`)
- No `LayoutAnimation`
- Simple fades / position changes: 150–250ms
- Layout changes: 300–400ms
- Easing: `easeOut` for enter, `easeIn` for exit
- Animations are part of Definition of Done for new UI components

---

## Information Hierarchy

Every UI element belongs to one of three levels:

1. **Primary task** — large, bright (search field, main action button)
2. **Secondary task** — medium weight (favorites chips, recents list)
3. **Tertiary task** — muted / disabled (fallback actions: barcode, AI, manual)

[Rule] Every element must match its level visually. A tertiary action must not use `colors.primary`.

---

## Forbidden Patterns

| Pattern | Reason |
|---|---|
| Hardcoded hex colors outside `theme/index.ts` | Breaks theming |
| `backgroundColor: 'white'` or any light color | Dark-only app |
| `fontSize` hardcoded numbers | Must use `typography.*` |
| `borderWidth > 1` (except current-meal indicator: 3pt) | Visual inconsistency |
| New color values not in the token list | Every color must come from the palette |
| `LayoutAnimation` | Use reanimated instead |
| Custom shadow values | Use Card DNA pattern |

---

## DiaryScreen Reference Components

| Component style | Used as reference for |
|---|---|
| `mealCard` | Card DNA — all cards |
| `aiBadge` | primarySoft Badge — AI/source badges |
| `itemRow` | Recents-style list rows |
| `addMealChip` | Chip base structure |
| `inlineAddBtnText` | Action links in `colors.primary` |
| Meal header | Context badge pattern |

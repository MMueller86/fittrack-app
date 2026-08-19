# Profile & Goals

## Profile Input

`ProfileInput` — what the user provides during onboarding or profile edit.

| Field | Type | Notes |
|---|---|---|
| `gender` | `'male' \| 'female' \| 'other'` | |
| `age` | `number` (10–120) | |
| `heightCm` | `number` (50–300) | |
| `weightKg` | `number` | Current weight |
| `targetWeightKg` | `number` | Goal weight |
| `stepsPerDay` | `number \| null` | Average daily steps |
| `activityLevel` | `ActivityLevel \| null` | Used if steps not available |
| `trainingFrequencyPerWeek` | `number` (0–7) | |
| `trainingDurationMinutes` | `number` (0–600) | Per session |
| `sports` | `Sports[]` | Multiple selection |
| `goal` | `GoalType` | See goals below |
| `goalIntensity` | `GoalIntensity \| null` | Relevant for weight loss/gain |
| `displayName` | `string` (max 50) | Optional user name |

[Rule] Either `stepsPerDay` or `activityLevel` must be provided (Zod refinement enforces this).

## Goal Types

| `GoalType` | Meaning |
|---|---|
| `'lose_weight'` | Calorie deficit |
| `'maintain'` | Maintenance calories |
| `'gain_muscle'` | Calorie surplus, high protein |
| `'recomposition'` | Simultaneous loss + gain (−100 kcal adjustment, same macro formula) |

## Goal Intensity

| `GoalIntensity` | Effect |
|---|---|
| `'gentle'` | Small adjustment (~250 kcal/day) |
| `'moderate'` | Medium adjustment (~500 kcal/day) |
| `'aggressive'` | Large adjustment (~750 kcal/day) |

Null for `maintain` goal.

## Sports Options

`'strength' | 'bouldering' | 'running' | 'cycling' | 'swimming' | 'hiking' | 'teamsport' | 'other'`

Currently used for context — not yet influencing macro calculations differently per sport.

## Target Calculation (Mifflin-St Jeor)

Implemented in `shared/lib/profileCalculator.ts`, called by `profile.ts` handler.

### Step 1: BMR (Basal Metabolic Rate)

Mifflin-St Jeor formula:
- Male: `10 × weightKg + 6.25 × heightCm - 5 × age + 5`
- Female: `10 × weightKg + 6.25 × heightCm - 5 × age - 161`
- Other: average of male and female

### Step 2: PAL (Physical Activity Level)

If `stepsPerDay` is provided → lookup in step-PAL table (linear interpolation):

| Steps/day | PAL |
|---|---|
| ≤4000 | 1.35 |
| 5000 | 1.40 |
| 7500 | 1.50 |
| 10000 | 1.60 |
| 12500 | 1.70 |
| 15000 | 1.80 |
| ≥17500 | 1.90 |

If `activityLevel` provided (fallback):
- `sedentary` → 1.35, `light` → 1.50, `active` → 1.60, `very_active` → 1.75

### Step 3: Training Bonus

Additional kcal/day from training (linear interpolation per minutes/session × frequency):

| Minutes/session | Bonus per session |
|---|---|
| 0 | 0 |
| 30 | 150 kcal |
| 60 | 250 kcal |
| 90 | 350 kcal |
| 120 | 450 kcal |
| ≥150 | 550 kcal |

Scaled by `trainingFrequencyPerWeek / 7` to get daily average.

### Step 4: Maintenance Calories

`maintenanceCalories = bmr × pal + trainingBonus`

### Step 5: Goal Adjustment

Goal deficit/surplus applied:
- `lose_weight` gentle → -250 kcal, moderate → -500, aggressive → -750
- `gain_muscle` gentle → +200 kcal, moderate → +400, aggressive → +600
- `maintain` → 0 adjustment
- `recomposition` → −100 kcal (slight deficit; same macro formula as other goals)

### Step 6: Minimum Calorie Guardrails

| Gender | Minimum kcal |
|---|---|
| `male` | 1800 |
| `female` | 1500 |
| `other` | 1650 |

Calculated calories are clamped to these minimums.

### Step 7: Macro Split

Weight-based formula — no percentage splits. All goals use the same base formula:

| Macro | Formula | Notes |
|---|---|---|
| Protein | `2.0 g × weightKg` | `maintain` goal: `1.8 g × weightKg` |
| Fat | `0.9 g × weightKg` | |
| Carbs | `(calories − protein×4 − fat×9) / 4` | Remainder after protein + fat; min 0 |
| Fiber | `14 g × (calories / 1000)` | Rounded to nearest 1 g |

Protein and fat are rounded to the nearest 5 g. Carbs to the nearest 5 g.

If the calorie target is very low (e.g., at the minimum guardrail), carbs can reach 0 g — never negative.

## Stored Profile Document

`UserProfile` — the complete document stored in Cosmos `nutritionProfiles` container.

- All `ProfileInput` fields
- `targets: ProfileTargets` — `{ rest: DayTargets, training: DayTargets }`
- `calculationMeta: CalculationMeta` — intermediate values for audit and recalculation
- `createdAt`, `updatedAt`
- `id` = `'profile'` (one profile per user, `userId` is the partition key)

### Historical target boundary

The profile document contains the current `restDay` and `trainingDay` targets only. Updating the profile recalculates and replaces those current targets, but never updates historical `DayMeta.calorieTargetSnapshot` fields. This keeps completed-day targets stable across later weight, goal, activity or intensity changes. The weekly read may use the current matching profile target as a non-persisted fallback for a day that has no explicit snapshot; such legacy/default days are not historical snapshots and can therefore follow later profile changes.

When a user explicitly changes a historical day type, the backend may capture the currently selected profile target into that day's optional snapshot. If no usable profile target exists, the snapshot remains unavailable; no fallback target is invented.

## Profile Wizard

`ProfileWizardScreen` — shown on first app launch if no profile exists. Multi-step guided form. On completion, calls `POST /api/profile` and stores `SKIP_WIZARD_KEY` in `AsyncStorage` to prevent re-showing.

## Calculate Preview

`POST /api/profile/calculate-preview` — runs the full calculation without saving. Used to show targets during onboarding before confirmation.

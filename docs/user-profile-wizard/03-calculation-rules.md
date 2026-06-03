# FitTrack – Calculation Rules

## Purpose

This document defines the calculation logic for the FitTrack User Profile & Nutrition Target Wizard.

The goal is to generate practical and explainable nutrition targets for:

- Rest day
- Training day

The calculation should be:

- deterministic
- transparent
- easy to test
- easy to explain to the user

The goal is not scientific sports-performance precision, but realistic and sustainable daily nutrition targets.

---

# 1. Calculation Overview

The target calculation should use this structure:

```text
BMR
× PAL derived from steps or activity level
= daily maintenance without training

+ training day bonus
= training day maintenance

+ goal adjustment
= final targets
```

Important:

- Daily activity and steps describe the user's normal day **without dedicated training**.
- Training is added separately.
- Do not add step calories on top of PAL. PAL already includes daily activity.
- Training day targets are selected by the user via the Home Screen day-type toggle.

---

# 2. Base Metabolic Rate

Use the Mifflin-St Jeor equation.

## Male

```text
BMR = 10 × weightKg + 6.25 × heightCm - 5 × age + 5
```

## Female

```text
BMR = 10 × weightKg + 6.25 × heightCm - 5 × age - 161
```

## Divers / Unknown

Use a neutral fallback.

Recommended:

```text
neutralBmr = average(maleBmr, femaleBmr)
```

Reason:

The user should not be forced into a binary choice if they do not want to provide it.

---

# 3. PAL-Based Daily Activity

PAL means Physical Activity Level.

Classic approach:

```text
dailyMaintenance = BMR × PAL
```

PAL already includes normal daily movement, job activity and general lifestyle activity.

For FitTrack, PAL should be derived from steps when possible because steps are more concrete and easier for users to understand than abstract activity levels.

---

# 4. Step Count → PAL Mapping

The wizard should ask for average daily steps first.

These steps should explicitly mean:

```text
average daily steps without dedicated training
```

Recommended mapping:

| Average daily steps | PAL | Interpretation |
|---:|---:|---|
| < 4,000 | 1.35 | very low movement |
| 5,000 | 1.40 | mostly sitting, little movement |
| 7,500 | 1.50 | sitting job with some movement |
| 10,000 | 1.60 | active everyday movement |
| 12,500 | 1.70 | high everyday movement |
| 15,000 | 1.80 | very active everyday movement |
| 17,500+ | 1.90 | strongly movement-heavy day |

Use interpolation between values.

Example:

```text
8,750 steps
→ between 7,500 and 10,000
→ PAL ≈ 1.55
```

Recommended implementation:

```text
pal = interpolate(steps, stepPalTable)
```

Clamp:

```text
minimum PAL = 1.35
maximum PAL from steps = 1.90
```

Do not assign PAL 2.0+ based on steps alone. PAL 2.0+ should be reserved for physically demanding work or high-performance sport and should not be the default wizard outcome.

---

# 5. Why This Mapping Fits the Classic PAL Ranges

Classic PAL ranges are approximately:

| PAL | Meaning |
|---:|---|
| 1.2–1.3 | exclusively sitting/lying, very low activity |
| 1.4–1.5 | mostly sitting, very little leisure activity |
| 1.6–1.7 | mostly sitting with additional standing/walking |
| 1.8–1.9 | mostly standing/walking activity |
| 2.0–2.4 | physically very demanding work or high-performance sport |

The step mapping targets these ranges:

- 5,000 steps → PAL 1.4: fits office-like day with little extra movement
- 7,500 steps → PAL 1.5: fits office-like day with some extra movement
- 10,000 steps → PAL 1.6: fits active everyday movement
- 12,500 steps → PAL 1.7: fits clearly above-average everyday movement
- 15,000 steps → PAL 1.8: fits a very active day with lots of walking
- 17,500+ steps → PAL 1.9: fits very high everyday movement

This keeps the model aligned with classic PAL logic while using an input that users understand.

---

# 6. Activity Level Fallback → PAL

If the user does not know their step count, use activity level.

UI text should clearly say:

```text
Bitte berücksichtige hier nur deinen Alltag.
Training wird im nächsten Schritt zusätzlich berücksichtigt.
```

Fallback mapping:

| User selection | PAL |
|---|---:|
| überwiegend sitzend | 1.40 |
| etwas Bewegung | 1.55 |
| viel Bewegung | 1.70 |
| körperlich arbeitend | 1.90 |

Notes:

- This fallback is less precise than steps.
- It should only be used when steps are unknown.
- The value should not include dedicated workouts.

---

# 7. Daily Maintenance Without Training

```text
maintenanceRestDay = BMR × PAL
```

This is the estimated maintenance energy for a non-training day.

Round only at the end, not after every intermediate step.

---

# 8. Training Day Bonus

Training is added separately.

The MVP does not differentiate by sport type.

Training day bonus is based on the user's typical session duration.

Suggested mapping:

| Typical session duration | Training day bonus |
|---:|---:|
| 0 min / no training | 0 kcal |
| 30 min | +150 kcal |
| 60 min | +250 kcal |
| 90 min | +350 kcal |
| 120 min | +450 kcal |
| 150+ min | +550 kcal |

Important:

This is not meant to estimate exact exercise calories.

It is a practical target adjustment for training days.

Reason:

Differences between exact exercise estimates are often smaller than real-world food tracking uncertainty.

Sports are still stored for future features, but not used in the initial formula.

---

# 9. Training Frequency

Training frequency is useful for:

- profile understanding
- future AI Coach
- weekly target explanations
- future planning

However, the Home Screen toggle decides whether today's target is rest day or training day.

For the initial target pair:

```text
restDayTarget = rest day formula
trainingDayTarget = rest day formula + training bonus
```

The frequency does not need to change the daily target directly.

The frequency can still be stored and shown in explanations.

Example:

```text
Du hast 4 Trainingseinheiten pro Woche angegeben.
FitTrack nutzt deshalb einen Trainingstags-Zuschlag für Tage,
die du als Trainingstag markierst.
```

---

# 10. Goal Adjustment

Apply goal adjustment after maintenance calories.

## Weight Loss

| Intensity | Adjustment |
|---|---:|
| Sanft | -250 kcal |
| Moderat | -500 kcal |
| Aggressiv | -750 kcal |

## Maintenance

```text
adjustment = 0
```

## Muscle Gain

| Intensity | Adjustment |
|---|---:|
| Sanft | +200 kcal |
| Moderat | +350 kcal |
| Aggressiv | +500 kcal |

## Recomposition

Recommended:

```text
adjustment = -100 kcal
```

or

```text
adjustment = 0
```

Planner should choose the more product-appropriate default.

Recommended MVP default:

```text
recomposition = -100 kcal
```

because many users choosing recomposition usually want slow fat loss while preserving/building muscle.

---

# 11. Final Calorie Targets

```text
restDayCalories = maintenanceRestDay + goalAdjustment
trainingDayCalories = maintenanceRestDay + trainingDayBonus + goalAdjustment
```

Round to nearest:

```text
50 kcal
```

Example:

```text
2218 kcal → 2200 kcal
2376 kcal → 2400 kcal
```

---

# 12. Calorie Guardrails

Avoid unrealistic targets.

Suggested lower bounds:

| User group | Minimum calories |
|---|---:|
| male | 1800 kcal |
| female | 1500 kcal |
| unknown/divers | 1650 kcal |

If calculated values fall below the minimum:

- cap at minimum
- show explanation
- allow user override

Example text:

```text
Wir haben dein Ziel leicht angepasst,
damit es alltagstauglich bleibt.
```

Do not silently create extremely low targets.

---

# 13. Macro Calculation

Macros are derived after calories.

## Protein

Protein is based on body weight.

| Goal | Protein |
|---|---:|
| Abnehmen | 2.0 g/kg |
| Gewicht halten | 1.8 g/kg |
| Muskelaufbau | 2.0 g/kg |
| Recomposition | 2.0 g/kg |

Round to nearest:

```text
5 g or 10 g
```

Recommended:

```text
nearest 5 g
```

## Fat

Default:

```text
0.9 g/kg
```

Minimum:

```text
0.6 g/kg
```

Round to nearest:

```text
5 g
```

## Carbohydrates

Carbs fill the remaining calories.

```text
proteinCalories = proteinG × 4
fatCalories = fatG × 9
remainingCalories = calories - proteinCalories - fatCalories
carbsG = remainingCalories / 4
```

Round to nearest:

```text
5 g or 10 g
```

Recommended:

```text
nearest 5 g
```

If remaining calories are negative or too low:

- reduce fat down to minimum
- if still too low, show warning
- allow user override

## Fiber

Use:

```text
fiberG = calories / 1000 × 14
```

Round to nearest:

```text
1 g
```

or for easier user targets:

```text
nearest 5 g
```

Recommended MVP:

```text
nearest 1 g for precision
```

but display can still be user-friendly.

---

# 14. Example Calculation

Example user:

- male
- 39 years
- 173 cm
- 81 kg
- 10,000 steps per day
- 4 training sessions per week
- 60 min typical duration
- goal: lose weight
- intensity: gentle

## BMR

```text
10 × 81 + 6.25 × 173 - 5 × 39 + 5
= 810 + 1081.25 - 195 + 5
= 1701.25 kcal
```

## PAL from steps

```text
10,000 steps → PAL 1.60
```

## Maintenance Rest Day

```text
1701 × 1.60 = 2722 kcal
```

## Goal Adjustment

```text
gentle weight loss = -250 kcal
```

## Rest Day Calories

```text
2722 - 250 = 2472 kcal
→ rounded to 2450 or 2500 kcal
```

## Training Bonus

```text
60 min → +250 kcal
```

## Training Day Calories

```text
2722 + 250 - 250 = 2722 kcal
→ rounded to 2700 kcal
```

This example shows why PAL-based targets can be higher than manually conservative dieting targets.

Planner should decide whether FitTrack should:

1. Use classic PAL values directly.
2. Apply a conservative FitTrack calibration factor.
3. Let the user pick a stronger deficit.
4. Show the values and let the user adjust.

Recommended MVP:

Use PAL-based calculation but allow easy manual adjustment in Step 5.

---

# 15. Transparency Text Examples

## Calories Explanation

```text
Dein Kalorienziel basiert auf deinem Grundumsatz,
deinen durchschnittlichen Schritten und deinem Ziel.

Grundumsatz:
1700 kcal

Alltag:
PAL 1.60 basierend auf ca. 10.000 Schritten

Erhaltung ohne Training:
2720 kcal

Ziel:
-250 kcal

Ruhetag:
2450 kcal
```

## Training Day Explanation

```text
Für Trainingstage berechnen wir einen einfachen Zuschlag.

Typische Trainingsdauer:
60 Minuten

Zuschlag:
+250 kcal

Trainingstag:
2700 kcal
```

## Protein Explanation

```text
Protein wird anhand deines Körpergewichts berechnet.

Bei deinem Ziel verwenden wir:
2.0 g pro kg Körpergewicht

81 kg × 2.0 = 162 g

Gerundet:
160 g
```

## Fat Explanation

```text
Fett wird anhand deines Körpergewichts berechnet.

Standard:
0.9 g pro kg Körpergewicht

81 kg × 0.9 = 73 g

Gerundet:
75 g
```

## Carbs Explanation

```text
Kohlenhydrate füllen die restlichen Kalorien auf,
nachdem Protein und Fett berechnet wurden.
```

---

# 16. Important Implementation Notes

## Do not double count activity

Never do:

```text
BMR × PAL + stepCalories
```

because PAL already includes steps/daily activity.

## Do not include training in PAL

The UI must make clear:

```text
Steps/activity = everyday life without training
Training = separate input
```

## Keep calculation versioned

Store:

```json
{
  "formulaVersion": "profile-targets-v1-pal"
}
```

This allows future recalculations without confusion.

## Store calculation metadata

Store enough data to explain values later:

```json
{
  "bmr": 1701,
  "pal": 1.6,
  "maintenanceRestDay": 2722,
  "trainingDayBonus": 250,
  "goalAdjustment": -250
}
```

---

# 17. Open Planner Decisions

The planner should explicitly decide:

1. Exact step-to-PAL interpolation method.
2. Whether 10,000 steps should map to 1.60 or slightly lower such as 1.55.
3. Whether FitTrack should apply a conservative adjustment factor.
4. Whether aggressive deficits should be available immediately.
5. Whether guardrails are hard caps or soft warnings.

Recommended initial defaults:

```text
10,000 steps → PAL 1.60
No extra conservative factor
Soft guardrails with user override
Aggressive deficit available with warning
```

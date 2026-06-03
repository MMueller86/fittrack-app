# Data Model

## User Profile Document

Container suggestion:

```text
profiles
```

Partition key:

```text
/userId
```

Document:

```json
{
  "id": "profile",
  "userId": "user-sub",
  "gender": "male",
  "age": 39,
  "heightCm": 173,
  "weightKg": 81.0,
  "targetWeightKg": 75.0,
  "stepsPerDay": 10000,
  "activityLevel": null,
  "trainingFrequencyPerWeek": 4,
  "trainingDurationMinutes": 90,
  "sports": ["strength", "bouldering"],
  "goal": "lose_weight",
  "goalIntensity": "moderate",
  "createdAt": "2026-06-03T00:00:00Z",
  "updatedAt": "2026-06-03T00:00:00Z"
}
```

## Nutrition Targets Document

Can be same container or separate.

Option A:

Same profile document contains targets.

Option B:

Separate target document.

Recommended:

Separate logical model, can still be stored together if simpler.

```json
{
  "id": "nutrition-targets-current",
  "userId": "user-sub",
  "profileId": "profile",
  "source": "wizard",
  "effectiveFrom": "2026-06-03",
  "restDay": {
    "calories": 2200,
    "protein": 160,
    "fat": 75,
    "carbs": 200,
    "fiber": 30
  },
  "trainingDay": {
    "calories": 2400,
    "protein": 170,
    "fat": 80,
    "carbs": 230,
    "fiber": 32
  },
  "calculationMeta": {
    "formulaVersion": "v1",
    "bmr": 1690,
    "activityCalories": 400,
    "trainingDayBonus": 250,
    "goalAdjustment": -250
  },
  "manualOverrides": {
    "restDay": false,
    "trainingDay": false
  },
  "createdAt": "2026-06-03T00:00:00Z",
  "updatedAt": "2026-06-03T00:00:00Z"
}
```

---

# Day Type / Diary Integration

Daily diary should support:

```json
{
  "date": "2026-06-03",
  "dayType": "training",
  "targetsSnapshot": {
    "calories": 2400,
    "protein": 170,
    "fat": 80,
    "carbs": 230,
    "fiber": 32
  }
}
```

Important:

Past diary days should remain stable.

If targets change later, old diary days should not silently change.

Planner should decide whether to:
- snapshot targets at day creation
- dynamically resolve for open current day only
- freeze completed days

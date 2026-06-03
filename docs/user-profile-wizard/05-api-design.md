# API Design

All endpoints require valid JWT.

No dev-user fallback.

`userId = sub`.

---

# GET /profile/me

Returns current profile and targets.

## Response if profile exists

```json
{
  "profile": {...},
  "targets": {...}
}
```

## Response if no profile

Option A:

```http
404 Not Found
```

Option B:

```json
{
  "profile": null,
  "targets": "default"
}
```

Recommendation:

Use 200 with explicit null for easier app startup.

---

# POST /profile

Creates profile and calculated targets.

## Request

```json
{
  "gender": "male",
  "age": 39,
  "heightCm": 173,
  "weightKg": 81,
  "targetWeightKg": 75,
  "stepsPerDay": 10000,
  "activityLevel": null,
  "trainingFrequencyPerWeek": 4,
  "trainingDurationMinutes": 90,
  "sports": ["strength", "bouldering"],
  "goal": "lose_weight",
  "goalIntensity": "moderate"
}
```

## Response

```json
{
  "profile": {...},
  "targets": {...}
}
```

---

# PUT /profile

Updates profile and optionally recalculates targets.

Planner should decide behavior:

Option A:
Always recalculate.

Option B:
Ask client to explicitly request recalculation.

Recommended:

```json
{
  "profile": {...},
  "recalculateTargets": true
}
```

---

# POST /profile/calculate-preview

Calculates targets without saving.

Used by wizard Step 5.

## Request

Same as profile input.

## Response

```json
{
  "targets": {...},
  "explanations": {...}
}
```

This is useful because the wizard should not persist partial state.

---

# PUT /targets

Manual override endpoint.

## Request

```json
{
  "restDay": {...},
  "trainingDay": {...}
}
```

Set source:

```text
manualOverride
```

---

# POST /profile/recalculate

Recalculates targets from existing profile.

Used after weight changes or user request.

## Response

```json
{
  "oldTargets": {...},
  "newTargets": {...},
  "diff": {...}
}
```

Client asks user to confirm before applying.

---

# GET /targets/current

Returns currently active targets.

Used by home screen / diary.

---

# PUT /diary/:date/day-type

Sets day type for a diary date.

Request:

```json
{
  "dayType": "rest" | "training"
}
```

Response includes updated target snapshot.

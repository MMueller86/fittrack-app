# FitTrack – User Profile & Nutrition Target Wizard v2

## Purpose

This specification describes the **User Profile & Nutrition Target Wizard** for FitTrack.

The feature should enable each authenticated user to create a personal profile and receive personalized daily nutrition targets.

The generated targets include:

- Calories
- Protein
- Fat
- Carbohydrates
- Fiber

Targets are generated separately for:

- Rest day
- Training day

The core product idea is:

> FitTrack should not only track food. It should help the user understand what target values make sense and why.

---

## Key Product Principles

### 1. Simple onboarding

The wizard should be completable in under one minute.

Avoid:
- long explanations during input
- scientific complexity
- too many optional fields
- manual calculations by the user

### 2. Transparent calculation

Every generated value should be explainable.

The user should be able to open an info box:

> Wie komme ich auf diese Werte?

and understand the logic in simple language.

### 3. User control

FitTrack suggests targets.

The user confirms or adjusts them.

No hidden or irreversible automation.

### 4. Rest day / training day model

FitTrack should maintain two target sets:

- Rest day target
- Training day target

The user toggles the current day type on the home screen.

### 5. Steps before activity category

Average daily steps are preferred over vague activity categories.

Only if the user does not know their step count should an activity category be used.

### 6. Training is additional

Daily steps / activity describe the user's normal day **without training**.

Training is captured separately and added on top.

### 7. No AI required for calculation

The wizard should be deterministic and testable.

AI may later explain or coach, but should not be required to calculate base targets.

---

## Current FitTrack Context

FitTrack already has:

- Entra External ID authentication
- User-specific data via `userId = sub`
- Cosmos DB
- Nutrition diary
- Weight tracking
- AI meal estimation
- AI food estimation
- Recipes
- OCR nutrition table support
- Default targets

The profile wizard should replace static defaults for users who complete onboarding.

Users who skip profile creation continue with existing default targets.

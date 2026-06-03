# Testing Strategy

## Unit Tests

### Calculation

Test:
- BMR male
- BMR female
- neutral fallback
- step activity calculation
- activity-level fallback
- training day bonus
- goal adjustment
- protein target
- fat target
- carbohydrate remainder
- fiber target
- rounding
- minimum calorie guardrails

### Profile Validation

Test:
- invalid age
- invalid height
- invalid weight
- missing steps and missing activity
- training frequency 0 hides duration
- unknown sports ignored safely

### Explanation Generation

Test:
- calories explanation includes BMR/activity/training/goal
- protein explanation includes g/kg
- fat explanation includes g/kg
- carbs explanation includes remaining calories logic

---

## Backend Tests

- GET /profile/me without profile
- POST /profile creates profile
- POST /profile creates targets
- PUT /profile updates profile
- calculate-preview does not persist
- PUT /targets manual override
- no token returns 401
- invalid token returns 401

---

## Cosmos Emulator Contract Tests

- profile repository create/get/update
- target repository create/get/update
- partition by userId
- user A cannot read user B
- target history if implemented

---

## Mobile Tests

- first-login prompt appears
- skip keeps defaults
- wizard navigation works
- final save calls API
- home toggle updates targets
- explain boxes open/close

---

## Manual Smoke Tests

1. New user logs in.
2. Prompt appears.
3. User skips.
4. Defaults apply.
5. User opens settings and starts wizard.
6. User completes wizard.
7. Home shows personalized targets.
8. Toggle to training day.
9. Targets update.
10. User logs food.
11. Diary uses current target.
12. User edits target.
13. Past diary remains unchanged.

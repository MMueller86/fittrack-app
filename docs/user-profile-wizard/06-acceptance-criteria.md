# Acceptance Criteria

## First Login

- If no profile exists, app prompts user to create profile.
- User can skip.
- If skipped, default targets are used.
- Wizard can be opened later from settings.

## Wizard

- Wizard has 5 steps.
- User can navigate back and forward.
- No data is persisted before final save.
- Closing wizard asks for confirmation.
- Final step shows rest day and training day targets.

## Activity

- Steps are primary input.
- Activity category appears only if user does not know steps.
- UI clearly states that training is not included in step/activity input.

## Training

- User enters training frequency and duration.
- Sports are optional.
- Sports are stored but not used for initial calorie calculation.
- UI clearly states why sports are optional.

## Goal

- User selects goal.
- Weight loss and muscle gain support intensity selection.

## Targets

- Calories, protein, fat, carbs, fiber are generated.
- User can accept or manually adjust.
- Manual overrides persist.

## Explainability

- Each target card has expandable explanation.
- Protein explanation shows g/kg calculation.
- Fat explanation shows g/kg calculation.
- Carb explanation explains remaining calories.
- Calories explanation shows major components.

## Home Screen

- Day type toggle is visible.
- Switching between rest/training updates target display.
- Diary uses correct target for selected day type.

## Security

- All endpoints require valid JWT.
- userId is derived from sub.
- Users cannot access other profiles.

## Stability

- Existing default values remain available for users without profile.
- Past diary entries are not changed when targets are edited later.

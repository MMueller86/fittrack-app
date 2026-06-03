# Planner Prompt

Plan the FitTrack User Profile & Nutrition Target Wizard.

FitTrack already has:
- Entra External ID authentication
- user-specific data via userId = sub
- Cosmos DB
- diary
- weight tracking
- nutrition targets
- AI food/meal features
- recipes

Goal:
Create a profile wizard that calculates personalized calories and macros for rest days and training days.

Key requirements:
- first login prompt if no profile exists
- user can skip and continue with defaults
- wizard can be started later from settings
- 5-step fullscreen wizard
- no partial save
- calculate targets only on final step / preview step
- explain all generated values
- user can manually adjust
- home screen day type toggle
- rest/training targets update dynamically
- past diary entries remain stable

Wizard steps:
1. Basic data
2. Daily activity without sport
3. Training
4. Goal
5. Target review

Activity:
- ask for steps first
- fallback to activity level only if steps unknown
- explicitly tell user that training is handled separately

Training:
- frequency per week
- duration per session
- optional sports list
- sports stored for future use but not used for initial calorie calculation

Goals:
- lose weight
- maintain
- muscle gain
- recomposition
- intensity for loss/gain

Macro logic:
- protein by g/kg
- fat by g/kg
- carbs fill remaining calories
- fiber 14g per 1000 kcal

Please produce:
1. implementation milestones
2. frontend screens
3. backend endpoints
4. data model
5. calculation service
6. diary integration
7. explainability UX
8. testing plan
9. risks and open questions
10. MVP vs future phases

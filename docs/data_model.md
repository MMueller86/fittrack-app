# Cosmos DB Data Model

Containers:
- users
- nutritionProfiles
- weights
- nutritionDiaryMeals
- reusableMealItems
- recipes

Partitioning:
- users: /id
- all user-owned domain containers: /userId

Images:
- store binary images in Blob Storage
- store only metadata/blob paths in Cosmos DB

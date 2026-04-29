# backend/

Azure Functions v4 backend for FitTrack. TypeScript, Node 20 LTS, Consumption Plan.

## Structure

```
src/
├── index.ts           Entry point — registers all function routes + health check
├── functions/
│   ├── auth.ts        POST /api/auth/google | /refresh | /logout
│   ├── profile.ts     GET|PUT /api/profile | POST /api/profile/onboarding
│   ├── nutritionTargets.ts  GET|POST /api/nutrition/targets + calculate + ai-validate
│   ├── weights.ts     GET|POST /api/weights | DELETE /api/weights/:id
│   ├── diary.ts       GET /api/diary | meals CRUD | items CRUD
│   ├── reusableItems.ts  GET|POST /api/reusable-items
│   ├── recipes.ts     CRUD /api/recipes | image upload | ai-analyze
│   ├── ai.ts          POST /api/ai/analyze-meal-item
│   └── dashboard.ts   GET /api/dashboard/today
└── lib/
    ├── cosmos.ts      CosmosClient singleton + 6 container refs
    ├── openai.ts      AzureOpenAI client + prompt builders (3 workflows)
    ├── storage.ts     BlobServiceClient + upload helper
    └── auth.ts        googleValidator, jwtMiddleware, tokenService
```

## Prerequisites

Install these once before starting:

```powershell
# 1. Node.js 20 LTS (required for all workspaces)
winget install OpenJS.NodeJS.LTS

# 2. Azure Functions Core Tools v4 (required to run backend locally)
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# 3. Verify
node --version   # should be v20.x
func --version   # should be 4.x
```

## Local Development Setup

1. Copy the settings template:
   ```powershell
   Copy-Item local.settings.json.template local.settings.json
   ```
2. Fill in all values in `local.settings.json` (never commit this file)
3. Install all workspace dependencies from the monorepo root:
   ```bash
   cd ..   # go to fittrack-app root
   npm install
   ```
4. Build TypeScript:
   ```bash
   cd backend
   npm run build
   ```
5. Start the Functions runtime:
   ```bash
   npm start   # runs: func start
   ```
6. Verify: `GET http://localhost:7071/api/health` → `{ "status": "ok" }`

## Key Rules

- JWT middleware must be applied to every route except `/api/auth/google`, `/api/auth/refresh`, `/api/health`
- No Azure OpenAI keys or calls in `mobile/` — all AI goes through this backend
- All AI endpoints return a preview payload only — caller must POST to a save endpoint after user confirmation
- `local.settings.json` is gitignored — use the `.template` file as reference

## Dependencies

| Package | Purpose |
|---|---|
| `@azure/functions` v4 | Azure Functions v4 programming model |
| `@azure/cosmos` | Cosmos DB client |
| `@azure/storage-blob` | Blob Storage client (recipe images) |
| `google-auth-library` | Google ID token validation |
| `jsonwebtoken` | Access/refresh token signing |
| `openai` | Azure OpenAI client |

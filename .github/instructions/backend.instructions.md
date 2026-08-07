# FitTrack — Backend Agent Instructions

These instructions apply to the **Backend agent** working in `backend/src/` and `shared/`.

Global rules: [`../.github/copilot-instructions.md`](../copilot-instructions.md)  
Architecture detail: [`../docs/kb/tech/02-backend.md`](../docs/kb/tech/02-backend.md)

---

## Task Package Workflow

The Backend agent works exclusively from the **Task Package** provided by the Orchestrator. Do not read the full plan, supplement context independently, or deviate based on your own analysis.

The Task Package contains:
- `Goal` — what to implement
- `Required Knowledge Base` — read these before writing code
- `Required Repository Context` — read these before writing code
- `Required Skills` — load these before writing code
- `Relevant Acceptance Criteria` — the completion bar
- `Dependencies` — handoff outputs from prior agents (e.g. shared types, API contracts)

If the Task Package is **incomplete**, **technically invalid**, or a declared dependency does not match the current implementation: **do not deviate or coordinate directly with another agent**. Report the specific issue to the Orchestrator and stop.

For small, isolated changes (single handler, single bug fix) delivered outside the Orchestrator workflow, a Task Package is not required — work from the explicit request.

See [`docs/kb/agents/02-agent-boundaries.md`](../docs/kb/agents/02-agent-boundaries.md) for agent roles.

---

## Handler Layering

Keep function handlers thin. The intended dependency direction is:

```
functions/   →   lib/   →   repositories/
```

Handlers are responsible for: authenticating, validating input, and orchestrating calls to `lib/`.

Business rules belong in `lib/` modules (e.g., `hintEngine.ts`, `quotaConfig.ts`, `progressIntelligence.ts`) or in `shared/lib/` (e.g., `profileCalculator.ts`, `nutritionCalculator.ts`).

Repositories must not import from `lib/` modules. `lib/` modules must not import from `backend/src/functions/`.

---

## Handler Pattern

Every HTTP handler must be wrapped with `withHandler()`:

```ts
export const myHandler = withHandler('domain.action', async (request, ctx) => {
  const { userId, tier } = await requireUser(request);
  const parsed = await parseBody(request, MySchema);
  if (!parsed.ok) return parsed.response;
  // ... business logic ...
  return { status: 200, jsonBody: result };
});
```

- `withHandler(name, fn)` — provides structured logging and converts `UnauthorizedError` → 401, all other errors → 500
- `requireUser(request)` — validates Bearer JWT, returns `UserContext`. Call on every protected endpoint.
- `parseBody(request, ZodSchema)` — validates request body. Return `parsed.response` immediately on failure.
- Return `{ status, jsonBody }` — never throw errors to the client

## Repository Pattern

Always use factory functions — never instantiate repositories directly:

```ts
const repo = getDiaryRepository();      // ✅
const repo = new CosmosDiaryRepository(); // ❌
```

Never call the Cosmos SDK directly from function handlers. All data access goes through repository interfaces.

**When a task adds a document field, introduces a new entity type, adds a container, or requires migration logic:** load the `cosmos-data-model-and-migration` skill before writing any code. It contains the schema evolution classification, backward-compatibility invariants, infrastructure coordination checklist, and testing requirements. Do not make Cosmos persistence decisions without it.

## API Contract Changes

When changing a request or response shape, HTTP method, or route:

1. Update the Zod schema in the function handler
2. Update any affected shared types in `shared/types/`
3. Identify which mobile API clients are affected (`mobile/src/shared/api/`)
4. Update [`docs/kb/tech/09-api-reference.md`](../docs/kb/tech/09-api-reference.md)
5. For breaking changes: report the change to the Orchestrator. Do not coordinate directly with the Frontend agent.

Breaking changes to existing endpoints require explicit communication through the Orchestrator — not just a code change.

## Route Registration

Every new function module must be imported in `backend/src/index.ts`:

```ts
import './functions/myNewFeature';
```

`registrations.test.ts` will fail if the import is missing. Run `npx vitest run` after adding any new function file to catch this immediately.

## Shared Library Import Rule

```ts
// TYPE imports — use @fittrack/shared alias freely
import type { UserProfile, MealType } from '@fittrack/shared';

// VALUE imports — use relative paths ONLY
import { calculateProfileTargets } from '../../../shared/lib/profileCalculator';
```

Value imports from `@fittrack/shared` compile to `require('@fittrack/shared')` at runtime, which fails because `shared/package.json` points `main` to `index.ts`. After any change involving shared imports, run:

```bash
npm run build:verify
```

## Testing

All business logic in `lib/` and `shared/lib/` must have unit tests. After any backend change:

```bash
cd backend && npx vitest run
```

**Bug fix workflow (Red → Green):** Write a failing test that reproduces the bug first. Confirm it fails. Fix the implementation until the test passes. Never submit a bug fix without a regression test.

For new repository methods, add a contract test in `*.contract.test.ts`. See [`qa.instructions.md`](qa.instructions.md) for the full checklist and contract test setup.

## Local Development

Start the backend locally:

```bash
cd backend
func start
```

Requires Azure Functions Core Tools. All credentials come from `backend/local.settings.json` (gitignored). If a required key is missing, inform the user — never hardcode keys.

## Infrastructure Changes

When a task requires a new Cosmos container:

1. Prepare the `CONTAINER_DEFS` entry in `backend/src/lib/cosmos.ts`.
2. Output a **container spec** in your `Expected Handoff` for the Infrastructure & Release agent:
   - `containerName`: the container id (e.g. `myNewContainer`)
   - `partitionKey`: the partition key path (e.g. `/userId`)
   - `indexPolicyNote`: any required composite index or exclusion (or "default" if none)
3. Do **not** write or modify any file in `infra/` — Infrastructure & Release owns all Bicep files.
4. Do **not** run `az CLI` commands, `func publish`, or `eas build`. All deployment execution belongs to the Infrastructure & Release agent.

## Error Handling

| Situation | Response |
|---|---|
| Missing or invalid token | Throw `UnauthorizedError` — handled by `withHandler` → 401 |
| Invalid request body | Return `parseBody` failure response → 400 |
| AI plausibility check fails | Return or throw 422 |
| Quota exceeded | Return `enforceQuota()` response → 429 |
| Anything else | Let `withHandler` catch it → 500 (stack never sent to client) |

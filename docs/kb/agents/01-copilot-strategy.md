# Copilot Knowledge Strategy

## Goal

Minimize the prompt length needed for any agent to start working. Distribute knowledge to the right level: global, role-specific, or architecture-only (docs).

---

## What Belongs in Global Copilot Instructions

Global instructions should contain rules that apply to **every agent in every context**.

Recommended candidates for `copilot-instructions.md` (global):

### Security Rules
- Never write API keys, passwords, tokens, connection strings, or secrets to any file
- Only exception: `backend/local.settings.json` (gitignored) for local dev
- Check all code for secrets before committing

### Azure Resource Rule
- All Azure resources stay in `rg-Michael-Mueller`
- Never create new resource groups
- Environments separated by name prefix only

### Import Rule (Backend ↔ Shared)
- `@fittrack/shared` path alias: `import type` only in backend
- Value imports from shared: use relative paths (`../../../shared/lib/xyz`)
- Verify with `npm run build:verify` after changing shared imports

### Testing Rule
- Every logic change must have a unit test
- Bug fix workflow: write a failing test first, then fix
- After any change: run affected test suites (backend, shared, mobile)

### Language
- App UI is in German. All user-facing strings must be German
- Code, comments, and documentation may be in English

---

## What Belongs in Backend Agent Instructions

File: `.github/instructions/backend.instructions.md`

### Handler Pattern
- All handlers wrapped with `withHandler(name, fn)`
- `requireUser(request)` for auth on every protected endpoint
- `parseBody(request, ZodSchema)` for request validation
- Return `{ status, jsonBody }` — never throw to the client

### Repository Pattern
- Use factory functions (`getDiaryRepository()`, etc.) — never instantiate repositories directly
- Never call Cosmos SDK directly in function handlers — always via repository interfaces

### Quota Pattern
- AI handlers: call `enforceQuota()` before the operation, `trackUsage()` after success
- `enforceQuota` does not increment — never skip `trackUsage`

### Route Registration
- Every new function module must be imported in `backend/src/index.ts`
- `registrations.test.ts` will fail if forgotten — run tests after adding any new function

### Error Handling
- Throw `UnauthorizedError` for auth failures (handled by `withHandler`)
- Throw or return 422 for AI plausibility failures
- All other unexpected errors become 500 (stack never goes to client)

---

## What Belongs in Frontend (Mobile) Agent Instructions

File: `.github/instructions/mobile.instructions.md`

### Design System
- Dark-only app — no light colors, no `backgroundColor: 'white'`
- All colors via `colors.*` tokens only
- All font sizes via `typography.*` only
- All spacing via `spacing.*` only
- All border radii via `radius.*` only

### Animation Rule
- Use `react-native-reanimated` (`useSharedValue` + `useAnimatedStyle`)
- Never use `LayoutAnimation`
- Animations are required (part of DoD for new screens)

### Navigation
- Follow existing stack structure — do not add root-level navigators
- FoodEntryHub opens via `useFoodEntryHubStore().open()` — not via `navigation.navigate`

### State Management
- Prefer `useState`/`useReducer` for screen-local state
- Use Zustand only for cross-screen or truly global state

### API Client
- Always use `mobile/src/shared/api/client.ts` — never create a new Axios instance
- Typed API clients per domain in `mobile/src/shared/api/`

---

## What Belongs in QA Agent Instructions

File: `.github/instructions/qa.instructions.md`

### Test Runner
- Vitest — `npx vitest run` from the package directory

### Coverage Expectation
- All pure functions must have unit tests
- New AI classification logic must have exhaustive unit tests (e.g., `classifyItem`)
- New repository methods require contract tests in the corresponding `*.contract.test.ts`

### What to Check After Every PR
1. `cd backend && npx vitest run` — all unit tests pass
2. `cd shared && npx vitest run` — shared lib tests pass
3. `cd backend && npm run build:verify` — no bad shared imports
4. `npx tsc --noEmit` (from mobile/) — no type errors

---

## What Belongs in Architecture Documentation Only (Not Instructions)

The following is too detailed or too context-specific for instructions files. It belongs in `docs/kb/` for on-demand reference:

- Full API endpoint list → [tech/09-api-reference.md](../tech/09-api-reference.md)
- Cosmos container schema → [tech/07-infrastructure.md](../tech/07-infrastructure.md)
- Mifflin-St Jeor calculation steps → [domain/04-profile-goals.md](../domain/04-profile-goals.md)
- Quota tier limits table → [domain/08-quota-system.md](../domain/08-quota-system.md)
- Hub state machine details → [product/04-food-entry-hub.md](../product/04-food-entry-hub.md)
- Progress intelligence thresholds → [domain/05-weight-tracking.md](../domain/05-weight-tracking.md)
- Hint engine rule list → code + [domain/02-diary.md](../domain/02-diary.md)
- Design token values → [product/03-design-system.md](../product/03-design-system.md)

---

## Actual File Locations

All files are created and active:

```
.github/
├── copilot-instructions.md          ← Global rules (security, Azure, import rule, testing, language)
├── agents/
│   ├── fittrack-planner.agent.md   ← Planner / Solution Architect  [tools: read, search]
│   ├── fittrack-backend.agent.md   ← Backend Engineer             [tools: read, search, edit, execute]
│   ├── fittrack-frontend.agent.md  ← Frontend Engineer            [tools: read, search, edit, execute]
│   └── fittrack-qa.agent.md        ← QA / Review                  [tools: read, search, edit, execute]
└── instructions/
    ├── planner.instructions.md     ← Planning rules (assessment, output format, PO boundary)
    ├── backend.instructions.md     ← Handler, repository, quota, import, deploy patterns
    ├── mobile.instructions.md      ← Design system, animation, navigation, state, German strings
    └── qa.instructions.md          ← Test commands, coverage, review checklist, verdict format

docs/kb/                             ← Deep-reference knowledge (never duplicated in instructions)
```

## Priority Order for Maintaining Instructions Files

When rules change, update the relevant file:
1. `copilot-instructions.md` — when global architectural constraints change
2. `planner.instructions.md` — when planning workflow or output format evolves
3. `backend.instructions.md` / `mobile.instructions.md` — when implementation patterns change
4. `qa.instructions.md` — when test strategy or review criteria change

If specialized agents are introduced later (Infrastructure, Auth, AI), add dedicated files at that time. See [agents/02-agent-boundaries.md](02-agent-boundaries.md#future-agent-expansion).

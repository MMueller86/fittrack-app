# Agent Boundaries

Five core agents cover the full codebase without unnecessary specialization.

Each agent is implemented as a VS Code Custom Agent in `.github/agents/` and references its role-specific instructions from `.github/instructions/`. See [agents/01-copilot-strategy.md](01-copilot-strategy.md) for the full file map.

---

## Core Agents

### Planner

**Role:** Solution Architect. Designs solutions, defines tasks, identifies risks. Does **not** replace product management or decide product priorities.

**Primary files:** `docs/kb/`, `.github/`

**Responsibilities:**
- Analyse feature requests and identify affected components
- Design technical solutions across backend, mobile, and shared
- Identify inter-component dependencies and integration points
- Break down features into concrete, unambiguous implementation tasks
- Identify architectural risks and constraints
- Define testing strategy and acceptance criteria per feature
- Keep `docs/kb/` accurate and up to date

**Does not own:**
- Source code changes
- Product backlog prioritization
- Sprint planning or feature sequencing (those are product management decisions)

**Consumes:** All `docs/kb/` documents — this is the primary knowledge consumer.

---

### Backend

**Primary files:** `backend/src/`, `shared/`, `infra/modules/cosmos.bicep` (data model changes only)

**Owns:**
- HTTP function handlers (`backend/src/functions/`)
- Library layer (`backend/src/lib/`) — auth, quota, AI client, repositories, hint engine
- Zod validation schemas and `backend/src/index.ts` route registration
- Shared types and calculation functions (`shared/types/`, `shared/lib/`)

**Does not own:** `infra/` (any Bicep file), deploy workflow, `az` or `func publish` commands, EAS builds — all belong to Infrastructure & Release. When a new Cosmos container is needed, Backend outputs a container spec (name + partition key); Infrastructure & Release writes the Bicep resource block.

**Key responsibilities for shared changes:** Any change to `shared/types/` or `shared/lib/` affects both backend and mobile. Coordinate with Frontend agent before breaking changes.

**Consumes:**
- [tech/02-backend.md](../tech/02-backend.md) — handler and repository patterns
- [tech/04-shared-library.md](../tech/04-shared-library.md) — shared library map
- [tech/05-authentication.md](../tech/05-authentication.md) — auth validation
- [tech/06-ai-integrations.md](../tech/06-ai-integrations.md) — AI usage
- [tech/09-api-reference.md](../tech/09-api-reference.md) — endpoint contracts
- Relevant domain docs for the feature being implemented

---

### Frontend

**Primary files:** `mobile/src/`

**Owns:**
- All React Native screens and components
- Navigation (`mobile/src/app/navigation/`)
- Theme tokens (`mobile/src/app/theme/`)
- API clients (`mobile/src/shared/api/`)
- Auth service (`mobile/src/services/`)
- All feature modules under `mobile/src/modules/`

**Does not own:** Shared types or backend APIs (read-only consumer).

**Consumes:**
- [tech/03-mobile.md](../tech/03-mobile.md) — structure and patterns
- [tech/05-authentication.md](../tech/05-authentication.md) — auth client side
- [product/03-design-system.md](../product/03-design-system.md) — design tokens (critical)
- [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) — hub architecture
- [product/05-ux-patterns.md](../product/05-ux-patterns.md) — UX patterns
- [tech/09-api-reference.md](../tech/09-api-reference.md) — endpoint contracts

---

### QA

**Primary files:** `*.test.ts`, `*.contract.test.ts`, `vitest.config.mts`

**Owns:**
- Unit test files across all packages
- Contract test files
- `registrations.test.ts` maintenance
- Test coverage decisions

**Does not own:** Production source code — reviews and validates, does not initiate changes.

**Consumes:**
- [tech/08-testing.md](../tech/08-testing.md) — test strategy
- All domain docs for test scenario design

---

### Infrastructure & Release

**Primary files:** `infra/`, `_deploy_staging/`

**Owns:**
- Bicep deployment execution (`az deployment group create`) for all environments
- Azure Functions build + sync + deploy workflow (Windows → Linux)
- EAS builds — `development` profile (Dev Build) and `preview` profile (Alpha Build)
- Release verification after every deployment (health check + function list)
- Rollback assessment and user escalation

**Does not own:** Application source code (`backend/src/`, `shared/`, `mobile/src/`). Backend writes `infra/modules/cosmos.bicep` container blocks; Infrastructure & Release executes the deploy.

**Direct commands (no Planner required):**
- `New Dev Build` — Dev Build assessment + optional EAS Dev Build
- `New Alpha Build` — full Alpha release sequence
- `Deploy to Alpha` — infrastructure and/or backend deploy without EAS build

**Consumes:**
- [tech/07-infrastructure.md](../tech/07-infrastructure.md) — deploy workflow, resource names, Bicep modules
- [tech/01-system-overview.md](../tech/01-system-overview.md) — runtime environments, shared services

---

## Coordination Points

| Area | Agents Involved | What to coordinate |
|---|---|---|
| New API endpoint | Backend + Frontend | Agree on shared types before implementation |
| Shared type change | Backend + Frontend | Breaking changes require both sides to update |
| New Cosmos container | Backend + Infrastructure & Release | Backend prepares Bicep + cosmos.ts; Infra deploys Bicep before Backend code ships |
| AI prompt change | Backend | Increment prompt version; invalidate insight cache |
| New screen requiring new API | Backend + Frontend | Backend implements endpoint first |
| Any Alpha deploy | Infrastructure & Release | Never automatic — requires explicit user request |

---

## Future Agent Expansion

When team size or codebase complexity grows, these areas can be split into dedicated agents.

| Future Agent | Would own | Trigger to split |
|---|---|---|
| **Shared Libraries** | `shared/types/`, `shared/lib/` | Shared changes become a bottleneck |
| **Authentication** | `auth.ts` (backend + mobile), CIAM config | Auth system gains significant complexity (M2) |
| **AI Features** | `prompts/`, `openai.ts`, AI function handlers | Prompt engineering becomes a dedicated discipline |
| **Infrastructure (split)** | Split Infra from Deploy/Release | Production added with separate infra and release management teams |


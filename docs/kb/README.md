# FitTrack Knowledge Base

This directory is the primary knowledge source for GitHub Copilot agents working on the FitTrack codebase.

Every document is intentionally focused. Cross-references are used instead of duplication.

---

## Structure

### Technical Architecture — `tech/`

| Document | Purpose | Primary Consumer |
|---|---|---|
| [01-system-overview.md](tech/01-system-overview.md) | Monorepo layout, subsystems, technology stack, environments | All agents |
| [02-backend.md](tech/02-backend.md) | Azure Functions patterns, lib layer, handler conventions | Backend agent |
| [03-mobile.md](tech/03-mobile.md) | React Native app, navigation, modules, API client | Frontend agent |
| [04-shared-library.md](tech/04-shared-library.md) | Shared types and pure calculation functions | Backend + Frontend |
| [05-authentication.md](tech/05-authentication.md) | CIAM flow, token lifecycle, backend JWT validation, local dev auth | Backend + Frontend |
| [06-ai-integrations.md](tech/06-ai-integrations.md) | All AI features, Azure OpenAI usage, prompt versioning | Backend |
| [07-infrastructure.md](tech/07-infrastructure.md) | Bicep modules, Azure resources, environments, deploy | Backend + Planner |
| [08-testing.md](tech/08-testing.md) | Test strategy, Vitest, contract tests, coverage rules | QA |
| [09-api-reference.md](tech/09-api-reference.md) | All HTTP endpoints, methods, auth, request/response | All agents |

### Domain Knowledge — `domain/`

| Document | Purpose | Primary Consumer |
|---|---|---|
| [01-nutrition-model.md](domain/01-nutrition-model.md) | Nutrients, macros, calorie calculation, day targets | Backend + Frontend |
| [02-diary.md](domain/02-diary.md) | Diary structure, meals, meal items, hint engine | Backend + Frontend |
| [03-food-catalog.md](domain/03-food-catalog.md) | Food sources, search fan-out, ranking, favorites | Backend + Frontend |
| [04-profile-goals.md](domain/04-profile-goals.md) | User profile, goals, Mifflin-St Jeor, activity calculation | Backend |
| [05-weight-tracking.md](domain/05-weight-tracking.md) | Weight entries, plateau detection, progress intelligence | Backend + Frontend |
| [06-recipes.md](domain/06-recipes.md) | Recipe model, ingredients, nutrition, image storage | Backend + Frontend |
| [07-ai-features.md](domain/07-ai-features.md) | AI use cases, workflows, confidence, user review | Backend + AI agent |
| [08-quota-system.md](domain/08-quota-system.md) | User tiers, limits per feature, enforcement, 429 format | Backend |

### Product & UX — `product/`

| Document | Purpose | Primary Consumer |
|---|---|---|
| [01-product-philosophy.md](product/01-product-philosophy.md) | MVP scope, guiding principles, product decisions | Planner + Frontend |
| [02-navigation.md](product/02-navigation.md) | Tab structure, stacks, screen list, entry points | Frontend agent |
| [03-design-system.md](product/03-design-system.md) | Color tokens, typography, spacing, component patterns | Frontend agent |
| [04-food-entry-hub.md](product/04-food-entry-hub.md) | Hub state machine, UX flows, finalized decisions | Frontend agent |
| [05-ux-patterns.md](product/05-ux-patterns.md) | Recurring UX patterns: bottom sheets, snackbars, errors | Frontend agent |

### Agent Strategy — `agents/`

| Document | Purpose | Primary Consumer |
|---|---|---|
| [01-copilot-strategy.md](agents/01-copilot-strategy.md) | What belongs in which Copilot instructions file | Planner + Architect |
| [02-agent-boundaries.md](agents/02-agent-boundaries.md) | Ownership boundaries for specialized agents | Planner + Architect |

---

## Quick Facts

- **Language:** TypeScript everywhere (backend, mobile, shared)
- **Backend:** Azure Functions v4, Node.js — runs locally in Dev, on Azure in Alpha
- **Frontend:** React Native (Expo), dark-only
- **Database:** Azure Cosmos DB (serverless), partition key `/userId` for all user data
- **AI:** Azure OpenAI (gpt-4o-mini), Azure Document Intelligence — backend-only, **shared across environments**
- **Auth:** Entra External ID (CIAM) — PKCE OAuth2 from mobile, JWKS validation on backend, **shared across environments**
- **Monorepo packages:** `backend`, `mobile`, `shared` — cross-linked via npm workspaces

→ Full runtime environment breakdown: [tech/01-system-overview.md](tech/01-system-overview.md#runtime-environments)

---

## Notation Conventions

| Marker | Meaning |
|---|---|
| *(no marker)* | Implemented and working |
| `[Partial]` | Partially implemented — specific gaps noted inline |
| `[Planned]` | Designed or decided, but not yet implemented |
| `[Deprecated]` | To be removed — reason and action documented inline |
| `[Open]` | Intent unclear or decision not yet made |
| `[Rule]` | Architectural or coding rule that must not be violated |
| `[Pattern]` | Recurring implementation pattern to follow |

---

## Knowledge Base Maintenance Policy

The Knowledge Base describes the **current state of the repository**. It must evolve together with the implementation.

- When behaviour changes, update the corresponding document before or alongside the code change
- Planned behaviour must always be marked `[Planned]` — never described as implemented
- When a `[Planned]` feature is built, remove the marker
- When a `[Deprecated]` item is deleted, remove its documentation entry
- `[Open]` items should be resolved when a decision is made — update the doc, do not leave permanent open questions
- The Planner agent is responsible for keeping this Knowledge Base accurate

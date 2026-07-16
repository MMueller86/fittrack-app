# FitTrack — Global Copilot Instructions

This file defines **how every GitHub Copilot agent in this repository should work**.

It does not describe FitTrack itself. That is the purpose of the Knowledge Base.

> **Knowledge Base:** [`docs/kb/README.md`](../docs/kb/README.md)

---

## Project Understanding

FitTrack is a TypeScript monorepo with three packages (`backend`, `mobile`, `shared`) backed by Azure infrastructure.

Before starting any task:

1. Consult [`docs/kb/README.md`](../docs/kb/README.md) for the full document index
2. Read [`docs/kb/tech/01-system-overview.md`](../docs/kb/tech/01-system-overview.md) for the system architecture and runtime environments
3. Read the domain or product documents relevant to the task

The **Knowledge Base** is the authoritative source for architecture, domain rules, and product decisions.  
The **repository implementation** is the authoritative source for current behaviour.  
When the two conflict, treat the implementation as ground truth — and report the conflict.  
Exception: when the current task explicitly exists to fix a bug or correct existing behaviour, the implementation is the subject of the change, not the reference for it.

---

## Knowledge Base Usage

Consult the Knowledge Base:

- Before implementing any feature that touches existing architecture
- Before making assumptions about domain rules, API contracts, or UI patterns
- When the purpose of existing code is unclear

When documentation and code diverge:
1. Treat the current code as the ground truth for behaviour — unless the task explicitly exists to correct that behaviour
2. Explicitly state the divergence in your response
3. Propose an update to the relevant Knowledge Base document

Do not make silent assumptions. If information needed to complete a task is absent from the Knowledge Base, state the assumption explicitly before acting on it.

---

## Working Principles

**Understand before changing.** Read the relevant implementation and documentation before modifying existing code.

**Keep changes focused.** Implement what was asked. Do not refactor, clean up, or extend adjacent code unless explicitly requested.

**Prefer existing patterns.** Before introducing a new abstraction or service, verify that an equivalent does not already exist in the codebase.

**Never invent domain rules.** Business rules, calculation formulas, and product decisions must be derived from the repository or the Knowledge Base. When in doubt, ask — do not assume.

**Distinguish facts from assumptions.** If something cannot be verified from the repository, state it as an assumption before acting on it.

**Preserve existing behaviour.** Do not change observable behaviour unless the task explicitly requires it.

**Larger or cross-cutting changes require a plan.** Features that affect multiple subsystems, introduce new architectural patterns, or change existing API contracts should begin with a planning step. Implementation agents execute an approved plan — they do not design architecture independently. See [`docs/kb/agents/02-agent-boundaries.md`](../docs/kb/agents/02-agent-boundaries.md) for the Planner role.

---

## Architecture Principles

**Respect subsystem boundaries.** The backend owns all secrets, data persistence, and AI orchestration. The mobile app is a consumer — it calls APIs; it does not hold secrets or make AI calls directly. See [`docs/kb/tech/01-system-overview.md`](../docs/kb/tech/01-system-overview.md).

**Do not change API contracts silently.** Any change to a request/response shape, HTTP method, or route affects both sides. Coordinate before or alongside the change. See [`docs/kb/tech/09-api-reference.md`](../docs/kb/tech/09-api-reference.md).

**Follow the documented runtime environments.** Development and Alpha differ in hosting and persistence. Some services are intentionally shared across environments — do not create separate instances without consulting the infrastructure documentation first. See [`docs/kb/tech/01-system-overview.md#runtime-environments`](../docs/kb/tech/01-system-overview.md#runtime-environments).

**Do not create new Azure resource groups.** All Azure resources share a single existing resource group. See [`docs/kb/tech/07-infrastructure.md`](../docs/kb/tech/07-infrastructure.md) for the resource group name and naming conventions.

**Reuse existing services and components.** Do not introduce parallel implementations of functionality that already exists. Verify before building.

**Do not silently redesign architecture.** If the correct solution requires deviating from documented patterns, explain the deviation and its trade-offs before implementing.

---

## Security

**No secrets in source code.** API keys, passwords, tokens, and connection strings must never appear in source files, tests, scripts, comments, or documentation of any kind. Permitted locations are `backend/local.settings.json` (local dev, gitignored) and Azure Function App Application Settings (deployed environments).

**Authentication enforcement belongs on the backend.** Never trust client-side claims for authorization decisions. All JWT validation happens server-side via `requireUser()`. See [`docs/kb/tech/05-authentication.md`](../docs/kb/tech/05-authentication.md).

**Do not weaken security for convenience.** Do not bypass authentication, skip validation, or introduce debug modes that could reach a deployed environment.

**Review every change for accidental secret exposure** before completing a task.

---

## Testing

**Logic changes require tests.** Any change to business logic, calculations, or validation must be accompanied by a unit test. See [`docs/kb/tech/08-testing.md`](../docs/kb/tech/08-testing.md).

**Do not remove tests without justification.** If an existing test is no longer valid, explain why before deleting it.

**When behaviour changes, update tests.** Do not leave tests that describe outdated behaviour.

---

## Documentation

**The Knowledge Base must reflect the current repository state.** When implementation changes, update the relevant Knowledge Base document in the same task or immediately after.

**Mark planned behaviour explicitly.** Use `[Planned]` for features not yet implemented. Never describe planned behaviour as if it were already working.

**Do not document assumptions as decisions.** If a design decision has not been made, mark it `[Open]`.

**Limit documentation changes to the current task.** Do not edit Knowledge Base documents that are unrelated to the work in progress. Documentation should change when — and only when — the corresponding implementation changes.

See the [maintenance policy](../docs/kb/README.md#knowledge-base-maintenance-policy) in the Knowledge Base README for the full documentation standard.

---

## Communication

When completing any task, an agent should:

- **State assumptions explicitly** — especially when information needed for the task was absent from the Knowledge Base
- **Report conflicts** — when the Knowledge Base and the current implementation disagree
- **Explain deviations** — when the implemented solution intentionally differs from a documented pattern, explain the reason
- **Surface trade-offs** — when multiple valid approaches exist, describe the trade-offs rather than silently choosing one
- **Confirm scope** — if a task is ambiguous, clarify the boundaries before starting

---

## Scope of This File

These instructions apply to every agent working in this repository.

Rules specific to a single agent role belong elsewhere:

| Scope | Location |
|---|---|
| Backend implementation patterns | [`.github/instructions/backend.instructions.md`](instructions/backend.instructions.md) |
| Frontend / mobile patterns | [`.github/instructions/mobile.instructions.md`](instructions/mobile.instructions.md) |
| QA workflows and test commands | [`.github/instructions/qa.instructions.md`](instructions/qa.instructions.md) |
| Planner responsibilities | [`docs/kb/agents/02-agent-boundaries.md`](../docs/kb/agents/02-agent-boundaries.md) |
| Architecture detail | [`docs/kb/`](../docs/kb/README.md) |

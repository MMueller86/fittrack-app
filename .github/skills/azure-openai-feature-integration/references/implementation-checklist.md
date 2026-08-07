# Implementation Checklist — Azure OpenAI Feature

Use this checklist when implementing or modifying an AI feature in `backend/src/`.
Load on demand; not required for every AI task.

---

## New AI Feature — Backend Checklist

### 1. Prompt module (`backend/src/lib/prompts/<featureName>.ts`)
- [ ] System prompt exported as a named const (e.g. `MY_FEATURE_SYSTEM_PROMPT`)
- [ ] Prompt version exported as a const (e.g. `MY_FEATURE_PROMPT_VERSION = 'v1'`)
- [ ] Prompt language and tone consistent with existing prompts (German output where applicable)
- [ ] No secrets, user IDs, or PII embedded in the prompt

### 2. AI function (`backend/src/lib/openai.ts`)
- [ ] New exported async function (e.g. `analyzeMyFeature(input): Promise<MyResult>`)
- [ ] JSON Schema defined as a `const` beside the function
- [ ] `additionalProperties: false` at every object level in the schema
- [ ] `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`
- [ ] `temperature: 0` (deterministic) unless stochastic output is explicitly required
- [ ] Guard: `if (!raw) throw new Error('Empty response from Azure OpenAI')`
- [ ] `getClient()` used — no direct `AzureOpenAI` instantiation

### 3. Quota registration (`backend/src/lib/quotaConfig.ts`)
- [ ] New `AiFeature` literal added to the union type
- [ ] Limits defined for `free`, `premium`, `internal` tiers
- [ ] Verify the existing `quotaConfig.test.ts` still passes; add a test for the new feature

### 4. Handler (`backend/src/functions/<featureName>.ts` or in `ai.ts`)
- [ ] `withHandler('ai.<featureName>', fn)` wraps the entire handler
- [ ] `requireUser(request)` called first inside the handler
- [ ] `parseBody(request, ZodSchema)` for POST endpoints; return `parsed.response` on failure
- [ ] `enforceQuota(user, '<feature-key>')` — return immediately if truthy (429)
- [ ] AI function called
- [ ] Plausibility validation run (if nutrition values are in the output)
- [ ] `trackUsage(user, '<feature-key>')` after successful AI response
- [ ] Response shape is a **preview type** — not a diary or profile write
- [ ] `confidence` and `warnings` included in the response if applicable

### 5. Shared types (`shared/types/`)
- [ ] New preview type defined (e.g. `AiMyFeaturePreview`)
- [ ] Type exported from `shared/index.ts`
- [ ] API reference updated: [`docs/kb/tech/09-api-reference.md`](../../../docs/kb/tech/09-api-reference.md)

### 6. Route registration
- [ ] Function module imported in `backend/src/index.ts`
- [ ] `registrations.test.ts` passes after import

---

## Prompt Change Checklist

When modifying an existing prompt:

- [ ] Is the output schema interpretation changing? → Increment version constant
- [ ] Is this a formatting/wording fix only? → Version increment optional, but document the change
- [ ] Has the JSON Schema changed? → Verify `strict: true` schema is still valid; test with real input
- [ ] Is the previous prompt version stored with any Cosmos documents? → Consider migration or backward compatibility
- [ ] Update `SKILL.md` references or Knowledge Base if the change affects documented behaviour
- [ ] Does a `*.eval.test.ts` exist for this prompt? → If yes: update `TESTED_PROMPT_VERSION` and re-review all `*.eval.fixtures.ts` constraints against the new prompt rules, then run `npm run test:eval`

---

## Schema Change Checklist

When adding fields to or removing fields from an existing Structured Output schema:

- [ ] Update the JSON Schema const in `openai.ts`
- [ ] Update the corresponding TypeScript type in `shared/types/`
- [ ] Update `additionalProperties: false` — all new object levels need it
- [ ] Verify the schema with a real OpenAI call in a dev environment before committing
- [ ] Check if the mobile client reads the field — coordinate with Frontend agent for breaking changes
- [ ] Does a `*.eval.test.ts` exist for this feature? → If yes: verify Layer-1 structural assertions still match the updated schema, then run `npm run test:eval`

---

## QA Review Checklist (AI Features)

Verify each item before issuing a verdict:

### Invariants
- [ ] `enforceQuota` called **before** the AI call
- [ ] `trackUsage` called **after** success only (not in catch/finally)
- [ ] Admin bypass and internal tier not duplicated in handler logic — handled by `enforceQuota`
- [ ] Structured Outputs: `type: 'json_schema'`, `strict: true`, `additionalProperties: false` everywhere
- [ ] API version ≥ `2024-07-01` (check `AZURE_OPENAI_API_VERSION` default in `openai.ts`)

### Validation
- [ ] Nutrition-bearing output passes through `validateNutritionEstimate()` (or equivalent)
- [ ] Hard validation errors → 422, usage NOT tracked
- [ ] Soft warnings → forwarded to client in response body

### Observability and safety
- [ ] Prompt version constant defined; incremented if output interpretation changes
- [ ] Prompt version stored with any persisted Cosmos document
- [ ] AI output is a preview — not written directly to diary, profile, or reusable items

### Tests
- [ ] Classification/scoring logic has exhaustive unit tests covering all status branches
- [ ] `__setOpenAiClientForTests` used to inject mock; reset to `null` in `afterEach`
- [ ] Test for 429 path: mock `enforceQuota` to return a response, verify AI call not made
- [ ] Test for plausibility error path: mock AI with hallucinated values, verify 422
- [ ] `quotaConfig.test.ts` covers the new `AiFeature` key
- [ ] `registrations.test.ts` passes

### Prompt evals
- [ ] Does a `*.eval.test.ts` exist for this feature? → If yes: prompt version guard passes; Layer-2 fixture constraints match the current prompt rules
- [ ] For prompt or schema changes: `npm run test:eval` has been run and all eval tests pass
- [ ] For new features: eval coverage is a gap — note it and create `*.eval.test.ts` + `*.eval.fixtures.ts` as a follow-up task

### Environment compatibility
- [ ] Local dev: `InMemoryAiUsageRepository` path exercised (no Cosmos dependency in unit tests)
- [ ] `INTERNAL_USER_IDS` guidance documented in task handoff if a developer needs to test locally

---

## Environment Notes

| Environment | Cosmos | AI Quota Storage | Notes |
|---|---|---|---|
| Local (no emulator) | Not configured | `InMemoryAiUsageRepository` | Add userId to `INTERNAL_USER_IDS` |
| Local (with emulator) | Cosmos emulator | `CosmosAiUsageRepository` | Run `scripts/start-cosmos-emulator.ps1` first |
| Alpha | Azure Cosmos | `CosmosAiUsageRepository` | Shared with Development — do not create a separate instance |

See [`docs/kb/tech/01-system-overview.md`](../../../docs/kb/tech/01-system-overview.md) for runtime environment details.

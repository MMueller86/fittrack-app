---
name: azure-openai-feature-integration
description: 'Technical guidance for planning, implementing, and reviewing Azure OpenAI-powered features in FitTrack. Use when: adding a new AI endpoint; modifying a prompt, JSON schema, or Structured Output; adding or adjusting quota enforcement; implementing server-side plausibility validation; adding or modifying AI classification logic (e.g. classifyItem); assessing whether AI is appropriate for a planned feature; reviewing an AI feature implementation (QA). Primary consumers: Planner (AI necessity decision), Backend (implementation invariants), QA (review checklist). Frontend does not load this skill directly — it receives the API contract and review screen requirements from the Planner plan and Backend summary.'
---

# Azure OpenAI Feature Integration

Azure OpenAI remains the Backend Agent's responsibility. This skill provides on-demand guidance for any task that adds, changes, or reviews AI-powered behaviour. It does not replace the Knowledge Base — it references it.

---

## Consumers and When to Load

| Role | Load this skill when |
|---|---|
| **Planner** | Requirement may involve AI; deciding AI vs. deterministic; scoping a new AI feature |
| **Backend** | Implementing or modifying an AI endpoint, prompt, schema, validation, or quota |
| **QA** | Reviewing any change that touches `ai.ts`, `openai.ts`, quota, or nutrition validation |
| **Frontend** | Does not load this skill — receives API contract and review screen requirements from the Planner plan and Backend summary |

---

## 1. AI Necessity Decision

**Identify the scope first:** Not all questions apply to every task. Work through each one and skip only those that are genuinely unaffected by the change. A prompt text fix with no output shape change typically requires only question 5. A new endpoint requires all six. Changes in between — schema additions, new output fields, new validation rules — require evaluating each question on its own merits before starting.

Before planning any AI feature, answer these questions explicitly in the plan:

1. **Is AI necessary?** Could deterministic logic (e.g. the Hint Engine in `hintEngine.ts`) produce a correct and reliable result?
2. **Advisory or authoritative?** AI output must always be advisory — shown to the user for explicit confirmation before persisting. See the core principle in [`docs/kb/domain/07-ai-features.md`](../../docs/kb/domain/07-ai-features.md).
3. **What is the failure contract?** Define behaviour for: AI unavailable, empty response, plausibility failure, quota exceeded.
4. **Which `AiFeature` key?** Identify the feature key (`AiFeature` union in `quotaConfig.ts`) or define a new one.
5. **Is a new prompt needed?** Prompts live in `backend/src/lib/prompts/`. New prompts require a version constant.
6. **What Structured Output schema is required?** All machine-readable AI responses use `response_format: json_schema` with `strict: true`. Design the schema before writing the prompt.

See [`docs/kb/domain/08-quota-system.md`](../../docs/kb/domain/08-quota-system.md) for quota tiers and bypass rules.

---

## 2. Integration Contract

### Entry points

| What | Where |
|---|---|
| Azure OpenAI client | `backend/src/lib/openai.ts` — lazy singleton, all AI calls go here |
| Prompt modules | `backend/src/lib/prompts/*.ts` — one file per feature |
| Quota enforcement | `backend/src/lib/quota.ts` — `enforceQuota()` + `trackUsage()` |
| Plausibility validation | `backend/src/lib/nutritionValidator.ts` — for nutrition-bearing AI output |
| Handler pattern | `backend/src/lib/http.ts` — `withHandler()` wraps every endpoint |

### Environment variables

```
AZURE_OPENAI_ENDPOINT          # required
AZURE_OPENAI_API_KEY           # required
AZURE_OPENAI_DEPLOYMENT_NAME   # defaults to 'gpt4o-mini'
AZURE_OPENAI_API_VERSION       # defaults to '2024-07-01' (minimum required for Structured Outputs)
INTERNAL_USER_IDS              # comma-separated; add dev userId to bypass quota locally
```

---

## 3. Critical Implementation Invariants

These rules are non-negotiable. Violating any one of them is a QA-blocking finding.

### Quota
- `enforceQuota(user, feature)` **before** the AI call — return 429 immediately if it returns a response
- `trackUsage(user, feature)` **after** a successful AI response only — failed calls must not consume quota

### Structured Outputs
- All machine-readable AI responses use `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`
- Define the JSON Schema as a const next to the function in `openai.ts`
- `additionalProperties: false` at every object level — required by the OpenAI strict mode
- API version must be ≥ `2024-07-01`

### Plausibility validation
- For any AI feature returning nutrition values: run `validateNutritionEstimate()` from `nutritionValidator.ts`
- Hard errors → return 422 immediately (do not track usage)
- Soft warnings → include in the response body; the mobile client must surface them

### Prompt versioning
- Every prompt module exports a version constant: `export const MY_PROMPT_VERSION = 'v1'`
- Increment the version when the prompt change affects output interpretation (not for typo fixes)
- Store the version alongside any persisted AI-generated document in Cosmos
- **When bumping a prompt version:** check whether a `*.eval.test.ts` exists for the feature. If it does, its version guard will fail until `TESTED_PROMPT_VERSION` in that file is updated and all fixture constraints are re-reviewed against the new prompt behaviour.

For the full per-feature implementation checklist (including handler wiring, schema changes, prompt changes, and eval test obligations), see [references/implementation-checklist.md](./references/implementation-checklist.md).

---

## 4. Failure and Timeout Behaviour

| Situation | Correct behaviour |
|---|---|
| `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` not set | `getClient()` throws — `withHandler` catches → 500 |
| Empty `choices[0].message.content` | Throw `new Error('Empty response from Azure OpenAI')` — `withHandler` → 500 |
| JSON parse failure on AI response | Throw — `withHandler` → 500. Structured Outputs prevent this in production |
| Plausibility errors | Return 422 before tracking usage |
| Quota exceeded | Return `enforceQuota()` response → 429 |
| Daily Insight failure | Never 4xx/5xx — return `{ status: 'unavailable' }` or `{ status: 'quota_exceeded' }` |

---

## 5. Local Development and Testing

- Add the developer's `userId` to `INTERNAL_USER_IDS` in `backend/local.settings.json` to bypass quota in local dev
- `InMemoryAiUsageRepository` is used automatically when Cosmos is not configured — quota resets on restart
- Inject a mock client in tests via `__setOpenAiClientForTests(mockClient)` from `openai.ts`; reset to `null` in `afterEach`

---

## 6. QA Review Requirements

For any AI feature change, load [references/implementation-checklist.md](./references/implementation-checklist.md) and work through the **QA Review Checklist** section. The non-negotiable invariants are: quota ordering (`enforceQuota` before AI call, `trackUsage` after success only), Structured Outputs schema completeness (`strict: true`, `additionalProperties: false` everywhere), plausibility validation present for nutrition output, preview type enforcement, and exhaustive unit tests for classification logic.

**Prompt and schema changes additionally require:** check whether a `*.eval.test.ts` exists for the affected feature. If it does, the QA verdict must confirm that the prompt version guard passes and that the Layer-2 fixture constraints still reflect the current prompt rules. If no eval test exists yet, note it as a gap.

---

## 7. Prompt Eval Tests

Prompt eval tests make real Azure OpenAI API calls and are intentionally excluded from the default `npm test` run.

### Test layers

| Layer | What it asserts | Examples |
|---|---|---|
| **Layer 1 — Structural** | Required fields present, correct types, non-negative values, valid enums | `category` ∈ `['food','seasoning']`, `suggestedPortions > 0` |
| **Layer 2 — Semantic constraints** | Classification correctness and amountGrams ranges from reviewed fixtures | `Knoblauch → food`, `Basilikum → seasoning`, `2 EL → 25–35g` |
| **Layer 3 — Edge-case behaviour** | Critical prompt rules that are regression-prone | `exactIngredientCount` (nothing lost/invented) |

### Conventions

| Artifact | Location |
|---|---|
| Vitest config | `backend/vitest.eval.config.mts` |
| Run command | `npm run test:eval` (in `backend/`) |
| Eval test files | `backend/src/lib/prompts/*.eval.test.ts` |
| Fixture files | `backend/src/lib/prompts/*.eval.fixtures.ts` |

### Fixture discipline

- All category rules and amountGrams ranges **must be derivable from documented prompt rules** — never invented at test time.
- Fixture files document their derivation basis (e.g. `"1 EL → ~15g"`) in inline comments.
- The prompt version guard (`TESTED_PROMPT_VERSION`) in each eval test must match the current prompt version constant. A mismatch fails immediately without making any API call.

### When to run

- Manually during prompt development to validate behaviour before committing.
- Explicitly before merging any change to `backend/src/lib/prompts/**`, `backend/src/lib/openai.ts`, or the Structured Output schema of the affected feature.
- CI integration is deferred until cost, quota behaviour, and stability are validated in manual runs.

### Golden output (optional)

Golden output comparison is **not** the default approach. Prefer rubric/constraint assertions (Layers 1–3). Golden comparison may be added later for specific prompts where exact text drift is a concern, using a separate opt-in mechanism.

---

## 8. Knowledge Base and Repository References

| Topic | Reference |
|---|---|
| Feature descriptions (Meal Parser, Food Estimator, etc.) | [`docs/kb/domain/07-ai-features.md`](../../docs/kb/domain/07-ai-features.md) |
| Quota tiers, limits, Cosmos storage, 429 format | [`docs/kb/domain/08-quota-system.md`](../../docs/kb/domain/08-quota-system.md) |
| Azure service config, OCR pipeline, Structured Outputs requirement | [`docs/kb/tech/06-ai-integrations.md`](../../docs/kb/tech/06-ai-integrations.md) |
| Handler pattern, shared import rule | [`.github/instructions/backend.instructions.md`](../../.github/instructions/backend.instructions.md) |
| Azure OpenAI client, schemas, all AI functions | `backend/src/lib/openai.ts` |
| Quota enforcement implementation | `backend/src/lib/quota.ts`, `backend/src/lib/quotaConfig.ts` |
| Plausibility validation rules | `backend/src/lib/nutritionValidator.ts` |
| Prompt modules (versioned) | `backend/src/lib/prompts/` |
| Classification logic and tests | `backend/src/functions/ai.ts` |

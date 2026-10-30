# AI Integrations

## Principle

- All AI calls are backend-only. No AI keys or direct AI calls in the mobile app. Mobile calls FitTrack backend APIs; the backend orchestrates AI.

## Azure Services

| Service | Model / Config | Purpose |
|---|---|---|
| Azure OpenAI | `gpt-4.1-mini`, Structured Outputs | Meal parsing, food estimation, recipe analysis, daily insight |
| Azure Document Intelligence | Standard / Free tier | OCR for nutrition label scan |

Azure OpenAI uses **Structured Outputs** (JSON Schema enforcement on model response) for all features that return machine-readable data. API version must support Structured Outputs (`2024-08-01-preview` or later; code default `2024-10-21` GA).

### Configuration (single source)

Deployment name and API version are resolved only in `backend/src/lib/azureOpenAiConfig.ts` (used by `openai.ts`, `labelParser.ts`, `reusableItemsEnrich.ts`, `dailyInsight.ts`, `weeklyInsight.ts`, and the eval helpers).

| Env var | Default (code) | Deployed value (Bicep, unchanged) |
|---|---|---|
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4.1-mini` | `gpt-4.1-mini` |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` | `2024-08-01-preview` |

The former `gpt4o-mini` / `gpt-4o-mini` fallbacks and the `2024-07-01` fallback were removed. The defaults only apply when the env var is unset (e.g. a misconfigured Function App); Dev/Alpha set both explicitly, so deployed behaviour is unchanged until the Alpha app setting is deliberately changed.

SDKs: `openai ^7.45.1` (resolved 7.45.1; the `AzureOpenAI` client is created from `createAzureOpenAiClientOptions()`, which throws when `AZURE_OPENAI_ENDPOINT` or `AZURE_OPENAI_API_KEY` is missing) and `@azure/ai-form-recognizer ^5.1.0` for Document Intelligence. Prompts and strict JSON schemas were not changed by the SDK upgrade. Offline wire-contract tests (`openai.wire.test.ts`, `documentIntelligence.wire.test.ts`, `reusableItemsEnrich.wire.test.ts`) check the serialized requests and response mapping without a live provider; they run in the normal Vitest suite.

Configuration sources that still differ from the code default: `backend/local.settings.json.template` sets `AZURE_OPENAI_API_VERSION` to `2024-08-01-preview`, and the legacy parameter files `infra/parameters/dev.bicepparam` and `infra/parameters/alpha.bicepparam` still set `azureOpenAiDeploymentName` to `gpt-4o-mini` (the current `dev-fittrack.bicepparam` and `alpha-fittrack.bicepparam` use `gpt-4.1-mini`). The legacy files belong to the old PRODYNA environment and were not changed. **[Open]** align or retire them.

### Platform lifecycle (retrieved 2026-10-29)

The table was retrieved from Microsoft pages on 2026-10-29. It was **not re-verified** on 2026-10-30 (no Microsoft access during the refresh handoffs); treat the dates as `UNVERIFIED` until re-checked.

| Item | Finding | Source |
|---|---|---|
| `gpt-4.1-mini` (version `2025-04-14`) | Stage **Deprecated** (still serves inference, blocked for new customers), **retirement date 2027-04-14**, no replacement named in the table. The page does not split the date by SKU; applying it to `GlobalStandard` is an assumption (UNVERIFIED per SKU). Auto-upgrade for Global Standard is Microsoft-managed; GA retirement notice is at least 60 days. Page updated 2026-09-23. | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule and https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-retirements |
| Dated API versions | Microsoft is moving to the unversioned v1 API (opt-in since 2025-08); `2024-10-21` is the latest GA dated data-plane spec. **No retirement date for `2024-08-01-preview` was found on the retrieved pages — UNVERIFIED.** `2024-07-01` is not listed as an API version in the retrieved pages (only `2024-07-01-preview`) — UNVERIFIED; it was an unused code fallback. | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle and https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference |
| `@azure/ai-form-recognizer` 5.1.0 | Not marked deprecated on npm (latest 5.1.0, no `deprecated` flag); Microsoft's Document Intelligence SDK overview lists JS 5.0.0 (v3.1 API, `DocumentAnalysisClient`) as a supported GA client next to `@azure-rest/ai-document-intelligence` 1.0.0 (v4.0). No end-of-support notice found. | https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/sdk-overview-v4-0 and https://registry.npmjs.org/@azure/ai-form-recognizer |

**Decision — Document Intelligence SDK: keep** `@azure/ai-form-recognizer`. It is neither deprecated nor unsupported, only `prebuilt-read` OCR text is used, and migrating would change the wire client without functional benefit. Coverage: `documentIntelligence.wire.test.ts` (real SDK client against a mocked HTTP layer) plus the label-parser tests. Revisit if Microsoft announces end of support.

**Decision — API version default `2024-10-21`** instead of `2024-07-01`: the old fallback is not a documented version, while `2024-10-21` is GA and supports `response_format: json_schema` with `strict: true`. The deployed Bicep value `2024-08-01-preview` is not changed here; moving Alpha to a GA version is an infra decision [Open].

### Follow-up: `gpt-4.1-mini` retirement (2027-04-14)

[Planned] Owner: Backend + Planner. Deadlines:
- 2026-12-31 — choose replacement model (Microsoft lists none) and decide E-3 successor; check Global Standard auto-upgrade behaviour.
- 2027-02-15 — run all prompt evals (`npm run test:eval --workspace=backend`) and quota/cost review against the candidate on a non-production deployment.
- 2027-03-15 — switch Alpha deployment/app settings (infra change, separate package), leaving 30 days before retirement.

### Privacy (data handling, unchanged by this configuration work)

- Sent to Azure OpenAI: user free text, label OCR text, recipe text/images, and (insights) profile/diary/weight context; no user ID or tokens in prompts. Sent to Document Intelligence: the label photo. Both are shared stateless Azure resources (`oai-fittrack-dev`, `di-fittrack-dev-hlpqe7`); OpenAI `GlobalStandard` processing is not limited to Europe.
- `docs/legal/datenschutzerklaerung-alpha.md` already lists Azure OpenAI and Document Intelligence and states Europe only for storage; this work package requires no policy change. [Open] The policy does not mention that AI processing may occur outside Europe (pre-existing; product/legal decision).

## AI Features

### 1. Meal Parser (`POST /api/ai/parse-meal`)

User describes a full meal in natural language (e.g., "200g chicken with rice and salad"). AI extracts individual items with amounts and modes. Backend searches the food catalog for each item and classifies match status.

**Flow:**
1. Enforce quota (`meal-parser`)
2. AI extracts items → `AiParsedItem[]` (rawText, displayName, inputMode, inputAmount)
3. For each item: search food catalog + user library in parallel
4. `classifyItem()` — `matched | needsSelection | unmatched` per item
5. Track usage
6. Return `MealParserPreviewResponse`

Mobile shows `MealParserReviewScreen` — user reviews matches, resolves unmatched, confirms.

### 2. Food Estimator (`POST /api/ai/food-estimate`)

User describes a single food item. AI estimates nutrition per 100g and suggests a portion.

**Returns:** `AiFoodEstimatePreview` — `{ displayName, estimatedNutritionPer100g, estimatedPortion, confidence, warnings }`

Mobile shows `FoodEstimateReviewScreen` — user can edit and re-estimate before saving.

### 3. Food Estimate Batch (`POST /api/ai/food-estimate/batch`)

Batch variant for estimating multiple items at once (used internally by meal parser flow).

### 4. Label Scan (`POST /api/ai/label-scan`)

User photographs a nutrition label. Backend:
1. Sends image to Azure Document Intelligence (OCR)
2. Passes OCR text to Azure OpenAI for structured extraction
3. Runs plausibility validation

**Accepts:** Multipart form-data, JPEG/PNG, max 4MB  
**Returns:** `NutritionLabelScanResult` — includes `ocrConfidence`, `aiConfidence`, `warnings`, `rawOcrText`

Mobile shows `LabelScanReviewScreen` — user reviews and edits before saving.

### 5. Meal Estimate (Image-based)

User photographs a prepared meal. AI estimates nutrition from the image.

**Returns:** `AiMealEstimatePreview`

Mobile shows `MealEstimateReviewScreen`.

### 6. Recipe Analyzer (`POST /api/ai/recipe-analyze`)

**Prompt versions:** import `RECIPE_ANALYZE_PROMPT_VERSION = 'v17'`;
saved-recipe preparation `RECIPE_PREPARATION_PROMPT_VERSION = 'v12'`.

Stabilization (2026-10-11): mechanical rules are enforced server-side instead of by the model (`recipePreparationOrder.ts`, `recipeImportCookingCheck.ts`, `recipeTotalTimeGuard.ts`): export steps are sorted by first source reference, Preparation `totalTimeMinutes` is nulled without source evidence, import gets up to two directed corrections for contract violations and then repairs an invalid reference trace by moving references only or fails with `422`/no usage (`RecipeAnalysisContractError`); it never drops steps or rewrites texts; tiny placeholder food amounts become `null`. Text-only overflow shortening sends each text with a measured `maxCharacters` budget (25 % below the proportional fit) and requires dropping conjunctions/target phrases instead of reordering. Each import provider call has a 30 s timeout and `maxRetries: 1`; no further correction starts after 45 s.

The import contract keeps complete source extraction and a selective export
summary in `analyzeRecipeText(text)`. Preparation uses a separate small-output
operation and exclusive prompt, not the import contract; see
[the historical and current evidence boundary](#preparation-v2-evidence-boundary).

For explicitly numbered input, import v17 requests exactly one complete ordered source `steps` entry per instruction; the five-step cap applies only to `exportSuggestion.steps`. Export has 1..5 non-empty German texts, at most 90 characters each, orders 1..K. Compression is allowed even for N <= 5. No exact-min count, padding, first-five truncation, full partition, or full-detail packing is required. Non-empty `sourceStepOrders` reference contained actions, not every detail read. Flattened references must be positive, present, globally unique, and strictly ascending; gaps within and between groups are allowed. Unknown, duplicate, or reordered references remain `422`; omission alone does not.

The request body is `{ text }`, with 10-5000 characters. The AI extracts recipe metadata, ordered source steps, normalized ingredients, and one export suggestion in the same analysis (up to two directed corrections re-send it). The mobile consumer is `RecipeWizardScreen`; the analyzer does not directly save a recipe, reusable food, or diary data.

The strict `AiRecipeRaw` contract includes `suggestedName`, `description`, positive `suggestedPortions`, `tags`, `steps`, `ingredients`, and `exportSuggestion`. Each ingredient has a unique `analysisKey`, the original `line`, a normalized `displayName`, `category: 'food' | 'seasoning'`, `amountGrams`, and `kitchenAmountText`. Every determinable food quantity is converted to positive grams, including `2 EL` → approximately `30 g`; a genuinely indeterminate food amount such as unmeasured spray oil must be `amountGrams: null`, never a tiny positive placeholder, and is routed to manual review. Seasoning amounts may also be null only when genuinely indeterminate. Food and seasoning routing is performed by the backend without re-running the general meal parser, preserving the analyzer's kitchen-unit conversions. Complete source extraction remains separate from selective export references.

The current `exportSuggestion` contract retains the existing shape:

```ts
{
	version: 1;
	teaser: string;                  // 1-96 characters
	totalTimeMinutes: number | null; // positive integer, at most 10080
	difficulty: string | null;        // non-empty, single-line value when known
	steps: Array<{
		order: number;
		description: string;            // 1-90 characters
		sourceStepOrders: number[];
		ingredientKeys: string[];
	}>;                               // 1..5 entries
	includedIngredientKeys: string[]; // unique, source order, at most 20
}
```

`totalTimeMinutes` and `difficulty` remain nullable when no reliable value can be derived; no default may be invented. Export orders are contiguous from 1, `ingredientKeys` reference existing `analysisKey` values, and `includedIngredientKeys` cannot reference seasonings. Import runtime checks positive unique ascending source orders and the ordered unique subset trace, not general cooking semantics. It enforces min1/max5, non-blank descriptions and max90; the unchanged import provider schema carries max5/max90. Neither path sorts, renumbers, or repairs IDs.

Both prompts request the recipe-specific cooking core: central preparation/cooking, essential separate sides or sauces, and necessary transitions. Details may be omitted; retained claims must fit the source/component without invention or contradiction. No general serving/detail duty or safety guarantee follows. Full source-extraction tests remain separate from small fixture-specific export-core rubrics. The chicken/rice fixture requires chicken preparation, frying, independent rice cooking, and finish-cooking. Valid IDs and text lengths do not prove these actions; explicit user review remains required.

Azure OpenAI is called with Strict Structured Outputs (`json_schema`, `strict: true`, `additionalProperties: false`). The handler enforces the `recipe-analyze` quota before the provider call and tracks usage only after shape/reference/ingredient validation, not after a general cooking-quality check. Quota exhaustion returns `429`; provider, empty-response, or JSON-parse failures return `502`; rejected server-validation results return `422` without usage. The response is transient; only a later explicit user-confirmed write can persist accepted export data.

**Used by:** `RecipeWizardScreen` on mobile.

#### Preparation V2 Evidence Boundary

`POST /api/recipes/{id}/export-view/prepare` calls backend-only
`prepareValidatedRecipeExport(context)` using `prepareRecipeExport(context, options)`
with `RECIPE_PREPARATION_SYSTEM_PROMPT` v12.
`analyzeRecipeText(text)` is import-only: v17 prompt body, full `AiRecipeRaw`
Strict schema, ingredient normalization/validation and globally ascending
flattened trace are unchanged. Preparation does not append to the import prompt.
Its user message contains the complete ID-free `recipeContext` projection
(name, optional description, portions, tags, every ingredient's displayName,
amountGrams, inputAmount, unit) and all saved steps in original array order
with unchanged `order`, optional `title` and `description`. This JSON is
untrusted recipe data; the system prompt supplies the trusted compact-detail-
image task. No saved IDs or provider-returned source reconstruction are used.

The dedicated Strict `recipe_export_preparation` schema returns only backend-only
`RecipeExportPreparationOutput`:

```ts
{
	version: 1;
	teaser: string;
	totalTimeMinutes: number | null;
	difficulty: string | null;
	steps: Array<{ order: number; description: string; sourceStepOrders: number[] }>;
}
```

Every field is required and every object has `additionalProperties: false`.
There is no name, portions, tags, ingredients, ingredient key, source-step list,
full-recipe wrapper, renderer payload or intermediate output. The same lazy
client, deployment/API version, temperature 0.2 and max_tokens 2048 remain.
Initial generation plus at most two corrections replaces the former single-call
behavior; no hidden SDK retry, fallback, sorting, padding, truncation or identity
repair is added. See [the current loop contract](#preparation-feedback-loop-current-r3-qa-r1).
Shared min1/max5/text90/teaser96/time10080 constants drive the prompt/schema and
server checks. Time is nullable or a positive integer; difficulty is nullable
or trimmed non-empty single-line text.

`validateRecipeExportPreparationOutput(output, recipe.steps)` checks the small
output and separate saved source. Source orders are positive, unique and
ascending, not necessarily contiguous; export orders are 1..K. Each non-empty
reference group is known and locally strictly ascending, all references are
globally unique, and groups ascend by FIRST reference. The flattened trace
need not ascend: `[1,4,6],[5]` is valid for Preparation, `[5],[1,4,6]` is not;
the former still fails import's unchanged global-monotone rule. Gaps are valid;
full coverage and adjacent-only grouping are not required. Unknown/duplicate
references, local/group-start reversals, invalid source orders, empty text,
metadata/limit violations and extra fields are rejected; exhaustion returns
422 without usage. Empty saved
steps or exclusively blank source descriptions returns 422 before quota/provider
work; no invented reference-based fallback is allowed.

The v12 prompt asks for a complete understandable compact detail-image workflow:
read the full recipe and group related actions instead of selecting five original
steps. Central preparation, full cooking of the main component, essential
separate sides/sauces and necessary transitions must remain; optional details/
serving may be omitted. Retained claims/metadata must be source-backed without
invention or component contradiction. This is prompt intent, not proof of model
causality or universal preservation. Runtime checks shape/references/limits,
not cooking-core completeness, component fit or metadata derivation. Test-only
fixture rubrics and explicit user review remain separate.

The App API remains the strict `{ "contractVersion": 2 }` request and plain V2
response with `sourceEtag`, teaser, nullable metadata and `{ order, description }`
steps; references stay internal. No ingredient IDs/keys/resolution states are
returned. Preparation does not persist suggestions or change saved ingredients,
export confirmation, fingerprints, Save/Share, Shared, Mobile, Cosmos,
infrastructure or dependency versions.
Auth, optional ETag before quota, `429`/`502`, usage only after valid success,
privacy-safe bounded phase/code/path diagnostics, and transience are retained.
Coverage-only payload/order-list/mismatch helpers remain removed. Only terminal
correction exhaustion permits exact latest affected known generated text in
server logs, as specified below; private context/provider/error payloads remain excluded.

<a id="preparation-feedback-loop-current-r2"></a>

The old r2 anchor is retained for immutable historical links; the current
publication below is r3 / QA-R1, not retrospective r2 acceptance.

##### Preparation v12: Total-Time Provenance Fix

QA's oven40/pasta25 findings were reproduced against v11 with direct live
Preparation calls. v12 keeps the same API/schema, quota and bounded correction
budget. Both full-output prompts begin with `totalTimeMinutes = null` and require
a concrete source-evidence check before returning a number. Every necessary
action must be timed and the entire workflow explicitly sequential unless an
explicit source total exists. Step numbering and "separat" do not establish
sequence; even two timed components without explicit sequence require `null`.
Cooking durations remain in the export steps rather than becoming a total.
The focused live regression covers the saved rice/oven/pasta sources, an explicit
50-minute total, a fully timed sequential 15-minute workflow, and two components
with unclear sequence. This does not add semantic runtime validation or claim
universal model reliability, independent QA acceptance, or deployment.

##### Historical Preparation v11: Final Q-21 Correction

The recipe-sharing prompt review separates initial Preparation from correcting
an existing export draft. `RECIPE_PREPARATION_SYSTEM_PROMPT` v11 contains creation
instructions only. Structural/reference or mixed failures use
`RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT` v11 with the existing
`{ originalPreparation, latestDraft, validationErrors }` payload. It requests
only changes needed for the reported errors, not a new suggestion. Both prompts
reuse the same output rules. Pure measured overflow retains the short text-only
prompt and strict `texts` response; multiple target texts share one call.
Mixed errors are corrected together in one full-draft call to avoid separate
reference and shortening calls. The initial-plus-two-corrections budget, SDK
options, schema, quota, validation and public API are unchanged.

Import v17 remains one analysis including the export suggestion: separating
it would add another call. Corrections of an invalid import response re-send the same analysis (max. three provider calls, usage tracked once after validation). Share-bundle and both image renderers make no AI calls
and have no prompts. No unrelated AI prompt or recipe-scaling flow was changed.
Preparation v11 retains explicit source cooking-endpoint preservation in all three
prompt paths, including text-only shortening. A cooking duration does not
replace a doneness condition. Total time requires an explicit source total or
a completely timed, explicitly sequential workflow. Untimed work, preheating,
resting or unclear overlap requires `null`, not guessed additions or component
sums. Independent fixture metadata assertions require `null` for rice, oven,
pasta and forced dough, including the manual oven case. No semantic runtime
validator, wording literal, retry, renderer or API change is added.

[Partial] CORR1 v10 (2026-10-10) failed independent F2/5, R11/14, G38/42.
The second and final candidate v11 decides total time before compression from
the complete source; dropping untimed work does not authorize a total. Source
examples distinguish explicit50/sequential15 from unsupported component sums.
Essential separate cooking and endpoints take priority over optional details;
FIRST-reference checks and free grouping remain unchanged. Corrections cannot
treat latestDraft as evidence or preserve its unsupported metadata/core loss.
Text-only shortening removes optional phrasing before essential cooking.
Final-candidate F/R/G await independent QA. Oven remains
`MANUAL VALIDATION REQUIRED`; no human sign-off or deployment is claimed.
All dated v9/v8/v7/v6 evidence below remains historical, not proof for v11.

##### Historical Preparation v9 Evidence (2026-10-09)

The full live eval on 2026-10-09 returned 41 passed and 1 failed (exit 1), recorded
in `backend/output/recipe-preparation-v9-separated-prompts-eval-2026-10-09.json`.
All 14 recipe assertions passed (8 Import fixtures, 4 Preparation fixtures and
2 version guards). Rice passed with one SDK call and source groups
`[1,2],[3,4],[5],[6],[7,8]`; oven passed its technical checks after two SDK calls
with groups `[1],[2],[3],[4,5],[6,7]`. Its manual-review output retains slicing,
greasing, assembly with cream in source group 3, cheese/preheating and
source-backed 180 C / 40-minute baking followed by resting. This is observed
output, not an automatic semantic gate or release approval. Pasta used one SDK
call. Forced dough overflow used one real text-only SDK call (two logical loop
calls including the synthetic initial draft). All four returned HTTP 200, booked
usage once, made no writes and preserved saved source. The only full-suite
failure was unchanged Weekly Insight `special-activity-under-effective-target`
(`UNVERIFIED`, not `CORRECT`). Backend units: 1607 passed; typecheck and
build:verify passed. Full-suite/release acceptance remains blocked; no deployment
was executed and historical FAIL records were not changed.

##### Preparation v8: Simplified Grouping and Order Guidance

Preparation v8 keeps the v7 text-only shortening path and simplifies
grouping/order guidance: the AI selects actions to combine, may omit
self-explanatory steps and secondary details, and is instructed to keep the
original order of retained actions. No adjacent-only grouping restriction was
added. FIRST-reference order corrections explicitly request moving whole export
steps, keeping their texts/references and renumbering orders 1..K. Validation,
fonts, templates, schema, budgets, Import v16 and public contracts are unchanged.

The full live eval on 2026-10-09 returned 38 passed and 4 failed (exit 1), recorded
in `backend/output/recipe-preparation-v8-order-eval-2026-10-09.json`. Rice and oven
still violated FIRST-reference order after two corrections and returned HTTP 422
without usage bookings or writes. Pasta passed; forced dough overflow passed
with one real text-only correction. The other failures were in unchanged Import
v16 (`explicit-quantities-with-unit-conversion`) and Daily Insight (`stale-weight`).
Thus the simplified instructions do not establish reliable order correction;
release remains closed. Backend unit tests: 1606 passed; typecheck and
build:verify passed. Recorded v6/v7 results remain historical evidence.

##### Preparation v7: Text-Only Overflow Correction

The v7 implementation adds a user-requested narrow correction path. When all
current diagnostics are `template:TEMPLATE_FIELD_OVERFLOW`, the provider sees
only `{ texts: [{ text, actual, bounds }] }` and the short
`RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT`. No original recipe, ingredients, latest
whole draft, references, fonts or unrelated fields are sent on this path.
Width-only overflow omits height rather than inventing it. One strict
`recipe_text_correction` response supplies exactly one non-empty string per
target, in matching order. The server merges only the affected teaser/step text
into a cloned draft, then the existing loop validates and probes the entire
result. One call covers all overflow fields; the initial-plus-two-call limit,
deadlines, cancellation, quota, source immutability and failure logging remain.
Structural/reference and mixed failures still use full-draft correction.
Malformed shortening responses terminate as provider failures without applying
partial edits. Import v16, public contracts, template and fonts are unchanged.
This intentionally replaces the full-context correction requirement for pure
overflow only. Historical v6 results below are not reclassified and do not
certify v7 or authorize a deployment.

The authorized full live eval on 2026-10-09 executed 42 tests: 38 passed and
4 failed (exit 1). The forced dough overflow used one real text-only correction:
the mixing sentence became `Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz
vermischen.` and measured 84 px high instead of 112 px against a 105 px limit.
The handler returned 200 with usage 1 and no recipe writes; the existing dough
semantic rubric still failed because that sentence no longer contains `Teig`.
Rice returned 422 after three calls due to FIRST-reference 6 before 5; this was
not a text-fit success proof. Oven passed technical checks with manual content
review outstanding; pasta passed. Other failures were the unchanged import
fixture's missing export reference 6 and Weekly Insight special-activity
semantic status UNVERIFIED. Overall live gate remains failed; no deployment.
Results: [v7 live eval report](../../../backend/output/recipe-text-correction-v7-eval-2026-10-09.json).

The user subsequently removed the literal `Teig` requirement from the mixing
step's eval rubric. Mixing, ingredient preservation, shaping and source-backed
baking checks remain; the mixing sentence need not repeat the dough label.
The targeted live rerun passed both the forced-dough case and preparation
version guard (2 passed, 0 failed, 12 selection skips). This does not reclassify
the full-suite result above or close the remaining rice/import/Insight issues.
Results: [dough rubric live rerun](../../../backend/output/recipe-text-correction-v7-dough-rubric-eval-2026-10-09.json).

##### Preparation Feedback Loop: Recorded r3 QA-R1

[Partial] B-1 probe and B-2 r3 / QA-R1 loop are implemented, NOT ACCEPTED; B-2 status is
`IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED`. Completed handoff
evidence satisfies D-1's implementation/evidence dependency only, not failed
gates, semantic acceptance, independent QA or release; release is CLOSED. The loop is NOT deployed
to Alpha. The [14:12 Alpha release](../../../infra/release-records/Recipe-Step-Overflow-Logging_Alpha-Functions_2026-10-09.md)
deployed targeted Share step-overflow logging only, not this later loop.

The recorded v6 `recipePreparation.ts` owns initial plus at most two corrections. Initial JSON
keys are `recipeContext` and `steps`; correction keys are `originalPreparation`,
`latestDraft` and `validationErrors`. Each correction has the unchanged complete
ID-free saved context, exact latest whole draft and current safe structured
diagnostics (path/index/order/count/layout, constraints, numeric references,
font and measured/allowed bounds with 0.5 px tolerance when available). Original,
draft and error values are untrusted data. The whole corrected output is
validated and all measurable teaser/steps reprobed with production fonts and
layout, including changed counts and previously fitting fields. Unmeasurable
shapes are rejected, never certified as fitting. Technical probe/context/font
failures, duplicate/absent/non-finite measurements terminate before correction.

Preparation v6 changes only correction guidance: zero-based path/index versus
displayed step order, measured overflow despite a legal character count,
rewording the diagnosed field rather than fitting neighbours, and preservation
of source actions/parameters/references. The deterministic recorded-oven replay
uses an injected shorter final draft; it is not provider-success evidence.

Existing 1..5 steps, step90/teaser96/time10080 and template rules remain. Large
1..4-step geometry is 302x105 at 22 px; compact five-step geometry is 318x84 at
18 px. Existing title-dependent teaser selection 22/21/20/19/18 remains, not a
new fallback. No universal 23-character/11-character-word cap, three-line
product rule, truncation, layout fallback or ingredient-omission strategy is
introduced. Probe success covers only generated teaser/steps in saved-title
context, not ingredients/title/chips/photo/full render or Share. Cooking-core,
ingredient fidelity and contradiction checks remain independent fixture rubrics
and explicit user review, not a runtime semantic guarantee. Import v16 and its
single-call schema/normalization/reference policy are unchanged.

QA-R1 diagnostic font metadata is production-derived: large steps 22/1.25,
compact steps 18/1.17 and italic teaser/1.25. This corrects metadata, not fonts,
measurement or layout. Width-only failures still have no invented height.

The monotonic aggregate generation/validation/probe deadline is 75000 ms; each
provider call uses at most `min(20000, remainingMs)`, SDK `maxRetries: 0` and
AbortSignal. Bounded provider/probe awaits clean up timers, abort pending work
and discard late results. Provider refusal/incomplete finish, empty/invalid
response and timeout are terminal generic 502, never content-correction signals.
Technical probe, lookup/quota-backend and booking failures are generic 500.
Three completed parsed invalid drafts exhaust into the existing 422 envelope
with at most eight deduplicated phase/code/path details; no raw text, measurement
payload or private Error.message is echoed over HTTP. Auth, strict V2, owner
read, optional ETag and saved-source validation precede quota/provider work.
Quota is enforced once; usage is booked once only after full valid success and
the final deadline check. Booking is awaited, never raced/retried; a late result
cannot start booking. No recipe/export/image/diary writes or automatic saves
are added; V2, sourceEtag, confirmation, fingerprint and ETag contracts remain.

Only `recipes.prepareExportView.correctionsExhausted` after two completed
corrections logs exact latest affected known step descriptions, teaser or
difficulty plus safe structured errors/bounds. JSON escapes exact text; the
summary and per-field diagnoses are limited to eight, with truncation flags.
Text itself is exact, not truncated; no blanket payload-size bound is claimed.
No source/context, old/unaffected text, arbitrary object/provider payload,
image/base64 or secret is permitted. Success and other terminal failures keep
metadata-only logs; the exception does not broaden Import, other flows or HTTP.

QA-R1 excludes `unrecognized_keys` diagnoses from content eligibility and keeps
nonstring affected values metadata-only. Genuine known-string failures still
retain exact latest affected text. Q1-01/02 local regressions pass; all local
corrections remain pending independent QA and no finding closure is claimed.

Q1-04's test-only pasta rubric no longer crosses `und` from separate salted-water
cooking into later sauce mixing; cooking in sauce and component/time swaps
remain negative. Q1-05's whole-ingredient equivalence is limited to the exact
unchanged full single-stage dough source and a narrowly anchored whole-set
mixing statement. Partial omission, exclusions, invention, staged/other-component
text and wrong/missing baking core remain negative. These are tested local
rubric repairs, not a universal semantic validator or shortening strategy.

Recorded r3 / QA-R1 evidence, not D-1-R1 reruns: focused 519/519, full units 1600/1600,
typecheck/build exit0. Required F exit1: 5 executed / 2 passed / 3 failed /
9 skipped. R/G are NOT_RUN_REQUIRED_LIVE_FAILURE, not dispatched or passing.
F has four fixtures plus the passing v6 version guard, 10 logical calls
including one forced initial draft, and 9 actual SDK calls:

- Rice: 3 logical / 3 SDK calls, final 422/usage0/fit=false; FIRST starts 6
	before 5, indices1/2 also 300x112 versus 302x105; semantics NOT_REACHED.
- Oven: 3 logical / 3 SDK calls, final 200/usage1/fit=true; independent semantics
	FAIL because source-3 cream action moved into the source-4 group.
- Pasta: 1 logical / 1 SDK call, final 200/usage1/fit=true, independent semantics PASS.
- Forced dough: 3 logical / 2 SDK calls, final 422/usage0/fit=false; literal mixing
	text repeats at index0, 300x112 versus 302x105; semantics NOT_REACHED.

The immutable r2 F remains FAIL (focused495/full1576; 8 logical/7 SDK calls).
QA independently proved its pasta contradiction regex false positive and dough
literal-name requirement beyond demonstrated fidelity, not actual cooking
corruption or ingredient loss. Neither local repairs nor the new pasta pass
retrospectively make r2 PASS. New oven fit/200/usage is not semantic acceptance;
rice/dough diagnostics do not execute the unreached semantic assertions.

All recorded sources stayed unchanged and write counts were zero. Q-19 FAIL,
earlier accepted-rice fidelity loss, foreign Import/Daily failures and private/
Alpha replay limits remain open; no foreign flow was fixed or newly verified.
The [B-2 r3 handoff](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Handoff_2026-10-09-r3-QA-R1.md)
and its [53-artifact manifest](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r3-QA-R1.json)
bind recorded commands/output/report hashes. Candidate SHA-256 is
`59c7d826f4b0188ed82ee675ba20e787e5aa30f8459ea7680c7f364a6bcbed44`.
Offline records predate final freeze and have no candidate-hash execution guard;
D-1-R1 is an authorized post-freeze publication-only delta, not a runtime edit.
The [Q-1 report](../../qa/reports/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md)
reviews r2, not independent acceptance of r3; the QA register is unchanged. See
[testing boundaries](08-testing.md#recipe-preparation-feedback-loop-evidence)
and the [D-1-R1 handoff](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Handoff_2026-10-09-r1.md).
Historical evidence below is unchanged in meaning, not reclassified as PASS.

[Partial] Historical B-19 evidence (2026-10-09) from the complete
[handoff](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Handoff_2026-10-09.md),
[manifest](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Manifest_2026-10-09.json)
and linked offline/live records: Preparation v4 / Import v16 is implemented,
NOT ACCEPTED (`IMPLEMENTED_LIVE_GATES_FAIL_STOP_FOR_DECISION`). Genuine
test-first evidence and offline gates passed: 356 focused, 140 validator,
1437 backend units, 2 offline version guards, typecheck/build. These are B-19
results, not D-19 runs or independent QA acceptance.

Frozen F/R/G each ran once and exited 1; all three Preparation fixtures executed
in each gate. F: 4 executed/2 pass/2 fail/9 intentional selection skips.
R: 13 executed/10 pass/3 fail/0 skip. G: 41 executed/35 pass/6 fail/0 skip.
No gate was all-skipped, aborted or an exit-2 credential failure.

- Saved8 rice: `[1,2],[3,4],[6],[5],[8]` fails first-reference order (6 before 5),
	`semantic:export_source_trace_not_ascending@steps`. Core text/references appear,
	but this is not the allowed `[1,4,6],[5]` grouping. Actual 422/usage0/writes0/
	unchanged=true in F/R/G.
- Oven: `[1,2,3],[3,4],[5,6],[7]` repeats reference 3,
	`semantic:duplicate_export_source_reference@steps`. Observed 180C/40min is
	source-backed but does not make the duplicate valid. Actual 422/usage0/
	writes0/unchanged=true in F/R/G.
- Pasta: `[1,2,3],[4],[5,6],[7]` passes with 200/usage1/writes0/unchanged=true.
	Core/contradiction and V2-body/quota-order/usage-order/no-private-ID/no-write
	assertions execute and pass in each gate; G legitimately omits numeric pasta time.

For rice/oven, request/quota-order/one-call/no-write/saved-source checks execute,
then validation-success fails. Later V2-success-body/usage-order and final
semantic assertions are NOT reached. Usage0 is a captured observation, not a
later executed success assertion. Post-capture diagnostics do not retroactively
execute live assertions. Complete cooking-core/success-path proof for all three
fixtures remains unmet; metadata derivation is not independently proven by the
structural/core checks. R also fails the separate import trace `[4,3]` (7/8
imports pass); G passes 8/8 imports but fails four unrelated Daily cases.
No Import/Daily repair, historical finding closure, overall PASS, repair retry,
second candidate, v5 or deployment was established by that B-19 evidence.

[Partial] The [B-16 handoff](../../User%20Stories/Reciepe/B-16_Recipe-Preparation-v2_Handoff_2026-10-09.md)
records passing request isolation and offline gates (294 focused / 1407 full
unit tests, typecheck, build), not a live content PASS. Serial run 1 is FAIL:
export IDs cover 1..7 instead of 1..8; serving, medium heat, and covered resting
are missing. The real handler returns `422`, usage is 0, provider calls 1.
Runs 2/3 stopped and remain UNVERIFIED. The separate Recipe eval has eight
import failures plus preparation FAIL; the overall eval is 12 FAIL / 27 PASS,
including unrelated Daily Insight failures. Partly unavailable overall raw
evidence and unreached success assertions remain UNVERIFIED. Live FAIL blocks
completion/release; QA and open gates are not closed by this documentation.

Source binding already worked in v15 despite missing export text. No proven
model cause, prompt dominance, or token shortage follows; both fully captured
responses finished with `stop`, not `length`. The private original recipe and
deployed revision are missing: MANUAL VALIDATION REQUIRED, no history replay.
At D-16, PO-1 exact-count remained unresolved. The explicitly approved v18
contract now replaces exact-min/full coverage with min1/max5/partial trace;
this does not reinterpret historical FAILs. B-1 reversions and the three
unattributed import hunks PR-07/08/10 remain preserved, with origin unresolved;
no historical restoration is claimed.

[Partial] New evidence on 2026-10-09, separately from B-16: the
[B-18 handoff](../../User%20Stories/Reciepe/B-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md)
and its repository-backed offline/live evidence record implemented v16/v3.
Recovery offline gates passed (102 validator, 288 focus, 34 renderer, 1397
normal units, version guards, typecheck/build/diff); these are B-18 results,
not D-18 runs or independent QA. The reconstructed Red/Green comparison is
explicitly a replay; original Red/live chronology remains UNVERIFIED.

The three newly authorized frozen-candidate live calls had exits 0/1/1:
focused Preparation skipped ALL tests (UNVERIFIED, not PASS); separate Recipe
passed 8/8 imports and 2/2 guards but failed Preparation; overall failed the
same Preparation plus two unrelated Daily checks. In both Preparation outputs,
Source1..8 passed, export references were only 1..5, and core6/finish-cooking
was absent. Observed status200, SDK1/analyze1/usage1, writes0 and unchanged=true
do not constitute a quality PASS. Later text-only-V2-body/usage-order assertions
were not reached. Unreported raw data/call counts are not reconstructed.
All 641 protected paths stayed unchanged during those calls; D-18 updates KB
after that evidence, without changing the candidate.

[Partial] Subsequent evidence on 2026-10-09: independent
[Q-18A](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md)
returned FAIL. The single authorized
[B-18C correction](../../User%20Stories/Reciepe/B-18C_Recipe-Kurzfassung-Review_Korrektur_Handoff_2026-10-09.md)
addresses only FT-QA-2026-072 / Q18A-RUBRIC-FALSE-NEGATIVE-002 within K4/K6:
the Source6 test contradiction regex no longer treats rice in the serving
clause as the cooking component. Ten added regressions include the positive
finish-cooking/serving combination with references [6,8] and allowed gap7;
missing core/reference6, wrong components, time, swap, and invention remain
negative. This is a fixture correction, not a new grouping restriction or
universal parser. Production import v16/preparation v3 and all runtime
contracts are unchanged.

B-18C records genuine new test-first Red/Green (1 FAIL/9 PASS before the regex
fix, 10 PASS after), 112 validator / 298 focused / 1407 normal unit tests,
2/2 offline version guards, typecheck and build PASS. These are Backend
results, not independent acceptance or D-18C test runs. Its single executed
F/R/G gates all exited1: F Preparation FAIL/guard PASS; R 2 FAIL/9 PASS
(Preparation missing finish-cooking and numbered import missing core6);
G 2 FAIL/37 PASS (Preparation missing finish-cooking and unrelated Daily
stale-weight failure). Preparation still observed 200/one call/usage1/no
writes/unchanged source; later V2-body/usage-order assertions were not reached.
The B-18 focused all-skipped UNVERIFIED remains historical, not overwritten
by the executed B-18C focus. B-18C records 85/85 protected paths unchanged;
no correction or closure of Findings001/003/004/005 is established.

[Partial] Independent Q-19 review returned FAIL and remains unresolved;
feedback-loop QA and final package/merge/release gates remain unverified/blocked.
Historical Q-18A and v18 follow-up reports are not rewritten or
superseded as acceptance evidence by D-19. Further provider/prompt/policy work
requires a new authorized package; STOP FOR DECISION, no rerun-until-green.
The Orchestrator owns further bounded work and the
existing FT070 registry discrepancy; no registry closure or all-clean claim.
Q-18R's additional simplification disposition remains No-op beyond K-1..K-8.
No private-original replay, Alpha, deployed revision, or Save/Share environment
success is established. Documentation of implemented code despite FAIL does
not waive quality gates or guarantee safe cooking.

The backend resolves the analyzer's normalized food names directly against the catalog. It does not re-run the general meal parser, so the analyzer's kitchen-unit conversions remain attached to the matching food.

### 7. Reusable Item Enrichment (`POST /api/reusable-items/{id}/enrich`)

After a user creates a reusable item, the backend enriches it asynchronously by generating:
- `searchTerms` — alternative search queries
- `aiKeywords` — keywords for auto-matching in meal parser

A timer trigger (`reusableItemsEnrichScheduler.ts`) processes pending enrichments in batch.

### 8. Daily Insight (`GET /api/ai/daily-insight`)
[Current] The active candidate is release v30 / prompt v29 / assembly v13,
fingerprint `sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb`.
The summary contract is 5,000 characters. Earlier prompt v28 added a shared-tone
rule that the `title` omits weight, trend, and kg when the last measurement is
more than 14 days old, plus shared macro-guard guidance for protein above the
range (no warning up to 2.5 g/kg, an optional calm food-choice note at or above
2.5 g/kg). Prompt v29 removes CTA/navigation fields. The runtime validator
checks only the strict schema, the greeting/short-insight structure, and that
calorie numbers were supplied; the
keyword semantic rules and the validator-keyed correction/fallback branches in
`generateDailyInsight` were removed on 2026-10-20 (one generic correction retry
remains for a rejected response). Ten consecutive Daily-only live runs passed
for the previous v29/prompt-v28 candidate; the eval asserts structure and
supplied numbers only. The user accepted that prior state as the B-1 basis on
2026-10-20. The v30/prompt-v29 evaluation remains pending. Weekly Insight is independent and its
diagnostic is excluded from the US-03 gate. See the
[central rulebook](../domain/09-daily-insight.md) for product behavior and the
[current B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md)
for gate evidence.

The Daily Insight is a once-per-day AI-generated personal briefing. The
endpoint keeps the user-facing failure contract at HTTP `200`: quota and
context/provider failures return a friendly `quota_exceeded` or `unavailable`
`InsightResponse` instead of exposing a `4xx`/`5xx` AI error. A context read
failure does not call the provider, persist an incomplete insight, or consume
Daily quota.

**Request and local-time boundary:**
- `date` is the required explicit real local calendar date used for cache and
	context. Missing, malformed, or calendar-invalid values return HTTP `400`
	before context, cache, quota, or AI work.
- `localHour` is optional and is accepted only as an integer from `0` through
	`23`. Missing, non-integer, or out-of-range values become `null` and produce
	an unknown activity status when an activity exists.
- `timezoneOffsetMinutes` is required and means local time minus UTC (for
	example, UTC+2 is `120`). Only integer values in `[-840,840]` are valid.
	Missing, fractional, or out-of-range values return HTTP `400` before
	context, cache, quota, or AI work; the handler never substitutes a backend
	UTC date, UTC hour, or UTC expiry.
- With a valid offset, current-day detection compares the requested date with
the offset-adjusted local date. A past requested local date yields
`dailyActivityStatus: completed`; a current-day activity is `completed` only
for local hours `22..23`. All other present activities are `unknown`. A newly persisted Daily insight expires at the
	next local midnight represented as UTC, with Cosmos `ttl` set to the ceiling
	of the remaining seconds. The normalized offset is included in the input
	hash, so a changed normalized offset follows the normal cache regeneration
	rules.
- This local date and local-midnight handling affects Daily Insight semantics
	only. Technical timestamps and instants remain UTC; the prompt, Structured
	Output schema, and quota/usage semantics remain unchanged.

**Input context and deterministic routing:**
- `InsightInputContext` contains the current date/day context, weight and goal
	data, progress-intelligence signals, current nutrition and effective target,
	and the last three completed diary days.
- A present `MealItem` is valid nutrition data even when its calories or macros
	are `0`; a day without a MealItem remains `null` rather than an invented
	zero. Historical days carry their own nutrition, activity and target data.
- Historical calorie targets resolve snapshot-first: a valid
	`DayMeta.calorieTargetSnapshot`, then the compatible stored
	`specialActivity.dailyCalorieTarget`, then a read-only `profile_fallback`
	unless a special activity has no usable stored target. The fallback is never
	persisted or presented as a historical fact.
- The server selects exactly one `InsightIntent` deterministically, in this
	order: `activity_focus` for any present activity; `weight_signal` for a
	strong plateau/milestone/recovered-phase signal; `phase_progress` for
	`phase_context`; `morning_orientation` before 10:00 with no current
	MealItem; `nutrition_guidance` with current nutrition and targets; otherwise
	`general`. The AI cannot change the selected intent.
- With an activity, `dailyActivityStatus` is `completed` for a past local date
or a current-day local hour of `22..23`; otherwise it is `unknown`. Without
an activity the status is `null`. The provider must not infer planned or
likely-completed states; the persisted `SpecialActivity` type is unchanged.
- The active composition root is `backend/src/lib/prompts/dailyInsightPrompt.ts`;
	its append-only release history is in
	`backend/src/lib/prompts/dailyInsightPromptManifest.ts`. The active release is
	v30 (`DAILY_INSIGHT_PROMPT_VERSION = 'v29'`, assembly v13) with fingerprint
	`sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb`;
	earlier fingerprints and contract history are in the
	[Daily Insight history archive](../archive/daily-insight-history-2026-10.md).
	`promptVersion` plus `promptFingerprint` form the release identity, and
	`systemPromptHash` additionally hashes the exact context-dependent
	`promptSnapshot.system` sent for the selected intent. The exact system prompt
	plus serialized user message are persisted as `promptSnapshot`.
- Azure OpenAI uses Strict Structured Outputs with `json_schema`,
	`strict: true`, all properties required, nullable optional values, and
	`additionalProperties: false`. The server additionally validates the
	response and rejects provider truncation/content filtering, empty or invalid
	JSON, an invalid greeting or short-insight structure, and
	calorie numbers that were not supplied in the context. Wording is not validated
	at runtime (since 2026-10-20).
- In the same single provider call as the full text, v19 requires non-empty
	`greeting` (maximum 120 JavaScript string units) and `shortInsight` (maximum
	240). Greeting is exactly `Hallo, <context.displayName>! <one emoji>` with
	the existing server fallback `Sportler`, never time-dependent. Zod checks
	trimmed lengths; runtime checks the exact name/prefix and one emoji sequence.
	The short sentence must have a sentence terminator, no extra sentence,
	ellipsis, list, Markdown or newline; common German abbreviations and decimal
	points do not count as sentence boundaries. These are structural heuristics,
	not a proof of grammatical completeness or semantic fidelity. The prompt
	asks for a complete German sentence grounded only in server context,
	consistent with the full text and without new advice/facts. The generator uses
	temperature `0`, one Strict Structured Output call, and the unchanged 400-token
	budget, with one generic correction retry for a rejected response. The live eval
	asserts structure and supplied numbers only; wording is reviewed manually.
- Invalid/missing/partial new provider fields fail before persistence and usage
	tracking; no client-side summary or repair is generated.
- The public response contains the compact greeting/short-insight pair, `title`
	(maximum 40 characters), `summary` (maximum 5,000 characters), optional
	`recommendation` (maximum 240), `generatedAt`, `promptVersion`, and `status`.
	The provider schema uses nullable optional fields; the public response omits
	optional fields whose value is `null`. Daily Insight has no CTA/navigation
	fields.
- Prompt rules (not runtime-validated since 2026-10-20): with
	`daysSinceLastMeasurement > 14` weight and trend are stale (day 14 remains
	current) and are omitted or marked (`veraltet`, `nicht aktuell`), and the `title`
	does not mention weight, trend, or kg. `remainingCalories` is only the
	target-relative difference between logged intake and the effective target, never
	a measured deficit/surplus. `activity_focus` may state exact intake, effective
	target, remainder, and the named bonus (included once, never activity
	expenditure). `phase_progress` leaves the assessment to weight signals.
	Historical days use their own resolved target, and `morning_orientation`
	requires local hour `0..9` with no current MealItem.
- A context read failure, provider failure, truncation/content-filter result,
	or server validation failure returns HTTP `200` with `status: 'unavailable'`.
	The failed result is not persisted and does not consume or track Daily quota.

**Cache and quota strategy:**
- A Daily document is keyed by `${userId}:${date}` in the existing `aiInsights`
	container and uses `_docType: 'dailyInsight'`. An unchanged input hash is
	served as `cached`; a changed hash is subject to the non-admin 30-minute
	regeneration interval and maximum of three generations per day. Admin
	users bypass these regeneration and quota gates in the current handler.
- The hash includes the active prompt version, selected intent, local-hour
	bucket, activity/status data, current and historical nutrition/target data,
	weight/progress signals, and other prompt inputs, as well as the global
	`promptFingerprint`, the concrete `systemPromptHash`, and the semantic
	`remainingCalories` bucket. Current profile-day `macroRanges` are included with
	exact bounds, together with `dailyInsightProteinStatus` and `mealAdviceAllowed`.
	The calorie buckets are `unknown`, `negative`, `zero`, and `positive`;
	non-finite values are `unknown`. This keeps `-0.01`/`0`/`0.01` distinct despite
	numeric rounding elsewhere in the cache key.
- The active handler passes all current identities to `shouldRegenerate()`.
	Missing or mismatched `promptVersion`, `promptFingerprint`,
	`systemPromptHash`, `intent`, or `promptSnapshot` is a hard invalidation
	before the regeneration interval and daily limit are considered. A cache
	hit therefore requires matching provenance and an unchanged full input
	hash; a changed prompt cannot remain a cache hit because a manual version
	was left unchanged.
- The existing complete, unexpired v14 same-date preservation exception is
	unchanged and applies only when v15, v16, v17 or v18 is active. It is NOT
	extended to v19, v20, or v21: all follow normal prompt-identity invalidation, including
	before interval/day-limit checks. Missing compact fields alone are not a
	regeneration trigger, and no extra legacy UX or compatibility matrix exists.
	Daily documents retain their
	existing per-document TTL/expires-at behaviour. Feedback documents are
	separate and have no TTL; see the API and domain contracts below.
- The compact pair is stored unchanged in `InsightDocument.response` and
	copied into exact-instance Feedback response snapshots. These are optional
	Class 0 fields in `aiInsights` with `/userId`; no new container, index,
	migration, backfill, deletion or data rewrite. Old Daily/Feedback responses
	remain readable. Quota/unavailable responses do not include compact fields.
	F-1 must use the static greeting without short text or detail action for an
	unavailable/quota/error result or incomplete/invalid pair. This backend change
	does not implement the planned Home UI or add any refresh trigger.
- These provenance fields are additive Class 0/read-compatible changes in the
	existing `aiInsights` container. `promptFingerprint` and
	`systemPromptHash` remain optional legacy-compatible fields on both Daily
	and Feedback documents; `intent` and `promptSnapshot` remain optional on
	the Daily type for old documents. New Daily and Feedback documents
	contain the current identities; no global backfill, migration, new
	container, or partition-key change is performed for this
	prompt-provenance change. A legacy Daily is therefore readable but is
	not a valid current cache hit or source for new feedback; legacy
	Feedback remains historical and its missing identity fields are not
	rewritten.
- Feedback copies `promptFingerprint` and `systemPromptHash` from the exact
	bound Daily document. Neither value is accepted from the client or added
	to the public Mobile DTOs.
- Daily quota is checked before Azure OpenAI and tracked only after a valid
	response. Quota exhaustion is returned as HTTP `200` with
	`status: 'quota_exceeded'`; feedback is not an AI call and is not quota
	tracked.

#### Feedback status operations

`PATCH /api/ai/daily-insight/feedback/status` requires a CIAM access token
validated by `requireUser()` with the signed Entra `Admin` role. The internal
user tier alone does not authorize this route. For an authorized operator
operation without that bearer token, the existing Cosmos repository can use
the Function App's configured `COSMOS_ENDPOINT` and `COSMOS_KEY`; obtain them
only through existing Azure operator access and never print, log, or store
their values in source or documentation.

Before changing status, query only the `aiInsights` partition for each exact
`(userId, date, userComment, submittedAt)` tuple. Project only `date`,
`userComment`, `submittedAt`, `_docType`, `promptVersion`, `userId`, `id`, and
`processingStatus`. Require exactly one match per tuple and verify its exact
partition/id, `_docType: 'insightFeedback'`, `promptVersion: 'v14'`, and stored
`processingStatus: 'Open'`. Finish all three prechecks before the first write;
do not use `SELECT *`, enumerate unrelated feedback, or infer a target from the
operation date.

For each confirmed record, use the Admin route or the existing
`updateFeedbackProcessingStatus` repository method with the exact `userId` and
`feedbackId`, setting only `Done`. The repository guards the feedback
discriminator and current status, patches only `/processingStatus`, and checks
the resulting status metadata. After each update, reread the approved
projection and verify the same tuple and `Done`; stop at the first anomaly
without blind retries or rollback. Do not read or update the past Daily
Insight, response, prompt snapshot, input context, or source records.

### 9. Weekly Insight (`GET /api/ai/weekly-insight?date=YYYY-MM-DD`)

The authenticated weekly endpoint returns exactly the seven completed local
calendar days from `date - 7` through `date - 1`. The current day is excluded.
The backend reads meals and DayMeta documents for the authenticated user and
calculates consumed calories, historical base/effective targets, target
percentages, target-band state, missing-data state, activity labels, and totals.
The current profile is never used to reconstruct a historical target.

The deterministic review remains available when AI is unavailable. The
`evaluation` object has status `fresh`, `cached`, `quota_exceeded`, or
`unavailable`; quota, provider, parse, and Structured Output failures return
`text: null` rather than a deterministic replacement assessment.

Weekly evaluations are cached in the existing `aiInsights` container as
`_docType: 'weeklyInsight'`, keyed by `${userId}:weekly:${periodEnd}`. The cache
input hash covers meal/item identities and stored macros, DayMeta/activity and
target snapshots, the reference date, and the prompt version. Identical input is
served without an AI call. After a hash change, the old text is never shown; a
30-minute regeneration interval may produce a neutral response while the chart
remains usable.

The weekly prompt is `WEEKLY_INSIGHT_PROMPT_VERSION = 'v2'` in
`backend/src/lib/prompts/weeklyInsightV2.ts`. It receives only sanitized aggregate
data for the seven days and totals: no meal/product raw text, user IDs, tokens, or
technical cache data. The generator uses Strict Structured Outputs with
`strict: true`, `additionalProperties: false`, and a single `text` property
(1–750 characters). The canonical backend limit is
`WEEKLY_INSIGHT_TEXT_MAX_LENGTH = 750`; the generated text is trimmed before the
server-side length check. The request allows `max_tokens: 1024` output tokens,
which is a token budget rather than a character limit. A provider response with
`finish_reason: 'length'` is rejected before any valid text is persisted or
`daily-insight` usage is tracked; the handler may persist only a neutral
`unavailable` cache entry with `text: null`.

## Hint Engine (Rule-Based, Not AI)

`backend/src/lib/hintEngine.ts` — evaluates a declarative rule array against the current diary state. No AI calls. Returns the first matching `HintResult`.

- H1–H28: situational rules (orientation, day context, positive feedback)
- M0–M9: motivational fallback hints (cyclic rotation, 30-day cooldown each)
- Cooldown system: hints remember last shown date and suppress repetition

**Called from:** diary GET handler, after assembling the day context.

## Progress Intelligence Engine

`backend/src/lib/progressIntelligence.ts` — computes behavioural signals from raw weight + nutrition data. Pure module. Feeds the daily insight prompt.

Signals include: trend, phase (gaining/losing/stable), plateau detection, milestones, monthly data points.

## Quota System

All AI features enforce monthly quotas per user per feature. See [domain/08-quota-system.md](../domain/08-quota-system.md).

## Prompt Files

Located in `backend/src/lib/prompts/`:
- `mealParser.ts` — system prompt for meal text parsing
- `foodEstimate.ts` — system prompt for food estimation
- `mealEstimate.ts` — system prompt for meal image estimation
- `recipeAnalyze.ts` — system prompt for recipe text analysis
- `dailyInsightPrompt.ts` (active v21 composition root), `dailyInsightPromptManifest.ts` (preserved v14-v20 history and active v21 release lock), and `../dailyInsightSchema.ts` (shared Strict Structured Output schema), plus the intent modules `sharedTone.ts`, `promptWeight.ts`, `promptActivity.ts`, `promptNutrition.ts`, `promptMorning.ts`, and `promptGeneral.ts` — current daily insight prompt (versioned). The root is the only active composition path; it builds the exact snapshot used by the provider.
- `dailyInsight.eval.test.ts` and `dailyInsight.eval.fixtures.ts` — live Daily Insight prompt evaluations
- `weeklyInsightV2.ts` — weekly insight system prompt and sanitized context contract (versioned)

[Rule] Prompt files are versioned. When a prompt changes in ways that would alter output format or interpretation, increment the version (e.g., `V6` → `V7`). Store the version constant alongside the prompt.

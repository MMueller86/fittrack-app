# Plan: Recipe Preparation Feedback-Loop

Status: [Planned] Implementation-ready; pending user approval. No implementation, agent invocation, test execution or deployment performed by Planner.
Infrastructure Impact: Alpha
Mobile Build Impact: None

Date: 2026-10-09. Authority: latest user requirements and [durable handoff](HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md). Original user request, verbatim: "Baue es entsprechend um. Nach 2 korrektur versuchen logge den entsprechenden text raus, damit wir sehen können, woran es liegt. Mache einen Azure Functions deployment, nach dem du die KOrrektur fertig hast. Übergebe notfall an den Release agenten".

## 1. Requirement Assessment

Classification: Accept as proposed, including the subsequently approved bounded feedback loop. No open Product Owner decision is needed. Approval of this technical plan is the next process gate, not a reopening of the accepted product constraints.

Problem: the existing 90-character step ceiling does not guarantee real template fit. A source-backed 76-character instruction overflows the large layout vertically. A single failed draft currently prevents a usable transient suggestion, even when a targeted rewrite could fit. Deterministic measurement decides acceptance; AI is needed to rewrite German cooking instructions with their source-backed meaning, rather than truncating text or changing the design.

AI assessment: advisory preview only; existing `recipe-analyze` feature/quota; existing strict small output schema unchanged; Preparation prompt changes from v4 to v5, with an explicit correction mode in the same prompt module. Keep temperature 0.2 and max_tokens 2048. There is no new AI endpoint, model, dependency, nutrition estimate, confidence contract, or persisted prompt data. Nutrition plausibility validation is not newly applicable because this output does not contain nutrition values. Cooking fidelity remains a separate fixture/user-review requirement, not a general deterministic semantic guarantee.

## 2. Authority, Current State And Conflicts

- `recipes.ts::prepareRecipeExportViewHandler` currently authenticates, validates V2 input, loads the owner-scoped versioned recipe, checks optional If-Match, checks a minimal cooking basis, enforces quota, calls `prepareRecipeExport` once, validates schema/references, books usage once and returns the stripped V2 suggestion. It never writes recipe/export data.
- `openai.ts::prepareRecipeExport` uses Preparation v4, a small strict schema, the lazy shared client and no request-specific retry/timeout options. The absence of an application loop is not proof that SDK transport retries are disabled. Installed OpenAI request options support maxRetries, timeout and AbortSignal; do not change the shared singleton's defaults for other features.
- `recipeAnalyzeValidation.ts` validates saved source independently and requires positive unique ascending source orders, contiguous export orders, nonempty known locally ascending reference groups, global reference uniqueness and increasing FIRST group references. `[1,4,6],[5]` remains valid for Preparation; import requires a strictly ascending flattened trace. Gaps are valid and full coverage is not required.
- Actual fit is checked later in `render.ts` using production Satori fonts, German measured hyphenation, template text nodes and a 0.5 px overflow tolerance. Step counts 1..4 use Inter Medium 22 px, lineHeight 1.25, 302 x 105 px; 5 steps use 18 px, lineHeight 1.17, 318 x 84 px. Missing/nonfinite measurements must never pass.
- The fixed current template already evaluates teaser font sizes 22,21,20,19,18. Preserve this existing rule exactly, including title-dependent teaser bounds, italic font and teaser terminal-period presentation. Do not add a fallback or change step fonts/layout. This is not permission for additional font shrinking, layouts or images.
- Mobile's `recipeApi.prepareExportView` already overrides the generic 15-second Axios timeout with 90 seconds. Its POST is not retried on timeout/5xx. No mobile changes or build are necessary.
- [The earlier SPEC](SPEC_Recipe-Export_Template-Textvertrag_2026-10-09.md) is superseded wherever it demands one call, forbids correction, requires a new conservative character/word budget, prescribes ingredient-list omission or introduces an unapproved character whitelist. Do not implement the rejected 23-character/11-word-length proposal, a new fixed three-line product rule, or any substitute universal character budget. Existing Shared 1..5/90/96/10080 limits remain structural limits, not a pixel-fit proof.
- KB currently documents single-call Preparation and excludes all generated Preparation text from logs. Both must change with implementation, narrowly and explicitly. Existing share-overflow logging is separate completed work and stays intact.
- [Q-19](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) remains FAIL: invalid rice/oven references and accepted rice cooking-semantic corruption were observed. Geometry or a later successful retry does not retroactively close these findings. Import/Daily failures are separate evidence, not automatically caused by Preparation.
- [The 14:12 UTC Alpha Functions release](../../../infra/release-records/Recipe-Step-Overflow-Logging_Alpha-Functions_2026-10-09.md) already deployed targeted share logging. It is not a deployment of this loop or feature acceptance. Release-role text says no health endpoint, whereas the recorded deployment and repository infrastructure documentation establish health200; the new release verifies public health200 AND protected401.
- Working tree is already extensively dirty. Preserve all existing source/test/KB/planning/release changes. New work must record its starting baseline and exact owned hunks; no rollback, reset, branch, commit or silent adoption of the entire dirty diff.

## 3. Scope And Compatibility

In scope: reusable generated-text production probe; richer internal diagnostics; bounded Preparation correction calls; exhausted-failure text diagnostics; unit/regression and real-provider eval changes; relevant KB updates; independent QA; subsequent authorized Alpha Functions-only release.

Out of scope: mobile/shared public changes; Import v16 prompt/schema/normalization/trace behavior; ingredient selection or ingredient-key remapping; Cosmos fields/repository methods/migrations; Bicep/resources/settings changes; native/mobile/EAS builds; new fonts/layouts/images; clipping, truncation, padding, server-side reference repair; general cooking-safety inference; unrelated Import/Daily/dependency fixes; redoing prior completed logging/deployment work.

Persistence Impact: no document or repository contract changes; no migration in Dev or Alpha. The existing successful usage-counter write remains, once per accepted preparation, not once per provider request. "No writes" in this plan means zero recipe/export/image/diary writes, and on every failure also zero usage bookings. No Cosmos skill is required for unchanged persistence.

Public contract remains POST `/api/recipes/{id}/export-view/prepare`, strict `{contractVersion:2}`, optional exact If-Match, existing owner isolation and V2 200 body including original loaded `sourceEtag`. Response suggestion still strips sourceStepOrders. Confirmation and sourceFingerprint/compare-and-replace remain separate and unchanged. No new public error code or diagnostic response fields are required.

## 4. Implementation Design

### 4.1 Production Text Probe (B-1)

Add a backend-internal, text-only probe entry point in `instagramRenderer/render.ts`, re-exported through the existing renderer barrel if needed. Input is saved title plus candidate teaser and the complete candidate step list; no image, ingredient IDs, selected export view, full recipe wrapper or provider payload. The title is contextual input for teaser geometry, not an AI-editable field. Return a discriminated success / correctable generated-text failure / technical failure result with typed measurements and per-field diagnostics. This does not certify saved title, ingredient rows, chips, images or the whole share bundle.

Factor only the existing teaser/step Satori subtree construction and measurement/bounds helpers necessary to share behavior between probe and full renderer. Reuse `recipeDetailsTemplateV3.ts`, `getRecipeDetailsTextLayoutFields`, `detailTextLayout.ts::addMeasuredGermanBreaks` and `measureDetailTextWidths`. A probe must preserve the actual flex/width/whiteSpace/wordBreak behavior and parent constraints, not merely calculate fontSize * lineHeight or create a second approximate layout. Factor font/Satori loading from image/native/full design-asset loading so preparation never downloads or decodes a photo, invokes Sharp/Resvg or creates a PNG. Reuse the current font files and caching, not a second font asset set.

Measure all generated steps and teaser; evaluate teaser sizes exactly as the current renderer does. The probe may collect multiple failures internally, while the renderer keeps its public first-failure contract and existing render behavior. Never label a skipped field as validated. Width-only hyphenation failures retain actionable measured width plus its limit; do not fabricate a measured multiline height. Missing, nonfinite or absent expected node measurements are technical failures. If any technical failure occurs, do not ask AI to fix text on the basis of the incomplete probe.

Use the renderer's 0.5 px tolerance, including boundary tests. Do not add stricter global text rules based on the stale SPEC. Preserve current render-required single-line/nonblank constraints for teaser/steps; report generated violations as correctable text errors without normalization/truncation. Share continues to validate actual adapted input at render time because user edits, source changes and template changes can invalidate prior fit.

Cheap discriminating regression: with production fonts/hyphenation, four steps and the exact Alpha sentence `Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.` must fail at approximately 300 x 112 px against 302 x 105 px. Compare the probe and existing full render for the same source/title/text. A shorter source-faithful candidate must pass both generated-text checks without changing fonts. Add this failing Preparation regression before wiring B-2; no application implementation is performed in this planning task.

### 4.2 Diagnostics And Source Authority (B-2)

Reuse `validateRecipeExportPreparationOutput` as the whole-output structural/reference authority. Extract/reuse saved-source validation so all malformed saved-source orders/text are rejected before quota/provider work, not offered to AI as repairable source. Preserve current lack of sorting/renumbering and noncontiguous-source compatibility.

Enrich internal diagnostics, without replacing existing public error details: phase, stable code, exact path, zero-based step index and export order where applicable, constraint/allowed range, offending reference orders where necessary, and safe bounded explanatory instruction. For group/duplicate failures identify every actually implicated export-step index rather than the existing generic `steps` path. Template diagnostics additionally carry original candidate field path, count/layout, font family/size/weight/style/lineHeight, finite measured dimensions, allowed dimensions, tolerance and only applicable character-limit facts. Indexes always address the current draft, not source array positions.

Correction eligibility is an explicit classification, not "every 422": parsed generated-output schema/text/metadata/order/reference failures and measured teaser/step overflow are correctable; invalid saved context, auth/request/owner/ETag/quota failures, provider refusals/truncation/empty content/invalid JSON, transport failures, missing font/assets, probe exceptions/missing measurements and timeout are terminal. Neither omission alone nor a universal inferred cooking rule becomes a new runtime failure. If the saved source is invalid or a technical probe fails alongside a draft failure, terminate rather than correcting.

### 4.3 Bounded Loop And Provider Input (B-2)

Keep handler orchestration thin and place the bounded generate/validate/probe loop in one Preparation-specific lib function colocated with the Preparation validation code, not a generic AI retry framework or new function route. Handler owns auth/request/versioned read/quota, final usage booking, response mapping and logging. The lib loop returns the latest draft, final diagnosis and attempt metadata, without logging or writing repositories.

Initial attempt receives the same immutable ID-free saved recipeContext and unchanged saved steps. Extend `prepareRecipeExport` with backend-only optional correction context and per-call cancellation/time-budget options. A correction receives the SAME original context, the LATEST complete parsed draft, and the latest structured validation/probe errors. Use explicit JSON data properties (for example originalPreparation/latestDraft/validationErrors), not pasted system instructions, a full chat transcript, a rewritten saved recipe or an Import call. Initial and correction modes use the same small strict output schema.

Preparation prompt v5 identifies all recipe/draft/error-value strings as untrusted data. It requires correction of the reported errors while preserving the meaningful cooking workflow, source-backed claims, necessary cooking parameters/component transitions and valid source associations; preserve already-fitting steps where possible. It must NOT contain `Wiederhole die Zutatenliste nicht, sofern der Bezug eindeutig bleibt.` or a paraphrase prescribing ingredient-list omission. AI chooses its own strategy; recipeContext's ingredients remain available as source truth. Regrouping/rewording is allowed when necessary, but cannot invent facts, fix source data, simply copy reference IDs to claim completeness, or claim pixel fit itself.

For each candidate: validate entire structure and all references against ORIGINAL saved source; if structurally usable, probe ALL candidate steps and teaser. If structural failures prevent safe geometry, send those diagnostics first; no geometry PASS is inferred. A corrected step-count change recomputes all large/compact bounds; a changed teaser is remeasured under the original title context. Never validate only the previously failing field or merge unchecked snippets into a previously valid candidate.

Stop immediately on fully validated success. Otherwise, a correctable failure permits correction 1, then correction 2. Maximum is exactly TWO correction attempts, THREE logical SDK calls including initial generation; if fewer are needed, stop earlier. After validation of correction 2 fails, emit the exhausted result and never call again. No recursively restarted loop, hidden provider retry or separate semantic-check AI call.

### 4.4 Timeout And SDK Retry Policy (B-2)

Engineering design values, not domain heuristics: a monotonic 75,000 ms aggregate generation/validation/probe budget starts immediately before initial generation; each provider request receives timeout=min(20,000 ms, remaining budget), `maxRetries:0` and an AbortSignal tied to the aggregate deadline. These per-request options affect Preparation ONLY. They make the maximum three logical SDK calls also a maximum three outbound provider attempts; shared Import/other AI retry defaults remain unchanged. No application-level transport retry is allowed inside the correction budget.

Use one deadline, not three independent total timeouts. Check it before/after every awaited generation, validation/probe boundary and before admitting success; bound awaited probe/font work by remaining time and clear deadline timers in finally. A pending provider request is aborted at the deadline. Late probe/provider results must not schedule another call, book usage, log an exhausted-text event or return success after a timeout. Satori has no generic cancellation API: discarded async probe results must be side-effect-free; this is an application deadline, not a hard real-time guarantee against a blocked Node event loop. Do not introduce workers or infrastructure tuning for this slice.

The 75-second loop budget leaves nominal headroom under the existing 90-second mobile request for auth/read/quota/booking/network overhead; cold-start and repository latency are separately measured, not promised to be covered by that loop budget. Per-call/aggregate timeout returns a terminal generic 502, not a text-fit422 and not an extra correction. A short remaining budget uses its actual remaining milliseconds; zero/expired budget never dispatches a request. Never race a quota-counter write and later retry it: booking is awaited once only after validated success and a final deadline check. A booking failure remains the existing technical500 path, not a text-correction case.

### 4.5 Failure Contract And Quota (B-2)

| Outcome | Response / behavior |
|---|---|
| Initial/correction1/correction2 validated success | Existing V2 200; original sourceEtag; strip refs; book recipe-analyze once after full validation |
| Exhausted correctable draft | Existing 422 error envelope `Recipe export preparation failed server-side validation` with safe deterministic details; no raw affected text/measurements/context in response |
| Invalid saved cooking source | 422 before quota/provider; no AI correction, no text exception |
| Request/auth/owner/If-Match/quota failure | Existing400/401/404/412/429 respectively; no provider or probe correction work |
| Provider/empty/parse/refusal/truncation/timeout | Terminal502; generic safe error, never raw provider message/payload; no correction/rebooking |
| Font/probe/unexpected backend failure | Technical500; stable safe operation/stage diagnostics; never misreported as correctable overflow |

Existing provider502 currently echoes `Error.message`; replace that Preparation-only echo with a generic message so newly introduced correction/provider data cannot leak through HTTP. This is an intentional narrow failure-text hardening; status, V2 success and client behavior remain compatible. No new structured public error fields are necessary.

Enforce existing quota once before initial provider work; never enforce/book per correction. `trackUsage` occurs exactly once after final schema/references AND geometry pass, never in catch/finally or for draft/technical/time/quota failures. Preserve recipe document, steps, ingredients, confirmed exportView, fingerprint and ETag on every path. Recipe/image/storage/diary writes remain zero even on success; user confirmation still owns saving. Provider cost for discarded drafts is distinct from user quota booking.

### 4.6 Exhausted-Failure Logging (B-2)

Add one dedicated event, proposed `recipes.prepareExportView.correctionsExhausted`, ONLY when two completed corrections have returned parsed drafts and the latest still has correctable validation errors. Event metadata: stage, stable reason, Preparation prompt version, invocation correlation, correction_attempts=2, logical_ai_calls=3, elapsed_ms, error count/truncation metadata, source/export counts and relevant template layout. Do not reuse broad provider error serialization.

For each implicated known generated text field, log its EXACT string from the latest rejected parsed draft, preserving quotes/line breaks via structured JSON, together with field/path/index/order, text length, applicable bounds, and concrete structured schema/reference or measured diagnosis. For reference errors, include only descriptions of implicated groups and their safe numeric offending references. A teaser failure logs only the latest teaser. A metadata-text error may log only the affected known difficulty string. Unknown keys/invalid nonstring fields have diagnostic metadata only; never stringify arbitrary objects or the whole draft to obtain a text. Do not log unrelated fitting steps. Original generated text is not replaced with trimmed, normalized, hyphenated or first-attempt text. Exact affected text must not be clipped; serialize separate affected-field records if needed, keeping numeric/schema diagnostic summaries bounded and marking truncation explicitly.

The existing text exclusions remain for success, intermediate failed candidates, technical/time/source/request/quota failures and every unrelated flow. No whole source, original recipeContext/ingredient list, request, full output/provider response, image/base64, headers, tokens, connection strings, keys, stack/error dump or secrets. Keep numeric/provider identifiers allowlisted via existing helpers. Approved generated cooking text is the sole narrow content exception; it is not authority to retrieve/store private recipes or log provider messages. Security tests seed secret/unrelated sentinel values in surrounding request/context/provider objects and prove they do not occur in any log argument or response. Dedicated exact-text tests assert equality only for approved synthetic affected cooking fields.

Keep the prior share-overflow text diagnostics unchanged. Document the new Preparation exhausted-only exception in the relevant KB sections; do not globally relax logging or edit agent instructions as part of this feature.

## 5. Acceptance Criteria

- AC-1: Fixed Instagram template, existing fonts/teaser sizing, format and image count are unchanged. No new character/word cap, three-line acceptance rule, ingredient-omission instruction, font/layout/image fallback or truncation is introduced; existing Shared limits remain.
- AC-2: All1..5 steps and teaser are measured with production fonts, real shared Satori nodes/constraints, German breaks and existing tolerance. The exact four-step Alpha76-character regression produces the112px vertical overflow against105px and enters correction; a source-backed fitting rewrite passes. Probe/full-render generated-text decisions agree, including title-dependent teaser behavior.
- AC-3: Preparation probe performs no image/Blob download, Sharp/Resvg operation or PNG generation. Missing/nonfinite/font/probe measurements fail technically without a correction or quota booking; no fabricated geometric success.
- AC-4: Initial success calls AI once; success after correction1 calls twice; success after correction2 calls three times; exhaustion calls exactly three times and returns422. Every correction receives unchanged original source/context, latest draft and concrete current errors/bounds; no fourth call.
- AC-5: Complete candidate structure, saved-source references and all text geometry are revalidated after every correction, including count/layout changes and regressions in previously fitting steps. Existing first-reference semantics, interleaving/gaps and all reference rejections stay intact; no server repair or weakened assertions.
- AC-6: 75-second aggregate and20-second per-call limits are tested with controllable clock/providers; maxRetries0 and AbortSignal are sent on each Preparation request. Timeout and late completion never cause a new call, success booking or exhausted-text log. Import/other feature options are unchanged.
- AC-7: Request/auth/owner/ETag/source/quota/provider/refusal/truncation/parse/font/probe/booking failures are terminal in their specified contracts, not mistaken for text errors. Malformed saved source is rejected before provider/quota. HTTP errors contain no generated text, private context, provider payload/message or secrets.
- AC-8: Quota enforcement precedes provider work once; validated success books once after final full checks; every failure books zero. Recipe/export/image/diary writes are zero for every attempt and terminal outcome; saved source, ingredient values, exportView, fingerprint and ETag remain unchanged. Explicit user confirmation is still required for persistence.
- AC-9: Public strict V2 input and exact200 response/sourceEtag remain unchanged; internal refs/diagnostics do not leak. Mobile's existing90-second POST/no5xx-retry path remains compatible without a mobile/shared change or build.
- AC-10: Exhaustion logs exact latest affected generated text and actionable structured errors/real applicable bounds, never earlier/normalized/unrelated text. JSON escaping, multiple affected fields, reference errors and schema-only errors are tested; success/intermediate/technical logs retain exclusions and sentinel secrets/payloads never appear.
- AC-11: Preparation v5 and its consciously reviewed eval-version guard match. Live evals exercise real provider AND real text probe, preserve the three saved rice/oven/pasta source fixtures, and independently require cooking core/component/source fidelity on the FINAL accepted output. Valid refs/geometric fit/HTTP200 alone are not semantic PASS.
- AC-12: Backend unit suite, focused regressions, backend typecheck, build:verify and required F/R/G live gates are executed with counts/exits and durable evidence. No skipped required Preparation case or missing credentials is called PASS; QA verifies docs and every pre-release criterion. Historical Q-19 FAIL and unrelated live failures are separately reported, not weakened or silently closed.
- AC-13: Dirty baseline/owned diff and implementation manifest identify the exact verified release candidate, including inherited code and all runtime dependencies/assets. Only a verified candidate can enter the authorized Alpha Functions-only release; no incidental dirty code is bundled without review. Staged compiled files/assets match that candidate; clean build, MIR and Linux Node22 remote publish gates pass.
- AC-14: Infrastructure performs release only after the pre-release gate, verifies registered Preparation/share/health functions, health200 and protected401, and records authenticated preparation/render/native/error-log smoke results or explicit UNVERIFIED limits. No Bicep/settings/Cosmos/EAS/mobile build. A publish/health/native-smoke failure is reported honestly and escalated, not recorded as acceptance.

## 6. Work Packages

All work is sequential. Orchestrator routes the declared packages, preserves the handoff store and returns blockers to the owning package; it does not choose a different implementation design, weaken gates or invoke agents in this planning session.

### B-1: Shared Production Generated-Text Probe

Agent: Backend

Goal: Implement section4.1 as the minimal behavior-preserving renderer extraction and add real-font parity/regression tests before integrating the loop.

Required Knowledge Base: `docs/kb/tech/02-backend.md` (detail rendering); `docs/kb/tech/08-testing.md` (renderer fixtures).

Required Repository Context: `backend/src/lib/instagramRenderer/render.ts`; `recipeDetailsTemplateV3.ts`, `detailTextLayout.ts`, `types.ts`, `index.ts`, `assets/fonts/` and `__tests__/recipeDetailsTemplate.test.ts` within the same renderer directory; `backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png`; this plan sections3,4.1 and AC-1..3.

Required Skills: None.

Relevant Acceptance Criteria: AC-1, AC-2, AC-3, AC-5 (geometric recheck), AC-13 (baseline).

Dependencies: User-approved plan and preserved dirty baseline. No existing confirmed export view or authenticated photo is needed for the text probe.

Expected Handoff: Exact probe input/result API, reused node/font/bounds ownership and typed failure classifications; production-font Alpha regression/parity results for1..5 steps and teaser/title variants; renderer no-behavior-change evidence; owned hunks/files/baseline; focused unit/typecheck/build results. No release claim.

### B-2: Preparation Corrections, Logging And Evals

Agent: Backend

Goal: Implement sections4.2..4.6 with B-1's real probe; keep public V2/save/quota/source contracts; own and execute all updated unit and prompt eval tests.

Required Knowledge Base: `docs/kb/tech/02-backend.md`; `docs/kb/tech/06-ai-integrations.md`; `docs/kb/tech/09-api-reference.md` (Preparation/confirmation); `docs/kb/domain/06-recipes.md` (source/export); `docs/kb/domain/07-ai-features.md`; `docs/kb/domain/08-quota-system.md`; `docs/kb/tech/08-testing.md`.

Required Repository Context: `backend/src/functions/recipes.ts`, `recipes.test.ts`, `ai.test.ts`; `backend/src/lib/openai.ts`, `openai.recipeAnalyze.test.ts`, `recipeAnalyzeValidation.ts`, `recipeAnalyzeValidation.test.ts`, `quota.ts`, `quotaConfig.ts`, `http.ts`; `backend/src/lib/prompts/recipeAnalyze.ts`, `recipeAnalyze.eval.test.ts`, `recipeAnalyze.eval.fixtures.ts`; `shared/types/recipeExport.ts` and `shared/types/recipes.ts` read-only; `backend/scripts/run-eval.mjs`, `backend/vitest.eval.config.mts`, `backend/package.json`; `mobile/src/shared/api/recipeApi.ts` and `client.ts` read-only; B-1 compact handoff; durable requirement handoff and Q-19 report.

Required Skills: azure-openai-feature-integration (including implementation checklist).

Relevant Acceptance Criteria: AC-1, AC-4..AC-12, AC-13 (candidate manifest), and AC-2..3 through B-1 integration.

Dependencies: B-1 verified probe handoff. Credentials must be available to the official eval runner without exposing them. A missing/invalid prerequisite returns to Orchestrator, not an independent design change.

Expected Handoff: Loop/diagnostic/provider API and v5 prompt/schema manifest; exact owned diff plus inherited-candidate context; timeout/retry/error/logging contract; all regression/unit/typecheck/build results; F/R/G immutable run manifests with counts, exits, calls, final-output fit/fidelity and failures; known unresolved historical/foreign findings. No retry-until-green or deployment by Backend.

### D-1: Current-Behavior Documentation

Agent: Backend

Goal: Update only implemented Preparation behavior and its logging/verification boundaries before QA, without altering old stories or evidence.

Required Knowledge Base: `docs/kb/domain/06-recipes.md`; `docs/kb/domain/07-ai-features.md`; `docs/kb/tech/02-backend.md`; `docs/kb/tech/06-ai-integrations.md`; `docs/kb/tech/09-api-reference.md`; `docs/kb/tech/08-testing.md`.

Required Repository Context: B-1/B-2 handoffs and changed owning implementations/tests; durable requirement handoff; stale SPEC; Q-19 report; previous14:12 release record.

Required Skills: None.

Relevant Acceptance Criteria: AC-1, AC-6..AC-12.

Dependencies: B-2 implementation/evidence. Do not describe pending or failed gates as completed behavior/acceptance.

Expected Handoff: Exact KB edits for loop/prompt, retry/deadline, geometry boundary, terminal contracts, exhausted-only text exception and test commands/evidence; preserve historical FAIL labels. Add a short superseded-by-plan pointer to the stale SPEC without rewriting historical requirements, if it is still presented as an active specification. Planner itself writes only this new plan, not KB or the old handoff.

### Q-1: Independent Pre-Release QA

Agent: QA

Goal: Verify the whole approved slice against AC-1..AC-13, docs and independent F/R/G results; explicitly distinguish release readiness from historical finding closure.

Required Knowledge Base: `docs/kb/tech/08-testing.md`; `docs/kb/tech/02-backend.md`; `docs/kb/tech/06-ai-integrations.md`; `docs/kb/tech/09-api-reference.md`; `docs/kb/domain/06-recipes.md`; `docs/kb/domain/07-ai-features.md`; `docs/kb/domain/08-quota-system.md`.

Required Repository Context: Full approved plan and durable handoff; B-1/B-2/D-1 handoff store including skipped tasks/deviations, all owned hunks and candidate manifest; touched source/tests/evals/KB; `backend/package.json`, official eval runner/config; `docs/qa/reports/README.md`; Q-19 report and prior release record. Orchestrator supplies these exact inputs, not an instruction to re-plan.

Required Skills: azure-openai-feature-integration (QA checklist).

Relevant Acceptance Criteria: AC-1..AC-13; AC-14 recorded as pending Infrastructure execution rather than falsely marked pre-release PASS.

Dependencies: B-1, B-2, D-1 completed; frozen release candidate/eval hashes. Environment-limited checks are UNVERIFIED, not an actionable finding; mandatory unexecuted release gates still prevent release readiness.

Expected Handoff: Durable fittrack-qa-v1 report at `docs/qa/reports/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md`, criteria matrix, commands/exits/counts, structured findings/owners, verification limitations and explicit `Release Gate: OPEN | CLOSED` for the frozen candidate. Historical Q-19 FAIL is not overwritten; any relevant finding closure cites new direct evidence. QA does not fix production or prompt evals.

### R-1: Authorized Alpha Functions-Only Release Operation

Agent: Infrastructure

Goal: Execute the already user-requested Alpha Functions deployment after Q-1 opens the gate. This is an operational release handoff, not a new architecture/infrastructure feature and not execution authorization for Planner.

Required Knowledge Base: `docs/kb/tech/07-infrastructure.md`; `docs/kb/tech/01-system-overview.md`.

Required Repository Context: `.github/instructions/infra-release.instructions.md`; approved plan release gate; Q-1 report and frozen release candidate/owned-diff manifests; `backend/package.json`, `backend/scripts/verify-build.mjs`, `backend/scripts/copy-instagram-assets.mjs`, `backend/host.json`; `_deploy_staging/package.json`, lockfile and host.json; prior14:12 release record; changed compiled Preparation/validation/prompt/probe files and full renderer asset manifest. No secret config contents are supplied to model context.

Required Skills: None.

Relevant Acceptance Criteria: AC-13, AC-14; preserve AC-8..10 in authenticated smoke.

Dependencies: Q-1 Release Gate OPEN and matching verified artifact scope; active Azure credentials and authorized test context for authenticated smoke. Stop if artifact scope includes unreviewed dirty changes or any mandatory gate is missing. Existing explicit Alpha deployment authorization is sufficient once these conditions hold; do not re-request settled product authorization.

Expected Handoff: Durable report `infra/release-records/Recipe-Preparation-Feedback-Loop_Alpha-Functions_2026-10-09.md` with runtime, candidate/staging hashes, exact release scope, build/MIR/publish/function/health/native/authenticated smoke results, deployment ID/time, logging checks and verification limits. Record Dev Build Required:NO; no mobile/infra deployment. Any release failure returns to Orchestrator/user with options, never silent rollback or unrelated remediation.

## 7. Test Strategy And Mandatory Gates

Reuse existing test homes; do not invent a separate capture framework. B-1 focuses on renderer tests; B-2 uses recipes/validation/SDK tests and current recipeAnalyze eval file/fixtures. A small Preparation-specific lib test is appropriate only if the loop needs a separate owning test home. No real Cosmos tests/accounts are needed because persistence/repositories are unchanged; use in-memory repositories/spies and mocked quota/storage for handler/live evals.

Mandatory deterministic matrix: initial success; correction1 success; correction2 success; all-three failure with latest text different each time; changed count4->5 and5->4; valid interleaving and bad/unknown/duplicate refs after correction; fitting-step regression; teaser-only and multiple-field overflow; correctable shape/text/metadata errors; malformed saved source; initial and later provider/parse/refusal/truncation failures; missing/nonfinite/font/probe failure; per-call timeout; aggregate expiry during font/probe and before next call; late completion; exactly-once/no-failure usage booking; zero source writes and unchanged ETag/export/ingredients; preserved auth/owner/optional ETag/V2 behavior; exhausted-only privacy/JSON escaping and no raw HTTP echo. Test request options with the existing injected SDK client as well as mocked lib calls so maxRetries0/timeout/signal is genuinely asserted.

Mandatory real-font matrix: steps1,2,3,4,5; exact Alpha sentence at4; long German words/measured hyphenation and wide text; width/height boundaries/tolerance; teaser/title variants including italic font, existing22..18 rule and terminal period; probe-versus-full-render decision parity; no image dependence. Full-render parity uses the versioned test photo, never local private Alpha assets. Tests verify geometric outcomes, not a new language whitelist or universal cooking guarantee.

Live eval adaptation: current tests inspect only provider result0 and insist on one call. Update them to inspect EVERY1..3 call's original context/correction input/options and validate the FINAL candidate, actual successful V2 response, usage order, zero writes and unchanged saved recipe. Preserve all three saved rice/oven/pasta source fixtures and existing independent component/core/contradiction rubrics. Add a source-backed synthetic regression fixture for the dough sentence; test correction with a fixed overflowing initial candidate and REAL correction provider, reporting forced versus naturally observed failures honestly. Deterministic unit tests guarantee both correction positions/exhaustion; live tests do not assume a stochastic initial draft always fails or mock geometric PASS. Never accept missing finish-cooking, changed component parameters or invented facts merely to fit.

Commands run by implementation/QA, not Planner (workspace-root forms):

1. Focus: `npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/openai.recipeAnalyze.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts` plus any new owning loop unit test.
2. Full units: `npm run test --workspace=backend`; typecheck: `npm run typecheck --workspace=backend`; build: `npm run build:verify --workspace=backend`.
3. F: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"`.
4. R: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts`.
5. G: `npm run test:eval --workspace=backend`.

Run F then R then G for each frozen candidate; record file hashes, fixture counts/executed/skipped, exits and final semantics/geometry/calls. Set affected eval test timeouts to accommodate the75-second loop plus test overhead (e.g.100 seconds), not a30-second test cutoff. Missing credentials/runner exit2 or all-skipped required tests is UNVERIFIED, never PASS. Failure is evidence: stop that package, report to Orchestrator; any authorized repair produces a new identified candidate and fresh required gates, not replacement of a failed run by an undocumented later pass.

Release gate is fail-closed: focused/full offline/build gates and ALL required changed-feature live assertions must pass with independent QA; inherited rice/oven reference and cooking problems must pass current final-output checks before releasing this slice. R/G are mandatory; unrelated current failures remain honestly visible and keep default release gate CLOSED. Do not fix Import/Daily in this plan or waive their gates automatically. Any baseline-only waiver must be separately explicit user acceptance recorded by QA, with an exact finding/candidate/scope and no changed-feature or security/geometry/semantic gate waived. Historical Q-19 remains a historical FAIL even if new scoped evidence passes.

## 8. Functions Release Procedure And Candidate Isolation

After approval and Q-1 gate only: verify Azure session via az account show and target Node|22; do not expose credentials. No infrastructure phase applies. Any newly discovered Bicep/settings/runtime/dependency change returns as an out-of-scope blocker; do not run ARM/EAS operations.

Do not publish the entire dirty working tree blindly. Backend/QA provide a complete reviewed candidate manifest including existing inherited code that is compiled, owned changes and dependencies/assets. If that cannot establish a verified slice, use a separate approved clean release staging/candidate source without reverting user files; otherwise stop. A list of owned hunks alone is not proof that a full Functions package excludes unreviewed inherited changes.

Infrastructure cleans only generated backend/dist and build cache, executes build:verify, then mirrors verified dist into `_deploy_staging/dist` via robocopy /MIR (0..7 success, >=8 failure). Verify byte/hash parity of compiled recipes/openai/validation/prompt/probe files, function entrypoints and all ten renderer assets, especially font license and fonts. Staging production manifest/lockfile must retain Linux-compatible runtime dependencies and no secrets/local.settings.json/Windows node_modules.

Publish only from `_deploy_staging` using `func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript`; no --no-build. Validate publish/trigger synchronization, Node22, registered prepare/share/health functions, public `/api/health`200 and protected `/api/diary/meals`401. Health401/200 is not proof of native Satori/font/Sharp/Resvg operation: require an authorized authenticated preparation and existing share/render smoke for that proof, inspect intended exhausted diagnostics if an authorized reproducible failing case is available, and verify no auto-save/duplicate quota booking. Do not weaken the deployed prompt/template or introduce a debug endpoint to force failure.

Authenticated smoke cannot be performed without a user-owned test context; report that as UNVERIFIED with exact prerequisite/steps/result slot, not as PASS. Never route tokens through chat or persist them. Prior release reported native install-script/vulnerability warnings; inspect and report current results without claiming prior warnings fixed. Publish/health/native smoke failure stops progression and records current deployed state; assess rollback options but do not assume failed publish automatically preserves the old healthy version or perform a destructive rollback without authorization.

## 9. Risks, Assumptions And Blockers

- No unresolved product question. Technical75s/20s budgets are explicit design choices to be validated by the required latency/timeout checks, not claims about observed provider performance. Existing90s mobile override is verified.
- Bounded correction increases maximum provider cost/latency while success-based user booking is unchanged. No promise that every recipe fits or every correction succeeds.
- Generated-text acceptance does not certify whole-image renderability, future edited drafts, unavailable native libraries or general cooking semantics. Source fidelity requires the unchanged independent rubrics and explicit user review.
- Exhausted affected cooking text is approved sensitive diagnostic content; keep it narrowly scoped within existing logging access/retention. No new telemetry store, retention setting, export or blanket content logging is authorized.
- Source invalidity versus draft invalidity must remain explicit; ordering/reference rules may require text regrouping, not merely sorting IDs.
- Dirty candidate contamination, incomplete font parity, late-result side effects, missing eval credentials, unresolved required live failures and unavailable release authentication are concrete stop conditions. Current historical Q-19 FAIL is known evidence, not a newly resolved issue.
- The prior session's local lack of agent tools is not a repository/product blocker. This task invokes no implementation agents and no deployment. After user approval, an Orchestrator with routing capability executes the persisted packages; if routing is unavailable it must provide these exact handoffs and state the tool limitation, not claim execution.

## 10. Recommended Execution Order

1. User approves this technical plan. Orchestrator freezes the dirty baseline and routes the complete declared packages, without redesign.
2. Backend B-1: production text probe and real-font/parity checks; return compact verified API handoff.
3. Backend B-2: loop, classification, v5 prompt, timeout/retry/logging, regression tests and F/R/G evidence using B-1.
4. Backend D-1: relevant KB/current-behavior updates and superseded-SPEC pointer; preserve old FAIL and release evidence.
5. QA Q-1: independent complete scoped review and gates; durable report with Release Gate OPEN/CLOSED. On a defect, Orchestrator returns the smallest affected package; no new release until reverified.
6. Infrastructure R-1: execute the explicitly authorized Alpha FUNCTIONS ONLY deployment after OPEN, then artifact/host/authenticated/native/logging checks and durable release report. No mobile build or infra change.
7. Orchestrator reports plan scope, QA result, actual deployment result, old findings still open and all UNVERIFIED limits; it never substitutes a successful publish for feature acceptance.
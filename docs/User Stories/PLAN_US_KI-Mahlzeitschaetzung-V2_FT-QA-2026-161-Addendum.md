# Plan Addendum — FT-QA-2026-161: Foto- und Textabgleich bei der KI-Mahlzeitschätzung

Status: Approved — user approval and PO-161-1 through PO-161-3 confirmed on 2026-11-04; approval gate satisfied.
Parent plan: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2.md` (approved and implemented; overall QA `PASS WITH ISSUES`).
Finding: FT-QA-2026-161 / KI-MEAL-V2-05, AC-8; currently active in `docs/qa/findings.md`.
Infrastructure Impact: Alpha
Mobile Build Impact: None

This addendum is limited to the remaining photo/description contradiction finding and the new cross-layer behavior clarified on 2026-11-04. It does not reopen the completed V2 scope or revise unrelated ACs. The parent plan's earlier approval did not approve this additional behavior; the user explicitly approved this addendum and accepted all three proposed defaults on 2026-11-04.

## Product Owner Decisions

The user accepted and confirmed each proposed default on 2026-11-04.

| ID | Decision | Accepted/confirmed result | Why it matters | Status |
|---|---|---|---|---|
| PO-161-1 | What qualifies as a direct contradiction? | Only a clear incompatibility between the described primary meal/food identity and the dominant visible meal identity. A different portion, an omitted side, garnish, or additional visible ingredient is not a contradiction. | Determines whether the photo is excluded or can contribute to nutrition. | Accepted/confirmed by user on 2026-11-04. |
| PO-161-2 | What should happen when the model cannot confidently classify the relationship? | Use text only, report that the photo could not be confidently matched and was excluded, and ask the user to check whether it fits the description. Do not claim that the photo is wrong. | Conservative against an unrelated photo biasing nutrition, but may discard a useful ambiguous photo. | Accepted/confirmed by user on 2026-11-04. |
| PO-161-3 | Confirm the likely typo in the clarification's last sentence. | When the photo shows additional ingredients not named in the text, but the primary dish fundamentally matches, classify the photo as complementary and continue using both text and photo. | Preserves the stated distinction between a wrong meal and extra visible ingredients. | Accepted/confirmed by user on 2026-11-04. |

**Approval gate:** Satisfied on 2026-11-04. The user explicitly approved this addendum and accepted the proposed defaults for PO-161-1 through PO-161-3. The original V2 approval alone was not sufficient.

## Requirement Assessment

Classification: **Accept with modifications**; the product decisions above were accepted on 2026-11-04.

AI is necessary to compare an open-ended meal description with visible food. Deterministic code can validate the classifier's enum and enforce the source-routing policy, but cannot reliably identify meals in arbitrary photos. The model's classification remains fallible; the server must fail closed rather than let an uncertain or invalid assessment silently pass the image into nutrition estimation.

The requested distinction is not a nutrition rule. It is an input-source decision:

- **Consistent:** the main meal identity matches; use text and photo.
- **Complementary:** the main meal identity matches and the photo shows additional visible ingredients/components; use both and allow the estimator to include those visible foods.
- **Contradictory:** the written primary meal and clearly visible primary meal are incompatible; inspect the photo only for classification, then estimate from text alone.
- **Uncertain:** the relationship cannot be established reliably; proposed behavior is text-only estimation with a neutral notice.

The terms and examples above reflect the PO decisions accepted on 2026-11-04. Do not infer hidden ingredients, hidden fat/oil/sauce, or calorie values from anchors. Keep the existing explicit review-and-confirm step.

## Current Behaviour

- The active finding says the request sends the photo at high detail but the system prompt does not require structured contradiction detection.
- `backend/src/lib/openai.ts` currently sends the image directly to the same call that generates nutrition values.
- `backend/src/functions/ai.ts` currently sets `photoUsed` from image presence, returns free-form `warnings`, and tracks one `meal-estimate` use after a valid estimate.
- The current mobile result says `Foto genutzt` when `photoUsed` is true and renders warnings, but has no structured photo relationship or explicit exclusion state.
- The current shared response has no machine-readable photo/description assessment. Existing V2 fields and V1 read compatibility are documented in the parent plan and `docs/kb/tech/09-api-reference.md`.

## Proposed Behaviour and Contract

### Photo assessment and source isolation

For requests with a photo, add a short, separate Azure OpenAI assessment call whose sole output is a strict Structured Output enum. It receives the text and image, but returns no nutrition values, food list, free-form explanation, or model-written user copy. The server validates the enum before choosing the nutrition-estimation inputs.

The subsequent nutrition estimate receives:

| Assessment | Nutrition-estimation inputs |
|---|---|
| `consistent` | Original text + photo |
| `complementary` | Original text + photo; the V3 estimate prompt may include additional visibly supported ingredients |
| `contradictory` | Original text only; do not forward the photo, assessment prose, or any image-derived ingredient description |
| `uncertain` | Original text only under accepted PO-161-2; do not claim a contradiction |
| No photo | Original text only; skip the assessment call |

This two-call boundary is recommended because a prompt instruction inside a single multimodal nutrition call cannot enforce that the image has no influence on the returned nutrition. In text-only branches, the estimate call must not receive the image or a prior nutrition snapshot that may have been produced using that image.

For a refinement request routed text-only, retain the original user description and sanitized user-provided `hints`/`note`, but omit `refine.previous` from the provider message. This prevents an image-influenced prior estimate from indirectly biasing the new text-only result. Keep the existing public refine request validation and shape unless implementation proves it must change; do not forward or replace the prior snapshot with inferred photo content.

If the assessment call fails or returns a malformed/unsupported structure, never continue with an image-based nutrition estimate. Follow the existing controlled provider/schema failure contract, return no estimate, and do not track usage. A valid `uncertain` assessment is a normal result and follows the text-only fallback above.

### API and shared response

Extend the response and shared read type additively. V3 responses must return:

```ts
photoProvided: boolean;
photoAssessment: 'consistent' | 'complementary' | 'contradictory' | 'uncertain' | 'no_photo';
photoUse: 'included' | 'excluded_mismatch' | 'excluded_uncertain' | 'no_photo';
photoUsed: boolean; // true only when the photo was included in nutrition estimation
```

`photoUse` and `photoUsed` are server-derived from the validated assessment and the approved fallback rule, not generated as free-form model prose. `photoUsed` is retained for existing consumers but its semantics change from “image was submitted” to “image contributed to the nutrition estimate”; `photoProvided` records whether an image was submitted/inspected. V1 responses remain readable with the new fields optional in the shared read type. V3 responses always include the fields, including `no_photo` for text-only requests.

The backend appends a fixed, localized warning to the existing `warnings` array for excluded-photo cases so older mobile clients still receive actionable text. The new mobile UI must use the structured fields for presentation and must not parse AI prose or infer exclusion from warning text.

The existing Diary boolean `aiMealEstimatePhotoUsed` must reflect `photoUsed` (actual nutrition use), not mere upload. This keeps the Diary badge from claiming an excluded photo informed the estimate. No new Cosmos field, container, migration, or retention behavior is proposed; existing confirmed diary entries remain readable and are not rewritten.

### User-facing feedback

Show a persistent, accessible, non-modal notice near the photo/result header and before the nutrition values. It does not block the valid text-only estimate or its normal review/save flow.

Proposed German copy for a contradiction:

> Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.

Proposed German copy for an uncertain match:

> Das Foto ließ sich nicht sicher zuordnen und wurde für die Schätzung nicht verwendet. Bitte prüfe, ob es zur Beschreibung passt.

The new UI maps `photoAssessment` / `photoUse` to fixed copy. The matching/complementary states show the existing “Foto genutzt” state and no contradiction notice. A complementary photo's additional visible ingredients remain eligible for the existing recognized-components display. Keep the normal editable review and confirmation path. Do not use an alarmist error state when a text-only estimate succeeded.

## Prompt, Validation, Quota, and Logging

- Bump the end-to-end meal-estimate prompt version from `meal-estimate-v2` to `meal-estimate-v3`; add a separately versioned photo-assessment prompt (proposed constant `MEAL_PHOTO_ASSESSMENT_PROMPT_VERSION`). The pipeline `promptVersion` returned and stored remains the meal-estimate version; logs may include both version constants.
- Use Strict Structured Outputs for classification: closed enum, `strict: true`, `additionalProperties: false`, and server-side validation. The assessment prompt must define primary-meal identity, complementary visible ingredients, and abstention as `uncertain`, subject to PO decisions.
- Update the V3 estimate prompt to use additional visibly supported ingredients when the meal matches. Do not add calorie anchors or hidden-fat/oil/sauce assumptions. Do not permit a classifier explanation to become a nutrition input.
- `enforceQuota('meal-estimate')` remains before the first provider call. One successful, validated estimate request consumes exactly one existing quota use even when a photo request uses two provider calls. No new quota feature or per-provider-call usage is introduced. Failed assessment, failed estimate, or hard plausibility failure consumes no use; successful refinements retain the existing one-use behavior.
- Preserve server-side nutrition validation and run it on the final estimate, including the text-only fallback. Do not treat the assessment enum as evidence of nutritional plausibility.
- Telemetry may retain existing non-content fields and add bounded technical stage/call-count/token/duration and version metadata. Do not log text, note, image/base64, provider payload/raw response, food names, classifier enum/relation, classifier explanation, user ID, or auth token. Do not add per-user photo-mismatch analytics in this change.
- Keep authentication, image size/type checks, request-only photo handling, and confirmation-before-persistence unchanged.

## Scope

- Backend photo assessment prompt/schema, strict response validation, source-routing orchestration, V3 estimate prompt, final-output validation, quota ordering, and privacy-safe diagnostics.
- Additive `shared` response fields and V1 compatibility.
- Mobile result notice, actual photo-use indicator and Diary attribution, accessible German copy, and focused UI/payload tests.
- Focused prompt evals using independently labeled, rights-cleared photo/text fixtures where available.
- Current-state Knowledge Base updates for AI behavior, API contract, quota accounting, mobile UX, and mobile implementation.
- Targeted independent QA after implementation.

## Out of Scope

- Reopening or re-running the completed V2 feature scope except for affected regressions.
- Changing the model/deployment, Azure resources, Bicep, app settings, or adding a service/package.
- New quota rules, Cosmos fields/containers, data migration, photo persistence/cache, or storage/retention changes.
- Calorie anchors, assumptions about hidden fat/oil/sauce, or nutrition/domain thresholds.
- Storing the contradiction assessment, model rationale, or excluded photo in the Diary.
- Editing `docs/legal/datenschutzerklaerung-alpha.md`; policy changes require separate explicit approval.
- Asking QA to close FT-QA-2026-161 before implementation and targeted independent verification.

## Confirmed Decisions, Assumptions and Open Questions

- **Text ambiguity:** The clarification says “Wenn im Text mehr Zutaten zu erkennen sind, als im Text”. The user accepted on 2026-11-04 that this means “if more ingredients are visible in the image than are named in the text, but the primary dish fundamentally matches, continue using both.”
- **Uncertain classification:** The user accepted on 2026-11-04 the text-only fallback under PO-161-2; no contradiction is claimed when classification is uncertain.
- **Meaning of contradiction:** The user accepted on 2026-11-04 the primary-meal identity definition under PO-161-1; no threshold or food ontology is established by the current KB.
- **Test imagery:** Use only repository-owned or otherwise rights-cleared, non-personal fixtures with independent labels. Do not copy real user photos into tests or eval artifacts. If suitable fixtures are unavailable, model-level semantic classification remains unverified; mocked routing tests do not establish recognition accuracy.
- **No legal conclusion:** Provider retention, legal basis, and processing-region guarantees are not newly verified here.

## Privacy Impact

Privacy Impact: Policy covered
Data flow: User text and selected photo continue from Mobile through the authenticated Backend to the existing shared Azure OpenAI service. With a photo, the image is first sent for a transient relationship classification; it is sent again to the estimate call only for `consistent`/`complementary` results. For `contradictory`/`uncertain`, only text and user-supplied refinement data reach the nutrition-estimation call. The structured assessment and warning are returned transiently to the user's Mobile review UI. After explicit confirmation, existing Diary nutrition fields and the existing photo-used boolean may be stored; no image, classifier result, rationale, or new field is persisted. Existing telemetry remains metadata-only and excludes content and the assessment category. No user ID or auth token is sent to Azure OpenAI.
Policy sections affected: “Wo und womit werden Daten verarbeitet?” / “KI-Funktionen”. The existing policy already discloses text/photo processing by Azure OpenAI and confirmation before saving; the additional classification is within this processing purpose. No policy edit is proposed.
Proposed text: N/A — policy remains unchanged unless separately approved.
Open questions: The existing KB notes that Azure OpenAI GlobalStandard processing is not limited to Europe while the policy describes European Azure storage; that pre-existing processing-region/legal question is not resolved by this addendum. Azure-side retention and legal basis are not asserted. This assessment is not legal advice.

## Work Packages

### WP-161.1 — Backend and Shared Contract

Agent: Backend

Goal: Implement and validate the approved structured photo-assessment contract, isolate image classification from nutrition estimation, preserve the existing one-use quota semantics, and update backend-owned Knowledge Base documents.

Required Knowledge Base:
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

Required Repository Context:
- `backend/src/functions/ai.ts`
- `backend/src/functions/ai.test.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.wire.test.ts`
- `backend/src/lib/prompts/mealEstimate.ts`
- `backend/src/lib/prompts/mealEstimate.eval.test.ts`
- `backend/src/lib/prompts/mealEstimate.eval.fixtures.ts`
- `backend/vitest.eval.config.mts`
- `shared/types/aiMealEstimate.ts`
- `backend/src/functions/diary.ts`

Required Skills:
- `azure-openai-feature-integration`
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-161-1 through AC-161-8
- AC-161-11 through AC-161-14

Dependencies: Fresh explicit approval of this addendum and resolved PO-161-1 through PO-161-3.

Expected Handoff:
- Exact assessment and response schemas, routing table, prompt version constants, and V1 compatibility behavior.
- Tests proving that contradictory/uncertain estimation calls receive no image and no potentially image-influenced previous estimate; consistent/complementary calls retain image use.
- Quota, failure, final plausibility, and telemetry evidence; no content-bearing logs.
- Prompt-eval command/result and fixture provenance, with any semantic-accuracy limitation stated explicitly.
- Updated backend/domain/API/quota/shared-library Knowledge Base documents.

### WP-161.2 — Mobile Review UI and Diary Attribution

Agent: Frontend

Goal: Consume the structured response, clearly explain when a supplied photo was excluded, preserve normal review/save behavior, and persist the existing photo-used boolean according to actual nutrition use.

Required Knowledge Base:
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`

Required Repository Context:
- `shared/types/aiMealEstimate.ts`
- `mobile/src/modules/nutrition/MealEstimateResult.tsx`
- `mobile/src/modules/nutrition/MealEstimateResult.test.tsx`
- `mobile/src/modules/nutrition/hub/AISubFlow.tsx`
- `mobile/src/modules/nutrition/MealEstimateReviewScreen.tsx`
- `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/modules/nutrition/diaryItemUtils.test.ts`

Required Skills:
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-161-7 through AC-161-10
- AC-161-13 through AC-161-14

Dependencies: WP-161.1 handoff; shared/API contract frozen before Mobile changes.

Expected Handoff:
- German accessible copy and screenshots/description for contradictory, uncertain, complementary, consistent, and no-photo states.
- UI tests asserting exclusion notices are based on structured fields and the user may still review/save a successful text-only estimate.
- Save/Diary evidence showing `aiMealEstimatePhotoUsed` is false when the photo was excluded and true only when it contributed to nutrition; no new persisted assessment data.
- Updated mobile UX and implementation Knowledge Base documents.

### WP-161.3 — Targeted QA Re-review

Agent: QA

Goal: Independently verify this addendum's acceptance criteria against the implementation and updated documentation. Do not amend or close the central finding register; report evidence to the Orchestrator for its authorized status update.

Required Knowledge Base:
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/05-ux-patterns.md`

Required Repository Context:
- `backend/src/functions/ai.ts`
- `backend/src/functions/ai.test.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.wire.test.ts`
- `backend/src/lib/prompts/`
- `shared/types/aiMealEstimate.ts`
- `mobile/src/modules/nutrition/MealEstimateResult.tsx`
- `mobile/src/modules/nutrition/MealEstimateResult.test.tsx`
- `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`
- `docs/legal/datenschutzerklaerung-alpha.md`
- `docs/qa/reports/PLAN_US_KI-Mahlzeitschaetzung-V2.md`

Required Skills:
- `azure-openai-feature-integration`
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-161-1 through AC-161-14

Dependencies: WP-161.1 and WP-161.2 complete; their handoffs and test evidence available.

Expected Handoff:
- A separate targeted report under `docs/qa/reports/` with criteria matrix, commands/results, findings, and explicit unverified limits.
- Confirm whether FT-QA-2026-161 remains reproducible. Only after this independent re-review may the Orchestrator update the central register; this plan does not pre-authorize closure.

## Acceptance Criteria

- AC-161-1: The user explicitly approves this revision and resolves or accepts each of PO-161-1 through PO-161-3 before implementation starts.
- AC-161-2: Every photo-bearing request obtains a strict structured assessment with the approved enum. The backend rejects malformed/unknown values and does not infer a classification from free-form warning text.
- AC-161-3: The approved classification definition distinguishes direct primary-meal identity contradiction from complementary visible ingredients. Merely seeing an ingredient/side not named in the text does not produce `contradictory` when the primary dish matches.
- AC-161-4: For `contradictory`, the final nutrition-estimation provider request contains the user text but no image, image-derived food description, or image-influenced previous estimate. The returned estimate is validated and reviewable as a text-only estimate.
- AC-161-5: For `complementary` and `consistent`, the nutrition-estimation request contains both sources. A focused, independently labeled fixture verifies that extra visible ingredients can be reflected when the primary dish matches; no hidden ingredient is inferred solely from a heuristic.
- AC-161-6: A valid `uncertain` assessment follows the PO-approved conservative fallback and returns the matching structured source status. An assessment provider/schema failure never falls through to image-based estimation; it returns a controlled failure without tracking quota.
- AC-161-7: V3 responses and Shared types carry the approved structured assessment/use fields, preserve V1 readability, and keep `photoUsed` truthful as the actual nutrition-use boolean. The response includes no model-written contradiction rationale.
- AC-161-8: The result UI clearly states when the photo was excluded, why it was excluded (clear mismatch versus uncertain match), that nutrition was estimated from text only, and asks the user to check the selected photo. A successful text-only result is not presented as a blocking or alarmist error.
- AC-161-9: Matching/complementary results do not show an exclusion warning. The complementary estimate retains the photo and continues to show recognized components through the existing review UI.
- AC-161-10: The app's existing Diary photo-used attribution and badge reflect whether the image contributed to nutrition. No assessment category, model rationale, or image is persisted; explicit user confirmation remains required.
- AC-161-11: `enforceQuota` precedes all provider calls and one valid endpoint estimate consumes exactly one existing `meal-estimate` use, irrespective of the number of internal calls. Failed assessment/estimate and hard validation failures consume none.
- AC-161-12: The pipeline and assessment prompts are versioned; required eval version guards match. No calorie anchors or hidden-fat/oil/sauce heuristics are introduced. Prompt evals pass against independently labeled, rights-cleared fixtures; otherwise semantic model performance is explicitly UNVERIFIED, not claimed as passed.
- AC-161-13: Telemetry contains no user text, note, image, raw provider output, food names, assessment category/rationale, user ID, or token. It may contain only approved bounded operational metadata and existing non-content measures.
- AC-161-14: The relevant API, AI, quota, mobile UX, and privacy data-flow documentation matches the implementation. The privacy policy remains unchanged unless separately approved. QA reports Cosmos emulator unavailability, DV-1 calibration, and any unavailable live eval/device checks honestly; none is silently marked passed.

## Test and QA Strategy

Backend focused tests must cover no-photo bypass, all assessment enum routes, strict schema failures, matching/complementary image forwarding, contradiction/uncertainty image exclusion, refinement snapshot suppression in text-only mode, inclusion of only sanitized user hints/notes, assessment/provider failure, final plausibility validation, and once-only quota tracking. Wire tests must assert the two distinct provider payloads and strict Structured Output schemas.

Prompt eval fixtures should include at least one independently reviewed case per approved relationship class, including a complementary photo with visible additional food. Fixtures must be owned or rights-cleared, non-personal, and independent of prompt wording. Do not create calorie reference expectations from the prompt. Run the required backend eval suite (`npm run test:eval`) after prompt/schema changes. If no suitable fixtures are available, report model classification accuracy as UNVERIFIED; mocked unit tests alone are insufficient evidence of image understanding.

Mobile tests must cover each structured state, exact user-facing messages, visibility/accessibility, continued save/review on text-only fallback, no exclusion notice for complementary photos, legacy V1 response behavior, and Diary attribution. Run focused Mobile tests and Mobile typecheck.

QA also verifies backend unit tests and `npm run build:verify`, Shared tests/typecheck if Shared types change, privacy-data-flow consistency, and the changed Knowledge Base/API wording. The targeted QA report is additive to the existing V2 report; it must not rewrite earlier results or claim the entire V2 suite was rerun unless it was.

## Risks and Verification Limits

- The model can falsely classify a correct photo as contradictory or fail to detect a wrong photo. Structured output guarantees only an enum shape, not semantic accuracy. User review remains required; eval coverage reduces but cannot eliminate this risk.
- Text-only fallback for uncertainty is transparent and prevents uncertain image content influencing nutrition, but can omit useful visual portion cues or ingredients. This trade-off was accepted under PO-161-2 on 2026-11-04.
- Separate assessment plus estimation adds one Azure OpenAI call per photo request, increasing latency and token cost. Measure both stage and total usage without logging user content; no model/deployment change is included.
- Refinement can otherwise reintroduce photo influence through `previous`; the text-only path must suppress that snapshot and preserve only original text and user-entered refinements.
- The base V2 QA report remains `PASS WITH ISSUES`; the active finding is not closed by this plan. A targeted report after implementation is required.
- Cosmos contract assertions were previously UNVERIFIED because the emulator endpoint was intentionally unavailable. This addendum introduces no Cosmos shape change, so that remains a documented non-blocking limit, not a pass.
- DV-1 independent calorie-reference validation remains pending and AC-12 remains UNVERIFIED. The photo contradiction work neither satisfies nor invalidates DV-1.
- No live Alpha deployment, migration, Azure provider run, device validation, or broad-suite rerun is claimed by this planning artifact.

## Dependencies and Recommended Execution Order

1. User resolves PO-161-1 through PO-161-3 and explicitly approves this addendum.
2. WP-161.1 Backend freezes and implements the response/shared contract, classifier, text-only/multimodal routing, prompt versions, quota/logging behavior, focused tests/evals, and Backend-owned KB updates.
3. WP-161.2 Frontend consumes the frozen contract, implements the notice and Diary attribution, adds focused UI tests, and updates Mobile-owned KB documents.
4. WP-161.3 QA performs the independent targeted re-review and produces a separate report. The Orchestrator then updates the central finding status based on that report; QA is not asked to clear the finding in advance.

No Infrastructure & Release feature work package is needed: there are no Bicep, resource, container, or configuration changes. After implementation approval and QA, the operational release order remains Backend first, then Mobile distribution. `Infrastructure Impact: Alpha` reflects that the deployed Alpha API behavior changes; `Mobile Build Impact: None` reflects a JS/type/UI-only Mobile change and does not decide the release build requirement.
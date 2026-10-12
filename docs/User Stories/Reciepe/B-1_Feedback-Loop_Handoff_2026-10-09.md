# B-1 Recipe Preparation Feedback Loop: Renderer Probe Handoff

Scope: ONLY user-approved B-1 of PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09, approved 2026-10-09. Full plan not read. No B-2/D-1 implementation, provider calls, deployment, commit, release claim or independent QA approval.

## Starting Baseline and Ownership

- HEAD: `b637ee5b59a4f72b7d822443680c1951a01f9dc4`.
- `B-1_Feedback-Loop_Baseline_2026-10-09.json` records complete starting status, hashes of every dirty tracked/untracked file, candidate source snapshots and their pre-existing Git diff.
- The existing renderer test and backend KB were already dirty. Their existing content, including the selective-summary tests and targeted step-overflow logging documentation, is retained. No existing dirty hunk is owned by B-1.
- Owned production edits: `backend/src/lib/instagramRenderer/render.ts`, `recipeDetailsTemplateV3.ts`, `types.ts`, `index.ts` in the same directory.
- Owned adjacent edits: additions/import changes in the existing `__tests__/recipeDetailsTemplate.test.ts`; B-1-only paragraphs in `docs/kb/tech/02-backend.md` and `08-testing.md`.
- `detailTextLayout.ts` was read but not changed. No Shared, handler, prompt, persistence, mobile or infrastructure changes.
- `B-1_Feedback-Loop_Owned-Diff_2026-10-09.patch` is generated against the STARTING WORKTREE snapshots, not HEAD. It contains only owned source/document hunks plus this new handoff and its new evidence generator. Generated artifacts are identified and hashed separately in the evidence manifest.
- `B-1_Feedback-Loop_Evidence_2026-10-09.json` lists owned hunk headers and before/after hashes and checks every unrelated starting dirty file byte-for-byte. The starting baseline artifact is immutable.

## Internal API for B-2

Exported from the existing renderer barrel and implemented in `render.ts`:

```ts
probeInstagramRecipeDetailsGeneratedText(input: {
  savedTitle: string;
  teaser: string;
  steps: string[];
}): Promise<RecipeDetailsGeneratedTextProbeResult>
```

No image, ingredients, selected export, full recipe or provider payload belongs in this input. Supply the complete candidate step array on EVERY call, including after a count/layout change. The saved title is contextual and must never be made AI-editable.

The exported types in renderer `types.ts` are backend-only; no external HTTP or Shared contract changed.

| Result | Meaning |
| --- | --- |
| `{ ok: true, status: "success", diagnostics, teaserFontSize }` | Teaser and every generated step fit the production nodes in this saved-title context. |
| `{ ok: false, status: "generated-text-failure", diagnostics, teaserFontSize }` | Generated text has existing input-rule or geometry failures. Only this classification can support a later generated-text correction. |
| `{ ok: false, status: "technical-failure", diagnostics, error }` | Geometry/context cannot be established; never an AI-correction signal. |

Diagnostics identify `field: "title" | "teaser" | "steps"` and zero-based `itemIndex` for steps:

- `fits` / `overflow`: actual `measured: { width, height, maxWidth, maxHeight }`, `fontSize`, `displayText`.
- `width-overflow`: actual `measured: { width, maxWidth }` and `fontSize`; deliberately NO height or multiline-height estimate.
- `invalid-text`: `INVALID_TEXT` / `INVALID_STEP_COUNT`; no fabricated measurements. Invalid fields are not normalized into acceptance or reported as fitting.
- `technical-failure`: `INVALID_CONTEXT`, `MISSING_ASSET`, `FONT_OR_SATORI_FAILED`, `MISSING_MEASUREMENT`, `NON_FINITE_MEASUREMENT`, `TITLE_LAYOUT_FAILED` or `PROBE_FAILED`. Result-level `error` supplies the technical code/message and optional missing asset.

The probe collects failures across all generated fields. Any technical diagnostic takes precedence over generated failures. Font/Satori exceptions mark all fields technically unestablished. A `title` diagnostic is contextual only: success DOES NOT certify the saved title, ingredients, metadata chips, photo, full image or atomic share bundle. Future sharing must still validate and render the actual adapted full input.

## Shared Production Ownership

- `recipeDetailsTemplateV3.ts`: extracted exact `createTitleAndTeaser`, `createPreparationPanel` and `createDetailsCanvas` helpers, used by both full composition and `composeRecipeDetailsGeneratedText`. The complete preparation panel, row/marker/text flex hierarchy and original root remain intact. Teaser width, accent, gap, flex/minWidth, italic font, whitespace and word-break behavior are unchanged. No image or ingredient node exists in the text-only tree.
- `getRecipeDetailsTextLayoutFields`: accepts the existing full input or its title/description/steps subset. All font styles and assigned bounds remain owned here; absent ingredients produce no fields, not invented ingredient content.
- `detailTextLayout.ts`: unchanged production `addMeasuredGermanBreaks` / `measureDetailTextWidths`, using German pattern positions and measured visible hyphens.
- `render.ts`: shared Satori loading, four-font cache, text overrides, measurement collection, existing text validity rules, teaser attempt sizes and the existing `exceedsDetailsBounds` 0.5 px tolerance. Probe loads only Satori and bundled fonts. Full runtime/design assets retain their own loading path.
- Fonts remain Inter Medium 500 normal, Inter Medium Italic 500 italic, Inter SemiBold 600 and InterDisplay Bold 700. Their verified bytes and the offline photo hash are recorded in evidence.
- Teaser font attempts remain exactly 22, 21, 20, 19, 18, with the existing title-dependent height and terminal-period display omission. Steps remain 22 px for 1-4 rows and 18 px for 5 rows; bounds are 302 x 105 and 318 x 84 respectively.
- No new cap, three-line acceptance rule, omission, truncation, font/layout/image fallback or normalization of saved/generated content was introduced. Existing title60/teaser96/step90 constraints and 1-5 step capacity remain unchanged; the full renderer preserves its public FIRST failure and its legacy synthetic height on width-break errors. The NEW probe never reports that synthetic height.

## Verified Candidate Context

Source: existing `quarkbroetchenDetailsFixture`, offline versioned `test-fixtures/quarkbroetchen-source.png`, unchanged production fonts. No authenticated Alpha photo or confirmed export view was required.

The exact four-step candidate is:

1. `Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.`
2. `Forme den Teig zu Brötchen.`
3. `Backe die Brötchen im vorgeheizten Ofen.`
4. `Lasse die Brötchen abkühlen.`

Step 1 is the exact approved-package Alpha sentence. Steps 2-4 are deterministic offline context, not a claimed complete authenticated Alpha replay. Saved title, teaser, ingredient rows, full renderer context and every measured diagnostic are persisted in the evidence JSON.

Probe and full renderer both reject step 0 at exactly 300 x 112 px against 302 x 105 px, unchanged 22 px font. A manually selected shorter ingredient-preserving candidate, `Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig.`, passes with the SAME remaining context and font. This is a regression candidate, not a provider correction or general semantic-preservation proof.

Three full-render PNG SHA-256 fingerprints captured BEFORE production extraction are pinned in regression tests and rechecked on compiled output:

| Context | SHA-256 |
| --- | --- |
| Original Quarkbroetchen fixture | `b81a0cc528c389cc3b21113ef7d65ea6d7cc37ba2023b4d9fa035e087573036a` |
| Shorter four-step candidate | `bc9276a5158de0c1247a9da9b33a4fd5a072268f4fec4c7108b40ac94f460d74` |
| Dense 20-ingredient fixture using the offline photo | `e1737c8af626890d61ae1cc3decac0a31e6e6de7da8ca98fe2a88982e17b130b` |

Parity coverage: all 1-5 step counts across short/medium/long title layouts; identical full/probe node width and height and teaser attempt sequence; natural title-dependent sizing, terminal-period handling and German breaks; all five explicit teaser-size selection paths; count-change rechecks; multiple step and teaser failures; invalid text/count with no claimed validation; 0.5 / 0.5001 px width/height boundaries; absent/non-finite final nodes and absent width nodes; saved-title technical failures; cold starts with Sharp/Resvg imports and non-font reads blocked; missing/corrupt fonts and Satori errors.

Injected-dimension boundary/selection tests retain real fonts and Satori nodes but are not claimed as naturally occurring production layouts. Natural-layout parity is tested separately.

## Validation and Evidence

All commands ran offline from the workspace root. Durable output names use the `B-1_Feedback-Loop_` prefix and date `2026-10-09` in this directory.

| Gate | Result | Durable output |
| --- | --- | --- |
| Pre-extraction focused renderer | 35 tests / 1 file passed, exit 0 | Initial focused capture; baseline PNG lines retained in baseline unit output |
| Pre-production-change backend units | 1440 tests / 66 files passed, exit 0 | `Baseline-Units_2026-10-09.txt` |
| Extraction focused renderer | 35 tests / 1 file passed, exit 0; three hashes unchanged | `Extraction_2026-10-09.txt` |
| Alpha probe/full-render check | 1 passed, 34 skipped, exit 0 | `Alpha_2026-10-09.txt` |
| Final focused renderer | 83 tests / 1 file passed, exit 0 | `Focused_2026-10-09.txt` |
| Final complete backend units | 1488 tests / 66 files passed, exit 0 | `Units_2026-10-09.txt` |
| `npm run typecheck --workspace=backend` | Passed, exit 0 | `Typecheck_2026-10-09.txt` |
| `npm run build:verify --workspace=backend` | Passed, exit 0; asset copy, compiled startup/imports and duplicate function IDs checked | `Build_2026-10-09.txt` |
| Evidence generator syntax | `node --check`, exit 0 | Reproducible evidence script |
| Compiled evidence generator | Passed, exit 0; four contexts, three baseline PNG hashes, 9 owned files, 75 unrelated baseline files unchanged | `Evidence_2026-10-09.json`, `Owned-Diff_2026-10-09.patch` |
| `node scripts/check-encoding.mjs` | Passed, exit 0 | `Encoding_2026-10-09.txt` |
| `git diff --check` | Passed, exit 0 | Recorded here and in evidence manifest |
| `git apply --reverse --check` on owned patch | Passed, exit 0; check only, never applied | Recorded here and in evidence manifest |
| Owned-diff credential-pattern scan | Zero matches; no secrets or settings were read | Recorded here and in evidence manifest |

Development-only corrections: initial typecheck exposed one widened literal in exception diagnostics, repaired before further work; the first expanded suite had three test-expectation failures from an assumed 328 px compact width, corrected to the EXISTING 318 px. The first workspace-root evidence run found the visual fixture's backend-relative photo path; the evidence script now explicitly binds the same versioned offline photo, without a renderer fallback. Same checks reran green. No baseline failures or unrelated fixes.

Reproduce compiled candidate/preservation/hunk evidence AFTER build:

```powershell
node 'docs/User Stories/Reciepe/B-1_Feedback-Loop_Evidence_2026-10-09.mjs'
```

The generator verifies actual compiled candidate results and original PNG fingerprints, captures measured diagnostics without image buffers, checks unrelated dirty hashes and writes owned-diff/evidence artifacts. It makes no network/provider/deployment call. Gate counts in its manifest describe the recorded commands above, not commands rerun by the generator.

No architectural/documentation conflict was found in the B-1 renderer slice. No scope deviation. Current full-render width-break height is deliberately preserved as a legacy public-contract detail, not reused as probe geometry.

Remaining boundaries: B-2 integration, live cooking-core/correction evidence, independent QA and release are not performed or claimed by B-1. Contract/emulator tests are not required for this renderer-only change. No B-1 implementation blocker is known.
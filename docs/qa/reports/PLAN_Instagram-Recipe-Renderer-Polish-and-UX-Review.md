# QA Report: Instagram Recipe Renderer Polish and UX Review

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md](docs/User%20Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md)
- Verdict: `PASS WITH ISSUES`

## Scope

Reviewed only the approved Q-IPR-1 renderer-polish round against the B-IPR-1 implementation and the fourteen acceptance criteria. The review covered the backend renderer source, focused regression tests, active assets, the generated working PNG, the unchanged historical V1.7 Golden spatially, renderer metrics documentation, and the reference-promotion gate.

The review did not modify production renderer code, package files, mobile source, the plan, the historical Golden fixture or expected image, QA tests, `docs/qa/findings.md`, or the existing unrelated worktree changes. No current approved reference was created or promoted.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [backend/src/lib/instagramRenderer/index.ts](backend/src/lib/instagramRenderer/index.ts) keeps `renderInstagramRecipe(input)` as the public entry point. The implementation remains a local renderer path with no HTTP, auth, API, Cosmos, storage, mobile, shared, or infrastructure change in this review slice. |
| AC-2 | PASS | The regenerated [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) is a PNG with `1080 x 1350` pixels, sRGB, four channels and alpha. `npm run render:instagram-reference` completed with exit code `0`; the renderer uses local assets only. |
| AC-3 | PASS | [backend/src/lib/instagramRenderer/compose.ts](backend/src/lib/instagramRenderer/compose.ts) renders exact text `PRO PORTION` with `COLOR_LIME` and no background, border, or shadow. Independent pixels measured Lime bounds `x=473..605`, `y=1040..1054`; the central card-divider run is absent, with only outer edge runs at `x=462..465` and `x=614..617`. The focused A/B comparison found `0` normal-versus-empty-barbell differences in the protected label region. |
| AC-4 | PASS | [backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg](backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg) retains `viewBox="0 0 904 64"` and the mirrored right group. Independent current-PNG metal bounds are `x=128..951`, `y=1025..1070`, with left/right metal pixel counts `2876/2877`; layout constants retain `824 px` width, `40 px` insets and center `x=540`. Card and value-row anchors remain unchanged. |
| AC-5 | PASS | [backend/src/lib/instagramRenderer/layout.ts](backend/src/lib/instagramRenderer/layout.ts) uses `38/16/18/6/12 px` for chip height, side padding, icon size, icon-text gap and chip gap. The focused tag suite passed the `0`, `1`, `4`, unknown and Curry cases while preserving mappings and labels. Four rendered chips occupy `x=88..637` within the `904 px` row. |
| AC-6 | PASS | Focused tests passed the compact chip structure and four-chip bounds. Independent inner-corridor measurements found visible icon bounds at `16..19 px` from the outer chip edge after accounting for the one-pixel border and SVG stroke whitespace; visible text begins at the expected `42 px` layout offset. The four-tag row has no overflow or silent truncation. |
| AC-7 | PASS | [backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png](backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png) is RGBA `1254 x 1254` with alpha bounds `x=98..1156`, `y=98..1142`. The dominant accent is `RGB(185,239,18)` / `#B9EF12` with `545` pixels. The dark body and white text remain present; independent white-on-dark contrast is `16.6175:1`. |
| AC-8 | PASS | The focused highlight suite passed high-protein, low-fat and null-highlight cases. Pixel comparison found `0` differences outside the existing `128 x 128` badge box; the `top=66`, `right=65`, `size=128` anchors and remaining layout geometry stayed fixed. |
| AC-9 | PASS | The technical contrast check passes at `16.6175:1`, above `4.5:1`. The current full-size PNG keeps the badge subordinate to the title and aligned with the lime system in the rendered image. Final photo/thumbnail perception remains in the separate manual validation gate below. |
| AC-10 | PASS | [backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg](backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg) uses `viewBox="0 0 1197.24 197.35"`, has no full background rectangle, and is the active loader source. [mobile/assets/brand/micha_logo_writing_01.svg](mobile/assets/brand/micha_logo_writing_01.svg) contains the excluded full rectangle; `fittrack-wordmark.png` remains only as the documented legacy fallback. |
| AC-11 | PASS | [backend/src/lib/instagramRenderer/render.ts](backend/src/lib/instagramRenderer/render.ts) selects the active wordmark as UTF-8 `image/svg+xml` and only invokes `normalizeWordmarkBackground()` for the legacy PNG fallback. Independent rendered bounds are `x=460..619`, `y=1242..1267`, giving `160 px` visible width centered at `x=539.5`; footer corner samples follow the ambient field and show no old rectangle. |
| AC-12 | PASS | The required focused command passed all four files and `12/12` tests. The tests cover the A/B label diagnosis, Hantel geometry, tag structure/fallbacks, badge RGBA/palette/contrast/null state, and SVG footer bounds/transparency. Independent Sharp checks were also run against the working PNG and assets. |
| AC-13 | PASS | [backend/src/lib/instagramRenderer/__tests__/golden.test.ts](backend/src/lib/instagramRenderer/__tests__/golden.test.ts) retains threshold `0.10`, ratio gate `0.03`, and the unchanged historical fixture. The unchanged historical run exits `1` at ratio `0.054997256515775035`; this is recorded as the expected diagnostic result of the approved design changes, not as an actionable finding or a threshold workaround. No current reference was promoted. |
| AC-14 | PASS WITH ISSUE | [backend/src/lib/instagramRenderer/docs/golden-metrics.md](backend/src/lib/instagramRenderer/docs/golden-metrics.md) records the current B-IPR-1 pixel, tag, badge and footer measurements, and this report records the historical diagnosis and pending manual status. [backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md](backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md) also records the active SVG at the top, but retains an unmarked later section that still describes the old PNG as the Footer asset; this documentation contradiction is recorded as finding `Q-IPR-1-DOC-001`. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/tags.test.ts src/lib/instagramRenderer/__tests__/highlight.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts` | 0 | `4` files passed, `12` tests passed. |
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts` | 1 | Historical V1.7 comparison exceeded the unchanged `0.03` ratio gate with `0.054997256515775035` differing pixels ratio. |
| `cd backend && npx tsc --noEmit` | 0 | Backend typecheck completed without diagnostics. |
| `cd backend && npm run build:verify` | 0 | Build and shared-import verification completed with `All checks passed.` |
| `cd backend && npm run render:instagram-reference` | 0 | Regenerated the local `backend/output/quarkbroetchen.png` working PNG only. |
| `cd backend && npm test` | 1 | `51` test files passed and `1` historical Golden file failed diagnostically; `988` tests passed and `1` historical Golden test failed out of `989`. No unrelated test failure occurred. |

## Independent Pixel and Spatial Review

- Current working PNG metadata: `1080 x 1350`, PNG, sRGB, four channels, alpha.
- `PRO PORTION`: exact lime glyph bounds `x=473..605`, `y=1040..1054`; no central `#37463D` divider run through the label; the A/B regression found `0` protected-region differences after removing the barbell contribution.
- Hantel: complete symmetric bounds `x=128..951`, `y=1025..1070`; shaft rows remain `y=1045..1050` and the left/right metal counts differ by one pixel.
- Tags: rendered Lime chip bounds are `Backen 88..202`, `Vegetarisch 215..364`, `Snacks 377..490`, `Fruehstueck 503..637`; all are `38 px` high with `12 px` inter-chip gaps.
- High-protein source: RGBA, stable measured alpha bounds, dominant `#B9EF12`, and `16.6175:1` independent contrast.
- Footer: active SVG is transparent, has the required viewBox, and rasterizes to a centered `160 px` visible wordmark without a rectangular block. The active SVG differs from Mobile variant 02 only in the unused group identifier `Layer 2` versus `Layer_2`; no rendered or transparency difference was observed. This is recorded as a suggestion below.
- Historical spatial comparison with pixelmatch threshold `0.10`: overall `80,186` differing pixels, ratio `0.054997256515775035`. Zone ratios were hero `2.03%`, tags `43.13%`, badge `25.20%`, card `6.77%`, footer `1.67%`, and protected label region `15.89%`. These differences are localized to the approved visual redesign and are not a new Golden finding.
- A `216 x 270` in-memory thumbnail downscale retained non-empty, distinct title, tag, badge, card and footer zones. The downscale was an automated sanity check; the user subsequently accepted the visual result on 2026-09-16.

## Side-by-Side and UX Observation

The current working PNG preserves the intended hierarchy: photo and title are the primary hook, the compact tag row is a secondary scan line, the single badge is a tertiary accent, the Nutrition Card is a distinct functional block, and the centered wordmark is a restrained footer signature. The current card top edge remains visible outside the label gap, while `PRO PORTION` reads without a foreign line crossing its glyphs. The current footer integrates with the ambient field instead of showing the historical raster rectangle.

Against the historical V1.7 image, the main intentional differences are the compact tag geometry and icon rendering, the lime-aligned badge, the centered transparent SVG footer, and the card/label treatment. The output remains a reusable `1080 x 1350` 4:5 composition with separate scan zones. No later app ideas were evaluated as implementation work; safe-area previews, title-length policy, versioned templates and broader A/B design work remain LATER/product work per the approved plan.

## UNVERIFIED

- Cross-platform rasterization on another operating system or another Resvg version was not executed. Local Windows execution is the available environment.
- CI execution and real-device feed rendering were not executed. These are environment-limited verification states, not actionable findings.

## MANUAL VALIDATION REQUIRED

Result: `ACCEPTED`

Recorded: The user accepted the current working PNG on 2026-09-16. The remaining non-blocking findings were also accepted in [docs/qa/findings.md](docs/qa/findings.md) as `FT-QA-2026-031` and `FT-QA-2026-032`.

The user must inspect [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) at 100 percent or sufficient zoom and as a typical mobile-width 4:5 thumbnail. Confirm:

1. `PRO PORTION` is exactly readable, centered, lime, and free of a green or metallic line through the glyphs; the surrounding card/ambient field remains visible without a black or opaque label box.
2. The Hantel is complete, symmetric and visibly inset; the card, values and dividers remain distinct.
3. Tags feel compact without icons or labels becoming cramped; the four tags remain readable in a feed thumbnail.
4. The high-protein badge is brand-coherent, separated from the food photo, and does not overtake the title.
5. The transparent SVG wordmark is sharp, centered, still identifiable in the thumbnail, and has no dark rectangle.
6. Photo and title remain the first visual hook, followed by tags, badge, Nutrition Card, `PRO PORTION` and wordmark in the intended hierarchy.
7. No unintended changes are visible in title placement, photo crop, nutrition values, dividers, highlight selection or the null-highlight composition.

The result is `ACCEPTED`. The current approved reference was not created or promoted in this review; reference promotion remains a separate follow-up.

## Findings

The remaining findings are recorded in [docs/qa/findings.md](docs/qa/findings.md) as `FT-QA-2026-031` and `FT-QA-2026-032`; the user accepted both on 2026-09-16.

### Q-IPR-1-DOC-001

Finding key: Q-IPR-1-DOC-001  
Plan reference: `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md`  
Acceptance criterion: AC-14  
Description: [backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md](backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md#L82) still states that the Footer asset is the old `fittrack-wordmark.png` and that the PNG workaround is active, while the same document's opening section and the implementation use `micha-logo-writing.svg`. The file therefore contains contradictory unmarked current-state documentation.  
Criticality: Non-blocking  
Owner: Documentation  
Evidence: The active SVG summary appears at [backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md](backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md#L1), while the stale Footer section and workaround appear at [backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md](backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md#L80). `render.ts` and the current PNG independently confirm the SVG path is active.  
Recommendation: Mark the old Footer/PoC section explicitly as historical or replace its current-state claims with the active SVG path, leaving the legacy PNG only as a documented fallback.

### Q-IPR-1-ASSET-001

Finding key: Q-IPR-1-ASSET-001  
Plan reference: `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md`  
Acceptance criterion: AC-10  
Description: The active backend SVG is semantically and visually equivalent to Mobile variant 02 but is not an exact text copy: its unused root-group identifier is `Layer 2` instead of `Layer_2`. The normalized files have equal length but differ at the identifier, so provenance is not byte-exact.  
Criticality: Suggestion  
Owner: Backend  
Evidence: [backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg](backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg) and [mobile/assets/brand/micha_logo_writing_02.svg](mobile/assets/brand/micha_logo_writing_02.svg) have the same viewBox, paths and transparent rendering; independent comparison found the first difference only in the unused group id. The active asset has no `<rect>` and variant 01 does.  
Recommendation: Preserve an exact source copy of variant 02, or document the intentional non-visual identifier normalization so future provenance checks are unambiguous.

The historical Golden exit code `1` is the required diagnostic outcome for the approved design changes and is not classified as a finding. The pending manual visual gate is a separate acceptance state and is not an actionable finding.

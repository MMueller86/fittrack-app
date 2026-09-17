# QA Report: Instagram Recipe Renderer Footer Alignment

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md](docs/User%20Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md)
- Verdict: `PASS`

## Scope

Reviewed the approved Q-FA-2 scope against the current renderer implementation, the Q-FA-1 regression tests, the generated working PNG, and the historical V1.7 Golden Master. The review covers the backend renderer footer geometry, transition end, Nutrition Card, value row, dividers, barbell asset, transparent `PRO PORTION` label, wordmark, highlight/null-highlight states, historical diagnostic comparison, metrics documentation, and reference-promotion gate.

No mobile, shared, infrastructure, API, authentication, persistence, nutrition-calculation, or deployment work is in scope. This QA review did not modify production files, package files, plans, tests, the historical Golden fixture, or `docs/qa/findings.md`.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `renderInstagramRecipe` remains the public renderer entry point in [backend/src/lib/instagramRenderer/index.ts](backend/src/lib/instagramRenderer/index.ts). The focused and full backend tests invoke the existing input/result contract; no HTTP, auth, Cosmos, storage, mobile, shared, or infrastructure path is involved. |
| AC-2 | PASS | Focused tests and the regenerated [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) confirm PNG output at exactly `1080 x 1350`; the render command completed with exit code `0`. |
| AC-3 | PASS | [backend/src/lib/instagramRenderer/layout.ts](backend/src/lib/instagramRenderer/layout.ts) and [backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts](backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts) verify `PHOTO_TRANSITION_END_Y=1015`, Card top `1048`, and the `33 px` structural gap. Photo placement keeps the existing focus/zoom inputs in [backend/src/lib/instagramRenderer/photo.ts](backend/src/lib/instagramRenderer/photo.ts). |
| AC-4 | PASS | The compose-tree and rendered assertions verify the Nutrition Card at `x=88, y=1048, width=904, height=144`, bottom `1192`, with the existing panel, border, radius, and `overflow: hidden`. |
| AC-5 | PASS | The value-row assertions keep `x=120, y=1118, width=840, height=64`, dividers at `x=330/540/750`, and fixture values `250 kcal / 14 g / 31 g / 8 g` with labels `Kalorien / Protein / Kohlenhydrate / Fett`. |
| AC-6 | PASS | The compose tree places the barbell after the Card as a Root sibling, outside the Card clip. Assertions verify `BARBELL_X=128`, `BARBELL_WIDTH=824`, `BARBELL_HEIGHT=58.336283...`, `BARBELL_Y=1018.831858...`, exact `40 px` geometric insets, center `x=540`, and the unchanged `904:64` SVG ratio in [backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg](backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg). No `object-fit` is set. |
| AC-7 | PASS | Independent Sharp pixel measurement of the current PNG found complete symmetric plate bounds: left `x=128..187`, right `x=892..951`, both `y=1025..1070`; both visible edge insets are `40 px`. The shaft is `y=1045..1050`, centered on `y=1048`, with equal left/right metal counts (`1198` each). |
| AC-8 | PASS | Independent pixel measurement found lime `PRO PORTION` at `x=473..605, y=1040..1054`, centered in the barbell gap at the Card top axis. The focused test verifies the label text, lime color, center, and raster corridor. |
| AC-9 | PASS | [backend/src/lib/instagramRenderer/compose.ts](backend/src/lib/instagramRenderer/compose.ts) and the focused test verify that the label has no background, border, or shadow. Neighboring pixels follow the underlying Card/ambient surface; no opaque label rectangle is present in the current PNG. |
| AC-10 | PASS | The wordmark remains an unchanged centered asset at layout box `x=475, y=1222, width=130, height=62`. Independent pixels are `x=493..588, y=1246..1261`; the tested footer sequence is `1192 -> 1222 -> 1284 -> 1350`, including the `30 px` Card-to-wordmark gap and `66 px` bottom clearance. |
| AC-11 | PASS | The focused layout test checks unchanged title, tag-row, badge, Card, and wordmark anchors and renders both the highlighted fixture and `nutritionHighlight: null`. The null-highlight smoke assertions show identical Card, barbell, label, and wordmark geometry. |
| AC-12 | PASS | `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts` passed `2/2` files and `3/3` tests. The regression covers structure, inset geometry, symmetry, clipping, transition gap, shared Card/shaft/label axis, value row, wordmark, highlight, and null-highlight behavior. |
| AC-13 | PASS | [backend/src/lib/instagramRenderer/__tests__/golden.test.ts](backend/src/lib/instagramRenderer/__tests__/golden.test.ts) remains at pixelmatch threshold `0.10` and ratio gate `0.03`; the historical fixture is unchanged. The observed ratio `0.05363991769547325` is recorded as the expected diagnostic result of the approved transition/footer redesign, not as a new defect and not as a threshold workaround. |
| AC-14 | PASS | [backend/src/lib/instagramRenderer/docs/golden-metrics.md](backend/src/lib/instagramRenderer/docs/golden-metrics.md) separates historical V1.7 values, rejected intermediate geometry, and the B-FA-1 working geometry. This report provides the required complete matrix, command results, spatial comparison, `UNVERIFIED` state, and manual gate. |
| AC-15 | PASS | `backend/src/lib/instagramRenderer/test-fixtures/reference/fittrack_instagram_current_approved.png` is absent. Only the working artifact [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) exists; no current reference was created or promoted before explicit user acceptance. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts` | 0 | `2` files passed, `3` tests passed. |
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts` | 1 | Historical V1.7 diagnostic exceeded its unchanged `0.03` gate with ratio `0.05363991769547325`; this is the explicitly expected old-design mismatch. |
| `cd backend && npm test` | 1 | `51` test files passed and `1` historical Golden file produced the expected diagnostic failure; `985` tests passed and `1` historical Golden test failed out of `986`. |
| `cd backend && npx tsc --noEmit` | 0 | Backend typecheck passed with no diagnostics. |
| `cd backend && npm run build:verify` | 0 | TypeScript build and shared-import verification completed with `All checks passed.` |
| `cd backend && npm run render:instagram-reference` | 0 | Regenerated `backend/output/quarkbroetchen.png` as the `1080 x 1350` working PNG. |

## Side-by-Side Observation

| Spatial area | Current working PNG | Historical V1.7 Golden Master |
|---|---|---|
| Canvas | `1080 x 1350`, 4 channels | `1080 x 1350`, 4 channels |
| Transition and Card | Renderer/PNG target ends at `y=1015`; Card begins at `y=1048`, a `33 px` structural gap. | The center profile is already dark near `y=953`; the current `978..1015` transition extension is therefore an intentional historical difference. |
| Nutrition Card and values | Card remains `x=88..991, y=1048..1191`; value row remains at `y=1118..1181`. | The historical Card/value composition is the spatial baseline retained by the plan. |
| Barbell | Uniform, centered asset box `x=128..951` with geometric `40 px` insets; visible plates are complete at `x=128..187` and `x=892..951`, `y=1025..1070`. | The Golden Master keeps the visible plate stacks inside the Nutrition Card and places them closer to its edges; its documented metal zone is around `y=1045..1113`. The current design makes the smaller `824`-wide asset box and `40 px` geometry insets explicit rather than treating the historical image as a full-width target. |
| `PRO PORTION` | Lime pixels `x=473..605, y=1040..1054`, transparent and centered on the Card/shaft axis `y=1048`. | Lime pixels `x=471..607, y=1040..1053`, the historical spatial reference for the label. |
| Wordmark | Visible pixels `x=493..588, y=1246..1261`; centered and without an opaque rectangle. | Historical visible pixels are approximately `x=493..588, y=1246..1260`. |
| Pixel comparison | Overall differing-pixel ratio `0.0536399177`; transition-gap region ratio `0.3866005291`; footer region ratio `0.0344361526`. | The differences are concentrated where the approved transition extension and footer redesign intentionally diverge; no actionable old-Golden mismatch remains after the focused geometry checks. |

## UNVERIFIED

- Cross-platform rasterization on another OS or renderer version was not executed. The checks were run in the local Windows backend environment. This is an environment-limited verification state, not an actionable finding.
- CI execution and a separate manual screen-reader/device workflow are outside this local renderer review. No API, Azure, mobile, or production-environment verification is required by this plan.

## MANUAL VALIDATION REQUIRED

Result: `PENDING USER ACCEPTANCE`

The user must inspect [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) at 100 percent or a sufficiently high zoom and confirm:

- the barbell shaft and exactly readable `PRO PORTION` share the upper Nutrition Card line;
- the group is not a floating header and is not on the value row;
- both plate stacks are complete, symmetric, unclipped, and visibly inset from both Card edges by the intended geometry;
- the image/transition-to-Card distance is visibly reduced;
- values, dividers, title, tags, badge, and wordmark remain intact;
- no opaque rectangle is visible behind `PRO PORTION`.

The result must be explicitly recorded as `ACCEPTED` or with a concrete visual rejection. Reference promotion remains blocked until explicit `ACCEPTED`; this review did not create or promote `fittrack_instagram_current_approved.png`.

## Findings

No actionable findings.

The historical Golden exit code `1` is a documented diagnostic outcome required by AC-13 and is not classified as a finding. The pending manual visual gate is a separate acceptance state and is not an actionable finding.
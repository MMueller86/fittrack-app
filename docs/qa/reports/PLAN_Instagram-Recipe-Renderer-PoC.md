# QA Report: Instagram Recipe Renderer PoC

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-PoC.md`
- Review: final correction re-review, 2026-09-16
- Verdict: `PASS`

## Scope

Reviewed the renderer slice, fixtures and scripts, renderer tests, package and
ignore changes, generated reference PNG, and the unchanged V1.7 Golden
comparison. This review uses the complete approved plan and AC-1 through AC-17.
Azure Function, HTTP/auth/quota, Cosmos/Storage, Mobile, Infrastructure,
deployment, CI/Docker cross-platform determinism, and HTTP/E2E remain out of
scope as approved.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/lib/instagramRenderer/index.ts` exports the importable Node-TypeScript library. `render.ts` contains the public async entry point, and the renderer slice has no HTTP, auth, Cosmos, Storage, or runtime network integration. |
| AC-2 | PASS | `backend/src/lib/instagramRenderer/types.ts` defines the exact typed fields `image`, `presentation`, `title`, `tags`, `nutritionHighlight`, and `nutrition`, with the planned union and nested shapes. |
| AC-3 | PASS | The unchanged Golden test passed. The result asserts `ok: true`, PNG format, `Buffer`, and `1080 x 1350`; independent Sharp metadata confirmed the generated PNG is 1080 x 1350. |
| AC-4 | PASS | `highlight.test.ts` passed both `high-protein` and `low-fat` cases plus `null`; all differences stay inside the fixed badge box, and the null case has no badge pixels. |
| AC-5 | PASS | The generated PNG has one centered wordmark with measured visible bounds `x=493..588`, `y=1246..1261`. `render.ts` alpha-normalizes the raster background and `compose.ts` renders one wordmark layer; visual inspection found no rectangle or hard ambient edge. |
| AC-6 | PASS | `ambient.ts` creates one shared full-canvas Green-Ambient field. `transition.ts` ends the photo-to-dark layer at `y=978` without an opaque terminal stop; source and image inspection show one continuous lower field. |
| AC-7 | PASS | `compose.ts` orders `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett` and rounds values as specified. The Golden fixture renders `250 kcal / 14 g / 31 g / 8 g`. |
| AC-8 | PASS | `compose.ts` contains one barbell asset and one centered `PRO PORTION` element. The generated PNG shows one visible barbell/divider treatment with the label in its center gap. |
| AC-9 | PASS | `errors.test.ts` passed all eight expected error paths: `TITLE_OVERFLOW`, `TOO_MANY_TAGS`, `TAG_ROW_OVERFLOW`, `INVALID_ZOOM`, `INVALID_FOCUS`, `IMAGE_UNREADABLE`, `MISSING_ASSET`, and `INTERNAL`. |
| AC-10 | PASS | `tags.test.ts` passed the zero-tag case, verifies no tag-chip elements are composed, and confirms pixel identity outside the tag-row region when tags are omitted. |
| AC-11 | PASS | `backend/package.json` contains exactly `satori~0.33.4`, `@resvg/resvg-js~2.6.2`, `lucide-static~1.46.0`, `@tabler/icons~3.46.0`, and `pixelmatch~7.2.0`; `npm view` returned the same stable versions. `backend/.gitignore` covers `output/` and `src/lib/instagramRenderer/__tests__/output/`. |
| AC-12 | PASS | The unchanged `golden.test.ts` uses threshold `0.10` and maximum differing-pixel ratio `0.03`, and passed with `42,647 / 1,458,000 = 0.029250342935528122`. The failure-path artifacts `actual.png`, `expected.png`, and `diff.png` exist under the scoped ignored output directory. |
| AC-13 | PASS | `smoke.test.ts` passed the alternate `Sauerteig Nussbrot` fixture with two tags and `nutritionHighlight: null`, checking successful 1080 x 1350 PNG output without a Golden comparison. |
| AC-14 | PASS | This report overwrites `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-PoC.md` with the required `fittrack-qa-v1` format, criteria matrix, command results, findings state, and side-by-side observation. |
| AC-15 | PASS | Static inspection of the renderer runtime found no generative AI, dynamic time/date values, randomness, timers, or network calls. The only search hits are local SVG namespace/license/documentation URLs. |
| AC-16 | PASS | Two sequential `npm run render:instagram-reference` runs returned exit 0 and produced identical SHA-256 `4F141B03FE72CC7C5C993CF31D3F45796A7B25334A27AAF34119F8A8DBA4F4F5`. Sharp confirmed `backend/output/quarkbroetchen.png` is PNG, sRGB, 1080 x 1350. |
| AC-17 | PASS | `tags.test.ts` passed exact local resolves and normalized SVG equality for `@tabler/icons/outline/bread.svg` and `@tabler/icons/outline/bowl.svg`, and confirmed missing `noodles.svg` and `pasta.svg` assets are not used. `tagIcons.ts` contains no invalid double-`icons` specifier. |

## Tests

Commands were run from `backend/` unless the command includes an explicit
working-directory note.

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts` | 0 | One Golden test passed with the unchanged threshold and ratio gate. |
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/errors.test.ts src/lib/instagramRenderer/__tests__/tags.test.ts src/lib/instagramRenderer/__tests__/highlight.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts` | 0 | Four focused renderer suites passed, 15 tests total. |
| `cd backend && npm test` | 0 | Complete backend suite passed: 51 test files and 984 tests. |
| `cd backend && npm run typecheck` | 0 | Backend TypeScript typecheck passed. |
| `cd backend && npm run build` | 0 | Backend production build passed. |
| `cd backend && npm run build:verify` | 0 | Backend build and shared-import verification passed; expected Azure Functions test-mode warnings did not fail the check. |
| `cd backend && npm view satori version; npm view @resvg/resvg-js version; npm view lucide-static version; npm view @tabler/icons version; npm view pixelmatch version` | 0 | Returned `0.33.4`, `2.6.2`, `1.46.0`, `3.46.0`, and `7.2.0`, matching the plan pins. |
| `cd backend && npm run render:instagram-reference` twice with SHA-256 checks | 0 | Both runs passed and produced the identical hash recorded in the criteria matrix. |
| Independent Sharp/pixelmatch metadata and artifact check | 0 | Current output and V1.7 master were both 1080 x 1350 PNG; current differing-pixel count was `42,647` and ratio `0.029250342935528122`. |

## Side-by-side Observation

The current `backend/output/quarkbroetchen.png` was inspected against
`backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`.
Both show the intended recipe photo, highlight, title, four tags, ordered
nutrition values, barbell, center label, and footer wordmark. The current output
has no visible wordmark rectangle and keeps a continuous dark green ambient
field below the photo transition. The remaining differences are visible around
the photo transition, icon glyphs, barbell/card geometry, and rasterized text,
but the independent pixel comparison is within the unchanged approved gate.

The stored comparison artifacts were also inspected:
`backend/src/lib/instagramRenderer/__tests__/output/expected.png` is byte-identical
to the V1.7 master. The stored `actual.png` and `diff.png` are retained
failure-path artifacts from the earlier correction run and therefore show the
older above-gate comparison; the current passing run did not rewrite them
because it did not enter the failure branch. Their presence and scoped ignore
location confirm the required diff behavior without changing the current pass
measurement.

## UNVERIFIED

- State: `UNVERIFIED`
- Check: Cross-platform `@resvg/resvg-js` determinism and CI/Docker execution.
- Reason: Explicitly excluded by the approved plan.
- Result: Not run; no action required for this PoC review.

## MANUAL VALIDATION REQUIRED

- State: `MANUAL VALIDATION REQUIRED`
- Check: Explicit user visual acceptance of `backend/output/quarkbroetchen.png` as the PoC deliverable.
- Prerequisite: Open the generated PNG and compare it with the intended V1.7 composition.
- Expected result: The user records acceptance or rejection of the visual composition.
- Result: Not performed during this QA run. This is a plan gate, not an actionable finding and does not lower the automated QA verdict.

## Findings

No actionable findings. The prior Golden-gate, wordmark-background, and
transition-masking findings were rechecked against the final output and are no
longer present.
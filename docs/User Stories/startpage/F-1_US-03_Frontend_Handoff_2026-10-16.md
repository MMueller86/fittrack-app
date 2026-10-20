# US-03 F-1 Frontend Handoff

Date: 2026-10-16. Status: IMPLEMENTED / CHECKS PARTIAL / NOT ACCEPTED.
Q-1 can review this implementation with the open findings below. This is not
B-1 acceptance, Backend content-safety certification, release or Story approval.
The user's approved API-dependency addendum authorizes this sequential F-1 step;
no renewed APPROVE, successful full live suite or emulator was a start condition.

## Implementation And Scope

- `mobile/src/services/insightService.ts`: `hasCompactInsight` accepts only fresh/cached responses with both nonblank strings within 120/240 JavaScript string units. This is a structural display guard, not a second semantic validator. Greeting format, one complete sentence, data grounding and plausibility remain Backend-owned. Returned strings are displayed unchanged.
- `mobile/src/modules/home/CoachingHeroCard.tsx`: combined greeting/short copy/48-dp `Mehr lesen`, right-hand existing training selector with a 48-dp minimum height. The full response and date are captured on opening detail; refresh cannot replace that snapshot. Without a complete pair, loading, network/AI/validation failure or quota: existing time-based static greeting only, without detail action. No special old-Insight view.
- `mobile/src/modules/home/InsightCard.tsx`: optional unframed detail presentation in the shared `InfoOverlay`, retaining full title/summary/recommendation, Nutrition/Weight CTAs and existing feedback machinery. A direct message icon closes detail and opens the feedback sheet. Close/backdrop/platform-back handlers remain shared. Closing feedback returns to Home. No card inside a card and no detail fetch.
- `mobile/src/modules/home/HomeScreen.tsx`: passes the existing Insight/date/CTA/snackbar callbacks to the combined card and removes the separate Insight card. Loading immediately clears compact copy. Existing focus/refresh request path, request-ID rejection and independent dashboard loading remain. No new requests on day selection, details or absent fields.
- Tests changed: `CoachingHeroCard.test.tsx`, `InsightCard.test.tsx`, `HomeScreen.layout.test.ts`; new `HomeScreen.insight.test.tsx` in the same Home module.
- KB updated: `docs/kb/tech/03-mobile.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`. Existing weight/nutrition/weekly/search/activity/safe-area changes and all other uncommitted work were preserved.

No Backend, Shared, API client, dependencies, navigation architecture, infrastructure
or persistent storage was changed by F-1. No migration/backfill/deletion, forced
generation or new compatibility exception. Existing fingerprint/hash invalidation,
v14 exception only for active v15-v18, interval/day-limit/Admin, quota/usage and
local-midnight TTL remain Backend-owned and unchanged. Shared optional compact
fields continue to reside in the response and exact-instance feedback snapshot.

## Self-Executed Checks

Commands run from repository root; exits refer to the actual local execution.

| Command / action | Exit | Result |
| --- | --- | --- |
| `npm test --workspace=@fittrack/mobile -- src/modules/home/CoachingHeroCard.test.tsx src/modules/home/InsightCard.test.tsx src/modules/home/HomeScreen.layout.test.ts src/services/insightService.test.ts src/shared/api/aiApi.test.ts --reporter=dot` | 0 | 47 pass, 5 files |
| `npm test --workspace=@fittrack/mobile -- src/modules/home/HomeScreen.insight.test.tsx src/modules/home/CoachingHeroCard.test.tsx src/modules/home/InsightCard.test.tsx --reporter=dot --silent` | 0 | 42 pass, 3 files after local mock correction |
| `npm test --workspace=@fittrack/mobile -- --reporter=dot --reporter=json --outputFile=../output/f1-us03-mobile-units-2026-10-16.json --silent` | 0 | Final 912 pass, 89 files; 0 failed/skipped/todo; start 17:18:16.032Z |
| `npm test --workspace=@fittrack/shared -- --reporter=dot --reporter=json --outputFile=../output/f1-us03-shared-units-2026-10-16.json` | 0 | 466 pass, 10 files; 0 failed/skipped/todo; start 17:16:37.873Z |
| `npm run typecheck --workspace=@fittrack/shared` | 0 | PASS |
| `npm run typecheck --workspace=@fittrack/mobile` | 1 | FAIL: two pre-existing errors outside F-1; see below |
| Editor diagnostics for all eight F-1 code/test files | N/A | No errors; not a substitute for the failing full typecheck |
| Node stdin using `fs`, `crypto`, `assert`: compare B-1 pre/post rows, hash each captured source/report/artifact and inspect report counts | 0 | All 291 captured sources match; inherited report/artifact hashes match; no Backend gate rerun |
| `Get-Command adb -ErrorAction SilentlyContinue` and standard `%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe` check | 1 / 0 | No adb found in either location; no device execution |
| `node scripts/check-encoding.mjs` | 0 | PASS |
| `git diff --check --` with the eight F-1 code/test paths and four documentation paths listed here | 0 | PASS; only Git CRLF-to-LF notices |
| Node stdin, `fs`/`crypto`/`assert`: verify all 16 hash-table rows and KB handoff references/open-gate statements | 0 | PASS after using a Unicode escape in the auxiliary text assertion |

Initial Home integration run: 39 pass / 3 fail because mocked ScrollView keeps
RefreshControl as a prop, not a rendered child. Test access was corrected and
the same run passed 42/42. Subsequent Mobile typechecks exposed unsupported
convenience methods in the repository's minimal renderer declarations; only
the new tests were adapted to existing helpers. No assertions were weakened.
Final complete Mobile run above uses the corrected sources.
The first auxiliary documentation check passed its 16 hash comparisons but
failed a text assertion because PowerShell stdin replaced an umlaut; repeating
it with `\u00f6` passed. No document/source content was changed to satisfy it.

The first pre-test-edit typecheck already reported these same unrelated errors,
and the final typecheck still reports only them:

- `mobile/src/shared/components/ProgressHeroCard.test.ts:456`: TS2345, unknown passed to string `includes`.
- `mobile/src/shared/components/WeightChart.test.ts:116`: TS2339, `children` absent on local ReactTestInstance declaration.

They were not changed. Full Mobile typecheck is **FAIL**, not a scoped PASS.

Coverage includes fresh/cached exact copy and 120/240 limits; missing/blank/oversized
pairs; unavailable/quota/loading/network fallback; original static greeting;
right selector/callback and 48-dp style constraints; full detail text and both
CTAs; close/backdrop/platform-back callbacks; exact date/generatedAt snapshot;
stable feedback retry ID, trimmed comment/length, pending lock, server provenance,
conflict and snapshot-unavailable errors; focus/refresh, out-of-order responses
and no detail/day-selection/missing-field request. Existing API/service tests
retain date/local-time/offset forwarding. No added legacy compatibility matrix.
Mocked tests do not prove native rendering, navigation or accessibility.

## F-1 Source And Report Binding

Raw-byte SHA-256; these hashes include pre-existing user changes in touched files,
not a claim that their entire contents were authored in F-1. No commit was made.

| Path | SHA-256 |
| --- | --- |
| `mobile/src/services/insightService.ts` | `427c7021960f756d7cb478cf04829efc7fc740669af04c0a682225893ca18b72` |
| `mobile/src/modules/home/HomeScreen.tsx` | `d87bedb97f3a5ba6aa3dff449a0f84a92d0ad938af82f58f80f29e363c04b09d` |
| `mobile/src/modules/home/CoachingHeroCard.tsx` | `fc34c10eecb738fe2367754e6162739fb00e385277c75b2e48f72b8005c128bf` |
| `mobile/src/modules/home/InsightCard.tsx` | `9373b502e10906641fcf8774e38fd7ae96e6007e7f133116ce1f9eb0797fec3c` |
| `mobile/src/modules/home/HomeScreen.insight.test.tsx` | `adf48c1f2f77f4a6f109123dd59beb6c45a6b2e9c5e0ef9e6063a5a379d0e800` |
| `mobile/src/modules/home/HomeScreen.layout.test.ts` | `f6371ff910b9bc9385440256b8a57f14ea12564dbe7ea7c1da32b00aa3a8c169` |
| `mobile/src/modules/home/CoachingHeroCard.test.tsx` | `ec0c934d7fe6f36d6c10bc5e978e50a69b1751de3263751ec67e91a19cb13a1e` |
| `mobile/src/modules/home/InsightCard.test.tsx` | `9c3ba5980cd6eccb98d2536210c186624effba94e248a1adcd4deff42f60efeb` |
| `output/f1-us03-mobile-units-2026-10-16.json` | `193948f92361e0d8b1a3da11d5fb3da29c34e42128867401a9452f0cd3c84990` |
| `output/f1-us03-shared-units-2026-10-16.json` | `85df5137842aeeab541fad5d6e88d21c29e0d88aa6e524591d793b2481d10223` |

## Required Physical-Device Evidence

No reachable device tooling was found; no device screenshots or manual checks
were performed. No Cosmos/Android emulator was installed or started, and no
remote-Cosmos workaround was attempted. Do not infer device success from units.

| Required physical Android matrix | Screenshot / result |
| --- | --- |
| 320 dp, font scale 1.0 | UNVERIFIED |
| 320 dp, font scale 1.3 | UNVERIFIED |
| 360 dp, font scale 1.0 | UNVERIFIED |
| 360 dp, font scale 1.3 | UNVERIFIED |

Each case must exercise long profile names, allowed 120/240-unit copy, the long
`Bouldern / Klettern` selector label, complete untruncated sentence and `Mehr lesen`,
with no overlap or horizontal scrolling. Also required and **UNVERIFIED**:
native close/backdrop/Android Back, CTA navigation, modal-to-feedback-sheet
transition/retry/cancel, TalkBack focus/read order/actions and safe-area behavior.
These UI requirements remain final completion blockers, unlike the separately
user-excluded emulator-persistence boundary below. A physical device is required;
this handoff does not authorize an emulator setup as a replacement task.

## Inherited B-1 Evidence And Open Defects For Q-1

Authoritative existing [B-1 handoff](B-1_US-03_Backend_Handoff_2026-10-16.md),
sections `Residual Repairs`, `Exact Remaining Boundary`, `F-1 Contract And
Exclusions`; execution order is governed by the newer approved API addendum in
the [plan](PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md).
Older handoff/API-KB statements blocking F-1 start are superseded only for
implementation/review start, never for B-1 or Story acceptance. The original
Story's historical pre-approval status likewise does not override that addendum.

Candidate: **v23 / assembly v5**, status
`THREE_CYCLES_COMPLETE_B1_NOT_ACCEPTED_V23_V5`, fingerprint
`sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`.
Pre/post source records `backend/output/b1-v23-residual-source-{pre,post}-2026-10-16.json`
both bind 291 files to aggregate
`3dfd3c13706aca3b5105a78e8b27ea6fc709cea9be4bebbc68f5a02e0c6edd3b`.
F-1 independently compared every captured source row to its current raw bytes.

Inherited results, **not self-executed Backend PASS claims**: Backend 1899 units,
Shared 466 units, Backend/Shared typechecks, `build:verify` and
`verify:daily-insight-prompt` PASS according to B-1; complete live **69 pass / 1
fail**, exit 1, 0 skipped/todo. Exact commands/windows are in B-1. No new live
reroll, Backend repair or acceptance was performed by F-1.

| Existing file under `backend/output/` | Verified raw-byte SHA-256 |
| --- | --- |
| `b1-v23-residual-final-backend-units-2026-10-16.json` | `dab3b57147b353d4113e0243b6306a89b94a4f39f8b1eb9f29e4d2181e8567f9` |
| `b1-v23-residual-final-shared-units-2026-10-16.json` | `e22804d08be4e6a3ca2efca4d591dde430e2c636fb2fc667ad3e50cec0c8a44d` |
| `b1-v23-residual-final-full-eval-2026-10-16.json` | `db6cfa40712541d81b055d43866ba546596ae41261d17431aede59b9291473c0` |
| `b1-v23-residual-evidence-2026-10-16.json` | `431e2659d6bc339c562dce19cc6d860db9043c901fbd034bbb14434c4b6380d4` |
| `daily-insight-v23-phase-progress-open-day-2026-10-16T17-03-38-873Z.json` | `86bcf893fed58c9e23c153253ce02aa929f3d5b814a4e0391b0e8df73ae16b9a` |
| `daily-insight-v23-budget-lock-2026-10-16T17-04-02-060Z.json` | `2bc17b5fc2657731addd6e683056f39658923cb6083b6bd65fbc2f9ab1922c9a` |

Open Backend-owner findings, mandatory in Q-1:

1. `budget-lock`: actual generated arithmetic falsely places 1500 kcal above 2000 kcal. Validator correctly rejects it; formal live FAIL remains. Not merely a negation false positive.
2. `phase-progress-open-day`: formal PASS but actual summary recommends `Achte darauf, deine Proteinaufnahme zu erhöhen, da du unterhalb des empfohlenen Bereichs liegst.` at remainingProteinG20. Existing validator misses `Proteinaufnahme ... erhöhen`, and the independent eval rubric misses it too; B-1 offline replay confirms ACCEPTED. Today's 1300/remaining700 also violates weight focus. This is real content failure plus validator/rubric coverage gap, not semantic acceptance. F-1 neither filters nor rewrites it.

B-1 stays **OPEN / NOT ACCEPTED**. Backend owners must repair their concrete
defects within a separately authorized follow-up; Q-1 reviews and does not
implement fixes. All required remaining final gates, including complete live
evaluation and independent acceptance, remain necessary. Mobile checks cannot
certify Backend content safety.

Separate persistence boundary: real Cosmos serialization, partition isolation,
TTL expiry and concurrency are **UNVERIFIED / explicitly excluded by the user**,
never PASS. Historical emulator setup-skipped tests are not executed evidence.
This boundary alone does not block B-1 handoff, F-1 or final completion after
Q-1; no emulator/remote persistence substitute is requested. It does not waive
the unrelated Backend defects, failing Mobile typecheck or missing device proof.
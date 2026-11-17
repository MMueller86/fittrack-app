# QA Report: Client Telemetry via Backend Relay

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md`
- Verdict: `PASS`
- Review history: initial review 2026-11-16 (`FAIL`, one Blocking finding F1); re-review after correction attempt 1 (`PASS WITH ISSUES`); targeted recheck of F7 after correction 2 on 2026-11-17 (`PASS WITH ISSUES`); verdict re-evaluation on 2026-11-17 after the Product Owner clarification (this version, `PASS`).

## Verdict Basis (2026-11-17)

Rule from the Product Owner: the verdict applies to everything implemented so far. Work not yet started is an open task, not an issue.

- Implemented and reviewed: WP-INFRA-01, WP-BE-01, WP-BE-02, WP-BE-05, WP-FE-01, WP-FE-02, WP-BE-04 and the corrections (F1, F3, F5, F7). Every acceptance criterion that applies to this work is `PASS`.
- No defect was found in the implemented work. No actionable finding is open.
- Criteria that depend on not yet started work (WP-INFRA-02, WP-BE-06) are shown as `OPEN TASK`. They are not verified and do not count against the verdict.
- Gates: not re-run. The last full gate run was on 2026-11-17 after correction 2 (all results in the test table). A check of the working tree (`git status` and file modification times) shows that no source, test or policy file changed after that run; the only later edits are this report and `docs/qa/findings.md` (Orchestrator-owned).

## Targeted Recheck After Correction 2 (FT-QA-2026-171, 2026-11-17)

Product Owner decisions of 2026-11-17 are recorded as given (see section `Product Owner decisions`). They are not open defects.

| Check | Result | Evidence |
|---|---|---|
| F7 sentence equals the main policy word for word | Resolved | The sentence "Sie können deine technische Nutzerkennung und Suchbegriffe enthalten; auf Anfrage prüfen wir die Löschung." is found by ordinal string search in `docs/legal/datenschutzerklaerung-alpha.md` (line 55), `mobile/src/modules/legal/legalTexts.ts` (line 67, directly after "(derzeit 90 Tage).") and the pinned constant in `mobile/src/modules/legal/legalTexts.test.ts` (line 19). |
| Nothing else changed in the legal texts or the guard comparison | Confirmed | Word-level `git diff` of `legalTexts.ts` and `legalTexts.test.ts`: only the `Stand` date, the Betriebsprotokolle bullet, `30` to `90` and the new sentence (all already reviewed). `withoutAccountDeletionSection` and the assertions are unchanged; only the pinned constant grew by the sentence. |
| Policy accurate for implemented behaviour (privacy skill Section 5) | Confirmed | Both policies disclose user ID and search terms in logs, 90-day retention, no individual deletion, deletion reviewed on request, device model, app timings, recipe text in failure diagnostics, collection without separate consent. This matches the implemented flow (relay adds `userId`; retention 90 days live). |
| Files edited since last review | No criterion changes | `mobile/src/services/telemetry/telemetry.ts`, `mobile/src/modules/profile/ProfileScreen.test.tsx` and the handoff files are covered by the gate rerun; suite counts are unchanged (mobile 121/1207). AC-19, AC-20 and AC-25 results stay. |
| Gates | All green | See the test table. |

Result: F7 resolved. AC-13 and AC-24 stay PASS. No actionable finding remains open.

## Re-Review After Correction Attempt 1

Targeted recheck of FT-QA-2026-165 (F1), FT-QA-2026-167 (F3) and FT-QA-2026-169 (F5), plus a full gate rerun. The findings F1 to F6 of the initial review are kept below unchanged in description; only a `Recheck` line was added.

| Finding | Recheck result | Evidence |
|---|---|---|
| F1 (FT-QA-2026-165) | Resolved | `mobile/src/modules/legal/legalTexts.ts` has `Stand: 2026-11-16` (line 15); the Betriebsprotokolle bullet is character-equal to line 30 of `docs/legal/datenschutzerklaerung-alpha.md` (compared in PowerShell, `True`); mobile-only deletion sentence says "derzeit 90 Tage" (line 67); `legalTexts.test.ts` pins `Stand: 2026-11-16` and the 90-day sentence. Mobile suite 1207 passed, 0 failed; parity gate exit 0. |
| F3 (FT-QA-2026-167) | Resolved | (a) `docs/kb/tech/08-testing.md` line 358 says 80; (b) `docs/kb/tech/03-mobile.md` line 766 says the policy update was done (Stand 2026-11-16) and the in-app copy follows; (c) `docs/kb/domain/06-recipes.md` line 144 says Application Insights retention is 90 days (workspace default 30). No stale `79` remains in `08-testing.md`. |
| F5 (FT-QA-2026-169) | Resolved | `backend/src/lib/http.ts` lines 100-102: `runWithCosmosTiming(async () => fn(request, ctx))`. The `async` wrapper turns a synchronous throw into a rejection that is awaited inside the `try`; regression test `http.test.ts` "turns a synchronous throw into the generic 500 and handler.error, with and without Cosmos requests" passes (backend 2868 tests). The call itself still sits above the `try` line, which is behaviourally equivalent because the wrapper never throws synchronously. |
| F2, F4, F6 | Open decisions, not corrected on purpose | Awaiting Product Owner decision; see Findings. Not counted as defects of this re-review. |
| F7 (new) | Open at that time; resolved in the recheck above | Embedded policy omitted the plan's log wording in "Speicherdauer und Löschen"; see Findings. |

## Scope

Reviewed: WP-INFRA-01, WP-BE-01, WP-BE-02, WP-BE-05, WP-FE-01, WP-FE-02, WP-BE-04 (handoffs under `docs/handoffs/PLAN_Client-Telemetrie-Backend-Relay/`), the implementation in the working tree, the privacy policy edit, and the data handling against Plan Section 12 (skill `privacy-impact-review`, Section 5 checklist). The pre-plan changes in `backend/src/lib/cosmos.ts` and `http.ts` (`cosmos_init_ms`) were reviewed for regressions only; none found (see finding F5 for one theoretical edge).

Not reviewed: WP-BE-03 (cancelled), WP-INFRA-02 and WP-BE-06 (post-release). Acceptance criteria that need deployed data are listed under Verification Notes.

Scope observations (not findings):
- `.github/instructions/infra-release.instructions.md` (WP-BE-02, 79 to 80 in one sentence): assessed as appropriate. The count matches the baseline in `backend/scripts/fixtures/functions-baseline.v1.json` (`expectedCount` 80) and the edit is one word. The Orchestrator should acknowledge it because the file is outside Backend ownership.
- The lockfile change for `@azure/core-rest-pipeline` 1.25.1 adds transitive packages (`@typespec/ts-http-runtime` 0.3.10, newer `http-proxy-agent` / `https-proxy-agent` / `agent-base`, `proxy-agent-negotiate`). Version is the latest stable (`npm view` returns 1.25.1) and `npm ls --all` shows one deduplicated copy. No finding.
- The working tree also holds untracked files unrelated to this plan (`docs/User Stories/Training/`, `docs/User Stories/startpage/EPIC_Training_Bouldern.md`). They were not reviewed.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/lib/http.ts` `clientRequestIdLogFields()` (UUID regex) feeds `handler.start` and the terminal events; `backend/src/lib/http.test.ts` "adds a valid x-fittrack-request-id as client_request_id to start and terminal events". |
| AC-2 | PASS | `http.test.ts` covers missing and invalid header: field omitted, response unchanged. |
| AC-3 | PASS | `backend/src/functions/clientTelemetry.test.ts` "returns 401 without a Bearer token (AC-3)"; handler calls `requireUser()` first. |
| AC-4 | PASS | Strict schemas in `backend/src/functions/clientTelemetry.ts`; 23 invalid cases, 32 KB body, `content-length` over 32 KB and invalid JSON return 400 with no event trace (`clientTelemetry.test.ts`). |
| AC-5 | PASS | Test "writes one batch trace and one trace per event with exact fields and returns 204 (AC-5, AC-30)". |
| AC-6 | PASS | Test "answers the 11th batch within a minute with a body-less 429, never as error (AC-6)" and window-reset test. Per-worker limit is approximate by design (A3). |
| AC-7 | PASS | `eventTrace()` writes only schema-validated fields; 400 body is generic and does not match the logged `api_error_code` pattern; no client message, query string or token is written. Client side: `mobile/src/shared/api/clientTelemetry.test.ts` (AC-18 test). See F4 for `stack`. |
| AC-8 | PASS | `clientEventActorFields(userId)` is the only place that adds `userId` (`clientTelemetry.ts`); test "adds userId to event traces only through clientEventActorFields (AC-8)". No email, name or token written. |
| AC-9 | PASS; post-release part OPEN TASK (WP-INFRA-02) | Route registered (`backend/src/index.ts`), baseline 80 (`backend/scripts/fixtures/functions-baseline.v1.json`, `functions-baseline.mjs`), `registrations.test.ts` passes (88 files green), `node --test scripts/functions-baseline.test.mjs` 12/12 (initial review). Re-review: `docs/kb/tech/08-testing.md` lines 105 and 358 both say 80 (F3a resolved). The deployed function count is checked in WP-INFRA-02 and is not verified here. |
| AC-10 | PASS | `backend/src/functions/foodProducts.ts` and `reusableItems.ts` are not modified (`git status`); `git diff` of test files shows no removed assertions on these events. |
| AC-11 | PASS | Retention 90 days vs 30 days in `docs/kb/tech/01-system-overview.md`, `07-infrastructure.md` (new section "Log Ingestion Cap and Retention"), `09-api-reference.md`, `02-backend.md`; relay, request ID, always-on and `[Planned]` consent in `02-backend.md`, `09-api-reference.md`, `03-mobile.md`. Re-review: the three stale statements are corrected (F3 resolved). |
| AC-12 | OPEN TASK (WP-INFRA-02) | Needs deployed data; not verified. |
| AC-13 | PASS | `git diff docs/legal/datenschutzerklaerung-alpha.md`: exactly three lines changed (`Stand:` 2026-11-16, bullet Betriebsprotokolle, log sentence in "Speicherdauer und Loeschen"); text equals Plan Section 12. Re-review: the in-app copy is mirrored (bullet equal, `Stand` 2026-11-16, 90 days). Recheck 2026-11-17: the mobile-only deletion text now ends with the same log disclosure sentence as the main policy, word for word (F7 resolved); in-app text reaches users with the next app build. |
| AC-14 | PASS | `clientTelemetry.test.ts` "first-attempt success gives exactly one event with attempts = 1 (AC-14)". |
| AC-15 | PASS | Test "a GET retried twice gives one event, attempts = 3, retryWaitMs 4500"; `durationMs` at least 4,500. `client.test.ts` unchanged and green. |
| AC-16 | PASS | Test "records tokenRefreshMs only when a refresh happened, tokenRefreshOk reflects the outcome". |
| AC-17 | PASS | `mobile/src/services/telemetry/routeTemplate.test.ts` lines 9-24 give exactly the required templates (UUID, date, query removed, barcode and unknown to `{id}`, method kept). |
| AC-18 | PASS | `clientTelemetry.test.ts` inspects serialised events for token, body, query, UUID, user data; `telemetry.test.ts` "sends the relay request ... bearer token only in the header". `client.ts` adds only the request-ID header. |
| AC-19 | PASS | `telemetry.ts`: relay through plain `fetch`, errors swallowed, no retry, flush only with a valid non-expired token; tests "does not flush when not authenticated", "a rejecting relay call is swallowed ... not retried". Existing retry, 401 and quota tests pass unchanged (121 mobile files, only F1 fails). |
| AC-20 | PASS | `telemetry.test.ts`: 200 cap, flush at 30, 60 s foreground timer, background flush (`episode.ts` `onAppStateChange`). |
| AC-21 | PASS | Read-only `az` queries on 2026-11-16: Alpha and Dev workspace `dailyQuotaGb` 0.1, workspace retention 30, Application Insights retention 90. `az bicep build infra/main.bicep` exit 0. "No Delete or Recreate" is taken from the WP-INFRA-01 handoff (what-if not re-run). |
| AC-22 | OPEN TASK (WP-INFRA-02) | Needs deployed data; not verified. The static allowlist is covered by the AC-4 and AC-30 tests. |
| AC-23 | OPEN TASK (WP-INFRA-02) | Needs one week of data; not verified. |
| AC-24 | PASS | Recheck 2026-11-17 (after F7 fix and later working-tree edits): all gates rerun green, see test table. Earlier re-review: typecheck (backend, backend tests, shared, mobile) exit 0; backend 88 files / 2868 tests, shared 10 / 466, mobile 121 / 1207 all green; `build:verify`, `smoke:bundle`, encoding check exit 0; parity gate exit 0 (shared 10/466, backend 88/2868, mobile 121/1207, all above minimums). The initial failure (F1) is resolved. No existing test was removed; the only changed assertions are strengthened (`/health` called with `{ telemetrySource: 'warmup' }`) or count 79 to 80. |
| AC-25 | PASS; post-release part OPEN TASK (WP-INFRA-02) | One screen event per tab for `data`/`empty`/`error`: `HomeScreen.insight.test.tsx`, `DiaryScreen.f2.test.tsx`, `RecipeListScreen.test.tsx`, `ProgressScreen.test.tsx`, `ProfileScreen.test.tsx`; cancelled or unfinished load records nothing (`episode.test.ts`); end point per screen listed in `05-fe-01-telemetry-module.md`. The post-release confirmation of `client.screen` traces on Alpha is not verified here. Mocks only. |
| AC-26 | PASS; query part OPEN TASK (WP-BE-06) | The documented KQL screen-window query is written and verified in WP-BE-06 (with AC-33) after release (Product Owner decision, FT-QA-2026-170). Unit-test parts pass: common origin of `startedAtMs` (`episode.test.ts`), `attemptMs`/`attemptStatus`/`retryWaitMs` 4,500, `tokenRefreshOk` false on failed refresh (`clientTelemetry.test.ts`). The screen-window KQL does not exist yet; `docs/kb/tech/02-backend.md` has only the request-ID join (F6, Product Owner decision). |
| AC-27 | PASS | `backend/src/lib/cosmosTiming.test.ts` and `http.test.ts`: 30 ms + 50 ms gives `cosmos_calls` 2, `cosmos_ms` about 80, `cosmos_max_ms` about 50, summed charge; no fields without Cosmos requests; failing request counted and the identical error rethrown. |
| AC-28 | PASS | Re-review: F5 resolved, sync-throw regression test passes (see recheck table). Initial evidence: `cosmosTiming.ts`: only `performance.now()` reads, additions and one header read; the only `await` is on the delegated call; no logging or I/O; `record()` guarded; tests for no store, throwing counter setter and malformed charge header. `cosmos.ts` passes `httpClient: new CosmosTimingHttpClient()` without a cast; no file under `backend/src/lib/repositories/` modified; dependency `^1.25.1` in `backend/package.json` and `_deploy_staging/package.json`; `npm ls @azure/core-rest-pipeline --all` shows a single deduplicated 1.25.1; `_deploy_staging/package-lock.json` resolves 1.25.1. |
| AC-29 | OPEN TASK (WP-INFRA-02) | Needs deployed data and the pre-release comparison; not verified. |
| AC-30 | PASS | Schema accepts the five kinds and writes `client.episode`, `client.milestone`, `client.api`, `client.screen`, `client.error`, `client.batch`; invalid enum, missing `episodeId`, time above 604800000 return 400 (`clientTelemetry.test.ts` invalid cases). |
| AC-31 | PASS | `episode.test.ts` "emits the six milestones once and in order, auth path %s" for all four `authPath` values; `ready` equals end of the first Home screen event; sources `warmup`, `ui`, `sync` asserted. Mocked clock and transport only. |
| AC-32 | PASS | `episode.test.ts` "starts a resume episode with backgroundMs and tab_switch screen events": `backgroundMs` 90,000, new `episodeId`, times relative to new origin, `tab_switch` trigger. Mocks only. |
| AC-33 | OPEN TASK (WP-BE-06) | Needs real Alpha data; not verified. |
| AC-34 | OPEN TASK (WP-BE-06) | Needs the wait-time report; not verified. |
| AC-35 | OPEN TASK (WP-BE-06, optional manual calibration by the user) | Needs manual calibration on a device; not verified. |
| AC-36 | OPEN TASK (WP-INFRA-02) | Needs one week of cold-start data; not verified. |

## Tests

Recheck results (2026-11-17, after correction 2) replace earlier results for the same commands; the counts are unchanged from the first re-review (shared 10/466, backend 88/2868, mobile 121/1207, 0 failed in all three JSON reports; typecheck, `build:verify`, `smoke:bundle`, parity gate and encoding check exit 0). The initial mobile run (exit 1, 1206 passed, 1 failed in `legalTexts.test.ts`) is kept in the history above.

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run` | 0 | 88 files, 2868 tests passed (initial: 2867) |
| `cd shared && npx vitest run` | 0 | 10 files, 466 tests passed |
| `cd mobile && npx vitest run` | 0 | 121 files, 1207 tests passed, 0 failed (initial: exit 1) |
| `cd backend && npx tsc --noEmit -p tsconfig.json` | 0 | no errors |
| `cd backend && npx tsc --noEmit -p tsconfig.test.json` | 0 | no errors (test typecheck) |
| `cd shared && npx tsc --noEmit` | 0 | no errors |
| `cd mobile && npx tsc --noEmit` | 0 | no errors |
| `cd backend && npm run build:verify` | 0 | all checks passed |
| `cd backend && node --test scripts/functions-baseline.test.mjs` | 0 | 12 passed |
| `cd mobile && npm run smoke:bundle` | 0 | Android bundle exported, 1 non-empty bundle file |
| `node scripts/check-test-parity.mjs --shared ... --backend ... --mobile ...` | 0 | shared PASS 10/466 (min 10/466); backend PASS 88/2868 (min 84/2709); mobile PASS 121/1207 (min 108/1002) (initial: exit 1, mobile FAIL) |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed |
| `npm ls @azure/core-rest-pipeline --all` | 0 | one deduplicated 1.25.1 |
| `npm view @azure/core-rest-pipeline dist-tags.latest` | 0 | 1.25.1 |
| `az monitor log-analytics workspace show` and `az monitor app-insights component show` (Dev, Alpha, read-only) | 0 | cap 0.1 GB/day, workspace retention 30, Application Insights retention 90 |
| `az bicep build --file infra/main.bicep` | 0 | builds (only an upgrade notice) |

The test table reflects the last full gate run (2026-11-17, after correction 2). It was not repeated for the verdict re-evaluation because the working tree did not change after it.

## Verification Notes

- State: `UNVERIFIED` (deployed behaviour: post-release parts of AC-9 and AC-25, and the open-task criteria AC-12, AC-22, AC-23, AC-29, AC-33, AC-34, AC-36)
  - Reason: need the deployed backend, a new Preview build and about one week of use. These are open tasks (see `Open tasks`), not issues.
  - Manual action: run WP-INFRA-02 and WP-BE-06 after release; compare AC-29 using `requests`, not `traces`.
- State: `MANUAL VALIDATION REQUIRED` (AC-35)
  - Reason: native start before JavaScript cannot be measured in a unit test.
  - Prerequisite: Preview build on a real Android device. Steps: at least 5 cold starts with `adb shell am start -W` (`TotalTime`) or a stopwatch from tap to first visible screen; compare with `jsEntryPerfMs`. Expected: `jsEntryPerfMs` within 20 % of the manual value, otherwise report the manual constant. Result: ______
- State: `UNVERIFIED` (items verified on mocks only)
  - Reason: AC-15, AC-16, AC-25, AC-31, AC-32 run against a mocked transport and clock; real `performance.now()` meaning (A5), tab-press-to-mount gap on slow devices (10 s window), and real Hermes stack formats for `client.error` were not observed on a device.
  - Manual action: on the Preview build use Home, Nutrition, Recipes, Progress and Profile after a cold start and a resume; after release confirm `client.screen` traces for all five screens.
- State: `UNVERIFIED` (what-if)
  - Reason: "no Delete or Recreate" in AC-21 is taken from the WP-INFRA-01 handoff. The change was a scoped deployment of `infra/modules/appinsights.bicep`; the full Dev what-if showed unrelated additive drift (for example the `product-images` container) that stays undeployed.
  - Manual action: the Orchestrator or user decides on a full `main.bicep` reconciliation.
- Cosmos contract tests: CI-only, not run locally (`backend/src/lib/cosmosTiming.contract.test.ts` exists and guards that the SDK honours `httpClient`).

Privacy review (skill Section 5):
- Declared data flow matches the implementation: the client sends no user ID; the relay adds `userId` through `clientEventActorFields()`; no tokens, query strings, resource IDs, bodies or client messages are written. Device model is pattern-restricted. Retention 90 days is live.
- Policy `docs/legal/datenschutzerklaerung-alpha.md` contains the approved wording and discloses user ID, search terms (three events log them: `food-products.search`, `reusableItems.search`, `food.search`), recipe text in failure diagnostics, device model, app start timings and collection without separate consent. The Product Owner decides at review whether the sentence about collecting without separate consent stays (plan Section 12).
- Re-review: the in-app copy is updated; its Betriebsprotokolle bullet equals the main policy and discloses user ID, search terms, device model, app timings, recipe text in failure diagnostics and collection without consent. Its "Speicherdauer und Loeschen" sentence (90 days, logs not individually deleted) is true but omits the sentence that logs can contain the technical user ID and search terms and that deletion is reviewed on request (F7, Non-blocking). The earlier false 30-day statement (F1) is gone.
- `client.error.stack` assessment: the app reduces it to `at <function> (<file>:<line>:<col>)` lines of at most 1000 characters and never sends the message (`mobile/src/services/telemetry/errorTelemetry.ts`, `errorTelemetry.test.ts`). That is code locations, not user content. The relay accepts any string up to 1000 characters, so the guarantee rests on the client only, and the policy text says only "technische Fehlernamen" (F4, Suggestion).
- Open legal questions OQ1 (legal basis for collecting without consent, erasure obligation for logs holding the user ID) and OQ2 (purge tooling) remain with the Product Owner; they are not findings of this review.

## Open tasks

Not started; not issues and not counted in the verdict.

| Work package | Trigger | Covers |
|---|---|---|
| WP-INFRA-02 (post-release verification) | The user's `Deploy to Alpha` and `New Alpha Build` commands, then about one week of normal use | AC-12, AC-22, AC-23, AC-29, AC-36; post-release parts of AC-9 and AC-25 |
| WP-BE-06 (wait-time analysis and report) | After WP-INFRA-02 delivered enough data | AC-33, AC-34, AC-35; the screen-window query of AC-26 |
| Native-start calibration (optional) | The user, on a real Android device with the Preview build | AC-35 (see `MANUAL VALIDATION REQUIRED` in Verification Notes) |

## Product Owner decisions

Recorded as given on 2026-11-17; not open issues.

| Finding | Key | Decision | Note |
|---|---|---|---|
| F2 | FT-QA-2026-166 | Accepted | Plan gap for mirroring the policy into `legalTexts.ts`; F1 was fixed. |
| F4 | FT-QA-2026-168 | Deferred | Server-side restriction of `client.error.stack` and policy wording. |
| F6 (AC-26 query) | FT-QA-2026-170 | Accepted | Covered by the open task WP-BE-06. |

## Findings

Status after the 2026-11-17 re-evaluation: no actionable finding is open. F1, F3, F5 and F7 are resolved. F2, F4 and F6 are kept below as history with the Product Owner decisions above. No defect was found in the implemented work. Cosmos contract tests: CI-only, not run locally.

Finding key: F1
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (WP-BE-04, Section 12)
Acceptance criterion: AC-24 (also AC-13)
Description: WP-BE-04 changed `docs/legal/datenschutzerklaerung-alpha.md` but not the copy embedded in the app (`mobile/src/modules/legal/legalTexts.ts`). The mobile test `legalTexts.test.ts` compares both and now fails; the parity gate fails for mobile. Users of the app would read the old policy: "Application Insights, 30 Tage", no mention of user ID, search terms, device model or app timing data, and the mobile-specific account-deletion text says "derzeit 30 Tage". A policy statement that is false for the implemented behaviour is Blocking per the privacy skill.
Criticality: Blocking
Recheck: Resolved in re-review (mobile suite and parity gate green, text mirrored; see re-review table).
Owner: Frontend
Evidence (initial review): `cd mobile && npx vitest run` exit 1, 1 failed (`src/modules/legal/legalTexts.test.ts`); `node scripts/check-test-parity.mjs ...` exit 1 ("FAIL mobile ... 1 failed tests"); `mobile/src/modules/legal/legalTexts.ts` lines 15 (`Stand: 2026-10-23`) and 42 (`Betriebsprotokolle ... 30 Tage`); `mobile/src/modules/legal/legalTexts.test.ts` lines 20 and 49-51 pin the old `Stand` and the "30 Tage" deletion sentence. The Frontend handoff (1207 tests green) predates the policy edit.
Recommendation: Mirror the approved bullet and `Stand:` date into `legalTexts.ts`; update the mobile-only account-deletion sentence and the pinned constants in `legalTexts.test.ts` to 90 days after the Product Owner approves that mobile wording; rerun the mobile suite and the parity gate. Note that the in-app text is only updated in a new app build.

Finding key: F2
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (WP-BE-04 dependency on the mobile copy)
Acceptance criterion: AC-13
Description: The plan for WP-BE-04 did not list the in-app copy of the policy (`mobile/src/modules/legal/legalTexts.ts`) as a file to update. The work package ran as specified, but the guard test breaks. This is a plan gap that explains F1 and is listed so that the Orchestrator can decide who owns the mirror in future policy edits. Accepted by the Product Owner on 2026-11-17 (FT-QA-2026-166); not an open defect.
Criticality: Non-blocking
Recheck: Accepted by the Product Owner (FT-QA-2026-166). Not a defect.
Owner: Planner
Evidence: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` WP-BE-04 Required Repository Context; `mobile/src/modules/legal/legalTexts.test.ts` line 15-18.
Recommendation: Note in the policy-edit procedure that `legalTexts.ts` and its test must be updated in the same change.

Finding key: F3
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (Section 19, AC-9, AC-11)
Acceptance criterion: AC-9, AC-11
Description: Stale Knowledge Base statements remain: (a) `docs/kb/tech/08-testing.md` line 358 still says "all 79 registered function names" while line 105 and the baseline say 80; (b) `docs/kb/tech/03-mobile.md` line 766 says the privacy-policy update is `[Planned]`, but the policy was updated by WP-BE-04; (c) `docs/kb/domain/06-recipes.md` line 144 says "Log Analytics retention is 30 days" without the 90 days of Application Insights data.
Criticality: Non-blocking
Recheck: Resolved in re-review for (a), (b) and (c).
Owner: Documentation
Evidence: `grep` of `docs/kb` for `79` and `30 days`; `docs/legal/datenschutzerklaerung-alpha.md` `Stand: 2026-11-16`.
Recommendation: Change 79 to 80 in `08-testing.md` line 358; update line 766 of `03-mobile.md` to say the policy was updated (Stand 2026-11-16) and that the in-app copy follows (F1); align `06-recipes.md` with the 90-day statement (that last file is outside the plan scope, so only if the Orchestrator agrees).

Finding key: F4
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (Section 12, AC-7)
Acceptance criterion: AC-7
Description: The app reduces `client.error.stack` to code locations, but the relay accepts any string up to 1000 characters, and the policy names only "technische Fehlernamen". A modified or future client could send arbitrary text into logs that hold the user ID. Deferred by the Product Owner on 2026-11-17 (FT-QA-2026-168); not an open defect.
Criticality: Suggestion
Recheck: Deferred by the Product Owner (FT-QA-2026-168). Not a defect.
Owner: Backend
Evidence: `backend/src/functions/clientTelemetry.ts` `ErrorEventSchema` (`stack: z.string().max(1000)`); `mobile/src/services/telemetry/errorTelemetry.ts` `sanitizeStack()`.
Recommendation: Optionally restrict `stack` server-side to `at <fn> (<file>:<line>[:<col>])` lines, and let the Product Owner decide whether the policy should say "Fehlernamen und Codepositionen".

Finding key: F5
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (WP-BE-05)
Acceptance criterion: AC-28
Description: In `withHandler()` the call `runWithCosmosTiming(() => fn(request, ctx))` sits before the `try` block. A handler that throws synchronously (not an `async` function) would escape `withHandler` instead of becoming a 500; before the change `await fn(...)` inside the `try` caught it. All current handlers are `async`, so no present failure.
Criticality: Suggestion
Recheck: Resolved in re-review (`async` wrapper plus regression test).
Owner: Backend
Evidence: `backend/src/lib/http.ts` lines 100-102 (`const timing = runWithCosmosTiming(...)` before `try`).
Recommendation: Optionally move the call inside the `try`, or declare the counters before the `try` and start the store inside it.

Finding key: F6
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (Section 20, AC-26; Section 13, WP-BE-06)
Acceptance criterion: AC-26
Description: AC-26 requires a documented KQL query that returns, for one `client.screen` event, the `client.api` events of the same episode inside the screen window with the per-call shares. No such query is documented. No work package before release owns it (WP-BE-02 covers only the request-ID join; WP-BE-06 lists AC-33 to AC-35).
Criticality: Non-blocking
Recheck: Accepted by the Product Owner on 2026-11-17 (FT-QA-2026-170); the query is written and verified in WP-BE-06 (AC-33) after release. AC-26 query part is the open task WP-BE-06. Not an open defect.
Owner: Backend
Evidence: `docs/kb/tech/02-backend.md` "Client telemetry relay" contains only the join of `client.api` and server `handler.*`; `docs/handoffs/PLAN_Client-Telemetrie-Backend-Relay/03-be-02-relay-endpoint.md` (join query not part of the package).
Recommendation: Assign the screen-window query to WP-BE-06 (or to a Backend task before release), document it in `02-backend.md`, and run it read-only after deployment; the Orchestrator decides the assignment.

Finding key: F7
Plan reference: `docs/User Stories/plans/PLAN_Client-Telemetrie-Backend-Relay.md` (Section 12)
Acceptance criterion: AC-13
Description: The embedded policy (`mobile/src/modules/legal/legalTexts.ts` line 67, mobile-only account-deletion wording) says logs are kept "gemäß der konfigurierten Aufbewahrungszeit (derzeit 90 Tage)". It does not state, as Section 12 and `docs/legal/datenschutzerklaerung-alpha.md` do, that logs can contain the technical user ID and search terms and that deletion is reviewed on request. The statement is true (90 days is live), and the user ID and search terms are disclosed in the Betriebsprotokolle bullet of the same document, so nothing false is shown. What is missing is the erasure-on-request sentence in the deletion section; the guard test excludes that section from the comparison, so it will not detect the drift.
Criticality: Non-blocking
Recheck: Resolved on 2026-11-17 (FT-QA-2026-171): the sentence is in `legalTexts.ts` line 67 and the pinned test constant, equal word for word to `docs/legal/datenschutzerklaerung-alpha.md` line 55; mobile suite and parity gate green.
Owner: Frontend
Evidence (initial): `docs/legal/datenschutzerklaerung-alpha.md` line 55 versus `mobile/src/modules/legal/legalTexts.ts` line 67; `mobile/src/modules/legal/legalTexts.test.ts` lines 12-16 (section excluded) and 19 (pinned wording).
Recommendation: Product Owner decides whether the mobile deletion sentence should carry the same sentence ("Sie koennen deine technische Nutzerkennung und Suchbegriffe enthalten; auf Anfrage pruefen wir die Loeschung."); if yes, update `legalTexts.ts` and the pinned constant in the test. Not fixed in this review.

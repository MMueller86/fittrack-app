# Q21 Corrections: Round 2 Final Implementation Handoff

Date: 2026-10-10. Status: LOCAL OFFLINE GATES PASS; INDEPENDENT QA REQUIRED; NO DEPLOY.
This is the second and LAST automatic implementation correction, not QA itself.
`retry_counts`: Preparation=2, Daily=2. Unresolved subsequent QA means STOP,
not a third candidate. Only the Orchestrator may update the register.

Final versions: Preparation **v11**, Import **v16**, Daily **v17**, Daily
assembly **v2**. Text-only correction has no separate version constant.
Daily v17 fingerprint:
`sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386`.

Candidate hashes: [candidate](Q21-CORR2-2026-10-10-candidate.json).
Executed native arguments, UTC intervals, exits/counts and generated transcripts
are retained in the new `Q21-CORR2-2026-10-10-*` records alongside this handoff.
The [evidence index](Q21-CORR2-2026-10-10-evidence.json) inventories their hashes.
No old QA report, CORR1 F/R/G/reconciliation, handoff, manifest, plan, story or
register is edited. CORR1 FAIL remains authoritative historical evidence.

## Per-Finding Corrections

### FT086: Oven Endpoint

Observed CORR1 R/G outputs kept 180 C / 40 minutes but omitted source6 doneness.
Local instruction defect: v10 asked to preserve endpoints without allocating
them priority over optional preheating/resting/serving when compressing.
This is an instruction-level diagnosis, not proven stochastic model causality.
V11 prioritizes essential cooking and endpoint, keeps time/temperature/endpoint
with the cooking action, and makes full-draft preservation subordinate to source
truth. Text-only shortening removes optional phrasing before essential cooking.

Files: [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts),
[recipePreparation.test.ts](../../../backend/src/lib/recipePreparation.test.ts).
New prompt-priority regressions and existing mocked oven correction/real-font
loop tests pass. The fixture remains `manualExportReview: true`; no automated
human approval or new oven fidelity assertion is claimed. Final provider
endpoint retention is UNVERIFIED; human review NOT PERFORMED / MANUAL VALIDATION REQUIRED.

### FT087: Aggregate-Time Provenance

CORR1 repeatedly returned rice35/oven40/pasta25 despite independently reviewed
null provenance. The actual small Preparation prompt receives the full saved
source, not the Import prompt. Its leading "reliably derivable" instruction
invited estimation before the later exclusions; corrections also prioritized
retaining latestDraft. No input truncation or Import-rule coupling was found.

V11 replaces this with a source-first decision before compression: explicit
aggregate, otherwise every necessary action timed and explicitly sequential,
otherwise null. Omitting untimed work from the export cannot authorize a total.
Explicit50 and complete5+10=15 examples remain valid; isolated baking40 and
untimed sauce15/pasta10 do not justify totals. No blanket null erasure, default,
runtime provenance parser, schema change or assertion relaxation is added.

Files: recipeAnalyze.ts, recipePreparation.test.ts,
[recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts),
[recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts).
Existing independent negative35/40/25 and positive50/15 rubric tests pass;
unchanged natural eval fixtures still require null. Positives are offline
rubric checks, not newly generated live positive-total outputs.

### FT090: Essential Rice Cooking And Order

CORR1 F retained oil/rest while losing the entire source5 rice cooking action;
G retained it after source6 and was correctly rejected. V10 omission guidance
did not explicitly prioritize separate essential cooking over optional details.
V11 plans essential main/side/sauce cooking first, reserves space for it and
endpoints, and checks group FIRST references before output. Full-draft correction
cannot preserve a missing core merely because latestDraft fit previously.

Files: recipeAnalyze.ts, recipePreparation.test.ts, recipeAnalyzeValidation.test.ts.
The new offline counterexample uses CORR1's lost-action/reference pattern with
null metadata so the core failure is reached independently of time. It proves
structural success is not fidelity; complete rice cooking passes, reversed
group starts fail. Existing `[1,4,6],[5]` positive/free-group coverage remains.
The fixture/source/rubric and reference validator are unchanged. No first-five,
exact-five, adjacent-only or handcoded production recipe is introduced.
Actual final rice live success remains UNVERIFIED, not FT071 closure.

### FT088 / FT091: Separate Daily Overall / Unknown Activity

Actual fixture: activity_focus, currentHourLocal=null, completion=unknown,
remainingCalories=500, remainingProteinG=40. It receives neither the
nutrition_guidance material-gap guard nor the protein<=20 open-day guard.
The existing activity module prohibits intake/rest-budget comparisons, but
shared tone permits describing open room, and no final activity-specific guard
resolves that priority after the output contract. These are verified local
composition facts; the missing raw CORR1 output prevents attribution to an
exact phrase or proof that this gap caused its rejection.

Daily v17 resolves shared-tone permission for activity_focus and appends that
intent's existing open-day rule independently of protein gap/local hour. It
preserves neutral unknown completion, conditional fueling/liquids/recovery,
stale-weight guards and all strict validator/provider/runtime rules.

Files: [sharedTone.ts](../../../backend/src/lib/prompts/sharedTone.ts),
[dailyInsightPrompt.ts](../../../backend/src/lib/prompts/dailyInsightPrompt.ts),
its composition tests, append-only manifest/tests, Daily eval version guard,
[dailyInsightValidation.test.ts](../../../backend/src/lib/dailyInsightValidation.test.ts),
[insightRepository.ts](../../../backend/src/lib/repositories/insightRepository.ts).
The only repository edit adds v17 to the existing explicit v15/v16 temporary
v14 preservation allowlist, deliberately keeping complete unexpired same-date
v14 entries unchanged until expiry; no cache redesign or migration occurs.
Handler/repository tests prove this boundary. Historical manifest v14/v15/v16
entries remain exact. Exact unknown-activity snapshot, four strict forbidden-
phrase negatives, safe conditional response and stale-weight regressions pass.
Production Weekly has no sharedTone consumer and is unchanged.
Overall blocker remains open pending independent G; no raw-response replay occurs.

### FT089: Current KB Alignment Only

Already independently closed by CORR1; no register decision is made here.
Six directly affected current KB documents now describe Preparation v11 and
Daily v17, unchanged Import v16, explicit partial/unaccepted status and open
manual/live boundaries. Dated historical v4/v6/v7/v8/v9 evidence is not relabelled.
[KB snapshots](Q21-CORR2-2026-10-10-kb-before.json) retain complete pre-edit text;
[focused doc check](Q21-CORR2-2026-10-10-docs.json) checks six files and four
selected dated heading blocks, not universal paragraph attribution.

## Genuine Executed Verification

Counts below are passed / failed / skipped. Exits refer to native child commands,
not a wrapper's final exit. All failed attempts and outputs are retained.

| New record / command family | Exit | Counts |
| --- | ---: | --- |
| preparation-red: Vitest owning loop, CORR2 filter | 1 | 0 / 3 / 54 |
| preparation-green: loop + source validator | 1 | 232 / 1 / 0; accidental initial latestDraft reference |
| preparation-green2: same check after local repair | 0 | 233 / 0 / 0 |
| daily-red: composition + strict validator, CORR2 filter | 1 | 5 / 1 / 70 |
| daily-green: composition/validator/handler/repository | 0 | 188 / 0 / 0 |
| manifest: appended release lock | 0 | 4 / 0 / 0 |
| rice: isolated omission/order regression | 0 | 1 / 0 / 176 |
| focus: final14 files | 1 | 786 / 2 / 0; stale v10 test literals |
| focus2: identical14 files after literal repairs | 0 | 788 / 0 / 0 |
| `npm run test --workspace=backend` plus recorded reporters | 0 | 1639 / 0 / 0; 67 files |
| `npm run typecheck --workspace=backend` | 0 | non-test |
| `npm run build:verify --workspace=backend` | 0 | non-test; no publish |
| `npm run verify:daily-insight-prompt --workspace=backend` | 0 | 7 script + 4 manifest tests passed |
| Vitest eval-config version-guard-only filter | 0 | 3 / 0 / 29; zero live cases |
| `node scripts/check-encoding.mjs`; scoped `git diff --check` | 0 each | non-test |

The real SDK test files are openai.recipeAnalyze.test.ts and openai.daily.test.ts,
both included in focus2; the nonexistent CORR1 openai.test.ts path was not reused.
Existing handlers retain all privacy/schema/quota/call-count assertions; only two
literal Preparation-version expectations change to v11. One terminal returned
only Ctrl+C for consistency checks; completed durable child records were found
and read instead of rerunning or inventing success.

## Preservation, Security And Limits

[Preservation](Q21-CORR2-2026-10-10-preservation.json): 1054 foreign files,
including382 QA/Story/Evidence files, unchanged; 20 existing candidate files
stable through final gates. Baseline was captured after the first owned
regression-test edit, before every production edit, not before that test edit.
No universal earlier-session attribution is claimed. Ignored build outputs are
normal gate artifacts, not deployments. New evidence/this handoff are separate.

Provider, Preparation loop, both production validators, handlers, API, schema,
renderer/fonts, auth/owner/optionalETag, quota, temperature0.2/2048/maxRetries0,
three-call/deadline limits, V2 stripped refs, saved ID-free/untrusted source,
noWrites and usage only after final valid-fit success are unchanged. Importv16
remains complete source/export in one call; no Import prompt-body edit was made.
Shared, Mobile, infrastructure, dependencies and production Weekly are untouched.
No subdelegation, deploy, branch or commit. UTF-8/configured-secret scan and
final artifact hashes are recorded in the new finish/evidence records; the
scan covers candidate files plus Round2 artifacts, not a universal secret audit.

F/R/G: NOT RUN by this implementation attempt; zero live provider calls.
Independent QA must execute each required gate exactly once on final bytes.
AI-skill live acceptance remains required, not waived by offline success.
Missing Daily raw output limits causal diagnosis, not the retained strict rule.
Human oven review, private/Alpha replay, device Save/Share and Cosmos integration
remain unperformed/unverified. No finding closure, QA-PASS or release claim.
After unresolved Round2 QA, stop and return the concrete blockers to Orchestrator.
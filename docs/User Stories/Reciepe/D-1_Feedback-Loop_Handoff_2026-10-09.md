# D-1 Preparation Feedback Loop: Documentation Handoff

Scope: ONLY approved D-1 task package; user approval 2026-10-09; Backend agent.
Documentation completion only. Feature status: [Partial], implemented NOT ACCEPTED,
`IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED`. B-1 implemented with
passing recorded evidence; B-2 r2 implementation and complete handoff evidence
satisfy D-1's dependency only. Required F failed; R/G NOT_RUN. No feature PASS,
final QA, acceptance, merge or release approval is claimed or implied.

No code, tests, prompts, instructions, plan status, handoff requirements, old
stories, QA reports, release records or historical evidence were changed.
No gate, live/provider call, deployment, delegation, commit or full-plan read.
Only the D-1 section of the approved plan was read; the task package controls
scope. Required skills: none. No new domain assumption or architecture decision.

## Exact Document Edits

| Edited document | D-1-owned change |
| --- | --- |
| [docs/kb/domain/06-recipes.md](../../kb/domain/06-recipes.md) | Current transient Preparation is v5 initial plus two corrections; full validation/probe and geometry-only scope; existing limits/V2/transience retained; current r2 partial/F-failed evidence before historical B-19. |
| [docs/kb/domain/07-ai-features.md](../../kb/domain/07-ai-features.md) | V5 Preparation versus separate unchanged v16 Import; whole-draft corrections, geometry versus semantic/user review, deadline/once-only usage and narrow exhaustion-text exception; r2 partial evidence. |
| [docs/kb/tech/02-backend.md](../../kb/tech/02-backend.md) | Owning loop/provider/probe integration; immutable source/latest whole draft, measurement technical precedence, monotonic deadline/cancellation/booking, generic error contracts and exact latest affected known-text logging; current r2 evidence, unchanged confirmation/ETag. |
| [docs/kb/tech/06-ai-integrations.md](../../kb/tech/06-ai-integrations.md#preparation-feedback-loop-current-r2) | Current v5 contract and dedicated r2 subsection: correction JSON, geometry scope, deadlines/options, HTTP/log privacy, fixture failures, hash/execution boundaries; old evidence remains historical. |
| [docs/kb/tech/09-api-reference.md](../../kb/tech/09-api-reference.md#post-apirecipesidexport-viewprepare) | Internal loop does not change public V2/ETag; full probe, deadline/usage boundaries, existing 422 exhaustion plus terminal generic 502/500; partial r2 status. |
| [docs/kb/tech/08-testing.md](../../kb/tech/08-testing.md#recipe-preparation-feedback-loop-evidence) | Owning offline coverage versus live semantic assertions; recorded commands/counts, F failure and R/G non-execution, freeze boundaries and documentation-only verification. |
| [SPEC_Recipe-Export_Template-Textvertrag_2026-10-09.md](SPEC_Recipe-Export_Template-Textvertrag_2026-10-09.md) | Short superseded-by-approved-plan pointer only; historical body unchanged. Single call, omission strategy, universal budgets and three-line proposal are not the current product contract. |

Machine-generated baseline, owned patch and this new handoff/manifest are D-1
reporting artifacts, not production candidate changes. The
[manifest](D-1_Feedback-Loop_Manifest_2026-10-09.json) inventories exact files,
before/after hashes, own hunk headers and executed validation commands/results.
The [baseline](D-1_Feedback-Loop_Baseline_2026-10-09.json) retains starting status,
seven original document byte snapshots and hashes of 929 existing regular files.
The [owned patch](D-1_Feedback-Loop_Owned-Diff_2026-10-09.patch) is against those
STARTING WORKTREE bytes, not HEAD; no inherited dirty hunk is claimed as D-1 work.
Generated JSON evidence is inventoried by hash, not embedded in the prose patch.

## Implemented Boundaries

AC-1: Fixed production template/fonts/layout, existing 1..5 steps, step90,
teaser96, nullable time10080 and reference rules remain. No ingredient-omission
strategy, universal 23-character/11-character-word cap, three-line product rule,
truncation or new font/layout fallback. Existing teaser 22/21/20/19/18 selection
is retained. Complete measurable teaser/steps are reprobed after every draft,
including changed counts; technical geometry failures are not corrections.
Only generated-text fit in saved-title context is established, not full-image
or Share success, semantic preservation or ingredient fidelity.

AC-6/7/8/9: Initial plus at most two corrections; immutable original ID-free
context, exact latest whole draft/current errors; whole-output revalidation.
Monotonic 75000 ms generation/validation/probe deadline, at most 20000 ms per
provider call, SDK maxRetries0, AbortSignal, bounded awaits/timer cleanup and
discarded late results. Timeout/provider failures terminate as generic 502;
technical probe/lookup/quota-backend/booking failures generic 500; three completed
invalid parsed drafts exhaust into the existing 422 validation envelope.
No private Error.message/raw text/bounds HTTP echo. Quota enforced once;
usage booked once only after full valid success and final deadline check.
Booking is awaited, never raced/retried; timeout cannot start late booking.
No autosave or recipe/export/image/diary writes. V2, optional client ETag,
sourceEtag, confirmation and internal compare-and-replace stay unchanged.

AC-10: Only `recipes.prepareExportView.correctionsExhausted` after two completed
corrections logs exact latest affected known step/teaser/difficulty text and
safe structured diagnostics/bounds. JSON escaping preserves exact text;
summary and per-field diagnoses are bounded to eight with truncation flags.
Exact text is not truncated; no arbitrary provider-size bound is claimed.
No source/context, old/unaffected text, arbitrary objects/provider payloads,
images/base64 or secrets; no broader success, terminal-failure, other-flow or
HTTP logging exception. Existing targeted Share overflow logging is unchanged.

AC-11/12: Preparation v5 remains separate from unchanged Import v16. Geometry,
structure/references, independent fixture semantics and explicit user review
are distinct. Documentation correctness cannot convert F failure into feature
acceptance, close Q-19, waive R/G or authorize release.

## Recorded Evidence, Not D-1 Gate Runs

Exact original executable/argument arrays, output/report hashes and timestamps
are retained in the immutable r2 records and repeated as references in the D-1
manifest. Command families below omit only machine-specific paths/reporters.

| Recorded check | Command family | Exit | Executed / Passed / Failed / Skipped |
| --- | --- | --- | --- |
| Focused | `npm exec --workspace=backend -- vitest run` on validator, recipes, ai, SDK, renderer and loop test files | 0 | 495 / 495 / 0 / 0 |
| Units | `npm run test --workspace=backend -- --reporter=default --reporter=json --outputFile=<recorded report>` | 0 | 1576 / 1576 / 0 / 0 |
| Typecheck | `npm run typecheck --workspace=backend` | 0 | non-test |
| Build | `npm run build:verify --workspace=backend` | 0 | non-test |
| F | `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` plus recorded reporters | 1 | 5 / 2 / 3 / 9 |
| R/G | NOT_RUN after required F failure; no command dispatched | null | 0 executed, 0 provider calls |

F: one version guard plus four fixtures; 8 logical calls including one forced
initial draft, 7 SDK calls. Rice fits and passes only that fixture's fidelity.
Oven repeats step[1] 300x112 versus 302x105 through all three drafts, final
422/usage0; later success/independent semantic assertions NOT REACHED. Pasta
fits, returns 200/usage1, but fails source-5 contradiction. Forced dough fits
after one real correction (2 logical/1 SDK), returns 200/usage1, but fails
source-1 ingredient-explicit fidelity. Fit and 200 are not semantic PASS.
Recorded sources unchanged, write counts zero. No rerun or rubric repair.

[B-2 final r2 candidate](B-2_Feedback-Loop_Candidate_2026-10-09-r2.json) SHA-256:
`80aac40c4d980e1b6af8ed76bc7fbe36bac16dee87e14db7977ef4c681de7171`.
Its 846 frozen files are historical release-candidate identity, not a claim
that D-1's later KB/SPEC bytes belong to that snapshot. Offline records predate
final freeze and have candidateSha256 null: no offline hash-guard execution is
claimed. The [completion manifest](B-2_Feedback-Loop_Recovery-Manifest_2026-10-09-r2-completion.json)
and all 83 entries in the [artifact manifest](B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r2-completion.json)
remain immutable. The D-1 manifest distinguishes authorized post-freeze document
deltas from unmodified owning code/test/prompt/assets/dependency bytes.

## Preservation And Documentation Verification

All 922 baseline files outside the seven edited documents retain exact hashes,
including old handoffs/plans/stories/evidence, Q-19/report/findings, release
record, instructions and all implementation/test/prompt files. Original owned
document bytes remain in the baseline; SPEC differs only by its pointer. No
historical evidence status or requirement is rewritten. Baseline excludes
private settings/env and ignored output/dependencies: no universal filesystem
or secret-absence claim. Focused secret-pattern review covers only new prose.

D-1 verification is documentation-only: focused assertions of current versions,
counts/status/timeout/error/logging boundaries; changed-link/anchor integrity;
strict UTF-8/mojibake checks on owned docs; editor errors; owned patch whitespace
and read-only reverse applicability; preservation and immutable artifact hashes.
Results and exact command are in the manifest, not substituted for feature
gates. The repository encoding script scans code, not docs, so it was inspected
but not used as document evidence. `rg` was unavailable; that read-only search
failure was followed by workspace search, not by an implementation gate.

The old [Q-19 FAIL](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md),
accepted-rice fidelity loss, historical missing rice/oven success, foreign
Import/Daily failures, old all-skipped UNVERIFIED and private/Alpha replay
limits remain unresolved. The [14:12 release record](../../../infra/release-records/Recipe-Step-Overflow-Logging_Alpha-Functions_2026-10-09.md)
deployed only targeted overflow logging; the feedback loop is NOT deployed to
Alpha. The original [requirements handoff](HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md)
and [B-1](B-1_Feedback-Loop_Handoff_2026-10-09.md)/[B-2](B-2_Feedback-Loop_Handoff_2026-10-09.md)
handoffs are preserved as evidence of their own chronology. Stale current KB
v4/single-call/no-text-exception statements were corrected locally, not silently
treated as implementation truth. No scope deviation or new product rule.

Next owner: Orchestrator/QA receives this durable documentation handoff.
Required F failures need scoped disposition/authorization; R/G, independent QA
and release requirements remain unwaived. D-1 does not execute or delegate them.
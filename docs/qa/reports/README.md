# QA Reports

QA reports are durable workspace artifacts. They are the only source for a
completed QA review; terminal output and temporary Copilot session files are
diagnostic material only and must never be used as plan or handoff sources.

## Location and Naming

Reports live directly in this directory:

```text
docs/qa/reports/<plan-file-stem>.md
```

For a review without a Planner plan, the Orchestrator supplies a stable task
slug under the same directory. The Orchestrator supplies the exact expected
path to QA; QA must use that path and must not invent an external path.

The current report for a plan may be replaced by a later correction review.
The durable history of actionable findings and user decisions belongs in
[`../findings.md`](../findings.md), which the Orchestrator owns.

## Required Format: `fittrack-qa-v1`

```markdown
# QA Report: <title>

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/<plan>.md` or `N/A`
- Verdict: `PASS` | `PASS WITH ISSUES` | `FAIL`

## Scope

<Reviewed scope and out-of-scope areas>

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | <workspace-relative files, tests, or steps> |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `<command>` | 0 | <summary> |

## Verification Notes

- State: `UNVERIFIED` or `MANUAL VALIDATION REQUIRED`
- Reason: <environment limitation>
- Manual action: <prerequisite and expected result>

## Findings

No actionable findings.
```

For each actionable finding, replace the final section with one block per
finding containing all of these fields:

```text
Finding key:
Plan reference:
Acceptance criterion:
Description:
Criticality: Blocking | Non-blocking | Suggestion
Owner: Backend | Frontend | Infrastructure | Documentation | Planner | QA
Evidence:
Recommendation:
```

Every Acceptance Criterion must appear exactly once in the criteria matrix.
Environment-limited checks belong in `Verification Notes`, not in the
findings list. Evidence must use workspace-relative paths and concise command
summaries. Never put secrets or references to `%TEMP%`, `AppData`,
`chat-session-resources`, `copilot-terminal-output`, or other external paths
in the report.
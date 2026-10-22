---
name: privacy-impact-review
description: 'Privacy impact review for FitTrack. Use when: a change collects, derives, stores, retains, deletes, logs, exports, shares, or sends user data to a third party or AI service (Azure OpenAI, Document Intelligence, Health Connect, Application Insights, community publishing); adds or changes a permission, device integration, or analytics/diagnostic data; changes data visibility; or when the privacy policy (docs/legal/datenschutzerklaerung-alpha.md) may no longer match actual behaviour. Primary consumers: Planner (impact assessment and proposed policy text), Backend and Frontend (report actual data handling), QA (consistency review). Not required for changes that touch no user data. This skill supports review; it is not legal advice.'
---

# Privacy Impact Review

Keeps the published privacy policy ([docs/legal/datenschutzerklaerung-alpha.md](../../../docs/legal/datenschutzerklaerung-alpha.md)) consistent with what FitTrack actually does with user data. It does not replace legal review.

---

## 1. Consumers and When to Load

| Role | Load this skill when |
|---|---|
| **Planner** | The requirement touches any trigger in Section 2. Produces the **Privacy Impact** section and proposed policy text. |
| **Backend** | Implementing a task whose plan declares this skill. Reports the actual data handling in the handoff. |
| **Frontend** | Same as Backend for permissions, on-device storage, and data shown to other users. |
| **QA** | Reviewing a change with a Privacy Impact section. Section 5 is the review checklist. |

---

## 2. Triggers

Any one of these requires a review:

- New or changed **data category** collected, derived, or stored (field, document type, container, blob, on-device storage).
- New or changed **recipient**: AI/OCR request content, new Azure service, third-party API, Health Connect, community/shared visibility.
- New or changed **purpose** for existing data.
- New or changed **retention or deletion** behaviour (TTL, account deletion, cache expiry, on-device queues).
- New or changed **logging/telemetry** that may contain user data or identifiers (Application Insights, diagnostics, feedback).
- New or changed **permission** or device integration.
- Change to who can **see** data (visibility, publication, export, share bundles).

Not triggered: pure UI changes, calculations on already-processed data with no new storage or transfer, refactors with unchanged behaviour. When unsure, record `Privacy Impact: Unclear` and ask — do not skip silently.

---

## 3. Planner Procedure

1. Read the current policy and `docs/kb/tech/06-ai-integrations.md` / relevant domain docs for the affected area.
2. Describe the data flow in facts: category, source, recipient/service, storage location, retention, visibility. Mark anything not verifiable from the repository as **Assumption**.
3. Compare against each section of the policy and classify:
   - `Covered` — policy already states this accurately.
   - `Update needed` — policy is missing or inaccurate; give the exact proposed German wording.
   - `Open question` — needs a product or legal decision.
4. Add a mandatory **Privacy Impact** section to the plan:

   ```
   Privacy Impact: None | Policy covered | Policy update proposed | Open question
   Data flow: <category → recipient/storage, retention, visibility>
   Policy sections affected: <section headings or none>
   Proposed text: <German wording, or N/A>
   Open questions: <list or none>
   ```

5. Add `privacy-impact-review` to `Required Skills` for Backend/Frontend (reporting) and QA (review) work packages that carry the change.

---

## 4. Implementation Obligations

- Implement only data handling the plan declares. If the implementation needs additional data, recipients, or retention, report it to the Orchestrator and stop — do not extend silently.
- Handoff must state: data actually stored/sent/logged, services receiving it, retention behaviour, and whether identifiers or tokens are included.
- No user data (free text, names, health values, tokens) in logs unless the plan explicitly allows it.
- Policy text under `docs/legal/` is changed **only** when the plan contains an approved policy-update subtask. Update the `Stand:` date in that case.

---

## 5. QA Review Checklist

- [ ] Plan contains a Privacy Impact section for every triggered change.
- [ ] Handoff data handling matches the declared data flow (compare with code: repositories, AI calls, logging, permissions).
- [ ] No undeclared data category, recipient, retention change, or log content.
- [ ] Policy is accurate for the implemented behaviour: either unchanged and `Covered`, or updated as approved.
- [ ] Claims in the policy that the change affects (e.g. "no user ID sent to AI", "deleted when account deleted") are still true.
- [ ] Open questions are recorded as findings or in the plan, not resolved by assumption.

A mismatch between implemented behaviour and policy is at least `Non-blocking`; a policy statement that becomes false due to the change is `Blocking`.

---

## 6. Limits

- Does not give legal advice or certify compliance. Legal basis, special-category health data handling, international transfers, retention periods, and processor agreements require human/legal confirmation — list them as `Open question`.
- Never invent providers, regions, retention periods, or legal bases. State only what the repository or Knowledge Base supports.
- Publishing a policy change needs explicit user approval.

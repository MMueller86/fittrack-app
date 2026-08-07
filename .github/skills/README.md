# Skill Registry

This file is the authoritative index of available Skills for FitTrack agents.

When specifying `Required Skills` in a work package, use the exact name from the **Skill Name** column.
Do not invent skill names. If no existing skill covers the need, leave `Required Skills` empty.

---

| Skill Name | Consumers | Use when |
|---|---|---|
| `azure-openai-feature-integration` | Planner, Backend, QA | Adding or modifying an AI endpoint, prompt, JSON schema, Structured Output, quota enforcement, plausibility validation, or AI classification logic; deciding AI vs. deterministic; reviewing any AI feature change |
| `cosmos-data-model-and-migration` | Planner, Backend, QA | Adding or modifying a Cosmos document field, introducing a new entity type, deciding whether a new container is justified, choosing a partition key, classifying a schema change (no migration / read compatibility / lazy / explicit), planning backward-compatible document evolution, coordinating `cosmos.bicep` and `cosmos.ts` for new containers, or planning Dev vs Alpha rollout of persistence changes |

---

## Adding a New Skill

1. Create `.github/skills/<skill-name>/SKILL.md` with a YAML frontmatter block containing `name` and `description`.
2. Add a row to the table above using the exact `name` value from the frontmatter.
3. Keep the description in this table to one line — the skill file itself contains the full guidance.

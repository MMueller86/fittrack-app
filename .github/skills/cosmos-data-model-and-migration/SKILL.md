---
name: cosmos-data-model-and-migration
description: 'Guidance for safe Cosmos DB data-model and persistence changes in FitTrack. Use when: adding a field to an existing document type; introducing a new entity type; deciding whether a new container is justified; choosing a partition key; classifying a schema change (no migration, read compatibility, lazy migration, explicit migration); planning backward-compatible document evolution; coordinating infrastructure changes (cosmos.bicep, cosmos.ts); planning persistence changes for Dev vs Alpha environments. Primary consumers: Planner (scoping and classification), Backend (implementation and testing). Not required for changes that do not touch Cosmos documents, containers, or repository methods.'
---

# Cosmos DB Data Model and Migration

This skill provides decision guidance, invariants, and a testing checklist for any FitTrack task that changes how data is stored in Cosmos DB. It does not replace the Knowledge Base — it references it.

---

## 1. Consumers and When to Load

| Role | Load this skill when |
|---|---|
| **Planner** | Task adds or changes a document field, entity type, or container; partition key selection is needed; schema compatibility across Dev and Alpha must be assessed |
| **Backend** | Implementing a new repository method, adding a document field, introducing an entity type, adding a container, writing a migration |
| **QA** | Reviewing any change that modifies a Cosmos document shape, adds a container, or touches migration logic |
| **Frontend** | Does not load this skill — receives API contracts from the plan |

---

## 2. Data Model Decision Framework

Before changing any Cosmos document, classify the change using the decision tree below. Each branch has different infrastructure, testing, and compatibility implications.

### Decision tree

```
Need to store new data?
│
├── Does it belong to an existing entity (same owner, same lifecycle)?
│   └─ YES → Add a field to the existing document (optional field, backward-compatible)
│
├── Is it a new entity with its own identity and lifecycle, within the same repository domain?
│   └─ YES → Add a new document type to an existing container (same /userId partition)
│             Verify query patterns, indexing, and lifecycle are compatible with the existing container
│             Use a `type` discriminator field if the container holds heterogeneous documents
│             (see: nutritionDiaryMeals stores meals regardless of mealType)
│
└── Does it cross a repository/domain boundary, require a different partition key, or have distinct
    access/lifecycle/throughput characteristics?
    └─ YES → New container (requires infrastructure change — see Section 6)
```

### Heuristics for "same container" vs. "new container"

| Signal | Same container | New container |
|---|---|---|
| Partition key | `/userId` (user data) | Different owner or lookup key |
| Repository / domain boundary | Owned by the same repository interface | Requires a separate repository interface or belongs to a different domain |
| Typical query | By `userId` + simple filter | Requires composite indexes, cross-partition reads, or different throughput |
| Lifecycle / retention | Tied to the same user session or day | Independent, archivable, or system/catalog data |
| Volume | Comparable to existing documents | Orders-of-magnitude different (e.g. `foodProducts` catalog uses `/id`) |

**Default:** Most user-data entities belong in an existing container with `/userId` as partition key. Do not create a new container unless at least two of the "new container" signals apply — sharing a partition key alone is not sufficient justification for co-locating unrelated entities.

---

## 3. Partition Key Rules

All user-data containers use `/userId`. This is a hard architectural rule, not a preference.

| Rule | Rationale |
|---|---|
| User data → `/userId` | All queries are scoped to one user; partition-key-scoped queries are cheapest in Cosmos serverless |
| Catalog/system data → `/id` or domain-specific key | `foodProducts` uses `/id` because queries are by product id, not by user |
| Never use a mutable field as partition key | Partition key is immutable after write; user email and username can change |
| Never use a low-cardinality field | Status flags, booleans, and enums cause hot partitions |

---

## 4. Schema Evolution Classification

Classify every schema change before implementing it. The classification determines whether migration work is required and how to test it.

### Class 0 — No migration required

**Definition:** New optional field added; existing documents remain valid without the field. The application reads the field as absent/undefined and handles it gracefully.

**Example:** Adding `recipePortions?: number` to a `MealItem`.

**Requirements:**
- TypeScript type uses `?` (optional) or `T | undefined`
- All read paths handle the missing field explicitly (do not assume presence)
- Unit test: existing document without the field passes read logic

### Class 1 — Read compatibility (optional field with computed default)

**Definition:** New field is logically required but can be derived from existing data if absent. The application fills in the default on read, not via migration.

**Example:** Adding `sourceType: 'manual' | 'catalog' | 'ai'` where all historical items are `'manual'`.

**Requirements:**
- Read path applies the default: `doc.sourceType ?? 'manual'`
- Default must be deterministic and domain-correct — never guess
- Unit test: document without the field returns the correct default
- Document the default rule in the repository implementation comment

### Class 2 — Lazy migration

**Definition:** New field cannot be reliably defaulted without context. Documents are upgraded on write: when a document is read and saved (update), the new shape is written. Old documents co-exist until touched.

**Example:** Adding a denormalized `totalCalories` field that must be summed from items.

**Requirements:**
- Read path tolerates both old and new shape
- Write path always produces the new shape
- No background migration script needed
- Contract test: write old shape directly to emulator, read it back, verify the application handles it; then update and verify new shape is written
- Document the transition state in the repository file

### Class 3 — Explicit migration

**Definition:** All existing documents must be updated. Lazy migration is not acceptable (e.g. correctness depends on consistency, or the field is indexed).

**Examples:** Renaming a partition key (blocked — see invariants), adding a required indexed field used in cross-document queries.

**Requirements:**
- Migration is a separate, idempotent function (Azure Functions timer trigger or one-off script)
- Migration reads and rewrites documents in batches; never delete-and-recreate
- Migration is safe to run multiple times (idempotent: check if field already exists before writing)
- Contract test: run migration against emulator with a seeded dataset; verify before/after state
- Deploy order: deploy backend code that handles both old and new shape **before** running migration
- Alpha: run migration against Alpha Cosmos only after validating in Dev; never against a production database

---

## 5. Backward Compatibility Invariants

These invariants apply to every Cosmos schema change. Violating any one is a QA-blocking finding.

1. **Never remove a field that the current deployed backend reads.** Remove fields only after the reading code is deployed and verified to no longer reference the field.

2. **Never rename a field in place.** Add the new name, migrate reads to new name, deprecate old name, remove only after full rollout.

3. **Never change the semantic meaning of an existing field.** A field that previously stored grams and now stores portions is a breaking change — use a new field name.

4. **Never change the partition key of a container.** Cosmos partition keys are immutable at the container level. Changing partition key = create new container + migrate all data.

5. **Optional fields must remain optional at the TypeScript level.** Do not tighten a type from `T | undefined` to `T` without a Class 3 migration that guarantees the field is present on all documents.

6. **Do not rely on document ordering.** Cosmos query result order is not guaranteed unless `ORDER BY` is explicit.

---

## 6. Infrastructure Coordination

A new container requires changes in **two places**. Both must be in the same commit (or PR) as the repository code that uses the container.

### 6a. `backend/src/lib/cosmos.ts` — CONTAINER_DEFS

Add an entry to the `CONTAINER_DEFS` array:

```ts
{ id: 'myNewContainer', partitionKey: '/userId' },
```

This registers the container in the client singleton so `getCosmos()` can return a typed reference.

### 6b. `infra/modules/cosmos.bicep` — Container resource

**Backend does not write this file.** Backend outputs a container spec as a handoff; the Infrastructure & Release agent writes the Bicep resource block.

Container spec format (included in Backend's `Expected Handoff`):

```
containerName: myNewContainer
partitionKey: /userId
indexPolicyNote: default  # or describe required composite index / field exclusion
```

Infrastructure & Release adds a Bicep resource block following the naming and throughput conventions of existing containers. The container is added to both `dev.bicepparam` and `alpha.bicepparam` if the configuration differs between environments (rare — most containers are identical).

[Rule] **Deploy order:** Infrastructure & Release applies the Bicep change to Dev Cosmos first, verifies the container exists, then applies to Alpha Cosmos before the backend build that references it is deployed. Never deploy backend code referencing a new container before that container exists in the target environment. Contract tests always run against the Cosmos emulator — not against Dev or Alpha Cosmos.

### 6c. Index policy changes

Cosmos indexes all fields by default in the serverless tier. Explicit index policies are only needed for composite indexes (multi-field `ORDER BY`) or to exclude high-volume fields from indexing. If an index policy change is required:
- Add it to the Bicep container definition
- Document the reason (query pattern it enables) in a comment beside the index policy

---

## 7. Dev / Alpha Persistence Separation

Cosmos DB instances are **environment-specific**. Dev and Alpha each have a dedicated Cosmos account — they are **not** shared. (Contrast with Azure OpenAI and Entra External ID, which are shared across environments.)

**Consequence:** A schema migration applied to Dev Cosmos has no effect on Alpha Cosmos. Migrations must be applied separately and in the correct order: Dev first, Alpha second.

**Local development:** The backend falls back to an in-memory repository when `COSMOS_ENDPOINT` / `COSMOS_KEY` are not set. Contract tests must run against the local Cosmos emulator — never against a remote Cosmos account.

For account names, resource identifiers, and the full environment breakdown, see [`docs/kb/tech/07-infrastructure.md`](../../../docs/kb/tech/07-infrastructure.md) and [`docs/kb/tech/01-system-overview.md`](../../../docs/kb/tech/01-system-overview.md#runtime-environments).

---

## 8. Testing Requirements

### Unit tests

Required for any new repository logic, including:
- Default-fill logic for Class 1 fields
- Lazy-migration write logic (Class 2)
- Migration helper functions (Class 3)

Use in-memory repository implementations. Do not use Cosmos in unit tests.

### Contract tests (`*.contract.test.ts`)

Required for new Cosmos repository methods and for every schema change of Class 1 or higher.

Contract tests run against the **Cosmos emulator** — never against a remote Cosmos account. See [`docs/kb/tech/08-testing.md`](../../../docs/kb/tech/08-testing.md) for emulator setup and the CI contract test configuration.

**For Class 1 (read compatibility):** Write a document in the old shape directly to the emulator container. Read it back through the repository. Verify the default is applied correctly.

**For Class 2 (lazy migration):** Write an old-shape document. Read it, then trigger an update. Read again. Verify the new shape was written.

**For Class 3 (explicit migration):** Seed the emulator with a dataset containing only old-shape documents. Run the migration function. Verify all documents now have the new shape. Run the migration again — verify it is idempotent (no errors, no duplicate writes).

### Backward-compatibility smoke test

For any schema change that touches documents with existing data in Alpha, add a contract test that seeds the emulator with a representative Alpha document shape (copy a sanitised document shape from Alpha). Verify the current repository reads it without error.

---

## 9. QA Review Checklist

For any task that modifies a Cosmos document shape, adds a container, or introduces migration logic, work through the full checklist in [references/implementation-checklist.md](./references/implementation-checklist.md).

---

## 10. Knowledge Base and Repository References

| Topic | Reference |
|---|---|
| Container list, partition keys, naming, account names | [`docs/kb/tech/07-infrastructure.md`](../../../docs/kb/tech/07-infrastructure.md#cosmos-db-containers) |
| Dev and Alpha environment breakdown | [`docs/kb/tech/01-system-overview.md`](../../../docs/kb/tech/01-system-overview.md#runtime-environments) |
| Contract test setup, emulator, CI config | [`docs/kb/tech/08-testing.md`](../../../docs/kb/tech/08-testing.md) |
| Repository pattern, factory functions | [`.github/instructions/backend.instructions.md`](../../instructions/backend.instructions.md#repository-pattern) |
| Cosmos client singleton, CONTAINER_DEFS | `backend/src/lib/cosmos.ts` |
| Bicep container definitions | `infra/modules/cosmos.bicep` |
| Emulator test utilities | `backend/src/test-utils/cosmosEmulator.ts` |
| Existing contract test examples | `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts` |
| QA review checklist | [references/implementation-checklist.md](./references/implementation-checklist.md) |

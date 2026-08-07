# QA Review Checklist — Cosmos Data Model and Migration

Use this checklist when reviewing any task that modifies a Cosmos document shape, adds a container, or introduces migration logic.

---

## Document shape

- [ ] New optional fields use `?` in the TypeScript type
- [ ] All read paths handle missing fields (no implicit `.field` where `field` could be absent)
- [ ] No field has been removed that the currently deployed backend still reads
- [ ] No field has been semantically redefined — only additions and renames with a transition period
- [ ] Class 1 default is deterministic and documented in the repository implementation comment

## Partition key

- [ ] User data uses `/userId`
- [ ] No mutable or low-cardinality field is used as partition key
- [ ] Partition key of any existing container has not been changed

## Infrastructure (new containers only)

- [ ] `CONTAINER_DEFS` in `backend/src/lib/cosmos.ts` updated
- [ ] `infra/modules/cosmos.bicep` updated
- [ ] Infrastructure change deployed before the backend code that references the new container

## Migration correctness (Class 3)

- [ ] Migration is idempotent — safe to run multiple times
- [ ] Migration checks field existence before writing (does not overwrite already-migrated documents)
- [ ] Backend handles both old and new shape during the migration window
- [ ] Migration was validated in Dev before being applied to Alpha

## Testing

- [ ] Unit test covers read-default logic (Class 1)
- [ ] Contract test covers old-shape documents (Class 1+)
- [ ] Contract test verifies lazy-write produces the new shape (Class 2)
- [ ] Idempotency contract test passes (Class 3): run migration twice, verify no errors and no double-writes
- [ ] No contract test is configured to point at a remote Cosmos account

# Quota System

## Purpose

Controls how many AI feature calls each user can make per calendar month. Prevents runaway costs and ensures fair usage across all users.

## User Tiers

| Tier | Assignment | Quota |
|---|---|---|
| `internal` | `INTERNAL_USER_IDS` env var (comma-separated user IDs) | Unlimited (`Infinity`) |
| `premium` | [Planned] Entra App Role — not yet implemented | Elevated limits |
| `free` | All other users | Standard limits |

### Admin Bypass (separate from tier)

`isAdmin = true` (from Entra App Role `'Admin'`) bypasses quota **before** the tier check:

```ts
// quota.ts
if (user.isAdmin) return null; // no quota check, no 429
```

This means an admin user with `tier = 'free'` still has unlimited quota. `isAdmin` and `tier = 'internal'` are two independent paths to unlimited access.

See [tech/05-authentication.md](../tech/05-authentication.md) for how `isAdmin` is assigned.

## AI Features Subject to Quota

`AiFeature`:

- `'meal-parser'` — free-text meal parsing
- `'food-estimate'` — food name → nutrition estimate
- `'label-scan'` — nutrition label OCR + AI
- `'meal-estimate'` — meal image → nutrition estimate
- `'recipe-analyze'` — recipe text analysis
- `'recipe-scale'` — transient recipe description and step preview
- `'daily-insight'` — personal daily and weekly insight budget

## Monthly Limits (Documented Baseline)

| Feature | Free | Premium | Internal |
|---|---:|---:|---:|
| `meal-parser` | 50/month | 500/month | ∞ |
| `food-estimate` | 50/month | 500/month | ∞ |
| `label-scan` | 30/month | 300/month | ∞ |
| `meal-estimate` | 30/month | 300/month | ∞ |
| `recipe-analyze` | 30/month | 300/month | ∞ |
| `recipe-scale` | 30/month | 30/month | ∞ |
| `daily-insight` | 30/month | 300/month | ∞ |

[Open] Exact values are in `backend/src/lib/quotaConfig.ts` — verify before publishing authoritative limits.
[Rule] `recipe-scale` uses exactly `30/month` for both `free` and `premium`; `internal` remains unlimited. The independent `isAdmin = true` bypass is applied before tier checks and remains unlimited even for a `free` tier user.

[Known repository divergence] The table above retains the documented baseline for existing features. The current repository uses different values for `food-estimate` (`30/300`) and `recipe-analyze` (`10/100`) in `backend/src/lib/quotaConfig.ts`; this existing conflict is not reused for `recipe-scale` and is not silently changed by US-05.
## Period

`period` = `YYYY-MM` format (current calendar month). Resets on the 1st of each month.

`getPeriodResetDate(period)` — returns ISO timestamp of the first day of the next month.

## Enforcement Flow

```
1. enforceQuota(user, feature)
   → reads AiUsageCounter from Cosmos (or in-memory for local dev)
   → if used >= limit: return QuotaExceededResponse (HTTP 429)
   → if allowed: return null (proceed)

2. [AI call happens]

3. trackUsage(user, feature)
   → increments counter in Cosmos
   → creates document if first use this period
```

[Rule] `enforceQuota()` does NOT increment usage. `trackUsage()` must be called separately after a successful AI response. This ensures failed AI calls are not counted.

The weekly insight endpoint reuses `daily-insight` as the shared personal-insight
budget. It calls `enforceQuota()` before Azure OpenAI and calls `trackUsage()` only
after the response passes server-side Structured Output validation. Quota exhaustion
is returned inside the weekly `200` response as `evaluation.status: 'quota_exceeded'`
with `evaluation.text: null`; no new monthly limit or feature key exists for weekly
insights. The deterministic seven-day values remain usable. Invalid weekly output,
including `finish_reason: 'length'` or a trimmed text over the 750-character
contract, is returned as `unavailable` and never calls `trackUsage()`.

## Cosmos Storage

Container: `aiUsage`, partition key: `/userId`

Document ID: `${userId}:${feature}:${period}`

Fields: `used`, `limit`, `tier`, `firstUsedAt`, `lastUsedAt`

One document per user + feature + calendar month.

## QuotaCheckResult

Returned internally by `checkQuota()`:

```ts
interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  feature: AiFeature;
  period: string;
}
```

## 429 Response Format

`QuotaExceededResponse` returned to mobile:

```ts
interface QuotaExceededResponse {
  error: 'quota_exceeded';
  feature: AiFeature;
  used: number;
  limit: number;
  period: string;
  resetsAt: string;  // ISO timestamp of period reset
}
```

The mobile client checks `isQuotaExceededError` (detected in the Axios response interceptor) and should show a user-friendly message with the reset date.

## Local Dev / Test

`InMemoryAiUsageRepository` is used when Cosmos is not configured (`isCosmosConfigured()` returns false). It resets on server restart. Safe for local development and unit tests.

## Related Documents

- [tech/02-backend.md](../tech/02-backend.md#quota-enforcement) — enforcement pattern in handlers
- [tech/06-ai-integrations.md](../tech/06-ai-integrations.md) — which features enforce quota

import { fileURLToPath } from 'node:url';
import { CosmosClient } from '@azure/cosmos';

const DB_NAME = 'fittrack-db';
const CONTAINER_NAME = 'nutritionDiaryMeals';
const ALPHA_ACCOUNT = 'cosmos-fittrack-alpha-wcobsd';
const MAX_RETRIES = 6;
const PORTION_UNITS = new Set(['portion', 'portions', 'portionen']);

class UserError extends Error {}

export function parseArgs(args) {
  if (args.length > 1 || args.some((arg) => arg !== '--apply')) {
    throw new UserError('Usage: node scripts/migrate-ai-meal-estimates.mjs [--apply]');
  }
  return { apply: args.includes('--apply') };
}

export function parseCosmosConn(conn) {
  const parts = {};
  for (const segment of String(conn ?? '').split(';')) {
    const index = segment.indexOf('=');
    if (index > 0) parts[segment.slice(0, index).trim()] = segment.slice(index + 1).trim();
  }
  if (!parts.AccountEndpoint || !parts.AccountKey) {
    throw new UserError('COSMOS_CONN must contain AccountEndpoint and AccountKey.');
  }

  let endpoint;
  try {
    endpoint = new URL(parts.AccountEndpoint);
  } catch {
    throw new UserError('COSMOS_CONN has an invalid AccountEndpoint.');
  }
  if (endpoint.protocol !== 'https:') throw new UserError('COSMOS_CONN must use an HTTPS AccountEndpoint.');

  return {
    endpoint: endpoint.toString(),
    key: parts.AccountKey,
    account: endpoint.hostname.split('.')[0].toLowerCase(),
  };
}

export function assertAlphaAccount(account) {
  if (String(account).toLowerCase() !== ALPHA_ACCOUNT) {
    throw new UserError(`COSMOS_CONN must target ${ALPHA_ACCOUNT}.`);
  }
}

export function safeError(error) {
  if (error instanceof UserError) return error.message;
  const code = error?.code ?? error?.statusCode ?? error?.name ?? 'unknown';
  return `Operation failed (code=${typeof code === 'object' ? 'unknown' : code}).`;
}

async function withRetry(operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const status = error?.code ?? error?.statusCode;
      if ((status !== 429 && status !== 503) || attempt >= MAX_RETRIES) throw error;
      const wait = Math.max(error.retryAfterInMs ?? 0, 500 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

function isPortionUnit(unit) {
  return typeof unit === 'string' && PORTION_UNITS.has(unit.trim().toLowerCase());
}

export async function migrateMeals(container, { apply = false } = {}) {
  const result = {
    mealsScanned: 0,
    eligibleItems: 0,
    changedItems: 0,
    deviatingItems: 0,
    failedItems: 0,
  };
  const iterator = container.items.query('SELECT * FROM c', { maxItemCount: 100 });

  while (iterator.hasMoreResults()) {
    const { resources = [] } = await withRetry(() => iterator.fetchNext());
    for (const meal of resources) {
      result.mealsScanned++;
      let eligibleInMeal = 0;
      for (const item of Array.isArray(meal.items) ? meal.items : []) {
        if (item.sourceType !== 'ai-meal-estimate' || item.quantity !== 100) continue;
        if (!isPortionUnit(item.unit)) {
          result.deviatingItems++;
          continue;
        }

        result.eligibleItems++;
        if (!apply) continue;
        item.quantity = 1;
        item.unit = 'portion';
        eligibleInMeal++;
      }

      if (!apply || eligibleInMeal === 0) continue;
      if (!meal.id || !meal.userId || !meal._etag) {
        result.failedItems += eligibleInMeal;
        continue;
      }

      try {
        await withRetry(() => container.item(meal.id, meal.userId).replace(meal, {
          accessCondition: { type: 'IfMatch', condition: meal._etag },
        }));
        result.changedItems += eligibleInMeal;
      } catch {
        result.failedItems += eligibleInMeal;
      }
    }
  }

  return result;
}

export function formatSummary(result, apply) {
  return [
    `Mode: ${apply ? 'Apply' : 'Dry-Run'}`,
    `Meals scanned: ${result.mealsScanned}`,
    `Eligible items: ${result.eligibleItems}`,
    `Items changed: ${result.changedItems}`,
    `Deviating items (quantity=100, non-portion unit): ${result.deviatingItems}`,
    `Failed items: ${result.failedItems}`,
  ].join('\n');
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const { apply } = parseArgs(args);
  if (!env.COSMOS_CONN) throw new UserError('Missing environment variable: COSMOS_CONN.');
  const cosmos = parseCosmosConn(env.COSMOS_CONN);
  assertAlphaAccount(cosmos.account);

  const client = new CosmosClient({ endpoint: cosmos.endpoint, key: cosmos.key });
  try {
    const container = client.database(DB_NAME).container(CONTAINER_NAME);
    const result = await migrateMeals(container, { apply });
    console.log(formatSummary(result, apply));
    if (result.failedItems > 0) process.exitCode = 1;
    return result;
  } finally {
    await client.dispose();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Migration failed:', safeError(error));
    process.exitCode = 1;
  });
}
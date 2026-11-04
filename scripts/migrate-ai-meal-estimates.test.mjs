import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAlphaAccount,
  formatSummary,
  migrateMeals,
  parseArgs,
  parseCosmosConn,
  safeError,
} from './migrate-ai-meal-estimates.mjs';

function makeContainer(meals) {
  const writes = [];
  return {
    meals,
    writes,
    items: {
      query: () => {
        let offset = 0;
        return {
          hasMoreResults: () => offset < meals.length,
          fetchNext: async () => {
            const resources = meals.slice(offset, offset + 2);
            offset += resources.length;
            return { resources };
          },
        };
      },
    },
    item: (id, userId) => ({
      replace: async (meal, options) => {
        writes.push({ id, userId, options });
        const index = meals.findIndex((entry) => entry.id === id && entry.userId === userId);
        meals[index] = structuredClone(meal);
        return { resource: meals[index] };
      },
    }),
  };
}

const createMeal = (items, id = 'meal-1') => ({
  id,
  userId: 'user-1',
  _etag: `etag-${id}`,
  items,
});

const aiItem = (overrides = {}) => ({
  id: 'item-1',
  sourceType: 'ai-meal-estimate',
  quantity: 100,
  unit: 'Portion',
  macros: { calories: 520, protein: 24, carbs: 48, fat: 22, fiber: 6 },
  ...overrides,
});

test('defaults to dry-run and rejects unsupported arguments', () => {
  assert.deepEqual(parseArgs([]), { apply: false });
  assert.deepEqual(parseArgs(['--apply']), { apply: true });
  assert.throws(() => parseArgs(['--force']), /Usage:/);
  assert.throws(() => parseArgs(['--apply', '--apply']), /Usage:/);
});

test('accepts only the current Alpha Cosmos account without exposing credentials', () => {
  const parsed = parseCosmosConn(
    'AccountEndpoint=https://cosmos-fittrack-alpha-wcobsd.documents.azure.com:443/;AccountKey=SECRETKEY==;',
  );
  assert.equal(parsed.account, 'cosmos-fittrack-alpha-wcobsd');
  assert.equal(parsed.key, 'SECRETKEY==');
  assert.equal(assertAlphaAccount(parsed.account), undefined);
  assert.throws(() => assertAlphaAccount('cosmos-fittrack-dev-hlpqe7'), /must target/);
  assert.throws(() => parseCosmosConn('AccountEndpoint=nope;AccountKey=SECRETKEY=='), (error) => {
    assert.doesNotMatch(safeError(error), /SECRETKEY/);
    return true;
  });
  assert.doesNotMatch(safeError(new Error('AccountKey=SECRETKEY==')), /SECRETKEY/);
});

test('dry-run counts eligible and deviating items without writing or mutating documents', async () => {
  const meals = [createMeal([
    aiItem(),
    aiItem({ id: 'item-2', unit: 'g' }),
    aiItem({ id: 'item-3', quantity: 50 }),
    aiItem({ id: 'item-4', sourceType: 'manual' }),
  ])];
  const before = structuredClone(meals);
  const container = makeContainer(meals);

  const result = await migrateMeals(container);

  assert.deepEqual(result, {
    mealsScanned: 1,
    eligibleItems: 1,
    changedItems: 0,
    deviatingItems: 1,
    failedItems: 0,
  });
  assert.deepEqual(meals, before);
  assert.equal(container.writes.length, 0);
  assert.match(formatSummary(result, false), /Mode: Dry-Run/);
  assert.match(formatSummary(result, false), /Deviating items .*: 1/);
});

test('apply normalizes qualifying items, preserves nutrition, and is idempotent', async () => {
  const originalItem = aiItem();
  const meals = [createMeal([originalItem, aiItem({ id: 'item-2', unit: 'g' })])];
  const originalMacros = structuredClone(originalItem.macros);
  const container = makeContainer(meals);

  const first = await migrateMeals(container, { apply: true });

  assert.equal(first.eligibleItems, 1);
  assert.equal(first.changedItems, 1);
  assert.equal(first.deviatingItems, 1);
  assert.deepEqual(meals[0].items[0], {
    ...originalItem,
    quantity: 1,
    unit: 'portion',
  });
  assert.deepEqual(meals[0].items[0].macros, originalMacros);
  assert.equal(container.writes.length, 1);
  assert.deepEqual(container.writes[0].options.accessCondition, {
    type: 'IfMatch',
    condition: 'etag-meal-1',
  });

  const second = await migrateMeals(container, { apply: true });

  assert.equal(second.eligibleItems, 0);
  assert.equal(second.changedItems, 0);
  assert.equal(container.writes.length, 1);
});

test('apply counts missing optimistic-concurrency metadata as failed without writing', async () => {
  const meals = [{ ...createMeal([aiItem()]), _etag: undefined }];
  const container = makeContainer(meals);

  const result = await migrateMeals(container, { apply: true });

  assert.equal(result.failedItems, 1);
  assert.equal(result.changedItems, 0);
  assert.equal(container.writes.length, 0);
});
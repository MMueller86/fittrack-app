// reusableItemsEnrichScheduler.ts — Nightly fallback for AI keyword enrichment.
//
// Timer trigger: runs daily at 03:00 UTC.
// Finds all ReusableItems without searchTermsEnriched === true and enqueues
// an enrichment message for each one.
//
// This is a safety net — normal enrichment happens on create/update via
// enqueueEnrichment() in reusableItems.ts. The scheduler catches any items
// that were missed (e.g. created before the enrichment pipeline was deployed).

import { app, type InvocationContext } from '@azure/functions';
import { getCosmos } from '../lib/cosmos';
import { enqueueEnrichment } from '../lib/queueClient';
import type { ReusableItem } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const reusableItemsEnrichSchedulerHandler = async (
  _timer: unknown,
  ctx: InvocationContext,
): Promise<void> => {
  ctx.log('[reusableItemsEnrichScheduler] Starting nightly enrichment scan');

  if (!process.env['COSMOS_ENDPOINT'] || !process.env['COSMOS_KEY']) {
    ctx.log('[reusableItemsEnrichScheduler] Cosmos not configured — skipping');
    return;
  }

  const { containers } = await getCosmos();

  // Query items that have not yet been AI-enriched
  type ItemRow = Pick<ReusableItem, 'id' | 'userId'>;
  const { resources } = await containers.reusableMealItems.items
    .query<ItemRow>(
      'SELECT c.id, c.userId FROM c WHERE (NOT IS_DEFINED(c.searchTermsEnriched) OR c.searchTermsEnriched = false)',
      { maxItemCount: 500 },
    )
    .fetchAll();

  ctx.log(`[reusableItemsEnrichScheduler] Found ${resources.length} unenriched items`);

  let enqueued = 0;
  for (const row of resources) {
    await enqueueEnrichment(row.userId, row.id, ctx);
    enqueued++;
  }

  ctx.log(`[reusableItemsEnrichScheduler] Enqueued ${enqueued} items`);
};

// ---------------------------------------------------------------------------
// Registration — runs every day at 03:00 UTC
// ---------------------------------------------------------------------------

app.timer('reusable-items-enrich-scheduler', {
  schedule: '0 0 3 * * *', // cron: seconds minutes hours day month weekday
  handler: reusableItemsEnrichSchedulerHandler,
});

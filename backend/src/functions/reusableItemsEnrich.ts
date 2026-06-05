// reusableItemsEnrich.ts — Queue-triggered AI keyword enrichment for ReusableItems.
//
// Queue: reusable-items-enrich (Azure Storage Queue)
// Message: { userId: string; itemId: string }
//
// Flow:
//   1. Receive message from queue
//   2. Load ReusableItem from Cosmos
//   3. If already enriched (searchTermsEnriched === true) → skip
//   4. Build keyword prompt (buildKeywordPrompt)
//   5. Call Azure OpenAI → parse JSON array of keywords
//   6. Merge with existing searchTerms (deduplicated)
//   7. Save back to Cosmos with searchTermsEnriched = true
//
// Timer fallback: reusableItemsEnrichScheduler.ts runs nightly and re-queues
// any items still missing searchTermsEnriched.

import { app, type InvocationContext } from '@azure/functions';
import { AzureOpenAI } from 'openai';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { buildKeywordPrompt } from '../lib/prompts/foodKeywords';

// ---------------------------------------------------------------------------
// OpenAI client (lazy singleton — reuses the same pattern as openai.ts)
// ---------------------------------------------------------------------------

let _client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!_client) {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    const apiKey = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-07-01';
    if (!endpoint || !apiKey) throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set');
    _client = new AzureOpenAI({ endpoint, apiKey, apiVersion });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Message shape (mirrors EnrichQueueMessage from queueClient.ts)
// ---------------------------------------------------------------------------

interface EnrichMessage {
  userId: string;
  itemId: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const reusableItemsEnrichHandler = async (
  queueItem: unknown,
  ctx: InvocationContext,
): Promise<void> => {
  let msg: EnrichMessage;

  // Parse message — Azure Functions delivers queue messages as base64-decoded strings or objects
  try {
    if (typeof queueItem === 'string') {
      msg = JSON.parse(queueItem) as EnrichMessage;
    } else {
      msg = queueItem as EnrichMessage;
    }
  } catch (e) {
    ctx.log(`[reusableItemsEnrich] Invalid message format: ${String(e)}`);
    return; // Don't retry parse errors
  }

  const { userId, itemId } = msg;
  if (!userId || !itemId) {
    ctx.log(`[reusableItemsEnrich] Missing userId or itemId in message`);
    return;
  }

  ctx.log(`[reusableItemsEnrich] Processing itemId=${itemId} userId=${userId}`);

  const repo = getReusableItemsRepository();

  // Load item
  const item = await repo.getById(userId, itemId);
  if (!item) {
    ctx.log(`[reusableItemsEnrich] Item not found — may have been deleted. Skipping.`);
    return;
  }

  // Skip if already enriched
  if ((item as typeof item & { searchTermsEnriched?: boolean }).searchTermsEnriched === true) {
    ctx.log(`[reusableItemsEnrich] Item already enriched — skipping.`);
    return;
  }

  // Build and send prompt
  const prompt = buildKeywordPrompt(item.name, item.brand);
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  let aiKeywords: string[] = [];
  try {
    const response = await getClient().chat.completions.create({
      model: deployment,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 256,
    });

    const raw = response.choices[0]?.message?.content ?? '[]';
    // Strip markdown code fences (e.g. ```json ... ```) that some model versions emit
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        aiKeywords = parsed.filter((k): k is string => typeof k === 'string' && k.length >= 2);
      }
    } catch (parseErr) {
      // Non-retryable: bad model output won't improve on retry — log and continue without keywords
      ctx.log(`[reusableItemsEnrich] Could not parse OpenAI response as JSON (skipping keywords): ${String(parseErr)}`);
      ctx.log(`[reusableItemsEnrich] Raw response was: ${raw.slice(0, 200)}`);
    }
  } catch (e) {
    ctx.log(`[reusableItemsEnrich] OpenAI call failed: ${e instanceof Error ? e.message : String(e)}`);
    // Re-throw only for transient errors (network, rate limit) so the queue retries.
    // Parse errors are caught above and do NOT reach here.
    throw e;
  }

  // Merge AI keywords into searchTerms (for Cosmos search queries) and store
  // them separately in aiKeywords so the UI can display them distinctly.
  const existing = item.searchTerms ?? [];
  const merged = [...new Set([...existing, ...aiKeywords])];

  await repo.update(userId, itemId, {
    searchTerms: merged,
    aiKeywords,
    searchTermsEnriched: true,
  });

  ctx.log(`[reusableItemsEnrich] Enriched itemId=${itemId} with ${aiKeywords.length} AI keywords. Total terms: ${merged.length}`);
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const queueName = process.env['ENRICH_QUEUE_NAME'] ?? 'reusable-items-enrich';

app.storageQueue('reusable-items-enrich', {
  connection: 'AzureWebJobsStorage',
  queueName,
  handler: reusableItemsEnrichHandler,
});

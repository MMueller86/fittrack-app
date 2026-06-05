// Azure Storage Queue client — lazy singleton for enqueuing AI enrichment messages.
// Uses the STORAGE_CONNECTION_STRING env var (same as BlobServiceClient in other modules).
// Falls back to AzureWebJobsStorage for local dev with Azurite.

import { QueueClient, QueueServiceClient } from '@azure/storage-queue';

// ---------------------------------------------------------------------------
// Message shape
// ---------------------------------------------------------------------------

export interface EnrichQueueMessage {
  userId: string;
  itemId: string;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function getQueueClient(queueName: string): QueueClient {
  // The queue trigger (reusableItemsEnrich) uses connection: 'AzureWebJobsStorage'.
  // We must write to the SAME storage so the trigger actually fires.
  // In production, AzureWebJobsStorage is auto-set by the platform to the backing
  // storage account. Locally it points to Azurite ("UseDevelopmentStorage=true").
  // STORAGE_CONNECTION_STRING is used for blobs/files but NOT for internal queues.
  const connectionString =
    process.env['AzureWebJobsStorage'] ||
    process.env['STORAGE_CONNECTION_STRING'];

  if (!connectionString) {
    throw new Error('AzureWebJobsStorage or STORAGE_CONNECTION_STRING must be set');
  }

  const serviceClient = QueueServiceClient.fromConnectionString(connectionString);
  return serviceClient.getQueueClient(queueName);
}

// ---------------------------------------------------------------------------
// Enqueue helper
// ---------------------------------------------------------------------------

/**
 * Sends an enrichment message to the queue. Fire-and-forget — errors are logged
 * but not re-thrown so the calling handler always returns 2xx.
 *
 * The queue is auto-created if it does not exist yet (idempotent).
 */
export async function enqueueEnrichment(
  userId: string,
  itemId: string,
  ctx?: { log: (msg: string) => void },
): Promise<void> {
  const queueName = process.env['ENRICH_QUEUE_NAME'] ?? 'reusable-items-enrich';
  try {
    const client = getQueueClient(queueName);
    await client.createIfNotExists();
    const message: EnrichQueueMessage = { userId, itemId };
    // Azure Storage Queue messages must be base64-encoded strings
    await client.sendMessage(Buffer.from(JSON.stringify(message)).toString('base64'));
  } catch (e) {
    ctx?.log(`[enqueueEnrichment] Failed to enqueue ${itemId}: ${e instanceof Error ? e.message : String(e)}`);
    // Intentionally NOT re-throwing — enrichment failure must not block the main response
  }
}

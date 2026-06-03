// Azure Blob Storage client for recipe images.
// Backend proxies all access — mobile never holds permanent credentials.
// SAS tokens (read-only, 1h TTL) are generated per-request after ownership verification.
//
// Local dev: set STORAGE_CONNECTION_STRING to a real Azure Storage Dev account.
// Unit/handler tests: vi.mock('../lib/storage') — no network access.
// Contract tests (optional): Azurite with UseDevelopmentStorage=true.

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { randomUUID } from 'node:crypto';

const CONTAINER_NAME = 'recipe-images';
const SAS_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Client (lazy singleton)
// ---------------------------------------------------------------------------

let _client: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (!_client) {
    const connStr = process.env['STORAGE_CONNECTION_STRING'];
    if (!connStr) throw new Error('STORAGE_CONNECTION_STRING must be set');
    _client = BlobServiceClient.fromConnectionString(connStr);
  }
  return _client;
}

/** Reset singleton — used in tests. */
export function __setStorageClientForTests(client: BlobServiceClient | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResult {
  /** Blob path stored in Cosmos: {userId}/{recipeId}/{imageId}.{ext} */
  blobName: string;
  imageId: string;
}

/**
 * Upload a recipe image buffer to Blob Storage.
 * Returns the blobName to be stored in the Cosmos recipe document.
 */
export async function uploadRecipeImage(
  userId: string,
  recipeId: string,
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png',
): Promise<UploadResult> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const imageId = randomUUID();
  const blobName = `${userId}/${recipeId}/${imageId}.${ext}`;

  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return { blobName, imageId };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a blob from Blob Storage.
 * Silently succeeds if the blob does not exist (idempotent).
 */
export async function deleteRecipeImage(blobName: string): Promise<void> {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

// ---------------------------------------------------------------------------
// SAS URL generation
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived read-only SAS URL for a recipe image blob.
 * The caller is responsible for verifying ownership before calling this function.
 * TTL: 1 hour.
 */
export async function generateRecipeImageSasUrl(blobName: string): Promise<string> {
  const connStr = process.env['STORAGE_CONNECTION_STRING'];
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING must be set');

  // Parse account name and key from connection string
  const accountNameMatch = connStr.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connStr.match(/AccountKey=([^;]+)/);
  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error('Cannot parse AccountName/AccountKey from STORAGE_CONNECTION_STRING');
  }
  const accountName = accountNameMatch[1];
  const accountKey = accountKeyMatch[1];

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + SAS_TTL_MS);

  const sasQuery = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    },
    sharedKeyCredential,
  );

  // Determine endpoint from connection string (supports Azurite and real accounts)
  const endpointMatch = connStr.match(/BlobEndpoint=([^;]+)/);
  const baseUrl = endpointMatch
    ? `${endpointMatch[1].replace(/\/$/, '')}/${CONTAINER_NAME}/${blobName}`
    : `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;

  return `${baseUrl}?${sasQuery.toString()}`;
}


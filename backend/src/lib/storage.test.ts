import type { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __setStorageClientForTests,
  downloadRecipeImage,
  RECIPE_IMAGE_MAX_BYTES,
  RecipeImageTooLargeError,
} from './storage';

function makeClient(blockBlobClient: BlockBlobClient): BlobServiceClient {
  return {
    getContainerClient: vi.fn().mockReturnValue({
      getBlockBlobClient: vi.fn().mockReturnValue(blockBlobClient),
    }),
  } as unknown as BlobServiceClient;
}

afterEach(() => {
  __setStorageClientForTests(null);
});

describe('downloadRecipeImage', () => {
  it('downloads a small blob without requesting a range beyond its size', async () => {
    const downloadToBuffer = vi.fn().mockImplementation(async (offset: number, count: number) => {
      if (offset + count > 4) {
        throw new Error('The range specified is invalid for the current size of the resource.');
      }
      return Buffer.from('image');
    });
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 4 }),
      downloadToBuffer,
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    const result = await downloadRecipeImage('user/recipe/image.png');

    expect(result).toEqual(Buffer.from('image'));
    expect(downloadToBuffer).toHaveBeenCalledWith(0, 4);
  });

  it('rejects a blob whose advertised size exceeds the render limit before downloading', async () => {
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: RECIPE_IMAGE_MAX_BYTES + 1 }),
      downloadToBuffer: vi.fn(),
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    await expect(downloadRecipeImage('user/recipe/large.png')).rejects.toBeInstanceOf(
      RecipeImageTooLargeError,
    );
    expect(blockBlobClient.downloadToBuffer).not.toHaveBeenCalled();
  });

  it('rejects a downloaded buffer that exceeds the limit despite missing metadata', async () => {
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: undefined }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.alloc(RECIPE_IMAGE_MAX_BYTES + 1)),
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    await expect(downloadRecipeImage('user/recipe/unknown-size.png')).rejects.toBeInstanceOf(
      RecipeImageTooLargeError,
    );
  });
});
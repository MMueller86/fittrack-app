import type { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __setStorageClientForTests,
  communityRecipeImageBlobName,
  copyRecipeImageToOwnerSnapshot,
  copyRecipeImageToCommunity,
  downloadRecipeImage,
  downloadRecipeImageWithContentType,
  listPersonalProductImageBlobNames,
  listPersonalRecipeImageBlobNames,
  RECIPE_IMAGE_MAX_BYTES,
  RecipeImageSnapshotConflictError,
  RecipeImageTooLargeError,
  RecipeImageUnsupportedContentTypeError,
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

describe('downloadRecipeImageWithContentType', () => {
  it('returns bounded image bytes and the validated stored PNG type', async () => {
    const downloadToBuffer = vi.fn().mockResolvedValue(Buffer.from('image'));
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/png' }),
      downloadToBuffer,
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    const result = await downloadRecipeImageWithContentType('user/recipe/image.png');

    expect(result).toEqual({ buffer: Buffer.from('image'), contentType: 'image/png' });
    expect(downloadToBuffer).toHaveBeenCalledWith(0, 5);
  });

  it('rejects an advertised oversized blob before downloading', async () => {
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({
        contentLength: RECIPE_IMAGE_MAX_BYTES + 1,
        contentType: 'image/jpeg',
      }),
      downloadToBuffer: vi.fn(),
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    await expect(downloadRecipeImageWithContentType('user/recipe/large.jpg')).rejects.toBeInstanceOf(
      RecipeImageTooLargeError,
    );
    expect(blockBlobClient.downloadToBuffer).not.toHaveBeenCalled();
  });

  it('rejects unsupported stored content types before downloading', async () => {
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/gif' }),
      downloadToBuffer: vi.fn(),
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    await expect(downloadRecipeImageWithContentType('user/recipe/image.gif')).rejects.toBeInstanceOf(
      RecipeImageUnsupportedContentTypeError,
    );
    expect(blockBlobClient.downloadToBuffer).not.toHaveBeenCalled();
  });

  it('rejects oversized downloaded bytes when blob length metadata is absent', async () => {
    const blockBlobClient = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: undefined, contentType: 'image/jpeg' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.alloc(RECIPE_IMAGE_MAX_BYTES + 1)),
    } as unknown as BlockBlobClient;
    __setStorageClientForTests(makeClient(blockBlobClient));

    await expect(downloadRecipeImageWithContentType('user/recipe/unknown-size.jpg')).rejects.toBeInstanceOf(
      RecipeImageTooLargeError,
    );
  });
});

describe('community recipe image copy', () => {
  it('copies to a deterministic neutral path and can safely repeat the copy', async () => {
    const source = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 4, contentType: 'image/png' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('image')),
    };
    const target = { uploadData: vi.fn().mockResolvedValue(undefined) };
    const container = {
      getBlockBlobClient: vi.fn((name: string) => name === 'owner/recipe-1/image-1.png' ? source : target),
    };
    const client = { getContainerClient: vi.fn(() => container) } as unknown as BlobServiceClient;
    __setStorageClientForTests(client);

    const first = await copyRecipeImageToCommunity('owner/recipe-1/image-1.png', 'recipe-1', 'image-1');
    const second = await copyRecipeImageToCommunity('owner/recipe-1/image-1.png', 'recipe-1', 'image-1');

    expect(first).toBe('community/recipe-1/image-1.png');
    expect(second).toBe(first);
    expect(target.uploadData).toHaveBeenCalledTimes(2);
    expect(target.uploadData).toHaveBeenCalledWith(Buffer.from('image'), {
      blobHTTPHeaders: { blobContentType: 'image/png' },
    });
    expect(communityRecipeImageBlobName('recipe/1', 'image 1', 'image/jpeg'))
      .toBe('community/recipe%2F1/image%201.jpg');
  });

  it('does not copy an image that already has its stable community path', async () => {
    const client = { getContainerClient: vi.fn() } as unknown as BlobServiceClient;
    __setStorageClientForTests(client);

    await expect(copyRecipeImageToCommunity('community/recipe-1/image-1.png', 'recipe-1', 'image-1'))
      .resolves.toBe('community/recipe-1/image-1.png');
    expect(client.getContainerClient).not.toHaveBeenCalled();
  });
});

describe('personal blob inventory', () => {
  it('lists active personal blobs only under the authenticated user prefixes', async () => {
    const recipeContainer = {
      listBlobsFlat: vi.fn(async function* ({ prefix }: { prefix: string }) {
        yield { name: `${prefix}recipe-1/image.jpg` };
      }),
    };
    const productContainer = {
      listBlobsFlat: vi.fn(async function* ({ prefix }: { prefix: string }) {
        yield { name: `${prefix}item-1.png` };
      }),
    };
    const client = {
      getContainerClient: vi.fn((name: string) =>
        name === 'recipe-images' ? recipeContainer : productContainer),
    } as unknown as BlobServiceClient;
    __setStorageClientForTests(client);

    await expect(listPersonalRecipeImageBlobNames('user-1'))
      .resolves.toEqual(['user-1/recipe-1/image.jpg']);
    await expect(listPersonalProductImageBlobNames('user-1'))
      .resolves.toEqual(['user-1/item-1.png']);
    expect(recipeContainer.listBlobsFlat).toHaveBeenCalledWith({ prefix: 'user-1/' });
    expect(productContainer.listBlobsFlat).toHaveBeenCalledWith({ prefix: 'user-1/' });
  });
});

describe('owner snapshot image copy', () => {
  it('uses a deterministic owner path and create-only upload conditions', async () => {
    const source = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/png' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('image')),
    };
    const target = { uploadData: vi.fn().mockResolvedValue(undefined) };
    const container = {
      getBlockBlobClient: vi.fn((name: string) => name === 'community/source/image-1.png' ? source : target),
    };
    __setStorageClientForTests({ getContainerClient: vi.fn(() => container) } as unknown as BlobServiceClient);

    await expect(copyRecipeImageToOwnerSnapshot('community/source/image-1.png', 'user-1', 'recipe-1', 'image-1'))
      .resolves.toBe('user-1/recipe-1/image-1.png');

    expect(target.uploadData).toHaveBeenCalledWith(Buffer.from('image'), {
      blobHTTPHeaders: { blobContentType: 'image/png' },
      conditions: { ifNoneMatch: '*' },
    });
  });

  it.each([
    ['different bytes', { contentLength: 5, contentType: 'image/png' }, Buffer.from('other')],
    ['different type', { contentLength: 5, contentType: 'image/jpeg' }, Buffer.from('image')],
  ])('does not overwrite a conflicting target with %s', async (_label, targetProperties, targetBytes) => {
    const source = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/png' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('image')),
    };
    const target = {
      uploadData: vi.fn().mockRejectedValue(Object.assign(new Error('condition failed'), {
        statusCode: 412,
        code: 'ConditionNotMet',
      })),
      getProperties: vi.fn().mockResolvedValue(targetProperties),
      downloadToBuffer: vi.fn().mockResolvedValue(targetBytes),
      deleteIfExists: vi.fn(),
    };
    const container = {
      getBlockBlobClient: vi.fn((name: string) => name === 'source/image-1.png' ? source : target),
    };
    __setStorageClientForTests({ getContainerClient: vi.fn(() => container) } as unknown as BlobServiceClient);

    await expect(copyRecipeImageToOwnerSnapshot('source/image-1.png', 'user-1', 'recipe-1', 'image-1'))
      .rejects.toBeInstanceOf(RecipeImageSnapshotConflictError);
    expect(target.uploadData).toHaveBeenCalledTimes(1);
    expect(target.deleteIfExists).not.toHaveBeenCalled();
  });

  it('reuses an identical existing target after a 409 create-only conflict without deleting it', async () => {
    const source = {
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/png' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('image')),
    };
    const target = {
      uploadData: vi.fn().mockRejectedValue(Object.assign(new Error('already exists'), {
        statusCode: 409,
        code: 'BlobAlreadyExists',
      })),
      getProperties: vi.fn().mockResolvedValue({ contentLength: 5, contentType: 'image/png' }),
      downloadToBuffer: vi.fn().mockResolvedValue(Buffer.from('image')),
      deleteIfExists: vi.fn(),
    };
    const container = {
      getBlockBlobClient: vi.fn((name: string) => name === 'source/image-1.png' ? source : target),
    };
    __setStorageClientForTests({ getContainerClient: vi.fn(() => container) } as unknown as BlobServiceClient);

    await expect(copyRecipeImageToOwnerSnapshot('source/image-1.png', 'user-1', 'recipe-1', 'image-1'))
      .resolves.toBe('user-1/recipe-1/image-1.png');
    expect(target.uploadData).toHaveBeenCalledWith(Buffer.from('image'), {
      blobHTTPHeaders: { blobContentType: 'image/png' },
      conditions: { ifNoneMatch: '*' },
    });
    expect(target.deleteIfExists).not.toHaveBeenCalled();
  });
});
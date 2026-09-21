import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class File {},
  Paths: { cache: {} },
}));

vi.mock('expo-media-library', () => ({
  isAvailableAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAlbumAsync: vi.fn(),
  createAssetAsync: vi.fn(),
  addAssetsToAlbumAsync: vi.fn(),
  createAlbumAsync: vi.fn(),
  removeAssetsFromAlbumAsync: vi.fn(),
  deleteAssetsAsync: vi.fn(),
  deleteAlbumsAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

import {
  createRecipeShareMediaService,
  FITTRACK_ALBUM_NAME,
} from './recipeShareMediaService';
import type {
  RecipeShareAlbum,
  RecipeShareAsset,
  RecipeShareMediaDependencies,
  RecipeShareMediaLibrary,
  RecipeShareSharing,
} from './recipeShareMediaService';

function makeAlbum(overrides: Partial<RecipeShareAlbum> = {}): RecipeShareAlbum {
  return {
    id: 'album-1',
    title: FITTRACK_ALBUM_NAME,
    assetCount: 1,
    startTime: 0,
    endTime: 0,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<RecipeShareAsset> = {}): RecipeShareAsset {
  return {
    id: 'asset-1',
    filename: 'recipe.png',
    uri: 'file:///cache/recipe.png',
    mediaType: 'photo',
    width: 1080,
    height: 1350,
    creationTime: 0,
    modificationTime: 0,
    duration: 0,
    ...overrides,
  };
}

function createHarness() {
  const album = makeAlbum();
  const asset = makeAsset();
  const writePng = vi.fn().mockResolvedValue('file:///cache/fittrack-preview.png');
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const mediaLibrary: RecipeShareMediaLibrary = {
    isAvailableAsync: vi.fn().mockResolvedValue(true),
    requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    getAlbumAsync: vi.fn().mockResolvedValue(album),
    createAssetAsync: vi.fn().mockResolvedValue(asset),
    addAssetsToAlbumAsync: vi.fn().mockResolvedValue(true),
    createAlbumAsync: vi.fn().mockResolvedValue(album),
    removeAssetsFromAlbumAsync: vi.fn().mockResolvedValue(true),
    deleteAssetsAsync: vi.fn().mockResolvedValue(true),
    deleteAlbumsAsync: vi.fn().mockResolvedValue(true),
  };
  const shareAsync = vi.fn().mockResolvedValue(undefined);
  const sharing: RecipeShareSharing = {
    isAvailableAsync: vi.fn().mockResolvedValue(true),
    shareAsync,
  };
  const dependencies: RecipeShareMediaDependencies = {
    fileSystem: { writePng, delete: deleteFile },
    mediaLibrary,
    sharing,
  };

  return {
    album,
    asset,
    deleteFile,
    mediaLibrary,
    service: createRecipeShareMediaService(dependencies),
    shareAsync,
    sharing,
    writePng,
  };
}

describe('recipeShareMediaService', () => {
  it('writes the rendered PNG to a temporary URI and cleans it up idempotently', async () => {
    const harness = createHarness();
    const png = new Uint8Array([137, 80, 78, 71]).buffer;

    const uri = await harness.service.createPreviewUri(png);
    await harness.service.cleanupPreviewUri(uri);
    await harness.service.cleanupPreviewUri(uri);

    expect(uri).toBe('file:///cache/fittrack-preview.png');
    expect(harness.writePng).toHaveBeenCalledWith(new Uint8Array(png));
    expect(harness.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('distinguishes retryable permission denial from settings-only denial', async () => {
    const retryHarness = createHarness();
    vi.mocked(retryHarness.mediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
    });

    await expect(retryHarness.service.savePreview('file:///cache/preview.png')).rejects.toMatchObject({
      code: 'permission-denied',
      retryable: true,
      canAskAgain: true,
      openSettings: false,
    });
    expect(retryHarness.mediaLibrary.createAssetAsync).not.toHaveBeenCalled();

    const settingsHarness = createHarness();
    vi.mocked(settingsHarness.mediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });

    await expect(settingsHarness.service.savePreview('file:///cache/preview.png')).rejects.toMatchObject({
      code: 'permission-denied',
      retryable: false,
      canAskAgain: false,
      openSettings: true,
    });
  });

  it('reuses an exact FitTrack album and creates it only when the first lookup misses', async () => {
    const harness = createHarness();
    vi.mocked(harness.mediaLibrary.getAlbumAsync).mockResolvedValueOnce(null);
    await harness.service.savePreview('file:///cache/preview-1.png');

    expect(harness.mediaLibrary.requestPermissionsAsync).toHaveBeenNthCalledWith(1, false, ['photo']);
    expect(harness.mediaLibrary.getAlbumAsync).toHaveBeenCalledWith(FITTRACK_ALBUM_NAME);
    expect(harness.mediaLibrary.createAlbumAsync).toHaveBeenCalledWith(
      FITTRACK_ALBUM_NAME,
      harness.asset,
      true,
    );
    await harness.service.savePreview('file:///cache/preview-2.png');

    expect(harness.mediaLibrary.requestPermissionsAsync).toHaveBeenNthCalledWith(2, false, ['photo']);
    expect(harness.mediaLibrary.createAlbumAsync).toHaveBeenCalledTimes(1);
    expect(harness.mediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalledWith(
      harness.asset,
      harness.album,
      true,
    );
  });

  it('rolls back a newly created asset and album assignment when album insertion fails', async () => {
    const harness = createHarness();
    vi.mocked(harness.mediaLibrary.addAssetsToAlbumAsync).mockResolvedValueOnce(false);

    const failure = harness.service.savePreview('file:///cache/preview.png');
    await expect(failure).rejects.toMatchObject({
      code: 'album-asset-failed',
      rollback: {
        attempted: true,
        assetRemovedFromAlbum: true,
        assetDeleted: true,
        complete: true,
      },
    });
    expect(harness.mediaLibrary.removeAssetsFromAlbumAsync).toHaveBeenCalledWith(
      harness.asset,
      harness.album,
    );
    expect(harness.mediaLibrary.deleteAssetsAsync).toHaveBeenCalledWith(harness.asset);
    expect(harness.shareAsync).not.toHaveBeenCalled();
  });

  it('rolls back an album created by the failed save attempt', async () => {
    const harness = createHarness();
    const createdAlbum = makeAlbum({ id: 'created-album', title: 'Unexpected title' });
    vi.mocked(harness.mediaLibrary.getAlbumAsync).mockResolvedValueOnce(null);
    vi.mocked(harness.mediaLibrary.createAlbumAsync).mockResolvedValueOnce(createdAlbum);

    await expect(harness.service.savePreview('file:///cache/preview.png')).rejects.toMatchObject({
      code: 'album-create-failed',
      rollback: {
        attempted: true,
        assetRemovedFromAlbum: true,
        assetDeleted: true,
        albumDeleted: true,
        complete: true,
      },
    });
    expect(harness.mediaLibrary.removeAssetsFromAlbumAsync).toHaveBeenCalledWith(
      harness.asset,
      createdAlbum,
    );
    expect(harness.mediaLibrary.deleteAlbumsAsync).toHaveBeenCalledWith(createdAlbum);
  });

  it('uses the same URI for the album asset and sharing, and cleans up only after shareAsync resolves', async () => {
    const harness = createHarness();
    let resolveShare!: () => void;
    vi.mocked(harness.shareAsync).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveShare = resolve; }),
    );
    const session = harness.service.createSession('file:///cache/preview.png');
    const sharePromise = session.share();

    await vi.waitFor(() => expect(harness.shareAsync).toHaveBeenCalled());
    expect(harness.mediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///cache/preview.png');
    expect(harness.shareAsync).toHaveBeenCalledWith('file:///cache/preview.png', {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Rezept teilen',
    });
    expect(harness.deleteFile).not.toHaveBeenCalled();

    resolveShare();
    await sharePromise;
    expect(harness.deleteFile).toHaveBeenCalledWith('file:///cache/preview.png');
  });

  it('does not open a share sheet when sharing is unavailable and keeps the saved asset', async () => {
    const harness = createHarness();
    vi.mocked(harness.sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const session = harness.service.createSession('file:///cache/preview.png');

    await expect(session.share()).rejects.toMatchObject({
      code: 'sharing-unavailable',
    });
    expect(harness.mediaLibrary.createAssetAsync).toHaveBeenCalledTimes(1);
    expect(harness.shareAsync).not.toHaveBeenCalled();
    expect(harness.deleteFile).not.toHaveBeenCalled();
  });

  it('keeps the URI for a share retry and never creates a second asset', async () => {
    const harness = createHarness();
    vi.mocked(harness.shareAsync)
      .mockRejectedValueOnce(new Error('share cancelled'))
      .mockResolvedValueOnce(undefined);
    const session = harness.service.createSession('file:///cache/preview.png');

    await expect(session.share()).rejects.toMatchObject({ code: 'share-failed' });
    expect(harness.deleteFile).not.toHaveBeenCalled();

    await session.share();
    expect(harness.mediaLibrary.createAssetAsync).toHaveBeenCalledTimes(1);
    expect(harness.shareAsync).toHaveBeenNthCalledWith(2, 'file:///cache/preview.png', expect.any(Object));
    expect(harness.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('allows explicit cleanup after an unavailable share without touching media assets', async () => {
    const harness = createHarness();
    vi.mocked(harness.sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const session = harness.service.createSession('file:///cache/preview.png');

    await expect(session.share()).rejects.toMatchObject({ code: 'sharing-unavailable' });
    await session.cleanup();

    expect(harness.deleteFile).toHaveBeenCalledWith('file:///cache/preview.png');
    expect(harness.mediaLibrary.deleteAssetsAsync).not.toHaveBeenCalled();
  });
});
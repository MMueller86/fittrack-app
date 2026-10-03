import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ExpoMediaLibrary from 'expo-media-library';

const nativeShareMocks = vi.hoisted(() => ({
  open: vi.fn(),
  platform: { os: 'android' },
  deletedFiles: [] as string[],
}));

vi.mock('react-native-share', () => ({
  default: { open: nativeShareMocks.open },
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return nativeShareMocks.platform.os;
    },
  },
}));

vi.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;
    readonly exists = true;

    constructor(...segments: string[]) {
      const filename = segments[segments.length - 1] ?? '';
      this.uri = segments.length > 1 ? `file:///cache/${filename}` : filename;
    }

    write() {}

    delete() {
      nativeShareMocks.deletedFiles.push(this.uri);
    }
  },
  Paths: { cache: 'cache' },
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

import {
  createRecipeShareMediaService,
  FITTRACK_ALBUM_NAME,
  recipeShareMediaService,
} from './recipeShareMediaService';
import type {
  RecipeShareAlbum,
  RecipeShareAsset,
  RecipeShareMediaDependencies,
  RecipeShareMediaLibrary,
  RecipeShareSharing,
} from './recipeShareMediaService';

beforeEach(() => {
  nativeShareMocks.open.mockReset();
  nativeShareMocks.platform.os = 'android';
  nativeShareMocks.deletedFiles.length = 0;
});

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
  const createdAssets: RecipeShareAsset[] = [];
  const writePng = vi.fn().mockResolvedValue('file:///cache/fittrack-preview.png');
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const createAssetAsync = vi.fn(async (uri: string) => {
    const asset = makeAsset({
      id: `asset-${createdAssets.length + 1}`,
      filename: uri.split('/').pop() ?? 'recipe.png',
      uri,
    });
    createdAssets.push(asset);
    return asset;
  });
  const mediaLibrary: RecipeShareMediaLibrary = {
    isAvailableAsync: vi.fn().mockResolvedValue(true),
    requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    getAlbumAsync: vi.fn().mockResolvedValue(album),
    createAssetAsync,
    addAssetsToAlbumAsync: vi.fn().mockResolvedValue(true),
    createAlbumAsync: vi.fn().mockResolvedValue(album),
    removeAssetsFromAlbumAsync: vi.fn().mockResolvedValue(true),
    deleteAssetsAsync: vi.fn().mockResolvedValue(true),
    deleteAlbumsAsync: vi.fn().mockResolvedValue(true),
  };
  const sharePairAsync = vi.fn().mockResolvedValue(undefined);
  const sharing: RecipeShareSharing = {
    isAvailableAsync: vi.fn().mockResolvedValue(true),
    sharePairAsync,
  };
  const dependencies: RecipeShareMediaDependencies = {
    fileSystem: { writePng, delete: deleteFile },
    mediaLibrary,
    sharing,
  };

  return {
    album,
    createdAssets,
    deleteFile,
    mediaLibrary,
    service: createRecipeShareMediaService(dependencies),
    sharePairAsync,
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

  it('writes and cleans up two distinct temporary PNG files as a pair', async () => {
    const harness = createHarness();
    vi.mocked(harness.writePng)
      .mockResolvedValueOnce('file:///cache/instagram.png')
      .mockResolvedValueOnce('file:///cache/detail.png');

    const instagramUri = await harness.service.createPreviewUri(new Uint8Array([1]).buffer);
    const detailUri = await harness.service.createPreviewUri(new Uint8Array([2]).buffer);

    expect(instagramUri).not.toBe(detailUri);
    expect(instagramUri).toMatch(/^file:\/\/.+\.png$/);
    expect(detailUri).toMatch(/^file:\/\/.+\.png$/);

    await Promise.all([
      harness.service.cleanupPreviewUri(instagramUri),
      harness.service.cleanupPreviewUri(detailUri),
    ]);

    expect(harness.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('distinguishes retryable permission denial from settings-only denial', async () => {
    const retryHarness = createHarness();
    vi.mocked(retryHarness.mediaLibrary.requestPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
    });

    await expect(retryHarness.service.savePreview(
      'file:///cache/preview.png',
      'file:///cache/detail.png',
    )).rejects.toMatchObject({
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

    await expect(settingsHarness.service.savePreview(
      'file:///cache/preview.png',
      'file:///cache/detail.png',
    )).rejects.toMatchObject({
      code: 'permission-denied',
      retryable: false,
      canAskAgain: false,
      openSettings: true,
    });
  });

  it('reuses an exact FitTrack album and creates it only when the first lookup misses', async () => {
    const harness = createHarness();
    vi.mocked(harness.mediaLibrary.getAlbumAsync).mockResolvedValueOnce(null);
    await harness.service.savePreview('file:///cache/preview-1.png', 'file:///cache/detail-1.png');

    expect(harness.mediaLibrary.requestPermissionsAsync).toHaveBeenNthCalledWith(1, false, ['photo']);
    expect(harness.mediaLibrary.getAlbumAsync).toHaveBeenCalledWith(FITTRACK_ALBUM_NAME);
    expect(harness.mediaLibrary.createAlbumAsync).toHaveBeenCalledWith(
      FITTRACK_ALBUM_NAME,
      harness.createdAssets[0],
      true,
    );
    await harness.service.savePreview('file:///cache/preview-2.png', 'file:///cache/detail-2.png');

    expect(harness.mediaLibrary.requestPermissionsAsync).toHaveBeenNthCalledWith(2, false, ['photo']);
    expect(harness.mediaLibrary.createAlbumAsync).toHaveBeenCalledTimes(1);
    expect(harness.mediaLibrary.addAssetsToAlbumAsync).toHaveBeenNthCalledWith(
      2,
      harness.createdAssets[2],
      harness.album,
      true,
    );
    expect(harness.mediaLibrary.addAssetsToAlbumAsync).toHaveBeenNthCalledWith(
      3,
      harness.createdAssets[3],
      harness.album,
      true,
    );
  });

  it('rolls back both assets when adding the second image to an existing album fails', async () => {
    const harness = createHarness();
    vi.mocked(harness.mediaLibrary.addAssetsToAlbumAsync)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const failure = harness.service.savePreview('file:///cache/preview.png', 'file:///cache/detail.png');
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
      harness.createdAssets[0],
      harness.album,
    );
    expect(harness.mediaLibrary.removeAssetsFromAlbumAsync).toHaveBeenCalledTimes(1);
    expect(harness.mediaLibrary.deleteAssetsAsync).toHaveBeenNthCalledWith(1, harness.createdAssets[0]);
    expect(harness.mediaLibrary.deleteAssetsAsync).toHaveBeenNthCalledWith(2, harness.createdAssets[1]);
    expect(nativeShareMocks.open).not.toHaveBeenCalled();
  });

  it('rolls back an album created by the failed save attempt', async () => {
    const harness = createHarness();
    const createdAlbum = makeAlbum({ id: 'created-album', title: 'Unexpected title' });
    vi.mocked(harness.mediaLibrary.getAlbumAsync).mockResolvedValueOnce(null);
    vi.mocked(harness.mediaLibrary.createAlbumAsync).mockResolvedValueOnce(createdAlbum);

    await expect(harness.service.savePreview(
      'file:///cache/preview.png',
      'file:///cache/detail.png',
    )).rejects.toMatchObject({
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
      harness.createdAssets[0],
      createdAlbum,
    );
    expect(harness.mediaLibrary.deleteAlbumsAsync).toHaveBeenCalledWith(createdAlbum);
  });

  it('integrates the production native candidate with exactly one call containing both PNG URIs', async () => {
    const { createdAssets } = configureProductionMediaLibrary();
    const instagramUri = 'file:///cache/instagram.png';
    const detailUri = 'file:///cache/detail.png';
    nativeShareMocks.open.mockResolvedValueOnce({ success: true });
    const session = recipeShareMediaService.createSession(instagramUri, detailUri);

    await expect(session.share()).resolves.toMatchObject({ previewUri: instagramUri, detailUri });

    expect(nativeShareMocks.open).toHaveBeenCalledTimes(1);
    expect(nativeShareMocks.open).toHaveBeenCalledWith({ urls: [instagramUri, detailUri] });
    expect(createdAssets).toHaveLength(2);
    expect(ExpoMediaLibrary.createAssetAsync).toHaveBeenNthCalledWith(1, instagramUri);
    expect(ExpoMediaLibrary.createAssetAsync).toHaveBeenNthCalledWith(2, detailUri);
    expect(nativeShareMocks.deletedFiles).toEqual([instagramUri, detailUri]);
  });

  it('retries the production native pair without creating duplicate media assets', async () => {
    const { createdAssets } = configureProductionMediaLibrary();
    const instagramUri = 'file:///cache/retry-instagram.png';
    const detailUri = 'file:///cache/retry-detail.png';
    nativeShareMocks.open
      .mockRejectedValueOnce(new Error('share cancelled'))
      .mockResolvedValueOnce({ success: true });
    const session = recipeShareMediaService.createSession(instagramUri, detailUri);

    await expect(session.share()).rejects.toMatchObject({ code: 'share-failed' });
    expect(nativeShareMocks.deletedFiles).toEqual([]);
    await expect(session.share()).resolves.toMatchObject({ previewUri: instagramUri, detailUri });

    expect(nativeShareMocks.open).toHaveBeenCalledTimes(2);
    expect(nativeShareMocks.open).toHaveBeenNthCalledWith(1, { urls: [instagramUri, detailUri] });
    expect(nativeShareMocks.open).toHaveBeenNthCalledWith(2, { urls: [instagramUri, detailUri] });
    expect(createdAssets).toHaveLength(2);
    expect(ExpoMediaLibrary.createAssetAsync).toHaveBeenCalledTimes(2);
    expect(nativeShareMocks.deletedFiles).toEqual([instagramUri, detailUri]);
  });

  it('does not open a share sheet when sharing is unavailable and keeps the saved pair', async () => {
    const harness = createHarness();
    vi.mocked(harness.sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const session = harness.service.createSession('file:///cache/preview.png', 'file:///cache/detail.png');

    await expect(session.share()).rejects.toMatchObject({ code: 'sharing-unavailable' });
    expect(harness.mediaLibrary.createAssetAsync).toHaveBeenCalledTimes(2);
    expect(harness.sharePairAsync).not.toHaveBeenCalled();
    expect(harness.deleteFile).not.toHaveBeenCalled();
  });

  it('keeps both temporary URIs and reuses the saved pair after a cancelled share', async () => {
    const harness = createHarness();
    const instagramUri = 'file:///cache/preview.png';
    const detailUri = 'file:///cache/detail.png';
    vi.mocked(harness.sharePairAsync)
      .mockRejectedValueOnce(new Error('share cancelled'))
      .mockResolvedValueOnce(undefined);
    const session = harness.service.createSession(instagramUri, detailUri);

    await expect(session.share()).rejects.toMatchObject({ code: 'share-failed' });
    expect(harness.deleteFile).not.toHaveBeenCalled();

    await session.share();
    expect(harness.mediaLibrary.createAssetAsync).toHaveBeenCalledTimes(2);
    expect(harness.sharePairAsync).toHaveBeenNthCalledWith(2, [instagramUri, detailUri]);
    expect(harness.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('allows explicit cleanup after an unavailable share without touching saved media', async () => {
    const harness = createHarness();
    const instagramUri = 'file:///cache/preview.png';
    const detailUri = 'file:///cache/detail.png';
    vi.mocked(harness.sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const session = harness.service.createSession(instagramUri, detailUri);

    await expect(session.share()).rejects.toMatchObject({ code: 'sharing-unavailable' });
    await session.cleanup();

    expect(harness.deleteFile).toHaveBeenNthCalledWith(1, instagramUri);
    expect(harness.deleteFile).toHaveBeenNthCalledWith(2, detailUri);
    expect(harness.mediaLibrary.deleteAssetsAsync).not.toHaveBeenCalled();
  });
});

function configureProductionMediaLibrary() {
  const album = makeAlbum();
  const createdAssets: RecipeShareAsset[] = [];
  vi.mocked(ExpoMediaLibrary.isAvailableAsync).mockReset().mockResolvedValue(true);
  vi.mocked(ExpoMediaLibrary.requestPermissionsAsync).mockReset().mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted' as ExpoMediaLibrary.PermissionResponse['status'],
    expires: 'never',
  });
  vi.mocked(ExpoMediaLibrary.getAlbumAsync).mockReset().mockResolvedValue(album);
  vi.mocked(ExpoMediaLibrary.createAssetAsync).mockReset().mockImplementation(async (uri) => {
    const asset = makeAsset({ id: `native-asset-${createdAssets.length + 1}`, uri });
    createdAssets.push(asset);
    return asset;
  });
  vi.mocked(ExpoMediaLibrary.addAssetsToAlbumAsync).mockReset().mockResolvedValue(true);
  vi.mocked(ExpoMediaLibrary.createAlbumAsync).mockReset().mockResolvedValue(album);
  vi.mocked(ExpoMediaLibrary.removeAssetsFromAlbumAsync).mockReset().mockResolvedValue(true);
  vi.mocked(ExpoMediaLibrary.deleteAssetsAsync).mockReset().mockResolvedValue(true);
  vi.mocked(ExpoMediaLibrary.deleteAlbumsAsync).mockReset().mockResolvedValue(true);
  return { createdAssets };
}
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { openNativeMultiImageShareCandidate, validateLocalPngUris } from './nativeShareCandidate';

export const FITTRACK_ALBUM_NAME = 'FitTrack';

export type RecipeShareMediaErrorCode =
  | 'preview-file-write-failed'
  | 'cleanup-failed'
  | 'media-library-unavailable'
  | 'permission-denied'
  | 'album-lookup-failed'
  | 'asset-create-failed'
  | 'album-create-failed'
  | 'album-asset-failed'
  | 'sharing-unavailable'
  | 'share-failed';

export interface RecipeShareRollbackResult {
  attempted: boolean;
  assetRemovedFromAlbum: boolean;
  assetDeleted: boolean;
  albumDeleted: boolean;
  complete: boolean;
}

export class RecipeShareMediaError extends Error {
  readonly name = 'RecipeShareMediaError';
  readonly retryable: boolean;
  readonly canAskAgain: boolean | null;
  readonly openSettings: boolean;
  readonly rollback: RecipeShareRollbackResult | null;

  constructor(
    readonly code: RecipeShareMediaErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      canAskAgain?: boolean | null;
      openSettings?: boolean;
      rollback?: RecipeShareRollbackResult | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.retryable = options.retryable ?? true;
    this.canAskAgain = options.canAskAgain ?? null;
    this.openSettings = options.openSettings ?? false;
    this.rollback = options.rollback ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export type RecipeShareAlbum = MediaLibrary.Album;
export type RecipeShareAsset = MediaLibrary.Asset;

export interface RecipeShareFileSystem {
  writePng(png: Uint8Array): Promise<string> | string;
  delete(uri: string): Promise<void> | void;
}

export interface RecipeShareMediaLibrary {
  isAvailableAsync(): Promise<boolean>;
  requestPermissionsAsync(
    writeOnly?: boolean,
    granularPermissions?: MediaLibrary.GranularPermission[],
  ): Promise<Pick<MediaLibrary.PermissionResponse, 'granted' | 'canAskAgain'>>;
  getAlbumAsync(title: string): Promise<RecipeShareAlbum | null>;
  createAssetAsync(uri: string): Promise<RecipeShareAsset>;
  addAssetsToAlbumAsync(
    asset: RecipeShareAsset,
    album: RecipeShareAlbum,
    copy?: boolean,
  ): Promise<boolean>;
  createAlbumAsync(
    title: string,
    asset: RecipeShareAsset,
    copyAsset?: boolean,
  ): Promise<RecipeShareAlbum>;
  removeAssetsFromAlbumAsync(asset: RecipeShareAsset, album: RecipeShareAlbum): Promise<boolean>;
  deleteAssetsAsync(asset: RecipeShareAsset): Promise<boolean>;
  deleteAlbumsAsync(album: RecipeShareAlbum): Promise<boolean>;
}

export interface RecipeShareSharing {
  isAvailableAsync(): Promise<boolean>;
  sharePairAsync(urls: readonly [string, string]): Promise<void>;
}

export interface RecipeShareMediaDependencies {
  fileSystem: RecipeShareFileSystem;
  mediaLibrary: RecipeShareMediaLibrary;
  sharing: RecipeShareSharing;
}

export interface RecipeShareMediaSaveResult {
  previewUri: string;
  detailUri: string;
  asset: RecipeShareAsset;
  detailAsset: RecipeShareAsset;
  album: RecipeShareAlbum;
}

export interface RecipeShareMediaShareResult {
  previewUri: string;
  detailUri: string;
  saveResult: RecipeShareMediaSaveResult;
}

export interface RecipeShareMediaSession {
  readonly previewUri: string;
  readonly detailUri: string;
  save(): Promise<RecipeShareMediaSaveResult>;
  share(): Promise<RecipeShareMediaShareResult>;
  cleanup(): Promise<void>;
}

export interface RecipeShareMediaService {
  createPreviewUri(png: ArrayBuffer): Promise<string>;
  savePreview(previewUri: string, detailUri: string): Promise<RecipeShareMediaSaveResult>;
  createSession(previewUri: string, detailUri: string): RecipeShareMediaSession;
  cleanupPreviewUri(previewUri: string): Promise<void>;
}

const defaultFileSystem: RecipeShareFileSystem = {
  writePng: (png) => {
    const file = new FileSystem.File(
      FileSystem.Paths.cache,
      `fittrack-recipe-share-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
    );
    file.write(png);
    return file.uri;
  },
  delete: (uri) => {
    const file = new FileSystem.File(uri);
    if (file.exists) file.delete();
  },
};

const defaultMediaLibrary: RecipeShareMediaLibrary = {
  isAvailableAsync: () => MediaLibrary.isAvailableAsync(),
  requestPermissionsAsync: (writeOnly, granularPermissions) => (
    MediaLibrary.requestPermissionsAsync(writeOnly, granularPermissions)
  ),
  getAlbumAsync: async (title) => (await MediaLibrary.getAlbumAsync(title)) ?? null,
  createAssetAsync: (uri) => MediaLibrary.createAssetAsync(uri),
  addAssetsToAlbumAsync: (asset, album, copy) => MediaLibrary.addAssetsToAlbumAsync(asset, album, copy),
  createAlbumAsync: (title, asset, copyAsset) => MediaLibrary.createAlbumAsync(title, asset, copyAsset),
  removeAssetsFromAlbumAsync: (asset, album) => MediaLibrary.removeAssetsFromAlbumAsync(asset, album),
  deleteAssetsAsync: (asset) => MediaLibrary.deleteAssetsAsync(asset),
  deleteAlbumsAsync: (album) => MediaLibrary.deleteAlbumsAsync(album, false),
};

const defaultSharing: RecipeShareSharing = {
  isAvailableAsync: async () => Platform.OS === 'android',
  sharePairAsync: async (urls) => {
    if (Platform.OS !== 'android') {
      throw new Error('The native multi-image recipe share is available on Android only.');
    }

    const [previewUri, detailUri] = validateLocalPngUris(urls);
    const result = await openNativeMultiImageShareCandidate(previewUri, detailUri);
    if (!result.success) {
      throw new Error(result.message ?? 'Native multi-image share failed.');
    }
  },
};

const defaultDependencies: RecipeShareMediaDependencies = {
  fileSystem: defaultFileSystem,
  mediaLibrary: defaultMediaLibrary,
  sharing: defaultSharing,
};

function createError(
  code: RecipeShareMediaErrorCode,
  message: string,
  cause?: unknown,
  options: ConstructorParameters<typeof RecipeShareMediaError>[2] = {},
): RecipeShareMediaError {
  return new RecipeShareMediaError(code, message, { ...options, ...(cause !== undefined ? { cause } : {}) });
}

function validatePreviewPair(previewUri: string, detailUri: string): [string, string] {
  try {
    return validateLocalPngUris([previewUri, detailUri]);
  } catch (error) {
    throw createError(
      'share-failed',
      'Zum Teilen werden zwei unterschiedliche, lokal gespeicherte PNG-Bilder benötigt.',
      error,
    );
  }
}

async function rollbackAsset(
  dependencies: RecipeShareMediaDependencies,
  asset: RecipeShareAsset | null,
  album: RecipeShareAlbum | null,
  createdAlbum: boolean,
): Promise<RecipeShareRollbackResult> {
  if (!asset) {
    return {
      attempted: false,
      assetRemovedFromAlbum: true,
      assetDeleted: true,
      albumDeleted: true,
      complete: true,
    };
  }

  let assetRemovedFromAlbum = album == null;
  if (album) {
    try {
      assetRemovedFromAlbum = await dependencies.mediaLibrary.removeAssetsFromAlbumAsync(asset, album);
    } catch {
      assetRemovedFromAlbum = false;
    }
  }

  let assetDeleted = false;
  try {
    assetDeleted = await dependencies.mediaLibrary.deleteAssetsAsync(asset);
  } catch {
    assetDeleted = false;
  }

  let albumDeleted = !createdAlbum;
  if (createdAlbum && assetRemovedFromAlbum) {
    try {
      albumDeleted = await dependencies.mediaLibrary.deleteAlbumsAsync(album!);
    } catch {
      albumDeleted = false;
    }
  }

  return {
    attempted: true,
    assetRemovedFromAlbum,
    assetDeleted,
    albumDeleted,
    complete: assetRemovedFromAlbum && assetDeleted && albumDeleted,
  };
}

async function rollbackCreatedAssets(
  dependencies: RecipeShareMediaDependencies,
  assets: RecipeShareAsset[],
  assetsInAlbum: RecipeShareAsset[],
  album: RecipeShareAlbum | null,
  createdAlbum: boolean,
): Promise<RecipeShareRollbackResult> {
  if (assets.length === 0) {
    return {
      attempted: false,
      assetRemovedFromAlbum: true,
      assetDeleted: true,
      albumDeleted: true,
      complete: true,
    };
  }

  let assetRemovedFromAlbum = assetsInAlbum.length === 0 || album == null;
  if (album && assetsInAlbum.length > 0) {
    try {
      assetRemovedFromAlbum = await Promise.all(
        assetsInAlbum.map((asset) => dependencies.mediaLibrary.removeAssetsFromAlbumAsync(asset, album)),
      ).then((results) => results.every(Boolean));
    } catch {
      assetRemovedFromAlbum = false;
    }
  }

  let assetDeleted = false;
  try {
    assetDeleted = await Promise.all(
      assets.map((asset) => dependencies.mediaLibrary.deleteAssetsAsync(asset)),
    ).then((results) => results.every(Boolean));
  } catch {
    assetDeleted = false;
  }

  let albumDeleted = !createdAlbum;
  if (createdAlbum && assetRemovedFromAlbum) {
    try {
      albumDeleted = await dependencies.mediaLibrary.deleteAlbumsAsync(album!);
    } catch {
      albumDeleted = false;
    }
  }

  return {
    attempted: true,
    assetRemovedFromAlbum,
    assetDeleted,
    albumDeleted,
    complete: assetRemovedFromAlbum && assetDeleted && albumDeleted,
  };
}

function withRollback(
  error: unknown,
  fallbackCode: RecipeShareMediaErrorCode,
  rollback: RecipeShareRollbackResult,
): RecipeShareMediaError {
  if (error instanceof RecipeShareMediaError) {
    return new RecipeShareMediaError(error.code, error.message, {
      retryable: error.retryable,
      canAskAgain: error.canAskAgain,
      openSettings: error.openSettings,
      rollback,
      cause: error,
    });
  }
  return createError(fallbackCode, 'Die Bilder konnten nicht im Album FitTrack gespeichert werden.', error, {
    rollback,
  });
}

export function createRecipeShareMediaService(
  dependencies: RecipeShareMediaDependencies = defaultDependencies,
): RecipeShareMediaService {
  const cleanedPreviewUris = new Set<string>();

  const createPreviewUri = async (png: ArrayBuffer): Promise<string> => {
    try {
      return await dependencies.fileSystem.writePng(new Uint8Array(png));
    } catch (error) {
      throw createError('preview-file-write-failed', 'Die temporäre Vorschau konnte nicht gespeichert werden.', error);
    }
  };

  const cleanupPreviewUri = async (previewUri: string): Promise<void> => {
    if (cleanedPreviewUris.has(previewUri)) return;
    try {
      await dependencies.fileSystem.delete(previewUri);
      cleanedPreviewUris.add(previewUri);
    } catch (error) {
      throw createError('cleanup-failed', 'Die temporäre Vorschau konnte nicht bereinigt werden.', error);
    }
  };

  const savePreview = async (previewUri: string, detailUri: string): Promise<RecipeShareMediaSaveResult> => {
    const targetUris = validatePreviewPair(previewUri, detailUri);

    let permission: Pick<MediaLibrary.PermissionResponse, 'granted' | 'canAskAgain'>;
    try {
      permission = await dependencies.mediaLibrary.requestPermissionsAsync(false, ['photo']);
    } catch (error) {
      throw createError('permission-denied', 'Der Zugriff auf die Fotomediathek konnte nicht erteilt werden.', error);
    }

    if (!permission.granted) {
      throw new RecipeShareMediaError(
        'permission-denied',
        permission.canAskAgain
          ? 'Der Zugriff auf die Fotomediathek wurde nicht erteilt.'
          : 'Der Zugriff auf die Fotomediathek muss in den Geräteeinstellungen erteilt werden.',
        {
          retryable: permission.canAskAgain,
          canAskAgain: permission.canAskAgain,
          openSettings: !permission.canAskAgain,
        },
      );
    }

    try {
      if (!(await dependencies.mediaLibrary.isAvailableAsync())) {
        throw createError('media-library-unavailable', 'Die Fotomediathek ist auf diesem Gerät nicht verfügbar.');
      }
    } catch (error) {
      if (error instanceof RecipeShareMediaError) throw error;
      throw createError('media-library-unavailable', 'Die Fotomediathek ist auf diesem Gerät nicht verfügbar.', error);
    }

    let album: RecipeShareAlbum | null = null;
    try {
      album = await dependencies.mediaLibrary.getAlbumAsync(FITTRACK_ALBUM_NAME);
      if (album && album.title !== FITTRACK_ALBUM_NAME) {
        throw new Error('The media library returned an album with a different title.');
      }
    } catch (error) {
      throw createError('album-lookup-failed', 'Das Album FitTrack konnte nicht gefunden werden.', error);
    }

    const createdAssets: RecipeShareAsset[] = [];
    const assetsInAlbum: RecipeShareAsset[] = [];
    let createdAlbum = false;
    try {
      for (let index = 0; index < targetUris.length; index += 1) {
        const uri = targetUris[index];
        const asset = await dependencies.mediaLibrary.createAssetAsync(uri);
        createdAssets.push(asset);

        if (album) {
          const added = await dependencies.mediaLibrary.addAssetsToAlbumAsync(asset, album, true);
          if (!added) {
            throw createError('album-asset-failed', 'Das Bild konnte dem Album FitTrack nicht hinzugefügt werden.');
          }
          assetsInAlbum.push(asset);
        } else if (index === 0) {
          album = await dependencies.mediaLibrary.createAlbumAsync(FITTRACK_ALBUM_NAME, asset, true);
          createdAlbum = true;
          assetsInAlbum.push(asset);
          if (album.title !== FITTRACK_ALBUM_NAME) {
            throw createError('album-create-failed', 'Das Album FitTrack konnte nicht exakt angelegt werden.');
          }
        }
      }

      const [primaryAsset, detailAsset] = createdAssets;
      if (!primaryAsset || !detailAsset) {
        throw createError('asset-create-failed', 'Beide Bilder konnten nicht in der Fotomediathek gespeichert werden.');
      }

      return {
        previewUri,
        detailUri,
        asset: primaryAsset,
        detailAsset,
        album: album!,
      };
    } catch (error) {
      const rollback = await rollbackCreatedAssets(dependencies, createdAssets, assetsInAlbum, album, createdAlbum);
      throw withRollback(error, 'asset-create-failed', rollback);
    }
  };

  const createSession = (previewUri: string, detailUri: string): RecipeShareMediaSession => {
    const shareUris = [previewUri, detailUri];
    let savePromise: Promise<RecipeShareMediaSaveResult> | null = null;
    let cleaned = false;

    const save = (): Promise<RecipeShareMediaSaveResult> => {
      if (cleaned) {
        return Promise.reject(createError('cleanup-failed', 'Die temporäre Vorschau wurde bereits bereinigt.'));
      }
      if (!savePromise) {
        savePromise = savePreview(previewUri, detailUri).catch((error: unknown) => {
          savePromise = null;
          throw error;
        });
      }
      return savePromise;
    };

    const share = async (): Promise<RecipeShareMediaShareResult> => {
      const saveResult = await save();

      let available: boolean;
      try {
        available = await dependencies.sharing.isAvailableAsync();
      } catch (error) {
        throw createError('share-failed', 'Das Teilen konnte nicht vorbereitet werden.', error);
      }
      if (!available) {
        throw createError(
          'sharing-unavailable',
          'Auf diesem Gerät ist kein Teilen verfügbar.',
          undefined,
          { retryable: true },
        );
      }

      try {
        await dependencies.sharing.sharePairAsync(
          validatePreviewPair(saveResult.previewUri, saveResult.detailUri),
        );
      } catch (error) {
        throw createError('share-failed', 'Das Teilen konnte nicht abgeschlossen werden.', error);
      }

      await cleanup();
      return {
        previewUri: saveResult.previewUri,
        detailUri: saveResult.detailUri,
        saveResult,
      };
    };

    const cleanup = async (): Promise<void> => {
      if (cleaned) return;
      const results = await Promise.allSettled(shareUris.map((uri) => cleanupPreviewUri(uri)));
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      cleaned = true;
    };

    return { previewUri, detailUri, save, share, cleanup };
  };

  return { createPreviewUri, savePreview, createSession, cleanupPreviewUri };
}

export const recipeShareMediaService = createRecipeShareMediaService();
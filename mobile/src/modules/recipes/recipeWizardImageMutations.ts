import type { RecipeImage } from '@fittrack/shared';
import type { WizardImageDraft } from './recipeWizardTypes';

export interface RecipeImageMutationApi {
  deleteImage(recipeId: string, imageId: string): Promise<void>;
  uploadImage(recipeId: string, imageUri: string, mimeType: 'image/jpeg' | 'image/png'): Promise<RecipeImage>;
  reorderImages(recipeId: string, imageIds: string[]): Promise<{ images: RecipeImage[] }>;
}

export interface RecipeWizardImageMutationResult {
  failedDeleteImageIds: string[];
  failedUploadPositions: number[];
  reorderFailed: boolean;
}

function orderedImageIds(images: RecipeImage[]): string[] {
  return [...images]
    .sort((left, right) => left.order - right.order)
    .map((image) => image.id);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function persistRecipeWizardImages(
  recipeId: string,
  initialImageIds: string[],
  imageDrafts: WizardImageDraft[],
  api: RecipeImageMutationApi,
): Promise<RecipeWizardImageMutationResult> {
  const result: RecipeWizardImageMutationResult = {
    failedDeleteImageIds: [],
    failedUploadPositions: [],
    reorderFailed: false,
  };

  const remainingExistingImageIds = new Set(
    imageDrafts
      .filter((image): image is Extract<WizardImageDraft, { source: 'existing' }> => image.source === 'existing')
      .map((image) => image.imageId),
  );
  let serverImageIds = [...initialImageIds];

  for (const imageId of initialImageIds) {
    if (remainingExistingImageIds.has(imageId)) continue;
    try {
      await api.deleteImage(recipeId, imageId);
      serverImageIds = serverImageIds.filter((serverImageId) => serverImageId !== imageId);
    } catch (err) {
      console.error(`[RecipeWizard] Image delete ${imageId} failed:`, err);
      result.failedDeleteImageIds.push(imageId);
    }
  }

  const knownServerImageIds = new Set(serverImageIds);
  const uploadedImageIdsByDraftId = new Map<string, string>();
  const localDrafts = imageDrafts.filter((image): image is Extract<WizardImageDraft, { source: 'local' }> => image.source === 'local');

  for (let index = 0; index < localDrafts.length; index += 1) {
    const image = localDrafts[index]!;
    try {
      const uploadedImage = await api.uploadImage(recipeId, image.uri, image.mime);
      if (!knownServerImageIds.has(uploadedImage.id)) {
        serverImageIds = [...serverImageIds, uploadedImage.id];
        knownServerImageIds.add(uploadedImage.id);
        uploadedImageIdsByDraftId.set(image.draftId, uploadedImage.id);
      } else {
        result.failedUploadPositions.push(index + 1);
      }
    } catch (err) {
      console.error(`[RecipeWizard] Image upload ${index + 1} failed:`, err);
      result.failedUploadPositions.push(index + 1);
    }
  }

  const desiredImageIds = imageDrafts
    .map((image) => image.source === 'existing'
      ? image.imageId
      : uploadedImageIdsByDraftId.get(image.draftId))
    .filter((imageId): imageId is string => imageId != null && knownServerImageIds.has(imageId));
  const completeImageOrder = [
    ...desiredImageIds,
    ...serverImageIds.filter((imageId) => !desiredImageIds.includes(imageId)),
  ];

  if (completeImageOrder.length > 1 && !arraysEqual(serverImageIds, completeImageOrder)) {
    try {
      const reorderResponse = await api.reorderImages(recipeId, completeImageOrder);
      serverImageIds = orderedImageIds(reorderResponse.images);
    } catch (err) {
      console.error('[RecipeWizard] Image reorder failed:', err);
      result.reorderFailed = true;
    }
  }

  return result;
}
// imageService — image picker and upload via backend proxy.
// No Azure Blob credentials on device — upload goes through /api/recipes/:id/image.
// Full implementation in M5. Stub only.

export const imageService = {
  /**
   * Pick an image from the device library and upload it to the backend.
   * Returns the blob storage path returned by the backend.
   * Implemented in M5.
   */
  async pickAndUpload(_recipeId: string): Promise<string> {
    throw new Error('imageService.pickAndUpload — not implemented until M5');
  },
};

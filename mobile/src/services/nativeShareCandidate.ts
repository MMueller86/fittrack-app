import Share from 'react-native-share';

export type NativeShareCandidateResult = {
  urls: [string, string];
  success: boolean;
  message?: string;
};

export function validateLocalPngUris(candidateUris: readonly string[]): [string, string] {
  if (!Array.isArray(candidateUris) || candidateUris.length !== 2) {
    throw new Error('Exactly two local PNG URIs are required for the Android multi-image share candidate.');
  }

  const validateUri = (candidateUri: unknown, index: number): string => {
    if (typeof candidateUri !== 'string' || candidateUri.trim() === '') {
      throw new Error(`PNG URI ${index + 1} is empty or not a string.`);
    }

    const uri = candidateUri.trim();
    if (!/^(file|content):\/\//i.test(uri)) {
      throw new Error(`PNG URI ${index + 1} must be a local PNG URI, not ${uri}.`);
    }

    if (!uri.toLowerCase().endsWith('.png')) {
      throw new Error(`PNG URI ${index + 1} must point to a local PNG asset.`);
    }

    return uri;
  };

  const firstUri = validateUri(candidateUris[0], 0);
  const secondUri = validateUri(candidateUris[1], 1);
  if (firstUri === secondUri) {
    throw new Error('The two local PNG URIs must be distinct.');
  }

  return [firstUri, secondUri];
}

export async function openNativeMultiImageShareCandidate(
  firstUri: string,
  secondUri: string,
): Promise<NativeShareCandidateResult> {
  const urls = validateLocalPngUris([firstUri, secondUri]);

  const response = await Share.open({ urls });

  return {
    urls,
    success: response?.success !== false,
    message: response?.message,
  };
}

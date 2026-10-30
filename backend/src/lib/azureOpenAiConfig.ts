// Single source for Azure OpenAI deployment name and API version.
// Env var names are unchanged; the defaults match the deployed Alpha/Dev deployment.

export const DEFAULT_AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4.1-mini';

// 2024-10-21 is the latest GA data-plane version and supports Structured Outputs.
export const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-10-21';

export function getAzureOpenAiDeploymentName(): string {
  return process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? DEFAULT_AZURE_OPENAI_DEPLOYMENT_NAME;
}

export function getAzureOpenAiApiVersion(): string {
  return process.env['AZURE_OPENAI_API_VERSION'] ?? DEFAULT_AZURE_OPENAI_API_VERSION;
}

export function createAzureOpenAiClientOptions(): { endpoint: string; apiKey: string; apiVersion: string } {
  const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
  const apiKey = process.env['AZURE_OPENAI_API_KEY'];
  if (!endpoint || !apiKey) {
    throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set');
  }
  return { endpoint, apiKey, apiVersion: getAzureOpenAiApiVersion() };
}

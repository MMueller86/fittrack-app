import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AZURE_OPENAI_API_VERSION,
  DEFAULT_AZURE_OPENAI_DEPLOYMENT_NAME,
  createAzureOpenAiClientOptions,
  getAzureOpenAiApiVersion,
  getAzureOpenAiDeploymentName,
} from './azureOpenAiConfig';

const KEYS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
] as const;

describe('azureOpenAiConfig', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('defaults to the real gpt-4.1-mini deployment, not the legacy gpt4o-mini name', () => {
    expect(getAzureOpenAiDeploymentName()).toBe('gpt-4.1-mini');
    expect(DEFAULT_AZURE_OPENAI_DEPLOYMENT_NAME).toBe('gpt-4.1-mini');
  });

  it('defaults to the GA API version 2024-10-21', () => {
    expect(getAzureOpenAiApiVersion()).toBe('2024-10-21');
    expect(DEFAULT_AZURE_OPENAI_API_VERSION).toBe('2024-10-21');
  });

  it('prefers the environment variables over the defaults', () => {
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'custom-deployment';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-08-01-preview';
    expect(getAzureOpenAiDeploymentName()).toBe('custom-deployment');
    expect(getAzureOpenAiApiVersion()).toBe('2024-08-01-preview');
  });

  it('builds client options from env and fails when endpoint or key is missing', () => {
    expect(() => createAzureOpenAiClientOptions()).toThrow(
      'AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set',
    );
    process.env['AZURE_OPENAI_ENDPOINT'] = 'https://example.invalid';
    process.env['AZURE_OPENAI_API_KEY'] = 'test-key';
    expect(createAzureOpenAiClientOptions()).toEqual({
      endpoint: 'https://example.invalid',
      apiKey: 'test-key',
      apiVersion: '2024-10-21',
    });
  });
});

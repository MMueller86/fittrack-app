import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({
  isLocked: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../lib/repositories/profileDeletionRepository', () => ({
  isProfileDeletionInProgress: mocks.isLocked,
}));

vi.mock('../lib/repositories/reusableItemsRepository', () => ({
  getReusableItemsRepository: () => ({ getById: mocks.getById, update: mocks.update }),
}));

import { reusableItemsEnrichHandler } from './reusableItemsEnrich';

const originalEnv = {
  endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
  apiKey: process.env['AZURE_OPENAI_API_KEY'],
  apiVersion: process.env['AZURE_OPENAI_API_VERSION'],
  deployment: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
};

let server: Server;
let address: AddressInfo;
let requestHandler: (request: IncomingMessage, response: ServerResponse) => void;

beforeAll(async () => {
  server = createServer((request, response) => requestHandler(request, response));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  address = server.address() as AddressInfo;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const [key, value] of Object.entries({
    AZURE_OPENAI_ENDPOINT: originalEnv.endpoint,
    AZURE_OPENAI_API_KEY: originalEnv.apiKey,
    AZURE_OPENAI_API_VERSION: originalEnv.apiVersion,
    AZURE_OPENAI_DEPLOYMENT_NAME: originalEnv.deployment,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
  process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
  process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
  process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'enrichment-deployment';
  mocks.isLocked.mockResolvedValue(false);
  mocks.getById.mockResolvedValue({ id: 'item-1', userId: 'user-1', name: 'Haferflocken', searchTerms: ['haferflocken'] });
  mocks.update.mockResolvedValue(null);
});

describe('reusable item enrichment Azure OpenAI wire contract', () => {
  it('uses the real AzureOpenAI client with the configured deployment and authentication', async () => {
    let capturedRequest: IncomingMessage | undefined;
    let requestBody = '';
    requestHandler = (request, response) => {
      capturedRequest = request;
      request.on('data', (chunk: Buffer) => { requestBody += chunk.toString('utf8'); });
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          id: 'chatcmpl-wire-test',
          object: 'chat.completion',
          created: 1,
          model: 'enrichment-deployment',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '["hafer","vollkorn"]' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }));
      });
    };

    await reusableItemsEnrichHandler(
      { userId: 'user-1', itemId: 'item-1' },
      { log: vi.fn() } as never,
    );

    expect(capturedRequest?.method).toBe('POST');
    expect(capturedRequest?.url).toContain('/openai/deployments/enrichment-deployment/chat/completions');
    expect(capturedRequest?.url).toContain('api-version=2024-07-01');
    expect(capturedRequest?.headers['api-key']).toBe('wire-test-key');
    expect(JSON.parse(requestBody)).toMatchObject({ model: 'enrichment-deployment' });
    expect(mocks.update).toHaveBeenCalledWith('user-1', 'item-1', {
      searchTerms: ['haferflocken', 'hafer', 'vollkorn'],
      aiKeywords: ['hafer', 'vollkorn'],
      searchTermsEnriched: true,
    });
  });
});
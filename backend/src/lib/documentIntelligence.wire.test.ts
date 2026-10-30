import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import { __setDocumentIntelligenceClientForTests, extractTextFromImage } from './documentIntelligence';
import { __setLabelParserClientForTests, parseNutritionLabel } from './labelParser';

const originalEnv = {
  endpoint: process.env['AZURE_DI_ENDPOINT'],
  key: process.env['AZURE_DI_KEY'],
  openAiEndpoint: process.env['AZURE_OPENAI_ENDPOINT'],
  openAiKey: process.env['AZURE_OPENAI_API_KEY'],
  openAiVersion: process.env['AZURE_OPENAI_API_VERSION'],
  openAiDeployment: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
};

let server: Server;
let address: AddressInfo;
let startRequest: IncomingMessage | undefined;
let pollRequests = 0;
let capturedAiRequest: Record<string, unknown> | undefined;

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method === 'POST' && request.url?.startsWith('/openai/deployments/label-wire/chat/completions')) {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        capturedAiRequest = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        sendJson(response, 200, {
          id: 'chatcmpl-wire-test',
          object: 'chat.completion',
          created: 1,
          model: 'label-wire',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({
            productName: 'Synthetisches Etikett',
            brand: null,
            baseUnit: '100g',
            servingSize: null,
            nutrition: { calories: 240, protein: 10, carbs: 40, sugar: 2, fat: 4, saturatedFat: 1, fiber: 6, salt: 0.8 },
            confidence: 0.9,
            warnings: [],
          }) } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      });
      return;
    }

    if (request.method === 'POST' && request.url?.includes('/formrecognizer/documentModels/prebuilt-read:analyze')) {
      startRequest = request;
      request.resume();
      request.on('end', () => sendJson(response, 202, { status: 'running' }, {
        'operation-location': `http://127.0.0.1:${address.port}/formrecognizer/documentModels/prebuilt-read/analyzeResults/wire-operation?api-version=2023-07-31`,
      }));
      return;
    }

    if (request.method === 'GET') {
      pollRequests += 1;
      sendJson(response, 200, {
        status: 'succeeded',
        analyzeResult: {
          apiVersion: '2023-07-31',
          modelId: 'prebuilt-read',
          content: 'Eiweiß (g) 8,35 23',
          pages: [{
            pageNumber: 1,
            width: 100,
            height: 100,
            unit: 'pixel',
            lines: [
              { content: 'Eiweiß (g)', polygon: [5, 10, 40, 10, 40, 14, 5, 14], spans: [{ offset: 0, length: 10 }] },
              { content: '8,35', polygon: [60, 10, 72, 10, 72, 14, 60, 14], spans: [{ offset: 11, length: 4 }] },
              { content: '23', polygon: [85, 10, 92, 10, 92, 14, 85, 14], spans: [{ offset: 16, length: 2 }] },
            ],
            words: [{ content: 'Eiweiß', confidence: 0.9 }, { content: '8,35', confidence: 0.8 }],
          }],
        },
      });
      return;
    }

    response.writeHead(404).end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  address = server.address() as AddressInfo;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalEnv.endpoint === undefined) delete process.env['AZURE_DI_ENDPOINT'];
  else process.env['AZURE_DI_ENDPOINT'] = originalEnv.endpoint;
  if (originalEnv.key === undefined) delete process.env['AZURE_DI_KEY'];
  else process.env['AZURE_DI_KEY'] = originalEnv.key;
  if (originalEnv.openAiEndpoint === undefined) delete process.env['AZURE_OPENAI_ENDPOINT'];
  else process.env['AZURE_OPENAI_ENDPOINT'] = originalEnv.openAiEndpoint;
  if (originalEnv.openAiKey === undefined) delete process.env['AZURE_OPENAI_API_KEY'];
  else process.env['AZURE_OPENAI_API_KEY'] = originalEnv.openAiKey;
  if (originalEnv.openAiVersion === undefined) delete process.env['AZURE_OPENAI_API_VERSION'];
  else process.env['AZURE_OPENAI_API_VERSION'] = originalEnv.openAiVersion;
  if (originalEnv.openAiDeployment === undefined) delete process.env['AZURE_OPENAI_DEPLOYMENT_NAME'];
  else process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = originalEnv.openAiDeployment;
});

afterEach(() => {
  __setDocumentIntelligenceClientForTests(null);
  __setLabelParserClientForTests(null);
  startRequest = undefined;
  pollRequests = 0;
  capturedAiRequest = undefined;
});

describe('Azure Document Intelligence SDK wire contract', () => {
  it('starts prebuilt-read, polls the operation and reconstructs synthetic table rows', async () => {
    process.env['AZURE_DI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_DI_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'label-wire';
    __setDocumentIntelligenceClientForTests(new DocumentAnalysisClient(
      process.env['AZURE_DI_ENDPOINT'],
      new AzureKeyCredential(process.env['AZURE_DI_KEY']),
      { allowInsecureConnection: true },
    ));

    const result = await extractTextFromImage(Buffer.from('synthetic nutrition label fixture'));
    const parsedLabel = await parseNutritionLabel(result.rawText);

    expect(startRequest?.method).toBe('POST');
    expect(startRequest?.url).toContain('/formrecognizer/documentModels/prebuilt-read:analyze');
    expect(startRequest?.headers['ocp-apim-subscription-key']).toBe('wire-test-key');
    expect(pollRequests).toBeGreaterThan(0);
    expect(result).toEqual({ rawText: 'Eiweiß (g)\t8,35\t23', confidence: 0.85 });
    expect(parsedLabel).toMatchObject({ productName: 'Synthetisches Etikett', nutrition: { calories: 240 }, aiConfidence: 0.9 });
    expect((capturedAiRequest?.messages as Array<{ role: string; content: string }>)[1]?.content).toBe(result.rawText);
    expect(capturedAiRequest?.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'nutrition_label_scan', strict: true } });
  });
});
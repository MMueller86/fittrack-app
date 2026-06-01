import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

import { labelScanHandler } from './labelScan';
import { __setDocumentIntelligenceClientForTests } from '../lib/documentIntelligence';
import { __setLabelParserClientForTests } from '../lib/labelParser';
import { makeContext, setupTestAuth, teardownTestAuth, signTestToken } from '../test-utils/http';
import type { HttpRequest } from '@azure/functions';

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GERMAN_LABEL_OCR_TEXT = `Nährwertangaben
pro 100g
Brennwert 1567 kJ / 374 kcal
Fett 8,5 g
davon gesättigte Fettsäuren 1,1 g
Kohlenhydrate 60 g
davon Zucker 3,2 g
Eiweiß 13 g
Ballaststoffe 6,3 g
Salz 1,2 g`;

const LABEL_AI_RESPONSE = {
  productName: 'Vollkornbrot',
  brand: null,
  baseUnit: '100g',
  servingSize: null,
  nutrition: {
    calories: 374,
    protein: 13,
    carbs: 60,
    sugar: 3.2,
    fat: 8.5,
    saturatedFat: 1.1,
    fiber: 6.3,
    salt: 1.2,
  },
  confidence: 0.92,
  warnings: [],
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeDiMock(rawText: string, confidence = 0.95) {
  return {
    beginAnalyzeDocument: vi.fn().mockResolvedValue({
      pollUntilDone: vi.fn().mockResolvedValue({
        pages: [
          {
            lines: rawText.split('\n').map(line => ({
              content: line,
              spans: [{}],
            })),
          },
        ],
        paragraphs: rawText.split('\n').map(line => ({ content: line })),
        tables: [],
      }),
    }),
  };
}

function makeOpenAiMock(response: object) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(response) } }],
        }),
      },
    },
  };
}

function makeMultipartRequest(
  imageBuffer: Buffer,
  contentType: string,
  token: string,
): HttpRequest {
  const blob = new Blob([imageBuffer], { type: contentType });
  const formDataMap = new Map<string, Blob | string>();
  formDataMap.set('image', blob);

  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'authorization') return `Bearer ${token}`;
        if (name.toLowerCase() === 'content-type') return 'multipart/form-data';
        return null;
      },
    },
    formData: async () => ({
      get: (key: string) => formDataMap.get(key) ?? null,
    }),
    params: {},
  } as unknown as HttpRequest;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setDocumentIntelligenceClientForTests(makeDiMock(GERMAN_LABEL_OCR_TEXT) as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setLabelParserClientForTests(makeOpenAiMock(LABEL_AI_RESPONSE) as any);
});

afterEach(() => {
  __setDocumentIntelligenceClientForTests(null);
  __setLabelParserClientForTests(null);
});

// ---------------------------------------------------------------------------
// Auth tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/label-scan — auth', () => {
  it('returns 401 without auth header', async () => {
    const req = makeMultipartRequest(Buffer.from('fake-image'), 'image/jpeg', '');
    // Override the header to not have authorization
    (req as any).headers = {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return 'multipart/form-data';
        return null;
      },
    };
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/ai/label-scan — input validation', () => {
  it('returns 400 when image field is missing', async () => {
    const token = await signTestToken();
    const req = {
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'authorization') return `Bearer ${token}`;
          return null;
        },
      },
      formData: async () => ({
        get: () => null,
      }),
      params: {},
    } as unknown as HttpRequest;

    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain('image');
  });

  it('returns 400 for unsupported content type', async () => {
    const token = await signTestToken();
    const req = makeMultipartRequest(Buffer.from('gif-data'), 'image/gif', token);
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain('Unsupported image type');
  });

  it('returns 400 when image exceeds 4 MB', async () => {
    const token = await signTestToken();
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024); // 5 MB
    const req = makeMultipartRequest(bigBuffer, 'image/jpeg', token);
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain('exceeds maximum size');
  });
});

// ---------------------------------------------------------------------------
// OCR failure
// ---------------------------------------------------------------------------

describe('POST /api/ai/label-scan — OCR failure', () => {
  it('returns 422 when OCR extracts no text', async () => {
    // Override DI mock to return empty text
    const emptyDiMock = {
      beginAnalyzeDocument: vi.fn().mockResolvedValue({
        pollUntilDone: vi.fn().mockResolvedValue({
          pages: [{ lines: [] }],
          paragraphs: [],
          tables: [],
        }),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __setDocumentIntelligenceClientForTests(emptyDiMock as any);

    const token = await signTestToken();
    const req = makeMultipartRequest(Buffer.from('dark-image'), 'image/jpeg', token);
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(422);
    expect((res.jsonBody as any).error).toContain('extract text');
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('POST /api/ai/label-scan — success', () => {
  it('returns 200 with full NutritionLabelScanResult', async () => {
    const token = await signTestToken();
    const req = makeMultipartRequest(Buffer.from('jpeg-image-bytes'), 'image/jpeg', token);
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(200);

    const body = res.jsonBody as any;
    expect(body.productName).toBe('Vollkornbrot');
    expect(body.baseUnit).toBe('100g');
    expect(body.nutrition.calories).toBe(374);
    expect(body.nutrition.protein).toBe(13);
    expect(body.nutrition.carbs).toBe(60);
    expect(body.nutrition.fat).toBe(8.5);
    expect(body.nutrition.sugar).toBe(3.2);
    expect(body.nutrition.saturatedFat).toBe(1.1);
    expect(body.nutrition.fiber).toBe(6.3);
    expect(body.nutrition.salt).toBe(1.2);
    expect(body.ocrConfidence).toBeGreaterThan(0);
    expect(body.aiConfidence).toBe(0.92);
    expect(body.rawOcrText).toContain('Brennwert');
    expect(body.warnings).toEqual([]);
  });

  it('returns 200 with PNG image', async () => {
    const token = await signTestToken();
    const req = makeMultipartRequest(Buffer.from('png-image-bytes'), 'image/png', token);
    const res = await labelScanHandler(req, makeContext());
    expect(res.status).toBe(200);
  });
});

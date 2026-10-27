import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  __setOpenAiClientForTests,
  analyzeRecipeText,
  estimateFood,
  estimateFoodBatch,
  estimateMeal,
  generateDailyInsight,
  generateWeeklyInsight,
  parseMeal,
  prepareRecipeExport,
  scaleRecipeText,
} from './openai';
import { __setLabelParserClientForTests, parseNutritionLabel } from './labelParser';
import type { InsightInputContext } from '@fittrack/shared';
import type { WeeklyInsightPromptContext } from './prompts/weeklyInsightV2';

const originalEnv = {
  endpoint: process.env['AZURE_OPENAI_ENDPOINT'],
  apiKey: process.env['AZURE_OPENAI_API_KEY'],
  apiVersion: process.env['AZURE_OPENAI_API_VERSION'],
  deployment: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
};

let server: Server;
let address: AddressInfo;
let requestHandler: (request: IncomingMessage, response: ServerResponse) => void;

function sendCompletion(response: ServerResponse, content: string, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({
    id: 'chatcmpl-wire-test',
    object: 'chat.completion',
    created: 1,
    model: 'wire-deployment',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

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
});

afterEach(() => {
  __setOpenAiClientForTests(null);
  __setLabelParserClientForTests(null);
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

describe('Azure OpenAI SDK wire contract', () => {
  it('sends the real SDK request to the configured deployment with strict output and Azure auth', async () => {
    let capturedRequest: IncomingMessage | undefined;
    let capturedBody: Record<string, unknown> | undefined;
    requestHandler = (request, response) => {
      capturedRequest = request;
      void readJson(request).then((body) => {
        capturedBody = body;
        sendCompletion(response, JSON.stringify({ items: [{
          rawText: '200 g Hähnchen',
          displayName: 'Hähnchen',
          inputMode: 'grams',
          inputAmount: 200,
        }] }));
      }, (error: unknown) => {
        response.writeHead(400).end(String(error));
      });
    };

    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'wire-deployment';

    await expect(parseMeal('200 g Hähnchen')).resolves.toEqual([{
      rawText: '200 g Hähnchen',
      displayName: 'Hähnchen',
      inputMode: 'grams',
      inputAmount: 200,
    }]);

    expect(capturedRequest?.method).toBe('POST');
    expect(capturedRequest?.url).toContain('/openai/deployments/wire-deployment/chat/completions');
    expect(capturedRequest?.url).toContain('api-version=2024-07-01');
    expect(capturedRequest?.headers['api-key']).toBe('wire-test-key');
    expect(capturedBody).toMatchObject({
      model: 'wire-deployment',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'parsed_meal', strict: true },
      },
    });
  });

  it('sends label parsing through its real AzureOpenAI client and strict schema', async () => {
    let capturedRequest: IncomingMessage | undefined;
    requestHandler = (request, response) => {
      capturedRequest = request;
      void readJson(request).then(() => sendCompletion(response, JSON.stringify({
        productName: 'Haferbrot',
        brand: null,
        baseUnit: '100g',
        servingSize: null,
        nutrition: { calories: 240, protein: 10, carbs: 40, sugar: 2, fat: 4, saturatedFat: 1, fiber: 6, salt: 0.8 },
        confidence: 0.9,
        warnings: [],
      })));
    };

    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'label-deployment';

    await expect(parseNutritionLabel('Brennwert 240 kcal')).resolves.toMatchObject({
      productName: 'Haferbrot',
      aiConfidence: 0.9,
      nutrition: { calories: 240 },
    });

    expect(capturedRequest?.url).toContain('/openai/deployments/label-deployment/chat/completions');
    expect(capturedRequest?.url).toContain('api-version=2024-07-01');
    expect(capturedRequest?.headers['api-key']).toBe('wire-test-key');
  });

  it.each([
    { status: 400, expectedCalls: 1 },
    { status: 429, expectedCalls: 3 },
    { status: 500, expectedCalls: 3 },
  ])('observes SDK retry behavior for HTTP $status', async ({ status, expectedCalls }) => {
    let requestCount = 0;
    requestHandler = async (_request, response) => {
      requestCount += 1;
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'synthetic wire failure', type: 'server_error' } }));
    };

    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'wire-deployment';

    await expect(parseMeal('Testmahlzeit')).rejects.toThrow();
    expect(requestCount).toBe(expectedCalls);
  });

  it('does not retry a successful HTTP response with empty model content', async () => {
    let requestCount = 0;
    requestHandler = async (_request, response) => {
      requestCount += 1;
      sendCompletion(response, '');
    };

    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';

    await expect(parseMeal('Testmahlzeit')).rejects.toThrow('Empty response from Azure OpenAI');
    expect(requestCount).toBe(1);
  });

  it('sends every current strict-output schema family through the real SDK', async () => {
    const estimate = {
      displayName: 'Haferflocken',
      estimatedNutritionPer100g: { per: '100g', calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, salt: null },
      estimatedPortion: null,
      category: null,
      sourceProduct: null,
      searchTerms: ['haferflocken'],
      confidence: 0.8,
      warnings: [],
    };
    const preparation = {
      version: 1,
      teaser: 'Brot',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Mische den Teig.', sourceStepOrders: [3] }],
    };
    const analysis = {
      suggestedName: 'Brot',
      description: 'Ein einfaches Brot.',
      suggestedPortions: 2,
      tags: [],
      ingredients: [],
      steps: [{ order: 1, title: null, description: 'Mische Mehl und Wasser.', cookingEssential: false }],
      exportSuggestion: {
        version: 1,
        teaser: 'Ein einfaches Brot',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [{ order: 1, description: 'Mische Mehl und Wasser.', sourceStepOrders: [1], ingredientKeys: [] }],
        includedIngredientKeys: [],
      },
    };
    const dailyContext: InsightInputContext = {
      date: '2026-08-20',
      dayType: 'rest',
      workoutType: null,
      weight: { latestKg: null, previousKg: null, targetKg: null, weeklyTrend30d: null, last7Values: [], isOutlierPrevious: false, isOutlierLatest: false, daysSinceLastMeasurement: null, lastMeasurementDate: null },
      nutrition: {
        today: { calories: 1500, protein: 100, carbs: 150, fat: 50, fiber: 20, hasMealItem: true },
        targets: { calories: 2000, proteinG: 140, carbsG: 220, fatG: 70, fiberG: 30, macroRanges: { proteinG: { minG: 140, maxG: 180 }, carbsG: { minG: 160, maxG: 220 } } },
        remainingCalories: 500,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
        last3Days: [],
      },
      userGoal: 'maintain',
      userGoalIntensity: null,
      displayName: 'Sportler',
      progressIntelligence: { version: 'v1', primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 }, contextSignals: [], progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null, dayCompleteness: 1, goalAtCalculation: 'maintain' },
      currentHourLocal: 18,
      specialActivity: null,
      dailyActivityStatus: null,
    };
    const weeklyContext: WeeklyInsightPromptContext = {
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      days: [{ date: '2026-08-07', consumedCalories: 2100, baseTargetCalories: 2200, effectiveTargetCalories: 2400, activityBonusCalories: 200, targetPercent: 87.5, dayType: 'training', activity: { type: 'cycling', label: 'Radtour' }, hasNutritionData: true }],
      totals: { includedDayCount: 1, totalConsumedCalories: 2100, totalTargetCalories: 2400, averageConsumedCalories: 2100, averageTargetCalories: 2400, overallTargetPercent: 87.5 },
    };
    const responseBySchema: Record<string, unknown> = {
      parsed_meal: { items: [{ rawText: '200 g Hähnchen', displayName: 'Hähnchen', inputMode: 'grams', inputAmount: 200 }] },
      food_estimate: estimate,
      meal_estimate: { mealName: 'Mittagessen', mealEstimate: { calories: 500, protein: 30, carbs: 50, fat: 15, fiber: 8 }, components: ['Reis'], contextDetected: null, portionConfidence: 'medium', assumptions: [], warnings: [] },
      recipe_export_preparation: preparation,
      recipe_text_correction: { texts: ['Mische den Teig.'] },
      recipe_analyze: analysis,
      recipe_scale_preview: { description: null, steps: [] },
      food_estimate_batch: { items: [estimate] },
      weekly_insight: { text: 'Die Woche zeigt ein gemischtes, aber gut einordenbares Bild.' },
      daily_insight: { greeting: 'Hallo, Sportler! 👋', shortInsight: 'Dein Tag ist noch offen und du kannst ihn ruhig gestalten.', title: 'Dein Tagesfokus', summary: 'Heute hast du eine gute Basis gelegt und kannst den restlichen Tag ruhig und passend zu deinem Ziel gestalten.', recommendation: null },
    };
    const schemaNames: string[] = [];
    requestHandler = (request, response) => {
      void readJson(request).then((body) => {
        const format = body['response_format'] as { json_schema?: { name?: string; strict?: boolean } } | undefined;
        const name = format?.json_schema?.name;
        if (!name || !(name in responseBySchema)) {
          response.writeHead(400).end(JSON.stringify({ error: { message: `Unexpected schema: ${name}` } }));
          return;
        }
        schemaNames.push(name);
        expect(format?.json_schema?.strict).toBe(true);
        sendCompletion(response, JSON.stringify(responseBySchema[name]));
      });
    };

    process.env['AZURE_OPENAI_ENDPOINT'] = `http://127.0.0.1:${address.port}`;
    process.env['AZURE_OPENAI_API_KEY'] = 'wire-test-key';
    process.env['AZURE_OPENAI_API_VERSION'] = '2024-07-01';
    process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] = 'wire-deployment';

    await parseMeal('200 g Hähnchen');
    await estimateFood({ name: 'Haferflocken' });
    await estimateMeal({ text: 'Reis mit Gemüse' });
    await prepareRecipeExport({ recipeContext: { name: 'Brot', portions: 2, tags: [], ingredients: [] }, steps: [{ order: 3, description: 'Mische Mehl und Wasser.' }] });
    await prepareRecipeExport(
      { recipeContext: { name: 'Brot', portions: 2, tags: [], ingredients: [] }, steps: [{ order: 3, description: 'Mische Mehl und Wasser.' }] },
      { correction: { latestDraft: preparation, validationErrors: [{ phase: 'template', code: 'TEMPLATE_FIELD_OVERFLOW', path: 'steps[0].description', stepIndex: 0, actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 } }] } },
    );
    await analyzeRecipeText('1. Mische Mehl und Wasser.');
    await scaleRecipeText({ originalPortions: 2, targetPortions: 4, originalDescription: null, originalIngredients: [], targetIngredients: [], originalSteps: [] });
    await estimateFoodBatch(['Haferflocken']);
    await generateWeeklyInsight(weeklyContext);
    await generateDailyInsight(dailyContext, 'nutrition_guidance');

    expect(schemaNames).toEqual([
      'parsed_meal',
      'food_estimate',
      'meal_estimate',
      'recipe_export_preparation',
      'recipe_text_correction',
      'recipe_analyze',
      'recipe_scale_preview',
      'food_estimate_batch',
      'weekly_insight',
      'daily_insight',
    ]);
  });
});
// Label Scan endpoint — OCR + AI parsing of nutrition label images.
//
// POST /api/ai/label-scan
//   Body: multipart/form-data with field "image" (JPEG or PNG, max 4 MB)
//   Returns: NutritionLabelScanResult
//
// Flow: auth → quota check → parse multipart → OCR (Document Intelligence) → AI mapping → validate → respond

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { enforceQuota, trackUsage } from '../lib/quota';
import { extractTextFromImage } from '../lib/documentIntelligence';
import { parseNutritionLabel } from '../lib/labelParser';
import { validateNutritionEstimate } from '../lib/nutritionValidator';
import type { NutritionLabelScanResult } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'];

// ---------------------------------------------------------------------------
// Handler — exported for tests
// ---------------------------------------------------------------------------

export const labelScanHandler = withHandler(
  'ai.label-scan',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);

    // Quota enforcement — check before expensive OCR + AI calls
    const quotaBlock = await enforceQuota(userContext, 'label-scan');
    if (quotaBlock) return quotaBlock;

    // Parse multipart/form-data
    const formData = await request.formData();
    const imageField = formData.get('image');

    if (!imageField || !(imageField instanceof Blob)) {
      return {
        status: 400,
        jsonBody: { error: 'Missing "image" field in multipart form data' },
      };
    }

    // Validate content type
    const contentType = imageField.type;
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        status: 400,
        jsonBody: {
          error: `Unsupported image type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
        },
      };
    }

    // Validate size
    const arrayBuffer = await imageField.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      return {
        status: 400,
        jsonBody: { error: `Image exceeds maximum size of ${MAX_IMAGE_SIZE / 1024 / 1024} MB` },
      };
    }

    const imageBuffer = Buffer.from(arrayBuffer);

    // Log image to temp dir for debugging OCR quality
    try {
      const ext = contentType === 'image/png' ? 'png' : 'jpg';
      const filename = `label-scan-${Date.now()}.${ext}`;
      const filepath = path.join(os.tmpdir(), filename);
      fs.writeFileSync(filepath, imageBuffer);
      // Also log dimensions via sharp for quality diagnostics
      const sharp = await import('sharp');
      const meta = await sharp.default(imageBuffer).metadata();
      ctx.log(`=== IMAGE SAVED FOR DEBUG: ${filepath} (${Math.round(imageBuffer.length / 1024)} KB, ${meta.width}x${meta.height}px, quality≈${meta.density ?? 'unknown'}) ===`);
    } catch (e) {
      ctx.log(`=== IMAGE SAVE FAILED: ${e} ===`);
    }

    // Step 1: OCR via Azure Document Intelligence
    const ocrResult = await extractTextFromImage(imageBuffer);

    ctx.log('=== OCR RESULT ===');
    ctx.log(`confidence: ${ocrResult.confidence}`);
    ctx.log(`rawText:\n${ocrResult.rawText}`);
    ctx.log('==================');

    if (!ocrResult.rawText || ocrResult.rawText.trim().length === 0) {
      return {
        status: 422,
        jsonBody: {
          error: 'Could not extract text from image. Please ensure the nutrition label is clearly visible.',
        },
      };
    }

    // Step 2: AI mapping — parse OCR text into structured nutrition
    const aiResult = await parseNutritionLabel(ocrResult.rawText);

    ctx.log('=== AI PARSE RESULT ===');
    ctx.log(JSON.stringify(aiResult, null, 2));
    ctx.log('=======================');

    // Step 3: Plausibility validation (if we have calories + macros)
    const nutrition = aiResult.nutrition;
    const allWarnings = [...aiResult.warnings];

    if (nutrition.calories != null && nutrition.protein != null && nutrition.carbs != null && nutrition.fat != null) {
      const validation = validateNutritionEstimate({
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber ?? undefined,
        salt: nutrition.salt ?? undefined,
      });

      // For label scans, we add warnings but don't reject — the label data may just be unusual
      allWarnings.push(...validation.warnings);
      if (!validation.valid) {
        allWarnings.push('Nutrition values may be implausible — please verify against the physical label.');
      }
    }

    // Track usage AFTER successful processing
    await trackUsage(userContext, 'label-scan');

    const result: NutritionLabelScanResult = {
      productName: aiResult.productName,
      brand: aiResult.brand,
      baseUnit: aiResult.baseUnit,
      servingSize: aiResult.servingSize,
      nutrition: aiResult.nutrition,
      ocrConfidence: ocrResult.confidence,
      aiConfidence: aiResult.aiConfidence,
      warnings: allWarnings,
      rawOcrText: ocrResult.rawText,
    };

    return { status: 200, jsonBody: result };
  },
);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

app.http('ai-label-scan', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/label-scan',
  handler: labelScanHandler,
});

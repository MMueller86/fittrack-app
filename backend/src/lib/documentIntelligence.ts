// Azure AI Document Intelligence client wrapper.
// Uses the prebuilt-read model with coordinate-based column reconstruction.
// OCR lines are grouped by Y-position into rows and sorted left→right within
// each row, producing tab-separated output so the AI sees correct column mapping.
// Pattern mirrors openai.ts: lazy singleton + test setter.

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Client factory (lazy singleton)
// ---------------------------------------------------------------------------

let _client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (!_client) {
    const endpoint = process.env['AZURE_DI_ENDPOINT'];
    const key = process.env['AZURE_DI_KEY'];

    if (!endpoint || !key) {
      throw new Error('AZURE_DI_ENDPOINT and AZURE_DI_KEY must be set');
    }

    _client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  }
  return _client;
}

/** Reset the singleton — used in tests to inject a mock. */
export function __setDocumentIntelligenceClientForTests(client: DocumentAnalysisClient | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Column-aware table reconstruction
// ---------------------------------------------------------------------------

interface PositionedLine {
  content: string;
  x: number; // left edge, normalized 0–1 relative to page width
  y: number; // vertical center, normalized 0–1 relative to page height
}

type PageLike = {
  width?: number;
  height?: number;
  lines?: Array<{
    content: string;
    polygon?: Array<{ x: number; y: number }>;
  }>;
  words?: Array<{ confidence?: number }>;
};

/**
 * Groups OCR lines by their Y-coordinate into rows (same horizontal band),
 * then sorts each row left→right by X-coordinate and joins with tabs.
 *
 * This converts the column-by-column output of prebuilt-read into proper
 * rows like "Eiweiß (g)\t8,35\t23" so the AI correctly maps values to nutrients.
 */
function reconstructTableText(pages: PageLike[]): string {
  const lines: PositionedLine[] = [];

  for (const page of pages) {
    const pageWidth = page.width ?? 1;
    const pageHeight = page.height ?? 1;

    for (const line of page.lines ?? []) {
      const poly = line.polygon;
      if (!poly || poly.length < 4) {
        // No polygon data — fall back to sequential positioning
        lines.push({ content: line.content, x: 0, y: lines.length * 0.05 });
        continue;
      }
      const xs = poly.map(p => p.x / pageWidth);
      const ys = poly.map(p => p.y / pageHeight);
      lines.push({
        content: line.content,
        x: Math.min(...xs),
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      });
    }
  }

  if (lines.length === 0) return '';

  // Group lines into rows: any two lines whose Y-centers are within 1.5% of
  // page height are considered to be on the same row.
  const ROW_TOLERANCE = 0.015;
  const rows: PositionedLine[][] = [];

  for (const line of lines.sort((a, b) => a.y - b.y)) {
    const existing = rows.find(r => Math.abs(r[0].y - line.y) <= ROW_TOLERANCE);
    if (existing) {
      existing.push(line);
    } else {
      rows.push([line]);
    }
  }

  // Sort each row left → right
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  // Output: each row as tab-separated values
  return rows.map(row => row.map(l => l.content).join('\t')).join('\n');
}

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

/**
 * Prepares an image for Document Intelligence.
 * Applies histogram normalisation (stretches contrast to full 0-255 range)
 * and a mild sharpen to make text edges crisper — helps DI detect small-font
 * values on labels with uneven lighting or low-contrast backgrounds.
 * Does NOT invert colours — golden/warm text on dark backgrounds reads better
 * without inversion in DI's prebuilt-read model.
 *
 * Falls back to the original buffer if the image cannot be decoded.
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .normalise()          // stretch histogram → maximises local contrast
      .sharpen({ sigma: 1.2 }) // crisp text edges without over-sharpening
      .jpeg({ quality: 95 })
      .toBuffer();
  } catch {
    // Not a valid JPEG/PNG or sharp failed — use original buffer
    return imageBuffer;
  }
}

// ---------------------------------------------------------------------------
// OCR extraction
// ---------------------------------------------------------------------------

export interface OcrExtractionResult {
  /** Reconstructed text — tab-separated columns within rows, rows separated by newlines. */
  rawText: string;
  /** Average word-level confidence score from Document Intelligence (0–1). */
  confidence: number;
}

/**
 * Analyze a nutrition label image using the prebuilt-read model.
 * Returns coordinate-reconstructed tab-separated table text and confidence.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<OcrExtractionResult> {
  const client = getClient();

  const processedBuffer = await preprocessImage(imageBuffer);
  const poller = await client.beginAnalyzeDocument('prebuilt-read', processedBuffer);
  const result = await poller.pollUntilDone();

  if (!result || !result.pages || result.pages.length === 0) {
    return { rawText: '', confidence: 0 };
  }

  // Reconstruct column-aware table text using polygon coordinates
  const rawText = reconstructTableText(result.pages);

  // Calculate real confidence from word-level OCR scores
  let totalConfidence = 0;
  let wordCount = 0;
  for (const page of result.pages) {
    for (const word of page.words ?? []) {
      totalConfidence += word.confidence ?? 0.5;
      wordCount++;
    }
  }

  return {
    rawText,
    confidence: Math.round((wordCount > 0 ? totalConfidence / wordCount : 0.5) * 100) / 100,
  };
}


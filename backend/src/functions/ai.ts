import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { parseMeal, type AiParsedItem } from '../lib/openai';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { enforceQuota, trackUsage } from '../lib/quota';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched';

export interface MealParserPreviewItem {
  rawText: string;
  displayName: string;
  status: ItemStatus;
  selectedProductId: string | null;
  selectedProductName: string | null;
  candidates: FoodSearchResult[];
  inputMode: 'grams' | 'portion' | 'unknown';
  inputAmount: number | null;
  amountGrams: number | null;
  needsReview: boolean;
  warnings: string[];
}

export interface MealParserPreviewResponse {
  items: MealParserPreviewItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Classification logic (pure function — easy to unit test)
// ---------------------------------------------------------------------------

/**
 * Classify search results into a status and derive selected product if unambiguous.
 *
 * matched:        exactly one candidate AND its name closely matches the displayName
 * needsSelection: multiple candidates, or one candidate with weak name similarity
 * unmatched:      no candidates
 */
export function classifyItem(
  parsed: AiParsedItem,
  candidates: FoodSearchResult[],
  libraryItems: ReusableItem[] = [],
): Pick<MealParserPreviewItem, 'status' | 'selectedProductId' | 'selectedProductName' | 'needsReview' | 'warnings'> {
  const warnings: string[] = [];

  if (candidates.length === 0) {
    return { status: 'unmatched', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
  }

  if (candidates.length === 1) {
    const c = candidates[0]!;
    // Look up searchTerms for this candidate from the library (if it's a library item)
    const libItem = libraryItems.find((li) => li.id === c.id);
    const nameMatch = isStrongNameMatch(parsed.displayName, c.name, libItem?.searchTerms);
    if (nameMatch) {
      return { status: 'matched', selectedProductId: c.id, selectedProductName: c.name, needsReview: false, warnings };
    }
    return { status: 'needsSelection', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
  }

  // Multiple candidates — check if any library item is a strong match and auto-select it
  for (const c of candidates) {
    const libItem = libraryItems.find((li) => li.id === c.id);
    if (libItem && isStrongNameMatch(parsed.displayName, c.name, libItem.searchTerms)) {
      return { status: 'matched', selectedProductId: c.id, selectedProductName: c.name, needsReview: false, warnings };
    }
  }

  // Multiple candidates — let user pick
  return { status: 'needsSelection', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
}

/**
 * Returns true if the AI display name and the product name are similar enough
 * to auto-select without user confirmation.
 * Checks: normalized name equality/prefix, OR any searchTerm matches the display name token.
 */
function isStrongNameMatch(displayName: string, productName: string, searchTerms?: string[]): boolean {
  const a = displayName.toLowerCase().trim();
  const b = productName.toLowerCase().trim();
  if (b === a || b.startsWith(a) || a.startsWith(b)) return true;
  // Check if any stored searchTerm matches a word in the display name
  if (searchTerms && searchTerms.length > 0) {
    const displayTokens = a.split(/\s+/);
    return searchTerms.some((t) => displayTokens.some((tok) => tok.startsWith(t) || t.startsWith(tok)));
  }
  return false;
}

/**
 * Resolve amountGrams from AI-parsed item.
 * If inputMode is 'grams', amountGrams = inputAmount.
 * For 'portion' or 'unknown', we leave it null (user/save step resolves via product portion data).
 */
export function resolveAmountGrams(parsed: AiParsedItem): number | null {
  if (parsed.inputMode === 'grams' && parsed.inputAmount !== null) {
    return parsed.inputAmount;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Preview endpoint
// ---------------------------------------------------------------------------

const PreviewBodySchema = z.object({
  text: z.string().min(1, 'text must not be empty').max(500, 'text must be at most 500 characters'),
});

export const mealParserPreviewHandler = withHandler(
  'ai.meal-parser.preview',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = requireUser(request);
    const { userId } = userContext;

    // Quota enforcement — check before expensive AI call
    const quotaBlock = await enforceQuota(userContext, 'meal-parser');
    if (quotaBlock) return quotaBlock;

    const body = await request.json();
    const parsed = PreviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request' } };
    }

    const { text } = parsed.data;
    const catalogRepo = getFoodProductRepository();
    const libraryRepo = getReusableItemsRepository();

    // 1. AI parsing
    let aiItems: AiParsedItem[];
    try {
      aiItems = await parseMeal(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 502, jsonBody: { error: `AI parsing failed: ${msg}` } };
    }

    // Track usage AFTER successful AI call
    await trackUsage(userContext, 'meal-parser');

    // 2. For each parsed item: search user library + catalog, merge, classify
    const items = await Promise.all(
      aiItems.map(async (aiItem): Promise<MealParserPreviewItem> => {
        // Split displayName into significant words (3+ chars) to handle multi-word queries.
        // The library search uses STARTSWITH on each stored term — so a query of
        // "Sandwich Vollkorntoast" would never match a stored searchTerm "vollkorntoast"
        // because STARTSWITH("vollkorntoast", "sandwich vollkorntoast") is false.
        // Searching each word individually ("sandwich", "vollkorntoast") fixes this.
        const searchWords = [
          ...new Set(
            aiItem.displayName
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length >= 3),
          ),
        ];

        const [libraryItemSets, catalogResults] = await Promise.all([
          Promise.all(searchWords.map((word) => libraryRepo.search(userId, word))),
          catalogRepo.search(aiItem.displayName, 5),
        ]);

        // Merge library results from all word-searches, deduplicated by id
        const seenLibIds = new Set<string>();
        const libraryItems: ReusableItem[] = [];
        for (const resultSet of libraryItemSets) {
          for (const item of resultSet) {
            if (!seenLibIds.has(item.id)) {
              seenLibIds.add(item.id);
              libraryItems.push(item);
            }
          }
        }

        // Map library items to FoodSearchResult — library comes first
        const libraryResults: FoodSearchResult[] = libraryItems.map((li) => ({
          id: li.id,
          source: 'library' as const,
          name: li.name,
          brand: li.brand,
          displayLabel: li.nutritionPer100g
            ? `100g · ${Math.round(li.nutritionPer100g.calories)} kcal`
            : li.portion?.nutrition
              ? `${li.portion.label} · ${Math.round(li.portion.nutrition.calories)} kcal`
              : 'Keine Nährwerte',
          nutritionBasis: li.nutritionBasis,
          nutritionPer100g: li.nutritionPer100g,
          portion: li.portion,
          isComplete: li.isComplete,
          sourceRef: li.sourceRef,
          ...(li.sourceType === 'ai' && { isAiEstimate: true }),
          ...(li.sourceType === 'ai' && li.aiConfidence != null && { aiConfidence: li.aiConfidence }),
        }));

        // De-duplicate: skip catalog entries whose name already in library
        const libraryNames = new Set(libraryResults.map((r) => r.name.toLowerCase()));
        const dedupedCatalog = catalogResults.filter((r) => !libraryNames.has(r.name.toLowerCase()));

        const candidates = [...libraryResults, ...dedupedCatalog];
        const classification = classifyItem(aiItem, candidates, libraryItems);
        return {
          rawText: aiItem.rawText,
          displayName: aiItem.displayName,
          inputMode: aiItem.inputMode,
          inputAmount: aiItem.inputAmount,
          amountGrams: resolveAmountGrams(aiItem),
          candidates,
          ...classification,
        };
      }),
    );

    const globalWarnings: string[] = [];
    const unmatchedCount = items.filter((i) => i.status === 'unmatched').length;
    if (unmatchedCount > 0) {
      globalWarnings.push(
        `${unmatchedCount} Produkt${unmatchedCount > 1 ? 'e' : ''} konnten nicht in der Datenbank gefunden werden.`,
      );
    }

    const response: MealParserPreviewResponse = { items, warnings: globalWarnings };
    return { status: 200, jsonBody: response };
  },
);

app.http('ai-meal-parser-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-parser/preview',
  handler: mealParserPreviewHandler,
});

// ---------------------------------------------------------------------------
// Legacy stub — kept for backwards compatibility
// ---------------------------------------------------------------------------

app.http('ai-analyze-meal-item', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-analyze',
  handler: async () => ({
    status: 501,
    jsonBody: { message: 'Replaced by POST /api/ai/meal-parser/preview' },
  }),
});


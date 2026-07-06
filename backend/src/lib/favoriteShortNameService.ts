// favoriteShortNameService.ts
// Generiert asynchron einen AI-Kurznamen für Favoriten-Chips.
//
// Ablauf:
//   1. addFavorite() → void generateFavoriteShortName(...) (fire & forget)
//   2. Prüft ob FoodProduct.shortName bereits existiert (globaler Cache)
//   3. Falls ja: shortName sofort in UserFoodRelation übernehmen
//   4. Falls nein: Azure OpenAI Call → shortName in FoodProduct + UserFoodRelation speichern
//
// AI darf den UI-Flow NIEMALS blockieren.
// Fehler werden geloggt aber führen nie zu einem Fehler-State für den Nutzer.

import { AzureOpenAI } from 'openai';
import { getCosmos } from './cosmos';
import type { FoodProduct } from '@fittrack/shared';
import { getUserFoodRelationRepository } from './repositories/userFoodRelationRepository';

let _client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!_client) {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    const apiKey = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-07-01';
    if (!endpoint || !apiKey) throw new Error('AZURE_OPENAI not configured');
    _client = new AzureOpenAI({ endpoint, apiKey, apiVersion });
  }
  return _client;
}

/**
 * Ruft Azure OpenAI auf um einen kurzen, natürlich klingenden deutschen
 * Spitznamen für ein Lebensmittel zu generieren.
 * Max. 2 Wörter, ca. 14 Zeichen.
 */
async function callAiForShortName(productName: string): Promise<string | null> {
  try {
    const client = getClient();
    const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

    const response = await client.chat.completions.create({
      model: deployment,
      max_tokens: 10,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein Ernährungs-Assistent. Generiere extrem kurze, natürlich klingende deutsche ' +
            'Spitznamen für Lebensmittel (max. 2 Wörter, max. 14 Zeichen). ' +
            'Antworte NUR mit dem Namen, kein Punkt, keine Erklärung.',
        },
        {
          role: 'user',
          content: `Kurzer Spitzname für: "${productName}"`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text || text.length > 20) return null; // safety check
    // Trim to max 14 chars if AI returned more
    return text.length > 14 ? text.slice(0, 14).trim() : text;
  } catch (e) {
    console.error('[favoriteShortName] AI call failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Aktualisiert FoodProduct.shortName in Cosmos.
 * Nur für Katalogprodukte (foodRefType === 'catalog').
 */
async function updateFoodProductShortName(foodRef: string, shortName: string): Promise<void> {
  try {
    const { containers } = await getCosmos();
    const { resource } = await containers.foodProducts.item(foodRef, foodRef).read<FoodProduct>();
    if (!resource) return;
    await containers.foodProducts.item(foodRef, foodRef).replace({ ...resource, shortName });
  } catch (e) {
    console.error('[favoriteShortName] Failed to update FoodProduct.shortName:', e instanceof Error ? e.message : e);
  }
}

/**
 * Aktualisiert UserFoodRelation.shortName in Cosmos.
 */
async function updateUserRelationShortName(
  userId: string,
  foodRef: string,
  shortName: string,
): Promise<void> {
  try {
    const repo = getUserFoodRelationRepository();
    const existing = await repo.getByFoodRef(userId, foodRef);
    if (!existing) return;
    const { containers } = await getCosmos();
    await containers.userFoodRelations.item(existing.id, userId).replace({
      ...existing,
      shortName,
    });
  } catch (e) {
    console.error('[favoriteShortName] Failed to update UserFoodRelation.shortName:', e instanceof Error ? e.message : e);
  }
}

/**
 * Fire-and-forget: Generiert einen AI-Kurznamen nach dem Favorisieren.
 *
 * Strategie:
 *   1. Ist foodRefType === 'catalog': prüfe ob FoodProduct.shortName bereits existiert
 *      → falls ja: shortName direkt in UserFoodRelation übernehmen (kein AI-Call)
 *      → falls nein: AI-Call → shortName in FoodProduct + UserFoodRelation speichern
 *   2. Ist foodRefType === 'personal': kein FoodProduct → AI-Call → nur UserFoodRelation
 */
export function generateFavoriteShortName(
  userId: string,
  foodRef: string,
  foodRefType: 'catalog' | 'personal',
  productName: string,
): void {
  // Fire & forget — niemals awaiten
  void (async () => {
    try {
      if (foodRefType === 'catalog') {
        // Schritt 1: Prüfe ob globaler Kurzname schon vorhanden
        const { containers } = await getCosmos();
        const { resource } = await containers.foodProducts.item(foodRef, foodRef).read<FoodProduct>();

        if (resource?.shortName) {
          // Globaler Name bereits vorhanden → direkt in UserFoodRelation übernehmen
          await updateUserRelationShortName(userId, foodRef, resource.shortName);
          return;
        }

        // Kein globaler Name → AI-Call
        const shortName = await callAiForShortName(productName);
        if (!shortName) return;

        // Gleichzeitig in FoodProduct (global) und UserFoodRelation (user-spezifisch) speichern
        await Promise.all([
          updateFoodProductShortName(foodRef, shortName),
          updateUserRelationShortName(userId, foodRef, shortName),
        ]);
      } else {
        // Personal item — nur UserFoodRelation
        const shortName = await callAiForShortName(productName);
        if (!shortName) return;
        await updateUserRelationShortName(userId, foodRef, shortName);
      }
    } catch (e) {
      console.error('[favoriteShortName] Unexpected error:', e instanceof Error ? e.message : e);
    }
  })();
}

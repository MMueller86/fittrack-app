import type { RecipeImage, RecipeIngredient } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';

export type WizardPhase = 'input' | 'analyzing' | 'ingredients' | 'steps' | 'preview';
export type IngStatus = 'auto-matched' | 'needs-selection' | 'needs-ai' | 'confirmed' | 'seasoning';

export interface WizardIngredient {
  id: string;
  parserItem: MealParserPreviewItem;
  status: IngStatus;
  userConfirmed: boolean;
  resolvedIngredient?: RecipeIngredient;
}

export interface WizardStepItem {
  id: string;
  title: string;
  description: string;
}

export type AmountMode = 'grams' | 'portion';

export interface AmountEdit {
  mode: AmountMode;
  value: string;
}

export interface NewWizardImageDraft {
  draftId: string;
  source: 'local';
  uri: string;
  mime: 'image/jpeg' | 'image/png';
}

export interface ExistingWizardImageDraft {
  draftId: string;
  source: 'existing';
  imageId: string;
  uri: string;
  order: number;
}

export type WizardImageDraft = NewWizardImageDraft | ExistingWizardImageDraft;

export function buildWizardImageDraftFromRecipeImage(image: RecipeImage): ExistingWizardImageDraft | null {
  if (!image.url) return null;
  return {
    draftId: `existing:${image.id}`,
    source: 'existing',
    imageId: image.id,
    uri: image.url,
    order: image.order,
  };
}
import type { RecipeIngredient } from '@fittrack/shared';
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

export interface PendingWizardImage {
  uri: string;
  mime: 'image/jpeg' | 'image/png';
}
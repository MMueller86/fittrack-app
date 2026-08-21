import {
  DAILY_INSIGHT_CTA_MAX_LENGTH,
  DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH,
  DAILY_INSIGHT_SUMMARY_MAX_LENGTH,
  DAILY_INSIGHT_TITLE_MAX_LENGTH,
} from './dailyInsightValidation';

export const DAILY_INSIGHT_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: {
      type: 'string' as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_TITLE_MAX_LENGTH,
    },
    summary: {
      type: 'string' as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_SUMMARY_MAX_LENGTH,
    },
    recommendation: {
      type: ['string', 'null'] as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH,
    },
    cta: {
      type: ['string', 'null'] as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_CTA_MAX_LENGTH,
    },
    ctaTarget: {
      type: ['string', 'null'] as const,
      enum: ['Nutrition', 'Weight', 'Training', 'Recipe', null] as const,
    },
  },
  required: ['title', 'summary', 'recommendation', 'cta', 'ctaTarget'],
  additionalProperties: false,
} as const;
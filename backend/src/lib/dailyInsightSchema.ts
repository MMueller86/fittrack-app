import {
  DAILY_INSIGHT_GREETING_MAX_LENGTH,
  DAILY_INSIGHT_SHORT_INSIGHT_MAX_LENGTH,
  DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH,
  DAILY_INSIGHT_SUMMARY_MAX_LENGTH,
  DAILY_INSIGHT_TITLE_MAX_LENGTH,
} from './dailyInsightValidation';

export const DAILY_INSIGHT_SCHEMA = {
  type: 'object' as const,
  properties: {
    greeting: {
      type: 'string' as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_GREETING_MAX_LENGTH,
    },
    shortInsight: {
      type: 'string' as const,
      minLength: 1,
      maxLength: DAILY_INSIGHT_SHORT_INSIGHT_MAX_LENGTH,
    },
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
  },
  required: ['greeting', 'shortInsight', 'title', 'summary', 'recommendation'],
  additionalProperties: false,
} as const;
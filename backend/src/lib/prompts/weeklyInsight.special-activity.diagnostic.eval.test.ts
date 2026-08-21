import { afterAll, describe, expect, it } from 'vitest';

import { generateWeeklyInsight } from '../openai';
import { WEEKLY_INSIGHT_PROMPT_VERSION } from './weeklyInsightV2';
import {
  buildWeeklyInsightDiagnosticManifest,
  classifyWeeklyInsightJudgeOutput,
  getWeeklyInsightEvalModel,
  hasWeeklyInsightEvalCredentials,
  judgeWeeklyInsightText,
  type WeeklyInsightDiagnosticCaseResult,
} from '../../test-utils/weeklyInsightEvalSemantics';
import { WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES } from './weeklyInsight.eval.fixtures';

const TESTED_PROMPT_VERSION = 'v3';
const diagnosticResults: WeeklyInsightDiagnosticCaseResult[] = [];

function makeCaseResult(
  fixture: (typeof WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES)[number],
  generatedText: string | null,
  generatorStatus: 'GENERATED' | 'UNVERIFIED',
  semantic: ReturnType<typeof classifyWeeklyInsightJudgeOutput>,
  reason: string | null,
): WeeklyInsightDiagnosticCaseResult {
  return {
    fixtureId: fixture.id,
    expectedRelation: fixture.expectedRelation,
    generatorStatus,
    semanticStatus: semantic.status,
    basis: semantic.basis,
    relation: semantic.relation,
    evidence: semantic.evidence,
    reason: reason ?? semantic.reason,
  };
}

describe.skipIf(!hasWeeklyInsightEvalCredentials())('weeklyInsight: special-activity diagnostic eval', () => {
  it('weekly insight diagnostic prompt version matches the prepared fixtures', () => {
    expect(WEEKLY_INSIGHT_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
  });

  it.each(WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES)(
    '[$id] $description',
    async (fixture) => {
      let generatedText: string | null = null;
      let generatorStatus: 'GENERATED' | 'UNVERIFIED' = 'GENERATED';
      let generationReason: string | null = null;

      try {
        generatedText = (await generateWeeklyInsight(fixture.input)).text;
      } catch {
        generatorStatus = 'UNVERIFIED';
        generationReason = 'generator_provider_or_schema_error';
      }

      const judgeAttempt = generatedText == null
        ? { status: 'unverified' as const, reason: 'generator_output_unavailable' }
        : await judgeWeeklyInsightText(generatedText, fixture);
      const semantic = classifyWeeklyInsightJudgeOutput(
        fixture,
        generatedText,
        judgeAttempt.status === 'judged' ? judgeAttempt.output : null,
      );
      const result = makeCaseResult(
        fixture,
        generatedText,
        generatorStatus,
        semantic,
        generationReason ?? (judgeAttempt.status === 'unverified' ? judgeAttempt.reason : null),
      );
      diagnosticResults.push(result);

      console.log(`WEEKLY_INSIGHT_DIAGNOSTIC_CASE=${JSON.stringify({
        ...result,
        generatedText: generatedText?.slice(0, 750) ?? null,
        promptVersion: WEEKLY_INSIGHT_PROMPT_VERSION,
        model: getWeeklyInsightEvalModel(),
      })}`);

      expect(result.semanticStatus).toBe('CORRECT');
    },
  );

  afterAll(() => {
    const manifest = buildWeeklyInsightDiagnosticManifest({
      promptVersion: WEEKLY_INSIGHT_PROMPT_VERSION,
      model: getWeeklyInsightEvalModel(),
      results: diagnosticResults,
      payload: { underEffectiveTarget: 'PASS', atEffectiveTarget: 'PASS' },
    });
    console.log(`WEEKLY_INSIGHT_DIAGNOSTIC_MANIFEST=${JSON.stringify(manifest)}`);
  });
});
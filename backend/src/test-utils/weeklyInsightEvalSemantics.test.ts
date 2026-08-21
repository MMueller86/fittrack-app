import { describe, expect, it } from 'vitest';

import {
  buildWeeklyInsightDiagnosticManifest,
  classifyWeeklyInsightJudgeOutput,
  type WeeklyInsightDiagnosticCaseResult,
} from './weeklyInsightEvalSemantics';
import { WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES } from '../lib/prompts/weeklyInsight.eval.fixtures';

const [underFixture, atFixture] = WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES;

function caseResult(
  fixture: typeof underFixture,
  semanticStatus: WeeklyInsightDiagnosticCaseResult['semanticStatus'],
): WeeklyInsightDiagnosticCaseResult {
  return {
    fixtureId: fixture.id,
    expectedRelation: fixture.expectedRelation,
    generatorStatus: 'GENERATED',
    semanticStatus,
    basis: semanticStatus === 'UNVERIFIED' ? 'ambiguous' : fixture.expectedBasis,
    relation: semanticStatus === 'UNVERIFIED' ? 'ambiguous' : fixture.expectedRelation,
    evidence: 'Der Textausschnitt.',
    reason: semanticStatus === 'CORRECT' ? null : 'test_reason',
  };
}

describe('weekly insight diagnostic semantic validator', () => {
  it('accepts the effective-target relation with exact text evidence', () => {
    const result = classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Aufnahme liegt innerhalb des Aktivitätsziels.',
      {
        basis: 'effective_target',
        relation: 'within_effective_target',
        evidence: 'innerhalb des Aktivitätsziels',
      },
    );

    expect(result).toMatchObject({
      status: 'CORRECT',
      basis: 'effective_target',
      relation: 'within_effective_target',
      evidence: 'innerhalb des Aktivitätsziels',
      reason: null,
    });
  });

  it('accepts the exact-effective-target relation', () => {
    const result = classifyWeeklyInsightJudgeOutput(
      atFixture,
      'Du liegst genau am effektiven Aktivitätsziel.',
      {
        basis: 'effective_target',
        relation: 'at_effective_target',
        evidence: 'genau am effektiven Aktivitätsziel',
      },
    );

    expect(result.status).toBe('CORRECT');
  });

  it('marks base-target-only or exceeded-effective-target judgments incorrect', () => {
    expect(classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Aufnahme überschreitet das Ziel.',
      {
        basis: 'base_target_only',
        relation: 'exceeded_effective_target',
        evidence: 'überschreitet das Ziel',
      },
    ).status).toBe('INCORRECT');
  });

  it('keeps ambiguous judgments unverified', () => {
    const result = classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Woche ist insgesamt einzuordnen.',
      {
        basis: 'ambiguous',
        relation: 'ambiguous',
        evidence: 'insgesamt einzuordnen',
      },
    );

    expect(result.status).toBe('UNVERIFIED');
  });

  it('keeps missing or non-matching evidence unverified', () => {
    expect(classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Aufnahme liegt im Ziel.',
      {
        basis: 'effective_target',
        relation: 'within_effective_target',
        evidence: 'nicht im Text',
      },
    ).status).toBe('UNVERIFIED');

    expect(classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Aufnahme liegt im Ziel.',
      {
        basis: 'effective_target',
        relation: 'within_effective_target',
        evidence: null,
      },
    ).status).toBe('UNVERIFIED');
  });

  it('keeps invalid structured judge output unverified', () => {
    const result = classifyWeeklyInsightJudgeOutput(
      underFixture,
      'Die Aufnahme liegt im Ziel.',
      { basis: 'effective_target', relation: 'within_effective_target' },
    );

    expect(result.status).toBe('UNVERIFIED');
  });
});

describe('weekly insight diagnostic manifest', () => {
  it('reports NO_RED only when both semantic cases are verified', () => {
    const manifest = buildWeeklyInsightDiagnosticManifest({
      promptVersion: 'v2',
      model: 'gpt4o-mini',
      results: [caseResult(underFixture, 'CORRECT'), caseResult(atFixture, 'CORRECT')],
    });

    expect(manifest).toMatchObject({
      diagnosis: 'C',
      status: 'VERIFIED',
      gate: 'NO_RED',
      payload: { underEffectiveTarget: 'PASS', atEffectiveTarget: 'PASS' },
      ai: { underEffectiveTarget: 'CORRECT', atEffectiveTarget: 'CORRECT' },
      evidence: { promptVersion: 'v2', model: 'gpt4o-mini' },
    });
  });

  it('reports RED_CONFIRMED_B only for a structured incorrect AI result', () => {
    const manifest = buildWeeklyInsightDiagnosticManifest({
      promptVersion: 'v2',
      results: [caseResult(underFixture, 'INCORRECT'), caseResult(atFixture, 'CORRECT')],
    });

    expect(manifest).toMatchObject({
      diagnosis: 'B',
      status: 'VERIFIED',
      gate: 'RED_CONFIRMED_B',
    });
  });

  it('reports UNVERIFIED when a semantic case cannot be proven', () => {
    const manifest = buildWeeklyInsightDiagnosticManifest({
      promptVersion: 'v2',
      results: [caseResult(underFixture, 'UNVERIFIED'), caseResult(atFixture, 'CORRECT')],
    });

    expect(manifest).toMatchObject({
      diagnosis: 'C',
      status: 'UNVERIFIED',
      gate: 'UNVERIFIED',
    });
  });

  it('reports RED_CONFIRMED_A when the deterministic payload gate fails', () => {
    const manifest = buildWeeklyInsightDiagnosticManifest({
      promptVersion: 'v2',
      results: [],
      payload: { underEffectiveTarget: 'FAIL', atEffectiveTarget: 'PASS' },
    });

    expect(manifest).toMatchObject({
      diagnosis: 'A',
      status: 'VERIFIED',
      gate: 'RED_CONFIRMED_A',
    });
  });
});
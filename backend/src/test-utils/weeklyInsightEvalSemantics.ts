import { AzureOpenAI } from 'openai';
import { z } from 'zod';

import type {
  WeeklyInsightDiagnosticRelation,
  WeeklyInsightSpecialActivityDiagnosticFixture,
} from '../lib/prompts/weeklyInsight.eval.fixtures';

const WEEKLY_INSIGHT_JUDGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    basis: {
      type: 'string' as const,
      enum: ['effective_target', 'base_target_only', 'ambiguous'],
    },
    relation: {
      type: 'string' as const,
      enum: [
        'within_effective_target',
        'at_effective_target',
        'exceeded_effective_target',
        'ambiguous',
      ],
    },
    evidence: { type: ['string', 'null'] as const },
  },
  required: ['basis', 'relation', 'evidence'],
  additionalProperties: false,
};

const WEEKLY_INSIGHT_JUDGE_RESPONSE_SCHEMA = z.object({
  basis: z.enum(['effective_target', 'base_target_only', 'ambiguous']),
  relation: z.enum([
    'within_effective_target',
    'at_effective_target',
    'exceeded_effective_target',
    'ambiguous',
  ]),
  evidence: z.string().nullable(),
}).strict();

const WEEKLY_INSIGHT_JUDGE_SYSTEM_PROMPT = `Du bist ein konservativer semantischer Prüfer für einen Diagnose-Eval.
Prüfe den erzeugten deutschen Wochenbewertungstext gegen den gelieferten Rechenkontext.
Der effektive Zielwert ist baseTargetCalories plus activityBonusCalories und der alleinige Nenner.
Der Bonus ist kein zusätzlicher Verbrauch und darf nicht doppelt gezählt werden.

Gib ausschließlich dieses JSON-Objekt zurück:
{
  "basis": "effective_target" | "base_target_only" | "ambiguous",
  "relation": "within_effective_target" | "at_effective_target" | "exceeded_effective_target" | "ambiguous",
  "evidence": "exakter, nicht-leerer Ausschnitt aus dem Bewertungstext" | null
}

Verwende "effective_target" nur, wenn die Einordnung tatsächlich gegen das effektive Ziel erfolgt.
Wenn der Text nicht eindeutig ist, verwende "ambiguous". evidence muss unverändert im Text vorkommen.`;

export type WeeklyInsightJudgeOutput = z.infer<typeof WEEKLY_INSIGHT_JUDGE_RESPONSE_SCHEMA>;

export type WeeklyInsightJudgeAttempt =
  | { status: 'judged'; output: WeeklyInsightJudgeOutput }
  | { status: 'unverified'; reason: string };

export type WeeklyInsightSemanticStatus = 'CORRECT' | 'INCORRECT' | 'UNVERIFIED';

export interface WeeklyInsightSemanticEvaluation {
  status: WeeklyInsightSemanticStatus;
  basis: WeeklyInsightJudgeOutput['basis'] | null;
  relation: WeeklyInsightJudgeOutput['relation'] | null;
  evidence: string | null;
  reason: string | null;
}

export interface WeeklyInsightDiagnosticCaseResult {
  fixtureId: string;
  expectedRelation: WeeklyInsightDiagnosticRelation;
  generatorStatus: 'GENERATED' | 'UNVERIFIED';
  semanticStatus: WeeklyInsightSemanticStatus;
  basis: WeeklyInsightJudgeOutput['basis'] | null;
  relation: WeeklyInsightJudgeOutput['relation'] | null;
  evidence: string | null;
  reason: string | null;
}

export type WeeklyInsightPayloadGateStatus = 'PASS' | 'FAIL';
export type WeeklyInsightDiagnosticGate =
  | 'RED_CONFIRMED_A'
  | 'RED_CONFIRMED_B'
  | 'NO_RED'
  | 'UNVERIFIED';

export interface WeeklyInsightDiagnosticManifest {
  diagnosis: 'A' | 'B' | 'C';
  status: 'VERIFIED' | 'UNVERIFIED';
  gate: WeeklyInsightDiagnosticGate;
  payload: {
    underEffectiveTarget: WeeklyInsightPayloadGateStatus;
    atEffectiveTarget: WeeklyInsightPayloadGateStatus;
  };
  ai: {
    underEffectiveTarget: 'CORRECT' | 'INCORRECT' | 'NOT_RUN' | 'UNVERIFIED';
    atEffectiveTarget: 'CORRECT' | 'INCORRECT' | 'NOT_RUN' | 'UNVERIFIED';
  };
  evidence: {
    promptVersion: string;
    model: string;
    cases: WeeklyInsightDiagnosticCaseResult[];
  };
}

let judgeClient: AzureOpenAI | null = null;

export function hasWeeklyInsightEvalCredentials(): boolean {
  return Boolean(
    process.env['AZURE_OPENAI_ENDPOINT']?.trim() &&
      process.env['AZURE_OPENAI_API_KEY']?.trim(),
  );
}

export function getWeeklyInsightEvalModel(): string {
  return process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';
}

function getJudgeClient(): AzureOpenAI {
  if (!judgeClient) {
    judgeClient = new AzureOpenAI({
      endpoint: process.env['AZURE_OPENAI_ENDPOINT']!,
      apiKey: process.env['AZURE_OPENAI_API_KEY']!,
      apiVersion: process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-07-01',
    });
  }
  return judgeClient;
}

export async function judgeWeeklyInsightText(
  generatedText: string,
  fixture: WeeklyInsightSpecialActivityDiagnosticFixture,
): Promise<WeeklyInsightJudgeAttempt> {
  if (!hasWeeklyInsightEvalCredentials()) {
    return { status: 'unverified', reason: 'missing_credentials' };
  }

  try {
    const completion = await getJudgeClient().chat.completions.create({
      model: getWeeklyInsightEvalModel(),
      messages: [
        { role: 'system', content: WEEKLY_INSIGHT_JUDGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            scenario: {
              consumedCalories: fixture.expectedConsumedCalories,
              baseTargetCalories: fixture.expectedBaseTargetCalories,
              activityBonusCalories: fixture.expectedActivityBonusCalories,
              effectiveTargetCalories: fixture.expectedEffectiveTargetCalories,
              targetPercent: fixture.expectedTargetPercent,
            },
            generatedText,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'weekly_insight_semantic_judgment',
          strict: true,
          schema: WEEKLY_INSIGHT_JUDGE_SCHEMA,
        },
      },
      temperature: 0,
      max_tokens: 256,
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === 'length' || choice?.finish_reason === 'content_filter') {
      return { status: 'unverified', reason: `judge_${choice.finish_reason}` };
    }

    const raw = choice?.message?.content;
    if (!raw) return { status: 'unverified', reason: 'empty_judge_response' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 'unverified', reason: 'invalid_judge_json' };
    }

    const validated = WEEKLY_INSIGHT_JUDGE_RESPONSE_SCHEMA.safeParse(parsed);
    if (!validated.success) {
      return { status: 'unverified', reason: 'invalid_judge_schema' };
    }

    return { status: 'judged', output: validated.data };
  } catch {
    return { status: 'unverified', reason: 'judge_provider_error' };
  }
}

export function classifyWeeklyInsightJudgeOutput(
  fixture: WeeklyInsightSpecialActivityDiagnosticFixture,
  generatedText: string | null,
  judgeOutput: unknown,
): WeeklyInsightSemanticEvaluation {
  if (!generatedText?.trim()) {
    return {
      status: 'UNVERIFIED',
      basis: null,
      relation: null,
      evidence: null,
      reason: 'missing_generator_output',
    };
  }

  const validated = WEEKLY_INSIGHT_JUDGE_RESPONSE_SCHEMA.safeParse(judgeOutput);
  if (!validated.success) {
    return {
      status: 'UNVERIFIED',
      basis: null,
      relation: null,
      evidence: null,
      reason: 'invalid_judge_output',
    };
  }

  const { basis, relation, evidence } = validated.data;
  if (evidence == null || evidence.length === 0 || !generatedText.includes(evidence)) {
    return {
      status: 'UNVERIFIED',
      basis,
      relation,
      evidence,
      reason: 'missing_or_unproven_evidence',
    };
  }

  if (basis === 'ambiguous' || relation === 'ambiguous') {
    return {
      status: 'UNVERIFIED',
      basis,
      relation,
      evidence,
      reason: 'ambiguous_judgment',
    };
  }

  if (basis === fixture.expectedBasis && relation === fixture.expectedRelation) {
    return {
      status: 'CORRECT',
      basis,
      relation,
      evidence,
      reason: null,
    };
  }

  return {
    status: 'INCORRECT',
    basis,
    relation,
    evidence,
    reason: 'contradictory_judgment',
  };
}

function caseResultFor(
  results: readonly WeeklyInsightDiagnosticCaseResult[],
  expectedRelation: WeeklyInsightDiagnosticRelation,
): WeeklyInsightDiagnosticCaseResult | null {
  return results.find((result) => result.expectedRelation === expectedRelation) ?? null;
}

function caseStatus(
  result: WeeklyInsightDiagnosticCaseResult | null,
): 'CORRECT' | 'INCORRECT' | 'NOT_RUN' | 'UNVERIFIED' {
  if (!result) return 'NOT_RUN';
  return result.semanticStatus;
}

export function buildWeeklyInsightDiagnosticManifest(input: {
  results: readonly WeeklyInsightDiagnosticCaseResult[];
  promptVersion: string;
  model?: string;
  payload?: {
    underEffectiveTarget: WeeklyInsightPayloadGateStatus;
    atEffectiveTarget: WeeklyInsightPayloadGateStatus;
  };
}): WeeklyInsightDiagnosticManifest {
  const payload = input.payload ?? {
    underEffectiveTarget: 'PASS',
    atEffectiveTarget: 'PASS',
  };
  const payloadFailed = Object.values(payload).some((status) => status === 'FAIL');
  const underResult = caseResultFor(input.results, 'within_effective_target');
  const atResult = caseResultFor(input.results, 'at_effective_target');
  const hasIncorrectAiResult = input.results.some((result) => result.semanticStatus === 'INCORRECT');
  const hasUnverifiedAiResult = input.results.some((result) => result.semanticStatus === 'UNVERIFIED');
  const hasMissingAiResult = !underResult || !atResult;

  let diagnosis: WeeklyInsightDiagnosticManifest['diagnosis'] = 'C';
  let status: WeeklyInsightDiagnosticManifest['status'] = 'VERIFIED';
  let gate: WeeklyInsightDiagnosticGate = 'NO_RED';
  if (payloadFailed) {
    diagnosis = 'A';
    gate = 'RED_CONFIRMED_A';
  } else if (hasUnverifiedAiResult || hasMissingAiResult) {
    status = 'UNVERIFIED';
    gate = 'UNVERIFIED';
  } else if (hasIncorrectAiResult) {
    diagnosis = 'B';
    gate = 'RED_CONFIRMED_B';
  }

  return {
    diagnosis,
    status,
    gate,
    payload,
    ai: {
      underEffectiveTarget: caseStatus(underResult),
      atEffectiveTarget: caseStatus(atResult),
    },
    evidence: {
      promptVersion: input.promptVersion,
      model: input.model ?? getWeeklyInsightEvalModel(),
      cases: [...input.results],
    },
  };
}
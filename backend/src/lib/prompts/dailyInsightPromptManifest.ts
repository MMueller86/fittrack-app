import {
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
} from './dailyInsightPrompt';

export interface DailyInsightPromptRelease {
  releaseId: string;
  promptVersion: string;
  assemblyVersion: string;
  promptFingerprint: string;
  providerInputCompatibility: 'byte-identical-to-v14-baseline' | 'changed';
}

export const DAILY_INSIGHT_PROMPT_RELEASES = [
  {
    releaseId: 'v14',
    promptVersion: 'v14',
    assemblyVersion: 'v1',
    promptFingerprint: 'sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a',
    providerInputCompatibility: 'byte-identical-to-v14-baseline',
  },
] as const satisfies readonly DailyInsightPromptRelease[];

export const DAILY_INSIGHT_PROMPT_MANIFEST = DAILY_INSIGHT_PROMPT_RELEASES;

export const DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE = DAILY_INSIGHT_PROMPT_RELEASES.at(-1)!;

export const DAILY_INSIGHT_ACTIVE_PROMPT_FINGERPRINT = DAILY_INSIGHT_PROMPT_FINGERPRINT;
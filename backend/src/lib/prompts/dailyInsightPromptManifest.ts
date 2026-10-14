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
  {
    releaseId: 'v15',
    promptVersion: 'v15',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:cc443460df1cac7b4475c56d469ec0bebcf3bbb8a2669505147fc50f45694264',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v16',
    promptVersion: 'v16',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:3e68d4dd0b6e49003936a278f3e65d693645ebfb41ee5ced3ea7daa3efa70893',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v17',
    promptVersion: 'v17',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v18',
    promptVersion: 'v18',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:853697f9be7a8234443ff6ac89470485bb5e45a528539425a48b0f0e54f2ddae',
    providerInputCompatibility: 'changed',
  },
] as const satisfies readonly DailyInsightPromptRelease[];

export const DAILY_INSIGHT_PROMPT_MANIFEST = DAILY_INSIGHT_PROMPT_RELEASES;

export const DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE = DAILY_INSIGHT_PROMPT_RELEASES.at(-1)!;

export const DAILY_INSIGHT_ACTIVE_PROMPT_FINGERPRINT = DAILY_INSIGHT_PROMPT_FINGERPRINT;
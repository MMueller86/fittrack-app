import { describe, expect, it } from 'vitest';
import {
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_VERSION,
  computeDailyInsightPromptFingerprint,
  DAILY_INSIGHT_PROMPT_BUNDLE,
} from './dailyInsightPrompt';
import {
  DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE,
  DAILY_INSIGHT_PROMPT_RELEASES,
} from './dailyInsightPromptManifest';

describe('daily insight prompt release manifest', () => {
  it('locks the active release to the computed bundle fingerprint', () => {
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE).toEqual(
      DAILY_INSIGHT_PROMPT_RELEASES[DAILY_INSIGHT_PROMPT_RELEASES.length - 1],
    );
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE.promptVersion).toBe(DAILY_INSIGHT_PROMPT_VERSION);
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE.assemblyVersion)
      .toBe(DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION);
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE.promptFingerprint)
      .toBe(computeDailyInsightPromptFingerprint(DAILY_INSIGHT_PROMPT_BUNDLE));
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE.promptFingerprint)
      .toBe(DAILY_INSIGHT_PROMPT_FINGERPRINT);
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE.providerInputCompatibility)
      .toBe('changed');
  });

  it('preserves the v14 release record exactly', () => {
    expect(DAILY_INSIGHT_PROMPT_RELEASES[0]).toEqual({
      releaseId: 'v14',
      promptVersion: 'v14',
      assemblyVersion: 'v1',
      promptFingerprint: 'sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a',
      providerInputCompatibility: 'byte-identical-to-v14-baseline',
    });
  });

  it('uses v15 as the only active release after the preserved v14 record', () => {
    expect(DAILY_INSIGHT_PROMPT_RELEASES).toHaveLength(2);
    expect(DAILY_INSIGHT_PROMPT_RELEASES[1]).toMatchObject({
      releaseId: 'v15',
      promptVersion: 'v15',
      assemblyVersion: 'v2',
      providerInputCompatibility: 'changed',
    });
  });

  it('keeps release IDs unique and monotonically increasing', () => {
    const releaseNumbers = DAILY_INSIGHT_PROMPT_RELEASES.map((release) => {
      expect(release.releaseId).toMatch(/^v\d+$/);
      return Number(release.releaseId.slice(1));
    });

    expect(new Set(releaseNumbers).size).toBe(releaseNumbers.length);
    for (let index = 1; index < releaseNumbers.length; index += 1) {
      expect(releaseNumbers[index]).toBeGreaterThan(releaseNumbers[index - 1]!);
    }
  });
});
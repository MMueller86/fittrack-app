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
      .toBe('byte-identical-to-v14-baseline');
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
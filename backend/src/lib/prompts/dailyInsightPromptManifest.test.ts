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

  it('preserves v15 through v29 and appends v30 as the active release', () => {
    expect(DAILY_INSIGHT_PROMPT_RELEASES).toHaveLength(17);
    expect(DAILY_INSIGHT_PROMPT_RELEASES[1]).toEqual({
      releaseId: 'v15',
      promptVersion: 'v15',
      assemblyVersion: 'v2',
      promptFingerprint: 'sha256:cc443460df1cac7b4475c56d469ec0bebcf3bbb8a2669505147fc50f45694264',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[2]).toEqual({
      releaseId: 'v16', promptVersion: 'v16', assemblyVersion: 'v2',
      promptFingerprint: 'sha256:3e68d4dd0b6e49003936a278f3e65d693645ebfb41ee5ced3ea7daa3efa70893',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[3]).toEqual({
      releaseId: 'v17', promptVersion: 'v17', assemblyVersion: 'v2',
      promptFingerprint: 'sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[4]).toEqual({
      releaseId: 'v18', promptVersion: 'v18', assemblyVersion: 'v2',
      promptFingerprint: 'sha256:853697f9be7a8234443ff6ac89470485bb5e45a528539425a48b0f0e54f2ddae',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[5]).toEqual({
      releaseId: 'v19', promptVersion: 'v19', assemblyVersion: 'v2', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:ffa03211d84678dcb2e587815d1132938486bf0985005641d546cef393f43c8b',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[9]).toMatchObject({
      releaseId: 'v23', promptVersion: 'v23', assemblyVersion: 'v7', providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[11]).toEqual({
      releaseId: 'v25',
      promptVersion: 'v24',
      assemblyVersion: 'v9',
      promptFingerprint: 'sha256:a753953a31d9b9563eb7fb31f1e7625684119858a0a638b6bddc7524555799b2',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[12]).toEqual({
      releaseId: 'v26',
      promptVersion: 'v25',
      assemblyVersion: 'v10',
      promptFingerprint: 'sha256:ebd9ba3c7803dbc5914e1c33b31e014caa6540252f4db5b9a53ab288cb5361f9',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[13]).toEqual({
      releaseId: 'v27', promptVersion: 'v26', assemblyVersion: 'v11', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:2158e931294906da6dd31ffbf2124121d8425e9852475e1f1d00f6c62e48e157',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[14]).toEqual({
      releaseId: 'v28', promptVersion: 'v27', assemblyVersion: 'v12', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:73525f3f417265ff42f9069b2d4bb6394ef6edef0757ad9417be6c886041ca2c',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[15]).toEqual({
      releaseId: 'v29', promptVersion: 'v28', assemblyVersion: 'v13', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:822dc1b0485bbfe0bb29024e8475f4d321224c830ddb1f0a4c078881e4a93c28',
    });
    expect(DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE).toMatchObject({
      releaseId: 'v30', promptVersion: 'v29', assemblyVersion: 'v13', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[12]).toMatchObject({
      releaseId: 'v26', promptVersion: 'v25', assemblyVersion: 'v10', providerInputCompatibility: 'changed',
      promptFingerprint: 'sha256:ebd9ba3c7803dbc5914e1c33b31e014caa6540252f4db5b9a53ab288cb5361f9',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[6]).toEqual({
      releaseId: 'v20', promptVersion: 'v20', assemblyVersion: 'v2',
      promptFingerprint: 'sha256:3d592bf92d7cf4b756097522686e2476211110c66dd1c58313831995ddc19239',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[7]).toEqual({
      releaseId: 'v21', promptVersion: 'v21', assemblyVersion: 'v3',
      promptFingerprint: 'sha256:4d3fec770559a95634d806a94ff50e921024c21c3a5a9c2552a669e3732f6240',
      providerInputCompatibility: 'changed',
    });
    expect(DAILY_INSIGHT_PROMPT_RELEASES[8]).toEqual({
      releaseId: 'v22', promptVersion: 'v22', assemblyVersion: 'v3',
      promptFingerprint: 'sha256:6cebf99f33c21220dfc02ff6741e03b15329b5ba93af1ff72bf32903d27714b9',
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
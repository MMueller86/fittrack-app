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
  {
    releaseId: 'v19',
    promptVersion: 'v19',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:ffa03211d84678dcb2e587815d1132938486bf0985005641d546cef393f43c8b',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v20',
    promptVersion: 'v20',
    assemblyVersion: 'v2',
    promptFingerprint: 'sha256:3d592bf92d7cf4b756097522686e2476211110c66dd1c58313831995ddc19239',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v21',
    promptVersion: 'v21',
    assemblyVersion: 'v3',
    promptFingerprint: 'sha256:4d3fec770559a95634d806a94ff50e921024c21c3a5a9c2552a669e3732f6240',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v22',
    promptVersion: 'v22',
    assemblyVersion: 'v3',
    promptFingerprint: 'sha256:6cebf99f33c21220dfc02ff6741e03b15329b5ba93af1ff72bf32903d27714b9',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v23',
    promptVersion: 'v23',
    assemblyVersion: 'v7',
    promptFingerprint: 'sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v24',
    promptVersion: 'v23',
    assemblyVersion: 'v8',
    promptFingerprint: 'sha256:a3d601ae4a68d4257af49d14e84b66993293507c590125e2504cc51720bcaa96',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v25',
    promptVersion: 'v24',
    assemblyVersion: 'v9',
    promptFingerprint: 'sha256:a753953a31d9b9563eb7fb31f1e7625684119858a0a638b6bddc7524555799b2',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v26',
    promptVersion: 'v25',
    assemblyVersion: 'v10',
    promptFingerprint: 'sha256:ebd9ba3c7803dbc5914e1c33b31e014caa6540252f4db5b9a53ab288cb5361f9',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v27',
    promptVersion: 'v26',
    assemblyVersion: 'v11',
    promptFingerprint: 'sha256:2158e931294906da6dd31ffbf2124121d8425e9852475e1f1d00f6c62e48e157',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v28',
    promptVersion: 'v27',
    assemblyVersion: 'v12',
    promptFingerprint: 'sha256:73525f3f417265ff42f9069b2d4bb6394ef6edef0757ad9417be6c886041ca2c',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v29',
    promptVersion: 'v28',
    assemblyVersion: 'v13',
    promptFingerprint: 'sha256:822dc1b0485bbfe0bb29024e8475f4d321224c830ddb1f0a4c078881e4a93c28',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v30',
    promptVersion: 'v29',
    assemblyVersion: 'v13',
    promptFingerprint: 'sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb',
    providerInputCompatibility: 'changed',
  },
  {
    releaseId: 'v31',
    promptVersion: 'v30',
    assemblyVersion: 'v14',
    promptFingerprint: 'sha256:e23c5274df5afabbd3812c53a773ab88b31ee7239785bcf8e0065ff63184ea2a',
    providerInputCompatibility: 'changed',
  },
] as const satisfies readonly DailyInsightPromptRelease[];

export const DAILY_INSIGHT_PROMPT_MANIFEST = DAILY_INSIGHT_PROMPT_RELEASES;

export const DAILY_INSIGHT_ACTIVE_PROMPT_RELEASE = DAILY_INSIGHT_PROMPT_RELEASES.at(-1)!;

export const DAILY_INSIGHT_ACTIVE_PROMPT_FINGERPRINT = DAILY_INSIGHT_PROMPT_FINGERPRINT;
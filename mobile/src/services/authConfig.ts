// Entra External ID (CIAM) OAuth configuration.
// All values derived from environment variables set in mobile/.env.

const CLIENT_ID = process.env['EXPO_PUBLIC_AUTH_CLIENT_ID'] ?? '';
const TENANT_ID = process.env['EXPO_PUBLIC_AUTH_TENANT_ID'] ?? '';
const CIAM_HOST = process.env['EXPO_PUBLIC_AUTH_CIAM_HOST'] ?? '';
const API_SCOPE = process.env['EXPO_PUBLIC_AUTH_API_SCOPE'] ?? '';

if (!CLIENT_ID || !TENANT_ID || !CIAM_HOST || !API_SCOPE) {
  throw new Error(
    'Missing auth env vars. Set EXPO_PUBLIC_AUTH_CLIENT_ID, EXPO_PUBLIC_AUTH_TENANT_ID, ' +
      'EXPO_PUBLIC_AUTH_CIAM_HOST, and EXPO_PUBLIC_AUTH_API_SCOPE in mobile/.env.',
  );
}

/** Base authority URL for the CIAM tenant. */
const authority = `https://${CIAM_HOST}/${TENANT_ID}`;

export const authConfig = {
  clientId: CLIENT_ID,
  tenantId: TENANT_ID,
  ciamHost: CIAM_HOST,

  /** OAuth scopes to request — API access + openid + profile + offline for refresh. */
  scopes: [API_SCOPE, 'openid', 'profile', 'offline_access'] as string[],

  /** OIDC Discovery document URL. */
  discoveryUrl: `${authority}/v2.0/.well-known/openid-configuration`,

  /** Authorization endpoint. */
  authorizationEndpoint: `${authority}/oauth2/v2.0/authorize`,

  /** Token endpoint. */
  tokenEndpoint: `${authority}/oauth2/v2.0/token`,
} as const;

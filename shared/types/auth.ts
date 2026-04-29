// Auth types — stub
// Will be populated in M2 (Auth + Onboarding milestone)

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string; // userId
  iat: number;
  exp: number;
}

export interface TokenPayload {
  email: string;
  sub: string; // userId
  role: string;
  refreshTokenId: string; // To track session, if refresh token correspoding to this access token isn't revoked or expired, the access token is valid, one logout, refresh token is revoked, so this tracks the session on access token without storing it in the DB
}

export interface ExchangeTokenPayload {
  sub: string; // userId
}

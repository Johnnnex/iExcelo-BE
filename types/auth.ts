export interface TokenPayload {
  email: string;
  sub: string; // userId
  role: string;
  refreshTokenId?: string; // Present on student/sponsor tokens. Absent on admin tokens (which use a separate JWT strategy).
}

export interface ExchangeTokenPayload {
  sub: string; // userId
}

export type VerifiedGoogleUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export function validateGoogleTokenInfo(
  tokenInfo: unknown,
  expectedAudience: string,
  nowSeconds?: number
): VerifiedGoogleUser | null;

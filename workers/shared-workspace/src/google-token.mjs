const GOOGLE_TOKEN_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);

export function validateGoogleTokenInfo(
  tokenInfo,
  expectedAudience,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!tokenInfo || typeof tokenInfo !== "object" || !expectedAudience) {
    return null;
  }

  const emailVerified =
    tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
  const expiresAt = Number(tokenInfo.exp);

  if (
    typeof tokenInfo.sub !== "string" ||
    !tokenInfo.sub ||
    typeof tokenInfo.email !== "string" ||
    !tokenInfo.email ||
    !emailVerified ||
    !GOOGLE_TOKEN_ISSUERS.has(tokenInfo.iss) ||
    tokenInfo.aud !== expectedAudience ||
    (tokenInfo.azp !== undefined && tokenInfo.azp !== expectedAudience) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= nowSeconds
  ) {
    return null;
  }

  return {
    sub: tokenInfo.sub,
    email: tokenInfo.email,
    name:
      typeof tokenInfo.name === "string" && tokenInfo.name
        ? tokenInfo.name
        : tokenInfo.email,
    picture: typeof tokenInfo.picture === "string" ? tokenInfo.picture : "",
  };
}

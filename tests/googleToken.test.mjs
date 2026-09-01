import assert from "node:assert/strict";
import test from "node:test";

import { validateGoogleTokenInfo } from "../workers/shared-workspace/src/google-token.mjs";

const AUDIENCE =
  "535942499060-ud6v12q3flq77fqcld4u6scd8a7t6h4e.apps.googleusercontent.com";

function validToken(overrides = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    azp: AUDIENCE,
    sub: "google-user-id",
    email: "clinician@example.com",
    email_verified: "true",
    name: "Example Clinician",
    picture: "https://example.com/avatar.png",
    exp: "2000",
    ...overrides,
  };
}

test("accepts a current verified token issued to this OAuth client", () => {
  assert.deepEqual(validateGoogleTokenInfo(validToken(), AUDIENCE, 1000), {
    sub: "google-user-id",
    email: "clinician@example.com",
    name: "Example Clinician",
    picture: "https://example.com/avatar.png",
  });
});

test("rejects tokens issued to another OAuth client", () => {
  assert.equal(
    validateGoogleTokenInfo(
      validToken({ aud: "other.apps.googleusercontent.com" }),
      AUDIENCE,
      1000
    ),
    null
  );
});

test("rejects unverified, expired, and non-Google identities", () => {
  assert.equal(
    validateGoogleTokenInfo(validToken({ email_verified: "false" }), AUDIENCE, 1000),
    null
  );
  assert.equal(
    validateGoogleTokenInfo(validToken({ exp: "1000" }), AUDIENCE, 1000),
    null
  );
  assert.equal(
    validateGoogleTokenInfo(validToken({ iss: "https://example.com" }), AUDIENCE, 1000),
    null
  );
});

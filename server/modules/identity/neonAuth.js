const { createRemoteJWKSet, jwtVerify } = require("jose");

function neonAuthOrigin(baseUrl) {
  return new URL(baseUrl).origin;
}

function createNeonTokenVerifier(neonAuthBaseUrl) {
  if (!neonAuthBaseUrl) {
    return async function unavailableNeonToken() {
      const error = new Error("Neon Auth is not configured.");
      error.code = "NEON_AUTH_UNCONFIGURED";
      throw error;
    };
  }

  const authBase = neonAuthBaseUrl.replace(/\/$/, "");
  const JWKS = createRemoteJWKSet(new URL(`${authBase}/.well-known/jwks.json`));
  const issuer = neonAuthOrigin(authBase);

  return async function verifyNeonToken(token) {
    if (typeof token !== "string" || !token.trim()) {
      const error = new Error("Neon Auth token is required.");
      error.code = "NEON_TOKEN_MISSING";
      throw error;
    }

    const { payload } = await jwtVerify(token.trim(), JWKS, {
      issuer,
      audience: [issuer, authBase],
      algorithms: ["EdDSA"],
    });

    const neonUserId = payload.sub || payload.id;
    const email =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

    if (!neonUserId || !email) {
      const error = new Error("Neon Auth token is missing identity claims.");
      error.code = "NEON_TOKEN_INVALID";
      throw error;
    }

    return {
      neonUserId: String(neonUserId),
      email,
      name: typeof payload.name === "string" ? payload.name.trim() : null,
      image: typeof payload.image === "string" ? payload.image.trim() : null,
      emailVerified: Boolean(payload.emailVerified),
      payload,
    };
  };
}

module.exports = {
  createNeonTokenVerifier,
  neonAuthOrigin,
};

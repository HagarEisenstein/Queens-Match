const {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  errors: joseErrors,
  jwtVerify,
} = require("jose");

function neonAuthOrigin(baseUrl) {
  return new URL(baseUrl).origin;
}

function neonAuthPath(baseUrl) {
  try {
    return new URL(baseUrl).pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * Pick the configured Neon Auth base URL.
 *
 * A Neon Auth URL always carries a `/<database>/auth` path, and the JWKS lives
 * under that full path. An origin-only value silently yields a 404 JWKS, so
 * prefer a candidate that includes the path over one that does not.
 */
function resolveNeonAuthBaseUrl(candidates = [], { logger = console } = {}) {
  const configured = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .map((value) => value.replace(/\/$/, ""));

  if (!configured.length) return "";

  const withAuthPath = configured.find((value) => neonAuthPath(value));
  if (!withAuthPath) {
    logger.warn?.(
      "[neon-auth] Configured Neon Auth URL has no /<database>/auth path; JWKS lookups will fail.",
      { host: (() => {
          try {
            return new URL(configured[0]).host;
          } catch {
            return null;
          }
        })() }
    );
    return configured[0];
  }

  if (withAuthPath !== configured[0]) {
    logger.warn?.(
      "[neon-auth] Ignoring a Neon Auth URL without a /<database>/auth path in favour of one that has it.",
      { usingPath: neonAuthPath(withAuthPath) }
    );
  }

  return withAuthPath;
}

function sanitizeClaimValue(value) {
  if (value == null) return { present: false };
  if (typeof value === "number") return { present: true, type: "number" };
  if (typeof value === "boolean") return { present: true, type: "boolean" };
  if (Array.isArray(value)) {
    return {
      present: true,
      type: "array",
      length: value.length,
      items: value.map(sanitizeClaimValue),
    };
  }
  if (typeof value !== "string") {
    return { present: true, type: typeof value };
  }
  try {
    const url = new URL(value);
    return {
      present: true,
      type: "url",
      origin: url.origin,
      pathname: url.pathname,
      host: url.host,
    };
  } catch {
    return {
      present: true,
      type: "string",
      length: value.length,
    };
  }
}

function inspectTokenShape(token) {
  try {
    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token);
    return {
      header: {
        alg: typeof header.alg === "string" ? header.alg : null,
        kid: typeof header.kid === "string" ? header.kid : null,
        typ: typeof header.typ === "string" ? header.typ : null,
        keys: Object.keys(header).sort(),
      },
      claimNames: Object.keys(payload).sort(),
      iss: sanitizeClaimValue(payload.iss),
      aud: sanitizeClaimValue(payload.aud),
      hasSub: typeof payload.sub === "string" && payload.sub.length > 0,
      hasId: typeof payload.id === "string" && payload.id.length > 0,
      hasEmail: typeof payload.email === "string" && payload.email.includes("@"),
      emailVerifiedKey: Object.prototype.hasOwnProperty.call(
        payload,
        "emailVerified"
      )
        ? "emailVerified"
        : Object.prototype.hasOwnProperty.call(payload, "email_verified")
          ? "email_verified"
          : null,
      hasExp: typeof payload.exp === "number",
      hasIat: typeof payload.iat === "number",
    };
  } catch (error) {
    return {
      inspectError: error?.name || "inspect_failed",
      inspectCode: error?.code || null,
    };
  }
}

function logNeonVerifyDebug(event, details = {}) {
  // Safe diagnostics only — never raw JWTs, cookies, secrets, or auth headers.
  console.info("[neon-auth-verify]", event, details);
}

function createNeonError(code, message, cause, details) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  if (details) error.details = details;
  return error;
}

function mapJoseVerifyError(error, details) {
  const joseCode = typeof error?.code === "string" ? error.code : null;
  const claim = error?.claim || null;

  if (
    error instanceof joseErrors.JWTExpired ||
    joseCode === "ERR_JWT_EXPIRED"
  ) {
    return createNeonError(
      "NEON_TOKEN_EXPIRED",
      "Neon Auth token has expired.",
      error,
      details
    );
  }

  if (
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    joseCode === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"
  ) {
    return createNeonError(
      "NEON_TOKEN_INVALID_SIGNATURE",
      "Neon Auth token signature is invalid.",
      error,
      details
    );
  }

  if (
    error instanceof joseErrors.JWKSNoMatchingKey ||
    joseCode === "ERR_JWKS_NO_MATCHING_KEY"
  ) {
    return createNeonError(
      "NEON_TOKEN_INVALID_SIGNATURE",
      "Neon Auth token signing key was not found in JWKS.",
      error,
      details
    );
  }

  if (
    error instanceof joseErrors.JOSEAlgNotAllowed ||
    joseCode === "ERR_JOSE_ALG_NOT_ALLOWED"
  ) {
    return createNeonError(
      "NEON_TOKEN_INVALID",
      "Neon Auth token algorithm is not allowed.",
      error,
      details
    );
  }

  if (
    error instanceof joseErrors.JWTClaimValidationFailed ||
    joseCode === "ERR_JWT_CLAIM_VALIDATION_FAILED"
  ) {
    if (claim === "iss") {
      return createNeonError(
        "NEON_TOKEN_INVALID_ISSUER",
        "Neon Auth token issuer is invalid.",
        error,
        details
      );
    }
    if (claim === "aud") {
      return createNeonError(
        "NEON_TOKEN_INVALID_AUDIENCE",
        "Neon Auth token audience is invalid.",
        error,
        details
      );
    }
    if (claim === "exp") {
      return createNeonError(
        "NEON_TOKEN_EXPIRED",
        "Neon Auth token has expired.",
        error,
        details
      );
    }
    return createNeonError(
      "NEON_TOKEN_INVALID",
      `Neon Auth token claim validation failed (${claim || "unknown"}).`,
      error,
      details
    );
  }

  if (
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSInvalid ||
    joseCode === "ERR_JWT_INVALID" ||
    joseCode === "ERR_JWS_INVALID"
  ) {
    return createNeonError(
      "NEON_TOKEN_INVALID",
      "Neon Auth token is malformed.",
      error,
      details
    );
  }

  // JWKS retrieval problems are a server/configuration fault, not a bad token:
  // without the public key every signature check fails for every user.
  if (
    error instanceof joseErrors.JWKSInvalid ||
    error instanceof joseErrors.JWKSTimeout ||
    joseCode === "ERR_JWKS_TIMEOUT" ||
    joseCode === "ERR_JWKS_INVALID" ||
    /JSON Web Key Set/i.test(String(error?.message || "")) ||
    /fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(
      String(error?.message || "")
    )
  ) {
    return createNeonError(
      "NEON_JWKS_UNAVAILABLE",
      "Unable to load the Neon Auth JWKS for verification. Check NEON_AUTH_BASE_URL.",
      error,
      details
    );
  }

  return createNeonError(
    "NEON_TOKEN_INVALID",
    "Neon Auth token verification failed.",
    error,
    {
      ...details,
      joseCode,
      joseName: error?.name || null,
      joseMessage: typeof error?.message === "string" ? error.message : null,
    }
  );
}

/**
 * Create a Neon Auth JWT verifier.
 *
 * Official Neon guidance verifies EdDSA signatures against
 * `${NEON_AUTH_BASE_URL}/.well-known/jwks.json` and checks issuer against the
 * Auth URL origin. Managed Better Auth uses that origin for both iss and aud.
 *
 * @see https://neon.com/docs/auth/guides/plugins/jwt
 * @see https://neon.com/docs/compute/functions/authentication
 */
function createNeonTokenVerifier(neonAuthBaseUrl) {
  if (!neonAuthBaseUrl) {
    return async function unavailableNeonToken() {
      throw createNeonError(
        "NEON_AUTH_UNCONFIGURED",
        "Neon Auth is not configured."
      );
    };
  }

  const authBase = neonAuthBaseUrl.replace(/\/$/, "");
  const origin = neonAuthOrigin(authBase);
  const jwksUrl = new URL(`${authBase}/.well-known/jwks.json`);
  const JWKS = createRemoteJWKSet(jwksUrl);

  // These values come only from server configuration. Neon JWTs use the Auth
  // URL origin (without /neondb/auth) for both issuer and audience.
  const expectedIssuers = [origin];
  const expectedAudiences = [origin];

  return async function verifyNeonToken(token) {
    if (typeof token !== "string" || !token.trim()) {
      throw createNeonError(
        "NEON_TOKEN_MISSING",
        "Neon Auth token is required."
      );
    }

    const compact = token.trim();
    const shape = inspectTokenShape(compact);
    const debugDetails = {
      jwksHost: jwksUrl.host,
      jwksPath: jwksUrl.pathname,
      expectedIssuers: expectedIssuers.map((value) => sanitizeClaimValue(value)),
      expectedAudiences: expectedAudiences.map((value) =>
        sanitizeClaimValue(value)
      ),
      tokenShape: shape,
    };

    try {
      // Pin every security-relevant part of the Managed Better Auth contract.
      const { payload, protectedHeader } = await jwtVerify(compact, JWKS, {
        issuer: origin,
        audience: origin,
        algorithms: ["EdDSA"],
        requiredClaims: ["exp", "sub", "iss", "aud", "email", "emailVerified"],
        clockTolerance: 5,
      });

      if (protectedHeader.alg !== "EdDSA") {
        throw createNeonError(
          "NEON_TOKEN_INVALID",
          "Neon Auth token algorithm is not allowed.",
          null,
          debugDetails
        );
      }

      const neonUserId = payload.sub;
      const email =
        typeof payload.email === "string"
          ? payload.email.trim().toLowerCase()
          : "";

      if (!neonUserId || typeof neonUserId !== "string" || !email) {
        logNeonVerifyDebug("missing_identity_claims", debugDetails);
        throw createNeonError(
          "NEON_TOKEN_MISSING_CLAIMS",
          "Neon Auth token is missing required identity claims.",
          null,
          debugDetails
        );
      }

      if (neonUserId === "anonymous") {
        throw createNeonError(
          "NEON_TOKEN_INVALID",
          "Anonymous Neon Auth tokens are not accepted.",
          null,
          debugDetails
        );
      }

      const emailVerified = Object.prototype.hasOwnProperty.call(
        payload,
        "emailVerified"
      )
        ? payload.emailVerified === true
        : Object.prototype.hasOwnProperty.call(payload, "email_verified")
          ? payload.email_verified === true
          : false;

      if (!emailVerified) {
        throw createNeonError(
          "NEON_TOKEN_UNVERIFIED_EMAIL",
          "Neon Auth identity must contain a verified email.",
          null,
          debugDetails
        );
      }

      return {
        neonUserId: String(neonUserId),
        email,
        name: typeof payload.name === "string" ? payload.name.trim() : null,
        image: typeof payload.image === "string" ? payload.image.trim() : null,
        emailVerified,
        payload,
      };
    } catch (error) {
      if (error?.code?.startsWith?.("NEON_")) {
        throw error;
      }

      const mapped = mapJoseVerifyError(error, debugDetails);
      logNeonVerifyDebug("verify_failed", {
        errorCode: mapped.code,
        joseCode: error?.code || null,
        joseName: error?.name || null,
        joseClaim: error?.claim || null,
        joseReason: error?.reason || null,
        joseMessage:
          typeof error?.message === "string" ? error.message : null,
        ...debugDetails,
      });
      throw mapped;
    }
  };
}

module.exports = {
  createNeonTokenVerifier,
  neonAuthOrigin,
  neonAuthPath,
  resolveNeonAuthBaseUrl,
  sanitizeClaimValue,
  inspectTokenShape,
  mapJoseVerifyError,
};

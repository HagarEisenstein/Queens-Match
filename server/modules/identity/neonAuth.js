const {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  errors: joseErrors,
  jwtVerify,
} = require("jose");

const NEON_AUTH_DEBUG =
  process.env.NEON_AUTH_DEBUG === "1" || process.env.NODE_ENV !== "production";

function neonAuthOrigin(baseUrl) {
  return new URL(baseUrl).origin;
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
    };
  }
}

function logNeonVerifyDebug(event, details = {}) {
  if (!NEON_AUTH_DEBUG) return;
  // Never log raw JWTs, cookies, secrets, or Authorization headers.
  console.info("[neon-auth-verify]", event, details);
}

function createNeonError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function mapJoseVerifyError(error) {
  if (error instanceof joseErrors.JWTExpired) {
    return createNeonError(
      "NEON_TOKEN_EXPIRED",
      "Neon Auth token has expired.",
      error
    );
  }

  if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
    return createNeonError(
      "NEON_TOKEN_INVALID_SIGNATURE",
      "Neon Auth token signature is invalid.",
      error
    );
  }

  if (error instanceof joseErrors.JWKSNoMatchingKey) {
    return createNeonError(
      "NEON_TOKEN_INVALID_SIGNATURE",
      "Neon Auth token signing key was not found in JWKS.",
      error
    );
  }

  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    const claim = error.claim || "";
    if (claim === "iss") {
      return createNeonError(
        "NEON_TOKEN_INVALID_ISSUER",
        "Neon Auth token issuer is invalid.",
        error
      );
    }
    if (claim === "aud") {
      return createNeonError(
        "NEON_TOKEN_INVALID_AUDIENCE",
        "Neon Auth token audience is invalid.",
        error
      );
    }
    if (claim === "exp") {
      return createNeonError(
        "NEON_TOKEN_EXPIRED",
        "Neon Auth token has expired.",
        error
      );
    }
    return createNeonError(
      "NEON_TOKEN_INVALID",
      `Neon Auth token claim validation failed (${claim || "unknown"}).`,
      error
    );
  }

  if (
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSInvalid
  ) {
    return createNeonError(
      "NEON_TOKEN_INVALID",
      "Neon Auth token is malformed.",
      error
    );
  }

  return createNeonError(
    "NEON_TOKEN_INVALID",
    "Neon Auth token verification failed.",
    error
  );
}

/**
 * Create a Neon Auth JWT verifier.
 *
 * Managed Better Auth signs with EdDSA (Ed25519). Live Neon tokens use the
 * Auth URL *origin* as `iss`/`aud` (not the `/neondb/auth` path). Better Auth's
 * library default is the full baseURL string; accept both values derived from
 * the configured NEON_AUTH_BASE_URL only.
 *
 * @see https://neon.com/docs/auth/guides/plugins/jwt
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

  // Only accept issuer/audience values that belong to this configured Neon Auth
  // instance — never trust values from the client or token alone.
  const expectedIssuers = [origin, authBase];
  const expectedAudiences = [origin, authBase];

  return async function verifyNeonToken(token) {
    if (typeof token !== "string" || !token.trim()) {
      throw createNeonError(
        "NEON_TOKEN_MISSING",
        "Neon Auth token is required."
      );
    }

    const compact = token.trim();
    const shape = inspectTokenShape(compact);

    try {
      const { payload, protectedHeader } = await jwtVerify(compact, JWKS, {
        issuer: expectedIssuers,
        audience: expectedAudiences,
        algorithms: ["EdDSA"],
        requiredClaims: ["exp", "sub", "iss", "aud"],
        clockTolerance: 5,
      });

      if (protectedHeader.alg !== "EdDSA") {
        throw createNeonError(
          "NEON_TOKEN_INVALID",
          "Neon Auth token algorithm is not allowed."
        );
      }

      const neonUserId = payload.sub || payload.id;
      const email =
        typeof payload.email === "string"
          ? payload.email.trim().toLowerCase()
          : "";

      if (!neonUserId || typeof neonUserId !== "string" || !email) {
        logNeonVerifyDebug("missing_identity_claims", {
          claimNames: shape.claimNames || null,
          hasSub: shape.hasSub,
          hasId: shape.hasId,
          hasEmail: shape.hasEmail,
          emailVerifiedKey: shape.emailVerifiedKey,
        });
        throw createNeonError(
          "NEON_TOKEN_MISSING_CLAIMS",
          "Neon Auth token is missing required identity claims."
        );
      }

      if (neonUserId === "anonymous") {
        throw createNeonError(
          "NEON_TOKEN_INVALID",
          "Anonymous Neon Auth tokens are not accepted."
        );
      }

      const emailVerified = Object.prototype.hasOwnProperty.call(
        payload,
        "emailVerified"
      )
        ? Boolean(payload.emailVerified)
        : Object.prototype.hasOwnProperty.call(payload, "email_verified")
          ? Boolean(payload.email_verified)
          : false;

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

      const mapped = mapJoseVerifyError(error);
      logNeonVerifyDebug("verify_failed", {
        errorCode: mapped.code,
        errorName: error?.name || null,
        joseClaim: error?.claim || null,
        joseReason: error?.reason || null,
        jwksHost: jwksUrl.host,
        expectedIssuers: expectedIssuers.map((value) =>
          sanitizeClaimValue(value)
        ),
        expectedAudiences: expectedAudiences.map((value) =>
          sanitizeClaimValue(value)
        ),
        tokenShape: shape,
      });
      throw mapped;
    }
  };
}

module.exports = {
  createNeonTokenVerifier,
  neonAuthOrigin,
  // test helpers
  sanitizeClaimValue,
  inspectTokenShape,
  mapJoseVerifyError,
};

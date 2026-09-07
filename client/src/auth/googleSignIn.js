import {
  GOOGLE_ROLES_KEY,
  googleCallbackUrl,
  isNeonAuthConfigured,
  neonAuthBaseUrl,
  neonAuthClient,
} from "./neonClient";

function looksLikeJwt(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const parts = value.trim().split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Neon Auth JWT acquisition for bridging into QueenB.
 *
 * Official Neon mechanisms (Managed Better Auth JWT plugin):
 * 1. `set-auth-jwt` response header on `getSession()`
 * 2. GET `{authBaseUrl}/token` → `{ token }` (JWT plugin endpoint)
 *
 * Do NOT use `neonAuthClient.token()` from @neondatabase/auth@0.5.0-beta /
 * neon-js@0.7.0-beta: the SDK maps `/token` onto the getSession cache hook, so
 * after a successful getSession() it returns cached `{ session, user }` instead
 * of `{ token }`, leaving `data.token` undefined.
 */
export async function readNeonAuthJwt() {
  if (!neonAuthClient || !neonAuthBaseUrl) {
    throw new Error("Neon Auth is not configured.");
  }

  let jwtFromHeader = null;

  const sessionResult = await neonAuthClient.getSession({
    fetchOptions: {
      onSuccess: (ctx) => {
        jwtFromHeader = ctx.response?.headers?.get("set-auth-jwt") || null;
      },
    },
  });

  if (sessionResult.error || !sessionResult.data?.session) {
    throw new Error(
      sessionResult.error?.message ||
        "No Neon Auth session found after Google sign-in."
    );
  }

  if (looksLikeJwt(jwtFromHeader)) {
    return jwtFromHeader.trim();
  }

  // Neon SDK injects set-auth-jwt into session.token when the header is readable.
  const injected = sessionResult.data?.session?.token;
  if (looksLikeJwt(injected)) {
    return injected.trim();
  }

  // Bypass the broken neonAuthClient.token() cache path with a direct JWT fetch.
  const tokenResponse = await fetch(`${neonAuthBaseUrl}/token`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  let tokenBody = null;
  try {
    tokenBody = await tokenResponse.json();
  } catch {
    tokenBody = null;
  }

  const tokenFromEndpoint =
    tokenBody && typeof tokenBody === "object" ? tokenBody.token : null;

  if (!tokenResponse.ok || !looksLikeJwt(tokenFromEndpoint)) {
    throw new Error(
      (tokenBody && tokenBody.message) ||
        `Unable to read Neon Auth JWT after Google sign-in. (HTTP ${tokenResponse.status})`
    );
  }

  return tokenFromEndpoint.trim();
}

export async function startGoogleSignIn({ roles } = {}) {
  if (!isNeonAuthConfigured || !neonAuthClient) {
    throw new Error(
      "Google sign-in is not configured. Set REACT_APP_NEON_AUTH_URL."
    );
  }

  if (roles) {
    sessionStorage.setItem(GOOGLE_ROLES_KEY, JSON.stringify(roles));
  } else {
    sessionStorage.removeItem(GOOGLE_ROLES_KEY);
  }

  const result = await neonAuthClient.signIn.social({
    provider: "google",
    callbackURL: googleCallbackUrl(),
    errorCallbackURL: `${window.location.origin}/login?google=error`,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Google sign-in failed.");
  }

  return result;
}

export function readPendingGoogleRoles() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_ROLES_KEY);
    sessionStorage.removeItem(GOOGLE_ROLES_KEY);
    if (!raw) return undefined;
    const roles = JSON.parse(raw);
    return Array.isArray(roles) ? roles : undefined;
  } catch {
    sessionStorage.removeItem(GOOGLE_ROLES_KEY);
    return undefined;
  }
}

export async function exchangeNeonSessionForQueenBToken(bridgeLogin) {
  const neonToken = await readNeonAuthJwt();
  const roles = readPendingGoogleRoles();
  return bridgeLogin({ neonToken, roles });
}

// Exported for unit tests only.
export const __testables = {
  looksLikeJwt,
};

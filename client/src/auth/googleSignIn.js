import {
  GOOGLE_ROLES_KEY,
  googleCallbackUrl,
  isNeonAuthConfigured,
  neonAuthClient,
} from "./neonClient";

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
  if (!neonAuthClient) {
    throw new Error("Neon Auth is not configured.");
  }

  const sessionResult = await neonAuthClient.getSession();
  if (sessionResult.error || !sessionResult.data?.session) {
    throw new Error(
      sessionResult.error?.message ||
        "No Neon Auth session found after Google sign-in."
    );
  }

  const tokenResult = await neonAuthClient.token();
  const neonToken = tokenResult.data?.token;
  if (tokenResult.error || !neonToken) {
    throw new Error(
      tokenResult.error?.message ||
        "Unable to read Neon Auth JWT after Google sign-in."
    );
  }

  const roles = readPendingGoogleRoles();
  return bridgeLogin({ neonToken, roles });
}

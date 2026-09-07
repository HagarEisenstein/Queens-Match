import { createAuthClient } from "@neondatabase/neon-js/auth";

const neonAuthUrl = process.env.REACT_APP_NEON_AUTH_URL || "";

export const isNeonAuthConfigured = Boolean(neonAuthUrl);

export const neonAuthClient = isNeonAuthConfigured
  ? createAuthClient(neonAuthUrl, {
      fetchOptions: {
        credentials: "include",
      },
    })
  : null;

export const GOOGLE_ROLES_KEY = "queenb_google_roles";
export const NEON_CALLBACK_PATH = "/auth/callback";

export function googleCallbackUrl() {
  return `${window.location.origin}${NEON_CALLBACK_PATH}`;
}

jest.mock("./neonClient", () => ({
  neonAuthBaseUrl: "https://auth.example.com/neondb/auth",
  neonAuthClient: {
    getSession: jest.fn(),
    token: jest.fn(),
    signIn: { social: jest.fn() },
  },
  isNeonAuthConfigured: true,
  GOOGLE_ROLES_KEY: "queenb_google_roles",
  googleCallbackUrl: () => "http://localhost/auth/callback",
}));

import {
  __testables,
  readNeonAuthJwt,
} from "./googleSignIn";
import { neonAuthClient } from "./neonClient";

const { looksLikeJwt } = __testables;

describe("looksLikeJwt", () => {
  test("accepts compact JWTs", () => {
    expect(looksLikeJwt("aaa.bbb.ccc")).toBe(true);
    expect(
      looksLikeJwt("eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiIxMjMifQ.signature-part")
    ).toBe(true);
  });

  test("rejects opaque session tokens and empty values", () => {
    expect(looksLikeJwt("")).toBe(false);
    expect(looksLikeJwt(null)).toBe(false);
    expect(looksLikeJwt("opaque-session-token")).toBe(false);
    expect(looksLikeJwt("only.two")).toBe(false);
    expect(looksLikeJwt("a.b.")).toBe(false);
  });
});

describe("readNeonAuthJwt", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test("uses set-auth-jwt from getSession when present", async () => {
    const jwt =
      "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJuZW9uLXVzZXIifQ.signature";

    neonAuthClient.getSession.mockImplementation(async ({ fetchOptions } = {}) => {
      const response = {
        headers: {
          get: (name) =>
            name.toLowerCase() === "set-auth-jwt" ? jwt : null,
        },
      };
      fetchOptions?.onSuccess?.({ response });
      return {
        data: {
          session: { token: "opaque-session-id", id: "s1" },
          user: { id: "u1", email: "a@b.com" },
        },
        error: null,
      };
    });

    await expect(readNeonAuthJwt()).resolves.toBe(jwt);
    expect(global.fetch).toBe(originalFetch);
  });

  test("falls back to direct /token fetch when header/session token are not JWTs", async () => {
    const jwt =
      "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJuZW9uLXVzZXIifQ.endpoint-sig";

    neonAuthClient.getSession.mockResolvedValue({
      data: {
        session: { token: "opaque-session-id", id: "s1" },
        user: { id: "u1", email: "a@b.com" },
      },
      error: null,
    });

    // Simulates neon-js cache bug if token() were used: session shape, no token field.
    neonAuthClient.token.mockResolvedValue({
      data: {
        session: { token: "opaque-session-id" },
        user: { id: "u1" },
      },
      error: null,
    });

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: jwt }),
    }));

    await expect(readNeonAuthJwt()).resolves.toBe(jwt);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://auth.example.com/neondb/auth/token",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
  });
});

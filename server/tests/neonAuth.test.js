const http = require("http");
const {
  exportJWK,
  generateKeyPair,
  SignJWT,
} = require("jose");
const {
  createNeonTokenVerifier,
  neonAuthOrigin,
  resolveNeonAuthBaseUrl,
} = require("../modules/identity/neonAuth");

async function mintNeonLikeToken({
  privateKey,
  kid,
  issuer,
  audience,
  claims = {},
  expOffsetSeconds = 900,
}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    name: "Google User",
    email: "google.user@example.com",
    emailVerified: true,
    image: "https://example.com/avatar.png",
    role: "authenticated",
    banned: false,
    id: "neon-user-123",
    ...claims,
  })
    .setProtectedHeader({ alg: "EdDSA", kid })
    .setSubject(claims.sub || "neon-user-123")
    .setIssuedAt(now)
    .setExpirationTime(now + expOffsetSeconds)
    .setIssuer(issuer)
    .setAudience(audience)
    .sign(privateKey);
}

function startJwksServer(jwk) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (
        req.url === "/.well-known/jwks.json" ||
        req.url === "/neondb/auth/.well-known/jwks.json"
      ) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        authBase: `http://127.0.0.1:${port}/neondb/auth`,
      });
    });
  });
}

describe("createNeonTokenVerifier", () => {
  let privateKey;
  let publicJwk;
  let server;
  let authBase;
  let origin;
  let verify;

  beforeAll(async () => {
    const kp = await generateKeyPair("EdDSA");
    privateKey = kp.privateKey;
    publicJwk = await exportJWK(kp.publicKey);
    publicJwk.alg = "EdDSA";
    publicJwk.kid = "6e430e99-9661-4119-9ffd-4deeb3c87bd6";
    publicJwk.crv = "Ed25519";
    publicJwk.kty = "OKP";

    ({ server, authBase } = await startJwksServer(publicJwk));
    origin = neonAuthOrigin(authBase);
    verify = createNeonTokenVerifier(authBase);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("verifies a Neon-shaped JWT with origin iss/aud (live Neon format)", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
    });

    const identity = await verify(token);
    expect(identity).toMatchObject({
      neonUserId: "neon-user-123",
      email: "google.user@example.com",
      name: "Google User",
      image: "https://example.com/avatar.png",
      emailVerified: true,
    });
  });

  test("rejects the auth base path as issuer because Neon uses the origin", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: authBase,
      audience: origin,
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_INVALID_ISSUER",
    });
  });

  test("rejects expired tokens with NEON_TOKEN_EXPIRED", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
      expOffsetSeconds: -30,
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_EXPIRED",
    });
  });

  test("rejects wrong issuer with NEON_TOKEN_INVALID_ISSUER", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: "https://evil.example",
      audience: origin,
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_INVALID_ISSUER",
    });
  });

  test("rejects wrong audience with NEON_TOKEN_INVALID_AUDIENCE", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: "https://evil.example",
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_INVALID_AUDIENCE",
    });
  });

  test("rejects tokens without the required Neon audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { SignJWT } = require("jose");
    const token = await new SignJWT({
      email: "google.user@example.com",
      emailVerified: true,
      id: "neon-user-123",
    })
      .setProtectedHeader({ alg: "EdDSA", kid: publicJwk.kid })
      .setSubject("neon-user-123")
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .setIssuer(origin)
      .sign(privateKey);

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_INVALID_AUDIENCE",
    });
  });

  test("rejects missing email with NEON_TOKEN_MISSING_CLAIMS", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
      claims: { email: null },
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_MISSING_CLAIMS",
    });
  });

  test("rejects an identity whose email is not verified", async () => {
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
      claims: { emailVerified: false },
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_UNVERIFIED_EMAIL",
    });
  });

  test("reports NEON_JWKS_UNAVAILABLE when the JWKS path returns 404", async () => {
    // Mirrors an auth URL configured without its /<database>/auth path.
    const misconfigured = createNeonTokenVerifier(`${origin}/wrong-path`);
    const token = await mintNeonLikeToken({
      privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
    });

    await expect(misconfigured(token)).rejects.toMatchObject({
      code: "NEON_JWKS_UNAVAILABLE",
    });
  });

  test("rejects bad signatures with NEON_TOKEN_INVALID_SIGNATURE", async () => {
    const other = await generateKeyPair("EdDSA");
    const token = await mintNeonLikeToken({
      privateKey: other.privateKey,
      kid: publicJwk.kid,
      issuer: origin,
      audience: origin,
    });

    await expect(verify(token)).rejects.toMatchObject({
      code: "NEON_TOKEN_INVALID_SIGNATURE",
    });
  });
});

describe("resolveNeonAuthBaseUrl", () => {
  const authUrl = "https://ep-example.neonauth.aws.neon.tech/neondb/auth";
  const originOnly = "https://ep-example.neonauth.aws.neon.tech";
  const logger = { warn: jest.fn() };

  beforeEach(() => {
    logger.warn.mockClear();
  });

  test("prefers a URL carrying the /<database>/auth path", () => {
    expect(
      resolveNeonAuthBaseUrl([originOnly, authUrl], { logger })
    ).toBe(authUrl);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("keeps the first candidate and warns when none carry an auth path", () => {
    expect(resolveNeonAuthBaseUrl([originOnly], { logger })).toBe(originOnly);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("strips trailing slashes and ignores blank candidates", () => {
    expect(
      resolveNeonAuthBaseUrl(["", "   ", `${authUrl}/`], { logger })
    ).toBe(authUrl);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("returns an empty string when nothing is configured", () => {
    expect(resolveNeonAuthBaseUrl([], { logger })).toBe("");
  });
});

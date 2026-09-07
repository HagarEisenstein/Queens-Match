const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { AppError } = require("../../middleware/errors");

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const OAUTH_SCOPE = "openid profile email";
const STATE_PURPOSE = "linkedin_oauth";
const STATE_TTL = "10m";
const PENDING_TTL_MS = 10 * 60 * 1000;

// Short-lived, single-use store for register-mode prefill data. The LinkedIn
// callback has no logged-in user to write to, so it stashes the fetched fields
// here and hands the client an opaque id (kept out of the redirect query only
// as a random token) to exchange for the data.
function createPendingStore(ttlMs = PENDING_TTL_MS) {
  const items = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of items) {
      if (entry.expiresAt <= now) items.delete(id);
    }
  }, ttlMs);
  timer.unref?.();
  return {
    put(data) {
      const id = crypto.randomBytes(24).toString("hex");
      items.set(id, { data, expiresAt: Date.now() + ttlMs });
      return id;
    },
    take(id) {
      const entry = items.get(id);
      if (!entry) return null;
      items.delete(id);
      if (entry.expiresAt <= Date.now()) return null;
      return entry.data;
    },
  };
}

function createLinkedinRouter({
  userRepository,
  authenticate,
  jwtSecret,
  config = {},
  fetchImpl,
  pendingStore = createPendingStore(),
  logger = console,
}) {
  const router = express.Router();
  const doFetch = fetchImpl || ((...args) => fetch(...args));

  const clientId = config.clientId || process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = config.redirectUri || process.env.LINKEDIN_REDIRECT_URI;
  const clientUrl = (
    config.clientUrl || process.env.CLIENT_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const isConfigured = Boolean(clientId && clientSecret && redirectUri);

  function ensureConfigured() {
    if (!isConfigured) {
      throw new AppError(
        501,
        "LINKEDIN_NOT_CONFIGURED",
        "LinkedIn sign-in is not configured on this server."
      );
    }
  }

  function buildAuthorizeUrl(statePayload) {
    const state = jwt.sign(
      { ...statePayload, purpose: STATE_PURPOSE },
      jwtSecret,
      { expiresIn: STATE_TTL }
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: OAUTH_SCOPE,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  // GET /start?mode=register|profile -> { url }
  router.get("/start", (req, res, next) => {
    let mode;
    try {
      ensureConfigured();
      mode = req.query.mode === "register" ? "register" : "profile";
    } catch (error) {
      return next(error);
    }

    if (mode === "register") {
      return res.json({ url: buildAuthorizeUrl({ mode: "register" }) });
    }

    // Profile mode links to the logged-in user, so it needs a valid token.
    return authenticate(req, res, (error) => {
      if (error) return next(error);
      return res.json({
        url: buildAuthorizeUrl({ mode: "profile", uid: req.user.id }),
      });
    });
  });

  // GET /callback?code&state -> redirects back to the client
  router.get("/callback", async (req, res) => {
    let basePath = "/profile";
    const redirectClient = (query) => res.redirect(`${clientUrl}${query}`);

    try {
      ensureConfigured();

      const { code, state, error: oauthError } = req.query;
      let claims = null;
      if (typeof state === "string") {
        try {
          claims = jwt.verify(state, jwtSecret);
        } catch {
          claims = null;
        }
      }
      const mode = claims?.mode === "register" ? "register" : "profile";
      basePath = mode === "register" ? "/register" : "/profile";

      if (!claims || claims.purpose !== STATE_PURPOSE) {
        return redirectClient(`${basePath}?linkedin=error`);
      }
      if (oauthError || !code) {
        return redirectClient(`${basePath}?linkedin=error`);
      }

      const tokenResponse = await doFetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });
      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed with ${tokenResponse.status}`);
      }
      const { access_token: accessToken } = await tokenResponse.json();

      const userinfoResponse = await doFetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoResponse.ok) {
        throw new Error(`Userinfo request failed with ${userinfoResponse.status}`);
      }
      const info = await userinfoResponse.json();
      const photoUrl = info.picture || null;

      if (mode === "profile") {
        if (photoUrl) {
          await userRepository.updateProfile(claims.uid, { photo_url: photoUrl });
        }
        return redirectClient(
          `${basePath}?linkedin=${photoUrl ? "connected" : "nophoto"}`
        );
      }

      const pendingId = pendingStore.put({
        photo_url: photoUrl,
        full_name: info.name || null,
        email: info.email || null,
      });
      return redirectClient(`${basePath}?linkedin=connected&ref=${pendingId}`);
    } catch (error) {
      logger.error?.("LinkedIn OAuth callback failed", { error: error.message });
      return redirectClient(`${basePath}?linkedin=error`);
    }
  });

  // GET /pending/:pendingId -> one-time prefill data for the register form
  router.get("/pending/:pendingId", (req, res, next) => {
    const data = pendingStore.take(req.params.pendingId);
    if (!data) {
      return next(
        new AppError(
          404,
          "LINKEDIN_PENDING_NOT_FOUND",
          "This LinkedIn prefill has expired. Please connect again."
        )
      );
    }
    return res.json(data);
  });

  router.isConfigured = isConfigured;
  return router;
}

module.exports = { createLinkedinRouter, createPendingStore };

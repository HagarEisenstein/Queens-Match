import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { exchangeNeonSessionForQueenBToken } from "../auth/googleSignIn";
import { isNeonAuthConfigured } from "../auth/neonClient";

export default function NeonAuthCallback() {
  const { loginWithNeon, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    let active = true;

    async function completeGoogleSignIn() {
      if (!isNeonAuthConfigured) {
        setError("Google sign-in is not configured.");
        return;
      }

      if (searchParams.get("error")) {
        setError("Google sign-in was cancelled or failed.");
        return;
      }

      try {
        const user = await exchangeNeonSessionForQueenBToken(loginWithNeon);
        if (!active) return;
        navigate(user.roles?.includes("mentor") ? "/mentor-profile" : "/", {
          replace: true,
        });
      } catch (requestError) {
        if (!active) return;
        const apiError = requestError.response?.data?.error;
        const details = apiError?.details;
        const shape = details?.tokenShape;
        const safeParts = [
          apiError?.code || null,
          details?.joseCode || null,
          details?.joseMessage || null,
          details?.jwksPath ? `jwks=${details.jwksPath}` : null,
          shape?.header?.alg ? `alg=${shape.header.alg}` : null,
          shape?.header?.kid ? `kid=${shape.header.kid}` : null,
          shape?.claimNames?.length
            ? `claims=${shape.claimNames.join(",")}`
            : null,
        ].filter(Boolean);
        const detailHint = safeParts.length
          ? ` [${safeParts.join("; ")}]`
          : "";
        setError(
          `${
            apiError?.message ||
            requestError.message ||
            "Unable to finish Google sign-in."
          }${detailHint}`
        );
        if (apiError?.details) {
          console.info("[neon-auth-callback]", {
            code: apiError.code,
            details: apiError.details,
          });
        }
      }
    }

    completeGoogleSignIn();
    return () => {
      active = false;
    };
  }, [isAuthenticated, loginWithNeon, navigate, searchParams]);

  return (
    <Box
      maxWidth="sm"
      mx="auto"
      mt={12}
      px={2}
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center">
        {!error && (
          <>
            <CircularProgress color="primary" />
            <Typography variant="h6">Finishing Google sign-in…</Typography>
          </>
        )}
        {error && (
          <>
            <Alert severity="error">{error}</Alert>
            <Typography
              component="a"
              href="/login"
              color="secondary"
              sx={{ textDecoration: "underline", cursor: "pointer" }}
              onClick={(event) => {
                event.preventDefault();
                navigate("/login", { replace: true });
              }}
            >
              Back to login
            </Typography>
          </>
        )}
      </Stack>
    </Box>
  );
}

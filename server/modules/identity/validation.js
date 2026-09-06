const { AppError } = require("../../middleware/errors");

const ALLOWED_ROLES = new Set(["mentee", "mentor", "admin"]);
const SELF_ASSIGNABLE_ROLES = new Set(["mentee", "mentor"]);
const PROFILE_FIELDS = [
  "username",
  "phone",
  "full_name",
  "job",
  "workplace",
  "years_experience",
  "tech_stack",
  "github_url",
  "linkedin_url",
  "photo_url",
];

function validationError(details) {
  return new AppError(
    400,
    "VALIDATION_ERROR",
    "The request contains invalid fields.",
    details
  );
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordIssues(password) {
  const issues = [];
  if (typeof password !== "string" || password.length < 8) {
    issues.push("Password must be at least 8 characters long.");
  }
  if (!/[a-z]/.test(password || "")) issues.push("Password must contain a lowercase letter.");
  if (!/[A-Z]/.test(password || "")) issues.push("Password must contain an uppercase letter.");
  if (!/\d/.test(password || "")) issues.push("Password must contain a number.");
  if (!/[^A-Za-z0-9]/.test(password || "")) issues.push("Password must contain a special character.");
  return issues;
}

function normalizeRoles(roles) {
  const value = roles === undefined ? ["mentee"] : roles;
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError({ roles: ["Roles must be a non-empty array."] });
  }

  const uniqueRoles = [...new Set(value)];
  if (uniqueRoles.some((role) => !ALLOWED_ROLES.has(role))) {
    throw validationError({
      roles: ["Roles may only contain mentee, mentor, or admin."],
    });
  }
  if (uniqueRoles.some((role) => !SELF_ASSIGNABLE_ROLES.has(role))) {
    throw validationError({
      roles: ["Admin access cannot be assigned during public registration."],
    });
  }
  return uniqueRoles;
}

function validateProfileFields(input, { requireUsername = false } = {}) {
  const profile = {};
  const details = {};

  for (const field of PROFILE_FIELDS) {
    if (input[field] !== undefined) profile[field] = input[field];
  }

  if (requireUsername && (typeof profile.username !== "string" || !profile.username.trim())) {
    details.username = ["Username is required."];
  } else if (profile.username !== undefined) {
    if (typeof profile.username !== "string" || profile.username.trim().length < 2) {
      details.username = ["Username must be at least 2 characters long."];
    } else {
      profile.username = profile.username.trim();
    }
  }

  const stringFields = [
    "full_name",
    "phone",
    "job",
    "workplace",
    "github_url",
    "linkedin_url",
    "photo_url",
  ];
  for (const field of stringFields) {
    if (profile[field] !== undefined && profile[field] !== null) {
      if (typeof profile[field] !== "string") {
        details[field] = [`${field} must be text or null.`];
      } else {
        profile[field] = profile[field].trim() || null;
      }
    }
  }

  if (profile.phone && !/^\+[1-9]\d{7,14}$/.test(profile.phone)) {
    details.phone = ["Phone must use international format, for example +14155552671."];
  }

  for (const field of ["github_url", "linkedin_url", "photo_url"]) {
    if (profile[field]) {
      try {
        const url = new URL(profile[field]);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        details[field] = [`${field} must be a valid HTTP or HTTPS URL.`];
      }
    }
  }

  if (profile.years_experience !== undefined && profile.years_experience !== null) {
    if (
      !Number.isInteger(profile.years_experience) ||
      profile.years_experience < 0
    ) {
      details.years_experience = ["Years of experience must be a non-negative integer or null."];
    }
  }

  if (profile.tech_stack !== undefined) {
    if (
      !Array.isArray(profile.tech_stack) ||
      profile.tech_stack.some((technology) => typeof technology !== "string")
    ) {
      details.tech_stack = ["Tech stack must be an array of text values."];
    } else {
      profile.tech_stack = [
        ...new Set(profile.tech_stack.map((item) => item.trim()).filter(Boolean)),
      ];
    }
  }

  if (Object.keys(details).length) throw validationError(details);
  return profile;
}

function validateRegistration(input) {
  const email = normalizeEmail(input.email);
  const details = {};
  if (!validateEmail(email)) details.email = ["A valid email is required."];
  const passwordErrors = passwordIssues(input.password);
  if (passwordErrors.length) details.password = passwordErrors;
  if (Object.keys(details).length) throw validationError(details);

  return {
    email,
    password: input.password,
    roles: normalizeRoles(input.roles),
    profile: validateProfileFields(input, { requireUsername: true }),
  };
}

function validateInviteAcceptance(input, { requireUsername = false } = {}) {
  const details = {};
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!token) details.token = ["Invite token is required."];
  const passwordErrors = passwordIssues(input.password);
  if (passwordErrors.length) details.password = passwordErrors;
  if (Object.keys(details).length) throw validationError(details);

  return {
    token,
    password: input.password,
    profile: requireUsername
      ? validateProfileFields({ username: input.username }, { requireUsername: true })
      : {},
  };
}

module.exports = {
  ALLOWED_ROLES,
  PROFILE_FIELDS,
  normalizeEmail,
  validateInviteAcceptance,
  validateRegistration,
  validateProfileFields,
};

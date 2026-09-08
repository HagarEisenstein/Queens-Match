const { NOTIFICATION_TYPES } = require("./notificationTypes");

const LOCALHOST_APP_URL = "http://localhost:3000";

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function resolveAppBaseUrl(env = process.env) {
  const configuredUrl =
    env.APP_URL ||
    env.FRONTEND_URL ||
    env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  return LOCALHOST_APP_URL;
}

function buildAbsoluteAppUrl(pathOrUrl, env = process.env) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const baseUrl = resolveAppBaseUrl(env);
  const path = String(pathOrUrl).startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${path}`;
}

function actionLabelForType(type) {
  switch (type) {
    case NOTIFICATION_TYPES.WELCOME:
      return "Complete your profile";
    case NOTIFICATION_TYPES.REQUEST_RECEIVED:
      return "Review the meeting request";
    case NOTIFICATION_TYPES.TIMES_OFFERED:
      return "Choose a meeting time";
    case NOTIFICATION_TYPES.MORE_TIMES_REQUESTED:
      return "Offer another round of times";
    case NOTIFICATION_TYPES.MEETING_REJECTED:
      return "View your meetings";
    case NOTIFICATION_TYPES.MEETING_DECLINED:
      return "View the closed request";
    case NOTIFICATION_TYPES.MEETING_MATCHED:
      return "Open meeting details";
    case NOTIFICATION_TYPES.MEETING_REMINDER:
      return "Open your meeting";
    case NOTIFICATION_TYPES.ARRIVAL_CHECK:
      return "Confirm your arrival";
    case NOTIFICATION_TYPES.POST_MEETING_CHECK:
      return "Confirm whether the meeting happened";
    case NOTIFICATION_TYPES.FEEDBACK_REQUEST:
    case NOTIFICATION_TYPES.FEEDBACK_REMINDER:
      return "Submit your feedback";
    case NOTIFICATION_TYPES.MENTOR_THANK_YOU:
      return "View the completed meeting";
    default:
      return "Open in Queen's Match";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmailContent({ title, message, type, actionUrl, env = process.env }) {
  const absoluteActionUrl = buildAbsoluteAppUrl(actionUrl, env);

  if (!absoluteActionUrl) {
    return {
      text: message,
      html: `<p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
      absoluteActionUrl: null,
    };
  }

  const actionLabel = actionLabelForType(type || "");
  const text = [
    message,
    "",
    `${actionLabel}: ${absoluteActionUrl}`,
    `If the button does not open, copy and paste this URL into your browser: ${absoluteActionUrl}`,
  ].join("\n");

  const html = [
    `<p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
    `<p><a href="${escapeHtml(absoluteActionUrl)}">${escapeHtml(actionLabel)}</a></p>`,
    `<p>Direct link: <a href="${escapeHtml(absoluteActionUrl)}">${escapeHtml(absoluteActionUrl)}</a></p>`,
  ].join("");

  return { text, html, absoluteActionUrl };
}

module.exports = {
  LOCALHOST_APP_URL,
  resolveAppBaseUrl,
  buildAbsoluteAppUrl,
  buildEmailContent,
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values.reduce((normalizedValues, value) => {
    const normalizedValue = normalizeText(value);
    const deduplicationKey = normalizedValue.toLocaleLowerCase("en-US");

    if (normalizedValue && !seen.has(deduplicationKey)) {
      seen.add(deduplicationKey);
      normalizedValues.push(normalizedValue);
    }

    return normalizedValues;
  }, []);
}

function buildMentorSearchDocument(mentor) {
  if (!mentor || typeof mentor !== "object") return "";

  const user =
    mentor.user && typeof mentor.user === "object" ? mentor.user : {};
  const sections = [
    ["Background", normalizeText(mentor.background)],
    ["Advice topics", normalizeList(mentor.adviceTopics).join(", ")],
    ["Job", normalizeText(user.job)],
    ["Workplace", normalizeText(user.workplace)],
    ["Tech stack", normalizeList(user.techStack).join(", ")],
  ];

  return sections
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

module.exports = { buildMentorSearchDocument };

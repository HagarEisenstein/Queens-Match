const { GoogleGenAI } = require("@google/genai");

const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDING_TASK_TYPE = "SEMANTIC_SIMILARITY";

function normalizeText(text) {
  if (typeof text !== "string") {
    throw new TypeError("Embedding text must be a non-empty string");
  }

  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (!normalizedText) {
    throw new TypeError("Embedding text must be a non-empty string");
  }

  return normalizedText;
}

function readGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model =
    process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
    DEFAULT_GEMINI_EMBEDDING_MODEL;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to create embeddings");
  }

  return { apiKey, model };
}

function extractEmbedding(response) {
  if (!Array.isArray(response?.embeddings) || response.embeddings.length === 0) {
    throw new Error("Embedding provider returned no embeddings");
  }

  const vector = response.embeddings[0]?.values;
  const isNumericVector =
    Array.isArray(vector) &&
    vector.length > 0 &&
    vector.every(Number.isFinite);

  if (!isNumericVector) {
    throw new Error("Embedding provider returned a malformed response");
  }

  return vector;
}

async function requestGeminiEmbedding(text, { apiKey, model }) {
  let response;
  try {
    const client = new GoogleGenAI({ apiKey });
    response = await client.models.embedContent({
      model,
      contents: text,
      config: { taskType: GEMINI_EMBEDDING_TASK_TYPE },
    });
  } catch (error) {
    throw new Error("Embedding provider request failed", { cause: error });
  }

  return extractEmbedding(response);
}

async function embedText(text) {
  const normalizedText = normalizeText(text);
  const config = readGeminiConfig();
  return requestGeminiEmbedding(normalizedText, config);
}

module.exports = { embedText };

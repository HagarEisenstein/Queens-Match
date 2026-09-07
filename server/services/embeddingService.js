const { GoogleGenAI } = require("@google/genai");

const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const TASK_TYPES = Object.freeze({
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY",
});

function validateText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new TypeError("Embedding text must be a non-empty string");
  }
  return text;
}

function normalizeQueryText(text) {
  return validateText(text).trim().replace(/\s+/g, " ");
}

function readDimensions() {
  const configured = process.env.GEMINI_EMBEDDING_DIMENSIONS?.trim();
  const dimensions = configured ? Number(configured) : EMBEDDING_DIMENSIONS;
  if (dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `GEMINI_EMBEDDING_DIMENSIONS must be exactly ${EMBEDDING_DIMENSIONS}`
    );
  }
  return dimensions;
}

function getEmbeddingMetadata() {
  return {
    model:
      process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
      DEFAULT_GEMINI_EMBEDDING_MODEL,
    dimensions: readDimensions(),
  };
}

function readGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to create embeddings");
  }

  return { apiKey, ...getEmbeddingMetadata() };
}

function extractEmbedding(response, expectedDimensions) {
  if (!Array.isArray(response?.embeddings) || response.embeddings.length === 0) {
    throw new Error("Embedding provider returned no embeddings");
  }

  const vector = response.embeddings[0]?.values;
  if (
    !Array.isArray(vector) ||
    vector.length === 0 ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error("Embedding provider returned a malformed response");
  }
  if (vector.length !== expectedDimensions) {
    throw new Error(
      `Embedding provider returned ${vector.length} dimensions; expected ${expectedDimensions}`
    );
  }

  return vector;
}

function normalizeVector(vector) {
  const squaredNorm = vector.reduce(
    (sum, value) => sum + value * value,
    0
  );
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Embedding provider returned a vector with an invalid L2 norm");
  }

  const normalizedVector = vector.map((value) => value / norm);
  if (!normalizedVector.every(Number.isFinite)) {
    throw new Error("Embedding provider returned a vector with an invalid L2 norm");
  }
  return normalizedVector;
}

async function requestGeminiEmbedding(text, taskType) {
  const { apiKey, model, dimensions } = readGeminiConfig();
  let response;
  try {
    const client = new GoogleGenAI({ apiKey });
    response = await client.models.embedContent({
      model,
      contents: text,
      config: { taskType, outputDimensionality: dimensions },
    });
  } catch (error) {
    throw new Error("Embedding provider request failed", { cause: error });
  }

  return normalizeVector(extractEmbedding(response, dimensions));
}

async function embedSearchDocument(text) {
  return requestGeminiEmbedding(validateText(text), TASK_TYPES.document);
}

async function embedSearchQuery(text) {
  return requestGeminiEmbedding(normalizeQueryText(text), TASK_TYPES.query);
}

module.exports = {
  EMBEDDING_DIMENSIONS,
  embedSearchDocument,
  embedSearchQuery,
  getEmbeddingMetadata,
};

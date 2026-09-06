function toPgVectorLiteral(embedding, expectedDimensions) {
  if (
    !Array.isArray(embedding) ||
    embedding.length !== expectedDimensions ||
    !embedding.every(Number.isFinite)
  ) {
    throw new TypeError(
      `Embedding must contain exactly ${expectedDimensions} finite numbers`
    );
  }

  return `[${embedding.join(",")}]`;
}

module.exports = { toPgVectorLiteral };

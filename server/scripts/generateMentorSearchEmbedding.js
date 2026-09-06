const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const prisma = require("../commons/db");
const {
  generateMentorSearchEmbedding,
} = require("../services/mentorSearchEmbeddingService");

async function main() {
  const mentorProfileIds = process.argv.slice(2);
  if (mentorProfileIds.length !== 1 || !mentorProfileIds[0].trim()) {
    throw new Error(
      "Usage: npm run embeddings:mentor -- <mentorProfileId>"
    );
  }

  const result = await generateMentorSearchEmbedding(mentorProfileIds[0]);
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Mentor embedding generation failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { main };

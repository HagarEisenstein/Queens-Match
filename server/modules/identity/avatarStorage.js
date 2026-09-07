const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { AppError } = require("../../middleware/errors");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getAvatarStorageConfigError({
  region = process.env.AWS_REGION,
  bucketName = process.env.AWS_BUCKET_NAME,
  accessKeyId = process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY,
} = {}) {
  const missing = [];
  if (!region) missing.push("AWS_REGION");
  if (!bucketName) missing.push("AWS_BUCKET_NAME");
  if (!accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!missing.length) return null;

  return `Avatar storage is not configured. Missing environment variables: ${missing.join(", ")}.`;
}

function createAvatarStorage({
  region = process.env.AWS_REGION,
  bucketName = process.env.AWS_BUCKET_NAME,
  accessKeyId = process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY,
  publicBaseUrl,
  client,
} = {}) {
  const configError = getAvatarStorageConfigError({
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
  });
  if (configError) {
    return null;
  }

  const s3Client =
    client ||
    new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

  return {
    async uploadUserAvatar({ userId, file }) {
      if (!file?.buffer || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new AppError(
          400,
          "INVALID_AVATAR_FILE",
          "Avatar must be a JPEG, PNG, or WebP image."
        );
      }

      const extension = MIME_EXTENSION_MAP[file.mimetype];
      const key = `avatars/${userId}-${Date.now()}.${extension}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const normalizedBaseUrl = publicBaseUrl?.replace(/\/+$/, "");
      const url =
        normalizedBaseUrl ||
        `https://${bucketName}.s3.${region}.amazonaws.com`;

      return `${url}/${key}`;
    },
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  createAvatarStorage,
  getAvatarStorageConfigError,
};

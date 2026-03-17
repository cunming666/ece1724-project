import { S3Client } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const spacesConfig = {
  region: requireEnv("SPACES_REGION"),
  endpoint: requireEnv("SPACES_ENDPOINT"),
  bucket: requireEnv("SPACES_BUCKET"),
  accessKeyId: requireEnv("SPACES_ACCESS_KEY"),
  secretAccessKey: requireEnv("SPACES_SECRET_KEY"),
};

export const spacesClient = new S3Client({
  region: spacesConfig.region,
  endpoint: spacesConfig.endpoint,
  credentials: {
    accessKeyId: spacesConfig.accessKeyId,
    secretAccessKey: spacesConfig.secretAccessKey,
  },
  forcePathStyle: false,
});
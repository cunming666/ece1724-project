import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "./env.js";

export interface SpacesConfig {
  region: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let cachedConfig: SpacesConfig | null = null;
let cachedClient: S3Client | null = null;

export function getSpacesConfig(): SpacesConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = getEnv();
  cachedConfig = {
    region: env.SPACES_REGION,
    endpoint: env.SPACES_ENDPOINT,
    bucket: env.SPACES_BUCKET,
    accessKeyId: env.SPACES_ACCESS_KEY,
    secretAccessKey: env.SPACES_SECRET_KEY,
  };

  return cachedConfig;
}

export function getSpacesClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getSpacesConfig();
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });

  return cachedClient;
}

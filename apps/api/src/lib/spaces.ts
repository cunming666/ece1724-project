import { S3Client } from "@aws-sdk/client-s3";

export interface SpacesConfig {
  region: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedConfig: SpacesConfig | null = null;
let cachedClient: S3Client | null = null;

export function getSpacesConfig(): SpacesConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    region: requireEnv("SPACES_REGION"),
    endpoint: requireEnv("SPACES_ENDPOINT"),
    bucket: requireEnv("SPACES_BUCKET"),
    accessKeyId: requireEnv("SPACES_ACCESS_KEY"),
    secretAccessKey: requireEnv("SPACES_SECRET_KEY"),
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
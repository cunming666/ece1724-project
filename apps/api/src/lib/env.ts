import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1),
  API_PORT: z.string().default("4000"),
  PORT: z.string().optional(),
  SPACES_REGION: z.string().min(1),
  SPACES_ENDPOINT: z.string().min(1),
  SPACES_BUCKET: z.string().min(1),
  SPACES_ACCESS_KEY: z.string().min(1),
  SPACES_SECRET_KEY: z.string().min(1),
  OPENWEATHER_API_KEY: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => issue.path.join(".") || "unknown")
      .join(", ");
    throw new Error(`Invalid environment configuration. Missing/invalid: ${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

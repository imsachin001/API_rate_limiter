import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  REDIS_URL: z
    .string()
    .url()
    .default("redis://localhost:6379"),

  // Number of trusted proxy hops. Keep 0 unless configured
  // behind a known reverse proxy.
  TRUST_PROXY_HOPS: z.coerce
    .number()
    .int()
    .min(0)
    .default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);

  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
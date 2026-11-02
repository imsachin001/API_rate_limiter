import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  REDIS_URL: z
    .string()
    .url()
    .default("redis://localhost:6379"),

  TRUST_PROXY_HOPS: z.coerce
    .number()
    .int()
    .min(0)
    .default(0),

  REDIS_FAILURE_MODE: z
    .enum(["fail-open", "fail-closed", "local-fallback"])
    .default("fail-closed"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);

  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
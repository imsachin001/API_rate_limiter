import { z } from "zod";

const fixedWindowSchema = z.object({
  algorithm: z.literal("fixed-window"),
  limit: z.number().int().positive(),
  windowMs: z.number().int().positive(),
});

const slidingLogSchema = z.object({
  algorithm: z.literal("sliding-log"),
  limit: z.number().int().positive(),
  windowMs: z.number().int().positive(),
});

const slidingCounterSchema = z.object({
  algorithm: z.literal("sliding-counter"),
  limit: z.number().int().positive(),
  windowMs: z.number().int().positive(),
});

const tokenBucketSchema = z.object({
  algorithm: z.literal("token-bucket"),
  capacity: z.number().positive(),
  refillPerSecond: z.number().positive(),
  cost: z.number().positive().optional(),
});

export const rateLimitRuleSchema = z.discriminatedUnion(
  "algorithm",
  [
    fixedWindowSchema,
    slidingLogSchema,
    slidingCounterSchema,
    tokenBucketSchema,
  ]
);

const routeSchema = z.object({
  name: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  path: z.string().startsWith("/"),
  identity: z.enum(["ip", "api-key"]),
  rule: rateLimitRuleSchema,
});

export const routeRateLimits = z.array(routeSchema).parse([
  {
    name: "public-read",
    method: "GET",
    path: "/api/public",
    identity: "ip",
    rule: {
      algorithm: "fixed-window",
      limit: 5,
      windowMs: 60000,
    },
  },
  {
    name: "login",
    method: "POST",
    path: "/api/login",
    identity: "ip",
    rule: {
      algorithm: "sliding-log",
      limit: 3,
      windowMs: 60000,
    },
  },
  {
    name: "account",
    method: "GET",
    path: "/api/account",
    identity: "api-key",
    rule: {
      algorithm: "sliding-counter",
      limit: 10,
      windowMs: 60000,
    },
  },
  {
    name: "export",
    method: "POST",
    path: "/api/export",
    identity: "ip",
    rule: {
      algorithm: "token-bucket",
      capacity: 3,
      refillPerSecond: 0.2,
    },
  },
]);
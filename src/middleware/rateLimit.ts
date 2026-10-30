import { createHash } from "crypto";
import { Request, RequestHandler } from "express";

import {
  RateLimitRule,
  RateLimitResult,
  WindowRule,
  TokenBucketRule,
} from "../algorithms/types";

import {
  RedisFixedWindowLimiter,
  RedisSlidingLogLimiter,
  RedisSlidingCounterLimiter,
  RedisTokenBucketLimiter,
} from "../store/redisRateLimiters";

type IdentityType = "ip" | "api-key";

interface RateLimitOptions {
  name: string;
  identity: IdentityType;
  rule: RateLimitRule;
}

const fixedWindow = new RedisFixedWindowLimiter();
const slidingLog = new RedisSlidingLogLimiter();
const slidingCounter = new RedisSlidingCounterLimiter();
const tokenBucket = new RedisTokenBucketLimiter();

function getClientIdentity(
  req: Request,
  identityType: IdentityType
): string {
  if (identityType === "api-key") {
    const apiKey = req.get("x-api-key")?.trim();

    // Unauthenticated requests are still rate-limited by IP.
    if (apiKey) {
      return `api-key:${apiKey}`;
    }
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}

function hashKey(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

async function checkLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  switch (rule.algorithm) {
    case "fixed-window":
      return fixedWindow.check(key, rule as WindowRule);

    case "sliding-log":
      return slidingLog.check(key, rule as WindowRule);

    case "sliding-counter":
      return slidingCounter.check(key, rule as WindowRule);

    case "token-bucket":
      return tokenBucket.check(key, rule as TokenBucketRule);
  }
}

function getLimit(rule: RateLimitRule): number {
  return rule.algorithm === "token-bucket"
    ? rule.capacity
    : rule.limit;
}

function setHeaders(
  res: Parameters<RequestHandler>[1],
  result: RateLimitResult,
  rule: RateLimitRule
): void {
  res.setHeader("X-RateLimit-Limit", String(getLimit(rule)));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(result.remaining)
  );

  // This header is an epoch timestamp in seconds.
  res.setHeader(
    "X-RateLimit-Reset",
    String(Math.ceil((Date.now() + result.resetMs) / 1000))
  );

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(result.retryAfterMs / 1000)
    );

    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

export function rateLimit(
  options: RateLimitOptions
): RequestHandler {
  const { name, identity, rule } = options;

  return (req, res, next) => {
    const execute = async () => {
      const clientIdentity = getClientIdentity(req, identity);

      // Hashing keeps raw API keys and IP identifiers out of Redis keys.
      const redisKey = `rl:v1:${name}:${hashKey(clientIdentity)}`;

      const result = await checkLimit(redisKey, rule);

      setHeaders(res, result, rule);

      if (!result.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(result.retryAfterMs / 1000)
        );

        res.status(429).json({
          error: "Too many requests",
          retryAfterSeconds,
        });

        return;
      }

      next();
    };

    execute().catch(next);
  };
}
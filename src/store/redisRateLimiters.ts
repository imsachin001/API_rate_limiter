import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

import { redis } from "./redis";
import {
  AsyncRateLimiter,
  RateLimitResult,
  WindowRule,
  TokenBucketRule,
} from "../algorithms/types";

const loadScript = (filename: string): string => {
  return readFileSync(
    join(process.cwd(), "src", "lua", filename),
    "utf8"
  );
};

const scripts = {
  fixedWindow: loadScript("fixedWindow.lua"),
  slidingLog: loadScript("slidingLog.lua"),
  slidingCounter: loadScript("slidingCounter.lua"),
  tokenBucket: loadScript("tokenBucket.lua"),
};

function toResult(result: number[]): RateLimitResult {
  const [allowed, remaining, resetMs, retryAfterMs] = result;

  return {
    allowed: allowed === 1,
    remaining,
    resetMs,
    retryAfterMs,
  };
}

function validateWindowRule(rule: WindowRule): void {
  if (
    !Number.isInteger(rule.limit) ||
    rule.limit <= 0 ||
    !Number.isInteger(rule.windowMs) ||
    rule.windowMs <= 0
  ) {
    throw new Error("limit and windowMs must be positive integers");
  }
}

export class RedisFixedWindowLimiter
  implements AsyncRateLimiter<WindowRule>
{
  async check(key: string, rule: WindowRule): Promise<RateLimitResult> {
    validateWindowRule(rule);

    const redisKey = `rate-limit:fixed:${key}`;

    const result = await redis.eval(
      scripts.fixedWindow,
      1,
      redisKey,
      rule.limit,
      rule.windowMs
    ) as number[];

    return toResult(result);
  }
}

export class RedisSlidingLogLimiter
  implements AsyncRateLimiter<WindowRule>
{
  async check(key: string, rule: WindowRule): Promise<RateLimitResult> {
    validateWindowRule(rule);

    const redisKey = `rate-limit:sliding-log:${key}`;

    const result = await redis.eval(
      scripts.slidingLog,
      1,
      redisKey,
      rule.limit,
      rule.windowMs,
      randomUUID()
    ) as number[];

    return toResult(result);
  }
}

export class RedisSlidingCounterLimiter
  implements AsyncRateLimiter<WindowRule>
{
  async check(key: string, rule: WindowRule): Promise<RateLimitResult> {
    validateWindowRule(rule);

    const redisKey = `rate-limit:sliding-counter:${key}`;

    const result = await redis.eval(
      scripts.slidingCounter,
      1,
      redisKey,
      rule.limit,
      rule.windowMs
    ) as number[];

    return toResult(result);
  }
}

export class RedisTokenBucketLimiter
  implements AsyncRateLimiter<TokenBucketRule>
{
  async check(
    key: string,
    rule: TokenBucketRule
  ): Promise<RateLimitResult> {
    const cost = rule.cost ?? 1;

    if (
      !Number.isFinite(rule.capacity) ||
      !Number.isFinite(rule.refillPerSecond) ||
      !Number.isFinite(cost) ||
      rule.capacity <= 0 ||
      rule.refillPerSecond <= 0 ||
      cost <= 0 ||
      cost > rule.capacity
    ) {
      throw new Error("Invalid token bucket configuration");
    }

    const redisKey = `rate-limit:token-bucket:${key}`;

    const result = await redis.eval(
      scripts.tokenBucket,
      1,
      redisKey,
      rule.capacity,
      rule.refillPerSecond,
      cost
    ) as number[];

    return toResult(result);
  }
}
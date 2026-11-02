import {
  RateLimitResult,
  RateLimitRule,
  WindowRule,
  TokenBucketRule,
} from "../algorithms/types";

import {
  FixedWindowLimiter,
} from "../algorithms/fixedWindow";

import {
  SlidingLogLimiter,
} from "../algorithms/slidingLog";

import {
  SlidingCounterLimiter,
} from "../algorithms/slidingCounter";

import {
  TokenBucketLimiter,
} from "../algorithms/tokenBucket";

import {
  RedisFixedWindowLimiter,
  RedisSlidingLogLimiter,
  RedisSlidingCounterLimiter,
  RedisTokenBucketLimiter,
} from "./redisRateLimiters";

import { isRedisUnavailableError } from "./redisErrors";

export type RedisFailureMode =
  | "fail-open"
  | "fail-closed"
  | "local-fallback";

export type RateLimitSource =
  | "redis"
  | "local-fallback"
  | "fail-open";

export interface RateLimitServiceResult extends RateLimitResult {
  source: RateLimitSource;
}

export type DistributedCheck = (
  key: string,
  rule: RateLimitRule
) => Promise<RateLimitResult>;

// Redis-backed algorithm instances.
const redisFixed = new RedisFixedWindowLimiter();
const redisLog = new RedisSlidingLogLimiter();
const redisCounter = new RedisSlidingCounterLimiter();
const redisBucket = new RedisTokenBucketLimiter();

// In-memory algorithm instances for local fallback.
const localFixed = new FixedWindowLimiter();
const localLog = new SlidingLogLimiter();
const localCounter = new SlidingCounterLimiter();
const localBucket = new TokenBucketLimiter();

async function checkRedis(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  switch (rule.algorithm) {
    case "fixed-window":
      return redisFixed.check(key, rule as WindowRule);

    case "sliding-log":
      return redisLog.check(key, rule as WindowRule);

    case "sliding-counter":
      return redisCounter.check(key, rule as WindowRule);

    case "token-bucket":
      return redisBucket.check(key, rule as TokenBucketRule);
  }
}

function checkLocally(
  key: string,
  rule: RateLimitRule
): RateLimitResult {
  switch (rule.algorithm) {
    case "fixed-window":
      return localFixed.check(key, rule as WindowRule);

    case "sliding-log":
      return localLog.check(key, rule as WindowRule);

    case "sliding-counter":
      return localCounter.check(key, rule as WindowRule);

    case "token-bucket":
      return localBucket.check(key, rule as TokenBucketRule);
  }
}

export class RateLimiterUnavailableError extends Error {
  constructor() {
    super("Rate limiting is unavailable because Redis cannot be reached");
    this.name = "RateLimiterUnavailableError";
  }
}

export class RateLimiterService {
  constructor(
    private readonly failureMode: RedisFailureMode,
    private readonly distributedCheck: DistributedCheck = checkRedis
  ) {}

  async check(
    key: string,
    rule: RateLimitRule
  ): Promise<RateLimitServiceResult> {
    try {
      const result = await this.distributedCheck(key, rule);

      return {
        ...result,
        source: "redis",
      };
    } catch (error) {
      // Only connection failures should trigger fallback.
      if (!isRedisUnavailableError(error)) {
        throw error;
      }

      switch (this.failureMode) {
        case "fail-open":
          return {
            allowed: true,
            remaining: 0,
            resetMs: 0,
            retryAfterMs: 0,
            source: "fail-open",
          };

        case "fail-closed":
          throw new RateLimiterUnavailableError();

        case "local-fallback":
          return {
            ...checkLocally(key, rule),
            source: "local-fallback",
          };
      }
    }
  }
}
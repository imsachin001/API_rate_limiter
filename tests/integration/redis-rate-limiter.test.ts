import { redis } from "../../src/store/redis";
import {
  RedisFixedWindowLimiter,
  RedisSlidingLogLimiter,
  RedisSlidingCounterLimiter,
  RedisTokenBucketLimiter,
} from "../../src/store/redisRateLimiters";

describe("Redis rate limiters", () => {
  const fixed = new RedisFixedWindowLimiter();
  const slidingLog = new RedisSlidingLogLimiter();
  const slidingCounter = new RedisSlidingCounterLimiter();
  const tokenBucket = new RedisTokenBucketLimiter();

  beforeAll(async () => {
    await redis.connect();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  test("Fixed Window enforces the request limit", async () => {
    const rule = { limit: 2, windowMs: 60000 };

    expect((await fixed.check("user-a", rule)).allowed).toBe(true);
    expect((await fixed.check("user-a", rule)).allowed).toBe(true);
    expect((await fixed.check("user-a", rule)).allowed).toBe(false);
  });

  test("Sliding Log enforces the request limit", async () => {
    const rule = { limit: 2, windowMs: 60000 };

    expect((await slidingLog.check("user-a", rule)).allowed).toBe(true);
    expect((await slidingLog.check("user-a", rule)).allowed).toBe(true);
    expect((await slidingLog.check("user-a", rule)).allowed).toBe(false);
  });

  test("Sliding Counter enforces the request limit", async () => {
    const rule = { limit: 2, windowMs: 60000 };

    expect((await slidingCounter.check("user-a", rule)).allowed).toBe(true);
    expect((await slidingCounter.check("user-a", rule)).allowed).toBe(true);
    expect((await slidingCounter.check("user-a", rule)).allowed).toBe(false);
  });

  test("Token Bucket allows initial burst and blocks excess requests", async () => {
    const rule = {
      capacity: 2,
      refillPerSecond: 1,
    };

    expect((await tokenBucket.check("user-a", rule)).allowed).toBe(true);
    expect((await tokenBucket.check("user-a", rule)).allowed).toBe(true);
    expect((await tokenBucket.check("user-a", rule)).allowed).toBe(false);
  });

  test("Concurrent requests cannot exceed the Fixed Window limit", async () => {
    const rule = { limit: 10, windowMs: 60000 };

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        fixed.check("concurrent-user", rule)
      )
    );

    const allowedCount = results.filter(
      (result) => result.allowed
    ).length;

    expect(allowedCount).toBe(10);
  });

  test("Concurrent requests cannot exceed the Sliding Log limit", async () => {
    const rule = { limit: 10, windowMs: 60000 };

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        slidingLog.check("concurrent-user", rule)
      )
    );

    const allowedCount = results.filter(
      (result) => result.allowed
    ).length;

    expect(allowedCount).toBe(10);
  });
});
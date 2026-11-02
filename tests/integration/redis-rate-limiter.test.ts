import { redis } from "../../src/store/redis";
import {
  RedisFixedWindowLimiter,
  RedisSlidingLogLimiter,
  RedisSlidingCounterLimiter,
  RedisTokenBucketLimiter,
} from "../../src/store/redisRateLimiters";

import request from "supertest";
import { app } from "../../src/app";

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

  test("Middleware adds rate-limit headers", async () => {
    const response = await request(app).get("/api/public");
    expect(response.status).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("5");
    expect(response.headers["x-ratelimit-remaining"]).toBe("4");
    expect(response.headers["x-ratelimit-reset"]).toBeDefined();
  });

  test("Middleware returns 429 after the configured limit", async () => {
    const responses = [];

    for (let i = 0; i < 6; i++) {
      responses.push(
        await request(app).get("/api/public")
      );
    }

    expect(responses.slice(0, 5).every(
      (response) => response.status === 200
    )).toBe(true);

    expect(responses[5].status).toBe(429);
    expect(responses[5].body.error).toBe("Too many requests");
    expect(responses[5].headers["retry-after"]).toBeDefined();
  });

  test("API keys receive independent rate-limit buckets", async () => {
    const first = await request(app)
      .get("/api/account")
      .set("x-api-key", "demo-key-one");

    const second = await request(app)
      .get("/api/account")
      .set("x-api-key", "demo-key-two");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(first.headers["x-ratelimit-remaining"]).toBe("9");
    expect(second.headers["x-ratelimit-remaining"]).toBe("9");
  });

  test("Missing API key falls back to IP-based limiting", async () => {
    const response = await request(app).get("/api/account");

    expect(response.status).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("10");
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
import {
  RateLimiterService,
} from "../../src/store/rateLimiterService";

import {
  RedisUnavailableError,
} from "../../src/store/redisErrors";

import {
  RateLimitResult,
} from "../../src/algorithms/types";

const testRule = {
  algorithm: "fixed-window" as const,
  limit: 1,
  windowMs: 60000,
};

const successfulResult: RateLimitResult = {
  allowed: true,
  remaining: 4,
  resetMs: 30000,
  retryAfterMs: 0,
};

describe("RateLimiterService failure modes", () => {
  test("fail-open allows requests when Redis is unavailable", async () => {
    const service = new RateLimiterService(
      "fail-open",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    const result = await service.check("user-a", testRule);

    expect(result.allowed).toBe(true);
    expect(result.source).toBe("fail-open");
  });

  test("fail-closed throws an availability error", async () => {
    const service = new RateLimiterService(
      "fail-closed",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    await expect(
      service.check("user-b", testRule)
    ).rejects.toThrow(
      "Rate limiting is unavailable because Redis cannot be reached"
    );
  });

  test("local-fallback uses the in-memory algorithm", async () => {
    const service = new RateLimiterService(
      "local-fallback",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    const first = await service.check("user-c", testRule);
    const second = await service.check("user-c", testRule);

    expect(first.source).toBe("local-fallback");
    expect(first.allowed).toBe(true);

    expect(second.source).toBe("local-fallback");
    expect(second.allowed).toBe(false);
  });

  test("service returns to Redis when the connection recovers", async () => {
    let redisAvailable = false;

    const service = new RateLimiterService(
      "local-fallback",
      async () => {
        if (!redisAvailable) {
          throw new RedisUnavailableError();
        }

        return successfulResult;
      }
    );

    const duringOutage = await service.check(
      "user-d",
      testRule
    );

    expect(duringOutage.source).toBe("local-fallback");

    // Simulate Redis becoming available again.
    redisAvailable = true;

    const afterRecovery = await service.check(
      "user-d",
      testRule
    );

    expect(afterRecovery.source).toBe("redis");
    expect(afterRecovery.allowed).toBe(true);
  });

  test("unexpected errors are not hidden by fallback", async () => {
    const service = new RateLimiterService(
      "local-fallback",
      async () => {
        throw new Error("Unexpected Lua script error");
      }
    );

    await expect(
      service.check("user-e", testRule)
    ).rejects.toThrow("Unexpected Lua script error");
  });
});
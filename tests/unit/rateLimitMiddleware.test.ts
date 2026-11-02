import express from "express";
import request from "supertest";

import { rateLimit } from "../../src/middleware/rateLimit";

import {
  RateLimiterService,
} from "../../src/store/rateLimiterService";

import {
  RedisUnavailableError,
} from "../../src/store/redisErrors";

const options = {
  name: "failure-test",
  identity: "ip" as const,
  rule: {
    algorithm: "fixed-window" as const,
    limit: 2,
    windowMs: 60000,
  },
};

describe("Rate limit middleware failure behavior", () => {
  test("fail-open allows the request and marks degraded status", async () => {
    const service = new RateLimiterService(
      "fail-open",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    const app = express();

    app.get(
      "/protected",
      rateLimit(options, service),
      (_req, res) => {
        res.json({ message: "Success" });
      }
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(200);
    expect(response.headers["x-ratelimit-status"]).toBe("bypassed");
    expect(response.headers["x-ratelimit-degraded"]).toBe("true");
  });

  test("fail-closed returns HTTP 503", async () => {
    const service = new RateLimiterService(
      "fail-closed",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    const app = express();

    app.get(
      "/protected",
      rateLimit(options, service),
      (_req, res) => {
        res.json({ message: "Success" });
      }
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe(
      "Rate limiter temporarily unavailable"
    );

    expect(response.headers["x-ratelimit-status"]).toBe(
      "unavailable"
    );
  });

  test("local fallback applies the configured limit", async () => {
    const service = new RateLimiterService(
      "local-fallback",
      async () => {
        throw new RedisUnavailableError();
      }
    );

    const app = express();

    app.get(
      "/protected",
      rateLimit(options, service),
      (_req, res) => {
        res.json({ message: "Success" });
      }
    );

    const first = await request(app).get("/protected");
    const second = await request(app).get("/protected");
    const third = await request(app).get("/protected");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);

    expect(first.headers["x-ratelimit-status"]).toBe(
      "local-fallback"
    );
  });
});
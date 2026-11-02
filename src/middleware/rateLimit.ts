import { createHash } from "crypto";
import {
  Request,
  RequestHandler,
  Response,
} from "express";

import { config } from "../config/env";
import { RateLimitRule } from "../algorithms/types";

import {
  RateLimiterService,
  RateLimiterUnavailableError,
  RateLimitServiceResult,
} from "../store/rateLimiterService";

type IdentityType = "ip" | "api-key";

interface RateLimitOptions {
  name: string;
  identity: IdentityType;
  rule: RateLimitRule;
}

const defaultRateLimiterService = new RateLimiterService(
  config.REDIS_FAILURE_MODE
);

function getClientIdentity(
  req: Request,
  identityType: IdentityType
): string {
  if (identityType === "api-key") {
    const apiKey = req.get("x-api-key")?.trim();

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

function getLimit(rule: RateLimitRule): number {
  return rule.algorithm === "token-bucket"
    ? rule.capacity
    : rule.limit;
}

function setHeaders(
  res: Response,
  result: RateLimitServiceResult,
  rule: RateLimitRule
): void {
  if (result.source === "fail-open") {
    // We cannot report an accurate remaining quota while Redis is down.
    res.setHeader("X-RateLimit-Status", "bypassed");
    res.setHeader("X-RateLimit-Degraded", "true");
    return;
  }

  res.setHeader("X-RateLimit-Limit", String(getLimit(rule)));

  res.setHeader(
    "X-RateLimit-Remaining",
    String(result.remaining)
  );

  res.setHeader(
    "X-RateLimit-Reset",
    String(Math.ceil((Date.now() + result.resetMs) / 1000))
  );

  res.setHeader(
    "X-RateLimit-Status",
    result.source === "local-fallback"
      ? "local-fallback"
      : "enforced"
  );

  if (result.source === "local-fallback") {
    res.setHeader("X-RateLimit-Degraded", "true");
  } else {
    res.setHeader("X-RateLimit-Degraded", "false");
  }

  if (!result.allowed) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil(result.retryAfterMs / 1000)))
    );
  }
}

export function rateLimit(
  options: RateLimitOptions,
  service: RateLimiterService = defaultRateLimiterService
): RequestHandler {
  const { name, identity, rule } = options;

  return (req, res, next) => {
    const execute = async (): Promise<void> => {
      const clientIdentity = getClientIdentity(req, identity);

      const redisKey =
        `rl:v1:${name}:${hashKey(clientIdentity)}`;

      const result = await service.check(redisKey, rule);

      setHeaders(res, result, rule);

      if (!result.allowed) {
        res.status(429).json({
          error: "Too many requests",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(result.retryAfterMs / 1000)
          ),
        });

        return;
      }

      next();
    };

    execute().catch((error: unknown) => {
      if (error instanceof RateLimiterUnavailableError) {
        res.setHeader("Retry-After", "1");
        res.setHeader("X-RateLimit-Status", "unavailable");

        res.status(503).json({
          error: "Rate limiter temporarily unavailable",
          message:
            "The request was rejected because rate limits cannot currently be enforced.",
        });

        return;
      }

      next(error);
    });
  };
}
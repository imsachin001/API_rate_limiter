import express, { RequestHandler } from "express";

import { config } from "./config/env";
import { routeRateLimits } from "./config/rateLimitRules";
import { rateLimit } from "./middleware/rateLimit";

export const app = express();

app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "distributed-rate-limiter",
  });
});

function getRateLimitMiddleware(name: string): RequestHandler {
  const routeConfig = routeRateLimits.find(
    (item) => item.name === name
  );

  if (!routeConfig) {
    throw new Error(`Rate-limit configuration not found: ${name}`);
  }

  return rateLimit({
    name: routeConfig.name,
    identity: routeConfig.identity,
    rule: routeConfig.rule,
  });
}

// Fixed Window: 5 requests per minute per IP.
app.get(
  "/api/public",
  getRateLimitMiddleware("public-read"),
  (_req, res) => {
    res.json({
      message: "Public API request successful",
    });
  }
);

// Sliding Log: 3 requests per minute per IP.
app.post(
  "/api/login",
  getRateLimitMiddleware("login"),
  (_req, res) => {
    res.json({
      message: "Demo login endpoint",
    });
  }
);

// Sliding Counter: 10 requests per minute per API key.
app.get(
  "/api/account",
  getRateLimitMiddleware("account"),
  (_req, res) => {
    res.json({
      message: "Account API request successful",
    });
  }
);

// Token Bucket: capacity 3, refill 0.2 tokens per second.
app.post(
  "/api/export",
  getRateLimitMiddleware("export"),
  (_req, res) => {
    res.json({
      message: "Export request accepted",
    });
  }
);
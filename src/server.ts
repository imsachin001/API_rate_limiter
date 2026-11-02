import "dotenv/config";

import { app } from "./app";
import { config } from "./config/env";
import { connectRedis } from "./store/redis";

async function startServer(): Promise<void> {
  // Start the Redis connection attempt without blocking HTTP startup.
  void connectRedis().catch((error: unknown) => {
    console.error(
      "[Redis] Initial connection failed:",
      error instanceof Error ? error.message : error
    );

    console.warn(
      `[Redis] Failure mode: ${config.REDIS_FAILURE_MODE}`
    );
  });

  app.listen(config.PORT, () => {
    console.log(
      `Rate limiter server running on port ${config.PORT}`
    );
  });
}

void startServer();
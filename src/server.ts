import "dotenv/config";

import { app } from "./app";
import { config } from "./config/env";
import { connectRedis } from "./store/redis";

async function startServer(): Promise<void> {
  try {
    await connectRedis();

    app.listen(config.PORT, () => {
      console.log(
        `Rate limiter server running on port ${config.PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
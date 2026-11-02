import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  lazyConnect: true,

  // Fail commands instead of queuing an unlimited backlog
  // while Redis is unavailable.
  enableOfflineQueue: false,

  // Limit command retries during connection failures.
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,

  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

redis.on("reconnecting", () => {
  console.warn("[Redis] Reconnecting...");
});

redis.on("close", () => {
  if (redis.status !== "end") {
    console.warn("[Redis] Connection closed");
  }
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("error", (error) => {
  console.error("[Redis] Error:", error.message);
});

export async function connectRedis(): Promise<void> {
  if (redis.status === "wait") {
    await redis.connect();
  }

  await redis.ping();
}
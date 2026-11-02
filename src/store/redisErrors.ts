export class RedisUnavailableError extends Error {
  constructor(message = "Redis is unavailable") {
    super(message);
    this.name = "RedisUnavailableError";
  }
}

export function isRedisUnavailableError(
  error: unknown
): boolean {
  if (error instanceof RedisUnavailableError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const redisError = error as NodeJS.ErrnoException;

  const connectionErrorCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EPIPE",
    "NR_CLOSED",
  ]);

  if (redisError.code && connectionErrorCodes.has(redisError.code)) {
    return true;
  }

  return /connection is closed|stream isn't writeable|offline queue|maximum number of retries|reached the max retries per request limit|redis unavailable/i.test(
    error.message
  );
}
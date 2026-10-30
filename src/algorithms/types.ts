
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterMs: number;
}

export interface WindowRule {
  limit: number;
  windowMs: number;
}

export interface TokenBucketRule {
  capacity: number;
  refillPerSecond: number;
  cost?: number;
}

export interface RateLimiter<R> {
  check(
    key: string,
    rule: R,
    now?: number
  ): RateLimitResult;
}

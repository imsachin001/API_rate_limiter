
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterMs: number;
}

export interface AsyncRateLimiter<R> {
  check(key: string, rule: R): Promise<RateLimitResult>;
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

export type RateLimitRule =
  | (WindowRule & { algorithm: "fixed-window" })
  | (WindowRule & { algorithm: "sliding-log" })
  | (WindowRule & { algorithm: "sliding-counter" })
  | (TokenBucketRule & { algorithm: "token-bucket" });
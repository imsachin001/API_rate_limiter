
import {
  RateLimitResult,
  RateLimiter,
  WindowRule
} from "./types";

export class SlidingLogLimiter
  implements RateLimiter<WindowRule> {

  private requests = new Map<string, number[]>();

  check(
    key: string,
    rule: WindowRule,
    now: number = Date.now()
  ): RateLimitResult {

    const timestamps = this.requests.get(key) ?? [];

    const windowStart = now - rule.windowMs;

    // Remove expired requests.
    const active = timestamps.filter(
      timestamp => timestamp > windowStart
    );

    if (active.length >= rule.limit) {
      const resetAt = active[0] + rule.windowMs;

      this.requests.set(key, active);

      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetAt - now),
        retryAfterMs: Math.max(0, resetAt - now)
      };
    }

    active.push(now);

    this.requests.set(key, active);

    const resetAt = active[0] + rule.windowMs;

    return {
      allowed: true,
      remaining: rule.limit - active.length,
      resetMs: Math.max(0, resetAt - now),
      retryAfterMs: 0
    };
  }
}

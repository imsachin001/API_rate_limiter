
import {
  RateLimitResult,
  RateLimiter,
  WindowRule
} from "./types";

interface WindowState {
  count: number;
  windowStart: number;
}

export class FixedWindowLimiter
  implements RateLimiter<WindowRule> {

  private buckets = new Map<string, WindowState>();

  check(
    key: string,
    rule: WindowRule,
    now: number = Date.now()
  ): RateLimitResult {

    const windowStart =
      Math.floor(now / rule.windowMs) * rule.windowMs;

    let state = this.buckets.get(key);

    if (!state || state.windowStart !== windowStart) {
      state = {
        count: 0,
        windowStart
      };

      this.buckets.set(key, state);
    }

    const resetAt = windowStart + rule.windowMs;

    if (state.count >= rule.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetAt - now),
        retryAfterMs: Math.max(0, resetAt - now)
      };
    }

    state.count++;

    return {
      allowed: true,
      remaining: rule.limit - state.count,
      resetMs: Math.max(0, resetAt - now),
      retryAfterMs: 0
    };
  }
}

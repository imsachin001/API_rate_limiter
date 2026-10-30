
import {
  RateLimitResult,
  RateLimiter,
  TokenBucketRule
} from "./types";

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketLimiter
  implements RateLimiter<TokenBucketRule> {

  private buckets = new Map<string, BucketState>();

  check(
    key: string,
    rule: TokenBucketRule,
    now: number = Date.now()
  ): RateLimitResult {

    if (
      rule.capacity <= 0 ||
      rule.refillPerSecond <= 0 ||
      (rule.cost ?? 1) <= 0 ||
      (rule.cost ?? 1) > rule.capacity
    ) {
      throw new Error("Invalid token bucket configuration");
    }

    const cost = rule.cost ?? 1;

    let state = this.buckets.get(key);

    if (!state) {
      state = {
        tokens: rule.capacity,
        lastRefill: now
      };
    }

    const elapsed = Math.max(0, now - state.lastRefill);

    const refill =
      elapsed / 1000 * rule.refillPerSecond;

    state.tokens = Math.min(
      rule.capacity,
      state.tokens + refill
    );

    state.lastRefill = Math.max(state.lastRefill, now);

    const allowed = state.tokens >= cost;

    if (allowed) {
      state.tokens -= cost;
    }

    this.buckets.set(key, state);

    const retryAfterMs = allowed
      ? 0
      : Math.ceil(
          ((cost - state.tokens) / rule.refillPerSecond) * 1000
        );

    const resetMs = Math.ceil(
      ((rule.capacity - state.tokens) / rule.refillPerSecond) * 1000
    );

    return {
      allowed,
      remaining: Math.floor(state.tokens),
      resetMs,
      retryAfterMs
    };
  }
}

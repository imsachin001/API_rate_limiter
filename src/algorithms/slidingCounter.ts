
import {
  RateLimitResult,
  RateLimiter,
  WindowRule
} from "./types";

interface CounterState {
  currentWindow: number;
  currentCount: number;
  previousCount: number;
}

export class SlidingCounterLimiter
  implements RateLimiter<WindowRule> {

  private counters = new Map<string, CounterState>();

  check(
    key: string,
    rule: WindowRule,
    now: number = Date.now()
  ): RateLimitResult {

    const currentWindow = Math.floor(now / rule.windowMs);

    const elapsed = now % rule.windowMs;

    let state = this.counters.get(key);

    if (!state) {
      state = {
        currentWindow,
        currentCount: 0,
        previousCount: 0
      };
    } else if (state.currentWindow !== currentWindow) {

      if (state.currentWindow === currentWindow - 1) {
        state.previousCount = state.currentCount;
      } else {
        state.previousCount = 0;
      }

      state.currentCount = 0;
      state.currentWindow = currentWindow;
    }

    const weight = 1 - elapsed / rule.windowMs;

    const estimated =
      state.previousCount * weight + state.currentCount;

    const allowed = estimated < rule.limit;

    if (allowed) {
      state.currentCount++;
    }

    this.counters.set(key, state);

    const updatedEstimate = allowed
      ? estimated + 1
      : estimated;

    return {
      allowed,
      remaining: Math.max(
        0,
        Math.floor(rule.limit - updatedEstimate)
      ),
      resetMs: rule.windowMs - elapsed,
      retryAfterMs: allowed ? 0 : rule.windowMs - elapsed
    };
  }
}

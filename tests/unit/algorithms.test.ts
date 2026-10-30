
import { FixedWindowLimiter } from "../../src/algorithms/fixedWindow";
import { SlidingLogLimiter } from "../../src/algorithms/slidingLog";
import { SlidingCounterLimiter } from "../../src/algorithms/slidingCounter";
import { TokenBucketLimiter } from "../../src/algorithms/tokenBucket";

describe("Fixed Window", () => {
  it("blocks requests after reaching the limit", () => {
    const limiter = new FixedWindowLimiter();
    const rule = { limit: 2, windowMs: 1000 };

    expect(limiter.check("user1", rule, 100).allowed).toBe(true);
    expect(limiter.check("user1", rule, 200).allowed).toBe(true);
    expect(limiter.check("user1", rule, 300).allowed).toBe(false);
  });

  it("resets the counter in a new window", () => {
    const limiter = new FixedWindowLimiter();
    const rule = { limit: 2, windowMs: 1000 };

    limiter.check("user1", rule, 100);
    limiter.check("user1", rule, 200);

    expect(limiter.check("user1", rule, 1100).allowed).toBe(true);
  });
});

describe("Sliding Window Log", () => {
  it("removes expired requests", () => {
    const limiter = new SlidingLogLimiter();
    const rule = { limit: 2, windowMs: 1000 };

    limiter.check("user1", rule, 100);
    limiter.check("user1", rule, 200);

    expect(limiter.check("user1", rule, 1200).allowed).toBe(true);
  });

  it("blocks when the rolling window is full", () => {
    const limiter = new SlidingLogLimiter();
    const rule = { limit: 2, windowMs: 1000 };

    limiter.check("user1", rule, 100);
    limiter.check("user1", rule, 200);

    expect(limiter.check("user1", rule, 300).allowed).toBe(false);
  });
});

describe("Sliding Window Counter", () => {
  it("blocks when the estimated count reaches the limit", () => {
    const limiter = new SlidingCounterLimiter();
    const rule = { limit: 2, windowMs: 1000 };

    limiter.check("user1", rule, 100);
    limiter.check("user1", rule, 200);

    expect(limiter.check("user1", rule, 300).allowed).toBe(false);
  });
});

describe("Token Bucket", () => {
  it("allows bursts up to the bucket capacity", () => {
    const limiter = new TokenBucketLimiter();

    const rule = {
      capacity: 3,
      refillPerSecond: 1
    };

    expect(limiter.check("user1", rule, 1000).allowed).toBe(true);
    expect(limiter.check("user1", rule, 1000).allowed).toBe(true);
    expect(limiter.check("user1", rule, 1000).allowed).toBe(true);
    expect(limiter.check("user1", rule, 1000).allowed).toBe(false);
  });

  it("refills tokens over time", () => {
    const limiter = new TokenBucketLimiter();

    const rule = {
      capacity: 2,
      refillPerSecond: 1
    };

    limiter.check("user1", rule, 1000);
    limiter.check("user1", rule, 1000);

    expect(limiter.check("user1", rule, 2000).allowed).toBe(true);
  });
});

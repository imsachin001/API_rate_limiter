local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000
    + math.floor(tonumber(time[2]) / 1000)

local values = redis.call("HMGET", key, "tokens", "last_refill")

local tokens = tonumber(values[1])
local last_refill = tonumber(values[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

local elapsed = math.max(0, now - last_refill) / 1000

tokens = math.min(
    capacity,
    tokens + elapsed * refill_rate
)

local allowed = 0

if tokens >= cost then
    tokens = tokens - cost
    allowed = 1
end

local retry_after = 0

if allowed == 0 then
    retry_after = math.ceil(
        ((cost - tokens) / refill_rate) * 1000
    )
end

local remaining = math.floor(tokens)

local reset_ms = math.ceil(
    ((capacity - tokens) / refill_rate) * 1000
)

redis.call(
    "HSET",
    key,
    "tokens", tokens,
    "last_refill", now
)

redis.call("PEXPIRE", key, reset_ms + 60000)

return {
    allowed,
    remaining,
    reset_ms,
    retry_after
}
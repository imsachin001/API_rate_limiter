local key = KEYS[1]

local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local request_id = ARGV[3]

local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000
    + math.floor(tonumber(time[2]) / 1000)

local window_start = now - window_ms

redis.call("ZREMRANGEBYSCORE", key, "-inf", window_start)

local current = redis.call("ZCARD", key)

local allowed = 0
local remaining = 0
local retry_after = 0

if current < limit then
    redis.call("ZADD", key, now, request_id)
    redis.call("PEXPIRE", key, window_ms)

    allowed = 1
    remaining = limit - current - 1
else
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    retry_after = math.max(0, tonumber(oldest[2]) + window_ms - now)
end

local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local reset_ms = window_ms

if #oldest > 0 then
    reset_ms = math.max(
        0,
        tonumber(oldest[2]) + window_ms - now
    )
end

return {
    allowed,
    remaining,
    reset_ms,
    retry_after
}
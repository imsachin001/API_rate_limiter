local base_key = KEYS[1]

local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000
    + math.floor(tonumber(time[2]) / 1000)

local window_id = math.floor(now / window_ms)
local key = base_key .. ":" .. window_id

local current = redis.call("INCR", key)

if current == 1 then
    redis.call("PEXPIRE", key, window_ms * 2)
end

local reset_ms = window_ms - (now % window_ms)

local allowed = 0
if current <= limit then
    allowed = 1
end

local remaining = math.max(0, limit - current)

return {
    allowed,
    remaining,
    reset_ms,
    allowed == 1 and 0 or reset_ms
}
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000
    + math.floor(tonumber(time[2]) / 1000)

local window_id = math.floor(now / window_ms)
local elapsed = now % window_ms

local current_key = KEYS[1] .. ":" .. window_id
local previous_key = KEYS[1] .. ":" .. (window_id - 1)

local current = tonumber(redis.call("GET", current_key) or "0")
local previous = tonumber(redis.call("GET", previous_key) or "0")

local previous_weight = 1 - (elapsed / window_ms)
local estimated = previous * previous_weight + current

local allowed = 0

if estimated < limit then
    current = redis.call("INCR", current_key)
    redis.call("PEXPIRE", current_key, window_ms * 2)
    allowed = 1
end

local updated_estimate =
    previous * previous_weight + current

local remaining = math.max(
    0,
    math.floor(limit - updated_estimate)
)

local reset_ms = window_ms - elapsed

return {
    allowed,
    remaining,
    reset_ms,
    allowed == 1 and 0 or reset_ms
}
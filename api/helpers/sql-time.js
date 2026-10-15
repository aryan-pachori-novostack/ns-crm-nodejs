// True IST wall-clock digits regardless of the DB connection/server time_zone
// (UTC_TIMESTAMP() ignores time_zone; plain NOW() and convert_tz(now(),...) do not).
const IST_NOW_SQL = "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')";

module.exports = { IST_NOW_SQL };

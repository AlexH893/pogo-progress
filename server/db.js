const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z'
});

// Wrap execute so every query runs in a UTC session.
// TIMESTAMP columns (e.g. uploaded_at) are stored by the DB server using its
// system timezone (MDT). Without forcing UTC here, mysql2 appends 'Z' to the
// local time value, causing a 6-hour display offset in the browser.
const _execute = pool.execute.bind(pool);
pool.execute = async function (sql, params) {
  await _execute("SET time_zone = '+00:00'");
  return _execute(sql, params);
};

const _query = pool.query.bind(pool);
pool.query = async function (sql, params) {
  await _query("SET time_zone = '+00:00'");
  return _query(sql, params);
};

module.exports = pool;

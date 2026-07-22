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

// Auto-migration: ensure stardust column exists on stats table
(async () => {
  try {
    const [rows] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stats' AND COLUMN_NAME = 'stardust'"
    );
    if (rows.length === 0) {
      await pool.query("ALTER TABLE stats ADD COLUMN stardust BIGINT NULL AFTER total_xp");
      console.log("Migration: Added 'stardust' column to 'stats' table.");
    }
    // Clean up existing Stardust entries where zeroes were saved instead of NULL
    await pool.query(
      "UPDATE stats SET distance_walked = NULL, caught = NULL, total_xp = NULL WHERE stardust IS NOT NULL AND level IS NULL AND (caught = 0 OR distance_walked = 0 OR total_xp = 0)"
    );
  } catch (err) {
    // If schema query fails or column exists, ignore
    console.warn("Migration check for stardust column:", err.message);
  }
})();

module.exports = pool;

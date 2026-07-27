const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z'
});

// Wrap execute/query so the SET and the real query always share the SAME
// pooled connection. The previous approach called the original method twice,
// which could check out two different connections from the pool — the SET
// would run on connection A and the query on connection B without UTC set.
pool.execute = async function (sql, params) {
  const conn = await pool.getConnection();
  try {
    await conn.query("SET time_zone = '+00:00'");
    return await conn.execute(sql, params);
  } finally {
    conn.release();
  }
};

pool.query = async function (sql, params) {
  const conn = await pool.getConnection();
  try {
    await conn.query("SET time_zone = '+00:00'");
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
};

// Auto-migration: ensure stardust column exists on stats table
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const [rows] = await pool.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stats' AND COLUMN_NAME = 'stardust'"
      );
      if (rows.length === 0) {
        await pool.query("ALTER TABLE stats ADD COLUMN stardust BIGINT NULL AFTER total_xp");
        console.log("Migration: Added 'stardust' column to 'stats' table.");
      }

      // Auto-migration: ensure stat metric columns allow NULL for stardust-only or partial uploads
      const [notNullCols] = await pool.query(
        "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stats' AND COLUMN_NAME IN ('level', 'distance_walked', 'caught', 'stop_visited', 'total_xp') AND IS_NULLABLE = 'NO'"
      );
      for (const col of notNullCols) {
        await pool.query(`ALTER TABLE stats MODIFY COLUMN ${col.COLUMN_NAME} ${col.COLUMN_TYPE} NULL`);
        console.log(`Migration: Made column '${col.COLUMN_NAME}' nullable in 'stats' table.`);
      }
      // Clean up existing Stardust entries where zeroes were saved instead of NULL.
      // Guard with a COUNT first so we don't run a write on every boot once data is clean.
      const [[{ dirtyCount }]] = await pool.query(
        "SELECT COUNT(*) AS dirtyCount FROM stats WHERE stardust IS NOT NULL AND level IS NULL AND (caught = 0 OR distance_walked = 0 OR total_xp = 0)"
      );
      if (dirtyCount > 0) {
        await pool.query(
          "UPDATE stats SET distance_walked = NULL, caught = NULL, total_xp = NULL WHERE stardust IS NOT NULL AND level IS NULL AND (caught = 0 OR distance_walked = 0 OR total_xp = 0)"
        );
        console.log(`Migration: Nullified zeroes on ${dirtyCount} stardust-only stat row(s).`);
      }
    } catch (err) {
      // If schema query fails or column exists, ignore
      console.warn("Migration check for stardust column:", err.message);
    }
  })();
}

module.exports = pool;

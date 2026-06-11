const mysql = require("mysql2/promise");
require("dotenv").config();
async function run() {
  const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    timezone: 'Z'
  });
  const [users] = await db.execute('SELECT * FROM users');
  console.log('users:', users);
  const [stats] = await db.execute('SELECT * FROM stats');
  console.log('stats:', stats);
  process.exit(0);
}
run();

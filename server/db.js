const mysql = require("mysql2/promise");
require("dotenv").config();

const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z'
});

module.exports = db;

require("dotenv").config();
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const app = express();

// Use DATABASE_URL from .env file or environment variables
const db = mysql.createPool(process.env.DATABASE_URL);

// App configurations
app.use(bodyParser.json());
app.use(cors());

// Register routes (pass app & db to avoid circular dependency)
require('./routes')(app, db);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

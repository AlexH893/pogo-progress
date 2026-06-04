const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const app = express();

// Dev
const db = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "newpassword",
  database: "pogoprogress",
});

// App configurations
app.use(bodyParser.json());
app.use(cors());

// Register routes (pass app & db to avoid circular dependency)
require('./routes')(app, db);

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

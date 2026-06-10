require("dotenv").config();
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const app = express();

// Use DATABASE_URL from .env file or environment variables
const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z'
});

// App configurations
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com", "https://docs.opencv.org", "'unsafe-inline'", "'unsafe-eval'"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "http://localhost:3000", "https://pogo-progress.onrender.com"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://accounts.google.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*", "http://*"]
    }
  }
}));

app.use(bodyParser.json());
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://pogo-progress.onrender.com',
    'https://alexh893.github.io'
  ]
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Stricter rate limits for specific routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000
});
app.use('/auth/', authLimiter);

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 50 : 1000
});
app.use('/post-data', postLimiter);

// Register routes (pass app & db to avoid circular dependency)
require('./routes')(app, db);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

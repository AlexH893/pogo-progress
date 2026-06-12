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
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://accounts.google.com", "https://docs.opencv.org", "'unsafe-inline'", "'unsafe-eval'"],
      "frame-src": ["'self'", "https://accounts.google.com"],
      "connect-src": ["'self'", "https://accounts.google.com", "http://localhost:3000", "https://pogo-progress.onrender.com"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "https://accounts.google.com", "'unsafe-inline'"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https://*", "http://*"]
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

const { globalLimiter } = require('./middleware/rateLimiter');

// Rate limiting
app.use(globalLimiter);

// Register routes (pass app & db to avoid circular dependency)
require('./routes')(app, db);

// SSR Integration
try {
  const ssrModule = require('../dist/pogo-progress/server/main.js');
  if (ssrModule && ssrModule.app) {
    console.log('Mounting Angular SSR engine...');
    app.use(ssrModule.app());
  }
} catch (err) {
  console.log('Angular SSR engine not found or failed to load. Serving API only.');
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

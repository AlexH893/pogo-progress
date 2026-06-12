const rateLimit = require('express-rate-limit');

// Custom handler for JSON response
const customHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    error: "Too many requests, please try again later."
  });
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  handler: customHandler
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: "Too many authentication attempts, please try again after 15 minutes."
    });
  }
});

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 50 : 1000,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: "Too many data modifications, please try again after 15 minutes."
    });
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  actionLimiter
};

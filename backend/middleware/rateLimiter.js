const rateLimit = require('express-rate-limit');

// General API limiter - 1000 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Don't count health check requests
    return req.path === '/api/health';
  }
});

// Auth limiter - strict limits for login/signup
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login/signup attempts, please try again after 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false
});

// Message limiter - 150 messages per minute per user
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 150, // limit each user to 150 messages per minute
  message: 'Too many messages sent, please slow down.',
  keyGenerator: (req) => {
    // Use user ID if authenticated, fallback to IP
    return req.userId || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to authenticated users
    return !req.userId;
  }
});

// Search limiter - 100 searches per minute
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 searches per minute
  message: 'Too many searches, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
  searchLimiter
};

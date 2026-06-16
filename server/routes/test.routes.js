const express = require('express');
const router = express.Router();
const testController = require('../controllers/test.controller');
const { authLimiter } = require('../middleware/rateLimiter');

router.get('/auth/test-token', authLimiter, testController.getTestToken);
router.delete('/cleanup-test-data', testController.cleanupTestData);

module.exports = router;

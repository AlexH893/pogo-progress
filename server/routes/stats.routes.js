const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validateStats } = require('../middleware/validation');
const { actionLimiter } = require('../middleware/rateLimiter');

router.post('/post-data', optionalAuth, actionLimiter, validateStats, statsController.postData);
router.put('/update-data/:id', requireAuth, actionLimiter, validateStats, statsController.updateData);
router.delete('/delete-data/:id', requireAuth, actionLimiter, statsController.deleteData);
router.get('/get-data', optionalAuth, statsController.getData);
router.get('/get-user-stats/:username', optionalAuth, statsController.getUserStats);

module.exports = router;

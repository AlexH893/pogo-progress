const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');
const { validatePreferences } = require('../middleware/validation');
const { actionLimiter } = require('../middleware/rateLimiter');

router.get('/user-preferences', requireAuth, userController.getUserPreferences);
router.put('/user-preferences/:username', requireAuth, actionLimiter, validatePreferences, userController.updateUserPreferences);
router.get('/export-data', requireAuth, userController.exportData);
router.delete('/unlink-trainer/:username', requireAuth, userController.unlinkTrainer);
router.delete('/delete-account', requireAuth, userController.deleteAccount);

module.exports = router;

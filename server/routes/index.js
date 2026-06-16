const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const statsRoutes = require('./stats.routes');
const userRoutes = require('./user.routes');
const testRoutes = require('./test.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/', statsRoutes); 
router.use('/', userRoutes); 
router.use('/', testRoutes); 

module.exports = router;

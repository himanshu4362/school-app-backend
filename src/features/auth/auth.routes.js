const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');
const { protect } = require('../../middlewares/auth.middleware');

// POST /api/auth/login
router.post('/login', AuthController.login);

// POST /api/auth/setup-password (Requires the token from login)
router.post('/setup-password', protect, AuthController.setupNewPassword);

module.exports = router;
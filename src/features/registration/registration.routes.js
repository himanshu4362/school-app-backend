const express = require('express');
const router = express.Router();
const RegistrationController = require('./registration.controller');

router.post('/onboard', RegistrationController.registerSchool);

module.exports = router;
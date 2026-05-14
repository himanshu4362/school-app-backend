const express = require('express');
const router = express.Router();
const AdmissionsController = require('./admissions.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect); 

// Create Application
router.post('/applications', AdmissionsController.createApplication);
// Add this right above your /enroll route
router.patch('/applications/:id/status', AdmissionsController.updateApplicationStatus);
// Trigger Atomic Enrollment Transaction
router.post('/applications/:id/enroll', AdmissionsController.triggerEnrollment);
module.exports = router;
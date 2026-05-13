const express = require('express');
const router = express.Router();
const AdmissionsController = require('./admissions.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Protect all CRM routes
router.use(protect);

router.post('/leads', AdmissionsController.addLead);
router.get('/leads', AdmissionsController.fetchLeads);
router.put('/leads/:id', AdmissionsController.modifyLead);

// S3 File Upload Endpoint
router.post('/presigned-url', AdmissionsController.requestUploadUrl);

// Application Endpoints
router.post('/applications', AdmissionsController.submitFinalApplication);
router.get('/applications', AdmissionsController.fetchApplications);

module.exports = router;
const express = require('express');
const router = express.Router();
const AdmissionsController = require('./admissions.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect); 

// APPLICATION ROUTES
router.get('/upload-url', AdmissionsController.getUploadUrl);
router.post('/applications', AdmissionsController.createApplication);
router.get('/applications/metadata', AdmissionsController.getApplicationMetadata);
router.get('/applications', AdmissionsController.fetchApplications);
router.patch('/applications/:id/status', AdmissionsController.updateApplicationStatus);
router.post('/applications/:id/enroll', AdmissionsController.triggerEnrollment);
router.get('/applications/:id', AdmissionsController.getApplicationById);
router.get('/documents/url', AdmissionsController.getDocumentUrl);
router.patch('/applications/:id/documents/:documentId/verify', AdmissionsController.verifyDocument);
router.put('/applications/:id', AdmissionsController.updateApplication);

router.post('/leads', AdmissionsController.captureLead);
router.get('/leads/metadata', AdmissionsController.getLeadMetadata);
router.get('/leads', AdmissionsController.fetchLeads);
router.patch('/leads/:id/status', AdmissionsController.updateLeadStatus);

module.exports = router;
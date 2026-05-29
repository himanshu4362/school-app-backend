const express = require('express');
const router = express.Router();
const AdmissionsController = require('./admissions.controller');
const { protect, roleGuard } = require('../../middlewares/auth.middleware');

router.use(protect);

router.get('/upload-url', AdmissionsController.getUploadUrl);
router.post('/applications', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER'), AdmissionsController.createApplication);
router.get('/applications/metadata', AdmissionsController.getApplicationMetadata);
router.get('/applications', AdmissionsController.fetchApplications);
router.patch('/applications/:id/status', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER', 'PRINCIPAL'), AdmissionsController.updateApplicationStatus);
router.post('/applications/:id/enroll', roleGuard('SUPER_ADMIN', 'PRINCIPAL'), AdmissionsController.triggerEnrollment);
router.get('/applications/:id', AdmissionsController.getApplicationById);
router.get('/documents/url', AdmissionsController.getDocumentUrl);
router.patch('/applications/:id/documents/:documentId/verify', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER'), AdmissionsController.verifyDocument);
router.put('/applications/:id', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER'), AdmissionsController.updateApplication);
router.post('/leads', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER'), AdmissionsController.captureLead);
router.get('/leads/metadata', AdmissionsController.getLeadMetadata);
router.get('/leads', AdmissionsController.fetchLeads);
router.patch('/leads/:id/status', roleGuard('SUPER_ADMIN', 'ADMIN', 'ADMISSION_OFFICER'), AdmissionsController.updateLeadStatus);

module.exports = router;
const express = require('express');
const router = express.Router();
const AdmissionsController = require('./admissions.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.use(protect); 


router.get('/upload-url', AdmissionsController.getUploadUrl);
router.post('/applications', AdmissionsController.createApplication);
router.patch('/applications/:id/status', AdmissionsController.updateApplicationStatus);
router.post('/applications/:id/enroll', AdmissionsController.triggerEnrollment);
router.post('/leads', AdmissionsController.captureLead);
router.get('/leads/metadata', AdmissionsController.getLeadMetadata);
router.get('/leads', AdmissionsController.fetchLeads);
router.patch('/leads/:id/status', AdmissionsController.updateLeadStatus);


module.exports = router;
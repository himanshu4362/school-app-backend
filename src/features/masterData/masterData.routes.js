const express = require('express');
const router = express.Router();
const MasterDataController = require('./masterData.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Apply protection to all routes in this file
router.use(protect);

// Academic Year Routes
router.post('/academic-years', MasterDataController.addAcademicYear);
router.get('/academic-years', MasterDataController.fetchAcademicYears);

// Grade Routes
router.post('/grades', MasterDataController.addGrade);
router.get('/grades', MasterDataController.fetchGrades);

module.exports = router;
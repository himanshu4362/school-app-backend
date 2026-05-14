const express = require('express');
const router = express.Router();
const MasterDataController = require('./masterData.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Apply protection to all routes in this file
router.use(protect);

// Academic Year Routes
router.post('/academic-years', MasterDataController.addAcademicYear);
router.get('/academic-years', MasterDataController.fetchAcademicYears);

router.post('/grades', MasterDataController.addGrade);
router.get('/grades', MasterDataController.fetchGrades);
router.post('/sections', MasterDataController.addSection);
router.post('/seats', MasterDataController.addSeatInventory);
router.post('/rooms', MasterDataController.addRoom);
router.get('/config/room-types', MasterDataController.getRoomMetadata);
router.get('/rooms', MasterDataController.fetchRooms);
router.get('/sections', MasterDataController.fetchSections);
router.get('/seats', MasterDataController.fetchSeatInventories);

module.exports = router;
const express = require('express');
const router = express.Router();
const MasterDataController = require('./masterData.controller');
const { protect, roleGuard } = require('../../middlewares/auth.middleware');

router.use(protect);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN'));

// Academic Years
router.post('/academic-years', MasterDataController.addAcademicYear);
router.get('/academic-years', MasterDataController.fetchAcademicYears);
router.put('/academic-years/:id', MasterDataController.updateAcademicYear);

// Grades
router.post('/grades', MasterDataController.addGrade);
router.get('/grades', MasterDataController.fetchGrades);
router.put('/grades/:id', MasterDataController.updateGrade);

// Rooms
router.post('/rooms', MasterDataController.addRoom);
router.get('/rooms', MasterDataController.fetchRooms);
router.get('/config/room-types', MasterDataController.getRoomMetadata);
router.put('/rooms/:id', MasterDataController.updateRoom);

// Sections
router.post('/sections', MasterDataController.addSection);
router.get('/sections', MasterDataController.fetchSections);
router.put('/sections/:id', MasterDataController.updateSection);
router.patch('/sections/:id/archive', MasterDataController.archiveSection);

// Seat Inventory
router.post('/seats', MasterDataController.addSeatInventory);
router.get('/seats', MasterDataController.fetchSeatInventories);
router.get('/seats/:id', MasterDataController.getSeatInventoryById);
router.get('/seats/:id/metrics', MasterDataController.getSeatMetrics);
router.put('/seats/:id', MasterDataController.updateSeatInventory);

module.exports = router;
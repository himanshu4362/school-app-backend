const express = require('express');
const router = express.Router();
const MasterDataController = require('./masterData.controller');
const { protect, roleGuard  } = require('../../middlewares/auth.middleware');

router.use(protect);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN'));

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
router.get('/seats/:id/metrics', MasterDataController.getSeatMetrics);
router.get('/seats/:id', MasterDataController.getSeatInventoryById);


module.exports = router;
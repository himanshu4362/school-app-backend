const MasterDataService = require('./masterData.service');
const Section = require('../../models/section.model');
const SeatInventory = require('../../models/seatInventory.model');
const Room = require('../../models/room.model');
const Grade = require('../../models/grade.model');
const AcademicYear = require('../../models/academicYear.model');


const addAcademicYear = async (req, res) => {
    try {
        const schoolId = req.user.schoolId; // Extracted from your Auth JWT
        const result = await MasterDataService.createAcademicYear(schoolId, req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getRoomMetadata = async (req, res) => {
    try {
        // We reach into the Mongoose schema to get the enum values
        const roomTypes = Room.schema.path('roomType').enumValues;

        // We can also format them for the UI (e.g., "STANDARD_CLASSROOM" -> "Standard Classroom")
        const formattedTypes = roomTypes.map(type => ({
            value: type,
            label: type.split('_').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
        }));

        res.status(200).json({ success: true, data: formattedTypes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const fetchAcademicYears = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await MasterDataService.getAcademicYears(schoolId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const addGrade = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await MasterDataService.createGrade(schoolId, req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchGrades = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await MasterDataService.getGrades(schoolId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// 1. Create Physical Room
const addRoom = async (req, res) => {
    try {
        const result = await Room.create({ schoolId: req.user.schoolId, ...req.body });
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// 2. Create Logical Section (With Physical Constraints)
const addSection = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { academicYearId, gradeId, roomId, name, targetCapacity } = req.body;

        // VALIDATION: Fetch the physical room to check capacity
        const room = await Room.findOne({ _id: roomId, schoolId });
        if (!room) {
            throw new Error("Validation Error: Selected Room does not exist.");
        }

        // Validate grade belongs to this school
        const grade = await Grade.findOne({ _id: gradeId, schoolId });
        if (!grade) {
            throw new Error("Validation Error: Selected Grade does not exist for this school.");
        }

        // Validate academic year belongs to this school
        const academicYear = await AcademicYear.findOne({ _id: academicYearId, schoolId });
        if (!academicYear) {
            throw new Error("Validation Error: Selected Academic Year does not exist for this school.");
        }

        if (targetCapacity > room.capacity) {
            throw new Error(`Infrastructure Error: Target capacity (${targetCapacity}) exceeds the physical capacity of Room ${room.roomNumber} (${room.capacity} seats).`);
        }

        const result = await Section.create({
            schoolId,
            academicYearId,
            gradeId,
            roomId,
            name,
            targetCapacity
        });

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const addSeatInventory = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { academicYearId, gradeId, allowSpillover, quotas } = req.body;

        // NEW LOCK: Check if inventory already exists to prevent duplicate seat overlaps
        const existingInventory = await SeatInventory.findOne({ schoolId, academicYearId, gradeId });
        if (existingInventory) {
            throw new Error("Validation Error: Seat Inventory for this Grade in the selected Academic Year already exists.");
        }

        // 1. FETCH ALL SECTIONS FOR THIS GRADE AND SUM THEIR CAPACITIES
        const sectionsInGrade = await Section.find({ gradeId, schoolId, academicYearId });

        if (!sectionsInGrade || sectionsInGrade.length === 0) {
            throw new Error("Validation Error: Please create at least one Section for this Grade before configuring Seat Inventory.");
        }

        // Calculate the total physical capacity across all sections in this class
        let totalGradeCapacity = 0;
        sectionsInGrade.forEach(sec => {
            totalGradeCapacity += sec.targetCapacity;
        });

        // 2. VALIDATE THE QUOTA MATH
        const sumOfQuotas =
            (quotas?.GENERAL?.capacity || 0) +
            (quotas?.OBC?.capacity || 0) +
            (quotas?.SC?.capacity || 0) +
            (quotas?.ST?.capacity || 0) +
            (quotas?.EWS?.capacity || 0) +
            (quotas?.OTHER?.capacity || 0);

        if (sumOfQuotas !== totalGradeCapacity) {
            throw new Error(`Quota Error: The sum of category quotas (${sumOfQuotas}) must perfectly match the total capacity of all sections in this Grade (${totalGradeCapacity}).`);
        }

        // 3. CREATE THE GRADE-LEVEL INVENTORY
        const result = await SeatInventory.create({
            schoolId,
            academicYearId,
            gradeId,
            totalCapacity: totalGradeCapacity,
            allowSpillover,
            quotas
        });

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchRooms = async (req, res) => {
    try {
        const result = await Room.find({ schoolId: req.user.schoolId }).sort({ roomNumber: 1 });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchSections = async (req, res) => {
    try {
        const result = await Section.find({ schoolId: req.user.schoolId }).sort({ name: 1 });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchSeatInventories = async (req, res) => {
    try {
        const result = await SeatInventory.find({ schoolId: req.user.schoolId });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getSeatInventoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const inventory = await SeatInventory.findOne({
            _id: id,
            schoolId: req.user.schoolId
        })
            .populate('gradeId', 'name level')
            .populate('academicYearId', 'name');

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Seat inventory not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: inventory
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getSeatMetrics = async (req, res) => {
    try {
        const { id } = req.params;

        const inventory = await SeatInventory.findOne({
            _id: id,
            schoolId: req.user.schoolId
        })
            .populate('gradeId', 'name level')
            .populate('academicYearId', 'name');

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Seat inventory not found.'
            });
        }

        let totalConsumed = 0;
        let totalBlocked = 0;

        const quotaDetails = [];

        if (inventory.quotas) {

            for (const [category, data] of Object.entries(inventory.quotas)) {

                const consumed = data.consumedSeats || 0;
                const blocked = data.blockedSeats || 0;
                const capacity = data.capacity || 0;

                totalConsumed += consumed;
                totalBlocked += blocked;

                quotaDetails.push({
                    category,
                    capacity,
                    consumed,
                    blocked,
                    available: capacity - (consumed + blocked)
                });
            }
        }

        const totalAvailable =
            inventory.totalCapacity - (totalConsumed + totalBlocked);

        const metrics = {
            inventoryId: inventory._id,

            grade: inventory.gradeId,

            academicYear: inventory.academicYearId,

            totalCapacity: inventory.totalCapacity,

            overall: {
                consumed: totalConsumed,
                blocked: totalBlocked,
                available: totalAvailable,

                occupancyRate:
                    inventory.totalCapacity > 0
                        ? (
                            (totalConsumed / inventory.totalCapacity) * 100
                        ).toFixed(2) + '%'
                        : '0%'
            },

            quotas: quotaDetails
        };

        res.status(200).json({
            success: true,
            data: metrics
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    addRoom,
    addAcademicYear,
    fetchAcademicYears,
    addGrade,
    addSection,
    addSeatInventory,
    getRoomMetadata,
    fetchGrades,
    fetchRooms,
    fetchSections,
    fetchSeatInventories,
    getSeatInventoryById,
    getSeatMetrics
};
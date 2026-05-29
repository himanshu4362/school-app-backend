const MasterDataService = require('./masterData.service');
const Section = require('../../models/section.model');
const SeatInventory = require('../../models/seatInventory.model');
const Room = require('../../models/room.model');
const Grade = require('../../models/grade.model');
const AcademicYear = require('../../models/academicYear.model');
const VALID_QUOTA_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'OTHER'];

// Helper: Get total consumed + blocked seats for a grade's inventory
const getOccupiedSeats = async (schoolId, academicYearId, gradeId) => {
    const inventory = await SeatInventory.findOne({ schoolId, academicYearId, gradeId });
    if (!inventory) return { inventory: null, occupied: 0 };

    let occupied = 0;
    if (inventory.quotas) {
        for (const data of Object.values(inventory.quotas)) {
            occupied += (data.consumedSeats || 0) + (data.blockedSeats || 0);
        }
    }
    return { inventory, occupied };
};

// Helper: Recalculate grade inventory totalCapacity from ACTIVE sections
const recalculateInventoryTotal = async (schoolId, academicYearId, gradeId) => {
    const activeSections = await Section.find({ schoolId, academicYearId, gradeId, status: 'ACTIVE' });
    const newTotal = activeSections.reduce((sum, s) => sum + s.targetCapacity, 0);

    const inventory = await SeatInventory.findOne({ schoolId, academicYearId, gradeId });
    if (inventory) {
        // Validate new total >= occupied seats
        let occupied = 0;
        if (inventory.quotas) {
            for (const data of Object.values(inventory.quotas)) {
                occupied += (data.consumedSeats || 0) + (data.blockedSeats || 0);
            }
        }
        if (newTotal < occupied) {
            throw new Error(`Capacity Error: Cannot reduce total capacity to ${newTotal}. Currently ${occupied} seats are occupied (consumed + blocked).`);
        }
        // Check if quotas still sum correctly
        let quotaSum = 0;
        if (inventory.quotas) {
            for (const data of Object.values(inventory.quotas)) {
                quotaSum += (data.capacity || 0);
            }
        }

        inventory.totalCapacity = newTotal;

        // If quotas exceed new total, flag it but don't crash — admin must fix quotas manually
        if (quotaSum > newTotal) {
            throw new Error(`Quota Conflict: Total capacity is now ${newTotal} but quota allocations sum to ${quotaSum}. Please update seat inventory quotas to match the new capacity.`);
        }

        await inventory.save();
    }
    return newTotal;
};

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
        const result = await Section.find({ schoolId: req.user.schoolId, status: 'ACTIVE' }).sort({ name: 1 });
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

// ========================
// UPDATE ENDPOINTS
// ========================

const updateAcademicYear = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;
        const result = await MasterDataService.updateAcademicYear(schoolId, id, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateGrade = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;
        const { name, level, admissionOpen } = req.body;

        const grade = await Grade.findOne({ _id: id, schoolId });
        if (!grade) throw new Error("Grade not found.");

        // If renaming, check for duplicate
        if (name && name !== grade.name) {
            const duplicate = await Grade.findOne({ schoolId, name, _id: { $ne: id } });
            if (duplicate) throw new Error(`Validation Error: Grade '${name}' already exists.`);
        }

        if (name !== undefined) grade.name = name;
        if (level !== undefined) grade.level = level;
        if (admissionOpen !== undefined) grade.admissionOpen = admissionOpen;

        await grade.save();
        res.status(200).json({ success: true, data: grade });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateRoom = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;
        const { roomNumber, capacity, building, roomType } = req.body;

        const room = await Room.findOne({ _id: id, schoolId });
        if (!room) throw new Error("Room not found.");

        // If reducing capacity, validate against ALL sections using this room
        if (capacity !== undefined && capacity < room.capacity) {
            const sectionsUsingRoom = await Section.find({ roomId: id, schoolId, status: 'ACTIVE' });
            for (const sec of sectionsUsingRoom) {
                if (sec.targetCapacity > capacity) {
                    throw new Error(`Capacity Error: Section '${sec.name}' has target capacity ${sec.targetCapacity} which exceeds the new room capacity ${capacity}. Update the section first.`);
                }

                // Check actual occupied seats — room can never go below real students
                const { occupied } = await getOccupiedSeats(schoolId, sec.academicYearId, sec.gradeId);
                if (capacity < occupied) {
                    throw new Error(`Operational Error: ${occupied} seats are currently occupied in grade linked to Section '${sec.name}'. Cannot reduce room capacity to ${capacity}.`);
                }
            }
        }

        // If renaming, check for duplicate room number
        if (roomNumber && roomNumber !== room.roomNumber) {
            const duplicate = await Room.findOne({ schoolId, roomNumber, _id: { $ne: id } });
            if (duplicate) throw new Error(`Validation Error: Room '${roomNumber}' already exists.`);
        }

        if (roomNumber !== undefined) room.roomNumber = roomNumber;
        if (capacity !== undefined) room.capacity = capacity;
        if (building !== undefined) room.building = building;
        if (roomType !== undefined) room.roomType = roomType;

        await room.save();
        res.status(200).json({ success: true, data: room });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateSection = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;
        const { name, targetCapacity, roomId, classTeacherId } = req.body;

        const section = await Section.findOne({ _id: id, schoolId, status: 'ACTIVE' });
        if (!section) throw new Error("Section not found or already archived.");

        // Determine the room to validate against
        const effectiveRoomId = roomId || section.roomId;

        // If changing room, validate new room exists
        if (roomId && roomId !== section.roomId?.toString()) {
            const newRoom = await Room.findOne({ _id: roomId, schoolId });
            if (!newRoom) throw new Error("Validation Error: Selected Room does not exist.");
            section.roomId = roomId;
        }

        // If changing capacity, validate against room AND inventory
        if (targetCapacity !== undefined && targetCapacity !== section.targetCapacity) {
            const room = await Room.findOne({ _id: effectiveRoomId, schoolId });
            if (room && targetCapacity > room.capacity) {
                throw new Error(`Infrastructure Error: Target capacity (${targetCapacity}) exceeds Room ${room.roomNumber} capacity (${room.capacity}).`);
            }

            section.targetCapacity = targetCapacity;
        }

        // If renaming, check for duplicate within same grade+year
        if (name && name !== section.name) {
            const duplicate = await Section.findOne({
                schoolId,
                academicYearId: section.academicYearId,
                gradeId: section.gradeId,
                name,
                status: 'ACTIVE',
                _id: { $ne: id }
            });
            if (duplicate) throw new Error(`Validation Error: Section '${name}' already exists for this Grade and Academic Year.`);
            section.name = name;
        }

        if (classTeacherId !== undefined) section.classTeacherId = classTeacherId || null;

        await section.save();

        // Recalculate inventory again after save (in case capacity changed)
        if (targetCapacity !== undefined) {
            await recalculateInventoryTotal(schoolId, section.academicYearId, section.gradeId);
        }

        res.status(200).json({ success: true, data: section });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateSeatInventory = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;
        const { allowSpillover, quotas } = req.body;

        const inventory = await SeatInventory.findOne({ _id: id, schoolId });
        if (!inventory) throw new Error("Seat Inventory not found.");

        if (quotas) {
            // WHITELIST VALIDATION: reject unknown categories
            for (const category of Object.keys(quotas)) {
                if (!VALID_QUOTA_CATEGORIES.includes(category)) {
                    throw new Error(`Validation Error: Unknown quota category '${category}'. Allowed: ${VALID_QUOTA_CATEGORIES.join(', ')}.`);
                }
            }

            // Validate quota sum matches totalCapacity
            const sumOfQuotas = VALID_QUOTA_CATEGORIES.reduce((sum, cat) => {
                return sum + (quotas[cat]?.capacity || inventory.quotas?.[cat]?.capacity || 0);
            }, 0);

            if (sumOfQuotas !== inventory.totalCapacity) {
                throw new Error(`Quota Error: The sum of category quotas (${sumOfQuotas}) must match the total capacity (${inventory.totalCapacity}).`);
            }

            // Validate no quota is reduced below consumed+blocked
            for (const [category, newData] of Object.entries(quotas)) {
                const currentQuota = inventory.quotas?.[category];
                if (currentQuota) {
                    const inUse = (currentQuota.consumedSeats || 0) + (currentQuota.blockedSeats || 0);
                    if (newData.capacity < inUse) {
                        throw new Error(`Capacity Error: Cannot reduce ${category} quota to ${newData.capacity}. Currently ${inUse} seats are in use.`);
                    }
                }
                // Preserve consumed/blocked counts, only update capacity
                if (!inventory.quotas[category]) {
                    inventory.quotas[category] = { capacity: 0, consumedSeats: 0, blockedSeats: 0 };
                }
                inventory.quotas[category].capacity = newData.capacity;
            }
        }

        if (allowSpillover !== undefined) inventory.allowSpillover = allowSpillover;

        await inventory.save();
        res.status(200).json({ success: true, data: inventory });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ARCHIVE instead of DELETE
const archiveSection = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;

        const section = await Section.findOne({ _id: id, schoolId, status: 'ACTIVE' });
        if (!section) throw new Error("Section not found or already archived.");

        // Check if any seats are occupied in this grade's inventory
        const { inventory, occupied } = await getOccupiedSeats(schoolId, section.academicYearId, section.gradeId);

        if (occupied > 0) {
            // Calculate what total would be without this section
            const otherActiveSections = await Section.find({
                schoolId,
                academicYearId: section.academicYearId,
                gradeId: section.gradeId,
                status: 'ACTIVE',
                _id: { $ne: id }
            });
            const newTotal = otherActiveSections.reduce((sum, s) => sum + s.targetCapacity, 0);

            if (newTotal < occupied) {
                throw new Error(`Archive Blocked: ${occupied} seats are currently occupied but removing this section would leave only ${newTotal} capacity. Transfer or release seats first.`);
            }
        }

        // Archive the section
        section.status = 'ARCHIVED';
        await section.save();

        // Recalculate inventory totalCapacity from remaining ACTIVE sections
        if (inventory) {
            const remainingActive = await Section.find({
                schoolId,
                academicYearId: section.academicYearId,
                gradeId: section.gradeId,
                status: 'ACTIVE'
            });

            if (remainingActive.length === 0) {
                // No active sections left — set inventory to 0 (don't delete, preserve history)
                inventory.totalCapacity = 0;
            } else {
                inventory.totalCapacity = remainingActive.reduce((sum, s) => sum + s.targetCapacity, 0);
            }
            await inventory.save();
        }

        res.status(200).json({ success: true, message: "Section archived successfully.", data: section });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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
    getSeatMetrics,
    updateAcademicYear,
    updateGrade,
    updateRoom,
    updateSection,
    updateSeatInventory,
    archiveSection
};
const AcademicYear = require('../../models/academicYear.model');
const Grade = require('../../models/grade.model');
const mongoose = require('mongoose');

// --- ACADEMIC YEAR LOGIC ---

const validateNoDateOverlap = async (schoolId, startDate, endDate, excludeId = null, session = null) => {
    const query = {
        schoolId,
        $or: [
            // New range starts inside existing range
            { startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } }
        ]
    };
    if (excludeId) query._id = { $ne: excludeId };

    const overlap = await AcademicYear.findOne(query).session(session);
    if (overlap) {
        throw new Error(`Date Overlap Error: Dates conflict with existing Academic Year '${overlap.name}' (${overlap.startDate.toISOString().split('T')[0]} to ${overlap.endDate.toISOString().split('T')[0]}).`);
    }
};

const createAcademicYear = async (schoolId, payload) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Date validation
        const startDate = new Date(payload.startDate);
        const endDate = new Date(payload.endDate);
        if (endDate <= startDate) {
            throw new Error("Validation Error: End date must be after start date.");
        }

        // Overlap validation
        await validateNoDateOverlap(schoolId, payload.startDate, payload.endDate, null, session);

        // If setting this to active, deactivate all others atomically
        if (payload.isActive) {
            await AcademicYear.updateMany({ schoolId }, { isActive: false }, { session });
        }

        const result = await AcademicYear.create([{
            schoolId,
            ...payload
        }], { session });

        await session.commitTransaction();
        return result[0];
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getAcademicYears = async (schoolId) => {
    return await AcademicYear.find({ schoolId }).sort({ startDate: -1 });
};

const updateAcademicYear = async (schoolId, id, payload) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const year = await AcademicYear.findOne({ _id: id, schoolId }).session(session);
        if (!year) throw new Error("Academic Year not found.");

        // If renaming, check for duplicate
        if (payload.name && payload.name !== year.name) {
            const duplicate = await AcademicYear.findOne({ schoolId, name: payload.name, _id: { $ne: id } }).session(session);
            if (duplicate) throw new Error(`Validation Error: Academic Year '${payload.name}' already exists.`);
        }

        // Date validation
        const startDate = payload.startDate ? new Date(payload.startDate) : year.startDate;
        const endDate = payload.endDate ? new Date(payload.endDate) : year.endDate;
        if (endDate <= startDate) {
            throw new Error("Validation Error: End date must be after start date.");
        }

        // Overlap validation (exclude self)
        if (payload.startDate || payload.endDate) {
            await validateNoDateOverlap(schoolId, startDate, endDate, id, session);
        }

        // If activating this year, deactivate all others
        if (payload.isActive && !year.isActive) {
            await AcademicYear.updateMany({ schoolId, _id: { $ne: id } }, { isActive: false }, { session });
        }

        if (payload.name !== undefined) year.name = payload.name;
        if (payload.startDate !== undefined) year.startDate = payload.startDate;
        if (payload.endDate !== undefined) year.endDate = payload.endDate;
        if (payload.isActive !== undefined) year.isActive = payload.isActive;

        await year.save({ session });
        await session.commitTransaction();
        return year;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// --- GRADE (CLASS) LOGIC ---
const createGrade = async (schoolId, payload) => {
    return await Grade.create({
        schoolId,
        ...payload
    });
};

const getGrades = async (schoolId) => {
    return await Grade.find({ schoolId }).sort({ level: 1 });
};

module.exports = {
    createAcademicYear,
    getAcademicYears,
    createGrade,
    getGrades,
    updateAcademicYear
};
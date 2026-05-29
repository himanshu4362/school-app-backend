const AcademicYear = require('../../models/academicYear.model');
const Grade = require('../../models/grade.model');
const mongoose = require('mongoose');

// --- ACADEMIC YEAR LOGIC ---
const createAcademicYear = async (schoolId, payload) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // If setting this to active, deactivate all others atomically
        if (payload.isActive) {
            await AcademicYear.updateMany({ schoolId }, { isActive: false }, { session });
        }

        const result = await AcademicYear.create([{
            schoolId,
            ...payload
        }], { session });

        await session.commitTransaction();
        return result[0]; // .create() with session returns an array
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

// --- GRADE (CLASS) LOGIC ---
const createGrade = async (schoolId, payload) => {
    return await Grade.create({
        schoolId,
        ...payload
    });
};

const getGrades = async (schoolId) => {
    // Sort by level so Nursery appears before Class 10
    return await Grade.find({ schoolId }).sort({ level: 1 });
};

module.exports = {
    createAcademicYear,
    getAcademicYears,
    createGrade,
    getGrades
};
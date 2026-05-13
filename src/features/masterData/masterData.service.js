const AcademicYear = require('../../models/academicYear.model');
const Grade = require('../../models/grade.model');

// --- ACADEMIC YEAR LOGIC ---
const createAcademicYear = async (schoolId, payload) => {
    // If setting this to active, deactivate all others for this school
    if (payload.isActive) {
        await AcademicYear.updateMany({ schoolId }, { isActive: false });
    }
    
    return await AcademicYear.create({
        schoolId,
        ...payload
    });
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
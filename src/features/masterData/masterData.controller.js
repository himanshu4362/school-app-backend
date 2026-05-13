const MasterDataService = require('./masterData.service');

const addAcademicYear = async (req, res) => {
    try {
        const schoolId = req.user.schoolId; // Extracted from your Auth JWT
        const result = await MasterDataService.createAcademicYear(schoolId, req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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

module.exports = {
    addAcademicYear,
    fetchAcademicYears,
    addGrade,
    fetchGrades
};
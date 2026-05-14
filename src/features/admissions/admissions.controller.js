const AdmissionsUseCase = require('./admissions.use-case');

const createApplication = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.submitApplication(req.user.schoolId, req.body, req.user.id);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const triggerEnrollment = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.enrollStudent(req.user.schoolId, req.params.id, req.user.id);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateApplicationStatus = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.updateStatus(
            req.user.schoolId, 
            req.params.id, 
            req.body.status, 
            req.body.remarks, 
            req.user.id
        );
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    createApplication,
    triggerEnrollment,
    updateApplicationStatus,
};
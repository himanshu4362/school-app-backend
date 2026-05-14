const AdmissionsService = require('./admissions.service');
const Application = require('../../models/application.model');

const createApplication = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const userId = req.user.id;
        
        const result = await AdmissionsService.submitApplication(schoolId, req.body, userId);
        
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const triggerEnrollment = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const userId = req.user.id;
        const applicationId = req.params.id;

        const result = await AdmissionsService.enrollStudent(schoolId, applicationId, userId);
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateApplicationStatus = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const applicationId = req.params.id;
        const { status, remarks } = req.body;

        const application = await Application.findOne({ _id: applicationId, schoolId });
        if (!application) throw new Error("Application not found");

        const oldStatus = application.status;
        application.status = status;
        
        // Add to audit log
        if (!application.decisionLog) application.decisionLog = [];
        application.decisionLog.push({
            previousStatus: oldStatus,
            newStatus: status,
            changedBy: req.user.id,
            remarks: remarks || `Status manually updated to ${status}`
        });

        if (status === 'APPROVED') application.lifecycle.approvedAt = new Date();

        await application.save();
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    createApplication,
    updateApplicationStatus,
    triggerEnrollment
};
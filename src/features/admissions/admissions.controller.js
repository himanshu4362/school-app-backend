const AdmissionsService = require('./admissions.service');

const addLead = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await AdmissionsService.createLead(schoolId, req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchLeads = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await AdmissionsService.getLeads(schoolId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const modifyLead = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const leadId = req.params.id;
        const result = await AdmissionsService.updateLead(schoolId, leadId, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ... (keep existing lead controllers) ...

const requestUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName || !fileType) throw new Error("fileName and fileType are required");

        const result = await AdmissionsService.getS3UploadUrl(fileName, fileType);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const submitFinalApplication = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await AdmissionsService.submitApplication(schoolId, req.body);
        res.status(201).json({ success: true, data: result, message: "Application submitted successfully" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const fetchApplications = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const result = await AdmissionsService.getApplications(schoolId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    addLead,
    fetchLeads,
    modifyLead,
    requestUploadUrl,
    submitFinalApplication,
    fetchApplications
};
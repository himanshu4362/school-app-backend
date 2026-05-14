const AdmissionsUseCase = require('./admissions.use-case');
const { generatePresignedUrl } = require('../../utils/s3Service');

const getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) {
            throw new Error("fileName and fileType are required query parameters.");
        }

        // Generate URL strictly for this user's school
        const result = await generatePresignedUrl(req.user.schoolId, fileName, fileType);
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

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
    getUploadUrl
};
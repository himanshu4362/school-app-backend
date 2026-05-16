const AdmissionsUseCase = require('./admissions.use-case');
const Application = require('../../models/application.model');
const Lead = require('../../models/lead.model');
const { generatePresignedUrl, getPresignedDownloadUrl } = require('../../utils/s3Service');
const getApplicationById = async (req, res) => {
    try {
        const app = await Application.findById(req.params.id)
            .populate('appliedGradeId', 'name')
            .populate('preferredSectionId', 'name')
            .populate('guardians.guardianId'); 
            
        if (!app) throw new Error("Application not found.");
        
        res.status(200).json({ success: true, data: app });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const getDocumentUrl = async (req, res) => {
    try {
        const { fileKey } = req.query;
        if (!fileKey) throw new Error("fileKey is required.");
        
        // Security check
        if (!fileKey.startsWith(`schools/${req.user.schoolId}/`)) {
            throw new Error("Unauthorized access to this document.");
        }

        const url = await getPresignedDownloadUrl(fileKey);
        
        res.status(200).json({ success: true, data: { url } });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType, studentName, applicationId } = req.query;
        if (!fileName || !fileType) throw new Error("fileName and fileType are required query parameters.");
        
        const result = await generatePresignedUrl(req.user.schoolId, fileName, fileType, studentName, applicationId);
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

const fetchApplications = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.fetchApplications(req.user.schoolId, req.query);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateApplicationStatus = async (req, res) => {
    try {
        const { status, remarks } = req.body;
        if (!status) throw new Error("Status is required.");
        const result = await AdmissionsUseCase.updateStatus(req.user.schoolId, req.params.id, status, remarks, req.user.id, req.user.role);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const verifyDocument = async (req, res) => {
    try {
        const { status, remarks, fileKey } = req.body; 
        if (!status) throw new Error("Status is required for document verification.");
        
        const result = await AdmissionsUseCase.verifyDocument(
            req.user.schoolId, 
            req.params.id, 
            req.params.documentId, 
            status, 
            remarks, 
            fileKey, // Pass fileKey to use-case
            req.user.id, 
            req.user.role
        );
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const triggerEnrollment = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.enrollStudent(req.user.schoolId, req.params.id, req.user.id, req.user.role);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const captureLead = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.captureLead(req.user.schoolId, req.body, req.user.id);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getLeadMetadata = async (req, res) => {
    try {
        const statuses = Lead.schema.path('status').enumValues;
        const sources = Lead.schema.path('source').enumValues;
        const formatLabel = (str) => str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        res.status(200).json({
            success: true,
            data: {
                statuses: statuses.map(s => ({ value: s, label: formatLabel(s) })),
                sources: sources.map(s => ({ value: s, label: formatLabel(s) }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const fetchLeads = async (req, res) => {
    try {
        const result = await AdmissionsUseCase.fetchLeads(req.user.schoolId, req.query);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateLeadStatus = async (req, res) => {
    try {
        const { status, remarks } = req.body;
        if (!status) throw new Error("Status is required.");
        const result = await AdmissionsUseCase.updateLeadStatus(req.user.schoolId, req.params.id, status, remarks, req.user.id);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getApplicationMetadata = async (req, res) => {
    try {
        const Application = require('../../models/application.model');
        
        const formatLabel = (str) => {
            if (!str) return '';
            return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        };

        const getEnum = (path) => {
            const schemaPath = Application.schema.path(path);
            return schemaPath && schemaPath.enumValues 
                ? schemaPath.enumValues.map(v => ({ value: v, label: formatLabel(v) })) 
                : [];
        };
        
        const getArrayEnum = (arrayPath, fieldPath) => {
            const arraySchema = Application.schema.path(arrayPath);
            if (arraySchema && arraySchema.schema) {
                const field = arraySchema.schema.path(fieldPath);
                return field && field.enumValues 
                    ? field.enumValues.map(v => ({ value: v, label: formatLabel(v) })) 
                    : [];
            }
            return [];
        };

        const dynamicMetadata = {
            admissionTypes: getEnum('admissionType'),
            sources: getEnum('admissionSource'),
            genders: getEnum('studentProfile.gender'),
            categories: getEnum('studentProfile.category'),
            relations: getArrayEnum('guardians', 'relation'),
            documentTypes: getArrayEnum('documents', 'documentType'),
            statuses: getEnum('status')
        };

        res.status(200).json({
            success: true,
            data: dynamicMetadata
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getUploadUrl,
    createApplication,
    fetchApplications,
    updateApplicationStatus,
    triggerEnrollment,
    captureLead,
    verifyDocument,
    getLeadMetadata,
    fetchLeads,
    updateLeadStatus,
    getApplicationById,
    getDocumentUrl,
    getApplicationMetadata
};
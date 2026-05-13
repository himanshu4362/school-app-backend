const Lead = require('../../models/lead.model');
const Application = require('../../models/application.model');
const { generatePresignedUrl } = require('../../utils/s3Service');

// Create a new lead
const createLead = async (schoolId, payload) => {
    return await Lead.create({
        schoolId,
        ...payload
    });
};

// Fetch all leads for the Kanban board
const getLeads = async (schoolId) => {
    // Sort by newest first
    return await Lead.find({ schoolId }).sort({ createdAt: -1 });
};

// Update a lead (Move across the Kanban board or edit details)
const updateLead = async (schoolId, leadId, payload) => {
    const updatedLead = await Lead.findOneAndUpdate(
        { _id: leadId, schoolId }, // MUST verify schoolId for security
        { $set: payload },
        { new: true, runValidators: true }
    );

    if (!updatedLead) throw new Error("Lead not found or unauthorized");
    return updatedLead;
};

const getS3UploadUrl = async (fileName, fileType) => {
    return await generatePresignedUrl(fileName, fileType);
};

const submitApplication = async (schoolId, payload) => {
    // Generate a unique Application Number
    const count = await Application.countDocuments({ schoolId });
    const applicationNumber = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const newApplication = await Application.create({
        schoolId,
        applicationNumber,
        admissionType: payload.admissionType,
        selectedClassId: payload.selectedClassId,
        studentProfile: payload.studentProfile,
        guardians: payload.guardians,
        address: {
            current: payload.currentAddress,
            permanent: payload.permanentAddress
        },
        academicHistory: payload.academicHistory,
        documents: payload.documents,
        status: 'submitted'
    });

    return newApplication;
};

// Fetch all applications for the admin table
const getApplications = async (schoolId) => {
    return await Application.find({ schoolId })
        .populate('selectedClassId', 'name') // Populate the Grade name
        .sort({ createdAt: -1 });
};

module.exports = {
    createLead,
    getLeads,
    updateLead,
    getS3UploadUrl,
    submitApplication,
    getApplications
};
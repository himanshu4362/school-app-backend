const mongoose = require('mongoose');
const Application = require('../../models/application.model');
const Lead = require('../../models/lead.model');

// --- REPOSITORIES (Data Access) ---
const ApplicationRepo = require('../../repositories/application.repository');
const GuardianRepo = require('../../repositories/guardian.repository');
const StudentRepo = require('../../repositories/student.repository');

// --- DOMAIN ENGINES (Business Rules) ---
const IdentityEngine = require('../../domain/identity.engine');
const WorkflowEngine = require('../../domain/workflow.engine');
const SeatEngine = require('../../domain/seat.engine');
const AuditEngine = require('../../domain/audit.engine');
const DocumentEngine = require('../../domain/document.engine');

class AdmissionsUseCase {

    static async captureLead(schoolId, leadData, userId) {
        // Initial activity log
        const initialActivity = {
            action: 'LEAD_CREATED',
            notes: `Lead captured via ${leadData.source || 'walk_in'}`,
            performedBy: userId
        };

        const lead = new Lead({
            ...leadData,
            schoolId,
            activities: [initialActivity]
        });

        await lead.save();
        return lead;
    }

    static async fetchLeads(schoolId, queryParams) {
        const { status, search, assignedTo, page = 1, limit = 20 } = queryParams;

        // Base security query
        const query = { schoolId };

        if (status) query.status = status;
        if (assignedTo) query.assignedTo = assignedTo;
        if (search) {
            query.$or = [
                { parentName: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [leads, total] = await Promise.all([
            Lead.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('interestedClassId', 'name') // Pull grade name
                .populate('assignedTo', 'firstName lastName'), // Pull owner name
            Lead.countDocuments(query)
        ]);

        return {
            leads,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async updateLeadStatus(schoolId, leadId, newStatus, remarks, userId) {
        const lead = await Lead.findOne({ _id: leadId, schoolId });
        if (!lead) throw new Error("Lead not found.");

        const allowedNextStates = VALID_TRANSITIONS[lead.status];
        if (!allowedNextStates.includes(newStatus)) {
            throw new Error(`Invalid CRM Workflow: Cannot move lead from '${lead.status}' to '${newStatus}'.`);
        }

        lead.status = newStatus;

        // Log the transition in the timeline
        lead.activities.push({
            action: 'STATUS_UPDATED',
            notes: `Moved to ${newStatus}. ${remarks ? 'Remarks: ' + remarks : ''}`,
            performedBy: userId
        });

        await lead.save();
        return lead;
    }

    static async fetchApplications(schoolId, queryParams) {
        const { status, search, gradeId, page = 1, limit = 20 } = queryParams;
        const query = { schoolId };

        if (status && status !== 'ALL') query.status = status;
        if (gradeId && gradeId !== 'ALL') query.appliedGradeId = gradeId;

        // Note: Searching nested objects requires specific syntax
        if (search) {
            query.$or = [
                { applicationNumber: { $regex: search, $options: 'i' } },
                { 'studentProfile.firstName': { $regex: search, $options: 'i' } },
                { 'studentProfile.lastName': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [applications, total] = await Promise.all([
            Application.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('appliedGradeId', 'name')
                .populate('preferredSectionId', 'name'),
            Application.countDocuments(query)
        ]);

        return {
            applications,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async submitApplication(schoolId, payload, actorId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        let finalStatus = 'SUBMITTED';

        try {
            if (payload.studentProfile && payload.studentProfile.nationalIdEncrypted) {
                // Ensure you have added `findOne` to your ApplicationRepo!
                const existingApp = await ApplicationRepo.findOne(schoolId, {
                    academicYearId: payload.academicYearId,
                    'studentProfile.nationalIdEncrypted': payload.studentProfile.nationalIdEncrypted
                }, session);

                if (existingApp) {
                    throw new Error(`Duplicate Error: An application with this Government ID already exists in this academic year (App No: ${existingApp.applicationNumber}).`);
                }
            } else if (payload.admissionType === 'fresh') {
                // Optional: Force them to provide it if it's a hard requirement
                throw new Error("Validation Error: A unique Government Document ID is required for admission.");
            }

            const year = new Date().getFullYear().toString();
            const applicationNumber = await IdentityEngine.generateSequence(schoolId, 'APP', year, session);

            const normalizedGuardians = [];

            for (const gData of payload.guardians) {
                // Find existing parent by mobile number
                let guardian = await GuardianRepo.findByMobile(schoolId, gData.mobile, session);

                // Create if they don't exist
                if (!guardian) {
                    guardian = await GuardianRepo.create({ schoolId, ...gData }, session);
                }

                // Push the linked ObjectId back into the application payload
                normalizedGuardians.push({
                    guardianId: guardian._id,
                    relation: gData.relation,
                    isPrimaryContact: gData.isPrimaryContact || false
                });
            }

            //  NEW: File Ownership Security Check
            if (payload.documents && payload.documents.length > 0) {
                for (const doc of payload.documents) {
                    // Prevent path traversal and enforce tenant isolation
                    // A valid fileKey from our S3 service MUST start with the schoolId
                    // Change this line:
                    if (!doc.fileKey.startsWith(`schools/${schoolId}/`)) {
                        throw new Error(`Security Violation: File ${doc.fileKey} does not belong to this tenant.`);
                    }
                }
            }

            //  NEW: Execute Document Requirement Engine
            if (payload.admissionType === 'transfer' || payload.admissionType === 'fresh') {
                DocumentEngine.validateSubmission(
                    payload.admissionType,
                    payload.studentProfile?.category || 'GENERAL',
                    payload.documents || []
                );
            }

            let finalStatus = 'SUBMITTED';

            if (payload.admissionType === 'transfer' || payload.admissionType === 'fresh') {
                const docValidation = DocumentEngine.validateSubmission(
                    payload.admissionType,
                    payload.studentProfile?.category || 'GENERAL',
                    payload.documents || []
                );

                // If documents are missing, we don't crash. We put it in PENDING state!
                if (!docValidation.isValid) {
                    finalStatus = 'DOCUMENT_PENDING';
                }
            }

            const newApplication = await ApplicationRepo.create({
                schoolId,
                applicationNumber,
                createdBy: actorId,
                ...payload,
                guardians: normalizedGuardians,
                status: finalStatus, // <--- Uses SUBMITTED or DOCUMENT_PENDING
            }, session);

            await AuditEngine.log(schoolId, 'APPLICATION', newApplication._id, 'CREATED', actorId, { applicationNumber }, session);

            await session.commitTransaction();
            return newApplication;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async updateStatus(schoolId, applicationId, targetStatus, remarks, actorId, actorRole) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId, session);
            if (app.status === 'ENROLLED') {
                throw new Error('Application already enrolled.');
            }
            if (app.status !== 'APPROVED') {
                throw new Error('Application must be APPROVED before enrollment.');
            }
            if (!app) throw new Error("Application not found.");

            if (typeof WorkflowEngine !== 'undefined' && WorkflowEngine.validateTransition) {
                if (app.status !== 'DOCUMENT_PENDING') {
                    WorkflowEngine.validateTransition('APPLICATION', app.status, targetStatus, actorRole);
                }
            }

            const oldStatus = app.status;
            app.status = targetStatus;

            if (!app.lifecycle) app.lifecycle = {};
            if (targetStatus === 'APPROVED') app.lifecycle.approvedAt = new Date();

            //  FIXED: SEAT ENGINE INTEGRATION (Using app instead of payload, and passing gradeId directly)
            const studentCategory = app.studentProfile?.category || 'GENERAL';

            if (targetStatus === 'APPROVED' && oldStatus !== 'APPROVED') {
                // We pass appliedGradeId because seats are managed per Grade during admission
                await SeatEngine.blockSeat(schoolId, app.academicYearId, app.appliedGradeId, studentCategory, session);
            }
            else if (['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(targetStatus) && oldStatus === 'APPROVED') {
                await SeatEngine.releaseSeat(
                    schoolId,
                    app.academicYearId,
                    app.appliedGradeId,
                    studentCategory,
                    'BLOCKED',
                    session
                );
            }

            await app.save({ session });

            if (typeof AuditEngine !== 'undefined' && AuditEngine.log) {
                await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'STATUS_CHANGED', actorId, {
                    oldStatus,
                    newStatus: targetStatus,
                    remarks: remarks || `Status transitioned to ${targetStatus}`
                }, session);
            }

            await session.commitTransaction();
            return app;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Saves a partial draft. Bypasses strict validation.
    static async saveDraft(schoolId, applicationId, payload, actorId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let app;
            if (applicationId) {
                app = await ApplicationRepo.findById(schoolId, applicationId, session);
                if (!app || app.status !== 'DRAFT') throw new Error("Only drafts can be updated this way.");

                // Update fields
                Object.assign(app, payload);
            } else {
                // Generate a temporary draft number
                const draftNumber = `DRAFT-${Date.now()}`;
                app = await ApplicationRepo.create({
                    schoolId,
                    applicationNumber: draftNumber,
                    createdBy: actorId,
                    status: 'DRAFT',
                    ...payload
                }, session);
            }
            let completionScore = 0;
            const totalWeights = 100;

            if (payload.studentProfile?.firstName && payload.studentProfile?.dob) completionScore += 25;
            if (payload.guardians && payload.guardians.length > 0) completionScore += 25;
            if (payload.address && payload.address.current?.pincode) completionScore += 20;
            if (payload.academicHistory?.schoolName) completionScore += 10;
            if (payload.documents && payload.documents.length > 0) completionScore += 20;

            // Calculate completion percentage
            // (Mock logic: count filled keys vs expected keys)
            app.lifecycle.completionPercentage = Math.min(completionScore, totalWeights);
            app.lifecycle.lastSavedAt = new Date();

            await app.save({ session });
            await session.commitTransaction();
            return app;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async enrollStudent(schoolId, applicationId, actorId, actorRole) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId, session);
            if (!app) throw new Error("Application not found.");

            if (app.status === 'ENROLLED') {
                throw new Error("Application is already enrolled. Duplicate enrollment prevented.");
            }
            if (app.status !== 'APPROVED') {
                throw new Error("Application must be APPROVED before final enrollment.");
            }

            if (typeof WorkflowEngine !== 'undefined' && WorkflowEngine.validateTransition) {
                WorkflowEngine.validateTransition('APPLICATION', app.status, 'ENROLLED', actorRole);
            }
            
            const studentCategory = app.studentProfile?.category || 'GENERAL';

            await SeatEngine.releaseSeat(
                schoolId,
                app.academicYearId,
                app.appliedGradeId,
                studentCategory,
                'BLOCKED',
                session
            );

            const seatResult = await SeatEngine.consumeSeat(
                schoolId,
                app.academicYearId,
                app.appliedGradeId,
                studentCategory,
                session
            );

            const year = new Date().getFullYear().toString();
            let enrollmentNumber;
            if (typeof IdentityEngine !== 'undefined' && IdentityEngine.generateSequence) {
                enrollmentNumber = await IdentityEngine.generateSequence(schoolId, 'STU', year, session);
            } else {
                enrollmentNumber = `STU-${year}-${Date.now().toString().slice(-6)}`; 
            }

            const newStudentArray = await StudentRepo.create([{
                schoolId,
                admissionApplicationId: app._id,
                enrollmentNumber,
                academicYearId: app.academicYearId,
                gradeId: app.appliedGradeId,
                profile: app.studentProfile,
                guardianLinks: app.guardians, 
                status: 'ACTIVE' 
            }], { session });

            const newStudent = newStudentArray[0];

            const guardianIds = app.guardians.map(g => g.guardianId);
            if (guardianIds.length > 0) {
                await mongoose.model('Guardian').updateMany(
                    { _id: { $in: guardianIds }, schoolId },
                    { $addToSet: { linkedStudentIds: newStudent._id } },
                    { session }
                );
            }

            const oldStatus = app.status;
            app.status = 'ENROLLED';
            app.enrolledStudentId = newStudent._id;
            
            if (!app.lifecycle) app.lifecycle = {};
            app.lifecycle.enrolledAt = new Date();
            
            await app.save({ session });

            if (typeof AuditEngine !== 'undefined' && AuditEngine.log) {
                await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'ENROLLED', actorId, {
                    studentId: newStudent._id,
                    enrollmentNumber: newStudent.enrollmentNumber,
                    consumedCategory: seatResult?.consumedCategory || studentCategory,
                    oldStatus,
                    newStatus: 'ENROLLED'
                }, session);
            }

            await session.commitTransaction();

            return { 
                applicationNumber: app.applicationNumber, 
                enrollmentNumber: newStudent.enrollmentNumber 
            };

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            // Cleanup session
            session.endSession();
        }
    }

    static async verifyDocument(schoolId, applicationId, documentId, targetStatus, remarks, fileKey, actorId, actorRole) {
        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId);
            if (!app) throw new Error("Application not found.");

            const document = app.documents.id(documentId);
            if (!document) throw new Error("Document not found in this application.");

            const oldStatus = document.status;
            document.status = targetStatus;
            document.verifiedBy = actorId;
            document.verifiedAt = new Date();

            //  VERSIONING LOGIC: Agar naya fileKey aaya hai aur purane wale se alag hai
            if (fileKey && document.fileKey !== fileKey) {
                // Agar pehle se koi fileKey tha, usko versions array me push kardo
                if (document.fileKey) {
                    document.versions.push({
                        fileKey: document.fileKey,
                        uploadedAt: document.uploadedAt || new Date(),
                        uploadedBy: document.uploadedBy || actorId
                    });
                }
                // Naya fileKey set kardo
                document.fileKey = fileKey;
                document.uploadedAt = new Date();
                document.uploadedBy = actorId;
            }

            if (targetStatus === 'REJECTED') {
                document.rejectionReason = remarks;
                app.status = 'DOCUMENT_PENDING';
            } else {
                document.verificationRemarks = remarks;
            }

            await app.save(); // Direct save, no transactions

            return document;
        } catch (error) {
            throw error;
        }
    }

    // 🟢 NEW: Update Application Details before Enrollment
    static async updateApplicationData(schoolId, applicationId, payload, actorId) {
        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId);
            if (!app) throw new Error("Application not found.");

            // 1. Lock Protection: Approved ya Enrolled hone ke baad direct edit allowed nahi hai
            if (['APPROVED', 'ENROLLED', 'WITHDRAWN', 'ARCHIVED'].includes(app.status)) {
                throw new Error(`Validation Error: Cannot edit application data when status is ${app.status}. Demote to UNDER_REVIEW first.`);
            }

            // 2. Safe Update (Documents yahan se update nahi honge, unka apna flow hai)
            if (payload.studentProfile) {
                // Merge new profile data with existing
                app.studentProfile = { ...app.studentProfile.toObject(), ...payload.studentProfile };
            }
            if (payload.guardians) {
                app.guardians = payload.guardians;
            }
            if (payload.academicHistory) {
                app.academicHistory = payload.academicHistory;
            }
            if (payload.appliedGradeId) {
                app.appliedGradeId = payload.appliedGradeId;
            }
            if (payload.admissionSource) {
                app.admissionSource = payload.admissionSource;
            }

            await app.save();

            // 3. Log the update action
            if (typeof AuditEngine !== 'undefined' && AuditEngine.log) {
                await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'APPLICATION_UPDATED', actorId, {
                    remarks: 'Admin manually updated application details.'
                });
            }

            return app;
        } catch (error) {
            throw error;
        }
    }
}

// STATUS FLOW VALIDATION MACHINE
const VALID_TRANSITIONS = {
    new: ['contacted', 'closed'],
    contacted: ['follow_up', 'converted', 'closed'],
    follow_up: ['converted', 'closed', 'contacted'],
    converted: [],
    closed: ['new', 'contacted']
};

module.exports = AdmissionsUseCase;
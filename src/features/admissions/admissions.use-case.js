const mongoose = require('mongoose');
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

    static async fetchLeads (schoolId, queryParams) {
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

            // 🟢 NEW: File Ownership Security Check
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

            // 🟢 NEW: Execute Document Requirement Engine
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
            if (!app) throw new Error("Application not found.");

            WorkflowEngine.validateTransition('APPLICATION', app.status, targetStatus, actorRole);

            const oldStatus = app.status;

            // 2. Update Application State
            app.status = targetStatus;
            if (targetStatus === 'APPROVED') app.lifecycle.approvedAt = new Date();

            // (Note: Using app.save() here is fine, or you can add a method to the ApplicationRepo later)
            await app.save({ session });

            // 3. Immutably log the status change
            await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'STATUS_CHANGED', actorId, {
                oldStatus,
                newStatus: targetStatus,
                remarks: remarks || `Status transitioned to ${targetStatus}`
            }, session);

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

            // 1. Workflow & Authority Check
            WorkflowEngine.validateTransition('APPLICATION', app.status, 'ENROLLED', actorRole);

            // 2. Consume Seat (Moves from Blocked -> Consumed)
            const seatResult = await SeatEngine.consumeSeat(schoolId, app.preferredSectionId, app.studentProfile.category, session);

            // 3. Identity Engine: Generate STU ID and Roll Number
            const year = new Date().getFullYear().toString();
            const enrollmentNumber = await IdentityEngine.generateSequence(schoolId, 'STU', year, session);
            // 🟢 NEW: Scoped strictly by Year AND Section
            const rollNumberSequence = await IdentityEngine.generateSequence(
                schoolId,
                `ROLL_${app.academicYearId}_${app.preferredSectionId}`,
                year,
                session
            ); const rollNumber = rollNumberSequence.split('-').pop(); // e.g., gets '0012' from the string

            // 4. Create Living Student
            const newStudent = await StudentRepo.create({
                schoolId,
                admissionApplicationId: app._id,
                enrollmentNumber,
                rollNumber: parseInt(rollNumber, 10),
                academicYearId: app.academicYearId,
                gradeId: app.appliedGradeId,
                sectionId: app.preferredSectionId,
                profile: app.studentProfile,
                guardianLinks: app.guardians // Inherit normalized guardians
            }, session);

            // 5. Freeze Application
            await ApplicationRepo.markEnrolled(schoolId, app._id, newStudent._id, session);

            // 6. Immutably Audit the Transformation
            await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'ENROLLED', actorId, {
                studentId: newStudent._id,
                rollNumber: newStudent.rollNumber,
                consumedCategory: seatResult.consumedCategory
            }, session);

            await session.commitTransaction();

            return { applicationNumber: app.applicationNumber, enrollmentNumber, rollNumber: newStudent.rollNumber };

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Executes the Document Verification Workflow (Admin Only)
     */
    static async verifyDocument(schoolId, applicationId, documentId, targetStatus, remarks, actorId, actorRole) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId, session);
            if (!app) throw new Error("Application not found.");

            // 1. Locate the specific document
            const document = app.documents.id(documentId);
            if (!document) throw new Error("Document not found in this application.");

            // 2. Validate Authority (Only Admission Officers/Principals can verify)
            if (!['ADMISSION_OFFICER', 'PRINCIPAL', 'ADMIN'].includes(actorRole)) {
                throw new Error("Authority Error: You do not have permission to verify documents.");
            }

            // 3. Update Document State & Versioning Data
            const oldStatus = document.status;
            document.status = targetStatus; // e.g., 'VERIFIED' or 'REJECTED'
            document.verifiedBy = actorId;
            document.verifiedAt = new Date();
            if (targetStatus === 'REJECTED') {
                document.rejectionReason = remarks;
                app.status = 'DOCUMENT_PENDING'; // Kick the whole app back to pending
            } else {
                document.verificationRemarks = remarks;
            }

            await app.save({ session });

            // 4. Audit Engine: True Snapshot Logging
            await AuditEngine.log(schoolId, 'DOCUMENT', documentId, `DOCUMENT_${targetStatus}`, actorId, {
                applicationId: app._id,
                documentType: document.documentType,
                before: { status: oldStatus },
                after: { status: targetStatus, remarks }
            }, session);

            await session.commitTransaction();
            return document;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

// STATUS FLOW VALIDATION MACHINE (Rule #4)
const VALID_TRANSITIONS = {
    new: ['contacted', 'closed'],
    contacted: ['follow_up', 'converted', 'closed'],
    follow_up: ['converted', 'closed', 'contacted'], // Allowing slip back to contacted if parent goes cold
    converted: [], // Terminal state
    closed: ['new', 'contacted'] // Re-opening a dead lead
};

module.exports = AdmissionsUseCase;
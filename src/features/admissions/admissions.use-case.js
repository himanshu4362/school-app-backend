const mongoose = require('mongoose');

// --- REPOSITORIES (Data Access) ---
const ApplicationRepo = require('../../repositories/application.repository');
const GuardianRepo = require('../../repositories/guardian.repository');
const StudentRepo = require('../../repositories/student.repository');

// --- DOMAIN ENGINES (Business Rules) ---
const IdentityEngine = require('../../domain/identity.engine');
const WorkflowEngine = require('../../domain/workflow.engine');
const SeatEngine = require('../../domain/seat.engine');
const AuditEngine = require('../../domain/audit.engine');

class AdmissionsUseCase {

    static async submitApplication(schoolId, payload, actorId) {
        const session = await mongoose.startSession();
        session.startTransaction();

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

            const newApplication = await ApplicationRepo.create({
                schoolId,
                applicationNumber,
                createdBy: actorId,
                ...payload,
                guardians: normalizedGuardians,
                status: 'SUBMITTED',
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

    static async enrollStudent(schoolId, applicationId, actorId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Fetch
            const app = await ApplicationRepo.findById(schoolId, applicationId, session);
            if (!app) throw new Error("Application not found.");

            // 2. Enforce Workflow Law
            WorkflowEngine.validateTransition('APPLICATION', app.status, 'ENROLLED');

            // 3. Consume Seat Quota
            const seatResult = await SeatEngine.consumeSeat(schoolId, app.preferredSectionId, app.studentProfile.category, session);

            // 4. Generate Student ID
            const year = new Date().getFullYear().toString();
            const enrollmentNumber = await IdentityEngine.generateSequence(schoolId, 'STU', year, session);

            // 5. Create Student
            const newStudent = await StudentRepo.create({
                schoolId,
                admissionApplicationId: app._id,
                enrollmentNumber,
                academicYearId: app.academicYearId,
                gradeId: app.appliedGradeId,
                sectionId: app.preferredSectionId,
                profile: app.studentProfile
            }, session);

            // 6. Freeze Application
            await ApplicationRepo.markEnrolled(app._id, newStudent._id, session);

            // 7. Audit Logging
            await AuditEngine.log(schoolId, 'APPLICATION', app._id, 'ENROLLED', actorId, {
                studentId: newStudent._id,
                consumedCategory: seatResult.consumedCategory
            }, session);

            await session.commitTransaction();
            return { applicationNumber: app.applicationNumber, enrollmentNumber };

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async updateStatus(schoolId, applicationId, targetStatus, remarks, actorId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const app = await ApplicationRepo.findById(schoolId, applicationId, session);
            if (!app) throw new Error("Application not found.");

            // 1. Enforce Legal State Transition (e.g. SUBMITTED -> APPROVED)
            WorkflowEngine.validateTransition('APPLICATION', app.status, targetStatus);

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
}

module.exports = AdmissionsUseCase;
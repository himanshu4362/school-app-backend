const mongoose = require('mongoose');
const Application = require('../../models/application.model');
const Grade = require('../../models/grade.model');
const Section = require('../../models/section.model');
const SeatInventory = require('../../models/seatInventory.model');
const Student = require('../../models/student.model');

// Helper to calculate age in years
const calculateAge = (dob) => {
    const ageDifMs = Date.now() - new Date(dob).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Helper to check if a document exists and is valid
const hasDocument = (documents, type) => {
    if (!documents) return false;
    return documents.some(doc => doc.documentType === type && ['SUBMITTED', 'VERIFIED'].includes(doc.status));
};

// --- VALIDATION ENGINE ---
const validateApplicationRules = async (payload) => {
    // 1. Grade Integrity
    const grade = await Grade.findById(payload.appliedGradeId);
    if (!grade) throw new Error("Validation Error: Invalid Grade Selected.");

    // 2. Section Integrity (If section is chosen, it must belong to the chosen Grade)
    if (payload.preferredSectionId) {
        const section = await Section.findById(payload.preferredSectionId);
        if (!section || section.gradeId.toString() !== grade._id.toString()) {
            throw new Error("Validation Error: Section does not belong to the selected Grade.");
        }
    }

    // 3. Age Boundary Validation (Assuming Grade has minAge/maxAge fields added later)
    if (grade.minAge && grade.maxAge) {
        const ageInYears = calculateAge(payload.studentProfile.dob);
        if (ageInYears < grade.minAge || ageInYears > grade.maxAge) {
            throw new Error(`Eligibility Error: Student age (${ageInYears}) does not meet requirements for ${grade.name}.`);
        }
    }

    // 4. Stream Integrity
    if (grade.level < 11 && payload.streamPreference && payload.streamPreference !== 'none') {
        throw new Error("Validation Error: Streams (Science/Commerce/Arts) are only applicable for Class 11 and above.");
    }

    // 5. Document Matrix Validation
    if (payload.admissionType === 'transfer' && !hasDocument(payload.documents, 'TRANSFER_CERTIFICATE')) {
        throw new Error("Document Error: Transfer Certificate is mandatory for Transfer admissions.");
    }
    if (payload.studentProfile.category !== 'GENERAL' && !hasDocument(payload.documents, 'CASTE_CERTIFICATE')) {
         throw new Error(`Document Error: Caste Certificate is mandatory for ${payload.studentProfile.category} category admissions.`);
    }
};

const submitApplication = async (schoolId, payload, userId) => {
    await validateApplicationRules(payload);

    if (payload.studentProfile.nationalIdEncrypted) {
        const strictDuplicate = await Application.findOne({
            schoolId,
            academicYearId: payload.academicYearId,
            'studentProfile.nationalIdEncrypted': payload.studentProfile.nationalIdEncrypted
        });

        if (strictDuplicate) {
            throw new Error(`Duplicate Error: An application with this National ID already exists in this academic year (App No: ${strictDuplicate.applicationNumber}).`);
        }
    }

    // 🟡 TIER 2: FUZZY DEDUPLICATION (Soft Warning for Data Entry Errors)
    // If no National ID is provided (e.g., a young child without one yet), we check Name + DOB
    const fuzzyDuplicate = await Application.findOne({
        schoolId,
        academicYearId: payload.academicYearId,
        'studentProfile.firstName': payload.studentProfile.firstName,
        'studentProfile.lastName': payload.studentProfile.lastName,
        'studentProfile.dob': payload.studentProfile.dob
    });

    if (fuzzyDuplicate) {
        throw new Error(`Potential Duplicate Error: A student with this exact Name and Date of Birth already exists (App No: ${fuzzyDuplicate.applicationNumber}). Please verify.`);
    }

    // 2. Generate Unique Application Number based on Academic Year
    const yearPrefix = new Date().getFullYear();
    const count = await Application.countDocuments({ schoolId, academicYearId: payload.academicYearId });
    const applicationNumber = `APP-${yearPrefix}-${String(count + 1).padStart(4, '0')}`;

    // 3. Construct and Save
    const newApplication = new Application({
        schoolId,
        applicationNumber,
        createdBy: userId,
        ...payload,
        status: 'SUBMITTED',
        lifecycle: { submittedAt: new Date() }
    });

    const existingApp = await Application.findOne({
        schoolId,
        academicYearId: payload.academicYearId,
        'studentProfile.firstName': payload.studentProfile.firstName,
        'studentProfile.lastName': payload.studentProfile.lastName,
        'studentProfile.dob': payload.studentProfile.dob
    });

    if (existingApp) {
        throw new Error("Duplicate Error: An application for this student already exists in this academic year.");
    }

    await validateApplicationRules(payload);

    return await newApplication.save();
};

const enrollStudent = async (schoolId, applicationId, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const app = await Application.findOne({ _id: applicationId, schoolId }).session(session);
        
        if (!app) throw new Error("Application not found.");
        if (app.status === 'ENROLLED') throw new Error("Student is already enrolled.");
        if (app.status !== 'APPROVED') throw new Error("Application must be APPROVED before enrollment.");

        // 1. Consume Seat Inventory Atomically
        const inventoryQuery = app.preferredSectionId 
            ? { schoolId, academicYearId: app.academicYearId, sectionId: app.preferredSectionId }
            : { schoolId, academicYearId: app.academicYearId, gradeId: app.appliedGradeId };

        const inventory = await SeatInventory.findOne(inventoryQuery).session(session);
        
        if (!inventory) throw new Error("Seat inventory not configured for this Grade/Section.");
        if (inventory.availableSeats <= 0) throw new Error("No available seats left.");

        // Adjust seat counts safely
        if (inventory.blockedSeats > 0) inventory.blockedSeats -= 1; 
        inventory.consumedSeats += 1;
        await inventory.save({ session });

        // 2. Generate Enrollment Number
        const studentCount = await Student.countDocuments({ schoolId }).session(session);
        const enrollmentNumber = `STU-${new Date().getFullYear()}-${String(studentCount + 1).padStart(5, '0')}`;

        // 3. Create Living Student Record
        const newStudent = new Student({
            schoolId,
            admissionApplicationId: app._id,
            enrollmentNumber,
            academicYearId: app.academicYearId,
            gradeId: app.appliedGradeId,
            sectionId: app.preferredSectionId,
            profile: {
                firstName: app.studentProfile.firstName,
                lastName: app.studentProfile.lastName,
                dob: app.studentProfile.dob,
                gender: app.studentProfile.gender,
                bloodGroup: app.studentProfile.bloodGroup,
                profilePhotoKey: app.studentProfile.profilePhotoKey
            }
        });
        await newStudent.save({ session });

        // 4. Update and Freeze Application
        app.status = 'ENROLLED';
        app.convertedStudentId = newStudent._id;
        app.lifecycle.enrolledAt = new Date();
        
        // Push to audit log safely checking if decisionLog exists
        if (!app.decisionLog) app.decisionLog = [];
        app.decisionLog.push({
            previousStatus: 'APPROVED',
            newStatus: 'ENROLLED',
            changedBy: userId,
            remarks: "Student enrolled automatically via system transaction."
        });

        await app.save({ session });

        // COMMIT TRANSACTION
        await session.commitTransaction();
        session.endSession();

        return { applicationNumber: app.applicationNumber, enrollmentNumber: newStudent.enrollmentNumber };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

module.exports = {
    submitApplication,
    enrollStudent
};
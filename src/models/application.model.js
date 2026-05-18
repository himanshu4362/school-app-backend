const mongoose = require('mongoose');

// ==========================================
// 1. SUB-SCHEMAS
// ==========================================

const DocumentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: [
      'AADHAAR', 'BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE',
      'MARKSHEET', 'ADDRESS_PROOF', 'CASTE_CERTIFICATE',
      'MIGRATION_CERTIFICATE', 'MEDICAL_CERTIFICATE', 'INCOME_CERTIFICATE', 'OTHER'
    ],
    required: true
  },
  displayName: { type: String, required: true },
  documentNumber: { type: String },
  status: {
    type: String,
    enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING'
  },
  fileKey: { type: String },
  mimeType: { type: String },
  verificationRemarks: { type: String },
  rejectionReason: { type: String },

  versions: [{
    displayName: String,
    documentNumber: String,
    fileKey: String,
    status: String,
    reason: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  uploadedAt: { type: Date },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
});


const AdmissionTestSchema = new mongoose.Schema({
  status: { type: String, enum: ['PENDING', 'SCHEDULED', 'COMPLETED', 'EXEMPTED'], required: true, },
  scheduledAt: { type: Date },
  writtenExamScore: { type: Number },
  mockExamScore: { type: Number },
  totalMaxMarks: { type: Number },
  evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String }
}, { _id: false });

const MedicalInfoSchema = new mongoose.Schema({
  hasDisability: { type: Boolean, default: false },
  disabilityType: { type: String },
  allergies: { type: String },
  chronicConditions: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  medication: { type: String },
  emergencyAction: { type: String }
}, { _id: false });

const AddressSchema = new mongoose.Schema({
  addressLine1: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true }
}, { _id: false });

// ==========================================
// 2. MAIN APPLICATION SCHEMA
// ==========================================

const applicationSchema = new mongoose.Schema({
  // TENANCY & MASTER DATA
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  applicationNumber: { type: String, required: true },

  admissionType: { type: String, enum: ['fresh', 'transfer'], required: true },

  admissionSource: { type: String, enum: ['website', 'walk_in', 'referral', 'campaign', 'counselor', 'other'], default: 'walk_in', required: true },
  campaignId: { type: String },
  counselorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referredBy: { type: String },

  // ACADEMIC ROUTING
  appliedGradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  streamPreference: { type: String, enum: ['science', 'commerce', 'arts', 'none'], default: 'none' },

  // STUDENT PROFILE
  studentProfile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String },
    profilePhotoKey: { type: String, required: true },

    // Changed to Aadhaar as requested
    aadhaarEncrypted: { type: String, required: true },
    aadhaarLast4: { type: String, required: true },

    nationality: { type: String, default: 'Indian', required: true },
    religion: { type: String },
    category: { type: String, enum: ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'OTHER'], required: true, default: 'GENERAL' },

    medicalInfo: { type: MedicalInfoSchema }
  },

  // GUARDIANS
  guardians: [{
    guardianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guardian', required: true },
    relation: { type: String, enum: ['father', 'mother', 'guardian', 'other'], required: true },
    isPrimaryContact: { type: Boolean, default: false }
  }],

  address: {
    current: { type: AddressSchema, required: true },
    permanent: { type: AddressSchema },
    isSameAsPermanent: { type: Boolean, default: false }
  },

  // ACADEMIC HISTORY & ADMISSION EXAMS
  academicHistory: {
    schoolName: { type: String },
    schoolAddress: { type: AddressSchema, required: true},
    board: { type: String },
    previousClass: { type: String },
    tcNumber: { type: String },
    hostelStatus: { type: String, enum: ['day_scholar', 'hosteler'] }
  },

  // Fixed syntax for nested schema
  admissionTest: { type: AdmissionTestSchema, required: true },

  // DOCUMENTS
  documents: {
    type: [DocumentSchema],
    validate: {
      validator: function (v) { return v && v.length > 0; },
      message: 'At least one document (or placeholder) is required.'
    }
  },

  // LIFECYCLE, STATUS, SEATS & FEES
  status: {
    type: String,
    enum: [
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'REUPLOAD_REQUIRED',
      'INTERVIEW_SCHEDULED', 'TEST_SCHEDULED', 'WAITLISTED', 'APPROVED',
      'REJECTED', 'ENROLLED', 'WITHDRAWN', 'ARCHIVED'
    ],
    default: 'DRAFT'
  },
  feeState: { type: String, enum: ['NOT_APPLICABLE', 'WAITING_PAYMENT', 'PARTIAL', 'PAID'], default: 'NOT_APPLICABLE', required: true },
  assignedFeePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeePlan' },

  // Default 40 days logic implemented
  seatReservationExpiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 40 * 24 * 60 * 60 * 1000)
  },
  convertedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },

  // TIMESTAMPS & ARCHIVE
  lifecycle: {
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    enrolledAt: { type: Date },
    withdrawnAt: { type: Date },
    rejectedAt: { type: Date },
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archiveReason: { type: String }
  },

}, {
  timestamps: true,
  optimisticConcurrency: true
});

// ==========================================
// 3. INDEXES & HOOKS
// ==========================================

// Compound index to prevent double admission for the same Aadhaar in the same school
applicationSchema.index({ schoolId: 1, 'studentProfile.aadhaarEncrypted': 1 }, { unique: true });
applicationSchema.index({ schoolId: 1, applicationNumber: 1 }, { unique: true });

//  FIX: Used modern async function to avoid Mongoose 'next is not a function' bug
applicationSchema.pre('save', async function () {

  if (this.address && this.address.isSameAsPermanent) {
    this.address.permanent = this.address.current;
  }

  // Lock specific fields if Approved or Enrolled
  if (['APPROVED', 'ENROLLED'].includes(this.status)) {
    const lockedPaths = ['studentProfile.dob', 'studentProfile.aadhaarEncrypted', 'studentProfile.category'];
    for (let path of lockedPaths) {
      if (this.isModified(path)) {
        throw new Error(`Validation Error: Cannot modify ${path} after application is ${this.status}.`);
      }
    }
  }

  // 2. Strict Guardian Validations
  if (!this.guardians || this.guardians.length === 0) {
    throw new Error('Validation Error: At least one guardian details must be provided.');
  }

  const guardianIds = this.guardians.filter(g => g.guardianId).map(g => g.guardianId.toString());
  if (guardianIds.length !== this.guardians.length) {
    throw new Error('Validation Error: guardianId is required.');
  }
  const uniqueIds = new Set(guardianIds);
  if (uniqueIds.size !== guardianIds.length) {
    throw new Error('Validation Error: The same guardian cannot be linked multiple times.');
  }

  const primaryContacts = this.guardians.filter(g => g.isPrimaryContact);
  if (primaryContacts.length === 0) {
    throw new Error('Validation Error: Please select at least one primary guardian contact for communications.');
  }
  
});

module.exports = mongoose.model('Application', applicationSchema);
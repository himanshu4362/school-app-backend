const mongoose = require('mongoose');

// --- SUB-SCHEMAS ---

const GuardianSchema = new mongoose.Schema({
  relation: { type: String, enum: ['father', 'mother', 'guardian', 'other'], required: true },
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  occupation: { type: String },
  annualIncome: { type: Number },
  isPrimaryContact: { type: Boolean, default: false },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
});

const DocumentSchema = new mongoose.Schema({
  documentType: { 
    type: String, 
    enum: [
      'NATIONAL_ID', 'BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE', 
      'MARKSHEET', 'ADDRESS_PROOF', 'CASTE_CERTIFICATE', 
      'MIGRATION_CERTIFICATE', 'MEDICAL_CERTIFICATE', 'INCOME_CERTIFICATE'
    ],
    required: true
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'REUPLOAD_REQUIRED', 'EXPIRED', 'WAIVED'],
    default: 'PENDING'
  },
  fileKey: { type: String }, 
  mimeType: { type: String },
  fileSize: { type: Number }, 
  checksum: { type: String }, // 🟢 NEW: File Integrity Hash
  uploadedAt: { type: Date },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  verificationRemarks: { type: String },
  rejectionReason: { type: String }
});

const AdmissionTestSchema = new mongoose.Schema({
  status: { type: String, enum: ['PENDING', 'SCHEDULED', 'COMPLETED', 'EXEMPTED'], default: 'PENDING' },
  scheduledAt: { type: Date },
  writtenExamScore: { type: Number },
  mockExamScore: { type: Number }, // Interview/Oral/Mock
  totalMaxMarks: { type: Number },
  evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String }
}, { _id: false });

const MedicalInfoSchema = new mongoose.Schema({
  hasDisability: { type: Boolean, default: false },
  disabilityType: { type: String },
  allergies: { type: String },
  chronicConditions: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, // 🟢 NEW: Structured Severity
  medication: { type: String },
  emergencyAction: { type: String }
}, { _id: false });

// --- MAIN SCHEMA ---

const applicationSchema = new mongoose.Schema({
  // 1. TENANCY & MASTER DATA
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  applicationNumber: { type: String, required: true }, 
  
  admissionType: { type: String, enum: ['fresh', 'transfer'], required: true },
  
  // 🟢 NEW: Deep Source Tracking
  admissionSource: { type: String, enum: ['website', 'walk_in', 'referral', 'campaign', 'counselor', 'other'], default: 'walk_in' },
  campaignId: { type: String },
  counselorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referredBy: { type: String },

  // 2. ACADEMIC ROUTING
  appliedGradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  preferredSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' }, 
  streamPreference: { type: String, enum: ['science', 'commerce', 'arts', 'none'], default: 'none' },

  // 3. STUDENT PROFILE
  studentProfile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String },
    profilePhotoKey: { type: String }, 
    
    nationalIdEncrypted: { type: String }, 
    nationalIdLast4: { type: String }, // e.g., XXXX-XXXX-1234
    
    nationality: { type: String, default: 'Indian' },
    religion: { type: String },
    category: { type: String, enum: ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'OTHER'], default: 'GENERAL' },
    
    medicalInfo: MedicalInfoSchema
  },

  // 4. GUARDIANS (With Unique Mobile Validation added in pre-save)
  guardians: [GuardianSchema],
  
  // 5. ACADEMIC HISTORY & ADMISSION EXAMS
  academicHistory: {
    schoolName: { type: String },
    board: { type: String },
    previousClass: { type: String },
    tcNumber: { type: String },
    hostelStatus: { type: String, enum: ['day_scholar', 'hosteler'] }
  },
  admissionTest: AdmissionTestSchema, // 🟢 NEW: Exam Scores

  // 6. DOCUMENTS 
  documents: [DocumentSchema],

  // 7. LIFECYCLE, STATUS, SEATS & FEES
  status: { 
    type: String, 
    enum: [
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'REUPLOAD_REQUIRED',
      'INTERVIEW_SCHEDULED', 'TEST_SCHEDULED', 'WAITLISTED', 'APPROVED', 
      'REJECTED', 'ENROLLED', 'WITHDRAWN', 'ARCHIVED'
    ],
    default: 'DRAFT' 
  },
  feeState: { type: String, enum: ['NOT_APPLICABLE', 'WAITING_PAYMENT', 'PARTIAL', 'PAID'], default: 'NOT_APPLICABLE' },
  assignedFeePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeePlan' }, // 🟢 NEW: Fee Snapshot Link
  seatReservationExpiresAt: { type: Date },
  convertedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, 

  // 8. TIMESTAMPS & ARCHIVE
  lifecycle: {
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    enrolledAt: { type: Date },
    withdrawnAt: { type: Date },
    rejectedAt: { type: Date },
    // 🟢 NEW: Archive Metadata
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archiveReason: { type: String }
  },

}, { 
  timestamps: true,
  optimisticConcurrency: true // 🟢 NEW: Prevents Concurrency Issues (Updates fail if version __v doesn't match)
});

// --- INDEXES ---
applicationSchema.index({ schoolId: 1, applicationNumber: 1 }, { unique: true });

// --- PRE-SAVE MIDDLEWARE (Strict Validation & Freezing) ---
// --- PRE-SAVE MIDDLEWARE (Strict Validation & Freezing) ---
applicationSchema.pre('save', function() { // 🟢 Removed 'next' here!
  
  // 1. FREEZE LOGIC: If APPROVED/ENROLLED, block changes to core identity
  if (['APPROVED', 'ENROLLED'].includes(this.status)) {
    const lockedPaths = ['studentProfile.dob', 'studentProfile.nationalIdEncrypted', 'studentProfile.category'];
    for (let path of lockedPaths) {
      if (this.isModified(path)) {
        // 🟢 Swapped 'next(new Error)' to 'throw new Error'
        throw new Error(`Validation Error: Cannot modify ${path} after application is ${this.status}.`); 
      }
    }
  }

  // 2. GUARDIAN VALIDATION: Check for duplicate mobiles inside the same application
  if (this.guardians && this.guardians.length > 0) {
    const mobiles = this.guardians.map(g => g.mobile);
    const uniqueMobiles = new Set(mobiles);
    if (uniqueMobiles.size !== mobiles.length) {
      throw new Error('Validation Error: Duplicate guardian mobile numbers are not allowed.');
    }
    
    // Check exactly one primary contact
    const primaryContacts = this.guardians.filter(g => g.isPrimaryContact);
    if (primaryContacts.length !== 1) {
      throw new Error('Validation Error: There must be exactly one primary guardian contact.');
    }
  }

  // 🟢 Removed next() at the bottom!
});
module.exports = mongoose.model('Application', applicationSchema);
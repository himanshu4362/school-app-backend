const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  
  // Pipeline Routing (From Step 1)
  admissionType: { type: String, enum: ['fresh', 'transfer'], required: true },
  selectedClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  
  // Step 1: Student Profile
  studentProfile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String },
    hasDisability: { type: Boolean, default: false }
  },

  // Step 2: Guardians Array
  guardians: [{
    relation: { type: String, enum: ['father', 'mother', 'guardian', 'local-guardian', 'other'], required: true },
    fullName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String },
    occupation: { type: String },
    isPrimaryContact: { type: Boolean, default: false }
  }],

  // Step 3: Address Details
  address: {
    current: {
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true }
    },
    permanent: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String }
    }
  },

  // Step 4: Academic History (Nullable for 'fresh' admissions)
  academicHistory: {
    schoolName: { type: String },
    state: { type: String },
    district: { type: String },
    city: { type: String },
    previousClass: { type: String },
    hostelStatus: { type: String, enum: ['day_scholar', 'hosteler'] },
    migrationReason: { type: String }
  },

  // Step 5: Document Vault (Includes S3 File Keys)
  documents: [{
    documentType: { type: String, required: true },
    displayName: { type: String },
    isMandatory: { type: Boolean, default: false },
    status: { type: String, enum: ['submitted', 'pending', 'not_applicable'], default: 'pending' },
    documentNumber: { type: String },
    fileKey: { type: String }
  }],

  // Operational Status
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'submitted' 
  },
  applicationNumber: { type: String, unique: true } // Auto-generated e.g., APP-2026-001

}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
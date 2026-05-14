const mongoose = require('mongoose');

// The living, breathing Student record that survives for 14+ years
const studentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  admissionApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', unique: true }, // The link back to the historical snapshot
  
  enrollmentNumber: { type: String, required: true, unique: true }, // e.g., STU-2026-0001
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  
  // We copy the core profile from the Application during the transaction
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    bloodGroup: { type: String },
    profilePhotoKey: { type: String }
  },
  
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN'], default: 'ACTIVE' }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
const mongoose = require('mongoose');

const guardianSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  
  // Normalization Core: Mobile is the unique identifier for a parent per school
  mobile: { type: String, required: true },
  email: { type: String },
  
  fullName: { type: String, required: true },
  occupation: { type: String },
  annualIncome: { type: Number },
  
  // Future-proofing for the Parent Portal
  authUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Bi-directional mapping for fast queries
  linkedStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
}, { timestamps: true });

// A parent's mobile number must be unique per school
guardianSchema.index({ schoolId: 1, mobile: 1 }, { unique: true });

module.exports = mongoose.model('Guardian', guardianSchema);
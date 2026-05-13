const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "2025-2026"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false }, // Only one should be active at a time
}, { timestamps: true });

// Ensure a school can't have duplicate academic year names
academicYearSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYear', academicYearSchema);
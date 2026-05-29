const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "2025-2026"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false }, // Only one should be active at a time
}, { timestamps: true });

// DB-level guarantee: only one active academic year per school (concurrency safe)
academicYearSchema.index(
  { schoolId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('AcademicYear', academicYearSchema);
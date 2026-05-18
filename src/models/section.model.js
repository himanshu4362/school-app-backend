const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true }, // Links to physical infrastructure
  
  name: { type: String, required: true }, // e.g., 'A', 'B', 'Rose'
  targetCapacity: { type: Number, required: true }, // Must be <= room.capacity
  
  classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// A school cannot have two "Section A"s for "Class 1" in the same Academic Year
sectionSchema.index({ schoolId: 1, academicYearId: 1, gradeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
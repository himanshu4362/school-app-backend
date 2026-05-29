const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  
  name: { type: String, required: true },
  targetCapacity: { type: Number, required: true },
  
  classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' }
}, { timestamps: true });

// A school cannot have two active sections with the same name for the same grade+year
sectionSchema.index({ schoolId: 1, academicYearId: 1, gradeId: 1, name: 1, status: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
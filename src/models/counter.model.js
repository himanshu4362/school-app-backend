const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  sequenceName: { type: String, required: true }, // e.g., 'APPLICATION_2026', 'STUDENT_2026'
  sequenceValue: { type: Number, default: 0 }
});

// A sequence is unique per school
counterSchema.index({ schoolId: 1, sequenceName: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
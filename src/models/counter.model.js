const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  sequenceName: { type: String, required: true }, // e.g., 'APP_2026', 'STU_2026'
  sequenceValue: { type: Number, default: 0 }
});

// 🟢 CRITICAL FIX: Ensure no duplicate counters exist for the same sequence in a school
counterSchema.index({ schoolId: 1, sequenceName: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
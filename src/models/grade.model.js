const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "Class 1", "Nursery"
  level: { type: Number, required: true }, // Used for sorting (e.g., Nursery=0, Class 1=1)
  admissionOpen: { type: Boolean, default: true }, // Controls if it shows up in Admission Wizard Step 1
}, { timestamps: true });

gradeSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
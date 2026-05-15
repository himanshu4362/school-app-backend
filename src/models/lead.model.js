const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true },
  notes: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const leadSchema = new mongoose.Schema({
  // 🟢 9. SECURITY: Enforced School Isolation
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  
  parentName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  
  // 🟢 1. CRITICAL: Relational Integrity
  interestedClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade' },
  
  // 🟢 2. CRITICAL: Lead Ownership
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  source: {
    type: String, 
    enum: ['walk_in', 'website', 'referral', 'other'],
    default: 'walk_in'
  },
  
  status: {
    type: String, 
    enum: ['new', 'contacted', 'follow_up', 'converted', 'closed'],
    default: 'new'
  },
  
  remarks: { type: String },
  campaignId: { type: String, default: 'CAMP-2026-DEFAULT' },

  // 🟢 5. MOST IMPORTANT: CRM to Admissions Bridge
  admissionApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },

  // 🟢 3. VERY IMPORTANT: Activity Timeline
  activities: [activitySchema]

}, { 
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Lead', leadSchema);
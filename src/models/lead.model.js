const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  
  parentName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  
  interestedClassId: { type: String },
  
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
  campaignId: { type: String, default: 'CAMP-2026-DEFAULT' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Lead', leadSchema);
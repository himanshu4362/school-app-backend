const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  schoolName: { type: String, required: true },
  udiseCode: { type: String, required: true, unique: true },
  address: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
  },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);
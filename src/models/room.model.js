const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  
  roomNumber: { type: String, required: true }, // e.g., "101A", "Lab-2"
  capacity: { type: Number, required: true }, // Maximum physical chairs
  building: { type: String }, // e.g., "West Block", "Main Wing"
  
  roomType: {
    type: String,
    enum: [
      'STANDARD_CLASSROOM', 
      'LABORATORY', 
      'AUDITORIUM', 
      'LIBRARY', 
      'SMART_CLASS', 
      'SPORTS_FACILITY',
      'OTHER'
    ],
    default: 'STANDARD_CLASSROOM'
  }
}, { timestamps: true });

// A school cannot have two rooms with the exact same number
roomSchema.index({ schoolId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
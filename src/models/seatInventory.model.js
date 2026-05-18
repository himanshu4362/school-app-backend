const mongoose = require('mongoose');

// Sub-schema for tracking seats per specific category
const QuotaStatsSchema = new mongoose.Schema({
  capacity: { type: Number, default: 0, required: true },
  blockedSeats: { type: Number, default: 0 },
  consumedSeats: { type: Number, default: 0 }
}, { _id: false });

const seatInventorySchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', required: true },
  totalCapacity: { type: Number, required: true },
  
  // NEW: The Quota Matrix
  quotas: {
    GENERAL: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) },
    OBC: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) },
    SC: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) },
    ST: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) },
    EWS: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) },
    OTHER: { type: QuotaStatsSchema, default: () => ({ capacity: 0 }) }
  },

  // NEW: Spillover Rule
  allowSpillover: { 
    type: Boolean, 
    default: true,
    description: "If true, unfilled reserved seats can be consumed by GENERAL students." 
  }

}, { timestamps: true });

// Ensure we don't create duplicate inventories for the same section
seatInventorySchema.index({ schoolId: 1, academicYearId: 1, gradeId: 1 }, { unique: true });

module.exports = mongoose.model('SeatInventory', seatInventorySchema);
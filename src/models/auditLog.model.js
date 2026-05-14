const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  
  entityType: { 
    type: String, 
    enum: ['APPLICATION', 'STUDENT', 'SEAT_INVENTORY', 'GUARDIAN', 'FEE_INVOICE'], 
    required: true 
  },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  
  action: { type: String, required: true }, // e.g., 'CREATED', 'STATUS_CHANGED', 'ENROLLED'
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Flexible payload for what actually changed
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  // Auto-delete after 7 years (Data retention compliance)
  createdAt: { type: Date, default: Date.now, expires: '7y' } 
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
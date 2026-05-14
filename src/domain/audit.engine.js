const AuditLog = require('../models/auditLog.model');

class AuditEngine {
    static async log(schoolId, entityType, entityId, action, actorId, metadata = {}, session = null) {
        const entry = new AuditLog({ schoolId, entityType, entityId, action, actorId, metadata });
        return await entry.save({ session });
    }
}

module.exports = AuditEngine;
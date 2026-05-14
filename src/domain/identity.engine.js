const Counter = require('../models/counter.model');

class IdentityEngine {
    /**
     * Safely generates an atomic, sequential ID.
     * @param {ObjectId} schoolId 
     * @param {String} type - e.g., 'APP', 'STU'
     * @param {String} year - e.g., '2026'
     * @param {Object} session - MongoDB Transaction Session (Crucial!)
     */
    static async generateSequence(schoolId, type, year, session) {
        const sequenceName = `${type}_${year}`;
        
        // Atomically find the counter and increment it by 1
        const counter = await Counter.findOneAndUpdate(
            { schoolId, sequenceName },
            { $inc: { sequenceValue: 1 } },
            { new: true, upsert: true, session } // upsert creates it if it doesn't exist yet
        );

        // Format: APP-2026-0001
        const paddedNumber = String(counter.sequenceValue).padStart(4, '0');
        return `${type}-${year}-${paddedNumber}`;
    }
}

module.exports = IdentityEngine;
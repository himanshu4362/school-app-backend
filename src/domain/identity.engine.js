const Counter = require('../models/counter.model');

class IdentityEngine {

    /**
     * Safely generates an atomic, sequential ID without race conditions.
     */
    static async generateSequence(schoolId, type, year, session) {

        const sequenceName = `${type}_${year}`;

        // 🟢 FIX: Added new: true and setDefaultsOnInsert: true
        const counter = await Counter.findOneAndUpdate(
            {
                schoolId,
                sequenceName
            },
            {
                $inc: { sequenceValue: 1 }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                session
            }
        );

        const paddedNumber = String(
            counter.sequenceValue
        ).padStart(4, '0');

        return `${type}-${year}-${paddedNumber}`;
    }
}

module.exports = IdentityEngine;
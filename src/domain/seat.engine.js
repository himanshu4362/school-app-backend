const SeatInventory = require('../models/seatInventory.model');

class SeatEngine {
    // GRADE-LEVEL SEAT CONSUMPTION WITH SPILLOVER
    static async consumeSeat(schoolId, academicYearId, gradeId, category, session) {
        category = String(category).toUpperCase();
        const quotaPath = `quotas.${category}`;

        // 1. Try to consume in specific category
        const updatedInventory = await SeatInventory.findOneAndUpdate(
            {
                schoolId, academicYearId, gradeId, // FIXED: Using gradeId
                $expr: { $gt: [{ $subtract: [`$${quotaPath}.capacity`, { $add: [`$${quotaPath}.blockedSeats`, `$${quotaPath}.consumedSeats`] }] }, 0] }
            },
            { $inc: { [`${quotaPath}.consumedSeats`]: 1 } },
            { returnDocument: 'after', session }
        );

        if (updatedInventory) return { success: true, consumedCategory: category };

        // 2. SPILLOVER: Try to consume in GENERAL if specific category is full
        if (category !== 'GENERAL') {
            const spilloverInventory = await SeatInventory.findOneAndUpdate(
                {
                    schoolId, academicYearId, gradeId,
                    $expr: { $gt: [{ $subtract: [`$quotas.GENERAL.capacity`, { $add: [`$quotas.GENERAL.blockedSeats`, `$quotas.GENERAL.consumedSeats`] }] }, 0] }
                },
                { $inc: { "quotas.GENERAL.consumedSeats": 1 } },
                { returnDocument: 'after', session }
            );

            if (spilloverInventory) return { success: true, consumedCategory: 'GENERAL', spilledOver: true };
        }

        throw new Error(`Capacity Error: No available seats in the ${category} quota, and no spillover seats available.`);
    }

    // GRADE-LEVEL SEAT BLOCKING WITH SPILLOVER
    static async blockSeat(schoolId, academicYearId, gradeId, category, session) {
        category = String(category).toUpperCase();
        const quotaPath = `quotas.${category}`;

        // 1. Try to block in specific category
        const result = await SeatInventory.findOneAndUpdate(
            {
                schoolId, academicYearId, gradeId,
                $expr: { $gt: [{ $subtract: [`$${quotaPath}.capacity`, { $add: [`$${quotaPath}.blockedSeats`, `$${quotaPath}.consumedSeats`] }] }, 0] }
            },
            { $inc: { [`${quotaPath}.blockedSeats`]: 1 } },
            { returnDocument: 'after', session }
        );

        if (result) return { success: true, blockedCategory: category };

        // 2. SPILLOVER: Try to block in GENERAL
        if (category !== 'GENERAL') {
            const spilloverResult = await SeatInventory.findOneAndUpdate(
                {
                    schoolId, academicYearId, gradeId,
                    $expr: { $gt: [{ $subtract: [`$quotas.GENERAL.capacity`, { $add: [`$quotas.GENERAL.blockedSeats`, `$quotas.GENERAL.consumedSeats`] }] }, 0] }
                },
                { $inc: { "quotas.GENERAL.blockedSeats": 1 } },
                { returnDocument: 'after', session }
            );
            if (spilloverResult) return { success: true, blockedCategory: 'GENERAL', spilledOver: true };
        }

        throw new Error(`Reservation Failed: No seats available to block for class in ${category} or GENERAL quota.`);
    }

    // SEAT RELEASE LOGIC
    static async releaseSeat(schoolId, academicYearId, gradeId, category, releaseType = 'BLOCKED', session) {
        category = String(category).toUpperCase();
        const fieldToDecrement = releaseType === 'BLOCKED' ? `quotas.${category}.blockedSeats` : `quotas.${category}.consumedSeats`;

        const result = await SeatInventory.findOneAndUpdate(
            { schoolId, academicYearId, gradeId, [fieldToDecrement]: { $gt: 0 } },
            { $inc: { [fieldToDecrement]: -1 } },
            { new: true, session }
        );

        // If primary category release failed, try GENERAL (spillover reversal)
        if (!result && category !== 'GENERAL') {
            const generalField = releaseType === 'BLOCKED' ? 'quotas.GENERAL.blockedSeats' : 'quotas.GENERAL.consumedSeats';
            const spilloverResult = await SeatInventory.findOneAndUpdate(
                { schoolId, academicYearId, gradeId, [generalField]: { $gt: 0 } },
                { $inc: { [generalField]: -1 } },
                { returnDocument: 'after', session }
            );

            if (!spilloverResult) {
                throw new Error(`Seat Release Error: No ${releaseType.toLowerCase()} seats found to release for category ${category} or GENERAL.`);
            }
        }
    }
}

module.exports = SeatEngine;
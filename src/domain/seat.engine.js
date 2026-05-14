const SeatInventory = require('../models/seatInventory.model');

class SeatEngine {
    static async consumeSeat(schoolId, sectionId, category, session) {
        // We dynamically build the query field paths for the exact category
        const quotaPath = `quotas.${category}`;
        const capacityField = `${quotaPath}.capacity`;
        const blockedField = `${quotaPath}.blockedSeats`;
        const consumedField = `${quotaPath}.consumedSeats`;

        // 🟢 ATOMIC UPDATE: We use MongoDB's $expr to ensure math is done at the DB level
        const updatedInventory = await SeatInventory.findOneAndUpdate(
            { 
                schoolId, 
                sectionId,
                $expr: {
                    // Ensures: capacity - (blocked + consumed) > 0
                    $gt: [
                        { $subtract: [ `$${capacityField}`, { $add: [ `$${blockedField}`, `$${consumedField}` ] } ] },
                        0
                    ]
                }
            },
            { $inc: { [consumedField]: 1 } },
            { new: true, session }
        );

        if (updatedInventory) {
            return { success: true, consumedCategory: category };
        }

        // 🟡 SPILLOVER ATOMIC CHECK
        // If the specific category failed, we try to decrement GENERAL (if spillover is allowed)
        if (category !== 'GENERAL') {
            const spilloverInventory = await SeatInventory.findOneAndUpdate(
                { 
                    schoolId, 
                    sectionId,
                    allowSpillover: true,
                    $expr: {
                        $gt: [
                            { $subtract: [ "$quotas.GENERAL.capacity", { $add: [ "$quotas.GENERAL.blockedSeats", "$quotas.GENERAL.consumedSeats" ] } ] },
                            0
                        ]
                    }
                },
                { $inc: { "quotas.GENERAL.consumedSeats": 1 } },
                { new: true, session }
            );

            if (spilloverInventory) {
                return { success: true, consumedCategory: 'GENERAL', spilledOver: true };
            }
        }

        throw new Error(`Capacity Error: No available seats in the ${category} quota, and no spillover seats available.`);
    }

    static async blockSeat(schoolId, sectionId, category, session) {
        const quotaPath = `quotas.${category}`;
        // Increment blockedSeats atomically
        const result = await SeatInventory.findOneAndUpdate(
            { 
                schoolId, 
                sectionId,
                $expr: { $gt: [ { $subtract: [ `$${quotaPath}.capacity`, { $add: [ `$${quotaPath}.blockedSeats`, `$${quotaPath}.consumedSeats` ] } ] }, 0 ] }
            },
            { $inc: { [`${quotaPath}.blockedSeats`]: 1 } },
            { new: true, session }
        );
        if (!result) throw new Error("Reservation Failed: No seats available to block.");
        return true;
    }
}

module.exports = SeatEngine;
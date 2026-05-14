const Guardian = require('../models/guardian.model');

class GuardianRepository {
    static async findByMobile(schoolId, mobile, session) {
        return await Guardian.findOne({ schoolId, mobile }).session(session);
    }

    static async create(guardianData, session) {
        const guardian = new Guardian(guardianData);
        return await guardian.save({ session });
    }
}

module.exports = GuardianRepository;
const Application = require('../models/application.model');
const BaseRepository = require('./base.repository');

class ApplicationRepository extends BaseRepository {
    constructor() {
        super(Application); 
    }

    async markEnrolled(schoolId, applicationId, studentId, session) {
        const query = this._buildTenantQuery(schoolId, { _id: applicationId });
        return await this.model.updateOne(
            query,
            { $set: { status: 'ENROLLED', convertedStudentId: studentId } },
            { session }
        );
    }
}

module.exports = new ApplicationRepository();

class BaseRepository {
    constructor(model) {
        this.model = model;
    }

    // Every query MUST pass through here, ensuring schoolId is always injected
    _buildTenantQuery(schoolId, query = {}) {
        if (!schoolId) throw new Error("CRITICAL SECURITY: schoolId must be provided for tenant-scoped queries.");
        return { ...query, schoolId };
    }

    async findById(schoolId, id, session = null) {
        const query = this._buildTenantQuery(schoolId, { _id: id });
        return await this.model.findOne(query).session(session);
    }

    async findOne(schoolId, query, session = null) {
        const safeQuery = this._buildTenantQuery(schoolId, query);
        return await this.model.findOne(safeQuery).session(session);
    }

    async create(data, session = null) {
        // Extract schoolId directly from the data payload
        if (!data.schoolId) throw new Error("CRITICAL SECURITY: Cannot create document without schoolId.");
        const document = new this.model(data);
        return await document.save({ session });
    }
}

module.exports = BaseRepository;
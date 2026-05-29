const Application = require('../models/application.model');
const BaseRepository = require('./base.repository');

class ApplicationRepository extends BaseRepository {
    constructor() {
        super(Application);
    }
}

module.exports = new ApplicationRepository();
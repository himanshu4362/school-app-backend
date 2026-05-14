const Student = require('../models/student.model');

class StudentRepository {
    static async create(studentData, session) {
        const student = new Student(studentData);
        return await student.save({ session });
    }
}

module.exports = StudentRepository;
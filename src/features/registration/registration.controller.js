const RegistrationService = require('./registration.service');

const registerSchool = async (req, res) => {
    try {
        const result = await RegistrationService.onboardNewSchool(req.body);
        
        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    registerSchool
};
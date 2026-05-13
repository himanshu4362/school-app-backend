const AuthService = require('./auth.service');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) throw new Error("Please provide email and password.");

        const result = await AuthService.loginUser(email, password);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

const setupNewPassword = async (req, res) => {
    try {
        // req.user comes from the auth.middleware
        const userId = req.user.id; 
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        const result = await AuthService.changeInitialPassword(userId, newPassword);
        
        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    login,
    setupNewPassword
};
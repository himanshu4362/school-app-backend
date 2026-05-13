const bcrypt = require('bcryptjs');
const User = require('../../models/user.model');
const { generateToken } = require('../../utils/jwt');

const loginUser = async (email, password) => {
    // 1. Find user
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
        throw new Error("Invalid credentials or account suspended.");
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials.");
    }

    // 3. Generate Token
    const token = generateToken(user);

    // 4. Return data (letting frontend know if it's the first login)
    return {
        token,
        isFirstLogin: user.isFirstLogin,
        user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId
        }
    };
};

const changeInitialPassword = async (userId, newPassword) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found.");

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and flip the firstLogin switch
    user.password = hashedPassword;
    user.isFirstLogin = false;
    await user.save();

    return { message: "Password updated successfully. You can now access the platform." };
};

module.exports = {
    loginUser,
    changeInitialPassword
};
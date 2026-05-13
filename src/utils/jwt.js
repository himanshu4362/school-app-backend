const jwt = require('jsonwebtoken');

// In production, keep this in your .env file: process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id, 
            schoolId: user.schoolId, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
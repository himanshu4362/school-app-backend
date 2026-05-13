const { verifyToken } = require('../utils/jwt');

const protect = (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Not authorized to access this route. No token provided." });
        }

        const decoded = verifyToken(token);
        req.user = decoded; // Attach user info (id, schoolId, role) to the request object
        
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};

module.exports = { protect };
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

const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ success: false, message: "Access denied. No role assigned." });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`
            });
        }

        next();
    };
};

module.exports = { protect, roleGuard };
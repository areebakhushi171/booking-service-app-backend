const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    try {
        // Request header se token lena
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token is required"
            });
        }

        // Bearer ke baad wala token
        const token = authHeader.split(" ")[1];

        // Token verify karna
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Logged-in user ki information request mein rakhna
        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

module.exports = authMiddleware;
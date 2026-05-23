import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {

    const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Access denied. No token provided.' 
        });
    }

    try {

        const secret = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Fallback for dev
        const decoded = jwt.verify(token, secret);

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false,
            message: 'Invalid token.' 
        });
    }
};
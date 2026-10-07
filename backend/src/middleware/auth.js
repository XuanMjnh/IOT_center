import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

export function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization?.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

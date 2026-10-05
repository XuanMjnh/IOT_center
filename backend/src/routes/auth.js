import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const [rows] = await pool.query(
    'SELECT id, username, password, full_name FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, fullName: user.full_name || user.username },
    process.env.JWT_SECRET || 'development-secret-change-me',
    { expiresIn: '8h' }
  );

  return res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name || user.username,
    token
  });
}));

export default router;

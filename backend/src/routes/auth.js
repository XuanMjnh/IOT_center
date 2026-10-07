import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

router.post('/login', async (req, res) => {
  const { username = '', password = '' } = req.body;
  const [[user]] = await pool.query(
    'SELECT id, username, password, full_name FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const profile = {
    id: user.id,
    username: user.username,
    fullName: user.full_name || user.username
  };
  res.json({
    ...profile,
    token: jwt.sign(profile, SECRET, { expiresIn: '8h' })
  });
});

export default router;

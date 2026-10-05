import { Router } from 'express';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';
import { positiveInt, zeroBasedPage, sqlDate } from '../utils/query.js';
import { publishDeviceCommand } from '../services/mqttService.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, status FROM devices ORDER BY id');
  res.json(rows);
}));

router.get('/action-history', asyncHandler(async (req, res) => {
  const page = zeroBasedPage(req.query.page);
  const size = positiveInt(req.query.size, 10, 100);
  const offset = page * size;
  const where = [];
  const params = [];

  if (req.query.deviceId) {
    const deviceId = Number(req.query.deviceId);
    if (!Number.isInteger(deviceId) || deviceId < 1) return res.status(400).json({ message: 'Invalid deviceId' });
    where.push('ah.device_id = ?');
    params.push(deviceId);
  }
  if (req.query.action) {
    const action = String(req.query.action).toUpperCase();
    if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ message: 'Invalid action' });
    where.push('ah.action = ?');
    params.push(action);
  }
  if (req.query.status) {
    const status = String(req.query.status).toUpperCase();
    if (!['PENDING', 'SUCCESS', 'FAILED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    where.push('ah.status = ?');
    params.push(status);
  }
  if (req.query.from) {
    const from = sqlDate(req.query.from);
    if (!from) return res.status(400).json({ message: 'Invalid from date' });
    where.push('ah.created_at >= ?');
    params.push(from);
  }
  if (req.query.to) {
    const to = sqlDate(req.query.to);
    if (!to) return res.status(400).json({ message: 'Invalid to date' });
    where.push('ah.created_at <= ?');
    params.push(to);
  }
  if (req.query.toExclusive) {
    const toExclusive = sqlDate(req.query.toExclusive);
    if (!toExclusive) return res.status(400).json({ message: 'Invalid exclusive end date' });
    where.push('ah.created_at < ?');
    params.push(toExclusive);
  }

  const sortMap = {
    'id,asc': 'ah.id ASC',
    'id,desc': 'ah.id DESC',
    'deviceId,asc': 'ah.device_id ASC, ah.id DESC',
    'deviceId,desc': 'ah.device_id DESC, ah.id DESC',
    'createdAt,asc': 'ah.created_at ASC, ah.id ASC',
    'createdAt,desc': 'ah.created_at DESC, ah.id DESC'
  };
  const orderBy = sortMap[String(req.query.sort || 'id,desc')] || sortMap['id,desc'];
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM action_history ah ${whereSql}`, params);
  const [rows] = await pool.query(`
    SELECT ah.id, ah.device_id AS deviceId, d.name AS deviceName,
           ah.action, ah.status, ah.user_id AS userId,
           u.username, COALESCE(NULLIF(u.full_name, ''), u.username) AS userName,
           ah.created_at AS createdAt
    FROM action_history ah
    JOIN devices d ON d.id = ah.device_id
    JOIN users u ON u.id = ah.user_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...params, size, offset]);

  const totalElements = Number(countRow.total);
  res.json({
    content: rows,
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size)
  });
}));

router.get('/:deviceId/status', asyncHandler(async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  if (!Number.isInteger(deviceId) || deviceId < 1) return res.status(400).json({ message: 'Invalid deviceId' });

  const [rows] = await pool.query(`
    SELECT d.id AS deviceId, d.status,
      (SELECT ah.created_at FROM action_history ah
       WHERE ah.device_id = d.id AND ah.status = 'SUCCESS'
       ORDER BY ah.created_at DESC, ah.id DESC LIMIT 1) AS updatedAt
    FROM devices d WHERE d.id = ?
  `, [deviceId]);
  if (!rows.length) return res.status(404).json({ message: 'Device not found' });
  res.json(rows[0]);
}));

router.post('/:deviceId/control', asyncHandler(async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  const action = String(req.body?.action || '').toUpperCase();
  if (!Number.isInteger(deviceId) || deviceId < 1) return res.status(400).json({ message: 'Invalid deviceId' });
  if (!['ON', 'OFF'].includes(action)) return res.status(400).json({ message: 'Action must be ON or OFF' });

  const result = await publishDeviceCommand({ deviceId, action, userId: req.user.id });
  res.status(202).json(result);
}));

export default router;

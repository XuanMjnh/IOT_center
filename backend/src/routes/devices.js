import { Router } from 'express';
import { pool } from '../config/db.js';
import { pagination, sqlDate, where } from '../utils/query.js';
import { publishDeviceCommand } from '../services/mqttService.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, status FROM devices ORDER BY id');
  res.json(rows);
});

router.get('/action-history', async (req, res) => {
  const { page, size, offset } = pagination(req.query);
  const { sql, params } = where([
    ['ah.device_id = ?', req.query.deviceId && Number(req.query.deviceId)],
    ['ah.action = ?', req.query.action],
    ['ah.status = ?', req.query.status],
    ['ah.created_at >= ?', sqlDate(req.query.from)],
    ['ah.created_at < ?', sqlDate(req.query.toExclusive)]
  ]);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM action_history ah ${sql}`, params);
  const [rows] = await pool.query(`
    SELECT ah.id, ah.device_id AS deviceId, d.name AS deviceName,
           ah.action, ah.status, ah.user_id AS userId,
           u.username, COALESCE(NULLIF(u.full_name, ''), u.username) AS userName,
           ah.created_at AS createdAt
    FROM action_history ah
    JOIN devices d ON d.id = ah.device_id
    JOIN users u ON u.id = ah.user_id
    ${sql}
    ORDER BY ah.id DESC
    LIMIT ? OFFSET ?
  `, [...params, size, offset]);

  res.json({
    content: rows,
    page,
    size,
    totalElements: Number(total),
    totalPages: Math.ceil(total / size)
  });
});

router.get('/:deviceId/status', async (req, res) => {
  const [[device]] = await pool.query(`
    SELECT d.id AS deviceId, d.status,
      (SELECT created_at FROM action_history
       WHERE device_id = d.id AND status = 'SUCCESS'
       ORDER BY created_at DESC, id DESC LIMIT 1) AS updatedAt
    FROM devices d WHERE d.id = ?
  `, [Number(req.params.deviceId)]);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  res.json(device);
});

router.post('/:deviceId/control', async (req, res) => {
  const result = await publishDeviceCommand({
    deviceId: Number(req.params.deviceId),
    action: req.body.action,
    userId: req.user.id
  });
  res.status(202).json(result);
});

export default router;

import { Router } from 'express';
import { pool } from '../config/db.js';
import { pagination, sqlDate, where } from '../utils/query.js';

const router = Router();
const SENSOR_KEYS = ['temperature', 'humidity', 'light'];

router.get('/latest', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT s.name, sd.value, sd.created_at
    FROM sensors s
    JOIN sensor_data sd ON sd.id = (
      SELECT id FROM sensor_data
      WHERE sensor_id = s.id
      ORDER BY created_at DESC, id DESC LIMIT 1
    )
    WHERE LOWER(s.name) IN ('temperature', 'humidity', 'light')
  `);

  const result = { temperature: null, humidity: null, light: null, time: null };
  rows.forEach(({ name, value, created_at }) => {
    result[name.toLowerCase()] = Number(value);
    if (!result.time || created_at > result.time) result.time = created_at;
  });
  res.json(result);
});

router.get('/chart', async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const [rows] = await pool.query(`
    SELECT name, value, time FROM (
      SELECT LOWER(s.name) AS name, sd.value, sd.created_at AS time,
             ROW_NUMBER() OVER (PARTITION BY sd.sensor_id ORDER BY sd.created_at DESC, sd.id DESC) AS rn
      FROM sensor_data sd
      JOIN sensors s ON s.id = sd.sensor_id
      WHERE LOWER(s.name) IN ('temperature', 'humidity', 'light')
        AND sd.created_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE
    ) recent
    WHERE rn <= ?
    ORDER BY time
  `, [limit]);

  const result = Object.fromEntries(SENSOR_KEYS.map((key) => [key, []]));
  rows.forEach(({ name, value, time }) => result[name].push({ time, value: Number(value) }));
  res.json(result);
});

router.get('/history', async (req, res) => {
  const { page, size, offset } = pagination(req.query);
  const { sql, params } = where([
    ['sd.sensor_id = ?', req.query.sensorId && Number(req.query.sensorId)],
    ['sd.created_at >= ?', sqlDate(req.query.from)],
    ['sd.created_at < ?', sqlDate(req.query.toExclusive)],
    ['sd.value = ?', req.query.value === '' ? undefined : req.query.value]
  ]);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM sensor_data sd ${sql}`, params);
  const [rows] = await pool.query(`
    SELECT sd.id, sd.sensor_id AS sensorId, s.name AS sensorName,
           sd.value, sd.created_at AS createdAt
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    ${sql}
    ORDER BY sd.id DESC
    LIMIT ? OFFSET ?
  `, [...params, size, offset]);

  res.json({
    content: rows.map((row) => ({ ...row, value: Number(row.value) })),
    page,
    size,
    totalElements: Number(total),
    totalPages: Math.ceil(total / size)
  });
});

router.get('/sensors', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM sensors ORDER BY id');
  res.json(rows);
});

export default router;

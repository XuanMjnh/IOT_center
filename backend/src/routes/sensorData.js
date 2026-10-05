import { Router } from 'express';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';
import { positiveInt, zeroBasedPage, sqlDate } from '../utils/query.js';

const router = Router();

const SENSOR_NAME_TO_KEY = {
  temperature: 'temperature',
  humidity: 'humidity',
  light: 'light'
};

router.get('/latest', asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT s.name, sd.value, sd.created_at
    FROM sensors s
    JOIN sensor_data sd ON sd.id = (
      SELECT sd2.id FROM sensor_data sd2
      WHERE sd2.sensor_id = s.id
      ORDER BY sd2.created_at DESC, sd2.id DESC
      LIMIT 1
    )
    WHERE LOWER(s.name) IN ('temperature','humidity','light')
  `);

  const response = { temperature: null, humidity: null, light: null, time: null };
  let latest = null;
  for (const row of rows) {
    const key = SENSOR_NAME_TO_KEY[String(row.name).toLowerCase()];
    if (key) response[key] = Number(row.value);
    if (!latest || String(row.created_at) > String(latest)) latest = row.created_at;
  }
  response.time = latest;
  res.json(response);
}));

router.get('/chart', asyncHandler(async (req, res) => {
  const limit = positiveInt(req.query.limit, 20, 200);
  const response = { temperature: [], humidity: [], light: [] };

  for (const [name, key] of Object.entries(SENSOR_NAME_TO_KEY)) {
    const [rows] = await pool.query(`
      SELECT sd.value, sd.created_at
      FROM sensor_data sd
      JOIN sensors s ON s.id = sd.sensor_id
      WHERE LOWER(s.name) = ?
        AND sd.created_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE
      ORDER BY sd.created_at DESC, sd.id DESC
      LIMIT ?
    `, [name, limit]);
    response[key] = rows.reverse().map((r) => ({ time: r.created_at, value: Number(r.value) }));
  }

  res.json(response);
}));

router.get('/history', asyncHandler(async (req, res) => {
  const page = zeroBasedPage(req.query.page);
  const size = positiveInt(req.query.size, 10, 100);
  const offset = page * size;
  const where = [];
  const params = [];

  if (req.query.sensorId) {
    const sensorId = Number(req.query.sensorId);
    if (!Number.isInteger(sensorId) || sensorId < 1) return res.status(400).json({ message: 'Invalid sensorId' });
    where.push('sd.sensor_id = ?');
    params.push(sensorId);
  }
  if (req.query.from) {
    const from = sqlDate(req.query.from);
    if (!from) return res.status(400).json({ message: 'Invalid from date' });
    where.push('sd.created_at >= ?');
    params.push(from);
  }
  if (req.query.to) {
    const to = sqlDate(req.query.to);
    if (!to) return res.status(400).json({ message: 'Invalid to date' });
    where.push('sd.created_at <= ?');
    params.push(to);
  }
  if (req.query.toExclusive) {
    const toExclusive = sqlDate(req.query.toExclusive);
    if (!toExclusive) return res.status(400).json({ message: 'Invalid exclusive end date' });
    where.push('sd.created_at < ?');
    params.push(toExclusive);
  }
  if (req.query.value !== undefined && req.query.value !== '') {
    const value = Number(req.query.value);
    if (!Number.isFinite(value)) return res.status(400).json({ message: 'Invalid value' });
    where.push('sd.value = ?');
    params.push(value);
  }

  const sortMap = {
    'id,asc': 'sd.id ASC',
    'id,desc': 'sd.id DESC',
    'createdAt,asc': 'sd.created_at ASC, sd.id ASC',
    'createdAt,desc': 'sd.created_at DESC, sd.id DESC',
    'value,asc': 'sd.value ASC, sd.id ASC',
    'value,desc': 'sd.value DESC, sd.id DESC'
  };
  const orderBy = sortMap[String(req.query.sort || 'id,desc')] || sortMap['id,desc'];
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM sensor_data sd ${whereSql}`,
    params
  );
  const [rows] = await pool.query(`
    SELECT sd.id, sd.sensor_id AS sensorId, s.name AS sensorName,
           sd.value, sd.created_at AS createdAt
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...params, size, offset]);

  const totalElements = Number(countRow.total);
  res.json({
    content: rows.map((r) => ({ ...r, value: Number(r.value) })),
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size)
  });
}));

router.get('/sensors', asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM sensors ORDER BY id');
  res.json(rows);
}));

export default router;

import mqtt from 'mqtt';
import { pool } from '../config/db.js';

const SENSOR_TOPIC = 'iot/sensors/data';
const COMMAND_TOPIC = 'iot/devices/command';
const STATUS_TOPIC = 'iot/devices/status';
const COMMAND_TIMEOUT_MS = 5000;

let client;
let io;
let sensorIds;
const timers = new Map();

const mqttUrl = () => `${process.env.MQTT_PROTOCOL || 'mqtt'}://${process.env.MQTT_HOST || '127.0.0.1'}:${process.env.MQTT_PORT || 1883}`;
export const mqttConnected = () => Boolean(client?.connected);

async function getSensorIds() {
  if (!sensorIds) {
    const [rows] = await pool.query('SELECT id, name FROM sensors');
    sensorIds = Object.fromEntries(rows.map(({ id, name }) => [name.toLowerCase(), id]));
  }
  return sensorIds;
}

async function handleSensor(payload) {
  const data = JSON.parse(payload.toString());
  const ids = await getSensorIds();
  const time = new Date();
  const sqlTime = time.toISOString().slice(0, 19).replace('T', ' ');

  await pool.query(
    'INSERT INTO sensor_data (sensor_id, value, created_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
    [
      ids.temperature, data.temperature, sqlTime,
      ids.humidity, data.humidity, sqlTime,
      ids.light, data.light, sqlTime
    ]
  );

  io.emit('sensor:update', { ...data, time: time.toISOString() });
}

async function handleDeviceStatus(payload) {
  const data = JSON.parse(payload.toString());
  const deviceId = Number(data.device);
  const status = String(data.status).toUpperCase();

  await pool.query('UPDATE devices SET status = ? WHERE id = ?', [status, deviceId]);
  const [[pending]] = await pool.query(
    "SELECT id FROM action_history WHERE device_id = ? AND action = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1",
    [deviceId, status]
  );

  if (pending) {
    await pool.query("UPDATE action_history SET status = 'SUCCESS' WHERE id = ?", [pending.id]);
    clearTimeout(timers.get(pending.id));
    timers.delete(pending.id);
  }

  io.emit('device:update', {
    deviceId,
    status,
    actionId: pending?.id || null,
    requestStatus: pending ? 'SUCCESS' : null,
    updatedAt: new Date().toISOString()
  });
}

async function handleMessage(topic, payload) {
  try {
    if (topic === SENSOR_TOPIC) await handleSensor(payload);
    if (topic === STATUS_TOPIC) await handleDeviceStatus(payload);
  } catch (error) {
    console.error('[MQTT] Message error:', error.message);
  }
}

export function startMqtt(socketIo) {
  io = socketIo;
  client = mqtt.connect(mqttUrl(), {
    clientId: process.env.MQTT_CLIENT_ID || `iot-control-center-${process.pid}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 2000
  });

  client.on('connect', () => {
    console.log(`[MQTT] Connected to ${mqttUrl()}`);
    client.subscribe([SENSOR_TOPIC, STATUS_TOPIC]);
  });
  client.on('message', handleMessage);
  client.on('error', (error) => console.error('[MQTT]', error.message));
  return client;
}

export async function publishDeviceCommand({ deviceId, action, userId }) {
  const [result] = await pool.query(
    "INSERT INTO action_history (user_id, device_id, action, status, created_at) VALUES (?, ?, ?, 'PENDING', UTC_TIMESTAMP())",
    [userId, deviceId, action]
  );
  const actionId = result.insertId;

  if (!client?.connected) {
    await pool.query("UPDATE action_history SET status = 'FAILED' WHERE id = ?", [actionId]);
    const error = new Error('MQTT broker is not connected');
    error.status = 503;
    throw error;
  }

  await new Promise((resolve, reject) =>
    client.publish(COMMAND_TOPIC, `${deviceId}:${action}`, (error) => error ? reject(error) : resolve())
  );

  timers.set(actionId, setTimeout(async () => {
    const [result] = await pool.query(
      "UPDATE action_history SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'",
      [actionId]
    );
    timers.delete(actionId);
    if (!result.affectedRows) return;

    const [[device]] = await pool.query('SELECT status FROM devices WHERE id = ?', [deviceId]);
    io.emit('device:update', {
      deviceId,
      status: device?.status || null,
      actionId,
      requestStatus: 'FAILED',
      updatedAt: new Date().toISOString()
    });
  }, COMMAND_TIMEOUT_MS));

  return { id: actionId, status: 'PENDING', timeoutSeconds: 5 };
}

import mqtt from 'mqtt';
import { pool } from '../config/db.js';

const SENSOR_TOPIC = 'iot/sensors/data';
const COMMAND_TOPIC = 'iot/devices/command';
const STATUS_TOPIC = 'iot/devices/status';
const COMMAND_TIMEOUT_MS = 5000;

let client = null;
let ioRef = null;
let sensorIds = null;
const actionTimers = new Map();

function mqttUrl() {
  const protocol = process.env.MQTT_PROTOCOL || 'mqtt';
  const host = process.env.MQTT_HOST || '127.0.0.1';
  const port = Number(process.env.MQTT_PORT || 1883);
  return `${protocol}://${host}:${port}`;
}

export function mqttConnected() {
  return Boolean(client?.connected);
}

async function getSensorIds() {
  if (sensorIds) return sensorIds;
  const [rows] = await pool.query('SELECT id, name FROM sensors');
  sensorIds = Object.fromEntries(rows.map((r) => [String(r.name).toLowerCase(), r.id]));
  return sensorIds;
}

function isValidSensorPayload(data) {
  return data &&
    Number.isFinite(Number(data.temperature)) &&
    Number.isFinite(Number(data.humidity)) &&
    Number.isFinite(Number(data.light));
}

async function handleSensorMessage(payload) {
  let data;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    console.warn('[MQTT] Ignored invalid sensor JSON');
    return;
  }
  if (!isValidSensorPayload(data)) {
    console.warn('[MQTT] Ignored invalid sensor payload:', data);
    return;
  }

  const ids = await getSensorIds();
  const temperatureId = ids.temperature;
  const humidityId = ids.humidity;
  const lightId = ids.light;
  if (!temperatureId || !humidityId || !lightId) {
    console.error('[MQTT] Seed sensors first: Temperature, Humidity, Light');
    sensorIds = null;
    return;
  }

  const time = new Date();
  const sqlTime = time.toISOString().slice(0, 19).replace('T', ' ');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO sensor_data (sensor_id, value, created_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      [
        temperatureId, Number(data.temperature), sqlTime,
        humidityId, Number(data.humidity), sqlTime,
        lightId, Number(data.light), sqlTime
      ]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  ioRef?.emit('sensor:update', {
    temperature: Number(data.temperature),
    humidity: Number(data.humidity),
    light: Number(data.light),
    time: time.toISOString()
  });
}

function clearActionTimer(actionId) {
  const timer = actionTimers.get(Number(actionId));
  if (timer) clearTimeout(timer);
  actionTimers.delete(Number(actionId));
}

async function handleDeviceStatus(payload) {
  let data;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    console.warn('[MQTT] Ignored invalid device status JSON');
    return;
  }

  const deviceId = Number(data.device);
  const status = String(data.status || '').toUpperCase();
  if (!Number.isInteger(deviceId) || !['ON', 'OFF'].includes(status)) {
    console.warn('[MQTT] Ignored invalid device status payload:', data);
    return;
  }

  const conn = await pool.getConnection();
  let actionId = null;
  try {
    await conn.beginTransaction();
    const [deviceRows] = await conn.query('SELECT id FROM devices WHERE id = ? FOR UPDATE', [deviceId]);
    if (!deviceRows.length) {
      await conn.rollback();
      return;
    }

    await conn.query('UPDATE devices SET status = ? WHERE id = ?', [status, deviceId]);
    const [pendingRows] = await conn.query(
      `SELECT id FROM action_history
       WHERE device_id = ? AND action = ? AND status = 'PENDING'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [deviceId, status]
    );
    if (pendingRows.length) {
      actionId = pendingRows[0].id;
      await conn.query("UPDATE action_history SET status = 'SUCCESS' WHERE id = ? AND status = 'PENDING'", [actionId]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  if (actionId) clearActionTimer(actionId);
  ioRef?.emit('device:update', {
    deviceId,
    status,
    actionId,
    requestStatus: actionId ? 'SUCCESS' : null,
    updatedAt: new Date().toISOString()
  });
}

async function onMqttMessage(topic, payload) {
  try {
    if (topic === SENSOR_TOPIC) await handleSensorMessage(payload);
    if (topic === STATUS_TOPIC) await handleDeviceStatus(payload);
  } catch (error) {
    console.error('[MQTT] Message handler error:', error.message);
  }
}

export function startMqtt(io) {
  ioRef = io;
  const options = {
    clientId: process.env.MQTT_CLIENT_ID || `iot-control-center-backend-${process.pid}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    clean: true
  };
  if ((process.env.MQTT_PROTOCOL || 'mqtt') === 'mqtts') {
    options.rejectUnauthorized = String(process.env.MQTT_REJECT_UNAUTHORIZED || 'true') !== 'false';
  }

  client = mqtt.connect(mqttUrl(), options);
  client.on('connect', () => {
    console.log(`[MQTT] Connected to ${mqttUrl()}`);
    client.subscribe([SENSOR_TOPIC, STATUS_TOPIC], { qos: 0 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err.message);
      else console.log(`[MQTT] Subscribed: ${SENSOR_TOPIC}, ${STATUS_TOPIC}`);
    });
  });
  client.on('message', onMqttMessage);
  client.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
  client.on('offline', () => console.warn('[MQTT] Offline'));
  client.on('error', (error) => console.error('[MQTT] Error:', error.message));
  return client;
}

export async function publishDeviceCommand({ deviceId, action, userId }) {
  const [deviceRows] = await pool.query('SELECT id, status FROM devices WHERE id = ?', [deviceId]);
  if (!deviceRows.length) {
    const error = new Error('Device not found');
    error.status = 404;
    throw error;
  }

  const [result] = await pool.query(
    "INSERT INTO action_history (user_id, device_id, action, status, created_at) VALUES (?, ?, ?, 'PENDING', UTC_TIMESTAMP())",
    [userId, deviceId, action]
  );
  const actionId = result.insertId;
  const command = `${deviceId}:${action}`;

  if (!client?.connected) {
    await pool.query("UPDATE action_history SET status = 'FAILED' WHERE id = ?", [actionId]);
    const error = new Error('MQTT broker is not connected');
    error.status = 503;
    throw error;
  }

  try {
    await new Promise((resolve, reject) => {
      client.publish(COMMAND_TOPIC, command, { qos: 0, retain: false }, (err) => err ? reject(err) : resolve());
    });
  } catch (error) {
    await pool.query("UPDATE action_history SET status = 'FAILED' WHERE id = ?", [actionId]);
    error.status = 503;
    throw error;
  }

  const timer = setTimeout(async () => {
    try {
      const [result2] = await pool.query(
        "UPDATE action_history SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'",
        [actionId]
      );
      if (result2.affectedRows) {
        const [rows] = await pool.query('SELECT status FROM devices WHERE id = ?', [deviceId]);
        ioRef?.emit('device:update', {
          deviceId,
          status: rows[0]?.status || null,
          actionId,
          requestStatus: 'FAILED',
          reason: 'TIMEOUT',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[MQTT] Timeout update error:', error.message);
    } finally {
      actionTimers.delete(actionId);
    }
  }, COMMAND_TIMEOUT_MS);
  actionTimers.set(actionId, timer);

  return { id: actionId, status: 'PENDING', timeoutSeconds: COMMAND_TIMEOUT_MS / 1000 };
}

export async function failStalePendingActions() {
  await pool.query(
    "UPDATE action_history SET status = 'FAILED' WHERE status = 'PENDING' AND created_at < (UTC_TIMESTAMP() - INTERVAL 5 SECOND)"
  );
}

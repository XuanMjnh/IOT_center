import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth.js';
import sensorDataRoutes from './routes/sensorData.js';
import deviceRoutes from './routes/devices.js';
import { requireAuth } from './middleware/auth.js';
import { databaseHealthy } from './config/db.js';
import { startMqtt, mqttConnected, failStalePendingActions } from './services/mqttService.js';

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  res.json({ api: true, database: await databaseHealthy(), mqtt: mqttConnected() });
});
app.use('/api/auth', authRoutes);
app.use('/api/sensor-data', requireAuth, sensorDataRoutes);
app.use('/api/devices', requireAuth, deviceRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

io.on('connection', (socket) => {
  socket.emit('system:status', { mqtt: mqttConnected(), connectedAt: new Date().toISOString() });
});

server.listen(PORT, async () => {
  console.log(`[HTTP] API listening on http://localhost:${PORT}`);
  try {
    await failStalePendingActions();
  } catch (error) {
    console.error('[DB] Could not clean stale pending actions:', error.message);
  }
  startMqtt(io);
});

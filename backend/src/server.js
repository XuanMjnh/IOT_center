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
import { startMqtt, mqttConnected } from './services/mqttService.js';

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: FRONTEND_URL } });

app.use(cors({ origin: FRONTEND_URL }), express.json());
app.get('/api/health', async (_req, res) =>
  res.json({ api: true, database: await databaseHealthy(), mqtt: mqttConnected() })
);
app.use('/api/auth', authRoutes);
app.use('/api/sensor-data', requireAuth, sensorDataRoutes);
app.use('/api/devices', requireAuth, deviceRoutes);
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`[HTTP] API listening on http://localhost:${PORT}`);
  startMqtt(io);
});

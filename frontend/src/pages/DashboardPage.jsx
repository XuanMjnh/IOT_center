import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api } from '../api/client.js';
import { socket } from '../api/socket.js';
import MessageBar from '../components/MessageBar.jsx';
import { formatDate, getErrorMessage } from '../utils.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const SENSORS = [
  {
    key: 'temperature', name: 'Temperature', unit: '°C', digits: 1, className: 'temp',
    color: '#0997b7', axisColor: '#0787a4', position: 'left', grace: '10%',
    grid: { color: 'rgba(148, 163, 184, 0.20)' }, tick: (value) => `${value}°`
  },
  {
    key: 'humidity', name: 'Humidity', unit: '%', digits: 0, className: 'humidity',
    color: '#10b981', axisColor: '#059669', position: 'right', grace: '5%',
    grid: { drawOnChartArea: false }, min: 0, max: 100, tick: (value) => `${value}%`
  },
  {
    key: 'light', name: 'Light', unit: 'lux', digits: 0, className: 'light',
    color: '#f59e0b', axisColor: '#d97706', position: 'right', grace: '10%',
    grid: { drawOnChartArea: false }, maxTicksLimit: 6
  }
];
const EMPTY_LATEST = { temperature: null, humidity: null, light: null, time: null };
const EMPTY_CHART = { temperature: [], humidity: [], light: [] };
const DEVICE_ICONS = { 'Quạt': '🌀', 'Đèn': '💡', 'Điều hòa': '❄️' };

const timestamp = (value) => Date.parse(
  String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`
);
const recentPoints = (points = [], now = Date.now()) =>
  points.filter(({ time }) => timestamp(time) >= now - 60000 && timestamp(time) <= now + 5000);

function addPoint(chart, payload) {
  return Object.fromEntries(SENSORS.map(({ key }) => [
    key,
    [...recentPoints(chart[key]), { time: payload.time, value: payload[key] }].slice(-200)
  ]));
}

function makeChart(visible) {
  const base = SENSORS.map(({ key }) => visible[key]).find((points) => points.length) || [];
  const labels = base.map(({ time }) => formatDate(time));

  return {
    data: {
      labels,
      datasets: SENSORS.map(({ key, name, unit, color }) => ({
        label: `${name} (${unit})`,
        data: visible[key].map(({ value }) => Number(value)),
        yAxisID: key,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 22, padding: 16, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#111827',
          padding: 10,
          displayColors: true,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label.split(' (')[0]}: ${ctx.parsed.y ?? '—'} ${SENSORS.find((s) => s.key === ctx.dataset.yAxisID).unit}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: '#cbd5e1' },
          ticks: {
            color: '#64748b',
            font: { size: 9 },
            maxTicksLimit: 6,
            maxRotation: 0,
            callback: (value) => labels[value]?.slice(11) || ''
          }
        },
        ...Object.fromEntries(SENSORS.map((sensor) => [sensor.key, {
          type: 'linear',
          position: sensor.position,
          grace: sensor.grace,
          suggestedMin: sensor.min,
          suggestedMax: sensor.max,
          border: { color: sensor.color },
          grid: sensor.grid,
          title: {
            display: true,
            text: `${sensor.name} (${sensor.unit})`,
            color: sensor.axisColor,
            font: { size: 10, weight: 'bold' }
          },
          ticks: {
            color: sensor.axisColor,
            font: { size: 9 },
            callback: sensor.tick,
            maxTicksLimit: sensor.maxTicksLimit
          }
        }]))
      }
    }
  };
}

export default function DashboardPage() {
  const [latest, setLatest] = useState(EMPTY_LATEST);
  const [chart, setChart] = useState(EMPTY_CHART);
  const [devices, setDevices] = useState([]);
  const [pending, setPending] = useState({});
  const [message, setMessage] = useState(null);
  const [socketOnline, setSocketOnline] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    Promise.all([
      api.get('/sensor-data/latest'),
      api.get('/sensor-data/chart?limit=200'),
      api.get('/devices')
    ]).then(([latestRes, chartRes, devicesRes]) => {
      setLatest(latestRes.data);
      setChart(chartRes.data);
      setDevices(devicesRes.data);
    }).catch((error) => setMessage({
      type: 'error',
      text: getErrorMessage(error, 'Cannot load dashboard data.')
    }));

    socket
      .on('connect', () => setSocketOnline(true))
      .on('disconnect', () => setSocketOnline(false))
      .on('sensor:update', (payload) => {
        setLatest(payload);
        setChart((current) => addPoint(current, payload));
      })
      .on('device:update', (payload) => {
        setDevices((current) => current.map((device) =>
          device.id === Number(payload.deviceId) ? { ...device, status: payload.status || device.status } : device
        ));
        setPending((current) => ({ ...current, [payload.deviceId]: false }));
        if (payload.requestStatus === 'FAILED') {
          setMessage({ type: 'error', text: `Device ${payload.deviceId}: command timeout after 5 seconds.` });
        }
        if (payload.requestStatus === 'SUCCESS') {
          setMessage({ type: 'success', text: `Device ${payload.deviceId} is now ${payload.status}.` });
        }
      });

    socket.connect();
    setSocketOnline(socket.connected);
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearInterval(timer);
      ['connect', 'disconnect', 'sensor:update', 'device:update'].forEach((event) => socket.off(event));
      socket.disconnect();
    };
  }, []);

  const control = async (deviceId, action) => {
    setPending((current) => ({ ...current, [deviceId]: true }));
    setMessage(null);
    try {
      await api.post(`/devices/${deviceId}/control`, { action });
      setMessage({ type: 'info', text: `Device ${deviceId}: ${action} command sent. Waiting for ESP8266 confirmation...` });
    } catch (error) {
      setPending((current) => ({ ...current, [deviceId]: false }));
      setMessage({ type: 'error', text: getErrorMessage(error, 'Cannot send device command.') });
    }
  };

  const visible = Object.fromEntries(SENSORS.map(({ key }) => [key, recentPoints(chart[key], now)]));
  const graph = makeChart(visible);
  const readings = SENSORS.map(({ key, name, unit, digits, className }) => [
    name,
    latest[key] == null ? '—' : `${Number(latest[key]).toFixed(digits)} ${unit}`,
    className
  ]);

  return (
    <>
      <MessageBar message={message?.text} type={message?.type} onClose={() => setMessage(null)} />
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            REAL-TIME SENSOR TREND
            <span className="chart-status">
              <span className="chart-window">LAST 60 SECONDS</span>
              <span className={`socket-state ${socketOnline ? 'on' : ''}`}>{socketOnline ? 'LIVE' : 'RECONNECTING'}</span>
            </span>
          </div>
          <div className="chart-wrap"><Line data={graph.data} options={graph.options} /></div>
        </section>

        <section className="panel values-panel">
          <div className="panel-title">CURRENT SENSOR VALUES</div>
          <div className="readings">
            {readings.map(([name, value, className]) => (
              <div className="reading" key={name}>
                <div className={`reading-name ${className}`}>{name}</div>
                <div className="reading-value">{value}</div>
                <div className="reading-meta">Updated {latest.time ? formatDate(latest.time) : '—'} <span className="reading-dot" /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel device-panel">
        <div className="panel-title">DEVICE CONTROL</div>
        <div className="device-grid">
          {devices.map((device) => {
            const waiting = Boolean(pending[device.id]);
            return (
              <div className="device-card" key={device.id}>
                <div className="device-card-top">
                  <strong>{device.name} {DEVICE_ICONS[device.name] || ''}</strong>
                  <span className={`mini-state ${waiting ? 'pending' : device.status.toLowerCase()}`}>
                    <span className="dot" /> {waiting ? 'PENDING' : device.status}
                  </span>
                </div>

                <div className="device-buttons">
                  <button
                    disabled={waiting}
                    className={device.status === 'ON' && !waiting ? 'on active' : ''}
                    onClick={() => control(device.id, 'ON')}
                  >
                    ON
                  </button>
                  <button
                    disabled={waiting}
                    className={device.status === 'OFF' && !waiting ? 'off active' : ''}
                    onClick={() => control(device.id, 'OFF')}
                  >
                    OFF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

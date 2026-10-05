import { useEffect, useMemo, useState } from 'react';
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

const emptyLatest = { temperature: null, humidity: null, light: null, time: null };
const emptyChart = { temperature: [], humidity: [], light: [] };
const CHART_WINDOW_MS = 60 * 1000;

function pointTimestamp(value) {
  const text = String(value || '');
  return Date.parse(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
}

function recentPoints(points, now = Date.now()) {
  const cutoff = now - CHART_WINDOW_MS;
  return (points || []).filter((point) => {
    const time = pointTimestamp(point.time);
    return Number.isFinite(time) && time >= cutoff && time <= now + 5000;
  });
}

function upsertPoint(chart, payload) {
  const pairs = [
    ['temperature', payload.temperature],
    ['humidity', payload.humidity],
    ['light', payload.light]
  ];
  const next = { ...chart };
  for (const [key, value] of pairs) {
    const arr = [...recentPoints(chart[key]), { time: payload.time, value }];
    next[key] = arr.slice(-200);
  }
  return next;
}

export default function DashboardPage() {
  const [latest, setLatest] = useState(emptyLatest);
  const [chart, setChart] = useState(emptyChart);
  const [devices, setDevices] = useState([]);
  const [pending, setPending] = useState({});
  const [message, setMessage] = useState(null);
  const [socketOnline, setSocketOnline] = useState(false);
  const [chartNow, setChartNow] = useState(Date.now());

  const load = async () => {
    const [latestRes, chartRes, devicesRes] = await Promise.all([
      api.get('/sensor-data/latest'),
      api.get('/sensor-data/chart?limit=200'),
      api.get('/devices')
    ]);
    setLatest(latestRes.data);
    setChart(chartRes.data);
    setDevices(devicesRes.data);
  };

  useEffect(() => {
    load().catch((error) => setMessage({ type: 'error', text: getErrorMessage(error, 'Cannot load dashboard data.') }));

    const onConnect = () => setSocketOnline(true);
    const onDisconnect = () => setSocketOnline(false);
    const onSensor = (payload) => {
      setLatest(payload);
      setChart((old) => upsertPoint(old, payload));
    };
    const onDevice = (payload) => {
      setDevices((old) => old.map((d) => d.id === Number(payload.deviceId) && payload.status ? { ...d, status: payload.status } : d));
      setPending((old) => ({ ...old, [payload.deviceId]: false }));
      if (payload.requestStatus === 'FAILED') {
        setMessage({ type: 'error', text: `Device ${payload.deviceId}: command timeout after 5 seconds.` });
      } else if (payload.requestStatus === 'SUCCESS') {
        setMessage({ type: 'success', text: `Device ${payload.deviceId} is now ${payload.status}.` });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('sensor:update', onSensor);
    socket.on('device:update', onDevice);
    socket.connect();
    if (socket.connected) setSocketOnline(true);
    const chartClock = setInterval(() => setChartNow(Date.now()), 5000);

    return () => {
      clearInterval(chartClock);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sensor:update', onSensor);
      socket.off('device:update', onDevice);
      socket.disconnect();
    };
  }, []);

  const doControl = async (deviceId, action) => {
    if (pending[deviceId]) return;
    setPending((old) => ({ ...old, [deviceId]: true }));
    setMessage(null);
    try {
      await api.post(`/devices/${deviceId}/control`, { action });
      setMessage({ type: 'info', text: `Device ${deviceId}: ${action} command sent. Waiting for ESP8266 confirmation...` });
    } catch (error) {
      setPending((old) => ({ ...old, [deviceId]: false }));
      setMessage({ type: 'error', text: getErrorMessage(error, 'Cannot send device command.') });
    }
  };

  const recentChart = useMemo(() => ({
    temperature: recentPoints(chart.temperature, chartNow),
    humidity: recentPoints(chart.humidity, chartNow),
    light: recentPoints(chart.light, chartNow)
  }), [chart, chartNow]);

  const labels = useMemo(() => {
    const base = recentChart.temperature.length
      ? recentChart.temperature
      : (recentChart.humidity.length ? recentChart.humidity : recentChart.light);
    return base.map((p) => formatDate(p.time));
  }, [recentChart]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: recentChart.temperature.map((p) => Number(p.value)),
        yAxisID: 'temperature',
        borderColor: '#0997b7',
        backgroundColor: '#0997b7',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25
      },
      {
        label: 'Humidity (%)',
        data: recentChart.humidity.map((p) => Number(p.value)),
        yAxisID: 'humidity',
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25
      },
      {
        label: 'Light (lux)',
        data: recentChart.light.map((p) => Number(p.value)),
        yAxisID: 'light',
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25
      }
    ]
  }), [labels, recentChart]);

  const chartOptions = useMemo(() => ({
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
          label(ctx) {
            const unit = ctx.dataset.yAxisID === 'temperature' ? ' °C' : ctx.dataset.yAxisID === 'humidity' ? ' %' : ' lux';
            const value = ctx.parsed.y;
            return `${ctx.dataset.label.split(' (')[0]}: ${Number.isFinite(value) ? value : '—'}${unit}`;
          }
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
          callback(value) {
            return labels[value]?.slice(11) || '';
          }
        }
      },
      temperature: {
        type: 'linear',
        position: 'left',
        grace: '10%',
        border: { color: '#0997b7' },
        grid: { color: 'rgba(148, 163, 184, 0.20)' },
        title: { display: true, text: 'Temperature (°C)', color: '#0787a4', font: { size: 10, weight: 'bold' } },
        ticks: { color: '#0787a4', font: { size: 9 }, callback: (value) => `${value}°` }
      },
      humidity: {
        type: 'linear',
        position: 'right',
        suggestedMin: 0,
        suggestedMax: 100,
        grace: '5%',
        border: { color: '#10b981' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Humidity (%)', color: '#059669', font: { size: 10, weight: 'bold' } },
        ticks: { color: '#059669', font: { size: 9 }, callback: (value) => `${value}%` }
      },
      light: {
        type: 'linear',
        position: 'right',
        grace: '10%',
        border: { color: '#f59e0b' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Light (lux)', color: '#d97706', font: { size: 10, weight: 'bold' } },
        ticks: { color: '#d97706', font: { size: 9 }, maxTicksLimit: 6 }
      }
    }
  }), [labels]);

  const readings = [
    ['Temperature', latest.temperature == null ? '—' : `${Number(latest.temperature).toFixed(1)} °C`, 'temp'],
    ['Humidity', latest.humidity == null ? '—' : `${Number(latest.humidity).toFixed(0)} %`, 'humidity'],
    ['Light', latest.light == null ? '—' : `${Number(latest.light).toFixed(0)} lux`, 'light']
  ];

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
          <div className="chart-wrap"><Line data={chartData} options={chartOptions} /></div>
        </section>

        <section className="panel values-panel">
          <div className="panel-title">CURRENT SENSOR VALUES</div>
          <div className="readings">
            {readings.map(([name, value, klass]) => (
              <div className="reading" key={name}>
                <div className={`reading-name ${klass}`}>{name}</div>
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
                <strong>
                  {device.name} {device.name === 'Quạt' ? '🌀' : device.name === 'Đèn' ? '💡' : device.name === 'Điều hòa' ? '❄️' : ''}
                </strong>

                <span className={`mini-state ${waiting ? 'pending' : device.status.toLowerCase()}`}>
                  <span className="dot" /> {waiting ? 'PENDING' : device.status}
                </span>
              </div>

              <div className="device-buttons">
                <button
                  disabled={waiting}
                  className={device.status === 'ON' && !waiting ? 'on active' : ''}
                  onClick={() => doControl(device.id, 'ON')}
                >
                  ON
                </button>

                <button
                  disabled={waiting}
                  className={device.status === 'OFF' && !waiting ? 'off active' : ''}
                  onClick={() => doControl(device.id, 'OFF')}
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

import { Cpu, LogOut } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const TITLES = {
  '/': 'SYSTEM DASHBOARD',
  '/sensor-data': 'SENSOR DATA',
  '/device-history': 'DEVICE HISTORY',
  '/profile': 'PROFILE'
};
const OFFLINE = { api: false, database: false, mqtt: false };

export default function Layout() {
  const { pathname } = useLocation();
  const { auth, logout } = useAuth();
  const [health, setHealth] = useState(OFFLINE);

  useEffect(() => {
    const check = () => api.get('/health').then(({ data }) => setHealth(data)).catch(() => setHealth(OFFLINE));
    check();
    const timer = setInterval(check, 10000);
    return () => clearInterval(timer);
  }, []);

  const online = health.api && health.database && health.mqtt;
  const displayName = auth?.username?.toLowerCase() === 'admin'
    ? 'Phạm Xuân Minh'
    : auth?.fullName || auth?.username || 'Phạm Xuân Minh';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Cpu size={17} strokeWidth={2.2} /></div>
          <span>IOT CONTROL CENTER</span>
        </div>
        <nav className="topnav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/sensor-data">Sensor Data</NavLink>
          <NavLink to="/device-history">Device History</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="topbar-right">
          <span className={`system-pill ${online ? 'online' : 'offline'}`}>
            <span className="dot" /> {online ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
          </span>
          <img className="avatar" src="/avt.jpg" alt={`${displayName} avatar`} />
          <span className="user-label">{displayName}</span>
          <button className="logout-btn" onClick={logout} title="Logout"><LogOut size={16} /></button>
        </div>
      </header>

      <section className="page-heading">
        <h1>{TITLES[pathname] || TITLES['/']}</h1>
        {pathname === '/' && (
          <span className={`live-badge ${online ? '' : 'offline'}`}>
            <span className="dot" /> LIVE DATA <span className="tiny-dot" /> {online ? 'ONLINE' : 'OFFLINE'}
          </span>
        )}
      </section>

      <main className="page-content"><Outlet /></main>
    </div>
  );
}

import { Cpu, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../utils.js';

export default function LoginPage() {
  const { auth, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (auth?.token) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(form.username.trim(), form.password);
      navigate('/', { replace: true });
    } catch (error) {
      setError(getErrorMessage(error, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon"><Cpu size={27} strokeWidth={1.8} /></div>
        <h1>SYSTEM ACCESS</h1>
        <p>Environmental Monitoring &amp; Device Control</p>

        <label>USERNAME</label>
        <input
          type="text"
          placeholder="Enter your username"
          autoComplete="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />

        <label>PASSWORD</label>
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" disabled={loading}>{loading ? 'CONNECTING...' : 'LOGIN'}</button>
      </form>
    </div>
  );
}

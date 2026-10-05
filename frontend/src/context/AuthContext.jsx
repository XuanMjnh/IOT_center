import { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem('iot-auth') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth);

  const value = useMemo(() => ({
    auth,
    async login(username, password) {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('iot-auth', JSON.stringify(data));
      setAuth(data);
      return data;
    },
    logout() {
      localStorage.removeItem('iot-auth');
      setAuth(null);
    }
  }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

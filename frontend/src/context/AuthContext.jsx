import { createContext, useContext, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('iot-auth') || 'null'));

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('iot-auth', JSON.stringify(data));
    setAuth(data);
  };

  const logout = () => {
    localStorage.removeItem('iot-auth');
    setAuth(null);
  };

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

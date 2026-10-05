import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000
});

api.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem('iot-auth') || 'null');
    if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`;
  } catch {
    // Ignore broken localStorage data.
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
      localStorage.removeItem('iot-auth');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

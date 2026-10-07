import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = JSON.parse(localStorage.getItem('iot-auth') || 'null')?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('iot-auth');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

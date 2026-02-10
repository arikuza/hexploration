import axios from 'axios';

// In production (when NODE_ENV is production and no VITE_API_URL is set), use relative paths
// In development, use localhost
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3050');
const API_URL = API_BASE ? `${API_BASE}/api` : '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавить токен к запросам
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      return Promise.reject(error);
    } else if (error.request) {
      return Promise.reject(new Error('Сервер не отвечает'));
    } else {
      return Promise.reject(error);
    }
  }
);

/**
 * Сервис аутентификации
 */
export const authService = {
  async login(credentials: { username: string; password: string }) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async register(credentials: { username: string; password: string }) {
    const response = await api.post('/auth/register', credentials);
    return response.data;
  },

  async verify(token: string) {
    const response = await api.get('/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

/**
 * Сервис игры
 */
export const gameService = {
  async getState() {
    const response = await api.get('/game/state');
    return response.data;
  },

  async getPlayers() {
    const response = await api.get('/game/players');
    return response.data;
  },
};

export default api;

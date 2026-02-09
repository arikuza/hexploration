import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3050';
const API_URL = `${API_BASE}/api`;

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

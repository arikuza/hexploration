import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authRouter } from './routes/auth.js';
import { gameRouter } from './routes/game.js';
import { setupGameSocket } from './socket/gameSocket.js';
import { connectDatabase } from './database/connection.js';
import { gameWorld } from './game/GameWorld.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS origins - поддержка локальной разработки и продакшн
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.CLIENT_URL || 'https://hexploration.vercel.app']
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

const PORT = process.env.PORT || 3050;

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/game', gameRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Сервить статические файлы клиента в продакшн
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  // Для всех остальных маршрутов отдавать index.html (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Запуск сервера
async function startServer() {
  try {
    // 1. Подключиться к MongoDB
    await connectDatabase();

    // 2. Инициализировать игровой мир (загрузить из БД или создать новый)
    await gameWorld.initialize();

    // 3. Настроить Socket.io
    setupGameSocket(io);

    // 4. Запустить HTTP сервер
    httpServer.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();

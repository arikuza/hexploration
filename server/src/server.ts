import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';
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

// Временный endpoint для очистки базы данных (только для продакшн, с секретным ключом)
app.post('/api/admin/reset-db', async (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.status(403).json({ error: 'Доступно только в продакшн' });
  }
  
  const secret = req.body.secret;
  if (secret !== process.env.RESET_DB_SECRET || !process.env.RESET_DB_SECRET) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }
  
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      return res.status(500).json({ error: 'База данных не подключена' });
    }
    
    const collections = await db.listCollections().toArray();
    const results: string[] = [];
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      await db.collection(collection.name).deleteMany({});
      await db.collection(collection.name).drop().catch(() => {});
      results.push(`${collection.name}: ${count} документов удалено`);
    }
    
    await db.dropDatabase().catch(() => {});
    
    res.json({ 
      success: true, 
      message: 'База данных очищена',
      collections: results 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Сервить статические файлы клиента, если есть сборка (продакшн или локальный тест билда)
const clientBuildPath = path.join(__dirname, '../../client/dist');
if (existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
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

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../database/models/User.js';

const router = Router();

/**
 * Регистрация
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Требуются username и password' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username должен быть от 3 до 20 символов' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    // Проверка, что username не занят
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username уже занят' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Создать пользователя в БД
    const user = new User({
      userId,
      username,
      passwordHash: hashedPassword,
    });
    await user.save();

    // Создание JWT токена
    const token = jwt.sign(
      { userId, username },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        username,
      },
    });
  } catch (error: any) {
    console.error('Ошибка регистрации:', error);
    const message = error?.message?.includes('Mongo') 
      ? 'Ошибка подключения к базе данных'
      : 'Ошибка сервера';
    res.status(500).json({ error: message });
  }
});

/**
 * Вход
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Требуются username и password' });
    }

    // Поиск пользователя в БД
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Неверные credentials' });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные credentials' });
    }

    // Обновить время последнего входа
    user.lastLogin = new Date();
    await user.save();

    // Создание JWT токена
    const token = jwt.sign(
      { userId: user.userId, username: user.username },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.userId,
        username: user.username,
      },
    });
  } catch (error: any) {
    console.error('Ошибка входа:', error);
    const message = error?.message?.includes('Mongo')
      ? 'Ошибка подключения к базе данных'
      : 'Ошибка сервера';
    res.status(500).json({ error: message });
  }
});

/**
 * Проверка токена
 */
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      userId: string;
      username: string;
    };

    res.json({
      valid: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
      },
    });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Недействительный токен' });
  }
});

export { router as authRouter };

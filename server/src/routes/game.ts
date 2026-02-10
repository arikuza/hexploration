import { Router } from 'express';
import { gameWorld } from '../game/GameWorld.js';
import { PlayerData } from '../database/models/PlayerData.js';

const router = Router();

/**
 * Получить текущее состояние игры
 */
router.get('/state', (req, res) => {
  try {
    const state = gameWorld.getState();
    
    res.json({
      map: {
        radius: state.map.radius,
        cells: Array.from(state.map.cells.entries()).map(([key, cell]) => ({
          key,
          ...cell,
        })),
      },
      players: Array.from(state.players.entries()).map(([key, player]) => ({
        key,
        ...player,
      })),
      phase: state.phase,
    });
  } catch (error) {
    console.error('Ошибка получения состояния игры:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * Получить список онлайн игроков
 */
router.get('/players', (req, res) => {
  try {
    const players = gameWorld.getOnlinePlayers();
    res.json(players);
  } catch (error) {
    console.error('Ошибка получения списка игроков:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * Проверить данные игрока в БД (для отладки)
 */
router.get('/debug/player/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const doc = await PlayerData.findOne({ userId }).lean();
    if (!doc) {
      return res.json({ found: false, userId });
    }
    res.json({
      found: true,
      userId: doc.userId,
      username: doc.username,
      position: doc.position,
      skills: doc.skills,
      lastPlayed: doc.lastPlayed,
    });
  } catch (error) {
    console.error('Ошибка проверки данных игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * Тест сохранения (для отладки)
 */
router.post('/debug/test-save', async (req, res) => {
  try {
    const testData = {
      userId: 'test-' + Date.now(),
      username: 'testuser',
      position: { q: 5, r: 5 },
      ship: { id: 'test', name: 'Test Ship', type: 'frigate' },
      resources: 100,
      experience: 0,
      level: 1,
      skills: { totalSp: 0, levels: {}, queue: [], currentTraining: null },
    };
    
    const result = await PlayerData.findOneAndUpdate(
      { userId: testData.userId },
      { $set: testData },
      { upsert: true, new: true }
    );
    
    const verify = await PlayerData.findOne({ userId: testData.userId }).lean();
    
    res.json({
      saved: !!result,
      verified: !!verify,
      testUserId: testData.userId,
      count: await PlayerData.countDocuments({}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export { router as gameRouter };

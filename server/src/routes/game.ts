import { Router } from 'express';
import { gameWorld } from '../game/GameWorld';

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
      currentTurn: state.currentTurn,
      turnNumber: state.turnNumber,
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

export { router as gameRouter };

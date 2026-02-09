import {
  GameState,
  GamePhase,
  Player,
  Ship,
  ShipType,
  HexCoordinates,
} from '@hexploration/shared';
import { MAP_RADIUS, SHIP_STATS, MOVE_COOLDOWN, hexDistance, DEFAULT_WEAPONS } from '@hexploration/shared';
import { HexMapManager } from './HexMap.js';
import { CombatSystem } from './CombatSystem.js';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';

class GameWorld {
  private state: GameState;
  private hexMap: HexMapManager;
  private combatSystem: CombatSystem;
  private timerInterval: NodeJS.Timeout | null = null;
  private io: Server | null = null;

  constructor() {
    this.hexMap = new HexMapManager(MAP_RADIUS);
    this.combatSystem = new CombatSystem();

    this.state = {
      id: uuidv4(),
      map: this.hexMap.getMap(),
      players: new Map(),
      phase: GamePhase.LOBBY,
    };

    this.startTimerUpdates();
  }

  /**
   * Запустить обновление таймеров игроков
   */
  private startTimerUpdates(): void {
    this.timerInterval = setInterval(() => {
      this.updatePlayerTimers();
    }, 100); // Обновлять каждые 100ms
  }

  /**
   * Обновить таймеры всех игроков
   */
  private updatePlayerTimers(): void {
    const now = Date.now();
    this.state.players.forEach((player) => {
      if (player.moveTimer > now) {
        // Таймер еще не истек
        player.canMove = false;
      } else if (player.moveTimer > 0) {
        // Таймер истек
        console.log(`⏰ Таймер истек для ${player.username}: обнуляем moveTimer, устанавливаем canMove=true`);
        player.moveTimer = 0;
        player.canMove = true;
        
        // Отправить обновление всем клиентам
        if (this.io) {
          this.io.emit('game:update', {
            type: 'timer_expired',
            playerId: player.id,
            moveTimer: 0,
            canMove: true,
          });
        }
      }
    });
  }

  /**
   * Добавить игрока в игру
   */
  addPlayer(userId: string, username: string): Player {
    // Создать корабль для игрока
    const ship: Ship = this.createDefaultShip();

    // Стартовая позиция - немного разнести игроков
    const playerCount = this.state.players.size;
    const startPosition: HexCoordinates = this.getStartPosition(playerCount);

    const player: Player = {
      id: userId,
      username,
      position: startPosition,
      ship,
      resources: 100,
      experience: 0,
      level: 1,
      online: true,
      moveTimer: 0,        // Может двигаться сразу
      canMove: true,
    };

    this.state.players.set(userId, player);

    // Если первый игрок, начать игру
    if (this.state.players.size === 1) {
      this.state.phase = GamePhase.EXPLORATION;
    }

    return player;
  }

  /**
   * Получить стартовую позицию для игрока
   */
  private getStartPosition(playerIndex: number): HexCoordinates {
    const positions = [
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      { q: -2, r: 0 },
      { q: 0, r: 2 },
      { q: 0, r: -2 },
      { q: 1, r: 1 },
    ];
    return positions[playerIndex % positions.length];
  }

  /**
   * Создать базовый корабль
   */
  private createDefaultShip(): Ship {
    const stats = SHIP_STATS.scout;
    return {
      id: uuidv4(),
      name: 'Разведчик',
      type: ShipType.SCOUT,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      energy: stats.maxEnergy,
      maxEnergy: stats.maxEnergy,
      speed: stats.speed,
      turnRate: stats.turnRate,
      weapons: DEFAULT_WEAPONS,
    };
  }

  /**
   * Удалить игрока
   */
  removePlayer(userId: string): void {
    const player = this.state.players.get(userId);
    if (player) {
      this.state.players.delete(userId);
    }
  }

  /**
   * Переместить игрока
   */
  movePlayer(playerId: string, targetPosition: HexCoordinates): boolean {
    const player = this.state.players.get(playerId);
    if (!player) return false;

    // Проверить, что игрок может двигаться (таймер истек)
    const now = Date.now();
    if (!player.canMove || player.moveTimer > now) {
      const remaining = Math.max(0, player.moveTimer - now);
      console.log(`❌ Движение отклонено для ${player.username}: canMove=${player.canMove}, remaining=${remaining}ms`);
      return false;
    }
    
    console.log(`✅ Движение разрешено для ${player.username}`);

    // Проверить расстояние (только на соседние гексы)
    const distance = hexDistance(player.position, targetPosition);
    if (distance !== 1) return false;

    // Проверить, что целевой гекс существует
    const targetCell = this.hexMap.getCell(targetPosition);
    if (!targetCell) return false;

    // Переместить (несколько игроков могут быть в одном гексе)
    player.position = targetPosition;
    this.hexMap.discoverCell(targetPosition, playerId);

    // Установить таймер для следующего хода
    player.moveTimer = Date.now() + MOVE_COOLDOWN;
    player.canMove = false;
    
    console.log(`🚀 Игрок ${player.username} переместился. Новый moveTimer=${player.moveTimer}, MOVE_COOLDOWN=${MOVE_COOLDOWN}ms`);

    return true;
  }

  /**
   * Получить состояние игры
   */
  getState(): GameState {
    return {
      ...this.state,
      map: this.hexMap.getMap(),
    };
  }

  /**
   * Получить онлайн игроков
   */
  getOnlinePlayers(): Player[] {
    return Array.from(this.state.players.values()).filter(p => p.online);
  }

  /**
   * Получить игрока по ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.state.players.get(playerId);
  }

  /**
   * Установить Socket.IO сервер для отправки обновлений
   */
  setIo(io: Server): void {
    this.io = io;
  }

  /**
   * Получить систему боя
   */
  getCombatSystem(): CombatSystem {
    return this.combatSystem;
  }
}

// Singleton
export const gameWorld = new GameWorld();

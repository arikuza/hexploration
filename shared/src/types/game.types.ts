import { Player } from './player.types.js';
import { HexMap } from './hex.types.js';

/**
 * Состояние игры
 */
export interface GameState {
  id: string;
  map: HexMap;
  players: Map<string, Player>;
  phase: GamePhase;
}

/**
 * Фазы игры
 */
export enum GamePhase {
  LOBBY = 'lobby',           // Лобби (ожидание игроков)
  EXPLORATION = 'exploration', // Исследование карты
  COMBAT = 'combat',         // Боевая фаза
  ENDED = 'ended',           // Игра завершена
}

/**
 * Состояние боя
 */
export interface CombatState {
  id: string;
  participants: string[];    // ID игроков в бою
  ships: CombatShip[];
  projectiles: Projectile[];
  arena: CombatArena;
  startTime: number;
  duration: number;
}

/**
 * Корабль в бою
 */
export interface CombatShip {
  playerId: string;
  position: Vector2D;
  velocity: Vector2D;
  rotation: number;          // Радианы
  angularVelocity: number;
  health: number;
  energy: number;
  weaponCooldowns: Map<string, number>;
}

/**
 * Снаряд
 */
export interface Projectile {
  id: string;
  weaponId: string;
  ownerId: string;
  position: Vector2D;
  velocity: Vector2D;
  damage: number;
  lifetime: number;
}

/**
 * Арена боя
 */
export interface CombatArena {
  width: number;
  height: number;
  boundaries: 'wrap' | 'bounce'; // Поведение на границах
}

/**
 * 2D вектор
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Действия бота в бою
 */
export interface BotActions {
  thrust: number;
  turn: number;
  fire: boolean;
  weaponId?: string;
}

/**
 * События Socket.io
 */
export enum SocketEvent {
  // Подключение
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  
  // Аутентификация
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth:success',
  AUTH_ERROR = 'auth:error',
  
  // Игра
  GAME_STATE = 'game:state',
  GAME_UPDATE = 'game:update',
  
  // Ходы
  MOVE = 'move',
  MOVE_SUCCESS = 'move:success',
  MOVE_ERROR = 'move:error',
  
  // Бой
  COMBAT_START = 'combat:start',
  COMBAT_UPDATE = 'combat:update',
  COMBAT_END = 'combat:end',
  COMBAT_ACTION = 'combat:action',
  
  // Игроки
  PLAYER_JOIN = 'player:join',
  PLAYER_LEAVE = 'player:leave',
  PLAYERS_LIST = 'players:list',
  
  // Колонизация
  COLONIZE = 'colonize',
  COLONIZE_SUCCESS = 'colonize:success',
  COLONIZE_ERROR = 'colonize:error',
  
  // Развитие колонии
  DEVELOP_COLONY = 'develop:colony',
  DEVELOP_SUCCESS = 'develop:success',
  DEVELOP_ERROR = 'develop:error',
  
  // Планетарные системы
  SYSTEM_GET = 'system:get',
  SYSTEM_DATA = 'system:data',
  SYSTEM_ERROR = 'system:error',
  
  // Структуры
  SYSTEM_BUILD_STRUCTURE = 'system:build_structure',
  SYSTEM_BUILD_SUCCESS = 'system:build:success',
  SYSTEM_BUILD_ERROR = 'system:build:error',
  
  SYSTEM_COLLECT_RESOURCES = 'system:collect_resources',
  SYSTEM_COLLECT_SUCCESS = 'system:collect:success',
  SYSTEM_COLLECT_ERROR = 'system:collect:error',

  // Навыки (Eve-like)
  SKILLS_GET = 'skills:get',
  SKILLS_DATA = 'skills:data',
  SKILLS_QUEUE_SET = 'skills:queue:set',
  SKILLS_ERROR = 'skills:error',
}

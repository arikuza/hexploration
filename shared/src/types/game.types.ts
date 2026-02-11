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
  /** Гекс, в котором идёт бой (для invasion, mining) */
  hexKey?: string;
  /** Тип боя: pvp, bot, invasion, mining */
  combatType?: string;
  /** ID вторжения (если тип invasion) */
  invasionId?: string;
  /** Можно ли присоединиться к бою */
  joinable?: boolean;
  /** Максимум участников (для invasion) */
  maxParticipants?: number;
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
  /** Персональные характеристики (от participant.ship с учётом навыков) */
  maxSpeed?: number;
  turnRate?: number;
  maxHealth?: number;
  maxEnergy?: number;
  acceleration?: number;
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
  COMBAT_LIST_ACTIVE = 'combat:list_active',
  COMBAT_LIST_ACTIVE_DATA = 'combat:list_active:data',
  COMBAT_JOIN = 'combat:join',
  COMBAT_JOIN_SUCCESS = 'combat:join:success',
  COMBAT_JOIN_ERROR = 'combat:join:error',
  
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
  
  // Станции
  STATION_OPEN = 'station:open',
  STATION_DATA = 'station:data',
  STATION_STORAGE_GET = 'station:storage:get',
  STATION_STORAGE_DATA = 'station:storage:data',
  STATION_CARGO_TRANSFER = 'station:cargo:transfer',
  STATION_CARGO_TRANSFER_SUCCESS = 'station:cargo:transfer:success',
  STATION_CARGO_TRANSFER_ERROR = 'station:cargo:transfer:error',
  STATION_SHIP_STORE = 'station:ship:store',
  STATION_SHIP_STORE_SUCCESS = 'station:ship:store:success',
  STATION_SHIP_STORE_ERROR = 'station:ship:store:error',
  STATION_SHIP_RETRIEVE = 'station:ship:retrieve',
  STATION_SHIP_RETRIEVE_SUCCESS = 'station:ship:retrieve:success',
  STATION_SHIP_RETRIEVE_ERROR = 'station:ship:retrieve:error',
  STATION_WALLET_DEPOSIT = 'station:wallet:deposit',
  STATION_WALLET_WITHDRAW = 'station:wallet:withdraw',
  STATION_WALLET_SUCCESS = 'station:wallet:success',
  STATION_WALLET_ERROR = 'station:wallet:error',
  
  // Крафт
  STATION_CRAFT_RECIPES_GET = 'station:craft:recipes:get',
  STATION_CRAFT_RECIPES_DATA = 'station:craft:recipes:data',
  STATION_CRAFT_START = 'station:craft:start',
  STATION_CRAFT_START_SUCCESS = 'station:craft:start:success',
  STATION_CRAFT_START_ERROR = 'station:craft:start:error',
  STATION_CRAFT_CANCEL = 'station:craft:cancel',
  STATION_CRAFT_CANCEL_SUCCESS = 'station:craft:cancel:success',
  STATION_CRAFT_PROGRESS = 'station:craft:progress',
  STATION_CRAFT_COMPLETE = 'station:craft:complete',
  
  // Торговля
  STATION_MARKET_ORDERS_GET = 'station:market:orders:get',
  STATION_MARKET_ORDERS_DATA = 'station:market:orders:data',
  STATION_MARKET_ORDER_CREATE = 'station:market:order:create',
  STATION_MARKET_ORDER_CREATE_SUCCESS = 'station:market:order:create:success',
  STATION_MARKET_ORDER_CREATE_ERROR = 'station:market:order:create:error',
  STATION_MARKET_ORDER_CANCEL = 'station:market:order:cancel',
  STATION_MARKET_ORDER_CANCEL_SUCCESS = 'station:market:order:cancel:success',
  STATION_MARKET_ORDER_EXECUTE = 'station:market:order:execute',
  STATION_MARKET_ORDER_EXECUTE_SUCCESS = 'station:market:order:execute:success',
  STATION_MARKET_ORDER_EXECUTE_ERROR = 'station:market:order:execute:error',

  // Квесты
  QUEST_CREATE = 'quest:create',
  QUEST_CREATE_SUCCESS = 'quest:create:success',
  QUEST_CREATE_ERROR = 'quest:create:error',
  QUEST_LIST_GET = 'quest:list:get',
  QUEST_LIST_DATA = 'quest:list:data',
  QUEST_TAKE = 'quest:take',
  QUEST_TAKE_SUCCESS = 'quest:take:success',
  QUEST_TAKE_ERROR = 'quest:take:error',
  QUEST_TURN_IN = 'quest:turn_in',
  QUEST_TURN_IN_SUCCESS = 'quest:turn_in:success',
  QUEST_TURN_IN_ERROR = 'quest:turn_in:error',

  // Трюм (выброс без станции)
  CARGO_DISCARD = 'cargo:discard',
  CARGO_DISCARD_SUCCESS = 'cargo:discard:success',
  CARGO_DISCARD_ERROR = 'cargo:discard:error',

  // Майнинг
  MINING_START = 'mining:start',
  MINING_STARTED = 'mining:started',
  MINING_UPDATE = 'mining:update',
  MINING_EXIT = 'mining:exit',
  MINING_COMPLETE = 'mining:complete',
  MINING_ERROR = 'mining:error',
}

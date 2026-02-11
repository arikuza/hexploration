import { HexCoordinates } from './hex.types.js';
import type { PlayerSkills } from './skill.types.js';
import type { CargoHold } from './storage.types.js';

/**
 * Данные игрока
 */
export interface Player {
  id: string;
  username: string;
  position: HexCoordinates;
  ship: Ship;
  resources: number;
  credits: number;          // Кредиты (валюта)
  experience: number;
  level: number;
  online: boolean;
  moveTimer: number;        // Время до следующего хода (в миллисекундах)
  canMove: boolean;         // Может ли сейчас двигаться
  /** Навыки (Eve-like), опционально */
  skills?: PlayerSkills;
  /** Активные квесты: [{ questId, progress, kills?, delivered? }] */
  activeQuests?: Array<{ questId: string; progress: number; kills?: number; delivered?: number }>;
}

/**
 * Корабль игрока
 */
export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  speed: number;
  turnRate: number;
  weapons: Weapon[];
  cargoHold?: CargoHold;          // Трюм корабля для грузов
}

/**
 * Типы кораблей
 */
export enum ShipType {
  SCOUT = 'scout',           // Разведчик (быстрый, слабый)
  FIGHTER = 'fighter',       // Истребитель (баланс)
  CRUISER = 'cruiser',       // Крейсер (медленный, сильный)
  SUPPORT = 'support',       // Поддержка (лечение, баффы)
}

/**
 * Оружие корабля
 */
export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  cooldown: number;
  energyCost: number;
  projectileSpeed: number;
  range: number;
}

/**
 * Типы оружия
 */
export enum WeaponType {
  LASER = 'laser',           // Лазер (быстрый, точный)
  PLASMA = 'plasma',         // Плазма (средний урон, средняя скорость)
  MISSILE = 'missile',       // Ракета (медленная, большой урон)
  BEAM = 'beam',             // Луч (непрерывный урон)
}

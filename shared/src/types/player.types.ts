import { HexCoordinates } from './hex.types.js';
import type { PlayerSkills } from './skill.types.js';

/**
 * Данные игрока
 */
export interface Player {
  id: string;
  username: string;
  position: HexCoordinates;
  ship: Ship;
  resources: number;
  experience: number;
  level: number;
  online: boolean;
  moveTimer: number;        // Время до следующего хода (в миллисекундах)
  canMove: boolean;         // Может ли сейчас двигаться
  /** Навыки (Eve-like), опционально */
  skills?: PlayerSkills;
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

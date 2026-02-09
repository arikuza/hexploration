import { Weapon, WeaponType } from '../types/player.types.js';

/**
 * Базовое оружие для всех кораблей
 */
export const DEFAULT_WEAPONS: Weapon[] = [
  {
    id: 'laser_basic',
    name: 'Базовый лазер',
    type: WeaponType.LASER,
    damage: 8, // Уменьшен в 3 раза (было 25)
    cooldown: 0.3, // секунды (300ms - умеренная скорость стрельбы)
    energyCost: 3,
    projectileSpeed: 1200, // Уменьшена скорость снаряда в ~4 раза
    range: 1500,
  },
];

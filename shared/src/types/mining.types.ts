/**
 * Типы для майнинга (добыча в стиле Asteroids)
 */

export interface MiningAsteroid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;       // Радиус 1-4
  mineralType: string; // iron_ore, copper_ore, energy_crystal, rare_metal
  health: number;     // Остаток прочности для добычи
}

export interface MiningShip {
  playerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  energy: number;
  maxEnergy: number;
}

export interface MiningState {
  sessionId: string;
  hexKey: string;
  playerId: string;
  ship: MiningShip;
  asteroids: MiningAsteroid[];
  collected: Array<{ itemId: string; quantity: number }>;
  startTime: number;
  /** Лазер активен (для отрисовки на клиенте) */
  laserActive?: boolean;
}

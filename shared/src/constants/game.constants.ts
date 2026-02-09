/**
 * Константы игры
 */

// Карта
export const MAP_RADIUS = 100;
export const HEX_SIZE = 25; // Размер гекса в пикселях для рендеринга

// Игровой процесс
export const MOVE_COOLDOWN = 15000; // 15 секунд между перемещениями
export const MAX_MOVEMENT_DISTANCE = 1; // Максимум 1 гекс за одно перемещение

// Бой
export const COMBAT_DURATION = 180000; // 3 минуты на бой
export const COMBAT_ARENA_WIDTH = 800;
export const COMBAT_ARENA_HEIGHT = 600;

// Базовые характеристики кораблей
export const SHIP_MAX_HEALTH = 100;
export const SHIP_MAX_ENERGY = 100;
export const SHIP_HIT_RADIUS = 20; // Радиус для проверки столкновений

// Характеристики кораблей игрока
export const SHIP_MAX_SPEED = 50;
export const SHIP_ACCELERATION = 5;
export const SHIP_TURN_RATE = 2;
export const SHIP_ENERGY_REGEN = 5; // Энергия в секунду

// Система ускорения (boost)
export const BOOST_SPEED_MULTIPLIER = 2.5; // Множитель максимальной скорости
export const BOOST_ACCELERATION_MULTIPLIER = 1.8; // Множитель ускорения
export const BOOST_ENERGY_COST = 15; // Энергия в секунду при ускорении
export const BOOST_MIN_ENERGY = 10; // Минимальная энергия для активации

// Характеристики ботов (в 1.5 раза медленнее)
export const BOT_MAX_SPEED = 50;
export const BOT_ACCELERATION = 3.33; // 5 / 1.5
export const BOT_TURN_RATE = 2;
export const BOT_ENERGY_REGEN = 5; // Энергия в секунду
export const BOT_WEAPON_COOLDOWN_MULTIPLIER = 1.5; // Стреляет в 1.5 раза реже

// Корабли - базовые характеристики
export const SHIP_STATS = {
  scout: {
    maxHealth: 100,
    maxEnergy: 150,
    speed: 5,
    turnRate: 0.1,
  },
  fighter: {
    maxHealth: 150,
    maxEnergy: 100,
    speed: 3.5,
    turnRate: 0.08,
  },
  cruiser: {
    maxHealth: 250,
    maxEnergy: 80,
    speed: 2,
    turnRate: 0.05,
  },
  support: {
    maxHealth: 120,
    maxEnergy: 200,
    speed: 3,
    turnRate: 0.07,
  },
};

// Оружие
export const WEAPON_STATS = {
  laser: {
    damage: 15,
    cooldown: 500,
    energyCost: 10,
    projectileSpeed: 8,
    range: 400,
  },
  plasma: {
    damage: 25,
    cooldown: 1000,
    energyCost: 20,
    projectileSpeed: 5,
    range: 350,
  },
  missile: {
    damage: 50,
    cooldown: 2000,
    energyCost: 30,
    projectileSpeed: 3,
    range: 500,
  },
  beam: {
    damage: 10,
    cooldown: 100,
    energyCost: 5,
    projectileSpeed: Infinity,
    range: 300,
  },
};

// Ресурсы
export const RESOURCE_SPAWN_RATE = 0.3; // 30% шанс спавна ресурсов в секторе
export const BASE_RESOURCE_AMOUNT = 100;

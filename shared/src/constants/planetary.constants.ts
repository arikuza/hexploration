import { ResourceCost, StructureType, StarType, PlanetType } from '../types/planetary.types.js';

/**
 * Константы для планетарных систем
 */

// Генерация систем
export const MIN_PLANETS_PER_SYSTEM = 2;
export const MAX_PLANETS_PER_SYSTEM = 8;
export const MIN_ASTEROID_BELTS = 0;
export const MAX_ASTEROID_BELTS = 3;
export const MIN_GAS_GIANTS = 0;
export const MAX_GAS_GIANTS = 2;

// Орбиты
export const MIN_ORBIT_RADIUS = 50;
export const MAX_ORBIT_RADIUS = 400;
export const ASTEROID_BELT_WIDTH = 30;

// Размеры
export const MIN_PLANET_SIZE = 1;
export const MAX_PLANET_SIZE = 5;
export const MIN_STAR_SIZE = 2;
export const MAX_STAR_SIZE = 5;

// Скорости вращения (радианы в секунду для анимации)
export const MIN_ORBIT_SPEED = 0.01;
export const MAX_ORBIT_SPEED = 0.05;

// Ресурсы астероидных поясов
export const MIN_ASTEROID_MINERALS = 500;
export const MAX_ASTEROID_MINERALS = 10000;
export const BASE_REGEN_RATE = 20; // Минералов в час
export const MAX_REGEN_RATE = 100;

// Стоимость структур (очень дорого!)
export const STRUCTURE_COSTS: Record<StructureType, ResourceCost> = {
  [StructureType.MINING_STATION]: {
    credits: 10000,
    minerals: 500,
  },
  [StructureType.GAS_EXTRACTOR]: {
    credits: 15000,
    minerals: 800,
  },
  [StructureType.PLANETARY_MINE]: {
    credits: 12000,
    minerals: 600,
  },
  [StructureType.MANUFACTURING_PLANT]: {
    credits: 50000,
    minerals: 2000,
    rareMaterials: 100,
  },
  [StructureType.ORBITAL_SHIPYARD]: {
    credits: 75000,
    minerals: 3000,
    rareMaterials: 200,
  },
  [StructureType.SPACE_STATION]: {
    credits: 100000,
    minerals: 5000,
    rareMaterials: 500,
  },
  [StructureType.RESEARCH_LAB]: {
    credits: 30000,
    minerals: 1000,
    rareMaterials: 50,
  },
  [StructureType.TRADING_POST]: {
    credits: 25000,
    minerals: 800,
  },
  [StructureType.DEFENSE_STATION]: {
    credits: 40000,
    minerals: 1500,
    rareMaterials: 100,
  },
};

// Время постройки структур (в секундах)
export const STRUCTURE_BUILD_TIMES: Record<StructureType, number> = {
  [StructureType.MINING_STATION]: 300,        // 5 минут
  [StructureType.GAS_EXTRACTOR]: 450,          // 7.5 минут
  [StructureType.PLANETARY_MINE]: 360,        // 6 минут
  [StructureType.MANUFACTURING_PLANT]: 1800,  // 30 минут
  [StructureType.ORBITAL_SHIPYARD]: 3600,      // 1 час
  [StructureType.SPACE_STATION]: 5400,          // 1.5 часа
  [StructureType.RESEARCH_LAB]: 1200,          // 20 минут
  [StructureType.TRADING_POST]: 900,           // 15 минут
  [StructureType.DEFENSE_STATION]: 2400,       // 40 минут
};

// Здоровье структур
export const STRUCTURE_HEALTH: Record<StructureType, number> = {
  [StructureType.MINING_STATION]: 500,
  [StructureType.GAS_EXTRACTOR]: 600,
  [StructureType.PLANETARY_MINE]: 550,
  [StructureType.MANUFACTURING_PLANT]: 2000,
  [StructureType.ORBITAL_SHIPYARD]: 3000,
  [StructureType.SPACE_STATION]: 5000,
  [StructureType.RESEARCH_LAB]: 1000,
  [StructureType.TRADING_POST]: 800,
  [StructureType.DEFENSE_STATION]: 4000,
};

// Скорость добычи (минералов/ресурсов в час)
export const EXTRACTION_RATES: Record<StructureType, number> = {
  [StructureType.MINING_STATION]: 100,         // 100 минералов/час
  [StructureType.GAS_EXTRACTOR]: 50,          // 50 гелия/час
  [StructureType.PLANETARY_MINE]: 80,         // 80 минералов/час
  [StructureType.MANUFACTURING_PLANT]: 0,      // Не добывает
  [StructureType.ORBITAL_SHIPYARD]: 0,
  [StructureType.SPACE_STATION]: 0,
  [StructureType.RESEARCH_LAB]: 0,
  [StructureType.TRADING_POST]: 0,
  [StructureType.DEFENSE_STATION]: 0,
};

// Вместимость структур (максимум ресурсов)
export const STRUCTURE_CAPACITY: Record<StructureType, number> = {
  [StructureType.MINING_STATION]: 5000,        // 5000 минералов
  [StructureType.GAS_EXTRACTOR]: 2000,        // 2000 гелия
  [StructureType.PLANETARY_MINE]: 4000,       // 4000 минералов
  [StructureType.MANUFACTURING_PLANT]: 0,
  [StructureType.ORBITAL_SHIPYARD]: 0,
  [StructureType.SPACE_STATION]: 0,
  [StructureType.RESEARCH_LAB]: 0,
  [StructureType.TRADING_POST]: 0,
  [StructureType.DEFENSE_STATION]: 0,
};

// Вероятности типов звезд при генерации
export const STAR_TYPE_WEIGHTS: Record<StarType, number> = {
  [StarType.YELLOW_DWARF]: 0.4,      // 40% - самый частый
  [StarType.RED_DWARF]: 0.3,         // 30%
  [StarType.RED_GIANT]: 0.1,         // 10%
  [StarType.BLUE_GIANT]: 0.05,        // 5%
  [StarType.WHITE_DWARF]: 0.1,        // 10%
  [StarType.NEUTRON_STAR]: 0.05,     // 5% - редкий
};

// Вероятности типов планет
export const PLANET_TYPE_WEIGHTS: Record<PlanetType, number> = {
  [PlanetType.ROCKY]: 0.3,            // 30%
  [PlanetType.OCEAN]: 0.15,           // 15%
  [PlanetType.DESERT]: 0.2,           // 20%
  [PlanetType.ICE]: 0.2,              // 20%
  [PlanetType.VOLCANIC]: 0.1,         // 10%
  [PlanetType.GAS_GIANT]: 0.05,       // 5% (отдельно от газовых гигантов)
};

// Температура звезд (в Кельвинах, упрощенно)
export const STAR_TEMPERATURES: Record<StarType, number> = {
  [StarType.YELLOW_DWARF]: 5800,
  [StarType.RED_DWARF]: 3000,
  [StarType.RED_GIANT]: 3500,
  [StarType.BLUE_GIANT]: 30000,
  [StarType.WHITE_DWARF]: 10000,
  [StarType.NEUTRON_STAR]: 600000,
};

// Светимость звезд (относительно Солнца)
export const STAR_LUMINOSITY: Record<StarType, number> = {
  [StarType.YELLOW_DWARF]: 1.0,
  [StarType.RED_DWARF]: 0.01,
  [StarType.RED_GIANT]: 100,
  [StarType.BLUE_GIANT]: 10000,
  [StarType.WHITE_DWARF]: 0.1,
  [StarType.NEUTRON_STAR]: 0.001,
};

import { HexCoordinates } from './hex.types.js';
import type { StationStorage } from './storage.types.js';
import type { MarketOrder } from './market.types.js';

/**
 * Типы звезд
 */
export enum StarType {
  YELLOW_DWARF = 'yellow_dwarf',     // Желтый карлик (как Солнце)
  RED_DWARF = 'red_dwarf',           // Красный карлик
  RED_GIANT = 'red_giant',           // Красный гигант
  BLUE_GIANT = 'blue_giant',         // Голубой гигант
  WHITE_DWARF = 'white_dwarf',       // Белый карлик
  NEUTRON_STAR = 'neutron_star',     // Нейтронная звезда
}

/**
 * Типы планет
 */
export enum PlanetType {
  ROCKY = 'rocky',                   // Каменистая планета
  OCEAN = 'ocean',                   // Океаническая планета
  DESERT = 'desert',                 // Пустынная планета
  ICE = 'ice',                       // Ледяная планета
  VOLCANIC = 'volcanic',             // Вулканическая планета
  GAS_GIANT = 'gas_giant',           // Газовый гигант
}

/**
 * Типы газовых гигантов
 */
export enum GasGiantType {
  JOVIAN = 'jovian',                 // Юпитерианский тип
  NEPTUNIAN = 'neptunian',           // Нептунианский тип
  BROWN_DWARF = 'brown_dwarf',       // Коричневый карлик
}

/**
 * Типы ресурсов
 */
export enum ResourceType {
  CREDITS = 'credits',               // Кредиты (валюта)
  MINERALS = 'minerals',             // Минералы
  ENERGY = 'energy',                 // Энергия
  HELIUM = 'helium',                 // Гелий-3
  RARE_MATERIALS = 'rare_materials', // Редкие материалы
  RESEARCH = 'research',             // Исследовательские очки
}

/**
 * Типы структур
 */
export enum StructureType {
  // Добыча ресурсов
  MINING_STATION = 'mining_station',        // Шахта в астероидном поясе
  GAS_EXTRACTOR = 'gas_extractor',         // Добыча газа у газового гиганта
  PLANETARY_MINE = 'planetary_mine',       // Шахта на планете
  
  // Производство
  MANUFACTURING_PLANT = 'manufacturing_plant', // Завод на планете
  ORBITAL_SHIPYARD = 'orbital_shipyard',    // Верфь на орбите
  
  // Инфраструктура
  SPACE_STATION = 'space_station',          // Космическая станция
  RESEARCH_LAB = 'research_lab',           // Исследовательская лаборатория
  TRADING_POST = 'trading_post',           // Торговый пост
  
  // Защита
  DEFENSE_STATION = 'defense_station',      // Оборонительная станция
}

/**
 * Звезда в системе
 */
export interface Star {
  type: StarType;
  size: number;                    // Размер (1-5)
  temperature: number;             // Температура (влияет на обитаемость)
  luminosity: number;               // Светимость
}

/**
 * Ресурсы планеты
 */
export interface PlanetResources {
  minerals?: number;                // Минералы на планете
  rareMaterials?: number;           // Редкие материалы
  energy?: number;                  // Энергетический потенциал
}

/**
 * Планета
 */
export interface Planet {
  id: string;
  name?: string;                    // Опциональное имя
  type: PlanetType;
  orbitRadius: number;              // Расстояние от звезды (для визуализации)
  orbitSpeed: number;               // Скорость вращения (для анимации)
  size: number;                     // Размер планеты (1-5)
  habitable: boolean;                // Обитаема ли планета
  resources: PlanetResources;       // Ресурсы на планете
  
  // Структуры на планете
  structures: string[];              // ID структур
}

/**
 * Астероидный пояс
 */
export interface AsteroidBelt {
  id: string;
  orbitRadius: number;              // Расстояние от звезды
  width: number;                     // Ширина пояса
  density: number;                   // Плотность астероидов (1-10)
  mineralRichness: number;           // Богатство минералами (1-10)
  
  resources: {
    minerals: number;                 // Текущее количество минералов
    maxMinerals: number;              // Максимальное количество
    regenerationRate: number;         // Скорость регенерации (минералов в час)
  };
  
  // Структуры в поясе
  structures: string[];               // ID структур (шахты, станции добычи)
}

/**
 * Газовый гигант
 */
export interface GasGiant {
  id: string;
  orbitRadius: number;
  orbitSpeed: number;
  size: number;                      // Размер (обычно большой, 4-5)
  type: GasGiantType;
  
  resources: {
    helium: number;                  // Гелий-3 для топлива
    rareGases: number;               // Редкие газы
  };
  
  // Структуры у газового гиганта
  structures: string[];              // ID структур (газодобывающие станции)
}

/**
 * Расположение структуры
 */
export interface StructureLocation {
  type: 'planet' | 'asteroid_belt' | 'gas_giant' | 'orbit';
  targetId: string;                  // ID планеты/пояса/гиганта
  position?: {                        // Позиция на орбите/поверхности
    angle: number;                   // Угол на орбите (для орбитальных структур)
    radius?: number;                 // Радиус от центра (для планет)
  };
}

/**
 * Стоимость ресурсов
 */
export interface ResourceCost {
  credits: number;                   // Кредиты (основная валюта)
  minerals?: number;                 // Минералы
  energy?: number;                   // Энергия
  rareMaterials?: number;            // Редкие материалы
}

/**
 * Производство структуры
 */
export interface Production {
  output: {
    resource: ResourceType;
    amount: number;                   // Количество в час
  };
  input?: {                          // Требуемые ресурсы
    resource: ResourceType;
    amount: number;
  }[];
  efficiency: number;                // Эффективность (0-1)
}

/**
 * Добыча структуры
 */
export interface Extraction {
  resource: ResourceType;
  rate: number;                      // Скорость добычи (в час)
  efficiency: number;                // Эффективность (0-1)
  maxCapacity: number;              // Максимальная вместимость
  currentAmount: number;             // Текущее количество
}

/**
 * Космическая структура
 */
export interface SpaceStructure {
  id: string;
  type: StructureType;
  ownerId: string;                   // ID игрока-владельца
  
  // Расположение
  location: StructureLocation;
  
  // Стоимость и требования
  cost: ResourceCost;
  buildTime: number;                 // Время постройки (в секундах)
  buildProgress?: number;            // Прогресс постройки (0-100)
  buildStartTime?: number;          // Время начала постройки (timestamp)
  
  // Производство/функции
  production?: Production;            // Что производит структура
  extraction?: Extraction;           // Что добывает структура
  
  // Состояние
  health: number;
  maxHealth: number;
  operational: boolean;               // Работает ли структура
  
  // Метаданные
  name?: string;                     // Имя структуры (задается игроком)
  createdAt: number;                 // Время создания (timestamp)
  
  // Хранилище и торговля (только для SPACE_STATION)
  storage?: StationStorage;          // Хранилище станции (ангар + предметы)
  marketOrders?: MarketOrder[];      // Торговые ордера на станции
}

/**
 * Планетарная система
 */
export interface PlanetarySystem {
  // Базовая информация
  hexCoordinates: HexCoordinates;
  systemType: 'planetary';
  
  // Звезда
  star: Star;
  
  // Небесные тела
  planets: Planet[];
  asteroidBelts: AsteroidBelt[];
  gasGiants: GasGiant[];
  
  // Структуры игроков
  structures: SpaceStructure[];
  
  // Метаданные
  discoveredBy: string[];            // Кто исследовал систему
  owner?: string;                     // Владелец системы (если колонизирована)
  name?: string;                     // Имя системы (задается игроком)
  
  // Генерация
  seed?: number;                      // Seed для генерации (для воспроизводимости)
}

/**
 * Количество ресурсов
 */
export interface ResourceAmount {
  [ResourceType.CREDITS]?: number;
  [ResourceType.MINERALS]?: number;
  [ResourceType.ENERGY]?: number;
  [ResourceType.HELIUM]?: number;
  [ResourceType.RARE_MATERIALS]?: number;
  [ResourceType.RESEARCH]?: number;
}

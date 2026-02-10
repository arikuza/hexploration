/**
 * Система координат для гексагональной сетки (Axial coordinates)
 */
export interface HexCoordinates {
  q: number; // Колонка
  r: number; // Ряд
}

/**
 * Кубические координаты для расчетов (легче работать с расстояниями)
 */
export interface CubeCoordinates {
  x: number;
  y: number;
  z: number;
}

/**
 * Типы систем
 */
export enum SystemType {
  PLANETARY = 'planetary',      // Планетарная система
  EMPTY = 'empty',              // Пустой космос (редко)
  PLAYER_COLONY = 'player_colony', // Пользовательская колония
}

/**
 * Старый enum для обратной совместимости (deprecated)
 */
export enum HexType {
  EMPTY = 'empty',
  ASTEROID = 'asteroid',
  NEBULA = 'nebula',
  PLANET = 'planet',
  STATION = 'station',
  WORMHOLE = 'wormhole',
}

/**
 * Данные гекса на карте
 */
export interface HexCell {
  coordinates: HexCoordinates;
  systemType: SystemType;
  threat: number;           // От 1 (безопасно) до -2 (неизвестный космос)
  owner?: string;           // 'npc' или id игрока
  resources?: number;       // Ресурсы в секторе
  discoveredBy?: string[];  // Кто открыл этот сектор
  hasStation?: boolean;     // Есть ли станция в системе
  lastDecayCheck?: number;  // Время последней проверки деградации (timestamp)

  /** ID планетарной системы (если systemType === PLANETARY). Ссылка на детальные данные звезды, планет, поясов. */
  planetarySystemId?: string;

  // Старое поле для обратной совместимости (deprecated)
  type?: HexType;
}

/**
 * Карта гексов
 */
export interface HexMap {
  cells: Map<string, HexCell>; // Ключ: "q,r"
  radius: number;                // Радиус карты
}

/**
 * Зоны угрозы для генерации карты
 */
export const THREAT_ZONES = {
  CENTER: { min: 1.0, max: 1.0, distance: 0 },
  INNER: { min: 0.5, max: 0.8, distance: 3 },
  MIDDLE: { min: 0.0, max: 0.3, distance: 6 },
  OUTER: { min: -0.5, max: -1.0, distance: 10 },
  UNKNOWN: { min: -1.0, max: -2.0, distance: 15 }, // Неисследованный космос
} as const;

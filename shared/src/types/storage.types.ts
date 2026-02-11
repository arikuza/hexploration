import { ItemStack } from './item.types.js';
import { Ship } from './player.types.js';

/**
 * Трюм корабля - хранит предметы в текущем корабле игрока
 */
export interface CargoHold {
  capacity: number;                // Вместимость в единицах объёма
  items: ItemStack[];              // Предметы в трюме
}

/**
 * Хранилище станции - ангар для предметов и кораблей
 */
export interface StationStorage {
  stationId: string;              // ID структуры станции
  items: ItemStack[];              // Предметы на станции (неограниченно)
  ships: Ship[];                   // Корабли в ангаре
  maxShipSlots: number;            // Максимальное количество слотов для кораблей
  walletCredits?: number;          // Кредиты станции (для наград квестов)
}

/**
 * Операция переноса груза
 */
export interface CargoTransfer {
  itemId: string;
  quantity: number;
  direction: 'to_station' | 'from_station';  // Направление переноса
}

/**
 * Типы предметов в игре
 */

/**
 * Тип предмета
 */
export enum ItemType {
  RESOURCE = 'resource',           // Ресурсы (минералы, энергия, редкие материалы)
  COMPONENT = 'component',         // Компоненты (произведённые из ресурсов)
  MODULE = 'module',              // Модули кораблей (оружие, щиты, двигатели)
  SHIP = 'ship',                  // Готовые корабли
}

/**
 * Категория предмета
 */
export enum ItemCategory {
  // Ресурсы
  MINERAL = 'mineral',
  ENERGY = 'energy',
  RARE_MATERIAL = 'rare_material',
  GAS = 'gas',
  
  // Компоненты
  ELECTRONICS = 'electronics',
  ALLOY = 'alloy',
  COMPOSITE = 'composite',
  
  // Модули
  WEAPON = 'weapon',
  SHIELD = 'shield',
  ENGINE = 'engine',
  CARGO_EXPANSION = 'cargo_expansion',
  
  // Корабли
  SHIP_FRIGATE = 'ship_frigate',
  SHIP_CRUISER = 'ship_cruiser',
}

/**
 * Предмет
 */
export interface Item {
  id: string;
  type: ItemType;
  category: ItemCategory;
  name: string;
  description: string;
  volume: number;                  // Объём в единицах груза (для расчёта вместимости)
  basePrice: number;               // Базовая цена в кредитах
  stackSize: number;               // Максимальный размер стека (для ресурсов обычно 1000+)
}

/**
 * Предмет в инвентаре (с количеством)
 */
export interface ItemStack {
  itemId: string;
  quantity: number;
}

/**
 * Справочник всех предметов
 */
export interface ItemRegistry {
  [itemId: string]: Item;
}

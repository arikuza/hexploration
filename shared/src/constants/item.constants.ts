import { Item, ItemType, ItemCategory, ItemRegistry } from '../types/item.types.js';

/**
 * Константы предметов
 */

// Базовые ресурсы
export const ITEM_IRON_ORE: Item = {
  id: 'iron_ore',
  type: ItemType.RESOURCE,
  category: ItemCategory.MINERAL,
  name: 'Железная руда',
  description: 'Базовая руда для производства',
  volume: 1,
  basePrice: 10,
  stackSize: 1000,
};

export const ITEM_COPPER_ORE: Item = {
  id: 'copper_ore',
  type: ItemType.RESOURCE,
  category: ItemCategory.MINERAL,
  name: 'Медная руда',
  description: 'Руда для электроники',
  volume: 1,
  basePrice: 15,
  stackSize: 1000,
};

export const ITEM_ENERGY_CRYSTAL: Item = {
  id: 'energy_crystal',
  type: ItemType.RESOURCE,
  category: ItemCategory.ENERGY,
  name: 'Энергетический кристалл',
  description: 'Источник энергии',
  volume: 0.5,
  basePrice: 20,
  stackSize: 500,
};

export const ITEM_RARE_METAL: Item = {
  id: 'rare_metal',
  type: ItemType.RESOURCE,
  category: ItemCategory.RARE_MATERIAL,
  name: 'Редкий металл',
  description: 'Ценный материал для производства',
  volume: 0.5,
  basePrice: 100,
  stackSize: 100,
};

// Компоненты
export const ITEM_ELECTRONICS: Item = {
  id: 'electronics',
  type: ItemType.COMPONENT,
  category: ItemCategory.ELECTRONICS,
  name: 'Электроника',
  description: 'Базовый компонент для модулей',
  volume: 0.5,
  basePrice: 50,
  stackSize: 500,
};

export const ITEM_ALLOY: Item = {
  id: 'alloy',
  type: ItemType.COMPONENT,
  category: ItemCategory.ALLOY,
  name: 'Сплав',
  description: 'Прочный материал для кораблей',
  volume: 1,
  basePrice: 40,
  stackSize: 500,
};

export const ITEM_COMPOSITE: Item = {
  id: 'composite',
  type: ItemType.COMPONENT,
  category: ItemCategory.COMPOSITE,
  name: 'Композит',
  description: 'Лёгкий и прочный материал',
  volume: 0.5,
  basePrice: 60,
  stackSize: 500,
};

// Модули
export const ITEM_LASER_WEAPON: Item = {
  id: 'laser_weapon',
  type: ItemType.MODULE,
  category: ItemCategory.WEAPON,
  name: 'Лазерное оружие',
  description: 'Базовое лазерное оружие',
  volume: 5,
  basePrice: 200,
  stackSize: 1,
};

export const ITEM_SHIELD_GENERATOR: Item = {
  id: 'shield_generator',
  type: ItemType.MODULE,
  category: ItemCategory.SHIELD,
  name: 'Генератор щитов',
  description: 'Защищает корабль от урона',
  volume: 5,
  basePrice: 250,
  stackSize: 1,
};

export const ITEM_ENGINE_BOOSTER: Item = {
  id: 'engine_booster',
  type: ItemType.MODULE,
  category: ItemCategory.ENGINE,
  name: 'Усилитель двигателя',
  description: 'Увеличивает скорость корабля',
  volume: 3,
  basePrice: 180,
  stackSize: 1,
};

export const ITEM_CARGO_EXPANSION: Item = {
  id: 'cargo_expansion',
  type: ItemType.MODULE,
  category: ItemCategory.CARGO_EXPANSION,
  name: 'Расширение трюма',
  description: 'Увеличивает вместимость трюма',
  volume: 2,
  basePrice: 150,
  stackSize: 1,
};

/**
 * Справочник всех предметов
 */
export const ITEM_REGISTRY: ItemRegistry = {
  [ITEM_IRON_ORE.id]: ITEM_IRON_ORE,
  [ITEM_COPPER_ORE.id]: ITEM_COPPER_ORE,
  [ITEM_ENERGY_CRYSTAL.id]: ITEM_ENERGY_CRYSTAL,
  [ITEM_RARE_METAL.id]: ITEM_RARE_METAL,
  [ITEM_ELECTRONICS.id]: ITEM_ELECTRONICS,
  [ITEM_ALLOY.id]: ITEM_ALLOY,
  [ITEM_COMPOSITE.id]: ITEM_COMPOSITE,
  [ITEM_LASER_WEAPON.id]: ITEM_LASER_WEAPON,
  [ITEM_SHIELD_GENERATOR.id]: ITEM_SHIELD_GENERATOR,
  [ITEM_ENGINE_BOOSTER.id]: ITEM_ENGINE_BOOSTER,
  [ITEM_CARGO_EXPANSION.id]: ITEM_CARGO_EXPANSION,
};

/**
 * Получить предмет по ID
 */
export function getItem(itemId: string): Item | undefined {
  return ITEM_REGISTRY[itemId];
}

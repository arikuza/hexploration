import { Recipe, RecipeRegistry } from '../types/crafting.types.js';

/**
 * Константы рецептов крафта
 */

// Простые рецепты компонентов
export const RECIPE_ELECTRONICS: Recipe = {
  id: 'craft_electronics',
  name: 'Производство электроники',
  description: 'Создание базовой электроники из руды',
  inputs: [
    { itemId: 'copper_ore', quantity: 5 },
    { itemId: 'energy_crystal', quantity: 2 },
  ],
  output: { itemId: 'electronics', quantity: 1 },
  craftingTime: 30, // 30 секунд
};

export const RECIPE_ALLOY: Recipe = {
  id: 'craft_alloy',
  name: 'Производство сплава',
  description: 'Создание сплава из железной руды',
  inputs: [
    { itemId: 'iron_ore', quantity: 10 },
    { itemId: 'energy_crystal', quantity: 3 },
  ],
  output: { itemId: 'alloy', quantity: 1 },
  craftingTime: 45, // 45 секунд
};

export const RECIPE_COMPOSITE: Recipe = {
  id: 'craft_composite',
  name: 'Производство композита',
  description: 'Создание композитного материала',
  inputs: [
    { itemId: 'alloy', quantity: 2 },
    { itemId: 'rare_metal', quantity: 1 },
    { itemId: 'energy_crystal', quantity: 5 },
  ],
  output: { itemId: 'composite', quantity: 1 },
  craftingTime: 60, // 60 секунд
};

// Рецепты модулей
export const RECIPE_LASER_WEAPON: Recipe = {
  id: 'craft_laser_weapon',
  name: 'Производство лазерного оружия',
  description: 'Создание лазерного оружия',
  inputs: [
    { itemId: 'electronics', quantity: 3 },
    { itemId: 'alloy', quantity: 2 },
    { itemId: 'energy_crystal', quantity: 5 },
  ],
  output: { itemId: 'laser_weapon', quantity: 1 },
  craftingTime: 120, // 2 минуты
  stationType: ['MANUFACTURING_PLANT'],
};

export const RECIPE_SHIELD_GENERATOR: Recipe = {
  id: 'craft_shield_generator',
  name: 'Производство генератора щитов',
  description: 'Создание генератора щитов',
  inputs: [
    { itemId: 'electronics', quantity: 5 },
    { itemId: 'composite', quantity: 2 },
    { itemId: 'energy_crystal', quantity: 10 },
  ],
  output: { itemId: 'shield_generator', quantity: 1 },
  craftingTime: 180, // 3 минуты
  stationType: ['MANUFACTURING_PLANT'],
};

export const RECIPE_ENGINE_BOOSTER: Recipe = {
  id: 'craft_engine_booster',
  name: 'Производство усилителя двигателя',
  description: 'Создание усилителя двигателя',
  inputs: [
    { itemId: 'alloy', quantity: 3 },
    { itemId: 'electronics', quantity: 2 },
    { itemId: 'energy_crystal', quantity: 4 },
  ],
  output: { itemId: 'engine_booster', quantity: 1 },
  craftingTime: 150, // 2.5 минуты
  stationType: ['MANUFACTURING_PLANT'],
};

export const RECIPE_CARGO_EXPANSION: Recipe = {
  id: 'craft_cargo_expansion',
  name: 'Производство расширения трюма',
  description: 'Создание модуля расширения трюма',
  inputs: [
    { itemId: 'alloy', quantity: 2 },
    { itemId: 'electronics', quantity: 1 },
  ],
  output: { itemId: 'cargo_expansion', quantity: 1 },
  craftingTime: 90, // 1.5 минуты
  stationType: ['MANUFACTURING_PLANT'],
};

/**
 * Справочник всех рецептов
 */
export const RECIPE_REGISTRY: RecipeRegistry = {
  [RECIPE_ELECTRONICS.id]: RECIPE_ELECTRONICS,
  [RECIPE_ALLOY.id]: RECIPE_ALLOY,
  [RECIPE_COMPOSITE.id]: RECIPE_COMPOSITE,
  [RECIPE_LASER_WEAPON.id]: RECIPE_LASER_WEAPON,
  [RECIPE_SHIELD_GENERATOR.id]: RECIPE_SHIELD_GENERATOR,
  [RECIPE_ENGINE_BOOSTER.id]: RECIPE_ENGINE_BOOSTER,
  [RECIPE_CARGO_EXPANSION.id]: RECIPE_CARGO_EXPANSION,
};

/**
 * Получить рецепт по ID
 */
export function getRecipe(recipeId: string): Recipe | undefined {
  return RECIPE_REGISTRY[recipeId];
}

/**
 * Получить все рецепты для определённого типа станции
 */
export function getRecipesForStation(stationType?: string): Recipe[] {
  if (!stationType) {
    return Object.values(RECIPE_REGISTRY);
  }
  return Object.values(RECIPE_REGISTRY).filter(
    (recipe) => !recipe.stationType || recipe.stationType.includes(stationType)
  );
}

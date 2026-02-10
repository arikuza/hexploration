import { ItemStack } from './item.types.js';

/**
 * Входной ресурс для рецепта
 */
export interface RecipeInput {
  itemId: string;
  quantity: number;
}

/**
 * Выходной предмет рецепта
 */
export interface RecipeOutput {
  itemId: string;
  quantity: number;
}

/**
 * Рецепт крафта
 */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputs: RecipeInput[];            // Требуемые ресурсы
  output: RecipeOutput;            // Результат крафта
  craftingTime: number;            // Время производства в секундах
  stationType?: string[];          // Типы станций, где можно крафтить (если пусто - везде)
  skillRequirements?: {            // Требования по навыкам
    skillId: string;
    level: number;
  }[];
}

/**
 * Активный процесс крафта
 */
export interface CraftingJob {
  id: string;
  recipeId: string;
  stationId: string;
  playerId: string;
  startTime: number;               // Timestamp начала крафта
  quantity: number;                // Количество предметов
  progress: number;                // Прогресс 0-100%
}

/**
 * Справочник всех рецептов
 */
export interface RecipeRegistry {
  [recipeId: string]: Recipe;
}

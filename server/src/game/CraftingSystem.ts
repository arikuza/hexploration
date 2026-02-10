import { Player, Recipe, CraftingJob, StationStorage } from '@hexploration/shared';
import { RECIPE_REGISTRY, getRecipe } from '@hexploration/shared';
import { ITEM_REGISTRY, getItem } from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Система крафта предметов
 */
export class CraftingSystem {
  private static activeJobs: Map<string, CraftingJob> = new Map(); // jobId -> job

  /**
   * Проверить, может ли игрок крафтить рецепт
   */
  static canCraft(
    player: Player,
    recipeId: string,
    stationStorage: StationStorage,
    quantity: number = 1
  ): { canCraft: boolean; error?: string } {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      return { canCraft: false, error: 'Рецепт не найден' };
    }

    // Проверить требования по навыкам
    if (recipe.skillRequirements) {
      const playerSkills = player.skills?.levels ?? {};
      for (const req of recipe.skillRequirements) {
        const skillLevel = playerSkills[req.skillId] ?? 0;
        if (skillLevel < req.level) {
          return { canCraft: false, error: `Требуется навык ${req.skillId} уровня ${req.level}` };
        }
      }
    }

    // Проверить наличие ресурсов на станции
    for (const input of recipe.inputs) {
      const requiredQuantity = input.quantity * quantity;
      const stack = stationStorage.items.find(s => s.itemId === input.itemId);
      if (!stack || stack.quantity < requiredQuantity) {
        const item = getItem(input.itemId);
        return {
          canCraft: false,
          error: `Недостаточно ${item?.name ?? input.itemId}: требуется ${requiredQuantity}, есть ${stack?.quantity ?? 0}`,
        };
      }
    }

    return { canCraft: true };
  }

  /**
   * Начать крафт
   */
  static startCrafting(
    playerId: string,
    recipeId: string,
    stationId: string,
    stationStorage: StationStorage,
    quantity: number = 1
  ): { success: boolean; jobId?: string; error?: string } {
    // Для проверки нужен игрок, но мы не можем получить его здесь
    // Проверка будет выполнена в обработчике сокета

    const recipe = getRecipe(recipeId);
    if (!recipe) {
      return { success: false, error: 'Рецепт не найден' };
    }

    // Проверить ресурсы и списать их
    for (const input of recipe.inputs) {
      const requiredQuantity = input.quantity * quantity;
      const stack = stationStorage.items.find(s => s.itemId === input.itemId);
      if (!stack || stack.quantity < requiredQuantity) {
        return { success: false, error: `Недостаточно ресурсов: ${input.itemId}` };
      }

      // Списать ресурсы
      stack.quantity -= requiredQuantity;
      if (stack.quantity <= 0) {
        const index = stationStorage.items.indexOf(stack);
        stationStorage.items.splice(index, 1);
      }
    }

    // Создать задачу крафта
    const jobId = uuidv4();
    const job: CraftingJob = {
      id: jobId,
      recipeId,
      stationId,
      playerId,
      startTime: Date.now(),
      quantity,
      progress: 0,
    };

    this.activeJobs.set(jobId, job);
    return { success: true, jobId };
  }

  /**
   * Получить прогресс крафта
   */
  static getCraftingProgress(jobId: string): CraftingJob | null {
    return this.activeJobs.get(jobId) ?? null;
  }

  /**
   * Получить все активные задачи крафта для игрока на станции
   */
  static getPlayerCraftingJobs(playerId: string, stationId: string): CraftingJob[] {
    return Array.from(this.activeJobs.values()).filter(
      job => job.playerId === playerId && job.stationId === stationId
    );
  }

  /**
   * Обновить прогресс всех задач крафта
   */
  static updateCraftingProgress(now: number): Array<{ job: CraftingJob; completed: boolean }> {
    const results: Array<{ job: CraftingJob; completed: boolean }> = [];

    for (const job of this.activeJobs.values()) {
      const recipe = getRecipe(job.recipeId);
      if (!recipe) continue;

      const elapsed = (now - job.startTime) / 1000; // секунды
      const totalTime = recipe.craftingTime * job.quantity;
      const progress = Math.min(100, (elapsed / totalTime) * 100);

      job.progress = progress;

      const completed = progress >= 100;
      results.push({ job, completed });
    }

    return results;
  }

  /**
   * Завершить крафт и выдать предметы
   */
  static completeCrafting(
    jobId: string,
    stationStorage: StationStorage
  ): { success: boolean; error?: string } {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Задача крафта не найдена' };
    }

    const recipe = getRecipe(job.recipeId);
    if (!recipe) {
      this.activeJobs.delete(jobId);
      return { success: false, error: 'Рецепт не найден' };
    }

    // Выдать предметы
    const outputQuantity = recipe.output.quantity * job.quantity;
    const existingStack = stationStorage.items.find(s => s.itemId === recipe.output.itemId);
    if (existingStack) {
      existingStack.quantity += outputQuantity;
    } else {
      stationStorage.items.push({
        itemId: recipe.output.itemId,
        quantity: outputQuantity,
      });
    }

    // Удалить задачу
    this.activeJobs.delete(jobId);
    return { success: true };
  }

  /**
   * Отменить крафт (вернуть ресурсы)
   */
  static cancelCrafting(
    jobId: string,
    stationStorage: StationStorage
  ): { success: boolean; error?: string } {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Задача крафта не найдена' };
    }

    const recipe = getRecipe(job.recipeId);
    if (!recipe) {
      this.activeJobs.delete(jobId);
      return { success: false, error: 'Рецепт не найден' };
    }

    // Вернуть ресурсы
    for (const input of recipe.inputs) {
      const returnedQuantity = input.quantity * job.quantity;
      const existingStack = stationStorage.items.find(s => s.itemId === input.itemId);
      if (existingStack) {
        existingStack.quantity += returnedQuantity;
      } else {
        stationStorage.items.push({
          itemId: input.itemId,
          quantity: returnedQuantity,
        });
      }
    }

    // Удалить задачу
    this.activeJobs.delete(jobId);
    return { success: true };
  }
}

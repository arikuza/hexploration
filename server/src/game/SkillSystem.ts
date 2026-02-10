import {
  PlayerSkills,
  SkillQueueItem,
  CurrentTraining,
  SKILLS_BY_ID,
  getSpRequiredForLevels,
} from '@hexploration/shared';

function createEmptySkills(): PlayerSkills {
  return {
    totalSp: 0,
    levels: {},
    queue: [],
    currentTraining: null,
  };
}

/**
 * Пересчитать прогресс навыков по реальному времени.
 * Обновляет levels пошагово (1→2→3→4→5), чтобы уровень и прогресс-бар отображались корректно.
 */
export function recalcPlayerSkills(skills: PlayerSkills, now: number): PlayerSkills {
  const result: PlayerSkills = {
    totalSp: skills.totalSp,
    levels: { ...skills.levels },
    queue: [...skills.queue],
    currentTraining: skills.currentTraining ? { ...skills.currentTraining } : null,
  };

  while (result.currentTraining) {
    const training = result.currentTraining;
    const { skillId, targetLevel, startTime } = training;
    const skill = SKILLS_BY_ID[skillId];
    if (!skill) {
      result.currentTraining = result.queue.shift() ?? null;
      if (result.currentTraining) result.currentTraining.startTime = now;
      continue;
    }

    let currentLevel = result.levels[skillId] ?? 0;
    if (currentLevel >= targetLevel) {
      result.currentTraining = result.queue.shift() ?? null;
      if (result.currentTraining) result.currentTraining.startTime = now;
      continue;
    }

    const elapsedMs = now - startTime;
    let progressSp = (elapsedMs / 3600000) * skill.spPerHour;
    let consumedMs = 0;

    // Применяем прогресс пошагово: каждый уровень (1, 2, 3, 4, 5) обновляется по мере накопления SP
    while (currentLevel < targetLevel) {
      const needForNext = getSpRequiredForLevels(skill, currentLevel, currentLevel + 1);
      if (progressSp >= needForNext) {
        currentLevel += 1;
        result.levels[skillId] = currentLevel;
        result.totalSp += needForNext;
        progressSp -= needForNext;
        consumedMs += (needForNext / (skill.spPerHour / 3600000)) * 1000;
      } else {
        break;
      }
    }

    if (currentLevel >= targetLevel) {
      result.currentTraining = result.queue.shift() ?? null;
      if (result.currentTraining) result.currentTraining.startTime = now;
      continue;
    }

    // Прогресс не завершён — сдвигаем startTime на потреблённое время, чтобы при следующем recalc не дублировать прогресс
    training.startTime = startTime + consumedMs;
    break;
  }

  return result;
}

/**
 * Инициализировать навыки игрока, если их ещё нет.
 */
export function ensurePlayerSkills(skills: PlayerSkills | undefined): PlayerSkills {
  if (skills && typeof skills.levels === 'object' && Array.isArray(skills.queue)) {
    return {
      totalSp: skills.totalSp ?? 0,
      levels: skills.levels ?? {},
      queue: skills.queue ?? [],
      currentTraining: skills.currentTraining ?? null,
    };
  }
  return createEmptySkills();
}

/**
 * Установить очередь обучения. Валидирует skillId, targetLevel.
 * Сохраняет startTime текущего навыка, если он остаётся в очереди.
 */
export function setSkillQueue(
  skills: PlayerSkills,
  queue: SkillQueueItem[],
  now: number
): { skills: PlayerSkills; error?: string } {
  // Сначала пересчитаем текущий прогресс
  const recalculated = recalcPlayerSkills(skills, now);
  
  const levels = { ...recalculated.levels };
  const newQueue: SkillQueueItem[] = [];
  const currentTraining = recalculated.currentTraining;

  for (const item of queue) {
    const skill = SKILLS_BY_ID[item.skillId];
    if (!skill) return { skills: recalculated, error: `Неизвестный навык: ${item.skillId}` };
    if (item.targetLevel < 1 || item.targetLevel > skill.maxLevel) {
      return { skills: recalculated, error: `Недопустимый уровень для ${skill.name}` };
    }
    const current = levels[item.skillId] ?? 0;
    if (item.targetLevel <= current) continue; // уже прокачан
    
    // Если это текущий обучающийся навык с тем же targetLevel, сохраняем его startTime
    let startTime = 0;
    if (currentTraining && 
        currentTraining.skillId === item.skillId && 
        currentTraining.targetLevel === item.targetLevel) {
      startTime = currentTraining.startTime;
    }
    
    newQueue.push({ skillId: item.skillId, targetLevel: item.targetLevel, startTime });
  }

  const updated: PlayerSkills = {
    totalSp: recalculated.totalSp,
    levels,
    queue: newQueue,
    currentTraining: null,
  };

  if (newQueue.length > 0) {
    // Если первый элемент уже обучался, используем его startTime, иначе now
    const firstItem = newQueue[0];
    updated.currentTraining = {
      skillId: firstItem.skillId,
      targetLevel: firstItem.targetLevel,
      startTime: firstItem.startTime > 0 ? firstItem.startTime : now,
    };
  }

  return { skills: updated };
}

export { createEmptySkills };

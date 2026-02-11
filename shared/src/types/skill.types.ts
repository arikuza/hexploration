/**
 * Система навыков в стиле Eve Online
 * Три ветки: Combat, Social, Craft
 * Обучение в реальном времени (включая офлайн)
 */

/** Категория навыка */
export enum SkillCategory {
  COMBAT = 'combat',
  SOCIAL = 'social',
  CRAFT = 'craft',
}

/** Описание навыка из справочника */
export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  maxLevel: number; // 1-5 (уровни I-V)
  description: string;
  /** Бонусы по уровням (I–V) для тултипа */
  levelBonuses?: string;
  /** SP в час при обучении (для расчёта прогресса) */
  spPerHour: number;
  /** SP, требуемые для перехода на уровень (индекс = уровень 1..5) */
  spForLevel: number[];
}

/** Элемент очереди обучения */
export interface SkillQueueItem {
  skillId: string;
  targetLevel: number;
  startTime: number; // timestamp начала обучения
}

/** Текущее обучение (один навык в работе) */
export interface CurrentTraining {
  skillId: string;
  targetLevel: number;
  startTime: number;
}

/** Навыки игрока */
export interface PlayerSkills {
  /** Накопленные SP (опционально, для отображения) */
  totalSp: number;
  /** Текущие уровни: skillId -> level (0-5) */
  levels: Record<string, number>;
  /** Очередь на обучение */
  queue: SkillQueueItem[];
  /** Сейчас обучается (null если очередь пуста) */
  currentTraining: CurrentTraining | null;
}

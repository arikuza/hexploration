import { SkillCategory, Skill } from '../types/skill.types.js';

/**
 * Для тестирования: 1 минута (60 сек) на каждый уровень навыка.
 * spPerHour = 3600 => 1 SP/сек => 60 SP за минуту.
 * Каждый уровень требует 60 SP.
 */
export const SKILL_TRAINING_SECONDS_PER_LEVEL = 60;
export const SKILL_SP_PER_HOUR = 3600; // 1 SP/сек
export const SKILL_SP_PER_LEVEL = 60;   // 60 SP = 1 минута

/** SP, требуемые для перехода на уровень (индекс 0 = уровень I, 4 = уровень V) */
export const DEFAULT_SP_FOR_LEVEL = [
  SKILL_SP_PER_LEVEL, // 0->1
  SKILL_SP_PER_LEVEL, // 1->2
  SKILL_SP_PER_LEVEL, // 2->3
  SKILL_SP_PER_LEVEL, // 3->4
  SKILL_SP_PER_LEVEL, // 4->5
];

/** Справочник всех навыков */
export const SKILLS: Skill[] = [
  // --- Combat ---
  {
    id: 'frigate_command',
    name: 'Управление фрегатом',
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: 'Бонус к скорости и манёвренности кораблей',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'small_lasers',
    name: 'Малокалиберные лазеры',
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: 'Бонус к урону лазерного оружия',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'energy_systems',
    name: 'Энергетические системы',
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: 'Бонус к maxEnergy и регенерации энергии',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'combat_tactics',
    name: 'Тактика боя',
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: 'Общие боевые бонусы',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  // --- Social ---
  {
    id: 'trading',
    name: 'Торговля',
    category: SkillCategory.SOCIAL,
    maxLevel: 5,
    description: 'Снижение комиссий, улучшение buy/sell orders',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'negotiation',
    name: 'Переговоры',
    category: SkillCategory.SOCIAL,
    maxLevel: 5,
    description: 'Бонусы к торговым сделкам',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'social_connections',
    name: 'Социальные связи',
    category: SkillCategory.SOCIAL,
    maxLevel: 5,
    description: 'Улучшение взаимодействия с игроками',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'economics',
    name: 'Экономика',
    category: SkillCategory.SOCIAL,
    maxLevel: 5,
    description: 'Бонусы к процентам и торговым операциям',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  // --- Craft ---
  {
    id: 'ship_production',
    name: 'Производство кораблей',
    category: SkillCategory.CRAFT,
    maxLevel: 5,
    description: 'Эффективность создания кораблей',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'module_production',
    name: 'Создание модулей',
    category: SkillCategory.CRAFT,
    maxLevel: 5,
    description: 'Эффективность создания модулей',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'resource_processing',
    name: 'Обработка ресурсов',
    category: SkillCategory.CRAFT,
    maxLevel: 5,
    description: 'Эффективность обработки сырья',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
  {
    id: 'research',
    name: 'Исследования',
    category: SkillCategory.CRAFT,
    maxLevel: 5,
    description: 'Скорость исследований и разработок',
    spPerHour: SKILL_SP_PER_HOUR,
    spForLevel: [...DEFAULT_SP_FOR_LEVEL],
  },
];

export const SKILLS_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

/** SP, нужные для перехода с currentLevel на targetLevel */
export function getSpRequiredForLevels(skill: Skill, currentLevel: number, targetLevel: number): number {
  let total = 0;
  for (let i = currentLevel; i < targetLevel && i < skill.spForLevel.length; i++) {
    total += skill.spForLevel[i];
  }
  return total;
}

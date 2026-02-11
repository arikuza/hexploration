/**
 * Типы квестов
 */
export enum QuestType {
  KILL_ENEMIES = 'kill_enemies',
  DELIVER_RESOURCES = 'deliver_resources',
}

/**
 * Цель квеста (универсальная)
 */
export interface QuestTarget {
  /** Для KILL_ENEMIES — количество врагов */
  killCount?: number;
  /** Для DELIVER_RESOURCES — itemId и количество */
  itemId?: string;
  deliverQuantity?: number;
}

/**
 * Квест
 */
export interface Quest {
  id: string;
  stationId: string;
  hexKey: string;
  createdBy: string;
  questType: QuestType;
  target: QuestTarget;
  rewardCredits: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
  expiresAt?: number;
}

/**
 * Активный квест игрока (взятый)
 */
export interface PlayerActiveQuest {
  questId: string;
  progress: number;
  /** Для KILL_ENEMIES — количество убийств */
  kills?: number;
  /** Для DELIVER_RESOURCES — количество доставлено */
  delivered?: number;
}

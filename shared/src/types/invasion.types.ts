import { HexCoordinates } from './hex.types.js';

/**
 * Состояние вторжения
 */
export interface InvasionState {
  id: string;
  sourceHexKey: string;
  sourceCoordinates: HexCoordinates;
  neighborHexKeys: string[];
  /** Оставшееся количество врагов по гексу (hexKey -> count) */
  enemyCountPerHex: Record<string, number>;
  startTime: number;
  phase: 'active' | 'cleared';
}

/**
 * Тип боя
 */
export type CombatType = 'pvp' | 'bot' | 'invasion' | 'mining';

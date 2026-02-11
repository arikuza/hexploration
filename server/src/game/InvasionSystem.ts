import { HexCoordinates } from '@hexploration/shared';
import { hexKey, hexNeighbors } from '@hexploration/shared';
import { InvasionState } from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';

/** Количество врагов на гекс при вторжении */
const INVASION_ENEMIES_PER_HEX = 3;

export class InvasionSystem {
  private invasions: Map<string, InvasionState> = new Map();

  /**
   * Загрузить вторжения из БД (при старте сервера)
   */
  loadInvasions(invasions: InvasionState[]): void {
    this.invasions.clear();
    for (const inv of invasions) {
      if (inv.phase === 'active') {
        this.invasions.set(inv.sourceHexKey, inv);
      }
    }
    console.log(`🚨 [INVASION] Загружено ${this.invasions.size} вторжений из БД`);
  }

  /**
   * Запустить вторжение при падении УУ до 0
   */
  startInvasion(sourceCoords: HexCoordinates): InvasionState | null {
    const sourceKey = hexKey(sourceCoords);
    if (this.invasions.has(sourceKey)) {
      return null; // Вторжение уже идёт
    }

    const neighbors = hexNeighbors(sourceCoords);
    const neighborHexKeys = neighbors.map(h => hexKey(h));
    const enemyCountPerHex: Record<string, number> = {};
    neighborHexKeys.forEach(k => { enemyCountPerHex[k] = INVASION_ENEMIES_PER_HEX; });

    const invasion: InvasionState = {
      id: uuidv4(),
      sourceHexKey: sourceKey,
      sourceCoordinates: sourceCoords,
      neighborHexKeys,
      enemyCountPerHex,
      startTime: Date.now(),
      phase: 'active',
    };

    this.invasions.set(sourceKey, invasion);
    console.log(`🚨 [INVASION] Вторжение в системе [${sourceCoords.q}, ${sourceCoords.r}], соседние гексы: ${neighborHexKeys.join(', ')}`);
    return invasion;
  }

  getInvasion(sourceHexKey: string): InvasionState | undefined {
    return this.invasions.get(sourceHexKey);
  }

  getInvasionById(invasionId: string): InvasionState | undefined {
    for (const inv of this.invasions.values()) {
      if (inv.id === invasionId) return inv;
    }
    return undefined;
  }

  getInvasionByHex(hexKeyStr: string): InvasionState | undefined {
    for (const inv of this.invasions.values()) {
      if (inv.sourceHexKey === hexKeyStr || inv.neighborHexKeys.includes(hexKeyStr)) {
        return inv;
      }
    }
    return undefined;
  }

  /** Уменьшить счётчик врагов в гексе (при убийстве в бою) */
  decrementEnemies(invasionId: string, hexKeyStr: string, count: number = 1): boolean {
    for (const inv of this.invasions.values()) {
      if (inv.id === invasionId && inv.enemyCountPerHex[hexKeyStr] !== undefined) {
        inv.enemyCountPerHex[hexKeyStr] = Math.max(0, inv.enemyCountPerHex[hexKeyStr] - count);
        return true;
      }
    }
    return false;
  }

  /** Вернуть врагов в гекс (если игрок проиграл бой — инвайдеры остаются) */
  incrementEnemies(invasionId: string, hexKeyStr: string, count: number = 1): boolean {
    for (const inv of this.invasions.values()) {
      if (inv.id === invasionId && inv.enemyCountPerHex[hexKeyStr] !== undefined) {
        inv.enemyCountPerHex[hexKeyStr] = (inv.enemyCountPerHex[hexKeyStr] ?? 0) + count;
        return true;
      }
    }
    return false;
  }

  /** Проверить, очищено ли вторжение (все враги убиты) */
  isCleared(invasion: InvasionState): boolean {
    return Object.values(invasion.enemyCountPerHex).every(c => c <= 0);
  }

  /** Завершить вторжение и вернуть sourceHexKey для поднятия УУ */
  clearInvasion(sourceHexKey: string): InvasionState | null {
    const inv = this.invasions.get(sourceHexKey);
    if (!inv) return null;
    inv.phase = 'cleared';
    this.invasions.delete(sourceHexKey);
    return inv;
  }

  getAllActive(): InvasionState[] {
    return Array.from(this.invasions.values()).filter(i => i.phase === 'active');
  }

  /** Получить врагов в гексе для боя вторжения */
  getEnemyCountForHex(invasionId: string, hexKeyStr: string): number {
    for (const inv of this.invasions.values()) {
      if (inv.id === invasionId) {
        return inv.enemyCountPerHex[hexKeyStr] ?? 0;
      }
    }
    return 0;
  }
}

import { InvasionModel } from '../models/Invasion.js';
import type { InvasionState } from '@hexploration/shared';

/**
 * Сервис для работы с вторжениями в БД
 */
export class InvasionService {
  /**
   * Загрузить все активные вторжения из БД
   */
  static async loadInvasions(): Promise<InvasionState[]> {
    try {
      const docs = await InvasionModel.find({ phase: 'active' });
      return docs.map(doc => ({
        id: doc.invasionId,
        sourceHexKey: doc.sourceHexKey,
        sourceCoordinates: doc.sourceCoordinates,
        neighborHexKeys: doc.neighborHexKeys ?? [],
        enemyCountPerHex: doc.enemyCountPerHex ?? {},
        startTime: doc.startTime,
        phase: doc.phase as 'active' | 'cleared',
      }));
    } catch (error) {
      console.error('❌ Ошибка загрузки вторжений:', error);
      return [];
    }
  }

  /**
   * Сохранить все активные вторжения в БД
   * Удаляет из БД вторжения, которых нет в списке
   */
  static async saveInvasions(invasions: InvasionState[]): Promise<void> {
    try {
      const active = invasions.filter(i => i.phase === 'active');
      const ids = active.map(i => i.id);

      // Удалить из БД те, которых нет в текущем списке
      await InvasionModel.deleteMany({ phase: 'active', invasionId: { $nin: ids } });

      for (const inv of active) {
        await InvasionModel.findOneAndUpdate(
          { invasionId: inv.id },
          {
            invasionId: inv.id,
            sourceHexKey: inv.sourceHexKey,
            sourceCoordinates: inv.sourceCoordinates,
            neighborHexKeys: inv.neighborHexKeys,
            enemyCountPerHex: inv.enemyCountPerHex,
            startTime: inv.startTime,
            phase: inv.phase,
          },
          { upsert: true, new: true }
        );
      }

      if (active.length > 0) {
        console.log(`💾 Вторжения сохранены: ${active.length} активных`);
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения вторжений:', error);
    }
  }
}

import { PlanetarySystemModel } from '../models/PlanetarySystem.js';
import { PlanetarySystem } from '@hexploration/shared';

/**
 * Сервис для работы с планетарными системами в БД
 */
export class PlanetarySystemService {
  /**
   * Загрузить планетарную систему по ключу гекса
   */
  static async loadByHexKey(hexKey: string): Promise<PlanetarySystem | null> {
    try {
      const doc = await PlanetarySystemModel.findOne({ hexKey });
      if (!doc) return null;
      return doc.system as PlanetarySystem;
    } catch (error) {
      console.error('❌ Ошибка загрузки планетарной системы:', error);
      return null;
    }
  }

  /**
   * Сохранить планетарную систему
   */
  static async save(system: PlanetarySystem): Promise<void> {
    try {
      const hexKey = `${system.hexCoordinates.q},${system.hexCoordinates.r}`;
      await PlanetarySystemModel.findOneAndUpdate(
        { hexKey },
        {
          hexKey,
          system,
          lastUpdate: new Date(),
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('❌ Ошибка сохранения планетарной системы:', error);
      throw error;
    }
  }

  /**
   * Сохранить несколько планетарных систем
   */
  static async saveMany(systems: PlanetarySystem[]): Promise<void> {
    const ops = systems.map((system) => {
      const hexKey = `${system.hexCoordinates.q},${system.hexCoordinates.r}`;
      return {
        updateOne: {
          filter: { hexKey },
          update: {
            hexKey,
            system,
            lastUpdate: new Date(),
          },
          upsert: true,
        },
      };
    });
    if (ops.length === 0) return;
    await PlanetarySystemModel.bulkWrite(ops);
  }

  /**
   * Удалить планетарную систему по ключу гекса
   */
  static async deleteByHexKey(hexKey: string): Promise<boolean> {
    const result = await PlanetarySystemModel.deleteOne({ hexKey });
    return (result.deletedCount ?? 0) > 0;
  }
}

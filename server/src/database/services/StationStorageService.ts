import { StationStorage } from '@hexploration/shared';
import { StationStorageModel } from '../models/StationStorage.js';

/**
 * Сервис для работы с хранилищами станций
 */
export class StationStorageService {
  /**
   * Загрузить хранилище станции
   */
  static async loadStorage(stationId: string): Promise<StationStorage | null> {
    try {
      const doc = await StationStorageModel.findOne({ stationId }).lean();
      if (!doc) {
        return null;
      }
      return doc.storage as StationStorage;
    } catch (error) {
      console.error('Ошибка загрузки хранилища станции:', error);
      return null;
    }
  }

  /**
   * Сохранить хранилище станции
   */
  static async saveStorage(storage: StationStorage): Promise<boolean> {
    try {
      await StationStorageModel.findOneAndUpdate(
        { stationId: storage.stationId },
        {
          stationId: storage.stationId,
          storage: JSON.parse(JSON.stringify(storage)),
          lastUpdate: new Date(),
        },
        { upsert: true }
      );
      return true;
    } catch (error) {
      console.error('Ошибка сохранения хранилища станции:', error);
      return false;
    }
  }

  /**
   * Создать новое хранилище для станции
   */
  static async createStorage(stationId: string): Promise<StationStorage> {
    const storage: StationStorage = {
      stationId,
      items: [],
      ships: [],
      maxShipSlots: 10,
    };

    await this.saveStorage(storage);
    return storage;
  }

  /**
   * Убедиться что хранилище существует (создать если нет)
   */
  static async ensureStorage(stationId: string): Promise<StationStorage> {
    let storage = await this.loadStorage(stationId);
    if (!storage) {
      storage = await this.createStorage(stationId);
    }
    return storage;
  }
}

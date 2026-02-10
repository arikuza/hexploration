import { GameWorldModel } from '../models/GameWorld.js';
import { HexMap, GamePhase } from '@hexploration/shared';

/**
 * Сервис для работы с состоянием игрового мира
 */
export class GameWorldService {
  /**
   * Загрузить состояние мира из БД
   */
  static async loadWorld(): Promise<{ phase: GamePhase; map: HexMap } | null> {
    try {
      const world = await GameWorldModel.findOne({ worldId: 'main' });
      
      if (!world) {
        console.log('🗺️ Мир не найден в БД, будет создан новый');
        return null;
      }

      console.log(`🗺️ Загружен мир из БД: ${world.cells.length} гексов, фаза: ${world.phase}`);

      // Восстановить Map из массива
      const cellsMap = new Map<string, any>();
      world.cells.forEach((cell) => {
        cellsMap.set(cell.key, {
          coordinates: cell.coordinates,
          systemType: cell.systemType,
          threat: cell.threat,
          owner: cell.owner,
          resources: cell.resources,
          discoveredBy: cell.discoveredBy || [],
          hasStation: cell.hasStation,
          lastDecayCheck: cell.lastDecayCheck,
          planetarySystemId: cell.planetarySystemId,
        });
      });

      return {
        phase: world.phase as GamePhase,
        map: {
          radius: world.mapRadius,
          cells: cellsMap,
        },
      };
    } catch (error) {
      console.error('❌ Ошибка загрузки мира:', error);
      return null;
    }
  }

  /**
   * Сохранить состояние мира в БД
   */
  static async saveWorld(phase: GamePhase, map: HexMap): Promise<void> {
    try {
      // Конвертировать Map в массив для MongoDB
      const cellsArray = Array.from(map.cells.entries()).map(([key, cell]) => ({
        key,
        coordinates: cell.coordinates,
        systemType: cell.systemType,
        threat: cell.threat,
        owner: cell.owner,
        resources: cell.resources,
        discoveredBy: cell.discoveredBy || [],
        hasStation: cell.hasStation,
        lastDecayCheck: cell.lastDecayCheck,
        planetarySystemId: cell.planetarySystemId,
      }));

      await GameWorldModel.findOneAndUpdate(
        { worldId: 'main' },
        {
          phase,
          mapRadius: map.radius,
          cells: cellsArray,
          lastUpdate: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`💾 Мир сохранён: ${cellsArray.length} гексов`);
    } catch (error) {
      console.error('❌ Ошибка сохранения мира:', error);
    }
  }
}

import { PlayerData } from '../models/PlayerData.js';
import { Player } from '@hexploration/shared';

/**
 * Сервис для работы с данными игроков
 */
export class PlayerService {
  /**
   * Загрузить данные игрока из БД
   */
  static async loadPlayer(userId: string): Promise<Partial<Player> | null> {
    try {
      const playerData = await PlayerData.findOne({ userId: userId });
      
      if (!playerData) {
        return null;
      }

      return {
        id: userId,
        username: playerData.username,
        position: playerData.position,
        ship: playerData.ship,
        resources: playerData.resources,
        experience: playerData.experience,
        level: playerData.level,
      };
    } catch (error) {
      console.error('❌ Ошибка загрузки игрока:', error);
      return null;
    }
  }

  /**
   * Сохранить данные игрока в БД
   */
  static async savePlayer(player: Player): Promise<void> {
    try {
      await PlayerData.findOneAndUpdate(
        { userId: player.id },
        {
          username: player.username,
          position: player.position,
          ship: player.ship,
          resources: player.resources,
          experience: player.experience,
          level: player.level,
          lastPlayed: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`💾 Игрок сохранён: ${player.username}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения игрока:', error);
    }
  }

  /**
   * Сохранить всех активных игроков
   */
  static async saveAllPlayers(players: Map<string, Player>): Promise<void> {
    const promises = Array.from(players.values()).map(player => this.savePlayer(player));
    await Promise.all(promises);
  }
}

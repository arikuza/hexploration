import { PlayerData } from '../models/PlayerData.js';
import { Player } from '@hexploration/shared';
import { ensurePlayerSkills, recalcPlayerSkills } from '../../game/SkillSystem.js';

/**
 * Сервис для работы с данными игроков (MongoDB)
 */
export class PlayerService {
  static async loadPlayer(userId: string): Promise<Partial<Player> | null> {
    try {
      if (!userId) {
        console.error('[LOAD] userId отсутствует');
        return null;
      }

      const doc = await PlayerData.findOne({ userId }).lean();
      if (!doc) {
        console.log(`[LOAD] userId=${userId} не найден в БД`);
        return null;
      }
      console.log(`[LOAD OK] userId=${userId}, позиция q=${doc.position?.q} r=${doc.position?.r}, навыки queue=${(doc.skills as any)?.queue?.length || 0}`);

      const pos = doc.position as { q?: number; r?: number } | undefined;
      const position = pos != null
        ? { q: Number(pos.q ?? 0), r: Number(pos.r ?? 0) }
        : { q: 0, r: 0 };

      let skills = ensurePlayerSkills(doc.skills as any);
      skills = recalcPlayerSkills(skills, Date.now());

      return {
        id: userId,
        username: doc.username,
        position,
        ship: doc.ship,
        resources: doc.resources ?? 100,
        experience: doc.experience ?? 0,
        level: doc.level ?? 1,
        skills,
      };
    } catch (error) {
      console.error('Ошибка загрузки игрока:', error);
      return null;
    }
  }

  static async savePlayer(player: Player): Promise<boolean> {
    try {
      if (!player.id) {
        console.error(`[SAVE] player.id отсутствует для ${player.username}`);
        return false;
      }

      const position = player.position != null
        ? { q: Number(player.position.q), r: Number(player.position.r) }
        : { q: 0, r: 0 };

      const update: any = {
        userId: player.id,
        username: player.username,
        position,
        ship: player.ship,
        resources: player.resources ?? 100,
        experience: player.experience ?? 0,
        level: player.level ?? 1,
        lastPlayed: new Date(),
      };
      if (player.skills) {
        update.skills = JSON.parse(JSON.stringify(player.skills));
      }

      console.log(`[SAVE] Сохранение userId=${player.id}, username=${player.username}, позиция=`, position);

      const result = await PlayerData.findOneAndUpdate(
        { userId: player.id },
        { $set: update },
        { upsert: true, new: true }
      );

      if (!result) {
        console.error(`[SAVE FAIL] userId=${player.id} - findOneAndUpdate вернул null`);
        return false;
      }

      console.log(`[SAVE OK] userId=${player.id} сохранён успешно`);
      return true;
    } catch (error: any) {
      console.error(`[SAVE ERROR] userId=${player.id}:`, error?.message || error);
      if (error?.stack) console.error(error.stack);
      return false;
    }
  }

  static async saveAllPlayers(players: Map<string, Player>): Promise<void> {
    const promises = Array.from(players.values()).map((p) => this.savePlayer(p));
    await Promise.all(promises);
  }
}

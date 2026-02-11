import { QuestModel } from '../models/Quest.js';
import { Quest, QuestType } from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';

export class QuestService {
  static async create(
    stationId: string,
    hexKey: string,
    createdBy: string,
    questType: QuestType,
    target: { killCount?: number; itemId?: string; deliverQuantity?: number },
    rewardCredits: number,
    expiresAt?: number
  ): Promise<Quest | null> {
    const quest: Quest = {
      id: uuidv4(),
      stationId,
      hexKey,
      createdBy,
      questType,
      target,
      rewardCredits,
      status: 'active',
      createdAt: Date.now(),
      expiresAt,
    };
    await QuestModel.create({
      questId: quest.id,
      stationId: quest.stationId,
      hexKey: quest.hexKey,
      createdBy: quest.createdBy,
      questType: quest.questType,
      target: quest.target,
      rewardCredits: quest.rewardCredits,
      status: quest.status,
      createdAt: quest.createdAt,
      expiresAt: quest.expiresAt,
    });
    return quest;
  }

  static async getAllActive(): Promise<Quest[]> {
    const docs = await QuestModel.find({ status: 'active' }).lean();
    return docs.map(d => ({
      id: d.questId,
      stationId: d.stationId,
      hexKey: d.hexKey,
      createdBy: d.createdBy,
      questType: d.questType as QuestType,
      target: d.target,
      rewardCredits: d.rewardCredits,
      status: d.status as Quest['status'],
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
    }));
  }

  static async getByStation(stationId: string, status?: 'active' | 'completed' | 'cancelled'): Promise<Quest[]> {
    const filter: any = { stationId };
    if (status) filter.status = status;
    const docs = await QuestModel.find(filter).lean();
    return docs.map(d => ({
      id: d.questId,
      stationId: d.stationId,
      hexKey: d.hexKey,
      createdBy: d.createdBy,
      questType: d.questType as QuestType,
      target: d.target,
      rewardCredits: d.rewardCredits,
      status: d.status as Quest['status'],
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
    }));
  }

  static async getById(questId: string): Promise<Quest | null> {
    const doc = await QuestModel.findOne({ questId }).lean();
    if (!doc) return null;
    return {
      id: doc.questId,
      stationId: doc.stationId,
      hexKey: doc.hexKey,
      createdBy: doc.createdBy,
      questType: doc.questType as QuestType,
      target: doc.target,
      rewardCredits: doc.rewardCredits,
      status: doc.status as Quest['status'],
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };
  }

  static async setStatus(questId: string, status: 'active' | 'completed' | 'cancelled'): Promise<boolean> {
    const result = await QuestModel.updateOne({ questId }, { $set: { status } });
    return result.modifiedCount > 0;
  }
}

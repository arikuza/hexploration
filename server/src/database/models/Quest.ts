import mongoose, { Schema, Document } from 'mongoose';
import { QuestType } from '@hexploration/shared';

export interface IQuest extends Document {
  questId: string;
  stationId: string;
  hexKey: string;
  createdBy: string;
  questType: QuestType;
  target: { killCount?: number; itemId?: string; deliverQuantity?: number };
  rewardCredits: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
  expiresAt?: number;
}

const QuestSchema = new Schema<IQuest>({
  questId: { type: String, required: true, unique: true },
  stationId: { type: String, required: true },
  hexKey: { type: String, required: true },
  createdBy: { type: String, required: true },
  questType: { type: String, required: true, enum: Object.values(QuestType) },
  target: { type: Schema.Types.Mixed, required: true },
  rewardCredits: { type: Number, required: true },
  status: { type: String, required: true, enum: ['active', 'completed', 'cancelled'] },
  createdAt: { type: Number, required: true },
  expiresAt: { type: Number, required: false },
});

QuestSchema.index({ stationId: 1, status: 1 });
QuestSchema.index({ questId: 1 });

export const QuestModel = mongoose.model<IQuest>('Quest', QuestSchema);

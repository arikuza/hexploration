import mongoose, { Schema, Document } from 'mongoose';

export interface IInvasion extends Document {
  invasionId: string;
  sourceHexKey: string;
  sourceCoordinates: { q: number; r: number };
  neighborHexKeys: string[];
  enemyCountPerHex: Record<string, number>;
  startTime: number;
  phase: 'active' | 'cleared';
}

const InvasionSchema = new Schema<IInvasion>({
  invasionId: { type: String, required: true, unique: true },
  sourceHexKey: { type: String, required: true },
  sourceCoordinates: {
    q: { type: Number, required: true },
    r: { type: Number, required: true },
  },
  neighborHexKeys: [String],
  enemyCountPerHex: { type: Schema.Types.Mixed, default: {} },
  startTime: { type: Number, required: true },
  phase: { type: String, required: true, enum: ['active', 'cleared'] },
});

InvasionSchema.index({ sourceHexKey: 1 });
InvasionSchema.index({ phase: 1 });

export const InvasionModel = mongoose.model<IInvasion>('Invasion', InvasionSchema);

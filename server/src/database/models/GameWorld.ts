import mongoose, { Schema, Document } from 'mongoose';
import { HexCell, GamePhase } from '@hexploration/shared';

export interface IGameWorld extends Document {
  worldId: string; // 'main' - единственный мир
  phase: GamePhase;
  mapRadius: number;
  cells: Array<{
    key: string; // "q,r"
    coordinates: { q: number; r: number };
    systemType: string;
    threat: number;
    owner?: string;
    resources?: number;
    discoveredBy?: string[];
    hasStation?: boolean;
    lastDecayCheck?: number;
  }>;
  lastUpdate: Date;
}

const GameWorldSchema = new Schema<IGameWorld>({
  worldId: {
    type: String,
    required: true,
    unique: true,
    default: 'main',
  },
  phase: {
    type: String,
    enum: Object.values(GamePhase),
    default: GamePhase.LOBBY,
  },
  mapRadius: {
    type: Number,
    required: true,
  },
  cells: [{
    key: String,
    coordinates: {
      q: Number,
      r: Number,
    },
    systemType: String,
    threat: Number,
    owner: String,
    resources: Number,
    discoveredBy: [String],
    hasStation: Boolean,
    lastDecayCheck: Number,
  }],
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

// Индекс для быстрого поиска
GameWorldSchema.index({ worldId: 1 });

export const GameWorldModel = mongoose.model<IGameWorld>('GameWorld', GameWorldSchema);

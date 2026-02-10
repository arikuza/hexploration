import mongoose, { Schema, Document } from 'mongoose';
import { HexCoordinates, Ship } from '@hexploration/shared';

export interface IPlayerData extends Document {
  userId: string;
  username: string;
  position: HexCoordinates;
  ship: Ship;
  resources: number;
  experience: number;
  level: number;
  lastPlayed: Date;
}

const PlayerDataSchema = new Schema<IPlayerData>({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  position: {
    q: { type: Number, required: true },
    r: { type: Number, required: true },
  },
  ship: {
    id: String,
    name: String,
    type: String,
    health: Number,
    maxHealth: Number,
    energy: Number,
    maxEnergy: Number,
    speed: Number,
    turnRate: Number,
    weapons: [{
      id: String,
      name: String,
      type: String,
      damage: Number,
      energyCost: Number,
      cooldown: Number,
      projectileSpeed: Number,
      range: Number,
    }],
  },
  resources: {
    type: Number,
    default: 100,
  },
  experience: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  lastPlayed: {
    type: Date,
    default: Date.now,
  },
});

PlayerDataSchema.index({ userId: 1 });

export const PlayerData = mongoose.model<IPlayerData>('PlayerData', PlayerDataSchema);

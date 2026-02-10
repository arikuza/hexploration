import mongoose, { Schema, Document } from 'mongoose';
import { HexCoordinates, Ship, PlayerSkills } from '@hexploration/shared';

export interface IPlayerData extends Document {
  userId: string;
  username: string;
  position: HexCoordinates;
  ship: Ship;
  resources: number;
  experience: number;
  level: number;
  lastPlayed: Date;
  skills?: PlayerSkills;
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
    type: Schema.Types.Mixed,
    required: false,
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
  skills: {
    type: Schema.Types.Mixed,
    required: false,
  },
});

PlayerDataSchema.index({ userId: 1 });

export const PlayerData = mongoose.model<IPlayerData>('PlayerData', PlayerDataSchema);

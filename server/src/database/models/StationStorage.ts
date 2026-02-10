import mongoose, { Schema, Document } from 'mongoose';
import { StationStorage as IStationStorage } from '@hexploration/shared';

/**
 * Документ хранилища станции в БД
 */
export interface IStationStorageDocument extends Document {
  stationId: string;
  storage: IStationStorage;
  lastUpdate: Date;
}

const StationStorageSchema = new Schema<IStationStorageDocument>(
  {
    stationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    storage: {
      type: Schema.Types.Mixed,
      required: true,
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'station_storages',
    strict: false,
  }
);

StationStorageSchema.index({ stationId: 1 });

export const StationStorageModel = mongoose.model<IStationStorageDocument>(
  'StationStorage',
  StationStorageSchema
);

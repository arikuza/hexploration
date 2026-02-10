import mongoose, { Schema, Document } from 'mongoose';
import { PlanetarySystem as IPlanetarySystem } from '@hexploration/shared';

/**
 * Документ планетарной системы в БД.
 * Поле system хранит полную структуру из shared/types/planetary.types.ts
 */
export interface IPlanetarySystemDocument extends Document {
  /** Ключ гекса "q,r" — уникальная связь с ячейкой карты */
  hexKey: string;
  /** Полные данные планетарной системы */
  system: IPlanetarySystem;
  /** Время последнего обновления */
  lastUpdate: Date;
}

const PlanetarySystemSchema = new Schema<IPlanetarySystemDocument>(
  {
    hexKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    system: {
      type: Schema.Types.Mixed,
      required: true,
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'planetary_systems',
    strict: false, // разрешаем поля из IPlanetarySystem без перечисления в схеме
  }
);

PlanetarySystemSchema.index({ hexKey: 1 });

export const PlanetarySystemModel = mongoose.model<IPlanetarySystemDocument>(
  'PlanetarySystem',
  PlanetarySystemSchema
);

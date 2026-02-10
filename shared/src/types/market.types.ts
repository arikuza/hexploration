/**
 * Тип торгового ордера
 */
export enum OrderType {
  BUY = 'buy',                     // Ордер на покупку
  SELL = 'sell',                   // Ордер на продажу
}

/**
 * Статус ордера
 */
export enum OrderStatus {
  ACTIVE = 'active',               // Активный ордер
  FILLED = 'filled',               // Полностью выполнен
  CANCELLED = 'cancelled',         // Отменён
  EXPIRED = 'expired',             // Истёк срок действия
}

/**
 * Торговый ордер
 */
export interface MarketOrder {
  id: string;
  stationId: string;
  playerId: string;
  type: OrderType;
  itemId: string;
  price: number;                   // Цена за единицу
  quantity: number;                // Количество
  filledQuantity: number;          // Уже выполнено
  status: OrderStatus;
  createdAt: number;               // Timestamp создания
  expiresAt?: number;              // Timestamp истечения (опционально)
}

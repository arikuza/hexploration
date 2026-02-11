import { Player, MarketOrder, OrderType, OrderStatus, StationStorage } from '@hexploration/shared';
import { ITEM_REGISTRY, getItem } from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Система торговых ордеров
 */
export class MarketSystem {
  /**
   * Создать торговый ордер
   */
  static createOrder(
    playerId: string,
    stationId: string,
    type: OrderType,
    itemId: string,
    price: number,
    quantity: number,
    expiresAt?: number
  ): { success: boolean; order?: MarketOrder; error?: string } {
    if (price <= 0) {
      return { success: false, error: 'Цена должна быть больше нуля' };
    }

    if (quantity <= 0) {
      return { success: false, error: 'Количество должно быть больше нуля' };
    }

    const item = getItem(itemId);
    if (!item) {
      return { success: false, error: 'Предмет не найден' };
    }

    // Для ордеров на продажу проверить наличие предметов на станции
    // Для ордеров на покупку проверить наличие кредитов (будет проверено при выполнении)

    const order: MarketOrder = {
      id: uuidv4(),
      stationId,
      playerId,
      type,
      itemId,
      price,
      quantity,
      filledQuantity: 0,
      status: OrderStatus.ACTIVE,
      createdAt: Date.now(),
      expiresAt,
    };

    return { success: true, order };
  }

  /**
   * Отменить ордер
   */
  static cancelOrder(
    orderId: string,
    playerId: string,
    orders: MarketOrder[]
  ): { success: boolean; error?: string } {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return { success: false, error: 'Ордер не найден' };
    }

    if (order.playerId !== playerId) {
      return { success: false, error: 'Это не ваш ордер' };
    }

    if (order.status !== OrderStatus.ACTIVE) {
      return { success: false, error: 'Ордер уже не активен' };
    }

    order.status = OrderStatus.CANCELLED;
    return { success: true };
  }

  /**
   * Выполнить ордер (купить/продать)
   */
  static executeOrder(
    playerId: string,
    orderId: string,
    quantity: number,
    player: Player,
    stationStorage: StationStorage,
    orders: MarketOrder[]
  ): { success: boolean; error?: string } {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return { success: false, error: 'Ордер не найден' };
    }

    if (order.status !== OrderStatus.ACTIVE) {
      return { success: false, error: 'Ордер не активен' };
    }

    if (order.playerId === playerId) {
      return { success: false, error: 'Нельзя выполнить свой собственный ордер' };
    }

    const availableQuantity = order.quantity - order.filledQuantity;
    if (quantity > availableQuantity) {
      return { success: false, error: `Доступно только ${availableQuantity} единиц` };
    }

    const totalCost = order.price * quantity;
    const item = getItem(order.itemId);
    if (!item) {
      return { success: false, error: 'Предмет не найден' };
    }

    if (order.type === OrderType.BUY) {
      // Игрок продаёт ордеру на покупку
      // Проверить наличие предметов у игрока на станции
      const playerStack = stationStorage.items.find(s => s.itemId === order.itemId);
      if (!playerStack || playerStack.quantity < quantity) {
        return { success: false, error: `Недостаточно ${item.name} на станции` };
      }

      // Передать предметы владельцу ордера
      const orderOwnerStack = stationStorage.items.find(s => s.itemId === order.itemId);
      if (orderOwnerStack) {
        orderOwnerStack.quantity += quantity;
      } else {
        stationStorage.items.push({ itemId: order.itemId, quantity });
      }

      // Удалить предметы у продавца
      playerStack.quantity -= quantity;
      if (playerStack.quantity <= 0) {
        const index = stationStorage.items.indexOf(playerStack);
        stationStorage.items.splice(index, 1);
      }

      // Выдать кредиты продавцу
      player.credits += totalCost;
    } else {
      // Игрок покупает у ордера на продажу
      // Проверить кредиты у игрока
      if (player.credits < totalCost) {
        return { success: false, error: `Недостаточно кредитов. Требуется: ${totalCost}, есть: ${player.credits}` };
      }

      // Передать предметы покупателю
      const buyerStack = stationStorage.items.find(s => s.itemId === order.itemId);
      if (buyerStack) {
        buyerStack.quantity += quantity;
      } else {
        stationStorage.items.push({ itemId: order.itemId, quantity });
      }

      // Списать кредиты у покупателя
      player.credits -= totalCost;
    }

    // Обновить ордер
    order.filledQuantity += quantity;
    if (order.filledQuantity >= order.quantity) {
      order.status = OrderStatus.FILLED;
    }

    return { success: true };
  }

  /**
   * Получить активные ордера на станции
   */
  static getActiveOrders(stationId: string, orders: MarketOrder[]): MarketOrder[] {
    return orders.filter(
      o => o.stationId === stationId && o.status === OrderStatus.ACTIVE
    );
  }

  /**
   * Проверить истечение срока действия ордеров
   */
  static checkExpiredOrders(orders: MarketOrder[]): void {
    const now = Date.now();
    for (const order of orders) {
      if (order.status === OrderStatus.ACTIVE && order.expiresAt && order.expiresAt < now) {
        order.status = OrderStatus.EXPIRED;
      }
    }
  }
}

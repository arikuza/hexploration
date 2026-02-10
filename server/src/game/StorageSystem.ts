import { Player, Ship, ItemStack, CargoHold, StationStorage, CargoTransfer } from '@hexploration/shared';
import { ITEM_REGISTRY, getItem } from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Система управления хранилищами (трюм корабля и хранилище станции)
 */
export class StorageSystem {
  /**
   * Получить трюм корабля игрока
   */
  static getShipCargo(player: Player): CargoHold {
    if (!player.ship.cargoHold) {
      // Инициализировать трюм если его нет с начальными ресурсами
      const cargoCapacity = this.getCargoCapacity(player.ship.type);
      player.ship.cargoHold = {
        capacity: cargoCapacity,
        items: [
          { itemId: 'iron_ore', quantity: 50 },
          { itemId: 'copper_ore', quantity: 50 },
          { itemId: 'energy_crystal', quantity: 50 },
          { itemId: 'rare_metal', quantity: 20 },
        ],
      };
    } else if (player.ship.cargoHold.items.length === 0) {
      // Если трюм пуст, добавить начальные ресурсы
      player.ship.cargoHold.items = [
        { itemId: 'iron_ore', quantity: 50 },
        { itemId: 'copper_ore', quantity: 50 },
        { itemId: 'energy_crystal', quantity: 50 },
        { itemId: 'rare_metal', quantity: 20 },
      ];
    }
    return player.ship.cargoHold;
  }

  /**
   * Получить вместимость трюма для типа корабля
   */
  static getCargoCapacity(shipType: string): number {
    const capacities: Record<string, number> = {
      scout: 50,
      fighter: 100,
      cruiser: 200,
      support: 150,
    };
    return capacities[shipType] ?? 50;
  }

  /**
   * Вычислить объём предметов в трюме
   */
  static calculateCargoVolume(items: ItemStack[]): number {
    let totalVolume = 0;
    for (const stack of items) {
      const item = getItem(stack.itemId);
      if (item) {
        totalVolume += item.volume * stack.quantity;
      }
    }
    return totalVolume;
  }

  /**
   * Проверить, можно ли добавить предметы в трюм
   */
  static canAddToCargo(cargoHold: CargoHold, itemId: string, quantity: number): boolean {
    const item = getItem(itemId);
    if (!item) return false;

    const currentVolume = this.calculateCargoVolume(cargoHold.items);
    const additionalVolume = item.volume * quantity;
    return currentVolume + additionalVolume <= cargoHold.capacity;
  }

  /**
   * Добавить предметы в трюм
   */
  static addToCargo(cargoHold: CargoHold, itemId: string, quantity: number): boolean {
    if (!this.canAddToCargo(cargoHold, itemId, quantity)) {
      return false;
    }

    const existingStack = cargoHold.items.find(stack => stack.itemId === itemId);
    if (existingStack) {
      existingStack.quantity += quantity;
    } else {
      cargoHold.items.push({ itemId, quantity });
    }

    return true;
  }

  /**
   * Удалить предметы из трюма
   */
  static removeFromCargo(cargoHold: CargoHold, itemId: string, quantity: number): boolean {
    const stack = cargoHold.items.find(s => s.itemId === itemId);
    if (!stack || stack.quantity < quantity) {
      return false;
    }

    stack.quantity -= quantity;
    if (stack.quantity <= 0) {
      const index = cargoHold.items.indexOf(stack);
      cargoHold.items.splice(index, 1);
    }

    return true;
  }

  /**
   * Перенести предметы из трюма на станцию
   */
  static transferToStation(
    player: Player,
    stationStorage: StationStorage,
    transfers: CargoTransfer[]
  ): { success: boolean; error?: string } {
    const cargoHold = this.getShipCargo(player);

    // Проверить все переносы
    for (const transfer of transfers) {
      if (transfer.direction !== 'to_station') continue;
      
      const stack = cargoHold.items.find(s => s.itemId === transfer.itemId);
      if (!stack || stack.quantity < transfer.quantity) {
        return { success: false, error: `Недостаточно ${transfer.itemId} в трюме` };
      }
    }

    // Выполнить переносы
    for (const transfer of transfers) {
      if (transfer.direction !== 'to_station') continue;
      
      this.removeFromCargo(cargoHold, transfer.itemId, transfer.quantity);
      
      // Добавить на станцию
      const existingStack = stationStorage.items.find(s => s.itemId === transfer.itemId);
      if (existingStack) {
        existingStack.quantity += transfer.quantity;
      } else {
        stationStorage.items.push({
          itemId: transfer.itemId,
          quantity: transfer.quantity,
        });
      }
    }

    return { success: true };
  }

  /**
   * Загрузить предметы со станции в трюм
   */
  static transferFromStation(
    player: Player,
    stationStorage: StationStorage,
    transfers: CargoTransfer[]
  ): { success: boolean; error?: string } {
    const cargoHold = this.getShipCargo(player);

    // Проверить все переносы
    for (const transfer of transfers) {
      if (transfer.direction !== 'from_station') continue;
      
      const stack = stationStorage.items.find(s => s.itemId === transfer.itemId);
      if (!stack || stack.quantity < transfer.quantity) {
        return { success: false, error: `Недостаточно ${transfer.itemId} на станции` };
      }

      if (!this.canAddToCargo(cargoHold, transfer.itemId, transfer.quantity)) {
        return { success: false, error: `Недостаточно места в трюме для ${transfer.itemId}` };
      }
    }

    // Выполнить переносы
    for (const transfer of transfers) {
      if (transfer.direction !== 'from_station') continue;
      
      const stack = stationStorage.items.find(s => s.itemId === transfer.itemId);
      if (stack) {
        stack.quantity -= transfer.quantity;
        if (stack.quantity <= 0) {
          const index = stationStorage.items.indexOf(stack);
          stationStorage.items.splice(index, 1);
        }
      }

      this.addToCargo(cargoHold, transfer.itemId, transfer.quantity);
    }

    return { success: true };
  }

  /**
   * Сохранить корабль в ангар станции
   */
  static storeShip(
    player: Player,
    stationStorage: StationStorage,
    ship: Ship
  ): { success: boolean; error?: string } {
    if (stationStorage.ships.length >= stationStorage.maxShipSlots) {
      return { success: false, error: 'Ангар переполнен' };
    }

    // Проверить, что это не текущий корабль игрока
    if (ship.id === player.ship.id) {
      return { success: false, error: 'Нельзя сохранить текущий корабль' };
    }

    stationStorage.ships.push(ship);
    return { success: true };
  }

  /**
   * Извлечь корабль из ангара
   */
  static retrieveShip(
    stationStorage: StationStorage,
    shipId: string
  ): { success: boolean; ship?: Ship; error?: string } {
    const index = stationStorage.ships.findIndex(s => s.id === shipId);
    if (index === -1) {
      return { success: false, error: 'Корабль не найден в ангаре' };
    }

    const ship = stationStorage.ships[index];
    stationStorage.ships.splice(index, 1);
    return { success: true, ship };
  }
}

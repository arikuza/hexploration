import React, { useState } from 'react';
import { socketService } from '../../services/socketService';
import { SocketEvent, CargoTransfer, StationStorage, CargoHold, ItemStack } from '@hexploration/shared';
import { getItem } from '@hexploration/shared';
import './StorageView.css';

interface StorageViewProps {
  stationId: string;
  storage: StationStorage | null;
  cargoHold: CargoHold | null;
}

const StorageView: React.FC<StorageViewProps> = ({ stationId, storage, cargoHold }) => {
  const [transferQuantity, setTransferQuantity] = useState<number>(1);

  const handleTransfer = (direction: 'to_station' | 'from_station', itemId: string, quantity: number) => {
    const transfer: CargoTransfer = {
      itemId,
      quantity,
      direction,
    };

    socketService.emit(SocketEvent.STATION_CARGO_TRANSFER, {
      stationId,
      transfers: [transfer],
    });
  };

  const calculateVolume = (items: ItemStack[]): number => {
    let total = 0;
    for (const stack of items) {
      const item = getItem(stack.itemId);
      if (item) {
        total += item.volume * stack.quantity;
      }
    }
    return total;
  };

  const cargoVolume = cargoHold ? calculateVolume(cargoHold.items) : 0;
  const cargoCapacity = cargoHold?.capacity ?? 0;
  const cargoPercent = cargoCapacity > 0 ? (cargoVolume / cargoCapacity) * 100 : 0;

  return (
    <div className="storage-view">
      <div className="storage-section">
        <h3>Трюм корабля</h3>
        <div className="cargo-capacity">
          <div className="capacity-bar">
            <div
              className="capacity-fill"
              style={{ width: `${cargoPercent}%` }}
            />
          </div>
          <span className="capacity-text">
            {cargoVolume.toFixed(1)} / {cargoCapacity} м³
          </span>
        </div>
        <div className="item-list">
          {cargoHold?.items.length === 0 ? (
            <div className="empty-message">Трюм пуст</div>
          ) : (
            cargoHold?.items.map((stack) => {
              const item = getItem(stack.itemId);
              if (!item) return null;
              return (
                <div key={stack.itemId} className="item-row">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-quantity">x{stack.quantity}</span>
                    <span className="item-volume">{item.volume * stack.quantity} м³</span>
                  </div>
                  <button
                    className="transfer-btn"
                    onClick={() => handleTransfer('to_station', stack.itemId, stack.quantity)}
                  >
                    Выгрузить все
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="storage-section">
        <h3>Хранилище станции</h3>
        <div className="item-list">
          {storage?.items.length === 0 ? (
            <div className="empty-message">Хранилище пусто</div>
          ) : (
            storage?.items.map((stack) => {
              const item = getItem(stack.itemId);
              if (!item) return null;
              return (
                <div key={stack.itemId} className="item-row">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-quantity">x{stack.quantity}</span>
                    <span className="item-volume">{item.volume * stack.quantity} м³</span>
                  </div>
                  <div className="transfer-controls">
                    <input
                      type="number"
                      min="1"
                      max={stack.quantity}
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(Number(e.target.value))}
                      className="quantity-input"
                    />
                    <button
                      className="transfer-btn"
                      onClick={() => handleTransfer('from_station', stack.itemId, transferQuantity)}
                    >
                      Загрузить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageView;

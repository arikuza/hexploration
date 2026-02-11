import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { getItem, SocketEvent } from '@hexploration/shared';
import type { ItemStack } from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import './CargoPanel.css';

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

export const CargoPanel: React.FC = () => {
  const currentPlayer = useAppSelector((state) => state.player.currentPlayer);
  const cargoHold = currentPlayer?.ship?.cargoHold ?? null;

  const cargoVolume = cargoHold ? calculateVolume(cargoHold.items) : 0;
  const cargoCapacity = cargoHold?.capacity ?? 0;
  const cargoPercent = cargoCapacity > 0 ? (cargoVolume / cargoCapacity) * 100 : 0;

  return (
    <div className="cargo-panel">
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
        {!cargoHold || cargoHold.items.length === 0 ? (
          <div className="empty-message">Трюм пуст</div>
        ) : (
          cargoHold.items.map((stack) => {
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
                  type="button"
                  className="cargo-discard-btn"
                  onClick={() => {
                    if (window.confirm(`Выбросить ${stack.quantity} ${item.name}?`)) {
                      socketService.emit(SocketEvent.CARGO_DISCARD, { itemId: stack.itemId, quantity: stack.quantity });
                    }
                  }}
                  title="Выбросить"
                >
                  Выбросить
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

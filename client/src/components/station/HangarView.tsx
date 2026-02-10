import React from 'react';
import { socketService } from '../../services/socketService';
import { SocketEvent, StationStorage } from '@hexploration/shared';
import './HangarView.css';

interface HangarViewProps {
  stationId: string;
  storage: StationStorage | null;
}

const HangarView: React.FC<HangarViewProps> = ({ stationId, storage }) => {
  const handleStoreShip = () => {
    // TODO: Реализовать выбор корабля для сохранения
    // Пока просто показываем сообщение
    alert('Функция сохранения корабля будет реализована позже');
  };

  const handleRetrieveShip = (shipId: string) => {
    socketService.emit(SocketEvent.STATION_SHIP_RETRIEVE, {
      stationId,
      shipId,
    });
  };

  const ships = storage?.ships || [];
  const maxSlots = storage?.maxShipSlots || 10;
  const usedSlots = ships.length;

  return (
    <div className="hangar-view">
      <div className="hangar-info">
        <div className="hangar-capacity">
          <span>Использовано слотов: {usedSlots} / {maxSlots}</span>
        </div>
        <button className="store-ship-btn" onClick={handleStoreShip}>
          Сохранить текущий корабль
        </button>
      </div>

      <div className="ship-list">
        {ships.length === 0 ? (
          <div className="empty-message">Ангар пуст</div>
        ) : (
          ships.map((ship) => (
            <div key={ship.id} className="ship-card">
              <div className="ship-info">
                <h4>{ship.name}</h4>
                <div className="ship-details">
                  <span>Тип: {ship.type}</span>
                  <span>Здоровье: {ship.health} / {ship.maxHealth}</span>
                  <span>Энергия: {ship.energy} / {ship.maxEnergy}</span>
                </div>
              </div>
              <button
                className="retrieve-btn"
                onClick={() => handleRetrieveShip(ship.id)}
              >
                Извлечь
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HangarView;

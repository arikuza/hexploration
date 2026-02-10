import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { socketService } from '../../services/socketService';
import { SocketEvent } from '@hexploration/shared';
import { clearStation } from '../../store/slices/stationSlice';
import StorageView from './StorageView';
import CraftingView from './CraftingView';
import MarketView from './MarketView';
import HangarView from './HangarView';
import './StationPanel.css';

type TabType = 'storage' | 'crafting' | 'market' | 'hangar';

interface StationPanelProps {
  stationId: string;
  onClose: () => void;
}

const StationPanel: React.FC<StationPanelProps> = ({ stationId, onClose }) => {
  const dispatch = useDispatch();
  const { currentStation, storage, cargoHold, recipes, error } = useSelector(
    (state: RootState) => state.station
  );
  const [activeTab, setActiveTab] = useState<TabType>('storage');

  useEffect(() => {
    // Открыть станцию
    socketService.emit(SocketEvent.STATION_OPEN, { stationId });

    // Получить рецепты
    socketService.emit(SocketEvent.STATION_CRAFT_RECIPES_GET, { stationId });

    return () => {
      dispatch(clearStation());
    };
  }, [stationId, dispatch]);

  useEffect(() => {
    // Периодически обновлять хранилище
    const interval = setInterval(() => {
      socketService.emit(SocketEvent.STATION_STORAGE_GET, { stationId });
    }, 5000);

    return () => clearInterval(interval);
  }, [stationId]);

  if (error) {
    return (
      <div className="station-panel">
        <div className="station-panel-header">
          <h2>Станция</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="station-panel-error">{error}</div>
      </div>
    );
  }

  if (!currentStation) {
    return (
      <div className="station-panel">
        <div className="station-panel-header">
          <h2>Станция</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="station-panel-loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="station-panel">
      <div className="station-panel-header">
        <h2>{currentStation.name || 'Космическая станция'}</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="station-panel-tabs">
        <button
          className={activeTab === 'storage' ? 'active' : ''}
          onClick={() => setActiveTab('storage')}
        >
          Хранилище
        </button>
        <button
          className={activeTab === 'crafting' ? 'active' : ''}
          onClick={() => setActiveTab('crafting')}
        >
          Крафт
        </button>
        <button
          className={activeTab === 'market' ? 'active' : ''}
          onClick={() => setActiveTab('market')}
        >
          Торговля
        </button>
        <button
          className={activeTab === 'hangar' ? 'active' : ''}
          onClick={() => setActiveTab('hangar')}
        >
          Ангар
        </button>
      </div>

      <div className="station-panel-content">
        {activeTab === 'storage' && (
          <StorageView stationId={stationId} storage={storage} cargoHold={cargoHold} />
        )}
        {activeTab === 'crafting' && (
          <CraftingView stationId={stationId} recipes={recipes} />
        )}
        {activeTab === 'market' && <MarketView stationId={stationId} />}
        {activeTab === 'hangar' && <HangarView stationId={stationId} storage={storage} />}
      </div>
    </div>
  );
};

export default StationPanel;

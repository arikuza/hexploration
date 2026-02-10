import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { HexCoordinates, SocketEvent, StructureType } from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import './HexInfo.css';

interface HexInfoProps {
  selectedHex: HexCoordinates | null;
  onOpenPlanetarySystem?: (coordinates: HexCoordinates) => void;
  onOpenStation?: (stationId: string) => void;
}

export const HexInfo: React.FC<HexInfoProps> = ({ selectedHex, onOpenPlanetarySystem, onOpenStation }) => {
  const players = useAppSelector((state) => state.player.players);
  const currentPlayer = useAppSelector((state) => state.player.currentPlayer);
  const map = useAppSelector((state) => state.game.map);

  if (!selectedHex) {
    return (
      <div className="hex-info">
        <div className="hex-info-header">
          <h3>Информация о гексе</h3>
        </div>
        <div className="hex-info-content">
          <p className="hint">Выберите гекс на карте</p>
        </div>
      </div>
    );
  }

  // Получить информацию о гексе
  const hexKey = `${selectedHex.q},${selectedHex.r}`;
  // Проверяем если cells это Map или массив
  const hexCell = map?.cells
    ? Array.isArray(map.cells)
      ? map.cells.find((c: any) => c.key === hexKey)
      : (map.cells as Map<string, any>).get(hexKey)
    : null;

  // Найти всех игроков в выбранном гексе
  const playersInHex = players.filter(
    (p) => p.position.q === selectedHex.q && p.position.r === selectedHex.r
  );

  const isCurrentPlayerHere = currentPlayer && 
    currentPlayer.position.q === selectedHex.q && 
    currentPlayer.position.r === selectedHex.r;

  // Форматирование уровня угрозы
  const getThreatLabel = (threat: number): string => {
    if (threat >= 0.8) return 'Безопасно';
    if (threat >= 0.3) return 'Относительно безопасно';
    if (threat >= -0.3) return 'Умеренная опасность';
    if (threat >= -0.7) return 'Опасно';
    return 'Крайне опасно';
  };

  const getThreatColor = (threat: number): string => {
    const normalized = (1 - threat) / 2;
    const red = Math.floor(normalized * 255);
    const green = Math.floor((1 - normalized) * 255);
    return `rgb(${red}, ${green}, 30)`;
  };

  const handleBotCombat = () => {
    console.log('🤖 Начинаем бой с ботом...');
    socketService.emit('combat:start:bot');
  };

  const handleColonize = () => {
    if (!selectedHex) return;
    console.log('🏛️ Колонизируем систему...');
    socketService.emit('colonize', { coordinates: selectedHex });
  };

  const handleDevelop = () => {
    if (!selectedHex) return;
    console.log('📈 Развиваем колонию...');
    socketService.emit('develop:colony', { coordinates: selectedHex });
  };

  return (
    <div className="hex-info">
      <div className="hex-info-header">
        <h3>Гекс [{selectedHex.q}, {selectedHex.r}]</h3>
      </div>
      
      <div className="hex-info-content">
        {/* Информация о системе */}
        {hexCell && (
          <div className="hex-section">
            <h4>Планетарная система</h4>
            <div className="system-info">
              {hexCell.threat !== undefined && (
                <div className="info-row">
                  <span className="info-label">Уровень угрозы:</span>
                  <span 
                    className="info-value threat-value" 
                    style={{ color: getThreatColor(hexCell.threat) }}
                  >
                    {getThreatLabel(hexCell.threat)} ({hexCell.threat.toFixed(2)})
                  </span>
                </div>
              )}
              
              {hexCell.owner && (
                <div className="info-row">
                  <span className="info-label">Владелец:</span>
                  <span className="info-value">
                    {hexCell.owner === 'npc' ? 'NPC Фракция' : 
                     hexCell.owner === currentPlayer?.id ? 'Вы' : hexCell.owner}
                  </span>
                </div>
              )}
              
              {hexCell.hasStation && (
                <div className="info-row">
                  <span className="info-label">Станция:</span>
                  <span className="info-value">✓ Есть</span>
                </div>
              )}
              
              {hexCell.resources && hexCell.resources > 0 && (
                <div className="info-row">
                  <span className="info-label">Ресурсы:</span>
                  <span className="info-value">{hexCell.resources}</span>
                </div>
              )}
              
              {hexCell.systemType && (
                <div className="info-row">
                  <span className="info-label">Тип:</span>
                  <span className="info-value">
                    {hexCell.systemType === 'planetary' ? 'Планетарная' : 'Пустота'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hex-section">
          <h4>Игроки в гексе ({playersInHex.length})</h4>
          {playersInHex.length === 0 ? (
            <p className="empty">Гекс пуст</p>
          ) : (
            <ul className="players-in-hex">
              {playersInHex.map((player) => (
                <li key={player.id} className={player.id === currentPlayer?.id ? 'current-player' : ''}>
                  <span className="player-name">
                    {player.username}
                    {player.id === currentPlayer?.id && ' (Вы)'}
                  </span>
                  <span className="player-level">Ур. {player.level}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Кнопка открыть планетарную систему — для любого планетарного гекса */}
        {hexCell?.systemType === 'planetary' && (
          <div className="hex-section">
            <button
              type="button"
              className="colonize-button hex-open-system-btn"
              onClick={() => onOpenPlanetarySystem?.(selectedHex)}
            >
              🌌 Открыть систему
            </button>
          </div>
        )}

        {/* Кнопка открыть станцию — если есть станция и игрок здесь */}
        {hexCell?.hasStation && isCurrentPlayerHere && (
          <div className="hex-section">
            <button
              type="button"
              className="colonize-button hex-open-station-btn"
              onClick={() => {
                // Загрузить систему и найти станцию
                socketService.emit(SocketEvent.SYSTEM_GET, { coordinates: selectedHex });
                const handler = (data: any) => {
                  console.log('Получены данные системы:', data);
                  const station = data.system?.structures?.find((s: any) => s.type === StructureType.SPACE_STATION);
                  console.log('Найдена станция:', station);
                  if (station && onOpenStation) {
                    console.log('Открываем станцию:', station.id);
                    onOpenStation(station.id);
                    socketService.off(SocketEvent.SYSTEM_DATA, handler);
                  } else {
                    console.warn('Станция не найдена в системе. Структуры:', data.system?.structures);
                  }
                };
                socketService.on(SocketEvent.SYSTEM_DATA, handler);
              }}
            >
              🏭 Открыть станцию
            </button>
          </div>
        )}


        {isCurrentPlayerHere && (
          <div className="hex-actions">
            <button className="bot-combat-button" onClick={handleBotCombat}>
              🤖 Бой с ботом
            </button>
            
            {/* Кнопка колонизации - доступна если система не принадлежит никому и не под влиянием */}
            {(!hexCell?.owner || (hexCell.owner !== 'npc' && hexCell.owner !== currentPlayer?.id)) && 
             hexCell?.threat !== undefined && hexCell.threat <= 0 && (
              <button className="colonize-button" onClick={handleColonize}>
                🏛️ Колонизировать систему
              </button>
            )}
            
            {/* Кнопка развития: +0.1 к угрозе (макс 1), только своя колония */}
            {hexCell?.owner === currentPlayer?.id && hexCell?.hasStation && hexCell.threat < 1 && (
              <button className="develop-button" onClick={handleDevelop}>
                📈 Развить колонию (+0.1 к угрозе)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

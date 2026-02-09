import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { HexCoordinates } from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import './HexInfo.css';

interface HexInfoProps {
  selectedHex: HexCoordinates | null;
}

export const HexInfo: React.FC<HexInfoProps> = ({ selectedHex }) => {
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
      : map.cells.get?.(hexKey)
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
                    {hexCell.owner === 'npc' ? 'NPC Фракция' : hexCell.owner}
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

        {isCurrentPlayerHere && (
          <div className="hex-actions">
            <button className="bot-combat-button" onClick={handleBotCombat}>
              🤖 Бой с ботом
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { HexCoordinates, SocketEvent, StructureType, SystemType } from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import { setActiveCombats } from '../../store/slices/gameSlice';
import './HexInfo.css';

interface HexInfoProps {
  selectedHex: HexCoordinates | null;
  onOpenPlanetarySystem?: (coordinates: HexCoordinates) => void;
  onOpenStation?: (stationId: string) => void;
  onOpenQuestPanel?: () => void;
  onOpenCargoPanel?: () => void;
}

export const HexInfo: React.FC<HexInfoProps> = ({ selectedHex, onOpenPlanetarySystem, onOpenStation, onOpenQuestPanel, onOpenCargoPanel }) => {
  const dispatch = useAppDispatch();
  const players = useAppSelector((state) => state.player.players);
  const currentPlayer = useAppSelector((state) => state.player.currentPlayer);
  const map = useAppSelector((state) => state.game.map);
  const invasions = useAppSelector((state) => state.game.invasions);
  const activeCombats = useAppSelector((state) => state.game.activeCombats);

  const hexKey = selectedHex ? `${selectedHex.q},${selectedHex.r}` : '';
  const invasionInHex = hexKey ? invasions.find(inv => inv.neighborHexKeys.includes(hexKey) && (inv.enemyCountPerHex[hexKey] ?? 0) > 0) : null;
  const enemyCountInHex = invasionInHex ? (invasionInHex.enemyCountPerHex[hexKey] ?? 0) : 0;
  const combatsInHex = hexKey ? activeCombats.filter(c => c.hexKey === hexKey) : [];

  useEffect(() => {
    if (!selectedHex) return;
    socketService.emit(SocketEvent.COMBAT_LIST_ACTIVE, { hexKey });
    const handler = (data: { combats: typeof activeCombats }) => {
      dispatch(setActiveCombats(data.combats || []));
    };
    socketService.on(SocketEvent.COMBAT_LIST_ACTIVE_DATA, handler);
    return () => { socketService.off(SocketEvent.COMBAT_LIST_ACTIVE_DATA, handler); };
  }, [selectedHex?.q, selectedHex?.r, hexKey, dispatch]);

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

  const handleInvasionCombat = () => {
    socketService.emit('combat:start:invasion', { hexKey });
  };

  const handleJoinCombat = (combatId: string) => {
    socketService.emit(SocketEvent.COMBAT_JOIN, { combatId });
  };

  const handleStartMining = () => {
    if (!hexKey) return;
    socketService.emit(SocketEvent.MINING_START, { hexKey });
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

        {/* Кнопки Квесты и Трюм — для любого выбранного гекса */}
        {(onOpenQuestPanel || onOpenCargoPanel) && (
          <div className="hex-section hex-buttons-row">
            {onOpenQuestPanel && (
              <button
                type="button"
                className="colonize-button hex-quest-btn"
                onClick={onOpenQuestPanel}
              >
                📜 Квесты
              </button>
            )}
            {onOpenCargoPanel && (
              <button
                type="button"
                className="colonize-button hex-cargo-btn"
                onClick={onOpenCargoPanel}
              >
                📦 Трюм
              </button>
            )}
          </div>
        )}

        {/* Кнопка открыть планетарную систему — для любого планетарного гекса */}
        {(hexCell?.systemType === SystemType.PLANETARY || hexCell?.systemType === 'planetary') && (
          <div className="hex-section">
            <button
              type="button"
              className="colonize-button hex-open-system-btn"
              onClick={() => onOpenPlanetarySystem?.(selectedHex)}
            >
              🌌 Открыть систему
            </button>
            {isCurrentPlayerHere && (
              <button
                type="button"
                className="develop-button hex-mining-btn"
                onClick={handleStartMining}
              >
                ⛏️ Майнинг
              </button>
            )}
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
                let handlerRemoved = false;
                const handler = (data: any) => {
                  if (handlerRemoved) return;
                  console.log('Получены данные системы:', data);
                  const station = data.system?.structures?.find((s: any) => s.type === StructureType.SPACE_STATION);
                  console.log('Найдена станция:', station);
                  if (station && onOpenStation) {
                    console.log('Открываем станцию:', station.id);
                    handlerRemoved = true;
                    socketService.off(SocketEvent.SYSTEM_DATA, handler);
                    onOpenStation(station.id);
                  } else {
                    console.warn('Станция не найдена в системе. Структуры:', data.system?.structures);
                  }
                };
                socketService.on(SocketEvent.SYSTEM_DATA, handler);
                socketService.emit(SocketEvent.SYSTEM_GET, { coordinates: selectedHex });
                
                // Таймаут на случай если ответ не придет
                setTimeout(() => {
                  if (!handlerRemoved) {
                    handlerRemoved = true;
                    socketService.off(SocketEvent.SYSTEM_DATA, handler);
                    console.warn('Таймаут ожидания данных системы');
                  }
                }, 5000);
              }}
            >
              🏭 Открыть станцию
            </button>
          </div>
        )}


        {/* Вторжение: бой с инвайдерами */}
        {invasionInHex && enemyCountInHex > 0 && isCurrentPlayerHere && (
          <div className="hex-section">
            <div className="info-row">
              <span className="info-label">Вторжение:</span>
              <span className="info-value">Инвайдеров в гексе: {enemyCountInHex}</span>
            </div>
            <button className="bot-combat-button" onClick={handleInvasionCombat}>
              ⚔️ Бой с инвайдерами ({enemyCountInHex})
            </button>
          </div>
        )}

        {/* Активные бои — можно присоединиться */}
        {combatsInHex.length > 0 && isCurrentPlayerHere && (
          <div className="hex-section">
            <h4>Активные бои ({combatsInHex.length})</h4>
            <ul className="active-combats-list">
              {combatsInHex.map(c => (
                <li key={c.combatId}>
                  <span>{c.combatType === 'invasion' ? 'Вторжение' : c.combatType} — {c.participantsCount}/{c.maxParticipants ?? '?'} игроков</span>
                  <button type="button" className="join-combat-btn" onClick={() => handleJoinCombat(c.combatId)}>Подключиться</button>
                </li>
              ))}
            </ul>
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

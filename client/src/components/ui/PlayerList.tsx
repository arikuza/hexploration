import { useState, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import { socketService } from '../../services/socketService';
import './PlayerList.css';

function PlayerList() {
  const { players, currentPlayer } = useAppSelector((state) => state.player);
  const [, setTick] = useState(0);

  // Обновлять каждую секунду для отображения таймеров
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPlayerTimer = (player: any) => {
    if (!player.moveTimer || player.moveTimer === 0) return null;
    const remaining = Math.max(0, Math.ceil((player.moveTimer - Date.now()) / 1000));
    return remaining > 0 ? remaining : null;
  };

  const handleAttack = (targetPlayerId: string) => {
    if (currentPlayer?.id === targetPlayerId) {
      alert('Нельзя атаковать себя!');
      return;
    }
    
    console.log(`⚔️ Атака игрока ${targetPlayerId}`);
    const socket = (socketService as any).socket;
    if (socket) {
      socket.emit('combat:start', { targetPlayerId });
    }
  };

  return (
    <div className="player-list">
      <h3 className="player-list-title">Игроки онлайн ({players.length})</h3>
      <div className="player-list-content">
        {players.map((player) => {
          const timer = getPlayerTimer(player);
          const canMove = player.canMove || timer === null;
          
          return (
            <div
              key={player.id}
              className={`player-item ${player.id === currentPlayer?.id ? 'current' : ''} ${
                canMove ? 'ready' : 'cooldown'
              }`}
            >
              <div className="player-avatar">
                {player.username.charAt(0).toUpperCase()}
              </div>
              <div className="player-info">
                <div className="player-name">
                  {player.username}
                  {player.id === currentPlayer?.id && ' (Вы)'}
                </div>
                <div className="player-status">
                  {canMove ? (
                    <span className="status-ready">✅ Готов</span>
                  ) : (
                    <span className="status-cooldown">⏳ {timer}с</span>
                  )}
                </div>
              </div>
              {player.id !== currentPlayer?.id && (
                <button
                  className="attack-button"
                  onClick={() => handleAttack(player.id)}
                  title="Атаковать игрока"
                >
                  ⚔️
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerList;

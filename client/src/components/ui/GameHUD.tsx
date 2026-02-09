import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import './GameHUD.css';

function GameHUD() {
  const dispatch = useAppDispatch();
  const { currentPlayer } = useAppSelector((state) => state.player);
  const [, setTick] = useState(0);

  // Обновлять каждую секунду для отображения таймера
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
  };

  // Рассчитать оставшееся время до следующего хода
  const remainingTime = currentPlayer?.moveTimer && currentPlayer.moveTimer > 0
    ? Math.max(0, Math.ceil((currentPlayer.moveTimer - Date.now()) / 1000))
    : 0;

  const canMove = currentPlayer?.canMove && remainingTime === 0;

  return (
    <div className="game-hud">
      <div className="hud-left">
        <div className="game-title-small">HEXPLORATION</div>
        <div className="turn-info">
          <span className={canMove ? 'can-move' : 'on-cooldown'}>
            {canMove ? '✅ Готов к движению' : `⏳ Кулдаун: ${remainingTime}с`}
          </span>
        </div>
      </div>

      <div className="hud-center">
        {currentPlayer && (
          <div className="player-stats">
            <div className="stat">
              <span className="stat-label">Здоровье:</span>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill health"
                  style={{ width: `${(currentPlayer.ship.health / currentPlayer.ship.maxHealth) * 100}%` }}
                />
              </div>
              <span className="stat-value">
                {currentPlayer.ship.health}/{currentPlayer.ship.maxHealth}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Энергия:</span>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill energy"
                  style={{ width: `${(currentPlayer.ship.energy / currentPlayer.ship.maxEnergy) * 100}%` }}
                />
              </div>
              <span className="stat-value">
                {currentPlayer.ship.energy}/{currentPlayer.ship.maxEnergy}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Ресурсы:</span>
              <span className="stat-value">{currentPlayer.resources}</span>
            </div>
          </div>
        )}
      </div>

      <div className="hud-right">
        <button className="logout-button" onClick={handleLogout}>
          Выход
        </button>
      </div>
    </div>
  );
}

export default GameHUD;

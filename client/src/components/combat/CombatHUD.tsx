import { useEffect, useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import { CombatShip, SHIP_MAX_HEALTH, SHIP_MAX_ENERGY } from '@hexploration/shared';
import './CombatHUD.css';

export const CombatHUD: React.FC = () => {
  const combat = useAppSelector((state) => state.combat.activeCombat);
  const currentPlayer = useAppSelector((state) => state.player.currentPlayer);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!combat) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - combat.startTime;
      const remaining = Math.max(0, combat.duration - elapsed);
      setTimeRemaining(Math.ceil(remaining / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [combat]);

  if (!combat || !currentPlayer) return null;

  const playerShip = combat.ships.find((s) => s.playerId === currentPlayer.id);
  const enemyShip = combat.ships.find((s) => s.playerId !== currentPlayer.id);

  if (!playerShip || !enemyShip) return null;

  return (
    <div className="combat-hud">
      {/* Информация игрока */}
      <div className="hud-player">
        <div className="hud-title">Ваш корабль</div>
        <ShipStatus ship={playerShip} />
      </div>

      {/* Таймер боя */}
      <div className="hud-timer">
        <div className="timer-value">{formatTime(timeRemaining)}</div>
        <div className="timer-label">Время боя</div>
      </div>

      {/* Информация противника */}
      <div className="hud-enemy">
        <div className="hud-title">Противник</div>
        <ShipStatus ship={enemyShip} isEnemy />
      </div>
    </div>
  );
};

interface ShipStatusProps {
  ship: CombatShip;
  isEnemy?: boolean;
}

const ShipStatus: React.FC<ShipStatusProps> = ({ ship, isEnemy = false }) => {
  const healthPercent = (ship.health / SHIP_MAX_HEALTH) * 100;
  const energyPercent = (ship.energy / SHIP_MAX_ENERGY) * 100;

  return (
    <div className="ship-status">
      {/* Здоровье */}
      <div className="status-bar">
        <div className="status-label">
          <span>HP</span>
          <span>{Math.ceil(ship.health)}/{SHIP_MAX_HEALTH}</span>
        </div>
        <div className="status-progress">
          <div
            className="status-fill health"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Энергия */}
      {!isEnemy && (
        <div className="status-bar">
          <div className="status-label">
            <span>Энергия</span>
            <span>{Math.ceil(ship.energy)}/{SHIP_MAX_ENERGY}</span>
          </div>
          <div className="status-progress">
            <div
              className="status-fill energy"
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Скорость */}
      <div className="status-info">
        <span>Скорость:</span>
        <span>
          {Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2).toFixed(1)}
        </span>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

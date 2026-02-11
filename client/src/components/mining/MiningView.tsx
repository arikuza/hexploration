import { useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { socketService } from '../../services/socketService';
import { endMining } from '../../store/slices/miningSlice';
import { MiningState, MiningAsteroid, MINING_ARENA_WIDTH, MINING_ARENA_HEIGHT, MINING_LASER_RANGE } from '@hexploration/shared';
import { getItem } from '@hexploration/shared';
import './MiningView.css';

export const MiningView: React.FC = () => {
  const dispatch = useAppDispatch();
  const mining = useAppSelector((state) => state.mining.activeMining);
  const miningComplete = useAppSelector((state) => state.mining.miningComplete);
  const keysRef = useRef<Set<string>>(new Set());
  const miningRef = useRef<MiningState | null>(null);

  useEffect(() => {
    miningRef.current = mining;
  }, [mining]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === ' ' || e.key.startsWith('Arrow') || key === 'w' || key === 's' || key === 'a' || key === 'd' || key === 'q' || key === 'e' || key === 'й' || key === 'у') {
        e.preventDefault();
      }
      keysRef.current.add(key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const m = miningRef.current;
      if (!m) return;

      let thrust = 0;
      let turn = 0;
      let fire = false;
      let strafe = 0;

      if (keysRef.current.has('w') || keysRef.current.has('ц')) thrust = 1;
      if (keysRef.current.has('s') || keysRef.current.has('ы')) thrust = -0.5;
      if (keysRef.current.has('a') || keysRef.current.has('ф')) turn = -1;
      if (keysRef.current.has('d') || keysRef.current.has('в')) turn = 1;
      if (keysRef.current.has('q') || keysRef.current.has('й')) strafe = -1;
      if (keysRef.current.has('e') || keysRef.current.has('у')) strafe = 1;
      if (keysRef.current.has(' ')) fire = true;

      socketService.emit('mining:control', { thrust, turn, fire, strafe });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mining || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(100, 150, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(150, 200, 100, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, MINING_ARENA_WIDTH, MINING_ARENA_HEIGHT);

    mining.asteroids.forEach((a: MiningAsteroid) => {
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size * 8, 0, Math.PI * 2);
      ctx.fillStyle = '#8b7355';
      ctx.fill();
      ctx.strokeStyle = '#a08060';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const ship = mining.ship;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.rotation);

    // Лазер (видимый луч при добыче)
    if (mining.laserActive) {
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(MINING_LASER_RANGE, 0);
      const gradient = ctx.createLinearGradient(0, 0, MINING_LASER_RANGE, 0);
      gradient.addColorStop(0, 'rgba(0, 255, 200, 0.9)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 200, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 255, 200, 0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.lineWidth = 2;
    }

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, 12);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-15, -12);
    ctx.closePath();
    ctx.fillStyle = '#00aa66';
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.stroke();
    ctx.restore();
  }, [mining]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleExit = () => {
    socketService.emit('mining:exit');
    dispatch(endMining());
  };

  if (!mining) {
    return (
      <div className="mining-view">
        <p>Загрузка майнинга...</p>
      </div>
    );
  }

  return (
    <div className="mining-view">
      <div className="mining-hud">
        <div className="mining-stats">
          <span>Энергия: {Math.round(mining.ship.energy)}/{mining.ship.maxEnergy}</span>
          <span>Собрано: {mining.collected.reduce((s: number, c: { quantity: number }) => s + c.quantity, 0)} ед.</span>
        </div>
        <button className="mining-exit-btn" onClick={handleExit}>
          Выйти
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={MINING_ARENA_WIDTH}
        height={MINING_ARENA_HEIGHT}
        className="mining-canvas"
      />
      <div className="mining-controls">
        <p>W/S — движение, A/D — поворот, Q/E — стрейф, Пробел — добыча лазером</p>
      </div>

      {miningComplete && (
        <div className="mining-result-overlay">
          <div className="mining-result-panel">
            <h2>Майнинг завершён</h2>
            <p className="mining-collected">
              Собрано: {miningComplete.collected.map(c => `${getItem(c.itemId)?.name ?? c.itemId}: ${c.quantity}`).join(', ')}
            </p>
            <button className="close-mining-btn" onClick={() => dispatch(endMining())}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

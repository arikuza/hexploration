import { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { socketService } from '../../services/socketService';
import { endCombat } from '../../store/slices/combatSlice';
import { CombatShip, Projectile, COMBAT_ARENA_WIDTH, COMBAT_ARENA_HEIGHT, SHIP_TURN_RATE, SHIP_MAX_HEALTH } from '@hexploration/shared';
import { CombatHUD } from './CombatHUD';
import './CombatView.css';

export const CombatView: React.FC = () => {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const combat = useAppSelector((state) => state.combat.activeCombat);
  const combatResult = useAppSelector((state) => state.combat.combatResult);
  const currentPlayer = useAppSelector((state) => state.player.currentPlayer);
  const combatRef = useRef(combat);
  const keysRef = useRef<Set<string>>(new Set());
  const [shipSprites, setShipSprites] = useState<Map<number, HTMLImageElement>>(new Map());

  // Обновлять ref при изменении combat
  useEffect(() => {
    combatRef.current = combat;
  }, [combat]);

  // Загрузить отдельные спрайты кораблей
  useEffect(() => {
    const sprites = new Map<number, HTMLImageElement>();
    let loadedCount = 0;
    const totalSprites = 4; // Только 4 корабля в атласе

    // Загрузить все 4 спрайта
    for (let i = 0; i < totalSprites; i++) {
      const img = new Image();
      img.src = `/assets/ships/ship-${i}.png`;
      img.onload = () => {
        sprites.set(i, img);
        loadedCount++;
        console.log(`✅ Загружен спрайт ${i}: ${img.width}x${img.height}`);
        
        if (loadedCount === totalSprites) {
          console.log('✅ Все спрайты кораблей загружены');
          setShipSprites(new Map(sprites));
        }
      };
      img.onerror = () => {
        console.error(`❌ Не удалось загрузить ship-${i}.png`);
      };
    }
  }, []);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Предотвращаем дефолтное поведение для пробела и стрелок
      if (e.key === ' ' || e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
      
      const key = e.key.toLowerCase();
      keysRef.current.add(key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.delete(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Отправка действий на сервер (постоянно)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentCombat = combatRef.current;
      if (!currentCombat) return;

      const currentKeys = keysRef.current;
      let thrust = 0;
      let turn = 0;
      let boost = false;

      if (currentKeys.has('w') || currentKeys.has('ц')) thrust = 1;
      if (currentKeys.has('s') || currentKeys.has('ы')) thrust = -0.5;
      if (currentKeys.has('a') || currentKeys.has('ф')) turn = -SHIP_TURN_RATE;
      if (currentKeys.has('d') || currentKeys.has('в')) turn = SHIP_TURN_RATE;
      if (currentKeys.has('shift')) boost = true; // Ускорение на Shift

      socketService.emit('combat:control', {
        combatId: currentCombat.id,
        thrust,
        turn,
        boost,
      });

      // Стрельба - отправляется постоянно пока удерживается пробел
      if (currentKeys.has(' ')) {
        socketService.emit('combat:action', {
          combatId: currentCombat.id,
          action: 'fire',
          weaponId: 'laser_basic',
        });
      }
    }, 50); // 20 раз в секунду

    return () => clearInterval(interval);
  }, []);

  // Отрисовка
  useEffect(() => {
    if (!combat || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Очистить canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Отрисовать сетку
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

    // Отрисовать границы арены
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, COMBAT_ARENA_WIDTH, COMBAT_ARENA_HEIGHT);

    // Отрисовать корабли
    combat.ships.forEach((ship, index) => {
      const isPlayer = ship.playerId === currentPlayer?.id;
      const isBot = ship.playerId.startsWith('BOT_');
      // Используем индекс для выбора спрайта: игрок - 0, бот - 1, другие - 2-3
      const spriteIndex = isPlayer ? 0 : isBot ? 1 : 2 + (index % 2);
      // Проверить активность ускорения (только для игрока)
      const isBoostActive = isPlayer && keysRef.current.has('shift');
      drawShip(ctx, ship, isPlayer, shipSprites, spriteIndex, isBoostActive);
    });

    // Отрисовать снаряды
    combat.projectiles.forEach((proj) => {
      drawProjectile(ctx, proj);
    });
  }, [combat, currentPlayer, shipSprites]);

  if (!combat) {
    return (
      <div className="combat-view">
        <p>Загрузка боя...</p>
      </div>
    );
  }

  const handleCloseCombat = () => {
    // Закрыть панель результатов и вернуться в игру
    dispatch(endCombat());
  };

  return (
    <div className="combat-view">
      <CombatHUD />
      <canvas
        ref={canvasRef}
        width={COMBAT_ARENA_WIDTH}
        height={COMBAT_ARENA_HEIGHT}
        className="combat-canvas"
      />
      <div className="combat-controls">
        <p>Управление: W/S - движение, A/D - поворот, Space - стрельба</p>
      </div>
      
      {/* Панель результатов боя */}
      {combatResult && currentPlayer && (
        <div className="combat-result-overlay">
          <div className="combat-result-panel">
            <h2>{combatResult.winner === currentPlayer.id ? '🎉 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ'}</h2>
            <p className="result-reason">
              {combatResult.winner === currentPlayer.id 
                ? 'Противник уничтожен!' 
                : 'Ваш корабль уничтожен'}
            </p>
            <button className="close-combat-btn" onClick={handleCloseCombat}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Отрисовать корабль
 */
function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: CombatShip,
  isPlayer: boolean,
  shipSprites: Map<number, HTMLImageElement>,
  spriteIndex: number,
  isBoostActive: boolean = false
) {
  ctx.save();
  ctx.translate(ship.position.x, ship.position.y);
  ctx.rotate(ship.rotation);

  // Эффект ускорения (следы за кораблем)
  if (isBoostActive) {
    const trailLength = 40;
    const trailWidth = 20;
    
    // Градиент для следов
    const gradient = ctx.createLinearGradient(-trailLength, 0, 0, 0);
    gradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(150, 220, 255, 0.6)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-trailLength, -trailWidth / 2, trailLength, trailWidth);
  }

  const sprite = shipSprites.get(spriteIndex);
  
  if (sprite) {
    // Отдельный спрайт размером 1408x768
    const spriteWidth = sprite.width;   // 1408
    const spriteHeight = sprite.height; // 768
    
    // Масштабируем до разумного размера для игры
    const scale = 0.08; // 8% от оригинала
    const displayWidth = spriteWidth * scale;   // ~113px
    const displayHeight = spriteHeight * scale; // ~61px
    
    // Включить правильное смешивание прозрачности
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Отрисовать спрайт по центру
    // Спрайты уже горизонтальные, поворот не нужен
    const offsetX = -displayWidth / 2;
    const offsetY = -displayHeight / 2;
    
    ctx.drawImage(
      sprite,
      offsetX, offsetY, displayWidth, displayHeight
    );
  } else {
    // Fallback: улучшенный треугольник если спрайты не загружены
    ctx.beginPath();
    ctx.moveTo(25, 0); // Нос
    ctx.lineTo(-20, 15); // Левый двигатель
    ctx.lineTo(-15, 0); // Центр
    ctx.lineTo(-20, -15); // Правый двигатель
    ctx.closePath();
    
    // Градиент для корабля
    const gradient = ctx.createLinearGradient(-20, 0, 25, 0);
    if (isPlayer) {
      gradient.addColorStop(0, '#00aa66');
      gradient.addColorStop(1, '#00ff88');
    } else {
      gradient.addColorStop(0, '#aa6600');
      gradient.addColorStop(1, '#ffaa00');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Двигатели (эффект огня)
    ctx.fillStyle = isPlayer ? 'rgba(0, 200, 255, 0.6)' : 'rgba(255, 100, 0, 0.6)';
    ctx.fillRect(-20, -3, -8, 6);
  }

  ctx.restore();

  // Индикатор здоровья (импортируем константу в начале файла)
  const barWidth = 40;
  const barHeight = 5;
  const healthPercent = ship.health / SHIP_MAX_HEALTH;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(ship.position.x - barWidth / 2, ship.position.y - 35, barWidth, barHeight);

  ctx.fillStyle = healthPercent > 0.5 ? '#00ff88' : healthPercent > 0.25 ? '#ffaa00' : '#ff4444';
  ctx.fillRect(
    ship.position.x - barWidth / 2,
    ship.position.y - 35,
    barWidth * healthPercent,
    barHeight
  );
}

/**
 * Отрисовать снаряд
 */
function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
  ctx.beginPath();
  ctx.arc(proj.position.x, proj.position.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffff00';
  ctx.fill();
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 1;
  ctx.stroke();
}

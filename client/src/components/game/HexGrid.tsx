import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import { socketService } from '../../services/socketService';
import { hexToPixel, pixelToHex, HexCoordinates, HEX_SIZE, hexDistance } from '@hexploration/shared';
import './HexGrid.css';

interface HexGridProps {
  selectedHex: HexCoordinates | null;
  onHexSelect: (hex: HexCoordinates) => void;
}

function HexGrid({ selectedHex, onHexSelect }: HexGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredHex, setHoveredHex] = useState<HexCoordinates | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(0); // 0 = 1x, 1 = 0.5x, 2 = 0.125x
  const { map } = useAppSelector((state) => state.game);
  const { currentPlayer } = useAppSelector((state) => state.player);

  // Получить текущий коэффициент зума
  const getZoomScale = (): number => {
    const scales = [1, 0.5, 0.125];
    return scales[zoomLevel];
  };

  // Центрировать камеру на игроке при загрузке
  useEffect(() => {
    if (currentPlayer && camera.x === 0 && camera.y === 0) {
      const playerPixel = hexToPixel(currentPlayer.position, HEX_SIZE);
      setCamera({ x: -playerPixel.x, y: -playerPixel.y });
    }
  }, [currentPlayer]);

  // Управление клавишами для камеры
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const speed = 50;
      switch(e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
        case 'ц':
          setCamera(prev => ({ x: prev.x, y: prev.y + speed }));
          e.preventDefault();
          break;
        case 'arrowdown':
        case 's':
        case 'ы':
          setCamera(prev => ({ x: prev.x, y: prev.y - speed }));
          e.preventDefault();
          break;
        case 'arrowleft':
        case 'a':
        case 'ф':
          setCamera(prev => ({ x: prev.x + speed, y: prev.y }));
          e.preventDefault();
          break;
        case 'arrowright':
        case 'd':
        case 'в':
          setCamera(prev => ({ x: prev.x - speed, y: prev.y }));
          e.preventDefault();
          break;
        case 'home': // Центрировать на игроке
          if (currentPlayer) {
            const playerPixel = hexToPixel(currentPlayer.position, HEX_SIZE);
            setCamera({ x: -playerPixel.x, y: -playerPixel.y });
          }
          e.preventDefault();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPlayer]);

  // Рендер карты
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очистить canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Центрировать камеру с учетом camera offset
    const centerX = canvas.width / 2 + camera.x;
    const centerY = canvas.height / 2 + camera.y;
    const zoom = getZoomScale();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(zoom, zoom); // Применить зум

    // Viewport culling - вычислить какие гексы видны на экране
    const viewportLeft = (-centerX) / zoom;
    const viewportRight = (canvas.width - centerX) / zoom;
    const viewportTop = (-centerY) / zoom;
    const viewportBottom = (canvas.height - centerY) / zoom;
    
    // Добавить буфер для сглаживания краев
    const buffer = HEX_SIZE * 3;
    const cullLeft = viewportLeft - buffer;
    const cullRight = viewportRight + buffer;
    const cullTop = viewportTop - buffer;
    const cullBottom = viewportBottom + buffer;

    // Определить уровень детализации в зависимости от зума
    const useLowDetail = zoom < 0.3;

    // Отрисовать только видимые гексы
    let renderedCount = 0;
    map.cells.forEach((cell) => {
      const pos = hexToPixel(cell.coordinates, HEX_SIZE);
      
      // Проверить, виден ли гекс на экране
      if (pos.x + HEX_SIZE < cullLeft || pos.x - HEX_SIZE > cullRight ||
          pos.y + HEX_SIZE < cullTop || pos.y - HEX_SIZE > cullBottom) {
        return; // Пропустить невидимый гекс
      }
      
      renderedCount++;
      drawHex(ctx, cell, useLowDetail);
    });

    // Отрисовать текущего игрока (только свой корабль на карте)
    if (currentPlayer) {
      const pos = hexToPixel(currentPlayer.position, HEX_SIZE);
      drawPlayer(ctx, pos.x, pos.y, currentPlayer.username, true);
    }

    // Отрисовать выбранный гекс
    if (selectedHex) {
      const pos = hexToPixel(selectedHex, HEX_SIZE);
      drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, '#4caf50');
    }

    // Отрисовать подсветку наведения
    if (hoveredHex && (!selectedHex || hoveredHex.q !== selectedHex.q || hoveredHex.r !== selectedHex.r)) {
      const pos = hexToPixel(hoveredHex, HEX_SIZE);
      drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, '#ffff00');
    }

    ctx.restore();
  }, [map, hoveredHex, currentPlayer, selectedHex, camera, zoomLevel]);

  // Обработка начала перетаскивания
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.button === 1) { // Правая или средняя кнопка мыши
      setIsDragging(true);
      setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setCamera({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // Обработка зума колесиком мыши
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (e.deltaY < 0) {
      // Прокрутка вверх - уменьшить зум (отдалить)
      setZoomLevel(prev => Math.min(2, prev + 1));
    } else {
      // Прокрутка вниз - увеличить зум (приблизить)
      setZoomLevel(prev => Math.max(0, prev - 1));
    }
  };

  // Обработка клика
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return; // Не обрабатывать клик если было перетаскивание
    if (!map || !currentPlayer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const zoom = getZoomScale();
    const x = (e.clientX - rect.left - canvas.width / 2 - camera.x) / zoom;
    const y = (e.clientY - rect.top - canvas.height / 2 - camera.y) / zoom;

    const hex = pixelToHex(x, y, HEX_SIZE);

    // Выбрать гекс для отображения информации
    onHexSelect(hex);

    // Проверить, что можно двигаться (таймер истек)
    if (!currentPlayer.canMove || currentPlayer.moveTimer > Date.now()) {
      console.log('⏳ Таймер еще не истек!');
      return;
    }

    // Проверить, что это соседний гекс
    const distance = hexDistance(currentPlayer.position, hex);
    if (distance !== 1) {
      console.log('❌ Можно двигаться только на соседние гексы!');
      return;
    }

    // Отправить движение
    socketService.move(hex);
  };

  // Обработка наведения
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Обработать перетаскивание камеры
    handleMouseDrag(e);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const zoom = getZoomScale();
    const x = (e.clientX - rect.left - canvas.width / 2 - camera.x) / zoom;
    const y = (e.clientY - rect.top - canvas.height / 2 - camera.y) / zoom;

    const hex = pixelToHex(x, y, HEX_SIZE);
    setHoveredHex(hex);
  };

  // Отключить контекстное меню
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="hex-grid"
        width={window.innerWidth}
        height={window.innerHeight - 80}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
      />
      <div className="camera-hint">
        <p>🖱️ ПКМ - перетащить карту | ⌨️ WASD/Стрелки - двигать камеру | Home - центр | 🔍 Колесико - зум (x{getZoomScale().toFixed(3)})</p>
      </div>
    </>
  );
}

/**
 * Получить цвет в зависимости от уровня угрозы (космическая палитра)
 */
function getThreatColor(threat: number): string {
  // threat от 1 (безопасно) до -2 (неизвестный космос)
  // Используем HSL для плавных космических переходов
  
  if (threat >= 0.5) {
    // Безопасные зоны: сине-голубые (защитные поля)
    // threat 1.0 -> 0.5: голубой -> синий
    const t = (threat - 0.5) / 0.5; // 0 -> 1
    const hue = 180 + t * 20; // 180° (голубой) -> 200° (сине-голубой)
    const saturation = 55 + t * 20; // 55% -> 75%
    const lightness = 28 + t * 12; // 28% -> 40% (темнее)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else if (threat >= 0.0) {
    // Средние зоны: сине-фиолетовые
    // threat 0.5 -> 0.0: синий -> фиолетовый
    const t = (threat - 0.0) / 0.5; // 0 -> 1
    const hue = 240 + (1 - t) * 40; // 240° (синий) -> 280° (фиолетовый)
    const saturation = 45 + (1 - t) * 10; // 45% -> 55%
    const lightness = 22 + t * 6; // 22% -> 28% (темнее)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else if (threat >= -1.0) {
    // Опасные зоны: фиолетово-бордовые
    // threat 0.0 -> -1.0: темно-фиолетовый -> темно-красный
    const t = (threat - (-1.0)) / 1.0; // 0 -> 1
    const hue = 320 + (1 - t) * 40; // 320° (бордовый) -> 360° (красный)
    const saturation = 50 + (1 - t) * 15; // 50% -> 65%
    const lightness = 15 + t * 7; // 15% -> 22% (темнее)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    // Неизвестный космос: практически черный с едва заметными вариациями
    // threat -1.0 -> -2.0: все очень темное, почти одинаковое
    const t = (threat - (-2.0)) / 1.0; // 0 -> 1
    const hue = 270; // Фиолетовый оттенок
    const saturation = 15 + t * 10; // 15% -> 25% (слабая насыщенность)
    const lightness = 2 + t * 4; // 2% -> 6% (почти черный)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}

/**
 * Отрисовать гекс
 */
function drawHex(
  ctx: CanvasRenderingContext2D,
  cell: any,
  useLowDetail: boolean = false
) {
  const pos = hexToPixel(cell.coordinates, HEX_SIZE);
  const x = pos.x;
  const y = pos.y;

  // Нарисовать гексагон
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = x + HEX_SIZE * Math.cos(angle);
    const hy = y + HEX_SIZE * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();

  // Цвет на основе уровня угрозы (если есть), иначе старая система
  if (cell.threat !== undefined) {
    ctx.fillStyle = getThreatColor(cell.threat);
  } else if (cell.type) {
    // Fallback для старой системы
    const colors: Record<string, string> = {
      empty: '#1a1f3a',
      asteroid: '#8b7355',
      nebula: '#6a4c93',
      planet: '#4a8f7c',
      station: '#4a7c8f',
      wormhole: '#d946ef',
    };
    ctx.fillStyle = colors[cell.type] || colors.empty;
  } else {
    ctx.fillStyle = '#1a1f3a';
  }
  
  ctx.fill();
  
  // На малых зумах - упрощенный рендеринг
  if (useLowDetail) {
    // Без границ для обычных гексов (экономия)
    if (cell.hasStation) {
      // Только для станций - простая яркая точка
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  } else {
    // Полная детализация на нормальных зумах
    // Граница - особая для NPC территории
    if (cell.owner === 'npc') {
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // Отрисовать станцию если есть
    if (cell.hasStation) {
      drawStation(ctx, x, y);
    }
  }
}

/**
 * Отрисовать иконку станции
 */
function drawStation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  // Звезда (станция)
  ctx.save();
  ctx.translate(x, y);
  
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const outerRadius = 12;
    const innerRadius = 5;
    
    // Внешняя точка
    ctx.lineTo(
      Math.cos(angle) * outerRadius,
      Math.sin(angle) * outerRadius
    );
    
    // Внутренняя точка
    const innerAngle = angle + Math.PI / 5;
    ctx.lineTo(
      Math.cos(innerAngle) * innerRadius,
      Math.sin(innerAngle) * innerRadius
    );
  }
  ctx.closePath();
  
  ctx.fillStyle = '#00d4ff';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Отрисовать игрока
 */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  isCurrentPlayer: boolean
) {
  // Корабль (простой круг на карте)
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = isCurrentPlayer ? '#00ff88' : '#ff8800';
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Имя
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 25);
}

/**
 * Отрисовать контур гекса
 */
function drawHexOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = x + size * Math.cos(angle);
    const hy = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export default HexGrid;

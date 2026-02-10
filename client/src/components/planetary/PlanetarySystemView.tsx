import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  PlanetarySystem,
  StarType,
  PlanetType,
  GasGiantType,
  HexCoordinates,
} from '@hexploration/shared';
import { SocketEvent } from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import './PlanetarySystemView.css';

interface PlanetarySystemViewProps {
  coordinates: HexCoordinates;
  system?: PlanetarySystem | null;
  onClose?: () => void;
  onSystemLoaded?: (system: PlanetarySystem) => void;
}

/** Цвета звёзд по типу */
const STAR_COLORS: Record<string, string> = {
  [StarType.YELLOW_DWARF]: '#ffdd88',
  [StarType.RED_DWARF]: '#ff6644',
  [StarType.RED_GIANT]: '#ff8866',
  [StarType.BLUE_GIANT]: '#aaccff',
  [StarType.WHITE_DWARF]: '#ddddff',
  [StarType.NEUTRON_STAR]: '#ffffff',
};

/** Цвета планет по типу */
const PLANET_COLORS: Record<string, string> = {
  [PlanetType.ROCKY]: '#8b7355',
  [PlanetType.OCEAN]: '#4466aa',
  [PlanetType.DESERT]: '#c4a35a',
  [PlanetType.ICE]: '#aaddff',
  [PlanetType.VOLCANIC]: '#aa4422',
  [PlanetType.GAS_GIANT]: '#ccaa66',
};

/** Цвета газовых гигантов */
const GAS_GIANT_COLORS: Record<string, string> = {
  [GasGiantType.JOVIAN]: '#d4a574',
  [GasGiantType.NEPTUNIAN]: '#6688cc',
  [GasGiantType.BROWN_DWARF]: '#6b4423',
};

export const PlanetarySystemView: React.FC<PlanetarySystemViewProps> = ({
  coordinates,
  system: initialSystem,
  onClose,
  onSystemLoaded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [system, setSystem] = useState<PlanetarySystem | null>(initialSystem ?? null);
  const [loading, setLoading] = useState(!initialSystem);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fetchSystem = useCallback(() => {
    setLoading(true);
    setError(null);
    socketService.emit(SocketEvent.SYSTEM_GET, { coordinates });
  }, [coordinates.q, coordinates.r]);

  useEffect(() => {
    if (initialSystem) {
      setSystem(initialSystem);
      setLoading(false);
      onSystemLoaded?.(initialSystem);
      return;
    }

    const onData = (data: { system: PlanetarySystem }) => {
      setSystem(data.system);
      setLoading(false);
      setError(null);
      onSystemLoaded?.(data.system);
    };

    const onErr = (data: { message?: string }) => {
      setError(data.message || 'Ошибка загрузки системы');
      setLoading(false);
    };

    socketService.on(SocketEvent.SYSTEM_DATA, onData);
    socketService.on(SocketEvent.SYSTEM_ERROR, onErr);
    fetchSystem();

    return () => {
      socketService.off(SocketEvent.SYSTEM_DATA, onData);
      socketService.off(SocketEvent.SYSTEM_ERROR, onErr);
    };
  }, [initialSystem, fetchSystem, onSystemLoaded]);

  useEffect(() => {
    if (!system || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const cx = w / 2 + camera.x;
    const cy = h / 2 + camera.y;
    const scale = Math.min(w, h) / 500;

    // Генерируем случайные начальные углы для каждой планеты и газового гиганта
    // Используем ID планет/гигантов + индекс для детерминированного seed
    const planetInitialAngles = new Map<string, number>();
    system.planets.forEach((planet, index) => {
      // Используем ID планеты, индекс и orbitRadius для генерации уникального угла
      let hash = 0;
      const seed = `${planet.id}-${index}-${planet.orbitRadius}`;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      // Нормализуем к диапазону 0-2π, добавляем немного случайности через индекс
      const baseAngle = (Math.abs(hash) % 628) / 100;
      const indexOffset = (index * Math.PI * 2) / Math.max(system.planets.length, 1);
      const angle = (baseAngle + indexOffset) % (Math.PI * 2);
      planetInitialAngles.set(planet.id, angle);
    });

    const gasGiantInitialAngles = new Map<string, number>();
    system.gasGiants.forEach((gg, index) => {
      let hash = 0;
      const seed = `${gg.id}-${index}-${gg.orbitRadius}`;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      const baseAngle = (Math.abs(hash) % 628) / 100;
      const indexOffset = (index * Math.PI * 2) / Math.max(system.gasGiants.length, 1);
      const angle = (baseAngle + indexOffset) % (Math.PI * 2);
      gasGiantInitialAngles.set(gg.id, angle);
    });

    const draw = () => {
      const t = (Date.now() - startTimeRef.current) / 1000;

      ctx.fillStyle = 'rgba(10, 10, 18, 0.4)';
      ctx.fillRect(0, 0, w, h);

      // Звезда
      const star = system.star;
      const starColor = STAR_COLORS[star.type] || '#ffdd88';
      const starRadius = (8 + star.size * 4) * scale;
      const pulse = 1 + 0.05 * Math.sin(t * 2);
      ctx.beginPath();
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, starRadius * pulse);
      gradient.addColorStop(0, starColor);
      gradient.addColorStop(0.4, starColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.arc(cx, cy, starRadius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = starColor;
      ctx.beginPath();
      ctx.arc(cx, cy, starRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Планеты
      system.planets.forEach((planet, idx) => {
        const initialAngle = planetInitialAngles.get(planet.id) || 0;
        // Если начальный угол не найден, используем индекс для разнообразия
        const finalInitialAngle = initialAngle || (idx * Math.PI * 2 / system.planets.length);
        const angle = finalInitialAngle + t * planet.orbitSpeed;
        const x = cx + Math.cos(angle) * planet.orbitRadius * scale;
        const y = cy + Math.sin(angle) * planet.orbitRadius * scale;
        const color = PLANET_COLORS[planet.type] || '#888';
        const radius = (2 + planet.size) * scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, planet.orbitRadius * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Астероидные пояса
      system.asteroidBelts.forEach((belt) => {
        const inner = (belt.orbitRadius - belt.width / 2) * scale;
        const outer = (belt.orbitRadius + belt.width / 2) * scale;
        ctx.strokeStyle = `rgba(180, 160, 120, ${0.2 + belt.density * 0.05})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, (inner + outer) / 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Газовые гиганты
      system.gasGiants.forEach((gg, idx) => {
        const initialAngle = gasGiantInitialAngles.get(gg.id) || 0;
        // Если начальный угол не найден, используем индекс для разнообразия
        const finalInitialAngle = initialAngle || (idx * Math.PI * 2 / (system.gasGiants.length || 1));
        const angle = finalInitialAngle + t * gg.orbitSpeed;
        const x = cx + Math.cos(angle) * gg.orbitRadius * scale;
        const y = cy + Math.sin(angle) * gg.orbitRadius * scale;
        const color = GAS_GIANT_COLORS[gg.type] || '#ccaa66';
        const radius = (4 + gg.size) * scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, gg.orbitRadius * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    startTimeRef.current = Date.now();
    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [system, camera]);

  // Обработка панорамирования мышью (средняя и правая кнопка)
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setCamera({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  if (loading) {
    return (
      <div className="planetary-system-view">
        <div className="planetary-system-view__loading">Загрузка системы…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="planetary-system-view">
        <div className="planetary-system-view__header">
          <h4>Система [{coordinates.q}, {coordinates.r}]</h4>
          {onClose && (
            <button type="button" className="planetary-system-view__close" onClick={onClose}>
              Закрыть
            </button>
          )}
        </div>
        <div className="planetary-system-view__error">{error}</div>
      </div>
    );
  }

  if (!system) {
    return null;
  }

  return (
    <div className="planetary-system-view">
      <div className="planetary-system-view__header">
        <h4>
          {system.name || `Система [${coordinates.q}, ${coordinates.r}]`} — {system.star.type}
        </h4>
        {onClose && (
          <button type="button" className="planetary-system-view__close" onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>
      <canvas 
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onContextMenu={handleContextMenu}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};

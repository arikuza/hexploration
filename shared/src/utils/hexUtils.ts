import { HexCoordinates, CubeCoordinates } from '../types/hex.types.js';

/**
 * Утилиты для работы с гексагональной сеткой
 */

/**
 * Преобразование axial координат в cube
 */
export function axialToCube(hex: HexCoordinates): CubeCoordinates {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Преобразование cube координат в axial
 */
export function cubeToAxial(cube: CubeCoordinates): HexCoordinates {
  return {
    q: cube.x,
    r: cube.z,
  };
}

/**
 * Расстояние между двумя гексами
 */
export function hexDistance(a: HexCoordinates, b: HexCoordinates): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

/**
 * Получить всех соседей гекса
 */
export function hexNeighbors(hex: HexCoordinates): HexCoordinates[] {
  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  
  return directions.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}

/**
 * Получить все гексы в радиусе
 */
export function hexInRadius(center: HexCoordinates, radius: number): HexCoordinates[] {
  const results: HexCoordinates[] = [];
  
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  
  return results;
}

/**
 * Ключ для хранения гекса в Map
 */
export function hexKey(hex: HexCoordinates): string {
  return `${hex.q},${hex.r}`;
}

/**
 * Парсинг ключа в координаты
 */
export function keyToHex(key: string): HexCoordinates {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

/**
 * Конвертация гекса в пиксельные координаты для рендеринга
 * (Flat-top ориентация)
 */
export function hexToPixel(hex: HexCoordinates, size: number): { x: number; y: number } {
  const x = size * (3/2 * hex.q);
  const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/**
 * Конвертация пиксельных координат в гекс
 * (Flat-top ориентация)
 */
export function pixelToHex(x: number, y: number, size: number): HexCoordinates {
  const q = (2/3 * x) / size;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
  return hexRound({ q, r });
}

/**
 * Округление дробных координат гекса до ближайшего целого
 */
export function hexRound(hex: HexCoordinates): HexCoordinates {
  const cube = axialToCube(hex);
  
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);
  
  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);
  
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  
  return cubeToAxial({ x: rx, y: ry, z: rz });
}

import {
  HexCoordinates,
  hexKey,
  PlanetarySystem,
  Star,
  Planet,
  AsteroidBelt,
  GasGiant,
  PlanetType,
  GasGiantType,
  PlanetResources,
} from '@hexploration/shared';
import {
  MIN_PLANETS_PER_SYSTEM,
  MAX_PLANETS_PER_SYSTEM,
  MIN_ASTEROID_BELTS,
  MAX_ASTEROID_BELTS,
  MIN_GAS_GIANTS,
  MAX_GAS_GIANTS,
  MIN_ORBIT_RADIUS,
  MAX_ORBIT_RADIUS,
  ASTEROID_BELT_WIDTH,
  MIN_PLANET_SIZE,
  MAX_PLANET_SIZE,
  MIN_STAR_SIZE,
  MAX_STAR_SIZE,
  MIN_ORBIT_SPEED,
  MAX_ORBIT_SPEED,
  MIN_ASTEROID_MINERALS,
  MAX_ASTEROID_MINERALS,
  BASE_REGEN_RATE,
  MAX_REGEN_RATE,
  STAR_TYPE_WEIGHTS,
  STAR_TEMPERATURES,
  STAR_LUMINOSITY,
} from '@hexploration/shared';

/**
 * Простой воспроизводимый ГПСЧ (mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0; // 32-bit
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Выбор значения по весам (вероятностям)
 */
function pickWeighted<T extends string>(weights: Record<T, number>, rng: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * Случайное целое от min до max включительно
 */
function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Случайное число от min до max
 */
function randomFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Генератор планетарных систем с поддержкой seed для воспроизводимости
 */
export class PlanetarySystemGenerator {
  /**
   * Сгенерировать планетарную систему для гекса
   * @param coordinates координаты гекса
   * @param seed опциональный seed; если не передан, вычисляется из координат
   */
  static generate(coordinates: HexCoordinates, seed?: number): PlanetarySystem {
    const hexKeyStr = hexKey(coordinates);
    const actualSeed = seed ?? coordinates.q * 73856093 + coordinates.r * 19349663;
    const rng = createSeededRandom(actualSeed);

    const star = PlanetarySystemGenerator.generateStar(rng);
    const numPlanets = randomInt(rng, MIN_PLANETS_PER_SYSTEM, MAX_PLANETS_PER_SYSTEM);
    const numBelts = randomInt(rng, MIN_ASTEROID_BELTS, MAX_ASTEROID_BELTS);
    const numGasGiants = randomInt(rng, MIN_GAS_GIANTS, MAX_GAS_GIANTS);

    // Орбиты: распределяем планеты, пояса и гигантов по радиусам без пересечений
    const totalOrbitSlots = numPlanets + numBelts + numGasGiants;
    const orbitRadii = PlanetarySystemGenerator.allocateOrbits(rng, totalOrbitSlots);

    let slotIndex = 0;
    const planets: Planet[] = [];
    for (let i = 0; i < numPlanets; i++) {
      planets.push(
        PlanetarySystemGenerator.generatePlanet(rng, hexKeyStr, i, orbitRadii[slotIndex++]!)
      );
    }

    const asteroidBelts: AsteroidBelt[] = [];
    for (let i = 0; i < numBelts; i++) {
      asteroidBelts.push(
        PlanetarySystemGenerator.generateAsteroidBelt(rng, hexKeyStr, i, orbitRadii[slotIndex++]!)
      );
    }

    const gasGiants: GasGiant[] = [];
    for (let i = 0; i < numGasGiants; i++) {
      gasGiants.push(
        PlanetarySystemGenerator.generateGasGiant(rng, hexKeyStr, i, orbitRadii[slotIndex++]!)
      );
    }

    return {
      hexCoordinates: coordinates,
      systemType: 'planetary',
      star,
      planets,
      asteroidBelts,
      gasGiants,
      structures: [],
      discoveredBy: [],
      seed: actualSeed,
    };
  }

  private static generateStar(rng: () => number): Star {
    const type = pickWeighted(STAR_TYPE_WEIGHTS, rng);
    const size = randomFloat(rng, MIN_STAR_SIZE, MAX_STAR_SIZE);
    const temperature = STAR_TEMPERATURES[type];
    const luminosity = STAR_LUMINOSITY[type];
    return { type, size, temperature, luminosity };
  }

  private static allocateOrbits(rng: () => number, count: number): number[] {
    const step = (MAX_ORBIT_RADIUS - MIN_ORBIT_RADIUS) / (count + 1);
    const radii: number[] = [];
    for (let i = 0; i < count; i++) {
      const base = MIN_ORBIT_RADIUS + step * (i + 1);
      const jitter = (rng() - 0.5) * step * 0.4;
      radii.push(Math.round(base + jitter));
    }
    radii.sort((a, b) => a - b);
    return radii;
  }

  /** Только «наземные» типы планет (газовые гиганты генерируются отдельно) */
  private static readonly TERRESTRIAL_PLANET_WEIGHTS: Record<PlanetType, number> = {
    [PlanetType.ROCKY]: 0.35,
    [PlanetType.OCEAN]: 0.2,
    [PlanetType.DESERT]: 0.2,
    [PlanetType.ICE]: 0.15,
    [PlanetType.VOLCANIC]: 0.1,
    [PlanetType.GAS_GIANT]: 0, // не используем при pickWeighted
  };

  private static generatePlanet(
    rng: () => number,
    hexKeyStr: string,
    index: number,
    orbitRadius: number
  ): Planet {
    const id = `p-${hexKeyStr}-${index}`;
    const type = pickWeighted(PlanetarySystemGenerator.TERRESTRIAL_PLANET_WEIGHTS, rng);
    const size = randomInt(rng, MIN_PLANET_SIZE, MAX_PLANET_SIZE);
    const orbitSpeed = randomFloat(rng, MIN_ORBIT_SPEED, MAX_ORBIT_SPEED);
    const habitable = type === PlanetType.OCEAN || (type === PlanetType.ROCKY && rng() < 0.2);

    const resources: PlanetResources = {};
    if (rng() < 0.6) resources.minerals = Math.floor(rng() * 500) + 50;
    if (rng() < 0.3) resources.rareMaterials = Math.floor(rng() * 50);
    if (rng() < 0.4) resources.energy = Math.floor(rng() * 200);

    return {
      id,
      type,
      orbitRadius,
      orbitSpeed,
      size,
      habitable,
      resources,
      structures: [],
    };
  }

  private static generateAsteroidBelt(
    rng: () => number,
    hexKeyStr: string,
    index: number,
    orbitRadius: number
  ): AsteroidBelt {
    const id = `belt-${hexKeyStr}-${index}`;
    const density = randomInt(rng, 1, 10);
    const mineralRichness = randomInt(rng, 1, 10);
    const maxMinerals = randomInt(rng, MIN_ASTEROID_MINERALS, MAX_ASTEROID_MINERALS);
    const minerals = Math.floor(rng() * maxMinerals * 0.8) + Math.floor(maxMinerals * 0.2);
    const regenerationRate = Math.floor(
      BASE_REGEN_RATE + rng() * (MAX_REGEN_RATE - BASE_REGEN_RATE)
    );

    return {
      id,
      orbitRadius,
      width: ASTEROID_BELT_WIDTH,
      density,
      mineralRichness,
      resources: {
        minerals,
        maxMinerals,
        regenerationRate,
      },
      structures: [],
    };
  }

  private static generateGasGiant(
    rng: () => number,
    hexKeyStr: string,
    index: number,
    orbitRadius: number
  ): GasGiant {
    const id = `gg-${hexKeyStr}-${index}`;
    const types = [GasGiantType.JOVIAN, GasGiantType.NEPTUNIAN, GasGiantType.BROWN_DWARF];
    const type = types[Math.floor(rng() * types.length)]!;
    const size = randomInt(rng, 4, 5);
    const orbitSpeed = randomFloat(rng, MIN_ORBIT_SPEED * 0.5, MAX_ORBIT_SPEED * 0.7);
    const helium = Math.floor(rng() * 5000) + 1000;
    const rareGases = Math.floor(rng() * 500) + 100;

    return {
      id,
      orbitRadius,
      orbitSpeed,
      size,
      type,
      resources: { helium, rareGases },
      structures: [],
    };
  }
}

import {
  MiningState,
  MiningAsteroid,
  Player,
} from '@hexploration/shared';
import {
  MINING_ARENA_WIDTH,
  MINING_ARENA_HEIGHT,
  MINING_SHIP_SPEED,
  MINING_SHIP_TURN,
  MINING_LASER_ENERGY,
  MINING_LASER_RANGE,
  MINING_ENERGY_REGEN,
  MINING_ASTEROID_COUNT,
  MINING_ASTEROID_SPEED,
  MINING_STRAFE_SPEED,
  MINING_ITEM_TYPES,
} from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';
import { StorageSystem } from './StorageSystem.js';

export class MiningSystem {
  private sessions: Map<string, MiningState> = new Map();
  private playerToSession: Map<string, string> = new Map();
  private controlState: Map<string, { thrust: number; turn: number; fire: boolean; strafe: number }> = new Map();
  private fireTickCounter: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startUpdateLoop();
  }

  private startUpdateLoop(): void {
    if (this.updateInterval) return;
    this.updateInterval = setInterval(() => this.tick(), 50);
  }

  startMining(player: Player, hexKeyStr: string): { state: MiningState } | { error: string } {
    if (this.playerToSession.has(player.id)) {
      return { error: 'Вы уже в майнинге' };
    }

    const sessionId = uuidv4();
    const asteroids = this.spawnAsteroids(sessionId);

    const state: MiningState = {
      sessionId,
      hexKey: hexKeyStr,
      playerId: player.id,
      ship: {
        playerId: player.id,
        x: MINING_ARENA_WIDTH / 2,
        y: MINING_ARENA_HEIGHT / 2,
        vx: 0,
        vy: 0,
        rotation: 0,
        energy: player.ship.energy,
        maxEnergy: player.ship.maxEnergy,
      },
      asteroids,
      collected: [],
      startTime: Date.now(),
    };

    this.sessions.set(sessionId, state);
    this.playerToSession.set(player.id, sessionId);
    this.controlState.set(player.id, { thrust: 0, turn: 0, fire: false, strafe: 0 });

    return { state };
  }

  private spawnAsteroids(sessionId: string): MiningAsteroid[] {
    const asteroids: MiningAsteroid[] = [];
    const rng = () => Math.random();

    for (let i = 0; i < MINING_ASTEROID_COUNT; i++) {
      const size = 2 + Math.floor(rng() * 3); // 2–4, чтобы можно было разваливать
      const health = size * 4;
      const mineralType = MINING_ITEM_TYPES[Math.floor(rng() * MINING_ITEM_TYPES.length)]!;
      const margin = 80;
      const x = margin + rng() * (MINING_ARENA_WIDTH - 2 * margin);
      const y = margin + rng() * (MINING_ARENA_HEIGHT - 2 * margin);
      const angle = rng() * Math.PI * 2;
      const speed = 0.2 + rng() * 0.4; // Медленнее
      asteroids.push({
        id: `ast-${sessionId}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        mineralType,
        health,
      });
    }
    return asteroids;
  }

  private splitAsteroid(state: MiningState, a: MiningAsteroid, idx: number): void {
    state.asteroids.splice(idx, 1);
    if (a.size <= 1) {
      const qty = 1;
      const existing = state.collected.find(c => c.itemId === a.mineralType);
      if (existing) existing.quantity += qty;
      else state.collected.push({ itemId: a.mineralType, quantity: qty });
      return;
    }
    const newSize = a.size - 1;
    const newHealth = newSize * 3;
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = angle1 + Math.PI;
    const spread = 0.3 + Math.random() * 0.3;
    const baseId = a.id;
    state.asteroids.push({
      id: `${baseId}-a`,
      x: a.x + Math.cos(angle1) * 5,
      y: a.y + Math.sin(angle1) * 5,
      vx: Math.cos(angle1) * spread,
      vy: Math.sin(angle1) * spread,
      size: newSize,
      mineralType: a.mineralType,
      health: newHealth,
    });
    state.asteroids.push({
      id: `${baseId}-b`,
      x: a.x + Math.cos(angle2) * 5,
      y: a.y + Math.sin(angle2) * 5,
      vx: Math.cos(angle2) * spread,
      vy: Math.sin(angle2) * spread,
      size: newSize,
      mineralType: a.mineralType,
      health: newHealth,
    });
  }

  setControl(playerId: string, thrust: number, turn: number, fire: boolean, strafe: number = 0): void {
    this.controlState.set(playerId, { thrust, turn, fire, strafe });
  }

  private tick(): void {
    const now = Date.now();
    const dt = 0.05;

    for (const [sessionId, state] of this.sessions) {
      const ctrl = this.controlState.get(state.playerId) ?? { thrust: 0, turn: 0, fire: false, strafe: 0 };

      // Энергия
      state.ship.energy = Math.min(state.ship.maxEnergy, state.ship.energy + MINING_ENERGY_REGEN * dt);

      // Поворот
      state.ship.rotation += ctrl.turn * MINING_SHIP_TURN * dt;

      // Ускорение (вперёд/назад)
      let ax = Math.cos(state.ship.rotation) * ctrl.thrust * MINING_SHIP_SPEED * dt;
      let ay = Math.sin(state.ship.rotation) * ctrl.thrust * MINING_SHIP_SPEED * dt;
      // Стрейф (Q/E — перпендикулярное ускорение)
      if (ctrl.strafe !== 0) {
        ax += -Math.sin(state.ship.rotation) * ctrl.strafe * MINING_STRAFE_SPEED * dt;
        ay += Math.cos(state.ship.rotation) * ctrl.strafe * MINING_STRAFE_SPEED * dt;
      }
      state.ship.vx += ax;
      state.ship.vy += ay;
      state.ship.vx *= 0.98;
      state.ship.vy *= 0.98;
      state.ship.x += state.ship.vx * dt;
      state.ship.y += state.ship.vy * dt;

      // Границы
      state.ship.x = Math.max(20, Math.min(MINING_ARENA_WIDTH - 20, state.ship.x));
      state.ship.y = Math.max(20, Math.min(MINING_ARENA_HEIGHT - 20, state.ship.y));
      if (state.ship.x <= 20 || state.ship.x >= MINING_ARENA_WIDTH - 20) state.ship.vx *= -0.5;
      if (state.ship.y <= 20 || state.ship.y >= MINING_ARENA_HEIGHT - 20) state.ship.vy *= -0.5;

      // Добыча лазером — энергия списывается раз в 3 тика (150ms) для меньшего расхода
      state.laserActive = false;
      const fireTick = this.fireTickCounter.get(sessionId) ?? 0;
      this.fireTickCounter.set(sessionId, (fireTick + 1) % 3);
      const shouldDeductEnergy = fireTick === 0;
      if (ctrl.fire && state.ship.energy >= MINING_LASER_ENERGY) {
        state.laserActive = true;
        for (let i = state.asteroids.length - 1; i >= 0; i--) {
          const a = state.asteroids[i]!;
          const dist = Math.hypot(a.x - state.ship.x, a.y - state.ship.y);
          const distToLine = Math.abs((a.y - state.ship.y) * Math.cos(state.ship.rotation) - (a.x - state.ship.x) * Math.sin(state.ship.rotation));
          if (dist <= MINING_LASER_RANGE + a.size * 8 && distToLine < a.size * 12) {
            if (shouldDeductEnergy) {
              state.ship.energy -= MINING_LASER_ENERGY;
            }
            a.health -= 1;
            if (a.health <= 0) {
              this.splitAsteroid(state, a, i);
            }
            break;
          }
        }
      }

      // Движение астероидов (медленно, ~10 px/сек)
      for (const a of state.asteroids) {
        const h = Math.hypot(a.vx, a.vy) || 1;
        a.x += (a.vx / h) * MINING_ASTEROID_SPEED;
        a.y += (a.vy / h) * MINING_ASTEROID_SPEED;
        if (a.x < 0 || a.x > MINING_ARENA_WIDTH) a.vx *= -1;
        if (a.y < 0 || a.y > MINING_ARENA_HEIGHT) a.vy *= -1;
        a.x = Math.max(0, Math.min(MINING_ARENA_WIDTH, a.x));
        a.y = Math.max(0, Math.min(MINING_ARENA_HEIGHT, a.y));
      }
    }
  }

  getState(sessionId: string): MiningState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getSessionByPlayer(playerId: string): MiningState | null {
    const sid = this.playerToSession.get(playerId);
    return sid ? this.sessions.get(sid) ?? null : null;
  }

  getAllSessions(): Map<string, MiningState> {
    return new Map(this.sessions);
  }

  exitMining(playerId: string, player: Player): { collected: MiningState['collected'] } | null {
    const sid = this.playerToSession.get(playerId);
    if (!sid) return null;
    const state = this.sessions.get(sid);
    if (!state) return null;

    this.sessions.delete(sid);
    this.playerToSession.delete(playerId);
    this.controlState.delete(playerId);
    this.fireTickCounter.delete(sid);

    const collected = [...state.collected];
    const cargo = StorageSystem.getShipCargo(player);
    for (const c of collected) {
      StorageSystem.addToCargo(cargo, c.itemId, c.quantity);
    }

    return { collected };
  }
}

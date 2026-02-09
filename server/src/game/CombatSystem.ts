import {
  CombatState,
  CombatShip,
  Projectile,
  Vector2D,
  Player,
  WeaponType,
  ShipType,
  Ship,
  Weapon,
} from '@hexploration/shared';
import { 
  COMBAT_ARENA_WIDTH, 
  COMBAT_ARENA_HEIGHT, 
  DEFAULT_WEAPONS, 
  SHIP_MAX_SPEED, 
  SHIP_ACCELERATION,
  SHIP_MAX_HEALTH,
  SHIP_MAX_ENERGY,
  SHIP_HIT_RADIUS,
  BOT_MAX_SPEED,
  BOT_ACCELERATION,
  SHIP_ENERGY_REGEN,
  BOT_ENERGY_REGEN,
  BOT_WEAPON_COOLDOWN_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  BOOST_ACCELERATION_MULTIPLIER,
  BOOST_ENERGY_COST,
  BOOST_MIN_ENERGY
} from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';
import { NPCBot } from './NPCBot';

export class CombatSystem {
  private combats: Map<string, CombatState> = new Map();
  private bots: Map<string, NPCBot> = new Map();
  private boostStates: Map<string, boolean> = new Map(); // combatId:playerId -> isBoostActive

  constructor() {
    console.log('🚀 CombatSystem initialized with:');
    console.log('  SHIP_MAX_SPEED:', SHIP_MAX_SPEED);
    console.log('  SHIP_ACCELERATION:', SHIP_ACCELERATION);
  }

  /**
   * Начать бой между игроками
   */
  startCombat(participants: Player[]): CombatState {
    const combatId = uuidv4();
    
    const ships: CombatShip[] = participants.map((player, index) => ({
      playerId: player.id,
      position: this.getStartPosition(index, participants.length),
      velocity: { x: 0, y: 0 },
      rotation: index === 0 ? Math.PI : 0, // Смотрят друг на друга
      angularVelocity: 0,
      health: player.ship.health,
      energy: player.ship.energy,
      weaponCooldowns: new Map(),
    }));

    const combat: CombatState = {
      id: combatId,
      participants: participants.map(p => p.id),
      ships,
      projectiles: [],
      arena: {
        width: COMBAT_ARENA_WIDTH,
        height: COMBAT_ARENA_HEIGHT,
        boundaries: 'bounce',
      },
      startTime: Date.now(),
      duration: 180000, // 3 минуты
    };

    this.combats.set(combatId, combat);
    return combat;
  }

  /**
   * Получить стартовую позицию для корабля
   */
  private getStartPosition(index: number, total: number): Vector2D {
    const spacing = COMBAT_ARENA_WIDTH / (total + 1);
    return {
      x: spacing * (index + 1),
      y: COMBAT_ARENA_HEIGHT / 2,
    };
  }

  /**
   * Начать бой с NPC-ботом
   */
  startCombatWithBot(player: Player): CombatState {
    const botId = 'bot_' + uuidv4();
    
    // Создать бота с такими же характеристиками как у игрока
    const botShip: Ship = {
      id: uuidv4(),
      name: 'Combat Bot',
      type: ShipType.FIGHTER,
      health: player.ship.maxHealth,
      maxHealth: player.ship.maxHealth,
      energy: player.ship.maxEnergy,
      maxEnergy: player.ship.maxEnergy,
      speed: player.ship.speed,
      turnRate: player.ship.turnRate,
      weapons: DEFAULT_WEAPONS,
    };

    const botPlayer: Player = {
      id: botId,
      username: 'Combat Bot',
      position: player.position,
      ship: botShip,
      resources: 0,
      experience: 0,
      level: 1,
      online: true,
      moveTimer: 0,
      canMove: true,
    };

    // Создать бой
    const combat = this.startCombat([player, botPlayer]);

    // Создать AI для бота
    this.bots.set(combat.id, new NPCBot(combat.id, botId));

    return combat;
  }

  /**
   * Обновить состояние боя
   */
  updateCombat(combatId: string, deltaTime: number): CombatState | null {
    const combat = this.combats.get(combatId);
    if (!combat) return null;

    // Обновить позиции кораблей
    combat.ships.forEach(ship => {
      ship.position.x += ship.velocity.x * deltaTime;
      ship.position.y += ship.velocity.y * deltaTime;
      ship.rotation += ship.angularVelocity * deltaTime;

      // Границы арены
      this.handleBoundaries(ship, combat.arena);
      
      // Восстановление энергии (зависит от того, бот это или игрок)
      const isBot = ship.playerId.startsWith('bot_') || ship.playerId.startsWith('BOT_');
      const energyRegen = isBot ? BOT_ENERGY_REGEN : SHIP_ENERGY_REGEN;
      
      // Проверить активность ускорения
      const boostKey = `${combatId}:${ship.playerId}`;
      const isBoostActive = this.boostStates.get(boostKey) || false;
      
      // Расход энергии при ускорении
      let energyChange = energyRegen * deltaTime;
      if (isBoostActive) {
        energyChange -= BOOST_ENERGY_COST * deltaTime;
      }
      
      ship.energy = Math.max(0, Math.min(ship.energy + energyChange, SHIP_MAX_ENERGY));
    });

    // Обновить снаряды
    combat.projectiles = combat.projectiles.filter(proj => {
      proj.position.x += proj.velocity.x * deltaTime;
      proj.position.y += proj.velocity.y * deltaTime;
      proj.lifetime -= deltaTime;

      // Проверить попадания
      if (this.checkCollisions(proj, combat.ships)) {
        return false; // Удалить снаряд
      }

      return proj.lifetime > 0;
    });

    // Обновить кулдауны
    combat.ships.forEach(ship => {
      ship.weaponCooldowns.forEach((cooldown, weaponId) => {
        const newCooldown = Math.max(0, cooldown - deltaTime);
        if (newCooldown === 0) {
          ship.weaponCooldowns.delete(weaponId);
        } else {
          ship.weaponCooldowns.set(weaponId, newCooldown);
        }
      });
    });

    // Обработать AI бота
    const bot = this.bots.get(combatId);
    if (bot && combat.ships.length >= 2) {
      const botShip = combat.ships.find(s => s.playerId === bot.playerId);
      const playerShip = combat.ships.find(s => s.playerId !== bot.playerId);

      if (botShip && playerShip) {
        const actions = bot.decideActions(combat, botShip, playerShip);
        
        // Применить управление
        this.applyControl(combatId, bot.playerId, actions.thrust, actions.turn);
        
        // Стрелять если нужно
        if (actions.fire && actions.weaponId) {
          const weapon = DEFAULT_WEAPONS.find(w => w.id === actions.weaponId);
          if (weapon) {
            this.fireWeapon(combatId, bot.playerId, actions.weaponId, weapon);
          }
        }
      }
    }

    return combat;
  }

  /**
   * Обработка границ арены
   */
  private handleBoundaries(ship: CombatShip, arena: CombatState['arena']): void {
    if (arena.boundaries === 'bounce') {
      if (ship.position.x < 0 || ship.position.x > arena.width) {
        ship.velocity.x *= -0.8; // Отскок с потерей скорости
        ship.position.x = Math.max(0, Math.min(arena.width, ship.position.x));
      }
      if (ship.position.y < 0 || ship.position.y > arena.height) {
        ship.velocity.y *= -0.8;
        ship.position.y = Math.max(0, Math.min(arena.height, ship.position.y));
      }
    }
  }

  /**
   * Проверка столкновений снаряда с кораблями
   */
  private checkCollisions(projectile: Projectile, ships: CombatShip[]): boolean {
    for (const ship of ships) {
      if (ship.playerId === projectile.ownerId) continue;

      const distance = Math.sqrt(
        Math.pow(ship.position.x - projectile.position.x, 2) +
        Math.pow(ship.position.y - projectile.position.y, 2)
      );

      if (distance < SHIP_HIT_RADIUS) {
        ship.health -= projectile.damage;
        return true; // Попадание
      }
    }
    return false;
  }

  /**
   * Выстрелить из оружия
   */
  fireWeapon(
    combatId: string,
    playerId: string,
    weaponId: string,
    weapon: any
  ): boolean {
    const combat = this.combats.get(combatId);
    if (!combat) return false;

    const ship = combat.ships.find(s => s.playerId === playerId);
    if (!ship) return false;

    // Проверить кулдаун
    if (ship.weaponCooldowns.has(weaponId)) {
      console.log(`❌ Выстрел отклонен: кулдаун ${ship.weaponCooldowns.get(weaponId)}`);
      return false;
    }

    // Проверить энергию
    if (ship.energy < weapon.energyCost) {
      console.log(`❌ Выстрел отклонен: недостаточно энергии (${ship.energy}/${weapon.energyCost})`);
      return false;
    }

    // Создать снаряд
    const projectile: Projectile = {
      id: uuidv4(),
      weaponId,
      ownerId: playerId,
      position: { ...ship.position },
      velocity: {
        x: Math.cos(ship.rotation) * weapon.projectileSpeed,
        y: Math.sin(ship.rotation) * weapon.projectileSpeed,
      },
      damage: weapon.damage,
      lifetime: weapon.range / weapon.projectileSpeed,
    };

    combat.projectiles.push(projectile);

    // Установить кулдаун (для ботов в 1.5 раза больше)
    const isBot = playerId.startsWith('bot_') || playerId.startsWith('BOT_');
    const cooldown = isBot ? weapon.cooldown * BOT_WEAPON_COOLDOWN_MULTIPLIER : weapon.cooldown;
    ship.weaponCooldowns.set(weaponId, cooldown);

    // Потратить энергию
    ship.energy -= weapon.energyCost;

    console.log(`✅ Выстрел ${isBot ? '(бот)' : '(игрок)'}! Снарядов в бою: ${combat.projectiles.length}, кулдаун: ${cooldown.toFixed(2)}s, энергия: ${ship.energy.toFixed(1)}`);

    return true;
  }

  /**
   * Применить управление к кораблю
   */
  applyControl(
    combatId: string,
    playerId: string,
    thrust: number,
    turn: number,
    boost: boolean = false
  ): boolean {
    const combat = this.combats.get(combatId);
    if (!combat) return false;

    const ship = combat.ships.find(s => s.playerId === playerId);
    if (!ship) return false;

    // Определить является ли корабль ботом
    const isBot = playerId.startsWith('bot_') || playerId.startsWith('BOT_');
    let acceleration = isBot ? BOT_ACCELERATION : SHIP_ACCELERATION;
    let maxSpeed = isBot ? BOT_MAX_SPEED : SHIP_MAX_SPEED;

    // Применить ускорение (boost) если активно и есть энергия
    let boostActive = false;
    if (boost && ship.energy >= BOOST_MIN_ENERGY) {
      acceleration *= BOOST_ACCELERATION_MULTIPLIER;
      maxSpeed *= BOOST_SPEED_MULTIPLIER;
      boostActive = true;
    }

    // Применить поворот
    ship.angularVelocity = turn;

    // Применить тягу
    const thrustX = Math.cos(ship.rotation) * thrust;
    const thrustY = Math.sin(ship.rotation) * thrust;

    ship.velocity.x += thrustX * acceleration;
    ship.velocity.y += thrustY * acceleration;

    // Ограничить скорость
    const speed = Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2);
    if (speed > maxSpeed) {
      ship.velocity.x = (ship.velocity.x / speed) * maxSpeed;
      ship.velocity.y = (ship.velocity.y / speed) * maxSpeed;
    }

    // Сохранить состояние ускорения для расхода энергии
    const boostKey = `${combatId}:${playerId}`;
    this.boostStates.set(boostKey, boostActive);

    return true;
  }

  /**
   * Получить состояние боя
   */
  getCombat(combatId: string): CombatState | undefined {
    return this.combats.get(combatId);
  }

  /**
   * Завершить бой
   */
  endCombat(combatId: string): void {
    // Очистить все boost состояния для этого боя
    const keysToDelete: string[] = [];
    this.boostStates.forEach((_, key) => {
      if (key.startsWith(`${combatId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.boostStates.delete(key));
    
    this.combats.delete(combatId);
    this.bots.delete(combatId);
  }
}

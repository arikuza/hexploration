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
  hexKey,
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
  BOT_TURN_RATE,
  SHIP_ENERGY_REGEN,
  BOT_ENERGY_REGEN,
  BOT_WEAPON_COOLDOWN_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  BOOST_ACCELERATION_MULTIPLIER,
  BOOST_ENERGY_COST,
  BOOST_MIN_ENERGY,
  SHIP_STATS,
  SHIP_TURN_RATE,
} from '@hexploration/shared';
import { v4 as uuidv4 } from 'uuid';
import { NPCBot } from './NPCBot.js';

export class CombatSystem {
  private combats: Map<string, CombatState> = new Map();
  private bots: Map<string, NPCBot> = new Map();
  private boostStates: Map<string, boolean> = new Map(); // combatId:playerId -> isBoostActive
  private strafeStates: Map<string, number> = new Map(); // combatId:playerId -> strafe value (-1, 0, 1)

  constructor() {
    console.log('🚀 CombatSystem initialized with:');
    console.log('  SHIP_MAX_SPEED:', SHIP_MAX_SPEED);
    console.log('  SHIP_ACCELERATION:', SHIP_ACCELERATION);
  }

  /**
   * Создать CombatShip с учётом характеристик participant.ship
   */
  private createCombatShip(participant: Player, index: number, total: number): CombatShip {
    const s = participant.ship;
    const isBot = participant.id.startsWith('bot_') || participant.id.startsWith('invader_');
    const baseStats = SHIP_STATS[s.type as keyof typeof SHIP_STATS] ?? SHIP_STATS.fighter;
    const speedMult = s.speed / baseStats.speed;
    const turnMult = s.turnRate / baseStats.turnRate;
    const cs = {
      playerId: participant.id,
      position: this.getStartPosition(index, total),
      velocity: { x: 0, y: 0 },
      rotation: index === 0 ? Math.PI : 0,
      angularVelocity: 0,
      health: s.health,
      energy: s.energy,
      weaponCooldowns: new Map(),
      maxSpeed: SHIP_MAX_SPEED * speedMult,
      turnRate: SHIP_TURN_RATE * turnMult,
      maxHealth: s.maxHealth,
      maxEnergy: s.maxEnergy,
      acceleration: isBot ? BOT_ACCELERATION : SHIP_ACCELERATION,
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CombatSystem.ts:createCombatShip',message:'createCombatShip result',data:{playerId:participant.id,health:cs.health,maxHealth:cs.maxHealth,energy:cs.energy,maxEnergy:cs.maxEnergy},timestamp:Date.now(),hypothesisId:'H-C',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    return cs;
  }

  /**
   * Начать бой между игроками
   */
  startCombat(participants: Player[]): CombatState {
    const combatId = uuidv4();
    
    const ships: CombatShip[] = participants.map((player, index) =>
      this.createCombatShip(player, index, participants.length)
    );

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
   * Базовые характеристики бота (без бонусов прокачки игрока)
   */
  private getBotBaseStats() {
    const stats = SHIP_STATS.fighter;
    return { maxHealth: stats.maxHealth, maxEnergy: stats.maxEnergy, speed: stats.speed, turnRate: stats.turnRate };
  }

  /**
   * Начать бой с NPC-ботом
   */
  startCombatWithBot(player: Player): CombatState {
    const botId = 'bot_' + uuidv4();
    const base = this.getBotBaseStats();
    const botShip: Ship = {
      id: uuidv4(),
      name: 'Combat Bot',
      type: ShipType.FIGHTER,
      health: base.maxHealth,
      maxHealth: base.maxHealth,
      energy: base.maxEnergy,
      maxEnergy: base.maxEnergy,
      speed: base.speed,
      turnRate: base.turnRate,
      weapons: DEFAULT_WEAPONS,
    };

    const botPlayer: Player = {
      id: botId,
      username: 'Combat Bot',
      position: player.position,
      ship: botShip,
      resources: 0,
      credits: 0,
      experience: 0,
      level: 1,
      online: true,
      moveTimer: 0,
      canMove: true,
    };

    // Создать бой
    const combat = this.startCombat([player, botPlayer]);
    combat.combatType = 'bot';

    // Создать AI для бота
    this.bots.set(`${combat.id}:${botId}`, new NPCBot(combat.id, botId));

    return combat;
  }

  /**
   * Начать бой с несколькими NPC-ботами (1–3 в зависимости от УУ)
   */
  startCombatWithBots(player: Player, botCount: number): CombatState {
    botCount = Math.max(1, Math.min(3, Math.round(botCount)));
    const participants: Player[] = [player];

    const base = this.getBotBaseStats();
    for (let i = 0; i < botCount; i++) {
      const botId = 'bot_' + uuidv4();
      const botShip: Ship = {
        id: uuidv4(),
        name: 'Combat Bot',
        type: ShipType.FIGHTER,
        health: base.maxHealth,
        maxHealth: base.maxHealth,
        energy: base.maxEnergy,
        maxEnergy: base.maxEnergy,
        speed: base.speed,
        turnRate: base.turnRate,
        weapons: DEFAULT_WEAPONS,
      };
      const botPlayer: Player = {
        id: botId,
        username: `Бот ${i + 1}`,
        position: player.position,
        ship: botShip,
        resources: 0,
        credits: 0,
        experience: 0,
        level: 1,
        online: true,
        moveTimer: 0,
        canMove: true,
      };
      participants.push(botPlayer);
    }

    const combat = this.startCombat(participants);
    combat.combatType = 'bot';
    combat.hexKey = hexKey(player.position);

    participants.forEach(p => {
      if (p.id.startsWith('bot_')) {
        this.bots.set(`${combat.id}:${p.id}`, new NPCBot(combat.id, p.id));
      }
    });

    return combat;
  }

  /**
   * Начать бой с инвайдерами (вторжение)
   */
  startCombatInvasion(
    player: Player,
    hexKeyStr: string,
    invasionId: string,
    enemyCount: number
  ): CombatState {
    const participants: Player[] = [player];
    const invaderIds: string[] = [];

    const base = this.getBotBaseStats();
    for (let i = 0; i < enemyCount; i++) {
      const invaderId = 'invader_' + uuidv4();
      invaderIds.push(invaderId);
      const invaderShip: Ship = {
        id: uuidv4(),
        name: 'Инвайдер',
        type: ShipType.FIGHTER,
        health: base.maxHealth * 0.8,
        maxHealth: base.maxHealth * 0.8,
        energy: base.maxEnergy,
        maxEnergy: base.maxEnergy,
        speed: base.speed * 0.9,
        turnRate: base.turnRate,
        weapons: DEFAULT_WEAPONS,
      };
      const invaderPlayer: Player = {
        id: invaderId,
        username: 'Инвайдер',
        position: player.position,
        ship: invaderShip,
        resources: 0,
        credits: 0,
        experience: 0,
        level: 1,
        online: true,
        moveTimer: 0,
        canMove: true,
      };
      participants.push(invaderPlayer);
    }

    const combat = this.startCombat(participants);
    combat.hexKey = hexKeyStr;
    combat.combatType = 'invasion';
    combat.invasionId = invasionId;
    combat.joinable = true;
    combat.maxParticipants = 4;

    participants.forEach(p => {
      if (p.id.startsWith('invader_')) {
        this.bots.set(`${combat.id}:${p.id}`, new NPCBot(combat.id, p.id));
      }
    });

    return combat;
  }

  /**
   * Добавить игрока в существующий бой (присоединиться)
   */
  addPlayerToCombat(combatId: string, player: Player): CombatState | null {
    const combat = this.combats.get(combatId);
    if (!combat || !combat.joinable) return null;
    if (combat.maxParticipants && combat.participants.length >= combat.maxParticipants) return null;
    if (combat.participants.includes(player.id)) return null;

    const ship = this.createCombatShip(player, combat.participants.length, combat.participants.length + 1);
    ship.rotation = Math.PI / 2;

    combat.participants.push(player.id);
    combat.ships.push(ship);
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
      // Восстановление энергии (зависит от того, бот это или игрок)
      const isBot = ship.playerId.startsWith('bot_') || ship.playerId.startsWith('BOT_');
      const energyRegen = isBot ? BOT_ENERGY_REGEN : SHIP_ENERGY_REGEN;
      
      // Проверить активность ускорения и стрейфа
      const controlKey = `${combatId}:${ship.playerId}`;
      const isBoostActive = this.boostStates.get(controlKey) || false;
      const strafeValue = this.strafeStates.get(controlKey) || 0;
      
      // Применить стрейф каждый кадр физики ДО обновления позиции
      if (strafeValue !== 0) {
        let acceleration = ship.acceleration ?? (isBot ? BOT_ACCELERATION : SHIP_ACCELERATION);
        let maxSpeed = ship.maxSpeed ?? (isBot ? BOT_MAX_SPEED : SHIP_MAX_SPEED);
        
        // Применить ускорение (boost) если активно
        if (isBoostActive && ship.energy >= BOOST_MIN_ENERGY) {
          acceleration *= BOOST_ACCELERATION_MULTIPLIER;
          maxSpeed *= BOOST_SPEED_MULTIPLIER;
        }
        
        // Увеличиваем силу стрейфа для более заметного эффекта
        // Стрейф должен быть более заметным - используем увеличенное ускорение БЕЗ умножения на deltaTime
        // так как deltaTime уже учтен в обновлении позиции
        const strafeAcceleration = acceleration * 2.0; // 200% от основного ускорения для очень заметного эффекта
        const strafeX = strafeValue * (-Math.sin(ship.rotation)) * strafeAcceleration * deltaTime;
        const strafeY = strafeValue * Math.cos(ship.rotation) * strafeAcceleration * deltaTime;
        
        const velBefore = { x: ship.velocity.x, y: ship.velocity.y };
        ship.velocity.x += strafeX;
        ship.velocity.y += strafeY;
        
        // Ограничить скорость после применения стрейфа
        const speedBefore = Math.sqrt(velBefore.x ** 2 + velBefore.y ** 2);
        const speedAfter = Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2);
        if (speedAfter > maxSpeed) {
          // Сохраняем направление движения, включая компонент стрейфа
          ship.velocity.x = (ship.velocity.x / speedAfter) * maxSpeed;
          ship.velocity.y = (ship.velocity.y / speedAfter) * maxSpeed;
        }
        
        // Логирование для отладки - ВСЕГДА логируем стрейф для диагностики
        const finalSpeed = Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2);
        console.log(`[STRAFE UPDATE] Player ${ship.playerId}: strafe=${strafeValue}, rotation=${(ship.rotation * 180 / Math.PI).toFixed(1)}°, strafeVec=(${strafeX.toFixed(3)}, ${strafeY.toFixed(3)}), velBefore=(${velBefore.x.toFixed(2)}, ${velBefore.y.toFixed(2)}), velAfter=(${ship.velocity.x.toFixed(2)}, ${ship.velocity.y.toFixed(2)}), speedBefore=${speedBefore.toFixed(2)}, speedAfter=${speedAfter.toFixed(2)}, finalSpeed=${finalSpeed.toFixed(2)}, maxSpeed=${maxSpeed.toFixed(2)}, deltaTime=${deltaTime.toFixed(4)}`);
      }
      
      // Обновить позицию на основе скорости (ПОСЛЕ применения всех сил)
      ship.position.x += ship.velocity.x * deltaTime;
      ship.position.y += ship.velocity.y * deltaTime;
      ship.rotation += ship.angularVelocity * deltaTime;

      // Границы арены
      this.handleBoundaries(ship, combat.arena);
      
      // Расход энергии при ускорении
      let energyChange = energyRegen * deltaTime;
      if (isBoostActive) {
        energyChange -= BOOST_ENERGY_COST * deltaTime;
      }
      
      const maxEnergy = ship.maxEnergy ?? SHIP_MAX_ENERGY;
      ship.energy = Math.max(0, Math.min(ship.energy + energyChange, maxEnergy));
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

    // Удалить мёртвых инвайдеров
    if (combat.combatType === 'invasion') {
      const deadInvaders = combat.ships.filter(s => s.health <= 0 && s.playerId.startsWith('invader_'));
      combat.ships = combat.ships.filter(s => s.health > 0);
      deadInvaders.forEach(s => this.bots.delete(`${combatId}:${s.playerId}`));
    }

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

    // Обработать AI всех ботов
    this.bots.forEach((bot, key) => {
      if (!key.startsWith(`${combatId}:`)) return;
      const botShip = combat.ships.find(s => s.playerId === bot.playerId);
      const playerShips = combat.ships.filter(s => !s.playerId.startsWith('bot_') && !s.playerId.startsWith('invader_'));
      const playerShip = playerShips[0];

      if (botShip && playerShip) {
        const actions = bot.decideActions(combat, botShip, playerShip);
        
        this.applyControl(combatId, bot.playerId, actions.thrust, actions.turn, false, 0);
        
        if (actions.fire && actions.weaponId) {
          const weapon = DEFAULT_WEAPONS.find(w => w.id === actions.weaponId);
          if (weapon) {
            this.fireWeapon(combatId, bot.playerId, actions.weaponId, weapon);
          }
        }
      }
    });

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
        ship.health = Math.max(0, ship.health - projectile.damage);
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
    boost: boolean = false,
    strafe: number = 0
  ): boolean {
    // Логирование ВСЕХ вызовов applyControl для диагностики
    if (strafe !== 0) {
      console.log(`[APPLY CONTROL CALLED] combatId=${combatId}, playerId=${playerId}, strafe=${strafe}, thrust=${thrust}, turn=${turn}, boost=${boost}`);
    }
    
    const combat = this.combats.get(combatId);
    if (!combat) {
      if (strafe !== 0) {
        console.log(`[APPLY CONTROL ERROR] Combat not found: ${combatId}`);
      }
      return false;
    }

    const ship = combat.ships.find(s => s.playerId === playerId);
    if (!ship) {
      if (strafe !== 0) {
        console.log(`[APPLY CONTROL ERROR] Ship not found for player: ${playerId}`);
      }
      return false;
    }

    // Определить является ли корабль ботом
    const isBot = playerId.startsWith('bot_') || playerId.startsWith('BOT_');
    let acceleration = ship.acceleration ?? (isBot ? BOT_ACCELERATION : SHIP_ACCELERATION);
    let maxSpeed = ship.maxSpeed ?? (isBot ? BOT_MAX_SPEED : SHIP_MAX_SPEED);

    // Применить ускорение (boost) если активно и есть энергия
    let boostActive = false;
    if (boost && ship.energy >= BOOST_MIN_ENERGY) {
      acceleration *= BOOST_ACCELERATION_MULTIPLIER;
      maxSpeed *= BOOST_SPEED_MULTIPLIER;
      boostActive = true;
    }

    // Применить поворот (ограничить угловую скорость по turnRate корабля)
    const turnRate = ship.turnRate ?? (isBot ? BOT_TURN_RATE : SHIP_TURN_RATE);
    ship.angularVelocity = Math.max(-turnRate, Math.min(turnRate, turn));

    // Применить тягу
    const thrustX = Math.cos(ship.rotation) * thrust;
    const thrustY = Math.sin(ship.rotation) * thrust;

    ship.velocity.x += thrustX * acceleration;
    ship.velocity.y += thrustY * acceleration;

    // Стрейф теперь применяется каждый кадр физики в updateCombat для плавности
    // Здесь только сохраняем состояние стрейфа

    // Ограничить скорость ПОСЛЕ применения всех сил (тяга + стрейф)
    const speed = Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2);
    if (speed > maxSpeed) {
      // Нормализуем вектор скорости и умножаем на максимальную скорость
      // Это сохраняет направление движения, включая компонент стрейфа
      ship.velocity.x = (ship.velocity.x / speed) * maxSpeed;
      ship.velocity.y = (ship.velocity.y / speed) * maxSpeed;
    }

    // Сохранить состояние ускорения и стрейфа для применения каждый кадр физики
    const controlKey = `${combatId}:${playerId}`;
    this.boostStates.set(controlKey, boostActive);
    this.strafeStates.set(controlKey, strafe);
    
    // Логирование для отладки - ВСЕГДА логируем стрейф
    if (strafe !== 0) {
      console.log(`[APPLY CONTROL] Player ${playerId}: strafe=${strafe}, thrust=${thrust}, turn=${turn}, boost=${boostActive}, saved to strafeStates[${controlKey}]`);
    }

    return true;
  }

  /**
   * Получить состояние боя
   */
  getCombat(combatId: string): CombatState | undefined {
    return this.combats.get(combatId);
  }

  /**
   * Список активных боёв (для отображения и подключения)
   */
  getActiveCombats(hexKeyFilter?: string): Array<{ combatId: string; hexKey: string; combatType: string; participantsCount: number; maxParticipants?: number }> {
    const result: Array<{ combatId: string; hexKey: string; combatType: string; participantsCount: number; maxParticipants?: number }> = [];
    this.combats.forEach((combat, combatId) => {
      if (combat.hexKey && combat.joinable) {
        if (hexKeyFilter && combat.hexKey !== hexKeyFilter) return;
        result.push({
          combatId,
          hexKey: combat.hexKey,
          combatType: combat.combatType || 'unknown',
          participantsCount: combat.participants.filter(p => !p.startsWith('invader_')).length,
          maxParticipants: combat.maxParticipants,
        });
      }
    });
    return result;
  }

  /**
   * Завершить бой
   */
  endCombat(combatId: string): void {
    const keysToDelete: string[] = [];
    this.boostStates.forEach((_, key) => {
      if (key.startsWith(`${combatId}:`)) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => this.boostStates.delete(key));
    
    this.bots.forEach((_, key) => {
      if (key.startsWith(`${combatId}:`)) this.bots.delete(key);
    });
    
    this.combats.delete(combatId);
  }
}

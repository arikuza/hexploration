import { CombatState, CombatShip, BotActions } from '@hexploration/shared';

/**
 * NPC-бот с простым AI для боя
 */
export class NPCBot {
  private combatId: string;
  public playerId: string;
  private lastEvadeTime: number = 0;
  private evadeDuration: number = 0;
  private evadeDirection: number = 1;

  constructor(combatId: string, playerId: string) {
    this.combatId = combatId;
    this.playerId = playerId;
  }

  /**
   * Принять решение о действиях бота
   */
  decideActions(
    combat: CombatState,
    botShip: CombatShip,
    playerShip: CombatShip
  ): BotActions {
    // Вектор к игроку
    const dx = playerShip.position.x - botShip.position.x;
    const dy = playerShip.position.y - botShip.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Угол к игроку
    const angleToPlayer = Math.atan2(dy, dx);
    
    // Разница между текущим направлением и направлением к игроку
    let angleDiff = angleToPlayer - botShip.rotation;
    
    // Нормализовать угол в диапазон [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // По умолчанию
    let thrust = 0;
    let turn = 0;
    let fire = false;

    // Логика уклонения при низком здоровье
    const now = Date.now();
    if (botShip.health < botShip.health * 0.3 || botShip.health < 30) {
      // Активировать уклонение
      if (now - this.lastEvadeTime > this.evadeDuration) {
        this.lastEvadeTime = now;
        this.evadeDuration = 1000 + Math.random() * 2000; // 1-3 секунды
        this.evadeDirection = Math.random() > 0.5 ? 1 : -1;
      }

      // Случайные маневры
      if (now - this.lastEvadeTime < this.evadeDuration) {
        turn = this.evadeDirection * 2.5;
        thrust = 1;
        return { thrust, turn, fire: false };
      }
    }

    // Логика преследования
    if (distance > 300) {
      // Далеко - лететь к игроку
      thrust = 1;
      
      // Поворачивать к игроку
      if (Math.abs(angleDiff) > 0.1) {
        turn = angleDiff > 0 ? 2 : -2;
      }
    } else if (distance > 150) {
      // Средняя дистанция - держать дистанцию и стрелять
      thrust = 0.5;
      
      // Поворачивать к игроку
      if (Math.abs(angleDiff) > 0.05) {
        turn = angleDiff > 0 ? 2 : -2;
      }
    } else {
      // Слишком близко - отступить
      thrust = -0.5;
      
      // Всё равно целиться в игрока
      if (Math.abs(angleDiff) > 0.05) {
        turn = angleDiff > 0 ? 1 : -1;
      }
    }

    // Логика стрельбы
    const aimAccuracy = Math.abs(angleDiff);
    const hasEnoughEnergy = botShip.energy >= 20;
    const inRange = distance < 600;
    const inAimCone = aimAccuracy < 0.25; // ~15 градусов

    if (hasEnoughEnergy && inRange && inAimCone) {
      fire = true;
    }

    return {
      thrust,
      turn,
      fire,
      weaponId: fire ? 'laser_basic' : undefined,
    };
  }
}

import type { Player, Ship, Weapon } from '@hexploration/shared';
import { WeaponType } from '@hexploration/shared';

const BONUS_PER_LEVEL = 0.05; // 5% за уровень
const TACTICS_HEALTH_PER_LEVEL = 0.02; // 2% maxHealth за уровень тактики

/**
 * Получить корабль с учётом бонусов от боевых навыков
 */
export function getEffectiveShip(player: Player): Ship {
  const ship = player.ship;
  const levels = player.skills?.levels ?? {};
  const lvl = (id: string) => levels[id] ?? 0;

  const speedMult = 1 + lvl('frigate_command') * BONUS_PER_LEVEL;
  const turnMult = 1 + lvl('frigate_command') * BONUS_PER_LEVEL;
  const energyMult = 1 + lvl('energy_systems') * BONUS_PER_LEVEL;
  const healthMult = 1 + lvl('combat_tactics') * TACTICS_HEALTH_PER_LEVEL;
  const laserMult = 1 + lvl('small_lasers') * BONUS_PER_LEVEL;

  const weapons: Weapon[] = ship.weapons.map((w) => {
    const mult = w.type === WeaponType.LASER ? laserMult : 1;
    return { ...w, damage: Math.round(w.damage * mult) };
  });

  const newMaxHealth = Math.round(ship.maxHealth * healthMult);
  const newMaxEnergy = Math.round(ship.maxEnergy * energyMult);
  const newHealth = ship.health >= ship.maxHealth
    ? newMaxHealth
    : Math.round((ship.health / ship.maxHealth) * newMaxHealth);
  const newEnergy = ship.energy >= ship.maxEnergy
    ? newMaxEnergy
    : Math.round((ship.energy / ship.maxEnergy) * newMaxEnergy);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SkillBonus.ts:getEffectiveShip',message:'getEffectiveShip health/energy',data:{inHealth:ship.health,inMaxHealth:ship.maxHealth,newMaxHealth,newMaxEnergy,outHealth:newHealth,outEnergy:newEnergy,wasFull:ship.health>=ship.maxHealth},timestamp:Date.now(),hypothesisId:'H-A',runId:'post-fix'})}).catch(()=>{});
  // #endregion
  return {
    ...ship,
    maxHealth: newMaxHealth,
    maxEnergy: newMaxEnergy,
    speed: ship.speed * speedMult,
    turnRate: ship.turnRate * turnMult,
    weapons,
    health: newHealth,
    energy: newEnergy,
  };
}

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { gameWorld } from '../game/GameWorld.js';
import { getEffectiveShip } from '../game/SkillBonus.js';
import { SocketEvent, HexCoordinates, StructureType, CargoTransfer, OrderType, keyToHex } from '@hexploration/shared';
import { PlayerService } from '../database/services/PlayerService.js';
import { StationStorageService } from '../database/services/StationStorageService.js';
import { StorageSystem } from '../game/StorageSystem.js';
import { CraftingSystem } from '../game/CraftingSystem.js';
import { MarketSystem } from '../game/MarketSystem.js';
import { PlanetarySystemService } from '../database/services/PlanetarySystemService.js';
import { RECIPE_REGISTRY, QuestType, hexKey } from '@hexploration/shared';
import { QuestService } from '../database/services/QuestService.js';

interface AuthToken {
  userId: string;
  username: string;
}

/**
 * Настройка Socket.io для игры
 */
export function setupGameSocket(io: Server): void {
  // Передать io в gameWorld для отправки обновлений таймеров
  gameWorld.setIo(io);

  // Middleware для аутентификации
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Токен не предоставлен'));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default-secret'
      ) as AuthToken;
      
      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const player = await gameWorld.addPlayer(socket.data.userId, socket.data.username);

    // Присоединить сокет к комнате с userId для отправки персонализированных сообщений
    socket.join(socket.data.userId);
    console.log(`[Socket] Игрок ${socket.data.userId} присоединился к комнате ${socket.data.userId}`);

    // Отправить успешную аутентификацию
    socket.emit(SocketEvent.AUTH_SUCCESS, { player: serializePlayer(player) });

    // Отправить текущее состояние игры
    const state = gameWorld.getState();
    socket.emit(SocketEvent.GAME_STATE, serializeGameState(state));

    // Уведомить всех о новом игроке
    socket.broadcast.emit(SocketEvent.PLAYER_JOIN, {
      player: serializePlayer(player),
    });

    // Отправить список игроков
    socket.emit(SocketEvent.PLAYERS_LIST, {
      players: gameWorld.getOnlinePlayers().map(serializePlayer),
    });

    /**
     * Движение игрока
     */
    socket.on(SocketEvent.MOVE, async (data: { target: HexCoordinates }) => {
      const userId = socket.data.userId;
      const success = gameWorld.movePlayer(userId, data.target);

      if (success) {
        const player = gameWorld.getPlayer(userId);
        if (player) {
          const saved = await PlayerService.savePlayer(player);
          if (!saved) console.error(`[MOVE] Не удалось сохранить userId=${userId}`);
        }
        socket.emit(SocketEvent.MOVE_SUCCESS, { 
          position: player?.position,
          moveTimer: player?.moveTimer,
          canMove: player?.canMove,
        });

        // Уведомить всех об обновлении
        io.emit(SocketEvent.GAME_UPDATE, {
          type: 'player_moved',
          playerId: userId,
          position: player?.position,
          moveTimer: player?.moveTimer,
          canMove: player?.canMove,
        });
      } else {
        socket.emit(SocketEvent.MOVE_ERROR, { message: 'Невозможно переместиться (таймер или расстояние)' });
      }
    });

    /**
     * Колонизировать систему
     */
    socket.on(SocketEvent.COLONIZE, async (data: { coordinates: HexCoordinates }) => {
      console.log(`🏛️ ${socket.data.username} пытается колонизировать [${data.coordinates.q}, ${data.coordinates.r}]`);
      
      const result = await gameWorld.colonizeSystem(socket.data.userId, data.coordinates);

      if (result.success) {
        socket.emit(SocketEvent.COLONIZE_SUCCESS, { coordinates: data.coordinates });
        
        // Уведомить всех об обновлении карты
        const state = gameWorld.getState();
        io.emit(SocketEvent.GAME_UPDATE, {
          type: 'colony_created',
          coordinates: data.coordinates,
          playerId: socket.data.userId,
          map: {
            radius: state.map.radius,
            cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({
              key,
              ...cell,
            })),
          },
        });
        
        console.log(`✅ Система [${data.coordinates.q}, ${data.coordinates.r}] колонизирована игроком ${socket.data.username}`);
      } else {
        socket.emit(SocketEvent.COLONIZE_ERROR, { message: result.error });
        console.log(`❌ Не удалось колонизировать: ${result.error}`);
      }
    });

    /**
     * Развить колонию
     */
    socket.on(SocketEvent.DEVELOP_COLONY, async (data: { coordinates: HexCoordinates }) => {
      console.log(`📈 ${socket.data.username} развивает колонию [${data.coordinates.q}, ${data.coordinates.r}]`);
      
      const result = await gameWorld.developColony(socket.data.userId, data.coordinates);

      if (result.success) {
        const cell = gameWorld.getHexMap().getCell(data.coordinates);
        socket.emit(SocketEvent.DEVELOP_SUCCESS, { 
          coordinates: data.coordinates,
          threat: cell?.threat,
        });
        
        // Уведомить всех об обновлении карты
        const state = gameWorld.getState();
        io.emit(SocketEvent.GAME_UPDATE, {
          type: 'colony_developed',
          coordinates: data.coordinates,
          playerId: socket.data.userId,
          threat: cell?.threat,
          map: {
            radius: state.map.radius,
            cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({
              key,
              ...cell,
            })),
          },
        });
        
        console.log(`✅ Колония [${data.coordinates.q}, ${data.coordinates.r}] развита до threat=${cell?.threat}`);
      } else {
        socket.emit(SocketEvent.DEVELOP_ERROR, { message: result.error });
        console.log(`❌ Не удалось развить колонию: ${result.error}`);
      }
    });

    /**
     * Начать бой
     */
    socket.on('combat:start', (data: { targetPlayerId: string }) => {
      console.log(`⚔️ ${socket.data.username} атакует ${data.targetPlayerId}`);
      
      const attacker = gameWorld.getPlayer(socket.data.userId);
      const target = gameWorld.getPlayer(data.targetPlayerId);
      
      if (!attacker || !target) {
        socket.emit('combat:error', { message: 'Игрок не найден' });
        return;
      }

      // Начать бой (с учётом бонусов навыков)
      const combatSystem = gameWorld.getCombatSystem();
      const attackerWithShip = { ...attacker, ship: getEffectiveShip(attacker) };
      const targetWithShip = { ...target, ship: getEffectiveShip(target) };
      const combat = combatSystem.startCombat([attackerWithShip, targetWithShip]);

      // Уведомить обоих игроков
      const attackerSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.userId === socket.data.userId);
      const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.userId === data.targetPlayerId);

      if (attackerSocket) attackerSocket.emit('combat:started', { combat });
      if (targetSocket) targetSocket.emit('combat:started', { combat });
      
      console.log(`⚔️ Бой начат: ${combat.id}`);

      // Обновлять бой каждые 16ms (~60 FPS)
      const updateInterval = setInterval(() => {
        const updatedCombat = combatSystem.updateCombat(combat.id, 0.016);
        
        if (!updatedCombat) {
          clearInterval(updateInterval);
          return;
        }

        // Отправить обновление обоим игрокам
        if (attackerSocket) attackerSocket.emit('combat:update', { combat: updatedCombat });
        if (targetSocket) targetSocket.emit('combat:update', { combat: updatedCombat });

        // Проверить окончание боя
        const allShipsDead = updatedCombat.ships.filter(s => s.health > 0).length <= 1;
        if (allShipsDead || Date.now() - updatedCombat.startTime > updatedCombat.duration) {
          const winner = updatedCombat.ships.find(s => s.health > 0);
          
          if (attackerSocket) attackerSocket.emit('combat:ended', { winner: winner?.playerId, combat: updatedCombat });
          if (targetSocket) targetSocket.emit('combat:ended', { winner: winner?.playerId, combat: updatedCombat });

          combatSystem.endCombat(combat.id);
          clearInterval(updateInterval);
          console.log(`⚔️ Бой завершен: ${combat.id}, победитель: ${winner?.playerId}`);
        }
      }, 16);
    });

    /**
     * Начать бой с ботом
     */
    socket.on('combat:start:bot', () => {
      console.log(`🤖 ${socket.data.username} начинает бой с ботом`);
      
      const player = gameWorld.getPlayer(socket.data.userId);
      
      if (!player) {
        socket.emit('combat:error', { message: 'Игрок не найден' });
        return;
      }

      // Определить количество ботов по уровню угрозы гекса (УУ)
      // УУ > 0: 1 бот. УУ от 0 до -1: 1–3 бота в зависимости от УУ
      const cell = gameWorld.getHexMap().getCell(player.position);
      const threat = cell?.threat ?? 0;
      let botCount: number;
      if (threat > 0) {
        botCount = 1;
      } else {
        // threat в [-1, 0]: 1 + round(-threat * 2), clamped 1–3
        botCount = Math.min(3, Math.max(1, 1 + Math.round(-threat * 2)));
      }

      // Начать бой с ботами (с учётом бонусов навыков игрока)
      const combatSystem = gameWorld.getCombatSystem();
      const playerWithShip = { ...player, ship: getEffectiveShip(player) };
      const combat = combatSystem.startCombatWithBots(playerWithShip, botCount);

      socket.join(`combat:${combat.id}`);
      socket.emit('combat:started', { combat });
      
      console.log(`🤖 Бой с ботом начат: ${combat.id}`);

      // Обновлять бой каждые 16ms (~60 FPS)
      const updateInterval = setInterval(async () => {
        const updatedCombat = combatSystem.updateCombat(combat.id, 0.016);
        
        if (!updatedCombat) {
          clearInterval(updateInterval);
          return;
        }

        io.to(`combat:${combat.id}`).emit('combat:update', { combat: updatedCombat });

        // Проверить окончание боя
        const aliveShips = updatedCombat.ships.filter(s => s.health > 0);
        const playerAlive = aliveShips.some(s => s.playerId === player.id);
        const allBotsDead = !aliveShips.some(s => s.playerId.startsWith('bot_'));
        const timeExpired = Date.now() - updatedCombat.startTime > updatedCombat.duration;
        const combatEnded = !playerAlive || allBotsDead || timeExpired;

        if (combatEnded) {
          const winner = playerAlive && allBotsDead ? player.id : (playerAlive ? player.id : 'bot');
          
          // Засчитать убийства ботов для квестов KILL_ENEMIES
          let activeQuests: typeof player.activeQuests | undefined;
          if (winner === player.id && combat.hexKey) {
            const botKills = updatedCombat.ships.filter(s => s.playerId.startsWith('bot_') && s.health <= 0).length;
            if (botKills > 0) {
              await gameWorld.updateQuestProgressOnKill(player.id, combat.hexKey, botKills);
              const p = gameWorld.getPlayer(player.id);
              if (p) {
                await PlayerService.savePlayer(p);
                activeQuests = p.activeQuests;
              }
            }
          }
          
          io.to(`combat:${combat.id}`).emit('combat:ended', { winner, combat: updatedCombat, activeQuests });
          socket.leave(`combat:${combat.id}`);

          combatSystem.endCombat(combat.id);
          clearInterval(updateInterval);
          console.log(`🤖 Бой с ботом завершен: ${combat.id}, победитель: ${winner}`);
        }
      }, 16);
    });

    /**
     * Начать бой с инвайдерами (вторжение)
     */
    socket.on('combat:start:invasion', (data: { hexKey: string }) => {
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) {
        socket.emit('combat:error', { message: 'Игрок не найден' });
        return;
      }
      const invasionSystem = gameWorld.getInvasionSystem();
      const invasion = invasionSystem.getInvasionByHex(data.hexKey);
      if (!invasion) {
        socket.emit('combat:error', { message: 'В этом гексе нет вторжения' });
        return;
      }
      const enemyCount = invasionSystem.getEnemyCountForHex(invasion.id, data.hexKey);
      if (enemyCount <= 0) {
        socket.emit('combat:error', { message: 'Все инвайдеры в этом гексе уже уничтожены' });
        return;
      }
      invasionSystem.decrementEnemies(invasion.id, data.hexKey, enemyCount);

      const combatSystem = gameWorld.getCombatSystem();
      const playerWithShip = { ...player, ship: getEffectiveShip(player) };
      const combat = combatSystem.startCombatInvasion(playerWithShip, data.hexKey, invasion.id, enemyCount);

      socket.join(`combat:${combat.id}`);
      socket.emit('combat:started', { combat });
      const updateInterval = setInterval(async () => {
        const updatedCombat = combatSystem.updateCombat(combat.id, 0.016);
        if (!updatedCombat) {
          clearInterval(updateInterval);
          return;
        }
        io.to(`combat:${combat.id}`).emit('combat:update', { combat: updatedCombat });
        const aliveShips = updatedCombat.ships.filter(s => s.health > 0);
        const playersAlive = aliveShips.filter(s => !s.playerId.startsWith('invader_'));
        const invadersAlive = aliveShips.filter(s => s.playerId.startsWith('invader_'));
        if (playersAlive.length === 0 || (invadersAlive.length === 0 && playersAlive.length > 0) || Date.now() - updatedCombat.startTime > updatedCombat.duration) {
          const winner = playersAlive.length > 0 ? 'players' : 'invaders';
          if (winner === 'invaders' && combat.combatType === 'invasion' && combat.invasionId && combat.hexKey) {
            gameWorld.getInvasionSystem().incrementEnemies(combat.invasionId, combat.hexKey, enemyCount);
            const inv = gameWorld.getInvasionSystem().getInvasionById(combat.invasionId);
            if (inv) {
              const state = gameWorld.getState();
              const invs = gameWorld.getInvasionSystem().getAllActive();
              io.emit(SocketEvent.GAME_UPDATE, {
                type: 'invasion_hex_cleared',
                sourceHexKey: inv.sourceHexKey,
                invasions: invs.map(i => ({ id: i.id, sourceHexKey: i.sourceHexKey, neighborHexKeys: i.neighborHexKeys, enemyCountPerHex: i.enemyCountPerHex })),
                map: { radius: state.map.radius, cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({ key, ...cell })) },
              });
            }
          }
          let activeQuests: Array<{ questId: string; progress: number; kills?: number; delivered?: number }> | undefined;
          if (winner === 'players' && combat.hexKey && enemyCount > 0) {
            for (const ship of playersAlive) {
              await gameWorld.updateQuestProgressOnKill(ship.playerId, combat.hexKey!, enemyCount);
              const p = gameWorld.getPlayer(ship.playerId);
              if (p) {
                await PlayerService.savePlayer(p);
                // Invasion обычно один игрок — активные квесты для победителя
                if (ship.playerId === socket.data.userId) activeQuests = p.activeQuests;
              }
            }
          }
          io.to(`combat:${combat.id}`).emit('combat:ended', { winner, combat: updatedCombat, activeQuests });
          combatSystem.endCombat(combat.id);
          clearInterval(updateInterval);

          if (winner === 'players' && combat.combatType === 'invasion' && combat.invasionId) {
            const inv = gameWorld.getInvasionSystem().getInvasionById(combat.invasionId);
            const isCleared = inv ? gameWorld.getInvasionSystem().isCleared(inv) : false;
            if (inv) {
              if (isCleared) {
                const cleared = gameWorld.getInvasionSystem().clearInvasion(inv.sourceHexKey);
                if (cleared) {
                  gameWorld.getHexMap().raiseThreatAfterInvasionCleared(keyToHex(inv.sourceHexKey));
                  gameWorld.saveWorld();
                }
              }
              const state = gameWorld.getState();
              const invs = gameWorld.getInvasionSystem().getAllActive();
              io.emit(SocketEvent.GAME_UPDATE, {
                type: isCleared ? 'invasion_cleared' : 'invasion_hex_cleared',
                sourceHexKey: inv.sourceHexKey,
                invasions: invs.map(i => ({ id: i.id, sourceHexKey: i.sourceHexKey, neighborHexKeys: i.neighborHexKeys, enemyCountPerHex: i.enemyCountPerHex })),
                map: { radius: state.map.radius, cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({ key, ...cell })) },
              });
            }
          }
        }
      }, 16);
    });

    /**
     * Список активных боёв
     */
    socket.on(SocketEvent.COMBAT_LIST_ACTIVE, (data?: { hexKey?: string }) => {
      const combats = gameWorld.getCombatSystem().getActiveCombats(data?.hexKey);
      socket.emit(SocketEvent.COMBAT_LIST_ACTIVE_DATA, { combats });
    });

    /**
     * Присоединиться к бою
     */
    socket.on(SocketEvent.COMBAT_JOIN, (data: { combatId: string }) => {
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) {
        socket.emit(SocketEvent.COMBAT_JOIN_ERROR, { message: 'Игрок не найден' });
        return;
      }
      const combat = gameWorld.getCombatSystem().getCombat(data.combatId);
      if (!combat || !combat.joinable) {
        socket.emit(SocketEvent.COMBAT_JOIN_ERROR, { message: 'Бой не найден или к нему нельзя присоединиться' });
        return;
      }
      const playerWithShip = { ...player, ship: getEffectiveShip(player) };
      const updated = gameWorld.getCombatSystem().addPlayerToCombat(data.combatId, playerWithShip);
      if (!updated) {
        socket.emit(SocketEvent.COMBAT_JOIN_ERROR, { message: 'Не удалось присоединиться' });
        return;
      }
      socket.join(`combat:${data.combatId}`);
      socket.emit(SocketEvent.COMBAT_JOIN_SUCCESS, { combat: updated });
      io.to(`combat:${data.combatId}`).emit('combat:update', { combat: updated });
    });

    /**
     * Управление кораблем в бою
     */
    socket.on('combat:control', (data: {
      combatId: string;
      thrust: number;
      turn: number;
      boost?: boolean;
      strafe?: number;
    }) => {
      const combatSystem = gameWorld.getCombatSystem();
      const strafeValue = data.strafe ?? 0;
      // Логирование для отладки - ВСЕГДА логируем стрейф
      if (strafeValue !== 0) {
        console.log(`[SERVER STRAFE RECEIVED] Player ${socket.data.userId}: strafe=${strafeValue}, thrust=${data.thrust}, turn=${data.turn}, boost=${data.boost || false}`);
      }
      combatSystem.applyControl(data.combatId, socket.data.userId, data.thrust, data.turn, data.boost || false, strafeValue);
    });

    /**
     * Боевые действия
     */
    socket.on(SocketEvent.COMBAT_ACTION, (data: {
      combatId: string;
      action: 'thrust' | 'turn' | 'fire';
      value?: number;
      weaponId?: string;
    }) => {
      const combatSystem = gameWorld.getCombatSystem();
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) return;

      if (data.action === 'thrust' || data.action === 'turn') {
        const thrust = data.action === 'thrust' ? (data.value || 0) : 0;
        const turn = data.action === 'turn' ? (data.value || 0) : 0;
        combatSystem.applyControl(data.combatId, socket.data.userId, thrust, turn, false, 0);
      } else if (data.action === 'fire' && data.weaponId) {
        const weapon = getEffectiveShip(player).weapons.find(w => w.id === data.weaponId);
        if (weapon) {
          combatSystem.fireWeapon(data.combatId, socket.data.userId, data.weaponId, weapon);
        }
      }
    });

    /**
     * Начать майнинг (пояс астероидов в стиле Asteroids)
     */
    socket.on(SocketEvent.MINING_START, (data: { hexKey: string }) => {
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) {
        socket.emit(SocketEvent.MINING_ERROR, { message: 'Игрок не найден' });
        return;
      }
      const posKey = hexKey(player.position);
      if (posKey !== data.hexKey) {
        socket.emit(SocketEvent.MINING_ERROR, { message: 'Вы должны находиться в этом гексе' });
        return;
      }
      const map = gameWorld.getState().map;
      const cells = map?.cells as Map<string, any> | undefined;
      const cell = cells?.get?.(data.hexKey);
      const hasPlanetary = cell?.systemType === 'planetary';
      if (!hasPlanetary) {
        socket.emit(SocketEvent.MINING_ERROR, { message: 'В этом гексе нет пояса астероидов' });
        return;
      }
      const miningSystem = gameWorld.getMiningSystem();
      const result = miningSystem.startMining(player, data.hexKey);
      if ('error' in result) {
        socket.emit(SocketEvent.MINING_ERROR, { message: result.error });
        return;
      }
      socket.join(`mining:${result.state.sessionId}`);
      socket.emit(SocketEvent.MINING_STARTED, { state: result.state });
    });

    /**
     * Управление кораблём в майнинге
     */
    socket.on('mining:control', (data: { thrust: number; turn: number; fire: boolean; strafe?: number }) => {
      const miningSystem = gameWorld.getMiningSystem();
      const state = miningSystem.getSessionByPlayer(socket.data.userId);
      if (state) {
        miningSystem.setControl(socket.data.userId, data.thrust, data.turn, data.fire, data.strafe ?? 0);
      }
    });

    /**
     * Выйти из майнинга
     */
    socket.on(SocketEvent.MINING_EXIT, () => {
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) return;
      const miningSystem = gameWorld.getMiningSystem();
      const state = miningSystem.getSessionByPlayer(socket.data.userId);
      const result = miningSystem.exitMining(socket.data.userId, player);
      if (result && state) {
        socket.leave(`mining:${state.sessionId}`);
        socket.emit(SocketEvent.MINING_COMPLETE, {
          collected: result.collected,
          cargoHold: StorageSystem.getShipCargo(player),
        });
      }
    });

    socket.on(SocketEvent.CARGO_DISCARD, async (data: { itemId: string; quantity: number }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.CARGO_DISCARD_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const cargo = StorageSystem.getShipCargo(player);
        const qty = Math.min(data.quantity ?? 1, cargo.items.find(s => s.itemId === data.itemId)?.quantity ?? 0);
        if (qty <= 0) {
          socket.emit(SocketEvent.CARGO_DISCARD_ERROR, { message: 'Предмет не найден в трюме' });
          return;
        }
        StorageSystem.removeFromCargo(cargo, data.itemId, qty);
        await PlayerService.savePlayer(player);
        socket.emit(SocketEvent.CARGO_DISCARD_SUCCESS, { cargoHold: cargo });
      } catch (error: any) {
        socket.emit(SocketEvent.CARGO_DISCARD_ERROR, { message: error.message || 'Ошибка выброса' });
      }
    });

    /**
     * Получить данные планетарной системы
     */
    socket.on(SocketEvent.SYSTEM_GET, async (data: { coordinates: HexCoordinates }) => {
      try {
        const system = await gameWorld.getPlanetarySystem(data.coordinates);
        
        if (!system) {
          socket.emit(SocketEvent.SYSTEM_ERROR, { 
            message: 'Планетарная система не найдена' 
          });
          return;
        }

        socket.emit(SocketEvent.SYSTEM_DATA, { system });
      } catch (error: any) {
        console.error('❌ Ошибка получения планетарной системы:', error);
        socket.emit(SocketEvent.SYSTEM_ERROR, { 
          message: error.message || 'Ошибка получения системы' 
        });
      }
    });

    /**
     * Построить структуру в планетарной системе
     */
    socket.on(SocketEvent.SYSTEM_BUILD_STRUCTURE, async (data: {
      coordinates: HexCoordinates;
      structureType: string;
      location: any;
    }) => {
      try {
        const result = await gameWorld.buildStructure(
          socket.data.userId,
          data.coordinates,
          data.structureType,
          data.location
        );

        if (result.success) {
          // Отправить обновленную систему
          const system = await gameWorld.getPlanetarySystem(data.coordinates);
          const player = gameWorld.getPlayer(socket.data.userId);
          socket.emit(SocketEvent.SYSTEM_BUILD_SUCCESS, { 
            structure: result.structure,
            system,
            playerCredits: player?.credits,
          });

          // Уведомить всех об обновлении системы
          io.emit(SocketEvent.GAME_UPDATE, {
            type: 'system_structure_built',
            coordinates: data.coordinates,
            playerId: socket.data.userId,
          });
        } else {
          socket.emit(SocketEvent.SYSTEM_BUILD_ERROR, { 
            message: result.error || 'Ошибка постройки структуры' 
          });
        }
      } catch (error: any) {
        console.error('❌ Ошибка постройки структуры:', error);
        socket.emit(SocketEvent.SYSTEM_BUILD_ERROR, { 
          message: error.message || 'Ошибка постройки структуры' 
        });
      }
    });

    /**
     * Собрать ресурсы со структуры
     */
    socket.on(SocketEvent.SYSTEM_COLLECT_RESOURCES, async (data: {
      coordinates: HexCoordinates;
      structureId: string;
    }) => {
      try {
        const result = await gameWorld.collectResources(
          socket.data.userId,
          data.coordinates,
          data.structureId
        );

        if (result.success) {
          const player = gameWorld.getPlayer(socket.data.userId);
          socket.emit(SocketEvent.SYSTEM_COLLECT_SUCCESS, {
            resources: result.resources,
            structure: result.structure,
            playerCredits: player?.credits,
          });

          // Отправить обновленную систему
          const system = await gameWorld.getPlanetarySystem(data.coordinates);
          if (system) {
            socket.emit(SocketEvent.SYSTEM_DATA, { system });
          }
        } else {
          socket.emit(SocketEvent.SYSTEM_COLLECT_ERROR, { 
            message: result.error || 'Ошибка сбора ресурсов' 
          });
        }
      } catch (error: any) {
        console.error('❌ Ошибка сбора ресурсов:', error);
        socket.emit(SocketEvent.SYSTEM_COLLECT_ERROR, { 
          message: error.message || 'Ошибка сбора ресурсов' 
        });
      }
    });

    /**
     * Навыки: запрос актуального состояния
     */
    socket.on(SocketEvent.SKILLS_GET, () => {
      const skills = gameWorld.getPlayerSkills(socket.data.userId);
      socket.emit(SocketEvent.SKILLS_DATA, { skills: skills ?? null });
    });

    /**
     * Навыки: установить очередь обучения
     */
    socket.on(SocketEvent.SKILLS_QUEUE_SET, async (data: { queue: { skillId: string; targetLevel: number }[] }) => {
      const player = gameWorld.getPlayer(socket.data.userId);
      if (!player) {
        socket.emit(SocketEvent.SKILLS_ERROR, { message: 'Игрок не найден' });
        return;
      }

      const queue = (data?.queue ?? []).map((item: any) => ({
        skillId: String(item.skillId),
        targetLevel: Number(item.targetLevel),
        startTime: 0,
      }));
      const result = gameWorld.setPlayerSkillQueue(socket.data.userId, queue);

      if (result.error) {
        socket.emit(SocketEvent.SKILLS_ERROR, { message: result.error });
      } else {
        const updatedPlayer = gameWorld.getPlayer(socket.data.userId);
        if (updatedPlayer) {
          const saved = await PlayerService.savePlayer(updatedPlayer);
          if (!saved) console.error(`[SKILLS] Не удалось сохранить userId=${socket.data.userId}`);
        }
        socket.emit(SocketEvent.SKILLS_DATA, { skills: result.skills });
      }
    });

    /**
     * Станция: открыть интерфейс станции
     */
    socket.on(SocketEvent.STATION_OPEN, async (data: { stationId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_DATA, { error: 'Игрок не найден' });
          return;
        }

        // Найти структуру станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (!system) {
          socket.emit(SocketEvent.STATION_DATA, { error: 'Система не найдена' });
          return;
        }

        const structure = system.structures.find(s => s.id === data.stationId);
        if (!structure || structure.type !== StructureType.SPACE_STATION) {
          socket.emit(SocketEvent.STATION_DATA, { error: 'Станция не найдена' });
          return;
        }

        // Убедиться что хранилище существует
        if (!structure.storage) {
          structure.storage = await StationStorageService.ensureStorage(structure.id);
          // Сохранить систему с обновленным хранилищем
          await PlanetarySystemService.save(system);
        }

        // Убедиться что marketOrders существует
        if (!structure.marketOrders) {
          structure.marketOrders = [];
          await PlanetarySystemService.save(system);
        }

        // Получить активные задачи крафта для этой станции
        const craftingJobs = CraftingSystem.getPlayerCraftingJobs(socket.data.userId, data.stationId);

        const stationQuests = await QuestService.getByStation(data.stationId, 'active');

        socket.emit(SocketEvent.STATION_DATA, {
          station: structure,
          cargoHold: StorageSystem.getShipCargo(player),
          craftingJobs,
          quests: stationQuests,
        });
      } catch (error: any) {
        console.error('Ошибка открытия станции:', error);
        socket.emit(SocketEvent.STATION_DATA, { error: error.message || 'Ошибка открытия станции' });
      }
    });

    /**
     * Станция: получить хранилище
     */
    socket.on(SocketEvent.STATION_STORAGE_GET, async (data: { stationId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_STORAGE_DATA, { error: 'Игрок не найден' });
          return;
        }

        // Убедиться что хранилище существует (создать если нет)
        const storage = await StationStorageService.ensureStorage(data.stationId);
        
        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        socket.emit(SocketEvent.STATION_STORAGE_DATA, {
          storage,
          cargoHold: StorageSystem.getShipCargo(player),
        });
      } catch (error: any) {
        console.error('Ошибка получения хранилища:', error);
        socket.emit(SocketEvent.STATION_STORAGE_DATA, { error: error.message || 'Ошибка получения хранилища' });
      }
    });

    /**
     * Станция: перенести грузы
     */
    socket.on(SocketEvent.STATION_CARGO_TRANSFER, async (data: { stationId: string; transfers: CargoTransfer[] }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_CARGO_TRANSFER_ERROR, { message: 'Игрок не найден' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);
        
        // Выполнить переносы
        const toStation = data.transfers.filter(t => t.direction === 'to_station');
        const fromStation = data.transfers.filter(t => t.direction === 'from_station');

        if (toStation.length > 0) {
          const result = StorageSystem.transferToStation(player, storage, toStation);
          if (!result.success) {
            socket.emit(SocketEvent.STATION_CARGO_TRANSFER_ERROR, { message: result.error });
            return;
          }
        }

        if (fromStation.length > 0) {
          const result = StorageSystem.transferFromStation(player, storage, fromStation);
          if (!result.success) {
            socket.emit(SocketEvent.STATION_CARGO_TRANSFER_ERROR, { message: result.error });
            return;
          }
        }

        // Сохранить изменения
        await StationStorageService.saveStorage(storage);
        await PlayerService.savePlayer(player);

        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        socket.emit(SocketEvent.STATION_CARGO_TRANSFER_SUCCESS, {
          storage,
          cargoHold: StorageSystem.getShipCargo(player),
        });

        if (toStation.length > 0) {
          await gameWorld.updateQuestProgressOnDeliver(socket.data.userId, data.stationId, toStation);
        }
      } catch (error: any) {
        console.error('Ошибка переноса грузов:', error);
        socket.emit(SocketEvent.STATION_CARGO_TRANSFER_ERROR, { message: error.message || 'Ошибка переноса грузов' });
      }
    });

    /**
     * Станция: пополнить кошелёк (кредиты игрока → станция)
     */
    socket.on(SocketEvent.STATION_WALLET_DEPOSIT, async (data: { stationId: string; amount: number }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId && s.type === StructureType.SPACE_STATION);
        if (!structure || structure.ownerId !== player.id) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Вы не владелец станции' });
          return;
        }
        const amount = Math.floor(Number(data.amount) || 0);
        if (amount <= 0) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Некорректная сумма' });
          return;
        }
        if (player.credits < amount) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Недостаточно кредитов' });
          return;
        }
        const storage = await StationStorageService.ensureStorage(data.stationId);
        storage.walletCredits = (storage.walletCredits ?? 0) + amount;
        player.credits -= amount;
        await StationStorageService.saveStorage(storage);
        await PlayerService.savePlayer(player);
        if (structure.storage) structure.storage = storage;
        socket.emit(SocketEvent.STATION_WALLET_SUCCESS, { storage, playerCredits: player.credits });
      } catch (error: any) {
        socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: error.message || 'Ошибка' });
      }
    });

    /**
     * Станция: снять с кошелька (станция → кредиты игрока)
     */
    socket.on(SocketEvent.STATION_WALLET_WITHDRAW, async (data: { stationId: string; amount: number }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId && s.type === StructureType.SPACE_STATION);
        if (!structure || structure.ownerId !== player.id) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Вы не владелец станции' });
          return;
        }
        const amount = Math.floor(Number(data.amount) || 0);
        if (amount <= 0) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Некорректная сумма' });
          return;
        }
        const storage = await StationStorageService.ensureStorage(data.stationId);
        const balance = storage.walletCredits ?? 0;
        if (balance < amount) {
          socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: 'Недостаточно средств на кошельке станции' });
          return;
        }
        storage.walletCredits = balance - amount;
        player.credits += amount;
        await StationStorageService.saveStorage(storage);
        await PlayerService.savePlayer(player);
        if (structure.storage) structure.storage = storage;
        socket.emit(SocketEvent.STATION_WALLET_SUCCESS, { storage, playerCredits: player.credits });
      } catch (error: any) {
        socket.emit(SocketEvent.STATION_WALLET_ERROR, { message: error.message || 'Ошибка' });
      }
    });

    socket.on(SocketEvent.QUEST_LIST_GET, async () => {
      try {
        const quests = await QuestService.getAllActive();
        socket.emit(SocketEvent.QUEST_LIST_DATA, { quests });
      } catch (error: any) {
        socket.emit(SocketEvent.QUEST_LIST_DATA, { quests: [], error: error.message });
      }
    });

    socket.on(SocketEvent.QUEST_CREATE, async (data: { stationId: string; questType: string; target: any; rewardCredits: number }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.QUEST_CREATE_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId && s.type === StructureType.SPACE_STATION);
        if (!structure || structure.ownerId !== player.id) {
          socket.emit(SocketEvent.QUEST_CREATE_ERROR, { message: 'Вы не владелец станции' });
          return;
        }
        const storage = await StationStorageService.ensureStorage(data.stationId);
        const balance = storage.walletCredits ?? 0;
        if (balance < data.rewardCredits) {
          socket.emit(SocketEvent.QUEST_CREATE_ERROR, { message: 'Недостаточно средств на кошельке станции' });
          return;
        }
        storage.walletCredits = balance - data.rewardCredits;
        const hexKeyStr = hexKey(player.position);
        const quest = await QuestService.create(
          data.stationId,
          hexKeyStr,
          player.id,
          data.questType as QuestType,
          data.target,
          data.rewardCredits
        );
        if (!quest) {
          storage.walletCredits = balance;
          socket.emit(SocketEvent.QUEST_CREATE_ERROR, { message: 'Ошибка создания квеста' });
          return;
        }
        await StationStorageService.saveStorage(storage);
        if (structure.storage) structure.storage = storage;
        const quests = await QuestService.getByStation(data.stationId, 'active');
        socket.emit(SocketEvent.QUEST_CREATE_SUCCESS, { quest, quests, storage });
      } catch (error: any) {
        socket.emit(SocketEvent.QUEST_CREATE_ERROR, { message: error.message || 'Ошибка' });
      }
    });

    socket.on(SocketEvent.QUEST_TAKE, async (data: { questId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.QUEST_TAKE_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const quest = await QuestService.getById(data.questId);
        if (!quest || quest.status !== 'active') {
          socket.emit(SocketEvent.QUEST_TAKE_ERROR, { message: 'Квест недоступен' });
          return;
        }
        const activeQuests = player.activeQuests || [];
        if (activeQuests.some(aq => aq.questId === data.questId)) {
          socket.emit(SocketEvent.QUEST_TAKE_ERROR, { message: 'Вы уже взяли этот квест' });
          return;
        }
        activeQuests.push({ questId: data.questId, progress: 0, kills: 0, delivered: 0 });
        player.activeQuests = activeQuests;
        await PlayerService.savePlayer(player);
        socket.emit(SocketEvent.QUEST_TAKE_SUCCESS, { quest, activeQuests });
      } catch (error: any) {
        socket.emit(SocketEvent.QUEST_TAKE_ERROR, { message: error.message || 'Ошибка' });
      }
    });

    socket.on(SocketEvent.QUEST_TURN_IN, async (data: { questId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: 'Игрок не найден' });
          return;
        }
        const aq = player.activeQuests?.find(q => q.questId === data.questId);
        if (!aq) {
          socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: 'Квест не найден' });
          return;
        }
        const quest = await QuestService.getById(data.questId);
        if (!quest || quest.status !== 'active') {
          socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: 'Квест недоступен' });
          return;
        }
        const target = quest.target;
        const complete = quest.questType === QuestType.KILL_ENEMIES
          ? (aq.kills ?? 0) >= (target.killCount ?? 0)
          : (aq.delivered ?? 0) >= (target.deliverQuantity ?? 0);
        if (!complete) {
          socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: 'Квест не выполнен' });
          return;
        }
        const storage = await StationStorageService.ensureStorage(quest.stationId);
        const balance = storage.walletCredits ?? 0;
        if (balance < quest.rewardCredits) {
          socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: 'Недостаточно средств на кошельке станции' });
          return;
        }
        storage.walletCredits = balance - quest.rewardCredits;
        player.credits += quest.rewardCredits;
        player.activeQuests = player.activeQuests?.filter(q => q.questId !== data.questId) || [];
        await QuestService.setStatus(data.questId, 'completed');
        await StationStorageService.saveStorage(storage);
        await PlayerService.savePlayer(player);
        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === quest.stationId && s.type === StructureType.SPACE_STATION);
        if (structure?.storage) structure.storage = storage;
        socket.emit(SocketEvent.QUEST_TURN_IN_SUCCESS, { quest, playerCredits: player.credits, activeQuests: player.activeQuests, storage });
      } catch (error: any) {
        socket.emit(SocketEvent.QUEST_TURN_IN_ERROR, { message: error.message || 'Ошибка' });
      }
    });

    /**
     * Станция: сохранить корабль в ангар
     */
    socket.on(SocketEvent.STATION_SHIP_STORE, async (data: { stationId: string; shipId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_SHIP_STORE_ERROR, { message: 'Игрок не найден' });
          return;
        }

        // Найти корабль (пока только текущий корабль игрока)
        if (player.ship.id !== data.shipId) {
          socket.emit(SocketEvent.STATION_SHIP_STORE_ERROR, { message: 'Корабль не найден' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);
        const result = StorageSystem.storeShip(player, storage, player.ship);

        if (!result.success) {
          socket.emit(SocketEvent.STATION_SHIP_STORE_ERROR, { message: result.error });
          return;
        }

        await StationStorageService.saveStorage(storage);
        
        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        socket.emit(SocketEvent.STATION_SHIP_STORE_SUCCESS, { storage });
      } catch (error: any) {
        console.error('Ошибка сохранения корабля:', error);
        socket.emit(SocketEvent.STATION_SHIP_STORE_ERROR, { message: error.message || 'Ошибка сохранения корабля' });
      }
    });

    /**
     * Станция: извлечь корабль из ангара
     */
    socket.on(SocketEvent.STATION_SHIP_RETRIEVE, async (data: { stationId: string; shipId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_SHIP_RETRIEVE_ERROR, { message: 'Игрок не найден' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);

        const result = StorageSystem.retrieveShip(storage, data.shipId);
        if (!result.success || !result.ship) {
          socket.emit(SocketEvent.STATION_SHIP_RETRIEVE_ERROR, { message: result.error });
          return;
        }

        await StationStorageService.saveStorage(storage);
        
        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        socket.emit(SocketEvent.STATION_SHIP_RETRIEVE_SUCCESS, {
          ship: result.ship,
          storage,
        });
      } catch (error: any) {
        console.error('Ошибка извлечения корабля:', error);
        socket.emit(SocketEvent.STATION_SHIP_RETRIEVE_ERROR, { message: error.message || 'Ошибка извлечения корабля' });
      }
    });

    /**
     * Станция: получить рецепты крафта
     */
    socket.on(SocketEvent.STATION_CRAFT_RECIPES_GET, async (data: { stationId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_CRAFT_RECIPES_DATA, { error: 'Игрок не найден' });
          return;
        }

        // Найти структуру станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId);
        const stationType = structure?.type;

        const recipes = Object.values(RECIPE_REGISTRY).filter(recipe => {
          if (!recipe.stationType || recipe.stationType.length === 0) return true;
          return stationType && recipe.stationType.includes(stationType);
        });

        socket.emit(SocketEvent.STATION_CRAFT_RECIPES_DATA, { recipes });
      } catch (error: any) {
        console.error('Ошибка получения рецептов:', error);
        socket.emit(SocketEvent.STATION_CRAFT_RECIPES_DATA, { error: error.message || 'Ошибка получения рецептов' });
      }
    });

    /**
     * Станция: начать крафт
     */
    socket.on(SocketEvent.STATION_CRAFT_START, async (data: { stationId: string; recipeId: string; quantity: number }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_CRAFT_START_ERROR, { message: 'Игрок не найден' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);
        
        // Проверить возможность крафта
        const canCraft = CraftingSystem.canCraft(player, data.recipeId, storage, data.quantity);
        if (!canCraft.canCraft) {
          socket.emit(SocketEvent.STATION_CRAFT_START_ERROR, { message: canCraft.error });
          return;
        }

        // Начать крафт
        const result = CraftingSystem.startCrafting(
          socket.data.userId,
          data.recipeId,
          data.stationId,
          storage,
          data.quantity
        );

        if (!result.success) {
          socket.emit(SocketEvent.STATION_CRAFT_START_ERROR, { message: result.error });
          return;
        }

        await StationStorageService.saveStorage(storage);
        
        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        // Получить созданную задачу крафта
        let job = null;
        if (result.jobId) {
          job = CraftingSystem.getCraftingProgress(result.jobId);
          // Отправить начальное обновление прогресса
          if (job) {
            socket.emit(SocketEvent.STATION_CRAFT_PROGRESS, {
              jobId: job.id,
              stationId: job.stationId,
              progress: job.progress,
            });
          }
        }
        
        socket.emit(SocketEvent.STATION_CRAFT_START_SUCCESS, {
          jobId: result.jobId,
          job: job,
          storage,
        });
      } catch (error: any) {
        console.error('Ошибка начала крафта:', error);
        socket.emit(SocketEvent.STATION_CRAFT_START_ERROR, { message: error.message || 'Ошибка начала крафта' });
      }
    });

    /**
     * Станция: отменить крафт
     */
    socket.on(SocketEvent.STATION_CRAFT_CANCEL, async (data: { stationId: string; jobId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_CRAFT_CANCEL_SUCCESS, { error: 'Игрок не найден' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);

        const result = CraftingSystem.cancelCrafting(data.jobId, storage);
        if (!result.success) {
          socket.emit(SocketEvent.STATION_CRAFT_CANCEL_SUCCESS, { error: result.error });
          return;
        }

        await StationStorageService.saveStorage(storage);
        
        // Обновить хранилище в структуре станции
        const system = await gameWorld.getPlanetarySystem(player.position);
        if (system) {
          const structure = system.structures.find(s => s.id === data.stationId);
          if (structure && structure.type === StructureType.SPACE_STATION) {
            structure.storage = storage;
            await PlanetarySystemService.save(system);
          }
        }

        socket.emit(SocketEvent.STATION_CRAFT_CANCEL_SUCCESS, { storage });
      } catch (error: any) {
        console.error('Ошибка отмены крафта:', error);
        socket.emit(SocketEvent.STATION_CRAFT_CANCEL_SUCCESS, { error: error.message || 'Ошибка отмены крафта' });
      }
    });

    /**
     * Станция: получить торговые ордера
     */
    socket.on(SocketEvent.STATION_MARKET_ORDERS_GET, async (data: { stationId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_MARKET_ORDERS_DATA, { error: 'Игрок не найден' });
          return;
        }

        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId);
        
        if (!structure || !structure.marketOrders) {
          socket.emit(SocketEvent.STATION_MARKET_ORDERS_DATA, { orders: [] });
          return;
        }

        MarketSystem.checkExpiredOrders(structure.marketOrders);
        const activeOrders = MarketSystem.getActiveOrders(data.stationId, structure.marketOrders);

        socket.emit(SocketEvent.STATION_MARKET_ORDERS_DATA, { orders: activeOrders });
      } catch (error: any) {
        console.error('Ошибка получения ордеров:', error);
        socket.emit(SocketEvent.STATION_MARKET_ORDERS_DATA, { error: error.message || 'Ошибка получения ордеров' });
      }
    });

    /**
     * Станция: создать торговый ордер
     */
    socket.on(SocketEvent.STATION_MARKET_ORDER_CREATE, async (data: {
      stationId: string;
      type: OrderType;
      itemId: string;
      price: number;
      quantity: number;
      expiresAt?: number;
    }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, { message: 'Игрок не найден' });
          return;
        }

        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId);
        
        if (!structure) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, { message: 'Станция не найдена' });
          return;
        }

        if (!structure.marketOrders) {
          structure.marketOrders = [];
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);

        // Для ордеров на продажу проверить наличие предметов
        if (data.type === OrderType.SELL) {
          const stack = storage.items.find(s => s.itemId === data.itemId);
          if (!stack || stack.quantity < data.quantity) {
            socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, {
              message: `Недостаточно предметов на станции: требуется ${data.quantity}, есть ${stack?.quantity ?? 0}`,
            });
            return;
          }
        }

        const result = MarketSystem.createOrder(
          socket.data.userId,
          data.stationId,
          data.type,
          data.itemId,
          data.price,
          data.quantity,
          data.expiresAt
        );

        if (!result.success || !result.order) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, { message: result.error });
          return;
        }

        structure.marketOrders.push(result.order);
        
        // Обновить хранилище в структуре станции
        if (structure.type === StructureType.SPACE_STATION) {
          structure.storage = storage;
        }
        
        await PlanetarySystemService.save(system!);
        await StationStorageService.saveStorage(storage);

        socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_SUCCESS, { order: result.order });
      } catch (error: any) {
        console.error('Ошибка создания ордера:', error);
        socket.emit(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, { message: error.message || 'Ошибка создания ордера' });
      }
    });

    /**
     * Станция: отменить торговый ордер
     */
    socket.on(SocketEvent.STATION_MARKET_ORDER_CANCEL, async (data: { stationId: string; orderId: string }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, { error: 'Игрок не найден' });
          return;
        }

        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId);
        
        if (!structure || !structure.marketOrders) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, { error: 'Станция не найдена' });
          return;
        }

        const result = MarketSystem.cancelOrder(data.orderId, socket.data.userId, structure.marketOrders);
        if (!result.success) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, { error: result.error });
          return;
        }

        await PlanetarySystemService.save(system!);
        socket.emit(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, {});
      } catch (error: any) {
        console.error('Ошибка отмены ордера:', error);
        socket.emit(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, { error: error.message || 'Ошибка отмены ордера' });
      }
    });

    /**
     * Станция: выполнить торговый ордер
     */
    socket.on(SocketEvent.STATION_MARKET_ORDER_EXECUTE, async (data: {
      stationId: string;
      orderId: string;
      quantity: number;
    }) => {
      try {
        const player = gameWorld.getPlayer(socket.data.userId);
        if (!player) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE_ERROR, { message: 'Игрок не найден' });
          return;
        }

        const system = await gameWorld.getPlanetarySystem(player.position);
        const structure = system?.structures.find(s => s.id === data.stationId);
        
        if (!structure || !structure.marketOrders) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE_ERROR, { message: 'Станция не найдена' });
          return;
        }

        const storage = await StationStorageService.ensureStorage(data.stationId);
        const result = MarketSystem.executeOrder(
          socket.data.userId,
          data.orderId,
          data.quantity,
          player,
          storage,
          structure.marketOrders
        );

        if (!result.success) {
          socket.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE_ERROR, { message: result.error });
          return;
        }

        // Обновить хранилище в структуре станции
        if (structure.type === StructureType.SPACE_STATION) {
          structure.storage = storage;
        }
        
        await PlanetarySystemService.save(system!);
        await StationStorageService.saveStorage(storage);
        await PlayerService.savePlayer(player);

        socket.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE_SUCCESS, {
          order: structure.marketOrders.find(o => o.id === data.orderId),
          playerCredits: player.credits,
        });
      } catch (error: any) {
        console.error('Ошибка выполнения ордера:', error);
        socket.emit(SocketEvent.STATION_MARKET_ORDER_EXECUTE_ERROR, { message: error.message || 'Ошибка выполнения ордера' });
      }
    });

    /**
     * Отключение
     */
    socket.on('disconnect', async () => {
      const userId = socket.data.userId;
      const player = gameWorld.getPlayer(userId);
      if (player) {
        await PlayerService.savePlayer(player);
      }
      
      gameWorld.removePlayer(socket.data.userId);

      // Уведомить всех об отключении
      io.emit(SocketEvent.PLAYER_LEAVE, { playerId: socket.data.userId });
    });
  });

  // Обновление таймеров происходит внутри GameWorld каждые 100ms
  // Клиенты получают обновления только при движении игроков
}

/**
 * Сериализация состояния игры для отправки клиенту
 */
function serializeGameState(state: any) {
  const invasions = gameWorld.getInvasionSystem().getAllActive();
  return {
    id: state.id,
    phase: state.phase,
    map: {
      radius: state.map.radius,
      cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({
        key,
        ...cell,
      })),
    },
    players: Array.from(state.players.entries() as IterableIterator<[any, any]>).map(([key, player]) =>
      serializePlayer(player)
    ),
    invasions: invasions.map(i => ({
      id: i.id,
      sourceHexKey: i.sourceHexKey,
      neighborHexKeys: i.neighborHexKeys,
      enemyCountPerHex: i.enemyCountPerHex,
    })),
  };
}

/**
 * Сериализация игрока
 */
function serializePlayer(player: any) {
  const ship = getEffectiveShip(player);
  return {
    id: player.id,
    username: player.username,
    position: player.position,
    ship,
    resources: player.resources,
    credits: player.credits ?? 1000,
    activeQuests: player.activeQuests ?? [],
    experience: player.experience,
    level: player.level,
    online: player.online,
    moveTimer: player.moveTimer,
    canMove: player.canMove,
    skills: player.skills ?? null,
  };
}

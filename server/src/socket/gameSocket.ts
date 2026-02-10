import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { gameWorld } from '../game/GameWorld.js';
import { SocketEvent, HexCoordinates } from '@hexploration/shared';
import { PlayerService } from '../database/services/PlayerService.js';

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
    console.log(`✅ Игрок подключился: ${socket.data.username} (${socket.data.userId})`);

    // Добавить игрока в игру
    const player = await gameWorld.addPlayer(socket.data.userId, socket.data.username);

    // Отправить успешную аутентификацию
    socket.emit(SocketEvent.AUTH_SUCCESS, { player });

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
    socket.on(SocketEvent.MOVE, (data: { target: HexCoordinates }) => {
      const success = gameWorld.movePlayer(socket.data.userId, data.target);

      if (success) {
        const player = gameWorld.getPlayer(socket.data.userId);
        socket.emit(SocketEvent.MOVE_SUCCESS, { 
          position: player?.position,
          moveTimer: player?.moveTimer,
          canMove: player?.canMove,
        });

        // Уведомить всех об обновлении
        io.emit(SocketEvent.GAME_UPDATE, {
          type: 'player_moved',
          playerId: socket.data.userId,
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

      // Начать бой
      const combatSystem = gameWorld.getCombatSystem();
      const combat = combatSystem.startCombat([attacker, target]);

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

      // Начать бой с ботом
      const combatSystem = gameWorld.getCombatSystem();
      const combat = combatSystem.startCombatWithBot(player);

      // Уведомить игрока
      socket.emit('combat:started', { combat });
      
      console.log(`🤖 Бой с ботом начат: ${combat.id}`);

      // Обновлять бой каждые 16ms (~60 FPS)
      const updateInterval = setInterval(() => {
        const updatedCombat = combatSystem.updateCombat(combat.id, 0.016);
        
        if (!updatedCombat) {
          clearInterval(updateInterval);
          return;
        }

        // Отправить обновление игроку
        socket.emit('combat:update', { combat: updatedCombat });

        // Проверить окончание боя
        const aliveShips = updatedCombat.ships.filter(s => s.health > 0);
        const allShipsDead = aliveShips.length <= 1;
        if (allShipsDead || Date.now() - updatedCombat.startTime > updatedCombat.duration) {
          const winner = aliveShips.find(s => s.playerId === player.id) 
            ? player.id 
            : 'bot';
          
          socket.emit('combat:ended', { winner, combat: updatedCombat });

          combatSystem.endCombat(combat.id);
          clearInterval(updateInterval);
          console.log(`🤖 Бой с ботом завершен: ${combat.id}, победитель: ${winner}`);
        }
      }, 16);
    });

    /**
     * Управление кораблем в бою
     */
    socket.on('combat:control', (data: {
      combatId: string;
      thrust: number;
      turn: number;
      boost?: boolean;
    }) => {
      const combatSystem = gameWorld.getCombatSystem();
      combatSystem.applyControl(data.combatId, socket.data.userId, data.thrust, data.turn, data.boost || false);
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
        combatSystem.applyControl(data.combatId, socket.data.userId, thrust, turn);
      } else if (data.action === 'fire' && data.weaponId) {
        const weapon = player.ship.weapons.find(w => w.id === data.weaponId);
        if (weapon) {
          combatSystem.fireWeapon(data.combatId, socket.data.userId, data.weaponId, weapon);
        }
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
          socket.emit(SocketEvent.SYSTEM_BUILD_SUCCESS, { 
            structure: result.structure,
            system,
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
          socket.emit(SocketEvent.SYSTEM_COLLECT_SUCCESS, {
            resources: result.resources,
            structure: result.structure,
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
     * Отключение
     */
    socket.on('disconnect', async () => {
      console.log(`❌ Игрок отключился: ${socket.data.username}`);
      
      // Сохранить игрока перед удалением
      const player = gameWorld.getPlayer(socket.data.userId);
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
  };
}

/**
 * Сериализация игрока
 */
function serializePlayer(player: any) {
  return {
    id: player.id,
    username: player.username,
    position: player.position,
    ship: player.ship,
    resources: player.resources,
    experience: player.experience,
    level: player.level,
    online: player.online,
    moveTimer: player.moveTimer,
    canMove: player.canMove,
  };
}

import {
  GameState,
  GamePhase,
  Player,
  Ship,
  ShipType,
  HexCoordinates,
  SocketEvent,
} from '@hexploration/shared';
import {
  StructureType,
  StructureLocation,
  SpaceStructure,
  ResourceAmount,
  ResourceType,
} from '@hexploration/shared';
import { 
  MAP_RADIUS, 
  SHIP_STATS, 
  MOVE_COOLDOWN, 
  hexDistance,
  hexKey,
  DEFAULT_WEAPONS,
  STRUCTURE_COSTS,
  STRUCTURE_BUILD_TIMES,
  STRUCTURE_HEALTH,
  STRUCTURE_CAPACITY,
  EXTRACTION_RATES,
} from '@hexploration/shared';
import { HexMapManager } from './HexMap.js';
import { CombatSystem } from './CombatSystem.js';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { GameWorldService } from '../database/services/GameWorldService.js';
import { PlayerService } from '../database/services/PlayerService.js';
import { PlanetarySystemService } from '../database/services/PlanetarySystemService.js';
import { recalcPlayerSkills, setSkillQueue as setSkillQueueImpl, createEmptySkills } from './SkillSystem.js';
import { CraftingSystem } from './CraftingSystem.js';
import { StationStorageService } from '../database/services/StationStorageService.js';
import { StorageSystem } from './StorageSystem.js';
import type { PlayerSkills } from '@hexploration/shared';
import type { SkillQueueItem } from '@hexploration/shared';

class GameWorld {
  private state: GameState;
  private hexMap: HexMapManager;
  private combatSystem: CombatSystem;
  private timerInterval: NodeJS.Timeout | null = null;
  private io: Server | null = null;
  private saveInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor() {
    this.hexMap = new HexMapManager(MAP_RADIUS);
    this.combatSystem = new CombatSystem();

    this.state = {
      id: uuidv4(),
      map: this.hexMap.getMap(),
      players: new Map(),
      phase: GamePhase.LOBBY,
    };
  }

  /**
   * Инициализировать мир (загрузить из БД или создать новый)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🌍 Инициализация мира...');

    // Загрузить мир из БД
    const savedWorld = await GameWorldService.loadWorld();
    
    if (savedWorld) {
      // Восстановить мир из БД
      this.state.phase = savedWorld.phase;
      this.hexMap = new HexMapManager(savedWorld.map.radius, savedWorld.map);
      this.state.map = this.hexMap.getMap();
      console.log('✅ Мир восстановлен из БД');
      
      // Убедиться что все планетарные системы сгенерированы (на случай если карта старая)
      await this.hexMap.generateAllPlanetarySystems();
    } else {
      console.log('✅ Создан новый мир');
      // Генерировать планетарные системы для нового мира
      await this.hexMap.generateAllPlanetarySystems();
    }

    this.startTimerUpdates();
    this.startAutoSave();
    this.initialized = true;
  }

  /**
   * Запустить автосохранение каждые 30 секунд
   */
  private startAutoSave(): void {
    this.saveInterval = setInterval(async () => {
      await this.saveWorld();
    }, 30000); // 30 секунд
  }

  /**
   * Сохранить состояние мира
   * Навыки уже пересчитаны в реальном времени в updatePlayerTimers, просто сохраняем текущее состояние
   */
  async saveWorld(): Promise<void> {
    await GameWorldService.saveWorld(this.state.phase, this.hexMap.getMap());
    await PlayerService.saveAllPlayers(this.state.players);
  }

  /**
   * Запустить обновление таймеров игроков
   */
  private startTimerUpdates(): void {
    this.timerInterval = setInterval(() => {
      this.updatePlayerTimers();
    }, 100); // Обновлять каждые 100ms

    // Запустить проверку деградации колоний каждые 10 секунд
    setInterval(async () => {
      const decayed = this.hexMap.checkColonyDecay();
      // Если произошла деградация, сохранить изменения и уведомить клиентов
      if (decayed) {
        console.log('💾 [DECAY] Сохранение изменений после деградации колоний...');
        await this.saveWorld();
        
        // Уведомить всех клиентов об обновлении карты
        if (this.io) {
          const state = this.getState();
          this.io.emit(SocketEvent.GAME_UPDATE, {
            type: 'colony_decayed',
            map: {
              radius: state.map.radius,
              cells: Array.from(state.map.cells.entries() as IterableIterator<[any, any]>).map(([key, cell]) => ({
                key,
                ...cell,
              })),
            },
          });
          console.log('📡 [DECAY] Отправлено обновление карты клиентам после деградации');
        }
      }
    }, 10000);
  }

  /**
   * Обновить таймеры всех игроков и пересчитать навыки в реальном времени
   */
  private updatePlayerTimers(): void {
    const now = Date.now();
    this.state.players.forEach((player) => {
      // Пересчитать навыки в реальном времени
      if (player.skills?.currentTraining) {
        player.skills = recalcPlayerSkills(player.skills, now);
      }

      if (player.moveTimer > now) {
        // Таймер еще не истек
        player.canMove = false;
      } else if (player.moveTimer > 0) {
        // Таймер истек
        console.log(`⏰ Таймер истек для ${player.username}: обнуляем moveTimer, устанавливаем canMove=true`);
        player.moveTimer = 0;
        player.canMove = true;
        
        // Отправить обновление всем клиентам
        if (this.io) {
          this.io.emit('game:update', {
            type: 'timer_expired',
            playerId: player.id,
            moveTimer: 0,
            canMove: true,
          });
        }
      }
    });

    // Обновить прогресс крафта
    this.updateCraftingProgress(now);
  }

  /**
   * Обновить прогресс крафта и отправить обновления клиентам
   */
  private async updateCraftingProgress(now: number): Promise<void> {
    if (!this.io) {
      console.warn('[Crafting] Socket.io не инициализирован, пропускаем обновление прогресса');
      return;
    }

    const results = CraftingSystem.updateCraftingProgress(now);
    
    if (results.length === 0) {
      return; // Нет активных задач крафта
    }
    
    console.log(`[Crafting] Обновление прогресса для ${results.length} задач`);
    
    for (const { job, completed } of results) {
      if (completed) {
        console.log(`[Crafting] Завершение задачи: jobId=${job.id}, playerId=${job.playerId}`);
        // Завершить крафт
        const storage = await StationStorageService.loadStorage(job.stationId);
        if (storage) {
          CraftingSystem.completeCrafting(job.id, storage);
          await StationStorageService.saveStorage(storage);

          // Отправить финальное обновление прогресса перед завершением
          console.log(`[Crafting] Отправка финального прогресса 100% для jobId=${job.id} игроку ${job.playerId}`);
          this.io.to(job.playerId).emit(SocketEvent.STATION_CRAFT_PROGRESS, {
            jobId: job.id,
            stationId: job.stationId,
            progress: 100,
          });

          // Отправить уведомление о завершении
          this.io.to(job.playerId).emit(SocketEvent.STATION_CRAFT_COMPLETE, {
            jobId: job.id,
            stationId: job.stationId,
            storage, // Отправить обновленное хранилище
          });
        }
      } else {
        // Отправить обновление прогресса для всех незавершенных задач
        // Отправляем обновления каждые 100ms (как вызывается функция)
        console.log(`[Crafting] Отправка прогресса: jobId=${job.id}, progress=${job.progress.toFixed(2)}%, playerId=${job.playerId}`);
        const socketCount = this.io.sockets.adapter.rooms.get(job.playerId)?.size || 0;
        console.log(`[Crafting] Количество сокетов в комнате ${job.playerId}: ${socketCount}`);
        
        this.io.to(job.playerId).emit(SocketEvent.STATION_CRAFT_PROGRESS, {
          jobId: job.id,
          stationId: job.stationId,
          progress: job.progress,
        });
      }
    }
  }

  /**
   * Добавить игрока в игру
   */
  async addPlayer(userId: string, username: string): Promise<Player> {
    const savedPlayer = await PlayerService.loadPlayer(userId);
    let player: Player;

    if (savedPlayer) {
      player = {
        ...savedPlayer,
        id: userId,
        name: username,
        username,
        online: true,
        moveTimer: 0,
        canMove: true,
      } as Player;
      
      // Инициализировать трюм с начальными ресурсами, если его нет или он пуст
      if (!player.ship.cargoHold || player.ship.cargoHold.items.length === 0) {
        const cargoCapacity = StorageSystem.getCargoCapacity(player.ship.type);
        player.ship.cargoHold = {
          capacity: cargoCapacity,
          items: [
            { itemId: 'iron_ore', quantity: 50 },
            { itemId: 'copper_ore', quantity: 50 },
            { itemId: 'energy_crystal', quantity: 50 },
            { itemId: 'rare_metal', quantity: 20 },
          ],
        };
      }
    } else {
      const ship: Ship = this.createDefaultShip();
      const playerCount = this.state.players.size;
      const startPosition: HexCoordinates = this.getStartPosition(playerCount);
      player = {
        id: userId,
        username,
        position: startPosition,
        ship,
        resources: 100,
        experience: 0,
        level: 1,
        online: true,
        moveTimer: 0,
        canMove: true,
        skills: createEmptySkills(),
      };
    }

    this.state.players.set(userId, player);

    // Если первый игрок, начать игру
    if (this.state.players.size === 1) {
      this.state.phase = GamePhase.EXPLORATION;
    }

    return player;
  }

  /**
   * Получить стартовую позицию для игрока
   */
  private getStartPosition(playerIndex: number): HexCoordinates {
    const positions = [
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      { q: -2, r: 0 },
      { q: 0, r: 2 },
      { q: 0, r: -2 },
      { q: 1, r: 1 },
    ];
    return positions[playerIndex % positions.length];
  }

  /**
   * Создать базовый корабль
   */
  private createDefaultShip(): Ship {
    const stats = SHIP_STATS.scout;
    // Вместимость трюма зависит от типа корабля
    const cargoCapacity = this.getCargoCapacity(ShipType.SCOUT);
    
    // Начальные ресурсы: достаточно для базовых рецептов крафта
    // RECIPE_ALLOY требует: 10 iron_ore + 3 energy_crystal
    // RECIPE_ELECTRONICS требует: 5 copper_ore + 2 energy_crystal
    // RECIPE_COMPOSITE требует: 2 alloy + 1 rare_metal + 5 energy_crystal
    const initialItems = [
      { itemId: 'iron_ore', quantity: 50 },
      { itemId: 'copper_ore', quantity: 50 },
      { itemId: 'energy_crystal', quantity: 50 },
      { itemId: 'rare_metal', quantity: 20 },
    ];
    
    return {
      id: uuidv4(),
      name: 'Разведчик',
      type: ShipType.SCOUT,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      energy: stats.maxEnergy,
      maxEnergy: stats.maxEnergy,
      speed: stats.speed,
      turnRate: stats.turnRate,
      weapons: DEFAULT_WEAPONS,
      cargoHold: {
        capacity: cargoCapacity,
        items: initialItems,
      },
    };
  }

  /**
   * Получить вместимость трюма для типа корабля
   */
  private getCargoCapacity(shipType: ShipType): number {
    const capacities: Record<ShipType, number> = {
      [ShipType.SCOUT]: 50,      // Маленький трюм
      [ShipType.FIGHTER]: 100,   // Средний трюм
      [ShipType.CRUISER]: 200,   // Большой трюм
      [ShipType.SUPPORT]: 150,   // Средний трюм
    };
    return capacities[shipType] ?? 50;
  }

  /**
   * Удалить игрока
   */
  removePlayer(userId: string): void {
    const player = this.state.players.get(userId);
    if (player) {
      this.state.players.delete(userId);
    }
  }

  /**
   * Переместить игрока
   */
  movePlayer(playerId: string, targetPosition: HexCoordinates): boolean {
    const player = this.state.players.get(playerId);
    if (!player) return false;

    // Проверить, что игрок может двигаться (таймер истек)
    const now = Date.now();
    if (!player.canMove || player.moveTimer > now) {
      const remaining = Math.max(0, player.moveTimer - now);
      console.log(`❌ Движение отклонено для ${player.username}: canMove=${player.canMove}, remaining=${remaining}ms`);
      return false;
    }
    
    console.log(`✅ Движение разрешено для ${player.username}`);

    // Проверить расстояние (только на соседние гексы)
    const distance = hexDistance(player.position, targetPosition);
    if (distance !== 1) return false;

    // Проверить, что целевой гекс существует
    const targetCell = this.hexMap.getCell(targetPosition);
    if (!targetCell) return false;

    // Переместить (несколько игроков могут быть в одном гексе)
    player.position = targetPosition;
    this.hexMap.discoverCell(targetPosition, playerId);

    // Установить таймер для следующего хода
    player.moveTimer = Date.now() + MOVE_COOLDOWN;
    player.canMove = false;
    
    console.log(`🚀 Игрок ${player.username} переместился. Новый moveTimer=${player.moveTimer}, MOVE_COOLDOWN=${MOVE_COOLDOWN}ms`);

    return true;
  }

  /**
   * Получить состояние игры
   */
  getState(): GameState {
    return {
      ...this.state,
      map: this.hexMap.getMap(),
    };
  }

  /**
   * Получить онлайн игроков
   */
  getOnlinePlayers(): Player[] {
    return Array.from(this.state.players.values()).filter(p => p.online);
  }

  /**
   * Получить игрока по ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.state.players.get(playerId);
  }

  /**
   * Получить актуальные навыки игрока (с пересчётом по реальному времени)
   */
  getPlayerSkills(playerId: string): PlayerSkills | null {
    const player = this.state.players.get(playerId);
    if (!player) return null;
    const skills = player.skills ?? createEmptySkills();
    const recalc = recalcPlayerSkills(skills, Date.now());
    player.skills = recalc;
    return recalc;
  }

  /**
   * Установить очередь обучения навыков
   */
  setPlayerSkillQueue(playerId: string, queue: SkillQueueItem[]): { skills: PlayerSkills; error?: string } {
    const player = this.state.players.get(playerId);
    if (!player) return { skills: createEmptySkills(), error: 'Игрок не найден' };
    const skills = player.skills ?? createEmptySkills();
    const now = Date.now();
    const recalc = recalcPlayerSkills(skills, now);
    const result = setSkillQueueImpl(recalc, queue, now);
    player.skills = result.skills;
    return result;
  }

  /**
   * Установить Socket.IO сервер для отправки обновлений
   */
  setIo(io: Server): void {
    this.io = io;
  }

  /**
   * Получить систему боя
   */
  getCombatSystem(): CombatSystem {
    return this.combatSystem;
  }

  /**
   * Колонизировать систему
   */
  async colonizeSystem(playerId: string, coordinates: HexCoordinates): Promise<{ success: boolean; error?: string }> {
    const player = this.state.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Проверить, что игрок в этой системе
    if (player.position.q !== coordinates.q || player.position.r !== coordinates.r) {
      return { success: false, error: 'Вы должны находиться в системе для колонизации' };
    }

    const result = this.hexMap.colonizeSystem(coordinates, playerId);
    
    if (result.success) {
      // Убедиться, что планетарная система существует
      const systemId = await this.hexMap.ensurePlanetarySystem(coordinates);
      if (!systemId) {
        return { success: false, error: 'Не удалось создать планетарную систему' };
      }

      // Загрузить систему
      const system = await this.getPlanetarySystem(coordinates);
      if (!system) {
        return { success: false, error: 'Планетарная система не найдена' };
      }

      // Проверить, нет ли уже станции игрока в системе
      const hasPlayerStation = system.structures.some(
        (s: SpaceStructure) => s.type === StructureType.SPACE_STATION && s.ownerId === playerId
      );

      if (!hasPlayerStation) {
        // Создать станцию для игрока
        const hexKeyStr = hexKey(coordinates);
        const stationId = uuidv4();
        const stationStructure: SpaceStructure = {
          id: stationId,
          type: StructureType.SPACE_STATION,
          ownerId: playerId,
          location: { type: 'orbit' as const, targetId: `star-${hexKeyStr}` },
          cost: STRUCTURE_COSTS[StructureType.SPACE_STATION],
          buildTime: STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION],
          buildProgress: 100, // Станция сразу готова при колонизации
          buildStartTime: Date.now() - STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION] * 1000,
          health: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          maxHealth: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          operational: true, // Станция сразу работает
          createdAt: Date.now(),
          storage: {
            stationId: stationId,
            items: [],
            ships: [],
            maxShipSlots: 10,
          },
          marketOrders: [],
        };

        // Добавить станцию в систему
        system.structures.push(stationStructure);

        // Создать хранилище станции в БД
        await StationStorageService.createStorage(stationId);

        // Сохранить систему
        await PlanetarySystemService.save(system);

        console.log(`🏛️ Станция создана для игрока ${player.username} в системе [${coordinates.q}, ${coordinates.r}], stationId=${stationId}`);
      }

      // Сохранить изменения карты
      await this.saveWorld();
    }

    return result;
  }

  /**
   * Развить колонию
   */
  async developColony(playerId: string, coordinates: HexCoordinates): Promise<{ success: boolean; error?: string }> {
    const player = this.state.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Проверить, что игрок в этой системе
    if (player.position.q !== coordinates.q || player.position.r !== coordinates.r) {
      return { success: false, error: 'Вы должны находиться в колонии для её развития' };
    }

    const result = this.hexMap.developColony(coordinates, playerId);

    if (result.success) {
      // Сохранить изменения
      await this.saveWorld();
    }

    return result;
  }

  /**
   * Получить HexMap Manager
   */
  getHexMap(): HexMapManager {
    return this.hexMap;
  }

  /**
   * Получить планетарную систему по координатам
   * Генерирует систему если её еще нет
   */
  async getPlanetarySystem(coordinates: HexCoordinates) {
    // Убедиться что система сгенерирована
    await this.hexMap.ensurePlanetarySystem(coordinates);
    
    const cell = this.hexMap.getCell(coordinates);
    if (!cell || !cell.planetarySystemId) {
      return null;
    }

    // Загрузить из БД
    const system = await PlanetarySystemService.loadByHexKey(cell.planetarySystemId);
    
    // Если в гексе есть NPC станция, но её нет в системе - создать
    if (system && cell.hasStation && cell.owner === 'npc') {
      const hasStation = system.structures.some(s => s.type === StructureType.SPACE_STATION);
      if (!hasStation) {
        const { v4: uuidv4 } = await import('uuid');
        const { STRUCTURE_COSTS, STRUCTURE_BUILD_TIMES, STRUCTURE_HEALTH } = await import('@hexploration/shared');
        const hexKeyStr = `${coordinates.q},${coordinates.r}`;
        
        const stationStructure = {
          id: uuidv4(),
          type: StructureType.SPACE_STATION,
          ownerId: 'npc',
          location: { type: 'orbit' as const, targetId: `star-${hexKeyStr}` },
          cost: STRUCTURE_COSTS[StructureType.SPACE_STATION],
          buildTime: STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION],
          buildProgress: 100,
          buildStartTime: Date.now() - STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION] * 1000,
          health: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          maxHealth: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          operational: true,
          createdAt: Date.now() - 86400000,
          storage: {
            stationId: '',
            items: [],
            ships: [],
            maxShipSlots: 10,
          },
          marketOrders: [],
        };
        stationStructure.storage.stationId = stationStructure.id;
        system.structures.push(stationStructure);
        await PlanetarySystemService.save(system);
      }
    }
    
    return system;
  }

  /**
   * Построить структуру в планетарной системе
   */
  async buildStructure(
    playerId: string,
    coordinates: HexCoordinates,
    structureType: string,
    location: StructureLocation
  ): Promise<{ success: boolean; error?: string; structure?: SpaceStructure }> {
    const player = this.state.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Проверить, что игрок в этой системе
    if (player.position.q !== coordinates.q || player.position.r !== coordinates.r) {
      return { success: false, error: 'Вы должны находиться в системе для постройки' };
    }

    // Загрузить систему
    const system = await this.getPlanetarySystem(coordinates);
    if (!system) {
      return { success: false, error: 'Планетарная система не найдена' };
    }

    // Проверить тип структуры
    if (!Object.values(StructureType).includes(structureType as StructureType)) {
      return { success: false, error: 'Неизвестный тип структуры' };
    }

    const type = structureType as StructureType;
    const cost = STRUCTURE_COSTS[type];
    
    // Проверить ресурсы игрока (пока только credits, потом расширим систему ресурсов)
    if (player.resources < cost.credits) {
      return { success: false, error: `Недостаточно кредитов. Требуется: ${cost.credits}, есть: ${player.resources}` };
    }
    // TODO: Проверка минералов и других ресурсов когда расширим систему

    // Создать структуру
    const structure: SpaceStructure = {
      id: uuidv4(),
      type,
      ownerId: playerId,
      location,
      cost,
      buildTime: STRUCTURE_BUILD_TIMES[type],
      buildProgress: 0,
      buildStartTime: Date.now(),
      health: STRUCTURE_HEALTH[type],
      maxHealth: STRUCTURE_HEALTH[type],
      operational: false,
      createdAt: Date.now(),
    };

    // Добавить extraction если структура добывает ресурсы
    if (EXTRACTION_RATES[type] > 0) {
      structure.extraction = {
        resource: type === StructureType.GAS_EXTRACTOR ? ResourceType.HELIUM : ResourceType.MINERALS,
        rate: EXTRACTION_RATES[type],
        efficiency: 1.0,
        maxCapacity: STRUCTURE_CAPACITY[type],
        currentAmount: 0,
      };
    }

    // Добавить хранилище и торговые ордера для станций
    if (type === StructureType.SPACE_STATION) {
      structure.storage = {
        stationId: structure.id,
        items: [],
        ships: [],
        maxShipSlots: 10, // Максимум 10 кораблей в ангаре
      };
      structure.marketOrders = [];
    }

    // Списисать ресурсы
    player.resources -= cost.credits;
    if (cost.minerals) {
      player.resources -= cost.minerals;
    }

    // Добавить структуру в систему
    system.structures.push(structure);

    // Сохранить систему
    await PlanetarySystemService.save(system);
    await this.saveWorld();

    console.log(`🏗️ Игрок ${player.username} начал постройку ${type} в системе [${coordinates.q}, ${coordinates.r}]`);

    return { success: true, structure };
  }

  /**
   * Собрать ресурсы со структуры
   */
  async collectResources(
    playerId: string,
    coordinates: HexCoordinates,
    structureId: string
  ): Promise<{ success: boolean; error?: string; resources?: ResourceAmount; structure?: SpaceStructure }> {
    const player = this.state.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Игрок не найден' };
    }

    // Проверить, что игрок в этой системе
    if (player.position.q !== coordinates.q || player.position.r !== coordinates.r) {
      return { success: false, error: 'Вы должны находиться в системе для сбора ресурсов' };
    }

    // Загрузить систему
    const system = await this.getPlanetarySystem(coordinates);
    if (!system) {
      return { success: false, error: 'Планетарная система не найдена' };
    }

    // Найти структуру
    const structure = system.structures.find(s => s.id === structureId);
    if (!structure) {
      return { success: false, error: 'Структура не найдена' };
    }

    // Проверить владельца
    if (structure.ownerId !== playerId) {
      return { success: false, error: 'Это не ваша структура' };
    }

    // Проверить что структура работает и имеет ресурсы
    if (!structure.operational || !structure.extraction) {
      return { success: false, error: 'Структура не готова к сбору ресурсов' };
    }

    if (structure.extraction.currentAmount === 0) {
      return { success: false, error: 'Нет ресурсов для сбора' };
    }

    // Собрать ресурсы
    const collectedAmount = structure.extraction.currentAmount;
    structure.extraction.currentAmount = 0;

    // Добавить ресурсы игроку (пока просто credits, потом расширим)
    player.resources += collectedAmount;

    // Сохранить систему
    await PlanetarySystemService.save(system);
    await this.saveWorld();

    console.log(`💰 Игрок ${player.username} собрал ${collectedAmount} ресурсов со структуры ${structureId}`);

    return {
      success: true,
      resources: { credits: collectedAmount },
      structure,
    };
  }
}

// Singleton
export const gameWorld = new GameWorld();

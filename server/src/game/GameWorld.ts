import {
  GameState,
  GamePhase,
  Player,
  Ship,
  ShipType,
  HexCoordinates,
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
    setInterval(() => {
      this.hexMap.checkColonyDecay();
    }, 10000);
  }

  /**
   * Обновить таймеры всех игроков
   */
  private updatePlayerTimers(): void {
    const now = Date.now();
    this.state.players.forEach((player) => {
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
  }

  /**
   * Добавить игрока в игру
   */
  async addPlayer(userId: string, username: string): Promise<Player> {
    // Попробовать загрузить данные игрока из БД
    const savedPlayer = await PlayerService.loadPlayer(userId);

    let player: Player;

    if (savedPlayer) {
      // Восстановить прогресс игрока
      player = {
        ...savedPlayer,
        id: userId,
        name: username,
        username,
        online: true,
        moveTimer: 0,
        canMove: true,
      } as Player;
      console.log(`👤 Игрок ${username} восстановлен из БД`);
    } else {
      // Создать нового игрока
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
      };
      console.log(`👤 Создан новый игрок ${username}`);
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
    };
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
      // Сохранить изменения
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
    return await PlanetarySystemService.loadByHexKey(cell.planetarySystemId);
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

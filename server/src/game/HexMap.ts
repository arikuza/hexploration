import { HexMap, HexCell, HexType, HexCoordinates, SystemType, THREAT_ZONES, StructureType } from '@hexploration/shared';
import { hexInRadius, hexKey, hexDistance, STRUCTURE_COSTS, STRUCTURE_BUILD_TIMES, STRUCTURE_HEALTH } from '@hexploration/shared';
import { PlanetarySystemGenerator } from './PlanetarySystemGenerator.js';
import { PlanetarySystemService } from '../database/services/PlanetarySystemService.js';
import { v4 as uuidv4 } from 'uuid';

export class HexMapManager {
  private map: HexMap;

  constructor(radius: number, existingMap?: HexMap) {
    if (existingMap) {
      // Восстановить карту из БД
      this.map = existingMap;
    } else {
      // Создать новую карту
      this.map = {
        cells: new Map(),
        radius,
      };
      this.generateMap();
    }
  }

  /**
   * Генерация карты
   */
  private generateMap(): void {
    const center: HexCoordinates = { q: 0, r: 0 };
    const hexes = hexInRadius(center, this.map.radius);

    // Координаты всех NPC станций с их security status
    const npcStations: Array<{ coords: HexCoordinates; threat: number }> = [
      { coords: { q: 0, r: 0 }, threat: 1.0 },
      { coords: { q: 0, r: -7 }, threat: 0.5 },
    ];

    hexes.forEach(hex => {
      // Проверка на NPC системы
      const npcStation = npcStations.find(npc => npc.coords.q === hex.q && npc.coords.r === hex.r);
      const isNpcSystem = !!npcStation;
      
      // Вычислить угрозу
      let threat: number;
      if (isNpcSystem) {
        // Для NPC систем используем заданный security status
        threat = npcStation!.threat;
      } else {
        // Для остальных - вычислить влияние от каждой станции и взять максимум
        const threats = npcStations.map(npc => {
          const distance = hexDistance(npc.coords, hex);
          return this.calculateThreatFromStation(distance, npc.threat);
        });
        threat = Math.max(...threats); // Берем максимальную безопасность
      }
      
      const systemType = this.generateSystemType();
      
      const cell: HexCell = {
        coordinates: hex,
        systemType,
        threat,
        resources: Math.random() < 0.3 ? Math.floor(Math.random() * 100) + 50 : 0,
        discoveredBy: [],
        hasStation: isNpcSystem,
        owner: isNpcSystem ? 'npc' : undefined,
      };

      this.map.cells.set(hexKey(hex), cell);
    });
  }

  /**
   * Убедиться что планетарная система сгенерирована и сохранена в БД
   * Генерирует систему если её еще нет
   */
  async ensurePlanetarySystem(coordinates: HexCoordinates): Promise<string | null> {
    const cell = this.getCell(coordinates);
    if (!cell || cell.systemType !== SystemType.PLANETARY) {
      return null;
    }

    // Если система уже есть - вернуть её ID
    if (cell.planetarySystemId) {
      return cell.planetarySystemId;
    }

    // Генерировать новую систему
    const hexKeyStr = hexKey(coordinates);
    const system = PlanetarySystemGenerator.generate(coordinates);
    
    // Если в гексе есть NPC станция, создать структуру SPACE_STATION
    if (cell.hasStation && cell.owner === 'npc') {
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
        createdAt: Date.now() - 86400000, // Создана день назад
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
    }
    
    // Сохранить в БД
    await PlanetarySystemService.save(system);
    
    // Установить ID в ячейке
    cell.planetarySystemId = hexKeyStr;
    
    return hexKeyStr;
  }

  /**
   * Генерировать планетарные системы для всех планетарных гексов (пакетно)
   * Вызывается после создания новой карты
   */
  async generateAllPlanetarySystems(): Promise<void> {
    const systemsToGenerate: Array<{ coordinates: HexCoordinates; hexKey: string }> = [];
    
    // Найти все планетарные гексы без системы
    this.map.cells.forEach((cell, key) => {
      if (cell.systemType === SystemType.PLANETARY && !cell.planetarySystemId) {
        systemsToGenerate.push({ coordinates: cell.coordinates, hexKey: key });
      }
    });

    if (systemsToGenerate.length === 0) {
      return;
    }

    console.log(`🌌 Генерация ${systemsToGenerate.length} планетарных систем...`);

    // Генерировать все системы
    const systems = await Promise.all(systemsToGenerate.map(async ({ coordinates, hexKey }) => {
      const system = PlanetarySystemGenerator.generate(coordinates);
      const cell = this.map.cells.get(hexKey);
      
      // Если в гексе есть NPC станция, создать структуру SPACE_STATION
      if (cell?.hasStation && cell.owner === 'npc') {
        const stationStructure = {
          id: uuidv4(),
          type: StructureType.SPACE_STATION,
          ownerId: 'npc',
          location: { type: 'orbit' as const, targetId: `star-${hexKey}` },
          cost: STRUCTURE_COSTS[StructureType.SPACE_STATION],
          buildTime: STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION],
          buildProgress: 100,
          buildStartTime: Date.now() - STRUCTURE_BUILD_TIMES[StructureType.SPACE_STATION] * 1000,
          health: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          maxHealth: STRUCTURE_HEALTH[StructureType.SPACE_STATION],
          operational: true,
          createdAt: Date.now() - 86400000, // Создана день назад
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
      }
      
      if (cell) {
        cell.planetarySystemId = hexKey;
      }
      return system;
    }));

    // Сохранить пакетно в БД
    await PlanetarySystemService.saveMany(systems);
    
    console.log(`✅ Сгенерировано и сохранено ${systems.length} планетарных систем`);
  }

  /**
   * Вычислить уровень угрозы на основе расстояния от центра (старая функция)
   */
  private calculateThreat(distance: number): number {
    if (distance === 0) return 1.0;
    if (distance <= 3) return 0.8 - (distance / 3) * 0.3; // 0.8 -> 0.5
    if (distance <= 6) return 0.5 - ((distance - 3) / 3) * 0.5; // 0.5 -> 0.0
    // distance > 6
    const normalized = Math.min((distance - 6) / 4, 1.0); // 0 -> 1
    return 0.0 - normalized * 1.0; // 0.0 -> -1.0
  }

  /**
   * Вычислить влияние станции на гекс с учетом базового threat станции.
   * @param distance - расстояние до станции
   * @param stationThreat - уровень угрозы станции (0.5..1.0)
   * @param overrideMaxInfluence - если задан, используется как радиус влияния (для колоний — не меньше центральной)
   */
  private calculateThreatFromStation(distance: number, stationThreat: number, overrideMaxInfluence?: number): number {
    if (distance === 0) return stationThreat;

    const defaultMax = stationThreat === 1.0 ? 10 : 6;
    const maxInfluence = overrideMaxInfluence ?? defaultMax;
    const unknownZone = maxInfluence + 15;

    if (distance <= maxInfluence) {
      const normalized = distance / maxInfluence;
      return stationThreat - normalized * (stationThreat + 1.0);
    } else if (distance <= unknownZone) {
      const normalized = (distance - maxInfluence) / (unknownZone - maxInfluence);
      return -1.0 - normalized * 1.0;
    } else {
      return -2.0;
    }
  }

  /**
   * Генерация типа системы
   */
  private generateSystemType(): SystemType {
    // 95% планетарных систем, 5% пустого космоса
    return Math.random() < 0.95 ? SystemType.PLANETARY : SystemType.EMPTY;
  }

  /**
   * Получить гекс по координатам
   */
  getCell(coordinates: HexCoordinates): HexCell | undefined {
    return this.map.cells.get(hexKey(coordinates));
  }


  /**
   * Отметить гекс как открытый игроком
   */
  discoverCell(coordinates: HexCoordinates, playerId: string): void {
    const cell = this.getCell(coordinates);
    if (cell && !cell.discoveredBy?.includes(playerId)) {
      cell.discoveredBy = cell.discoveredBy || [];
      cell.discoveredBy.push(playerId);
    }
  }

  /**
   * Получить карту
   */
  getMap(): HexMap {
    return this.map;
  }

  /**
   * Колонизировать систему
   */
  colonizeSystem(coordinates: HexCoordinates, playerId: string): { success: boolean; error?: string } {
    const cell = this.getCell(coordinates);
    if (!cell) {
      return { success: false, error: 'Система не найдена' };
    }

    // Проверить, что система еще не колонизирована
    if (cell.owner && cell.owner !== 'npc') {
      return { success: false, error: 'Система уже колонизирована другим игроком' };
    }

    // Проверить, что система не NPC станция
    if (cell.hasStation && cell.owner === 'npc') {
      return { success: false, error: 'Нельзя колонизировать NPC станцию' };
    }

    // Проверить, что система не под сильным влиянием других систем (threat > 0)
    if (cell.threat > 0) {
      return { success: false, error: 'Система под влиянием других фракций' };
    }

    // Колонизировать: задаём начальный уровень угрозы (влияние колонии)
    cell.systemType = SystemType.PLANETARY;
    cell.owner = playerId;
    cell.hasStation = true;
    cell.threat = 0.5; // Начальный уровень угрозы (безопасности), макс по кнопке — 1
    cell.lastDecayCheck = Date.now();

    // Пересчитать влияние на соседние системы
    this.updateInfluenceFromColony(coordinates);

    return { success: true };
  }

  /**
   * Развить колонию: +0.1 к уровню угрозы (макс 1)
   */
  developColony(coordinates: HexCoordinates, playerId: string): { success: boolean; error?: string } {
    const cell = this.getCell(coordinates);
    if (!cell) {
      return { success: false, error: 'Система не найдена' };
    }

    if (cell.owner !== playerId) {
      return { success: false, error: 'Это не ваша колония' };
    }

    if (!cell.hasStation || cell.owner === 'npc') {
      return { success: false, error: 'Это не колония' };
    }

    // Повысить уровень угрозы (влияния), не выше 1
    cell.threat = Math.min(1.0, cell.threat + 0.1);

    this.updateInfluenceFromColony(coordinates);

    return { success: true };
  }

  /**
   * Пересчитать влияние от всех источников (NPC станции + все колонии игроков).
   * Надежный метод: пересчитывает всё заново, гарантируя корректный максимум.
   */
  private recalculateAllInfluences(): void {
    // Координаты NPC станций (как при генерации карты)
    const npcStations: Array<{ coords: HexCoordinates; threat: number }> = [
      { coords: { q: 0, r: 0 }, threat: 1.0 },
      { coords: { q: 0, r: -7 }, threat: 0.5 },
    ];

    // Найти все колонии игроков
    const playerColonies: Array<{ coords: HexCoordinates; threat: number }> = [];
    this.map.cells.forEach((cell) => {
      if (cell.hasStation && cell.owner && cell.owner !== 'npc') {
        playerColonies.push({
          coords: cell.coordinates,
          threat: cell.threat,
        });
      }
    });

    // Для каждой ячейки (кроме самих станций) пересчитать threat как максимум от всех источников
    this.map.cells.forEach((cell) => {
      // Не пересчитываем для станций и колоний (они имеют свой базовый threat)
      if (cell.hasStation && cell.owner) return;

      const influences: number[] = [];

      // Влияние от всех NPC станций
      npcStations.forEach((npc) => {
        const distance = hexDistance(npc.coords, cell.coordinates);
        influences.push(this.calculateThreatFromStation(distance, npc.threat));
      });

      // Влияние от всех колоний игроков
      playerColonies.forEach((colony) => {
        const distance = hexDistance(colony.coords, cell.coordinates);
        const formulaMaxInfluence = colony.threat >= 0.99 ? 10 : 6;
        influences.push(this.calculateThreatFromStation(distance, colony.threat, formulaMaxInfluence));
      });

      // Берём максимум по всем источникам
      if (influences.length > 0) {
        cell.threat = Math.max(...influences);
      }
    });
  }

  /**
   * Обновить влияние от колонии (вызывает полный пересчёт всех влияний).
   */
  private updateInfluenceFromColony(colonyCoords: HexCoordinates): void {
    // Просто пересчитываем всё заново — это надежнее
    this.recalculateAllInfluences();
  }

  /**
   * Деградация колоний: раз в 5 минут −0.1 к threat при наличии красных зон рядом (мин. 0.1)
   * @returns true если произошла деградация (нужно сохранить изменения)
   */
  checkColonyDecay(): boolean {
    const now = Date.now();
    const decayInterval = 5 * 60 * 1000; // 5 минут
    let coloniesChecked = 0;
    let coloniesDecayed = 0;
    let totalCells = 0;
    let skippedNoStation = 0;
    let skippedNoOwner = 0;
    let skippedNPC = 0;

    // #region agent log
    console.log(`🔍 [DECAY] Начало проверки деградации колоний (всего гексов: ${this.map.cells.size})`);
    // #endregion

    this.map.cells.forEach((cell) => {
      totalCells++;
      if (!cell.hasStation) {
        skippedNoStation++;
        return;
      }
      if (!cell.owner) {
        skippedNoOwner++;
        return;
      }
      if (cell.owner === 'npc') {
        skippedNPC++;
        return;
      }
      
      coloniesChecked++;
      
      // Инициализировать lastDecayCheck если его нет
      if (!cell.lastDecayCheck) {
        cell.lastDecayCheck = now;
        console.log(`🕐 Инициализация проверки деградации для колонии [${cell.coordinates.q}, ${cell.coordinates.r}] (threat=${cell.threat.toFixed(2)}, owner=${cell.owner})`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HexMap.ts:392',message:'Colony decay check initialized',data:{q:cell.coordinates.q,r:cell.coordinates.r,threat:cell.threat,owner:cell.owner,now},timestamp:Date.now(),runId:'decay-check',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return; // Пропустить первую проверку, дать время накопить интервал
      }

      // Проверить, прошло ли 5 минут
      const timeSinceLastCheck = now - cell.lastDecayCheck;
      const minutesPassed = Math.floor(timeSinceLastCheck / 60000);
      
      if (timeSinceLastCheck < decayInterval) {
        // Логируем только раз в минуту, чтобы не спамить
        if (minutesPassed > 0 && minutesPassed % 1 === 0) {
          console.log(`⏳ Колония [${cell.coordinates.q}, ${cell.coordinates.r}]: прошло ${minutesPassed} мин из 5 (threat=${cell.threat.toFixed(2)})`);
        }
        return; // Ещё не прошло 5 минут
      }

      console.log(`🔍 Проверка деградации для колонии [${cell.coordinates.q}, ${cell.coordinates.r}] (прошло ${minutesPassed} мин, threat=${cell.threat.toFixed(2)}, owner=${cell.owner})`);
      const hasNearbyDanger = this.checkNearbyDanger(cell.coordinates);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HexMap.ts:410',message:'Colony decay check',data:{q:cell.coordinates.q,r:cell.coordinates.r,threat:cell.threat,owner:cell.owner,timeSinceLastCheck,minutesPassed,hasNearbyDanger},timestamp:Date.now(),runId:'decay-check',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (hasNearbyDanger) {
        const oldThreat = cell.threat;
        cell.threat = Math.max(0.1, cell.threat - 0.1);
        coloniesDecayed++;
        console.log(`📉 Деградация колонии [${cell.coordinates.q}, ${cell.coordinates.r}]: threat ${oldThreat.toFixed(2)} → ${cell.threat.toFixed(2)}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HexMap.ts:416',message:'Colony decayed',data:{q:cell.coordinates.q,r:cell.coordinates.r,oldThreat,newThreat:cell.threat,owner:cell.owner},timestamp:Date.now(),runId:'decay-check',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Пересчитать влияние от всех источников после деградации
        this.recalculateAllInfluences();
      } else {
        console.log(`✅ Колония [${cell.coordinates.q}, ${cell.coordinates.r}] безопасна, деградации нет (threat=${cell.threat.toFixed(2)})`);
      }

      cell.lastDecayCheck = now;
    });
    
    // #region agent log
    console.log(`📊 [DECAY] Проверка деградации завершена: всего гексов=${totalCells}, пропущено (нет станции)=${skippedNoStation}, пропущено (нет владельца)=${skippedNoOwner}, пропущено (NPC)=${skippedNPC}, проверено колоний=${coloniesChecked}, деградировало=${coloniesDecayed}`);
    // #endregion
    
    if (coloniesChecked > 0) {
      console.log(`📊 Проверка деградации завершена: проверено колоний=${coloniesChecked}, деградировало=${coloniesDecayed}`);
    } else {
      console.log(`ℹ️ [DECAY] Пользовательских колоний не найдено для проверки деградации`);
    }
    
    // Возвращаем true если произошла деградация (нужно сохранить изменения)
    return coloniesDecayed > 0;
  }

  /**
   * Проверить наличие опасных зон рядом (threat < -0.5)
   */
  private checkNearbyDanger(coordinates: HexCoordinates): boolean {
    const radius = 5; // Увеличиваем радиус проверки до 5 гексов
    const hexes = hexInRadius(coordinates, radius);
    const nearbyThreats: Array<{ q: number; r: number; threat: number; distance: number }> = [];
    let foundDanger = false;
    let checkedHexes = 0;
    let dangerousHexes = 0;
    let cellsFound = 0;
    let cellsMissing = 0;

    console.log(`🔍 [DANGER] Проверка опасных зон для колонии [${coordinates.q}, ${coordinates.r}], радиус=${radius}, всего гексов в радиусе=${hexes.length}`);

    for (const hex of hexes) {
      // Пропустить сам центр (колонию)
      if (hex.q === coordinates.q && hex.r === coordinates.r) continue;
      
      checkedHexes++;
      const cell = this.getCell(hex);
      if (cell) {
        cellsFound++;
        const distance = hexDistance(coordinates, hex);
        nearbyThreats.push({ q: hex.q, r: hex.r, threat: cell.threat, distance });
        if (cell.threat < -0.5) {
          dangerousHexes++;
          console.log(`⚠️ Найдена опасная зона рядом с колонией [${coordinates.q}, ${coordinates.r}]: гекс [${hex.q}, ${hex.r}] на расстоянии ${distance} имеет threat=${cell.threat.toFixed(2)}`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HexMap.ts:490',message:'Dangerous hex found near colony',data:{colonyQ:coordinates.q,colonyR:coordinates.r,hexQ:hex.q,hexR:hex.r,distance,threat:cell.threat},timestamp:Date.now(),runId:'decay-check',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          foundDanger = true;
        }
      } else {
        cellsMissing++;
      }
    }
    
    console.log(`📊 [DANGER] Проверка завершена для колонии [${coordinates.q}, ${coordinates.r}]: проверено гексов=${checkedHexes}, найдено ячеек=${cellsFound}, отсутствует=${cellsMissing}, опасных зон=${dangerousHexes}, результат=${foundDanger ? 'ОПАСНО' : 'БЕЗОПАСНО'}`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5e157f9f-2754-4b3d-af6e-0d3cf86ac9df',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HexMap.ts:505',message:'Nearby danger check completed',data:{colonyQ:coordinates.q,colonyR:coordinates.r,radius,checkedHexes,cellsFound,cellsMissing,dangerousHexes,foundDanger,nearbyThreats:nearbyThreats.slice(0,10)},timestamp:Date.now(),runId:'decay-check',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Логируем все гексы в радиусе для отладки (только опасные или все, если их немного)
    if (nearbyThreats.length > 0) {
      const dangerousHexes = nearbyThreats.filter(h => h.threat < -0.5);
      if (dangerousHexes.length > 0) {
        const threatsStr = dangerousHexes.map(h => `[${h.q},${h.r}]:${h.threat.toFixed(2)}@${h.distance}]`).join(', ');
        console.log(`🔍 Опасные зоны рядом с колонией [${coordinates.q}, ${coordinates.r}]: ${threatsStr}`);
      } else {
        // Показываем минимальные threat значения для отладки
        const minThreats = nearbyThreats.sort((a, b) => a.threat - b.threat).slice(0, 5);
        const threatsStr = minThreats.map(h => `[${h.q},${h.r}]:${h.threat.toFixed(2)}@${h.distance}`).join(', ');
        console.log(`🔍 Минимальные threat рядом с колонией [${coordinates.q}, ${coordinates.r}]: ${threatsStr}`);
      }
    }

    return foundDanger;
  }
}

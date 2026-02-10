import { HexMap, HexCell, HexType, HexCoordinates, SystemType, THREAT_ZONES } from '@hexploration/shared';
import { hexInRadius, hexKey, hexDistance } from '@hexploration/shared';

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
   */
  checkColonyDecay(): void {
    const now = Date.now();
    const decayInterval = 5 * 60 * 1000; // 5 минут

    this.map.cells.forEach((cell) => {
      if (!cell.hasStation || !cell.owner || cell.owner === 'npc') return;
      if (!cell.lastDecayCheck) cell.lastDecayCheck = now;

      if (now - cell.lastDecayCheck < decayInterval) return;

      const hasNearbyDanger = this.checkNearbyDanger(cell.coordinates);

      if (hasNearbyDanger) {
        cell.threat = Math.max(0.1, cell.threat - 0.1);
        // Пересчитать влияние от всех источников после деградации
        this.recalculateAllInfluences();
      }

      cell.lastDecayCheck = now;
    });
  }

  /**
   * Проверить наличие опасных зон рядом
   */
  private checkNearbyDanger(coordinates: HexCoordinates): boolean {
    const radius = 3; // Проверяем в радиусе 3 гексов
    const hexes = hexInRadius(coordinates, radius);

    for (const hex of hexes) {
      const cell = this.getCell(hex);
      if (cell && cell.threat < -0.5) {
        return true; // Есть опасная зона рядом
      }
    }

    return false;
  }
}

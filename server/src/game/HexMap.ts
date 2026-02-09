import { HexMap, HexCell, HexType, HexCoordinates, SystemType, THREAT_ZONES } from '@hexploration/shared';
import { hexInRadius, hexKey, hexDistance } from '@hexploration/shared';

export class HexMapManager {
  private map: HexMap;

  constructor(radius: number) {
    this.map = {
      cells: new Map(),
      radius,
    };
    this.generateMap();
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
   * Вычислить влияние станции на гекс с учетом базового threat станции
   */
  private calculateThreatFromStation(distance: number, stationThreat: number): number {
    if (distance === 0) return stationThreat;
    
    // Дальность влияния зависит от security status станции
    const maxInfluence = stationThreat === 1.0 ? 10 : 6; // Станция 1.0 влияет дальше
    const unknownZone = maxInfluence + 15; // +15 гексов до полностью неизвестного космоса
    
    if (distance <= maxInfluence) {
      // Зона влияния: линейное падение от stationThreat до -1.0
      const normalized = distance / maxInfluence; // 0 -> 1
      return stationThreat - normalized * (stationThreat + 1.0);
    } else if (distance <= unknownZone) {
      // Неисследованный космос: от -1.0 до -2.0
      const normalized = (distance - maxInfluence) / (unknownZone - maxInfluence); // 0 -> 1
      return -1.0 - normalized * 1.0; // -1.0 -> -2.0
    } else {
      // За пределами - полностью неизвестный космос
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

    // Колонизировать
    cell.systemType = SystemType.PLANETARY;
    cell.owner = playerId;
    cell.hasStation = true;
    cell.controlStrength = 1.0; // Начальная сила контроля
    cell.lastDecayCheck = Date.now();

    // Пересчитать влияние на соседние системы
    this.updateInfluenceFromColony(coordinates);

    return { success: true };
  }

  /**
   * Развить колонию (увеличить СС)
   */
  developColony(coordinates: HexCoordinates, playerId: string): { success: boolean; error?: string } {
    const cell = this.getCell(coordinates);
    if (!cell) {
      return { success: false, error: 'Система не найдена' };
    }

    // Проверить, что система принадлежит игроку
    if (cell.owner !== playerId) {
      return { success: false, error: 'Это не ваша колония' };
    }

    // Проверить, что это колония
    if (!cell.controlStrength) {
      return { success: false, error: 'Это не колония' };
    }

    // Увеличить силу контроля
    cell.controlStrength = Math.min(10.0, cell.controlStrength + 0.1);

    // Пересчитать влияние
    this.updateInfluenceFromColony(coordinates);

    return { success: true };
  }

  /**
   * Обновить влияние от колонии на окружающие системы
   */
  private updateInfluenceFromColony(colonyCoords: HexCoordinates): void {
    const colony = this.getCell(colonyCoords);
    if (!colony || !colony.controlStrength) return;

    const maxInfluence = Math.floor(colony.controlStrength * 2); // Дальность влияния зависит от СС

    // Обновить threat для всех гексов в радиусе влияния
    this.map.cells.forEach((cell) => {
      // Не обновлять NPC станции и другие колонии
      if (cell.hasStation && cell.owner) return;

      const distance = hexDistance(colonyCoords, cell.coordinates);
      if (distance > 0 && distance <= maxInfluence) {
        // Вычислить влияние от этой колонии
        const influence = this.calculateThreatFromStation(distance, colony.controlStrength! / 10); // Нормализовать к [0, 1]
        
        // Обновить threat только если влияние больше текущего
        if (influence > cell.threat) {
          cell.threat = influence;
        }
      }
    });
  }

  /**
   * Проверить деградацию всех колоний
   */
  checkColonyDecay(): void {
    const now = Date.now();
    const decayInterval = 5 * 60 * 1000; // 5 минут

    this.map.cells.forEach((cell) => {
      // Проверяем только пользовательские колонии
      if (!cell.controlStrength || !cell.owner || cell.owner === 'npc') return;
      if (!cell.lastDecayCheck) cell.lastDecayCheck = now;

      // Проверяем, прошло ли 5 минут
      if (now - cell.lastDecayCheck < decayInterval) return;

      // Проверяем наличие красных зон рядом (threat < -0.5)
      const hasNearbyDanger = this.checkNearbyDanger(cell.coordinates);

      if (hasNearbyDanger) {
        // Деградация: -0.1 к СС
        cell.controlStrength = Math.max(0.1, cell.controlStrength - 0.1);
        
        // Обновить влияние
        this.updateInfluenceFromColony(cell.coordinates);
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

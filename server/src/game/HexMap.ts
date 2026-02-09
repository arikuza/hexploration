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
}

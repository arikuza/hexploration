import './ThreatLegend.css';

/**
 * Получить цвет угрозы (та же логика, что в HexGrid)
 */
function getThreatColor(threat: number): string {
  if (threat >= 0.5) {
    const t = (threat - 0.5) / 0.5;
    const hue = 180 + t * 20;
    const saturation = 55 + t * 20;
    const lightness = 28 + t * 12;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else if (threat >= 0.0) {
    const t = (threat - 0.0) / 0.5;
    const hue = 240 + (1 - t) * 40;
    const saturation = 45 + (1 - t) * 10;
    const lightness = 22 + t * 6;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else if (threat >= -1.0) {
    const t = (threat - (-1.0)) / 1.0;
    const hue = 320 + (1 - t) * 40;
    const saturation = 50 + (1 - t) * 15;
    const lightness = 15 + t * 7;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    const t = (threat - (-2.0)) / 1.0;
    const hue = 270;
    const saturation = 15 + t * 10;
    const lightness = 2 + t * 4;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}

export function ThreatLegend() {
  return (
    <div className="threat-legend">
      <h4>Уровень угрозы</h4>
      <div className="legend-items">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(1.0) }}></div>
          <span>Безопасно (1.0)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(0.5) }}></div>
          <span>Относительно безопасно (0.5)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(0.0) }}></div>
          <span>Умеренно (0.0)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(-0.5) }}></div>
          <span>Опасно (-0.5)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(-1.0) }}></div>
          <span>Крайне опасно (-1.0)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(-1.5) }}></div>
          <span>Неисследованный космос (-1.5)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getThreatColor(-2.0) }}></div>
          <span>Неизвестность (-2.0)</span>
        </div>
      </div>
    </div>
  );
}

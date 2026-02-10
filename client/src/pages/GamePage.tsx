import { useState, useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import HexGrid from '../components/game/HexGrid';
import GameHUD from '../components/ui/GameHUD';
import PlayerList from '../components/ui/PlayerList';
import { ThreatLegend } from '../components/ui/ThreatLegend';
import { SkillsPanel } from '../components/ui/SkillsPanel';
import { IconPanel } from '../components/ui/IconPanel';
import { HexInfo } from '../components/ui/HexInfo';
import { CombatView } from '../components/combat/CombatView';
import { PlanetarySystemView } from '../components/planetary/PlanetarySystemView';
import StationPanel from '../components/station/StationPanel';
import { HexCoordinates } from '@hexploration/shared';
import './GamePage.css';
import '../components/ui/HexInfo.css';

function GamePage() {
  const { connected } = useAppSelector((state) => state.game);
  const { currentPlayer } = useAppSelector((state) => state.player);
  const { inCombat } = useAppSelector((state) => state.combat);
  const [selectedHex, setSelectedHex] = useState<HexCoordinates | null>(null);
  const [planetarySystemHex, setPlanetarySystemHex] = useState<HexCoordinates | null>(null);
  const [showSkillsPanel, setShowSkillsPanel] = useState(false);
  const [openStationId, setOpenStationId] = useState<string | null>(null);

  // Автоматически выбрать гекс текущего игрока при загрузке
  useEffect(() => {
    if (currentPlayer && !selectedHex) {
      setSelectedHex(currentPlayer.position);
    }
  }, [currentPlayer, selectedHex]);

  if (!connected || !currentPlayer) {
    return (
      <div className="game-page loading">
        <div className="loading-spinner"></div>
        <p>Подключение к серверу...</p>
      </div>
    );
  }

  // Показать экран боя если в бою
  if (inCombat) {
    return <CombatView />;
  }

  return (
    <div className="game-page">
      <GameHUD />
      <div className="game-content">
        <HexGrid selectedHex={selectedHex} onHexSelect={setSelectedHex} />
      </div>
      <div className="right-panels">
        <ThreatLegend />
        <PlayerList />
      </div>
      <div className="icon-panel-container">
        <IconPanel
          icons={[
            {
              id: 'skills',
              icon: '⚡',
              label: 'Навыки',
              onClick: () => setShowSkillsPanel(!showSkillsPanel),
            },
            // Здесь можно добавить другие иконки в будущем
          ]}
        />
      </div>
      {showSkillsPanel && (
        <div className="skills-panel-container">
          <SkillsPanel onClose={() => setShowSkillsPanel(false)} />
        </div>
      )}
      <HexInfo 
        selectedHex={selectedHex} 
        onOpenPlanetarySystem={setPlanetarySystemHex}
        onOpenStation={setOpenStationId}
      />
      
      {/* Модальное окно планетарной системы — на уровне GamePage, поверх всего */}
      {planetarySystemHex && (
        <div
          className="planetary-system-modal"
          onClick={() => setPlanetarySystemHex(null)}
          role="dialog"
          aria-label="Планетарная система"
        >
          <div
            className="planetary-system-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <PlanetarySystemView
              coordinates={planetarySystemHex}
              onClose={() => setPlanetarySystemHex(null)}
              onOpenStation={setOpenStationId}
            />
          </div>
        </div>
      )}

      {/* Модальное окно станции */}
      {openStationId && (
        <div
          className="station-modal"
          onClick={() => setOpenStationId(null)}
          role="dialog"
          aria-label="Станция"
        >
          <div
            className="station-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <StationPanel
              stationId={openStationId}
              onClose={() => setOpenStationId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default GamePage;

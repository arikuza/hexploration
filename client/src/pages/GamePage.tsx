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
import { MiningView } from '../components/mining/MiningView';
import { PlanetarySystemView } from '../components/planetary/PlanetarySystemView';
import StationPanel from '../components/station/StationPanel';
import { QuestView } from '../components/station/QuestView';
import { CargoPanel } from '../components/ui/CargoPanel';
import { HexCoordinates } from '@hexploration/shared';
import './GamePage.css';
import '../components/ui/HexInfo.css';
import '../components/ui/SkillsPanel.css';
import '../components/ui/IconPanel.css';

function GamePage() {
  const { connected } = useAppSelector((state) => state.game);
  const { currentPlayer } = useAppSelector((state) => state.player);
  const { inCombat } = useAppSelector((state) => state.combat);
  const { inMining } = useAppSelector((state) => state.mining);
  const [selectedHex, setSelectedHex] = useState<HexCoordinates | null>(null);
  const [planetarySystemHex, setPlanetarySystemHex] = useState<HexCoordinates | null>(null);
  const [showSkillsPanel, setShowSkillsPanel] = useState(false);
  const [openStationId, setOpenStationId] = useState<string | null>(null);
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [showCargoPanel, setShowCargoPanel] = useState(false);

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

  // Показать экран майнинга если в майнинге
  if (inMining) {
    return <MiningView />;
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
        onOpenQuestPanel={() => setShowQuestPanel(true)}
        onOpenCargoPanel={() => setShowCargoPanel(true)}
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

      {/* Модальное окно квестов */}
      {showQuestPanel && (
        <div
          className="station-modal"
          onClick={() => setShowQuestPanel(false)}
          role="dialog"
          aria-label="Квесты"
        >
          <div
            className="station-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <QuestView />
            <button className="close-mining-btn" style={{ marginTop: 16 }} onClick={() => setShowQuestPanel(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {/* Модальное окно трюма */}
      {showCargoPanel && (
        <div
          className="station-modal"
          onClick={() => setShowCargoPanel(false)}
          role="dialog"
          aria-label="Трюм"
        >
          <div
            className="station-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <CargoPanel />
            <button className="close-mining-btn" style={{ marginTop: 16 }} onClick={() => setShowCargoPanel(false)}>Закрыть</button>
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

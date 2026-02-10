import { useState, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import {
  SkillCategory,
  SKILLS,
  SKILLS_BY_ID,
  getSpRequiredForLevels,
  SocketEvent,
} from '@hexploration/shared';
import { socketService } from '../../services/socketService';
import './SkillsPanel.css';

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.COMBAT]: 'Боевая',
  [SkillCategory.SOCIAL]: 'Социальная',
  [SkillCategory.CRAFT]: 'Крафт',
};

interface SkillsPanelProps {
  onClose?: () => void;
}

export function SkillsPanel({ onClose }: SkillsPanelProps) {
  const { currentPlayer } = useAppSelector((state) => state.player);
  const [activeTab, setActiveTab] = useState<SkillCategory>(SkillCategory.COMBAT);
  const [, setTick] = useState(0);

  const skills = currentPlayer?.skills;
  const levels = skills?.levels ?? {};
  const queue = skills?.queue ?? [];
  const currentTraining = skills?.currentTraining ?? null;

  useEffect(() => {
    socketService.emit(SocketEvent.SKILLS_GET);
  }, []);

  // Обновляем данные с сервера каждые 5 сек, чтобы уровни и прогресс в списке совпадали с сервером
  useEffect(() => {
    const interval = setInterval(() => socketService.emit(SocketEvent.SKILLS_GET), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSetQueue = (newQueue: { skillId: string; targetLevel: number }[]) => {
    socketService.emit(SocketEvent.SKILLS_QUEUE_SET, { queue: newQueue });
  };

  const handleAddToQueue = (skillId: string, targetLevel: number) => {
    const skill = SKILLS_BY_ID[skillId];
    if (!skill || targetLevel < 1 || targetLevel > skill.maxLevel) return;
    const current = levels[skillId] ?? 0;
    if (targetLevel <= current) return;
    const existing = queue.map((q) => ({ skillId: q.skillId, targetLevel: q.targetLevel }));
    const already = existing.find((e) => e.skillId === skillId);
    if (already) return;
    handleSetQueue([...existing, { skillId, targetLevel }]);
  };

  const handleClearQueue = () => {
    handleSetQueue([]);
  };

  const categorySkills = SKILLS.filter((s) => s.category === activeTab);

  let progress = 0;
  let required = 1;
  if (currentTraining) {
    const skill = SKILLS_BY_ID[currentTraining.skillId];
    const currentLevel = levels[currentTraining.skillId] ?? 0;
    if (skill) {
      required = getSpRequiredForLevels(skill, currentLevel, currentTraining.targetLevel);
      const elapsedMs = Date.now() - currentTraining.startTime;
      progress = (elapsedMs / 3600000) * skill.spPerHour;
    }
  }

  if (!currentPlayer) return null;

  return (
    <div className="skills-panel">
      <div className="skills-panel__header">
        <h3 className="skills-panel__title">Навыки</h3>
        {onClose && (
          <button
            type="button"
            className="skills-panel__close"
            onClick={onClose}
            title="Закрыть"
          >
            ×
          </button>
        )}
      </div>

      <div className="skills-panel__tabs">
        {(Object.keys(CATEGORY_LABELS) as SkillCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`skills-panel__tab ${activeTab === cat ? 'active' : ''}`}
            onClick={() => setActiveTab(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="skills-panel__queue">
        <h4>Очередь</h4>
        {currentTraining ? (
          <>
            <div className="skills-panel__current">
              <span>{SKILLS_BY_ID[currentTraining.skillId]?.name ?? currentTraining.skillId}</span>
              <span> → уровень {currentTraining.targetLevel}</span>
              <div className="skills-panel__progress-bar">
                <div
                  className="skills-panel__progress-fill"
                  style={{ width: `${Math.min(100, (progress / required) * 100)}%` }}
                />
              </div>
              <small>{(progress / required * 100).toFixed(0)}% (~{Math.max(0, Math.ceil((required - progress) / 60))} с)</small>
            </div>
            {queue.length > 1 && (
              <ul className="skills-panel__queue-list">
                {queue.slice(1).map((q, i) => (
                  <li key={i}>
                    {SKILLS_BY_ID[q.skillId]?.name} → {q.targetLevel}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="skills-panel__clear" onClick={handleClearQueue}>
              Очистить очередь
            </button>
          </>
        ) : (
          <p className="skills-panel__empty">Очередь пуста. Добавьте навык ниже.</p>
        )}
      </div>

      <div className="skills-panel__list">
        <h4>{CATEGORY_LABELS[activeTab]}</h4>
        <ul>
          {categorySkills.map((skill) => {
            const current = levels[skill.id] ?? 0;
            const isTraining = currentTraining?.skillId === skill.id;
            return (
              <li key={skill.id} className={`skills-panel__skill ${isTraining ? 'training' : ''}`}>
                <div className="skills-panel__skill-name">{skill.name}</div>
                <div className="skills-panel__skill-levels">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span
                      key={lvl}
                      className={`level ${current >= lvl ? 'done' : ''} ${current === lvl - 1 && isTraining ? 'next' : ''}`}
                    >
                      {lvl}
                    </span>
                  ))}
                </div>
                <div className="skills-panel__skill-actions">
                  {current < skill.maxLevel && (
                    <select
                      title={`Добавить ${skill.name} в очередь`}
                      value=""
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v) handleAddToQueue(skill.id, v);
                        e.target.value = '';
                      }}
                    >
                      <option value="">+ в очередь</option>
                      {[1, 2, 3, 4, 5]
                        .filter((l) => l > current)
                        .map((l) => (
                          <option key={l} value={l}>
                            Уровень {l}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

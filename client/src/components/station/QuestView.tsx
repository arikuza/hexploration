import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState, store } from '../../store/store';
import { socketService } from '../../services/socketService';
import { SocketEvent } from '@hexploration/shared';
import { QuestType } from '@hexploration/shared';
import { getItem, ITEM_REGISTRY } from '@hexploration/shared';
import { setQuests } from '../../store/slices/stationSlice';
import './QuestView.css';

interface QuestViewProps {
  stationId?: string;
}

export const QuestView: React.FC<QuestViewProps> = ({ stationId }) => {
  const { currentStation, quests } = useSelector((state: RootState) => state.station);
  const currentPlayer = useSelector((state: RootState) => state.player.currentPlayer);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    socketService.emit(SocketEvent.QUEST_LIST_GET);
    const handler = (data: { quests: any[] }) => {
      store.dispatch(setQuests(data.quests ?? []));
      setLoaded(true);
    };
    socketService.on(SocketEvent.QUEST_LIST_DATA, handler);
    return () => { socketService.off(SocketEvent.QUEST_LIST_DATA, handler); };
  }, []);
  const [createType, setCreateType] = useState<QuestType>(QuestType.KILL_ENEMIES);
  const [createKillCount, setCreateKillCount] = useState(5);
  const [createItemId, setCreateItemId] = useState('iron_ore');
  const [createDeliverQty, setCreateDeliverQty] = useState(50);
  const [createReward, setCreateReward] = useState(100);

  const isOwner = stationId && currentStation?.ownerId === currentPlayer?.id && currentStation?.ownerId !== 'npc';

  const handleCreateQuest = () => {
    if (!stationId) return;
    const target = createType === QuestType.KILL_ENEMIES
      ? { killCount: createKillCount }
      : { itemId: createItemId, deliverQuantity: createDeliverQty };
    socketService.emit(SocketEvent.QUEST_CREATE, {
      stationId,
      questType: createType,
      target,
      rewardCredits: createReward,
    });
  };

  const handleTakeQuest = (questId: string) => {
    socketService.emit(SocketEvent.QUEST_TAKE, { questId });
  };

  const handleTurnIn = (questId: string) => {
    socketService.emit(SocketEvent.QUEST_TURN_IN, { questId });
  };

  const getQuestProgress = (questId: string) => {
    const aq = currentPlayer?.activeQuests?.find(q => q.questId === questId);
    return aq;
  };

  const isQuestComplete = (quest: any) => {
    const aq = getQuestProgress(quest.id);
    if (!aq) return false;
    if (quest.questType === QuestType.KILL_ENEMIES) {
      return (aq.kills ?? 0) >= (quest.target.killCount ?? 0);
    }
    return (aq.delivered ?? 0) >= (quest.target.deliverQuantity ?? 0);
  };

  if (!loaded) return <div className="quest-view"><p>Загрузка квестов...</p></div>;

  return (
    <div className="quest-view">
      <h3>Квесты</h3>

      {isOwner && stationId && (
        <div className="quest-create">
          <h4>Создать квест</h4>
          <select value={createType} onChange={e => setCreateType(e.target.value as QuestType)}>
            <option value={QuestType.KILL_ENEMIES}>Убить врагов</option>
            <option value={QuestType.DELIVER_RESOURCES}>Привезти ресурсы</option>
          </select>
          {createType === QuestType.KILL_ENEMIES ? (
            <div>
              <label>Количество:</label>
              <input type="number" min={1} value={createKillCount} onChange={e => setCreateKillCount(parseInt(e.target.value) || 1)} />
            </div>
          ) : (
            <div>
              <label>Ресурс:</label>
              <select value={createItemId} onChange={e => setCreateItemId(e.target.value)}>
                {Object.entries(ITEM_REGISTRY).filter(([, i]) => i.type === 'resource').map(([id, item]) => (
                  <option key={id} value={id}>{item.name}</option>
                ))}
              </select>
              <label>Количество:</label>
              <input type="number" min={1} value={createDeliverQty} onChange={e => setCreateDeliverQty(parseInt(e.target.value) || 1)} />
            </div>
          )}
          <div>
            <label>Награда (кредиты):</label>
            <input type="number" min={1} value={createReward} onChange={e => setCreateReward(parseInt(e.target.value) || 1)} />
          </div>
          <button onClick={handleCreateQuest}>Создать</button>
        </div>
      )}

      {/* Мои квесты — всегда показываем взятые */}
      {(() => {
        const takenQuests = quests.filter(q => currentPlayer?.activeQuests?.some(aq => aq.questId === q.id));
        if (takenQuests.length === 0) return null;
        return (
          <div className="quest-list">
            <h4>Мои квесты</h4>
            <ul>
              {takenQuests.map(quest => {
                const aq = getQuestProgress(quest.id);
                const complete = isQuestComplete(quest);
                return (
                  <li key={quest.id} className="quest-item">
                    <div className="quest-desc">
                      {quest.questType === QuestType.KILL_ENEMIES ? (
                        <>Убить {quest.target.killCount} врагов</>
                      ) : (
                        <>Привезти {quest.target.deliverQuantity} {getItem(quest.target.itemId!)?.name ?? quest.target.itemId}</>
                      )}
                      <span className="reward">— {quest.rewardCredits} кредитов</span>
                    </div>
                    {aq && (
                      <div className="quest-progress">
                        {quest.questType === QuestType.KILL_ENEMIES
                          ? `${aq.kills ?? 0}/${quest.target.killCount}`
                          : `${aq.delivered ?? 0}/${quest.target.deliverQuantity}`}
                      </div>
                    )}
                    {complete && (
                      <button onClick={() => handleTurnIn(quest.id)}>Сдать</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* Доступные квесты — только на станции, с кнопкой Взять */}
      {stationId && (
        <div className="quest-list">
          <h4>Доступные квесты</h4>
          {(() => {
            const availableQuests = quests.filter(q =>
              !currentPlayer?.activeQuests?.some(aq => aq.questId === q.id) &&
              q.stationId === stationId
            );
            if (availableQuests.length === 0) {
              return <p className="empty">Нет доступных квестов</p>;
            }
            return (
              <ul>
                {availableQuests.map(quest => (
                  <li key={quest.id} className="quest-item">
                    <div className="quest-desc">
                      {quest.questType === QuestType.KILL_ENEMIES ? (
                        <>Убить {quest.target.killCount} врагов</>
                      ) : (
                        <>Привезти {quest.target.deliverQuantity} {getItem(quest.target.itemId!)?.name ?? quest.target.itemId}</>
                      )}
                      <span className="reward">— {quest.rewardCredits} кредитов</span>
                    </div>
                    <button onClick={() => handleTakeQuest(quest.id)}>Взять</button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}

      {/* Когда не на станции и нет взятых квестов — подсказка */}
      {!stationId && (!currentPlayer?.activeQuests?.length) && (
        <p className="empty">Нет взятых квестов. Откройте станцию, чтобы взять квест.</p>
      )}
    </div>
  );
};

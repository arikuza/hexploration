import { Middleware } from '@reduxjs/toolkit';
import { socketService } from '../../services/socketService';
import { setGameState, updateMap, setInvasions, setConnected } from '../slices/gameSlice';
import {
  setCurrentPlayer,
  setPlayers,
  addPlayer,
  removePlayer,
  updatePlayerCredits,
  updatePlayerActiveQuests,
  updatePlayerPosition,
  updatePlayerTimers,
  setCurrentPlayerSkills,
  updatePlayerCargoHold,
} from '../slices/playerSlice';
import { startCombat, updateCombat, setCombatResult } from '../slices/combatSlice';
import { startMining, updateMining, setMiningComplete } from '../slices/miningSlice';
import {
  setCurrentStation,
  clearStation,
  setStorage,
  setCargoHold,
  setRecipes,
  setCraftingJobs,
  addCraftingJob,
  removeCraftingJob,
  updateCraftingProgress,
  setQuests,
  setMarketOrders,
  addMarketOrder,
  updateMarketOrder,
  setError,
} from '../slices/stationSlice';
import { SocketEvent } from '@hexploration/shared';

let listenersInitialized = false;

export const setupSocketListeners = (store: any) => {
  if (listenersInitialized) return;
  listenersInitialized = true;
  
  // Установить callback, который будет вызван ПОСЛЕ создания socket
  socketService.setListenersCallback((socket) => {
    // Настроить слушателей Socket.io напрямую на socket
    socket.on(SocketEvent.CONNECT, () => {
      console.log('✅ Подключено к серверу');
      store.dispatch(setConnected(true));
    });

    socket.on(SocketEvent.DISCONNECT, () => {
      console.log('❌ Отключено от сервера');
      store.dispatch(setConnected(false));
    });

    socket.on(SocketEvent.AUTH_SUCCESS, (data: any) => {
      console.log('Аутентификация успешна:', data);
      store.dispatch(setCurrentPlayer(data.player));
      // Явно обновить навыки при подключении
      if (data.player?.skills) {
        store.dispatch(setCurrentPlayerSkills(data.player.skills));
      }
    });

    socket.on(SocketEvent.GAME_STATE, (data: any) => {
      console.log('Получено состояние игры:', data);
      store.dispatch(setGameState(data));
      
      if (data.players) {
        store.dispatch(setPlayers(data.players));
      }
    });

    socket.on(SocketEvent.GAME_UPDATE, (data: any) => {
      if (data.type === 'player_moved') {
        store.dispatch(updatePlayerPosition({
          playerId: data.playerId,
          position: data.position,
          moveTimer: data.moveTimer,
          canMove: data.canMove,
        }));
      }
      
      if (data.type === 'timer_expired') {
        store.dispatch(updatePlayerPosition({
          playerId: data.playerId,
          position: undefined, // Позиция не меняется
          moveTimer: data.moveTimer,
          canMove: data.canMove,
        }));
      }
      
      if (data.type === 'timers' && data.timers) {
        store.dispatch(updatePlayerTimers(data.timers));
      }
      
      // Обновление карты при колонизации, развитии, деградации или вторжении
      if ((data.type === 'colony_created' || data.type === 'colony_developed' || data.type === 'colony_decayed' || data.type === 'invasion_started' || data.type === 'invasion_cleared' || data.type === 'invasion_hex_cleared' || data.type === 'invasion_captured') && data.map) {
        console.log(`🏛️ Обновление карты: ${data.type}`, data);
        store.dispatch(updateMap(data.map));
        if (data.invasions) store.dispatch(setInvasions(data.invasions));
        // Если захвачена станция, на которой игрок сейчас — закрыть панель
        if (data.type === 'invasion_captured' && data.capturedHexKeys?.length) {
          const state = store.getState();
          const station = state?.station?.currentStation;
          const targetId = station?.location?.targetId;
          if (targetId && data.capturedHexKeys.some((hk: string) => targetId === `star-${hk}`)) {
            store.dispatch(clearStation());
          }
        }
      }
    });

    socket.on(SocketEvent.PLAYER_JOIN, (data: any) => {
      console.log('Игрок присоединился:', data.player);
      store.dispatch(addPlayer(data.player));
    });

    socket.on(SocketEvent.PLAYER_LEAVE, (data: any) => {
      console.log('Игрок вышел:', data.playerId);
      store.dispatch(removePlayer(data.playerId));
    });

    socket.on(SocketEvent.PLAYERS_LIST, (data: any) => {
      store.dispatch(setPlayers(data.players));
    });

    socket.on(SocketEvent.COLONIZE_SUCCESS, (data: any) => {
      console.log('✅ Система колонизирована:', data.coordinates);
    });

    socket.on(SocketEvent.COLONIZE_ERROR, (data: any) => {
      console.error('❌ Ошибка колонизации:', data.message);
      alert(`Ошибка: ${data.message}`);
    });

    socket.on(SocketEvent.DEVELOP_SUCCESS, (data: any) => {
      console.log('✅ Колония развита:', data.coordinates, 'threat:', data.threat);
    });

    socket.on(SocketEvent.DEVELOP_ERROR, (data: any) => {
      console.error('❌ Ошибка развития:', data.message);
      alert(`Ошибка: ${data.message}`);
    });

    socket.on(SocketEvent.COMBAT_START, (data: any) => {
      console.log('Бой начался:', data);
      store.dispatch(startCombat(data.combat));
    });

    // Обработчик для боя с ботом
    socket.on('combat:started', (data: any) => {
      console.log('🤖 Бой с ботом начался:', data);
      store.dispatch(startCombat(data.combat));
    });

    socket.on(SocketEvent.COMBAT_UPDATE, (data: any) => {
      store.dispatch(updateCombat(data.combat));
    });

    socket.on(SocketEvent.COMBAT_END, (data: any) => {
      console.log('Бой завершен:', data);
      // Сохраняем результат вместо немедленного закрытия
      store.dispatch(setCombatResult({ winner: data.winner, combat: data.combat }));
    });

    // Обработчик окончания боя с ботом
    socket.on(SocketEvent.COMBAT_JOIN_SUCCESS, (data: any) => {
      store.dispatch(startCombat(data.combat));
    });

    socket.on(SocketEvent.COMBAT_JOIN_ERROR, (data: any) => {
      console.error('Ошибка подключения к бою:', data.message);
    });

    socket.on('combat:ended', (data: any) => {
      console.log('🤖 Бой завершен, победитель:', data.winner);
      store.dispatch(setCombatResult({ winner: data.winner, combat: data.combat }));
      if (data.activeQuests) store.dispatch(updatePlayerActiveQuests(data.activeQuests));
    });

    socket.on(SocketEvent.MINING_STARTED, (data: { state: any }) => {
      store.dispatch(startMining(data.state));
    });

    socket.on(SocketEvent.MINING_UPDATE, (data: { state: any }) => {
      store.dispatch(updateMining(data.state));
    });

    socket.on(SocketEvent.MINING_COMPLETE, (data: { collected: any; cargoHold: any }) => {
      store.dispatch(setMiningComplete({ collected: data.collected }));
      if (data.cargoHold) store.dispatch(updatePlayerCargoHold(data.cargoHold));
    });

    socket.on(SocketEvent.MINING_ERROR, (data: { message: string }) => {
      console.error('Ошибка майнинга:', data.message);
      alert(data.message);
    });

    socket.on(SocketEvent.SKILLS_DATA, (data: { skills: any }) => {
      store.dispatch(setCurrentPlayerSkills(data.skills));
    });

    socket.on(SocketEvent.SKILLS_ERROR, (data: { message?: string }) => {
      console.error('Ошибка навыков:', data.message);
      if (data.message) alert(data.message);
    });

    // Станции
    socket.on(SocketEvent.STATION_DATA, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      } else {
        store.dispatch(setCurrentStation(data.station));
        store.dispatch(setStorage(data.station?.storage));
        store.dispatch(setCargoHold(data.cargoHold));
        if (data.craftingJobs) {
          store.dispatch(setCraftingJobs(data.craftingJobs));
        }
        if (data.quests) {
          store.dispatch(setQuests(data.quests));
        }
      }
    });

    socket.on(SocketEvent.STATION_STORAGE_DATA, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      } else {
        store.dispatch(setStorage(data.storage));
        store.dispatch(setCargoHold(data.cargoHold));
      }
    });

    socket.on(SocketEvent.STATION_CARGO_TRANSFER_SUCCESS, (data: any) => {
      store.dispatch(setStorage(data.storage));
      store.dispatch(setCargoHold(data.cargoHold));
    });

    socket.on(SocketEvent.CARGO_DISCARD_SUCCESS, (data: { cargoHold: any }) => {
      if (data.cargoHold) store.dispatch(updatePlayerCargoHold(data.cargoHold));
    });

    socket.on(SocketEvent.CARGO_DISCARD_ERROR, (data: { message?: string }) => {
      if (data.message) alert(data.message);
    });

    socket.on(SocketEvent.STATION_CARGO_TRANSFER_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });

    socket.on(SocketEvent.STATION_SHIP_STORE_SUCCESS, (data: any) => {
      store.dispatch(setStorage(data.storage));
    });

    socket.on(SocketEvent.STATION_SHIP_STORE_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });

    socket.on(SocketEvent.STATION_SHIP_RETRIEVE_SUCCESS, (data: any) => {
      store.dispatch(setStorage(data.storage));
    });

    socket.on(SocketEvent.STATION_SHIP_RETRIEVE_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });

    socket.on(SocketEvent.STATION_CRAFT_RECIPES_DATA, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      } else {
        store.dispatch(setRecipes(data.recipes));
      }
    });

    socket.on(SocketEvent.STATION_CRAFT_START_SUCCESS, (data: any) => {
      store.dispatch(setStorage(data.storage));
      // Добавить задачу крафта в список активных
      if (data.job) {
        store.dispatch(addCraftingJob(data.job));
      }
    });

    socket.on(SocketEvent.STATION_CRAFT_START_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });

    socket.on(SocketEvent.STATION_CRAFT_PROGRESS, (data: any) => {
      console.log('[Client] Получено обновление прогресса:', data);
      store.dispatch(updateCraftingProgress({
        jobId: data.jobId,
        progress: data.progress,
      }));
    });

    socket.on(SocketEvent.STATION_CRAFT_COMPLETE, (data: any) => {
      store.dispatch(removeCraftingJob(data.jobId));
      // Обновить хранилище после завершения крафта
      if (data.storage) {
        store.dispatch(setStorage(data.storage));
      }
    });

    socket.on(SocketEvent.STATION_CRAFT_CANCEL_SUCCESS, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      } else {
        store.dispatch(setStorage(data.storage));
      }
    });

    socket.on(SocketEvent.STATION_MARKET_ORDERS_DATA, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      } else {
        store.dispatch(setMarketOrders(data.orders));
      }
    });

    socket.on(SocketEvent.STATION_MARKET_ORDER_CREATE_SUCCESS, (data: any) => {
      store.dispatch(addMarketOrder(data.order));
    });

    socket.on(SocketEvent.STATION_MARKET_ORDER_CREATE_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });

    socket.on(SocketEvent.STATION_MARKET_ORDER_CANCEL_SUCCESS, (data: any) => {
      if (data.error) {
        store.dispatch(setError(data.error));
      }
    });

    socket.on(SocketEvent.STATION_MARKET_ORDER_EXECUTE_SUCCESS, (data: any) => {
      store.dispatch(updateMarketOrder(data.order));
      if (data.playerCredits !== undefined) {
        store.dispatch(updatePlayerCredits(data.playerCredits));
      }
    });

    socket.on(SocketEvent.QUEST_LIST_DATA, (data: { quests: any[] }) => {
      if (data.quests) store.dispatch(setQuests(data.quests));
    });

    socket.on(SocketEvent.STATION_WALLET_SUCCESS, (data: any) => {
      if (data.storage) store.dispatch(setStorage(data.storage));
      if (data.playerCredits !== undefined) store.dispatch(updatePlayerCredits(data.playerCredits));
    });

    socket.on(SocketEvent.QUEST_CREATE_SUCCESS, (data: any) => {
      if (data.quests) store.dispatch(setQuests(data.quests));
      if (data.storage) store.dispatch(setStorage(data.storage));
    });

    socket.on(SocketEvent.QUEST_TAKE_SUCCESS, (data: any) => {
      if (data.activeQuests) store.dispatch(updatePlayerActiveQuests(data.activeQuests));
    });

    socket.on(SocketEvent.QUEST_TURN_IN_SUCCESS, (data: any) => {
      if (data.playerCredits !== undefined) store.dispatch(updatePlayerCredits(data.playerCredits));
      if (data.activeQuests) store.dispatch(updatePlayerActiveQuests(data.activeQuests));
      if (data.storage) store.dispatch(setStorage(data.storage));
    });

    socket.on(SocketEvent.SYSTEM_COLLECT_SUCCESS, (data: any) => {
      if (data.playerCredits !== undefined) {
        store.dispatch(updatePlayerCredits(data.playerCredits));
      }
    });

    socket.on(SocketEvent.SYSTEM_BUILD_SUCCESS, (data: any) => {
      if (data.playerCredits !== undefined) {
        store.dispatch(updatePlayerCredits(data.playerCredits));
      }
    });

    socket.on(SocketEvent.STATION_MARKET_ORDER_EXECUTE_ERROR, (data: any) => {
      store.dispatch(setError(data.message));
    });
  });
};

export const socketMiddleware: Middleware = (_store) => {
  // Middleware просто передает actions дальше
  return (next) => (action) => {
    return next(action);
  };
};

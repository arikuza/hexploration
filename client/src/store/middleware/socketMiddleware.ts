import { Middleware } from '@reduxjs/toolkit';
import { socketService } from '../../services/socketService';
import { setGameState, updateMap, setConnected } from '../slices/gameSlice';
import {
  setCurrentPlayer,
  setPlayers,
  addPlayer,
  removePlayer,
  updatePlayerPosition,
  updatePlayerTimers,
  setCurrentPlayerSkills,
} from '../slices/playerSlice';
import { startCombat, updateCombat, setCombatResult } from '../slices/combatSlice';
import {
  setCurrentStation,
  setStorage,
  setCargoHold,
  setRecipes,
  setCraftingJobs,
  addCraftingJob,
  removeCraftingJob,
  updateCraftingProgress,
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
      
      // Обновление карты при колонизации или развитии
      if ((data.type === 'colony_created' || data.type === 'colony_developed') && data.map) {
        console.log(`🏛️ Обновление карты: ${data.type}`, data);
        store.dispatch(updateMap(data.map));
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
    socket.on('combat:ended', (data: any) => {
      console.log('🤖 Бой завершен, победитель:', data.winner);
      // Сохраняем результат вместо немедленного закрытия
      store.dispatch(setCombatResult({ winner: data.winner, combat: data.combat }));
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
        // Установить активные задачи крафта для этой станции
        if (data.craftingJobs) {
          store.dispatch(setCraftingJobs(data.craftingJobs));
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

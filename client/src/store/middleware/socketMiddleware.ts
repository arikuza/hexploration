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
  });
};

export const socketMiddleware: Middleware = (_store) => {
  // Middleware просто передает actions дальше
  return (next) => (action) => {
    return next(action);
  };
};

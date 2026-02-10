import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import playerReducer from './slices/playerSlice';
import combatReducer from './slices/combatSlice';
import authReducer from './slices/authSlice';
import stationReducer from './slices/stationSlice';
import { socketMiddleware } from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    player: playerReducer,
    combat: combatReducer,
    station: stationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем проверку для Socket.io
        ignoredActions: ['socket/connected', 'socket/disconnected'],
        ignoredPaths: ['socket.instance'],
      },
    }).concat(socketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

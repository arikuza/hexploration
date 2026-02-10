import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GamePhase, HexCell } from '@hexploration/shared';

interface GameState {
  id: string | null;
  phase: GamePhase;
  map: {
    radius: number;
    cells: HexCell[];
  } | null;
  connected: boolean;
}

const initialState: GameState = {
  id: null,
  phase: GamePhase.LOBBY,
  map: null,
  connected: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameState: (state, action: PayloadAction<any>) => {
      state.id = action.payload.id;
      state.phase = action.payload.phase;
      state.map = action.payload.map;
    },
    updateMap: (state, action: PayloadAction<any>) => {
      // Обновить только карту, не трогая остальное состояние
      state.map = action.payload;
    },
    updateGameState: (_state, _action: PayloadAction<any>) => {
      // Обновления игрового состояния (если понадобятся)
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
  },
});

export const { setGameState, updateMap, updateGameState, setConnected } = gameSlice.actions;
export default gameSlice.reducer;

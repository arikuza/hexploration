import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GamePhase, HexCell } from '@hexploration/shared';

interface InvasionInfo {
  id: string;
  sourceHexKey: string;
  neighborHexKeys: string[];
  enemyCountPerHex: Record<string, number>;
}

interface GameState {
  id: string | null;
  phase: GamePhase;
  map: {
    radius: number;
    cells: HexCell[];
  } | null;
  invasions: InvasionInfo[];
  activeCombats: Array<{ combatId: string; hexKey: string; combatType: string; participantsCount: number; maxParticipants?: number }>;
  connected: boolean;
}

const initialState: GameState = {
  id: null,
  phase: GamePhase.LOBBY,
  map: null,
  invasions: [],
  activeCombats: [],
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
      state.invasions = action.payload.invasions ?? [];
    },
    setInvasions: (state, action: PayloadAction<InvasionInfo[]>) => {
      state.invasions = action.payload;
    },
    setActiveCombats: (state, action: PayloadAction<Array<{ combatId: string; hexKey: string; combatType: string; participantsCount: number; maxParticipants?: number }>>) => {
      state.activeCombats = action.payload;
    },
    updateMap: (state, action: PayloadAction<any>) => {
      if (action.payload?.cells) state.map = action.payload;
    },
    updateGameState: (_state, _action: PayloadAction<any>) => {
      // Обновления игрового состояния (если понадобятся)
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
  },
});

export const { setGameState, setInvasions, setActiveCombats, updateMap, updateGameState, setConnected } = gameSlice.actions;
export default gameSlice.reducer;

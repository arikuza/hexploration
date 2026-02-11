import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Player, PlayerSkills, CargoHold } from '@hexploration/shared';

interface PlayerState {
  currentPlayer: Player | null;
  players: Player[];
}

const initialState: PlayerState = {
  currentPlayer: null,
  players: [],
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setCurrentPlayer: (state, action: PayloadAction<Player>) => {
      state.currentPlayer = action.payload;
    },
    setPlayers: (state, action: PayloadAction<Player[]>) => {
      state.players = action.payload;
    },
    addPlayer: (state, action: PayloadAction<Player>) => {
      const exists = state.players.find(p => p.id === action.payload.id);
      if (!exists) {
        state.players.push(action.payload);
      }
    },
    removePlayer: (state, action: PayloadAction<string>) => {
      state.players = state.players.filter(p => p.id !== action.payload);
    },
    updatePlayerCredits: (state, action: PayloadAction<number>) => {
      if (state.currentPlayer) {
        state.currentPlayer.credits = action.payload;
      }
    },
    updatePlayerActiveQuests: (state, action: PayloadAction<Array<{ questId: string; progress: number; kills?: number; delivered?: number }>>) => {
      if (state.currentPlayer) {
        state.currentPlayer.activeQuests = action.payload;
      }
    },
    updatePlayerPosition: (state, action: PayloadAction<{ 
      playerId: string; 
      position?: any;
      moveTimer?: number;
      canMove?: boolean;
    }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        if (action.payload.position !== undefined) {
          player.position = action.payload.position;
        }
        if (action.payload.moveTimer !== undefined) {
          player.moveTimer = action.payload.moveTimer;
        }
        if (action.payload.canMove !== undefined) {
          player.canMove = action.payload.canMove;
        }
      }
      if (state.currentPlayer?.id === action.payload.playerId) {
        if (action.payload.position !== undefined) {
          state.currentPlayer.position = action.payload.position;
        }
        if (action.payload.moveTimer !== undefined) {
          state.currentPlayer.moveTimer = action.payload.moveTimer;
        }
        if (action.payload.canMove !== undefined) {
          state.currentPlayer.canMove = action.payload.canMove;
        }
      }
    },
    updatePlayerTimers: (state, action: PayloadAction<Array<{
      playerId: string;
      moveTimer: number;
      canMove: boolean;
    }>>) => {
      action.payload.forEach(timer => {
        const player = state.players.find(p => p.id === timer.playerId);
        if (player) {
          player.moveTimer = timer.moveTimer;
          player.canMove = timer.canMove;
        }
        if (state.currentPlayer?.id === timer.playerId) {
          state.currentPlayer.moveTimer = timer.moveTimer;
          state.currentPlayer.canMove = timer.canMove;
        }
      });
    },
    setCurrentPlayerSkills: (state, action: PayloadAction<PlayerSkills | null>) => {
      if (state.currentPlayer) {
        state.currentPlayer.skills = action.payload ?? undefined;
      }
    },
    updatePlayerCargoHold: (state, action: PayloadAction<CargoHold>) => {
      if (state.currentPlayer?.ship) {
        state.currentPlayer.ship.cargoHold = action.payload;
      }
    },
  },
});

export const {
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
} = playerSlice.actions;
export default playerSlice.reducer;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MiningState } from '@hexploration/shared';

interface MiningSliceState {
  activeMining: MiningState | null;
  inMining: boolean;
  miningComplete: { collected: Array<{ itemId: string; quantity: number }> } | null;
}

const initialState: MiningSliceState = {
  activeMining: null,
  inMining: false,
  miningComplete: null,
};

const miningSlice = createSlice({
  name: 'mining',
  initialState,
  reducers: {
    startMining: (state, action: PayloadAction<MiningState>) => {
      state.activeMining = action.payload;
      state.inMining = true;
      state.miningComplete = null;
    },
    updateMining: (state, action: PayloadAction<MiningState>) => {
      state.activeMining = action.payload;
    },
    setMiningComplete: (state, action: PayloadAction<{ collected: Array<{ itemId: string; quantity: number }> }>) => {
      state.miningComplete = action.payload;
    },
    endMining: (state) => {
      state.activeMining = null;
      state.inMining = false;
      state.miningComplete = null;
    },
  },
});

export const { startMining, updateMining, setMiningComplete, endMining } = miningSlice.actions;
export default miningSlice.reducer;

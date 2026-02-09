import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CombatState } from '@hexploration/shared';

interface CombatSliceState {
  activeCombat: CombatState | null;
  inCombat: boolean;
  combatResult: { winner: string; combat: CombatState } | null;
}

const initialState: CombatSliceState = {
  activeCombat: null,
  inCombat: false,
  combatResult: null,
};

const combatSlice = createSlice({
  name: 'combat',
  initialState,
  reducers: {
    startCombat: (state, action: PayloadAction<CombatState>) => {
      state.activeCombat = action.payload;
      state.inCombat = true;
      state.combatResult = null; // Очистить предыдущий результат
    },
    updateCombat: (state, action: PayloadAction<CombatState>) => {
      state.activeCombat = action.payload;
    },
    setCombatResult: (state, action: PayloadAction<{ winner: string; combat: CombatState }>) => {
      state.combatResult = action.payload;
      // НЕ закрываем бой, только сохраняем результат
    },
    endCombat: (state) => {
      state.activeCombat = null;
      state.inCombat = false;
      state.combatResult = null;
    },
  },
});

export const { startCombat, updateCombat, setCombatResult, endCombat } = combatSlice.actions;
export default combatSlice.reducer;

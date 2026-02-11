import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  SpaceStructure,
  StationStorage,
  CargoHold,
  Recipe,
  CraftingJob,
  MarketOrder,
} from '@hexploration/shared';
import type { Quest } from '@hexploration/shared';

interface StationState {
  currentStation: SpaceStructure | null;
  storage: StationStorage | null;
  cargoHold: CargoHold | null;
  recipes: Recipe[];
  craftingJobs: CraftingJob[];
  marketOrders: MarketOrder[];
  quests: Quest[];
  loading: boolean;
  error: string | null;
}

const initialState: StationState = {
  currentStation: null,
  storage: null,
  cargoHold: null,
  recipes: [],
  craftingJobs: [],
  marketOrders: [],
  quests: [],
  loading: false,
  error: null,
};

const stationSlice = createSlice({
  name: 'station',
  initialState,
  reducers: {
    setCurrentStation: (state, action: PayloadAction<SpaceStructure | null>) => {
      state.currentStation = action.payload;
    },
    setStorage: (state, action: PayloadAction<StationStorage | null>) => {
      state.storage = action.payload;
    },
    setCargoHold: (state, action: PayloadAction<CargoHold | null>) => {
      state.cargoHold = action.payload;
    },
    setRecipes: (state, action: PayloadAction<Recipe[]>) => {
      state.recipes = action.payload;
    },
    setCraftingJobs: (state, action: PayloadAction<CraftingJob[]>) => {
      state.craftingJobs = action.payload;
    },
    addCraftingJob: (state, action: PayloadAction<CraftingJob>) => {
      const existingIndex = state.craftingJobs.findIndex(j => j.id === action.payload.id);
      if (existingIndex >= 0) {
        state.craftingJobs[existingIndex] = action.payload;
      } else {
        state.craftingJobs.push(action.payload);
      }
    },
    removeCraftingJob: (state, action: PayloadAction<string>) => {
      state.craftingJobs = state.craftingJobs.filter(j => j.id !== action.payload);
    },
    updateCraftingProgress: (state, action: PayloadAction<{ jobId: string; progress: number }>) => {
      const job = state.craftingJobs.find(j => j.id === action.payload.jobId);
      if (job) {
        console.log(`[Redux] Обновление прогресса задачи ${action.payload.jobId}: ${job.progress}% -> ${action.payload.progress}%`);
        job.progress = action.payload.progress;
      } else {
        console.warn(`[Redux] Задача ${action.payload.jobId} не найдена для обновления прогресса`);
      }
    },
    setMarketOrders: (state, action: PayloadAction<MarketOrder[]>) => {
      state.marketOrders = action.payload;
    },
    addMarketOrder: (state, action: PayloadAction<MarketOrder>) => {
      state.marketOrders.push(action.payload);
    },
    removeMarketOrder: (state, action: PayloadAction<string>) => {
      state.marketOrders = state.marketOrders.filter(o => o.id !== action.payload);
    },
    setQuests: (state, action: PayloadAction<Quest[]>) => {
      state.quests = action.payload;
    },
    updateMarketOrder: (state, action: PayloadAction<MarketOrder>) => {
      const index = state.marketOrders.findIndex(o => o.id === action.payload.id);
      if (index >= 0) {
        state.marketOrders[index] = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearStation: (state) => {
      state.currentStation = null;
      state.storage = null;
      state.cargoHold = null;
      state.recipes = [];
      state.craftingJobs = [];
      state.marketOrders = [];
      state.quests = [];
      state.error = null;
    },
  },
});

export const {
  setCurrentStation,
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
  removeMarketOrder,
  updateMarketOrder,
  setLoading,
  setError,
  clearStation,
} = stationSlice.actions;

export default stationSlice.reducer;

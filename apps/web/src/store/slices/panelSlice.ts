import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type OverviewRange = "TODAY" | "WEEK";

export type PanelNotice = {
  tone: "success" | "error" | "info";
  text: string;
};

export type PanelUiState = {
  overviewRange: OverviewRange;
  selectedOrganizerEventId: string;
  showWeatherCard: boolean;
  notice: PanelNotice | null;
};

const initialState: PanelUiState = {
  overviewRange: "WEEK",
  selectedOrganizerEventId: "",
  showWeatherCard: true,
  notice: null,
};

const panelSlice = createSlice({
  name: "panel",
  initialState,
  reducers: {
    setOverviewRange(state, action: PayloadAction<OverviewRange>) {
      state.overviewRange = action.payload;
    },
    setSelectedOrganizerEventId(state, action: PayloadAction<string>) {
      state.selectedOrganizerEventId = action.payload;
    },
    setShowWeatherCard(state, action: PayloadAction<boolean>) {
      state.showWeatherCard = action.payload;
    },
    dismissWeatherCard(state) {
      state.showWeatherCard = false;
    },
    setNotice(state, action: PayloadAction<PanelNotice>) {
      state.notice = action.payload;
    },
    clearNotice(state) {
      state.notice = null;
    },
  },
});

export const {
  setOverviewRange,
  setSelectedOrganizerEventId,
  setShowWeatherCard,
  dismissWeatherCard,
  setNotice,
  clearNotice,
} = panelSlice.actions;
export const panelReducer = panelSlice.reducer;

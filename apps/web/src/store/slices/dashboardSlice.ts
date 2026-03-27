import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type DashboardUiState = {
  searchText: string;
  isSidebarOpen: boolean;
};

const initialState: DashboardUiState = {
  searchText: "",
  isSidebarOpen: false,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setDashboardSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.isSidebarOpen = action.payload;
    },
    toggleSidebar(state) {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    closeSidebar(state) {
      state.isSidebarOpen = false;
    },
  },
});

export const { setDashboardSearchText, setSidebarOpen, toggleSidebar, closeSidebar } = dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;

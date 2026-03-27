import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type TicketsUiState = {
  selectedTicketId: string | null;
  copyMessage: string;
};

const initialState: TicketsUiState = {
  selectedTicketId: null,
  copyMessage: "",
};

const ticketsSlice = createSlice({
  name: "tickets",
  initialState,
  reducers: {
    setSelectedTicketId(state, action: PayloadAction<string | null>) {
      state.selectedTicketId = action.payload;
    },
    setCopyMessage(state, action: PayloadAction<string>) {
      state.copyMessage = action.payload;
    },
    clearCopyMessage(state) {
      state.copyMessage = "";
    },
  },
});

export const { setSelectedTicketId, setCopyMessage, clearCopyMessage } = ticketsSlice.actions;
export const ticketsReducer = ticketsSlice.reducer;

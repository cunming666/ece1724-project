import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { dashboardReducer, type DashboardUiState } from "./slices/dashboardSlice";
import { panelReducer, type OverviewRange, type PanelUiState } from "./slices/panelSlice";
import { ticketsReducer, type TicketsUiState } from "./slices/ticketsSlice";

const WORKSPACE_STATE_KEY = "workspace-ui-state";

type PersistedWorkspaceState = {
  dashboard?: Partial<Pick<DashboardUiState, "searchText">>;
  panel?: Partial<Pick<PanelUiState, "overviewRange" | "selectedOrganizerEventId" | "showWeatherCard">>;
  tickets?: Partial<Pick<TicketsUiState, "selectedTicketId">>;
};

function isOverviewRange(value: string | null | undefined): value is OverviewRange {
  return value === "TODAY" || value === "WEEK";
}

function loadPersistedWorkspaceState(): Partial<{
  dashboard: DashboardUiState;
  panel: PanelUiState;
  tickets: TicketsUiState;
}> | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STATE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as PersistedWorkspaceState;
    const dashboardSearchText =
      parsed.dashboard && typeof parsed.dashboard.searchText === "string" ? parsed.dashboard.searchText : "";
    const panelOverviewRange = isOverviewRange(parsed.panel?.overviewRange) ? parsed.panel.overviewRange : "WEEK";
    const selectedOrganizerEventId =
      parsed.panel && typeof parsed.panel.selectedOrganizerEventId === "string" ? parsed.panel.selectedOrganizerEventId : "";
    const showWeatherCard =
      parsed.panel && typeof parsed.panel.showWeatherCard === "boolean" ? parsed.panel.showWeatherCard : true;
    const selectedTicketId =
      parsed.tickets && (typeof parsed.tickets.selectedTicketId === "string" || parsed.tickets.selectedTicketId === null)
        ? parsed.tickets.selectedTicketId
        : null;

    return {
      dashboard: {
        searchText: dashboardSearchText,
        isSidebarOpen: false,
      },
      panel: {
        overviewRange: panelOverviewRange,
        selectedOrganizerEventId,
        showWeatherCard,
        notice: null,
      },
      tickets: {
        selectedTicketId,
        copyMessage: "",
      },
    };
  } catch {
    return undefined;
  }
}

const appReducer = combineReducers({
  dashboard: dashboardReducer,
  panel: panelReducer,
  tickets: ticketsReducer,
});

const rootReducer: typeof appReducer = (state, action) => {
  if (action.type === "app/resetState") {
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  preloadedState: loadPersistedWorkspaceState(),
});

store.subscribe(() => {
  if (typeof window === "undefined") {
    return;
  }

  const state = store.getState();
  const payload: PersistedWorkspaceState = {
    dashboard: {
      searchText: state.dashboard.searchText,
    },
    panel: {
      overviewRange: state.panel.overviewRange,
      selectedOrganizerEventId: state.panel.selectedOrganizerEventId,
      showWeatherCard: state.panel.showWeatherCard,
    },
    tickets: {
      selectedTicketId: state.tickets.selectedTicketId,
    },
  };

  try {
    window.localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
});

export const resetClientState = () => ({ type: "app/resetState" } as const);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

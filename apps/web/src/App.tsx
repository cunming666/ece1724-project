import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { getSessionToken } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { AttendeeTicketsPage } from "./pages/AttendeeTicketsPage";
import { ControlPanelPage } from "./pages/ControlPanelPage";
import { DashboardPage } from "./pages/DashboardPage";

function RootRedirect() {
  const hasToken = Boolean(getSessionToken());
  return <Navigate to={hasToken ? "/panel" : "/auth"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/panel" element={<ControlPanelPage />} />
        <Route path="/panel/tickets" element={<AttendeeTicketsPage />} />
        <Route path="/panel/events/:eventId/dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { RequireAuth } from "./components/RequireAuth";
import { AuthPage } from "./pages/AuthPage";
import { AttendeeTicketsPage } from "./pages/AttendeeTicketsPage";
import { ControlPanelPage } from "./pages/ControlPanelPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StaffCheckinPage } from "./pages/StaffCheckinPage";

function RootRedirect() {
  return <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/panel" element={<ControlPanelPage />} />
          <Route path="/panel/organizer" element={<ControlPanelPage />} />
          <Route path="/panel/staff" element={<ControlPanelPage />} />
          <Route path="/panel/events" element={<ControlPanelPage />} />
          <Route path="/panel/tickets" element={<AttendeeTicketsPage />} />
          <Route path="/panel/events/:eventId/checkin" element={<StaffCheckinPage />} />
          <Route path="/panel/events/:eventId/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

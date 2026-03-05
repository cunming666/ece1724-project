import { Navigate, Outlet } from "react-router-dom";
import { clearSessionToken, getSessionToken } from "../lib/api";
import { useSessionQuery } from "../lib/session";

function FullPageLoading() {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel rounded-2xl px-6 py-4 text-sm font-semibold text-slate-700">Loading session...</div>
    </main>
  );
}

export function RequireAuth() {
  const token = getSessionToken();
  const sessionQuery = useSessionQuery(Boolean(token));

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (sessionQuery.isLoading) {
    return <FullPageLoading />;
  }

  if (sessionQuery.isError) {
    clearSessionToken();
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}

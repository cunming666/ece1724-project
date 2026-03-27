import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Pill } from "./ui";
import { useSessionQuery } from "../lib/session";
import { getPanelNavEntries, panelSectionFromPath } from "../lib/panelNav";

function getPageTitle(pathname: string): string {
  if (pathname === "/panel/organizer") {
    return "Organizer Studio";
  }
  if (pathname === "/panel/staff") {
    return "Staff Console";
  }
  if (pathname === "/panel/events") {
    return "Published Event Board";
  }
  if (pathname === "/panel/tickets") {
    return "Ticket Wallet";
  }
  if (pathname.endsWith("/checkin")) {
    return "Staff Check-in Console";
  }
  if (pathname.endsWith("/dashboard")) {
    return "Live Event Dashboard";
  }
  return "Control Panel";
}

function initials(name?: string): string {
  if (!name) {
    return "U";
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "U";
  }

  const first = parts[0] ?? "";
  const second = parts[1] ?? "";

  if (parts.length === 1) {
    return first.slice(0, 1).toUpperCase();
  }

  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
}

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionQuery = useSessionQuery(true);
  const user = sessionQuery.data;
  const role = user?.role;
  const [searchText, setSearchText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeSection = panelSectionFromPath(location.pathname);
  const menu = getPanelNavEntries(role);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return;
    }

    if (/^[a-z0-9]{10,}$/i.test(keyword)) {
      navigate(`/panel/events/${keyword}/dashboard`);
      return;
    }

    if (keyword.includes("organizer") || keyword.includes("studio")) {
      navigate("/panel/organizer");
      return;
    }
    if (keyword.includes("staff") || keyword.includes("checkin") || keyword.includes("check-in")) {
      navigate("/panel/staff");
      return;
    }
    if (keyword.includes("event") || keyword.includes("board") || keyword.includes("dashboard")) {
      navigate("/panel/events");
      return;
    }
    if (keyword.includes("ticket")) {
      navigate("/panel/tickets");
      return;
    }

    navigate("/panel");
  }

  const topbarHint = useMemo(() => {
    if (location.pathname.endsWith("/dashboard")) {
      return "Real-time event metrics and check-in activity";
    }
    if (location.pathname.endsWith("/checkin")) {
      return "Operational check-in tools for on-site staff";
    }
    return "Use the left menu to switch between dashboard modules";
  }, [location.pathname]);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-frame">
        <aside className={`dashboard-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
          <Link to="/panel" className="dashboard-brand" onClick={() => setIsSidebarOpen(false)}>
            <span className="dashboard-brand-mark">EC</span>
            <span className="dashboard-brand-text">Event Console</span>
          </Link>

          <p className="dashboard-menu-title">Menu</p>
          <nav className="dashboard-nav" id="panel-sidebar-nav" aria-label="Main" data-testid="panel-sidebar-nav">
            {menu.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`dashboard-nav-item ${activeSection === item.section ? "is-active" : ""}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="dashboard-side-note">
            <p className="dashboard-side-note-title">Tip</p>
            <p className="dashboard-side-note-text">
              Open Event Board first, then enter event-specific check-in and live dashboard pages from each event card.
            </p>
          </div>
        </aside>

        <button
          type="button"
          className={`dashboard-overlay ${isSidebarOpen ? "is-open" : ""}`}
          aria-label="Close menu"
          onClick={() => setIsSidebarOpen(false)}
        />

        <section className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="dashboard-topbar-left">
              <button
                type="button"
                className="dashboard-menu-toggle"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                aria-expanded={isSidebarOpen}
                aria-controls="panel-sidebar-nav"
              >
                Menu
              </button>

              <p className="dashboard-topbar-kicker">ECE1724 Project 3</p>
              <h1 className="dashboard-topbar-title">{getPageTitle(location.pathname)}</h1>
              <p className="dashboard-topbar-subtitle">{topbarHint}</p>
            </div>

            <div className="dashboard-topbar-right">
              <form className="dashboard-search" role="search" onSubmit={handleSearchSubmit}>
                <input
                  placeholder="Try: organizer / staff / events / tickets / eventId"
                  aria-label="Search modules"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </form>

              <div className="dashboard-user-chip" aria-live="polite">
                <span className="dashboard-user-avatar">{initials(user?.name)}</span>
                <div>
                  <p className="dashboard-user-name">{user?.name ?? "User"}</p>
                  <div className="dashboard-user-meta">
                    <Pill tone="slate">{user?.role ?? "UNKNOWN"}</Pill>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="dashboard-outlet">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}

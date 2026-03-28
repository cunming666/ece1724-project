import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AccountDialog } from "./AccountDialog";
import { Button, Pill } from "./ui";
import { apiFetch, clearSessionToken } from "../lib/api";
import { useSessionQuery } from "../lib/session";
import { getPanelNavEntries, panelSectionFromPath } from "../lib/panelNav";
import { SESSION_QUERY_KEY } from "../lib/session";
import { resetClientState } from "../store";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { closeSidebar, setDashboardSearchText, toggleSidebar } from "../store/slices/dashboardSlice";

type AccountFeedback = {
  tone: "success" | "error";
  text: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPageTitle(pathname: string): string {
  if (pathname === "/panel/organizer") {
    return "Organizer Studio";
  }
  if (pathname === "/panel/staff") {
    return "Staff Console";
  }
  if (pathname === "/panel/events") {
    return "Event Board";
  }
  if (pathname === "/panel/tickets") {
    return "My Tickets";
  }
  if (pathname.endsWith("/attendees")) {
    return "Roster";
  }
  if (pathname.endsWith("/checkin")) {
    return "Check-in";
  }
  if (pathname.endsWith("/dashboard")) {
    return "Event Dashboard";
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
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const sessionQuery = useSessionQuery(true);
  const user = sessionQuery.data;
  const role = user?.role;
  const searchText = useAppSelector((state) => state.dashboard.searchText);
  const isSidebarOpen = useAppSelector((state) => state.dashboard.isSidebarOpen);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<AccountFeedback | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<AccountFeedback | null>(null);

  const activeSection = panelSectionFromPath(location.pathname);
  const menu = getPanelNavEntries(role);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  function openAccountDialog() {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setProfileMessage(null);
    setPasswordMessage(null);
    setIsAccountDialogOpen(true);
  }

  function closeAccountDialog() {
    setIsAccountDialogOpen(false);
  }

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profileName.trim()) {
        throw new Error("Please enter your name.");
      }
      if (!profileEmail.trim()) {
        throw new Error("Please enter your email.");
      }
      const normalizedEmail = profileEmail.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Please enter a valid email address.");
      }

      return apiFetch<{
        message: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: "ORGANIZER" | "STAFF" | "ATTENDEE";
        };
      }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName.trim(),
          email: normalizedEmail,
        }),
      });
    },
    onSuccess: (payload) => {
      setProfileName(payload.user.name);
      setProfileEmail(payload.user.email);
      setProfileMessage({
        tone: "success",
        text: payload.message || "Account updated successfully.",
      });
      queryClient.setQueryData(SESSION_QUERY_KEY, payload.user);
    },
    onError: (error: Error) => {
      setProfileMessage({
        tone: "error",
        text: error.message,
      });
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword.trim()) {
        throw new Error("Please enter your current password.");
      }
      if (!newPassword.trim()) {
        throw new Error("Please enter a new password.");
      }
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters.");
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error("New password and confirm password do not match.");
      }

      return apiFetch<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
    },
    onSuccess: (payload) => {
      setPasswordMessage({
        tone: "success",
        text: payload.message || "Password updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      window.setTimeout(() => {
        setIsAccountDialogOpen(false);
      }, 600);
    },
    onError: (error: Error) => {
      setPasswordMessage({
        tone: "error",
        text: error.message,
      });
    },
  });

  const signOut = useMutation({
    mutationFn: () => apiFetch("/auth/sign-out", { method: "POST" }),
    onSuccess: () => {
      clearSessionToken();
      dispatch(resetClientState());
      queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
      navigate("/auth", { replace: true });
    },
    onError: (error: Error) => {
      openAccountDialog();
      setProfileMessage({
        tone: "error",
        text: error.message,
      });
    },
  });

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
    if (keyword.includes("roster") || keyword.includes("attendee")) {
      navigate("/panel/events");
      return;
    }
    if (keyword.includes("ticket")) {
      navigate("/panel/tickets");
      return;
    }

    navigate("/panel");
    dispatch(closeSidebar());
  }

  const topbarHint = useMemo(() => {
    if (location.pathname.endsWith("/attendees")) {
      return "View the full attendee list and ticket status.";
    }
    if (location.pathname.endsWith("/dashboard")) {
      return "View attendance and recent check-ins.";
    }
    if (location.pathname.endsWith("/checkin")) {
      return "Scan tickets or enter a ticket ID.";
    }
    return "Use the menu to switch pages.";
  }, [location.pathname]);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-frame">
        <aside className={`dashboard-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
          <Link to="/panel" className="dashboard-brand" onClick={() => dispatch(closeSidebar())}>
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
                onClick={() => dispatch(closeSidebar())}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="dashboard-side-note">
            <p className="dashboard-side-note-title">Tip</p>
            <p className="dashboard-side-note-text">
              Open an event to access its dashboard and check-in page.
            </p>
          </div>
        </aside>

        <button
          type="button"
          className={`dashboard-overlay ${isSidebarOpen ? "is-open" : ""}`}
          aria-label="Close menu"
          onClick={() => dispatch(closeSidebar())}
        />

        <section className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="dashboard-topbar-left">
              <button
                type="button"
                className="dashboard-menu-toggle"
                onClick={() => dispatch(toggleSidebar())}
                aria-expanded={isSidebarOpen}
                aria-controls="panel-sidebar-nav"
              >
                Menu
              </button>

              <p className="dashboard-topbar-kicker">ECE1724 Project</p>
              <h1 className="dashboard-topbar-title">{getPageTitle(location.pathname)}</h1>
              <p className="dashboard-topbar-subtitle">{topbarHint}</p>
            </div>

            <div className="dashboard-topbar-right">
              <form className="dashboard-search" role="search" onSubmit={handleSearchSubmit}>
                <input
                  placeholder="Search pages or event ID"
                  aria-label="Search modules"
                  value={searchText}
                  onChange={(event) => dispatch(setDashboardSearchText(event.target.value))}
                />
              </form>

              <div className="dashboard-topbar-actions">
                <Button
                  variant="ghost"
                  onClick={openAccountDialog}
                >
                  Account
                </Button>
                <Button variant="secondary" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
                  {signOut.isPending ? "Signing out..." : "Sign Out"}
                </Button>
              </div>

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

      <AccountDialog
        open={isAccountDialogOpen}
        user={user}
        profileName={profileName}
        profileEmail={profileEmail}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmNewPassword={confirmNewPassword}
        profileMessage={profileMessage}
        passwordMessage={passwordMessage}
        isProfileSubmitting={updateProfile.isPending}
        isPasswordSubmitting={changePassword.isPending}
        onProfileNameChange={setProfileName}
        onProfileEmailChange={setProfileEmail}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmNewPasswordChange={setConfirmNewPassword}
        onProfileSubmit={() => updateProfile.mutate()}
        onPasswordSubmit={() => changePassword.mutate()}
        onClose={closeAccountDialog}
      />
    </div>
  );
}

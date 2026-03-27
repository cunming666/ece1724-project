import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill } from "../components/ui";
import { apiFetch, clearSessionToken } from "../lib/api";
import { SESSION_QUERY_KEY, useSessionQuery } from "../lib/session";
import { getPanelNavEntries, panelSectionFromPath } from "../lib/panelNav";
import { EventBoardPanel } from "../components/panel/EventBoardPanel";
import { OrganizerPanel } from "../components/panel/OrganizerPanel";
import { OverviewPanel } from "../components/panel/OverviewPanel";
import { StaffPanel } from "../components/panel/StaffPanel";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  capacity: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  coverFileId: string | null;
};

type TicketWalletItem = {
  id: string;
  revokedAt: string | null;
  checkin: {
    checkedIn: boolean;
    checkedInAt: string | null;
    duplicateCount: number;
  };
};

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: "STAFF";
};

type StaffAssignmentItem = {
  id: string;
  eventId: string;
  userId: string;
  user: StaffUser | null;
};

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type PanelView = "overview" | "organizer" | "staff" | "events";
type OverviewRange = "TODAY" | "WEEK";
type CsvImportIssue = {
  rowNumber: number;
  reason: string;
};

type CsvImportSummary = {
  totalRows: number;
  importedRows: number;
  invalidRows: number;
  duplicateRows: number;
  confirmedRows: number;
  waitlistedRows: number;
};

type CsvImportResponse = {
  job: {
    id: string;
    status: string;
    summary: string | null;
  };
  summary: CsvImportSummary;
  issues: CsvImportIssue[];
};
type CsvImportHistoryItem = {
  id: string;
  eventId: string;
  fileId: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  summary: CsvImportSummary | null;
};
type WeatherResponse = {
  city: string;
  temperature: number;
  weather: string;
};
type FileDownloadResponse = {
  file: {
    id: string;
  };
  downloadUrl: string;
};

const OVERVIEW_RANGE_STORAGE_KEY = "panel-overview-range";

function parseOverviewRange(value: string | null | undefined): OverviewRange | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "TODAY") {
    return "TODAY";
  }
  if (normalized === "WEEK") {
    return "WEEK";
  }
  return null;
}
type PresignUploadResponse = {
  file: {
    id: string;
    ownerId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    size: number;
    kind: string;
    createdAt: string;
  };
  uploadUrl: string;
  method: "PUT";
};

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <div
      className={`stagger-enter stagger-1 mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
        notice.tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : notice.tone === "error"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {notice.text}
    </div>
  );
}

export function ControlPanelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  const sessionQuery = useSessionQuery(true);
  const currentUser = sessionQuery.data;

  const [eventForm, setEventForm] = useState({
    title: "",
    location: "",
    startTime: "",
    capacity: 100,
  });

  const [selectedEventId, setSelectedEventId] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResponse | null>(null);
  const [coverFilesByEvent, setCoverFilesByEvent] = useState<Record<string, File | null>>({});
  const [coverPreviewUrlsByEvent, setCoverPreviewUrlsByEvent] = useState<Record<string, string>>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState("");
  const [overviewRange, setOverviewRange] = useState<OverviewRange>(() => {
    const fromQuery = parseOverviewRange(new URLSearchParams(window.location.search).get("range"));
    if (fromQuery) {
      return fromQuery;
    }

    try {
      return parseOverviewRange(window.localStorage.getItem(OVERVIEW_RANGE_STORAGE_KEY)) ?? "WEEK";
    } catch {
      return "WEEK";
    }
  });
  const [showWeatherCard, setShowWeatherCard] = useState(true);
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ items: EventItem[] }>("/api/events"),
  });

  const myEventsQuery = useQuery({
    queryKey: ["my-events"],
    queryFn: () => apiFetch<{ items: EventItem[] }>("/api/my/events"),
    enabled: currentUser?.role === "ORGANIZER",
  });

  const myTicketsQuery = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => apiFetch<{ items: TicketWalletItem[] }>("/api/me/tickets"),
    enabled: currentUser?.role === "ATTENDEE",
  });

  const publishedEvents = eventsQuery.data?.items ?? [];
  const ownEvents = myEventsQuery.data?.items ?? [];
  const walletTickets = myTicketsQuery.data?.items ?? [];
  const draftEvents = ownEvents.filter((event) => event.status === "DRAFT");
  const myPublishedEvents = ownEvents.filter((event) => event.status === "PUBLISHED");

  const eventsWithCover = useMemo(() => {
    const merged = new Map<string, EventItem>();
    for (const event of ownEvents) {
      merged.set(event.id, event);
    }
    for (const event of publishedEvents) {
      merged.set(event.id, event);
    }
    return Array.from(merged.values()).filter((event) => Boolean(event.coverFileId));
  }, [ownEvents, publishedEvents]);

  useEffect(() => {
    if (currentUser?.role !== "ORGANIZER") {
      setSelectedEventId("");
      return;
    }

    if (!myPublishedEvents.length) {
      setSelectedEventId("");
      return;
    }

    setSelectedEventId((prev) => {
      if (prev && myPublishedEvents.some((event) => event.id === prev)) {
        return prev;
      }
      return myPublishedEvents[0]?.id ?? "";
    });
  }, [currentUser?.role, myPublishedEvents]);

  useEffect(() => {
    const missing = eventsWithCover.filter((event) => event.coverFileId && !coverPreviewUrlsByEvent[event.id]);
    if (!missing.length) {
      return;
    }

    let cancelled = false;
    void (async () => {
      for (const event of missing) {
        if (!event.coverFileId) {
          continue;
        }

        try {
          const payload = await apiFetch<FileDownloadResponse>(`/api/files/${event.coverFileId}/download`);
          if (cancelled) {
            return;
          }
          setCoverPreviewUrlsByEvent((prev) => ({
            ...prev,
            [event.id]: prev[event.id] ?? payload.downloadUrl,
          }));
        } catch {
          // Ignore per-event cover loading failures to keep the panel responsive.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coverPreviewUrlsByEvent, eventsWithCover]);

  useEffect(() => {
    if (location.pathname !== "/panel") {
      return;
    }

    const fromQuery = parseOverviewRange(searchParams.get("range"));
    if (fromQuery) {
      setOverviewRange((prev) => (prev === fromQuery ? prev : fromQuery));
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const serializedRange = overviewRange.toLowerCase();

    try {
      window.localStorage.setItem(OVERVIEW_RANGE_STORAGE_KEY, serializedRange);
    } catch {
      // Ignore storage errors in restricted environments.
    }

    if (location.pathname !== "/panel") {
      return;
    }

    if (searchParams.get("range") === serializedRange) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("range", serializedRange);
    setSearchParams(nextParams, { replace: true });
  }, [location.pathname, overviewRange, searchParams, setSearchParams]);
  const weatherQuery = useQuery({
    queryKey: ["weather-toronto"],
    queryFn: () => apiFetch<WeatherResponse>("/api/weather?city=Toronto"),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
  const staffAssignmentsQuery = useQuery({
    queryKey: ["event-staff", selectedEventId],
    enabled: Boolean(selectedEventId && currentUser?.role === "ORGANIZER"),
    queryFn: () => apiFetch<{ items: StaffAssignmentItem[] }>(`/api/events/${selectedEventId}/staff`),
  });

  const importHistoryQuery = useQuery({
    queryKey: ["event-import-jobs", selectedEventId],
    enabled: Boolean(selectedEventId && currentUser?.role === "ORGANIZER"),
    queryFn: () => apiFetch<{ items: CsvImportHistoryItem[] }>(`/api/events/${selectedEventId}/import-jobs`),
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = publishedEvents.filter((item) => new Date(item.startTime).getTime() > now).length;
    const activeTickets = walletTickets.filter((ticket) => !ticket.revokedAt).length;
    const checkedInTickets = walletTickets.filter((ticket) => ticket.checkin.checkedIn).length;
    return {
      published: publishedEvents.length,
      upcoming,
      role: currentUser?.role ?? "UNKNOWN",
      drafts: draftEvents.length,
      activeTickets,
      checkedInTickets,
    };
  }, [currentUser?.role, draftEvents.length, publishedEvents, walletTickets]);

  const orderedPublishedEvents = useMemo(() => {
    const now = Date.now();
    return [...publishedEvents].sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      const aUpcoming = aTime >= now;
      const bUpcoming = bTime >= now;

      if (aUpcoming !== bUpcoming) {
        return aUpcoming ? -1 : 1;
      }

      return aTime - bTime;
    });
  }, [publishedEvents]);

  const overviewRangeMeta = useMemo(() => {
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + (overviewRange === "TODAY" ? 1 : 7));
    return {
      label: overviewRange === "TODAY" ? "Today" : "This Week",
      startMs: rangeStart.getTime(),
      endMs: rangeEnd.getTime(),
      nowMs: now.getTime(),
    };
  }, [overviewRange]);

  const overviewScopedEvents = useMemo(() => {
    return orderedPublishedEvents.filter((event) => {
      const eventTime = new Date(event.startTime).getTime();
      return eventTime >= overviewRangeMeta.startMs && eventTime < overviewRangeMeta.endMs;
    });
  }, [orderedPublishedEvents, overviewRangeMeta.endMs, overviewRangeMeta.startMs]);

  const overviewUpcomingEvents = useMemo(() => {
    return overviewScopedEvents.filter((event) => new Date(event.startTime).getTime() >= overviewRangeMeta.nowMs);
  }, [overviewScopedEvents, overviewRangeMeta.nowMs]);

  const nextUpcomingEvent = overviewUpcomingEvents[0] ?? null;

  const overviewPreviousScopedCount = useMemo(() => {
    const rangeDurationMs = overviewRangeMeta.endMs - overviewRangeMeta.startMs;
    const previousStartMs = overviewRangeMeta.startMs - rangeDurationMs;
    const previousEndMs = overviewRangeMeta.startMs;

    return orderedPublishedEvents.filter((event) => {
      const eventTime = new Date(event.startTime).getTime();
      return eventTime >= previousStartMs && eventTime < previousEndMs;
    }).length;
  }, [orderedPublishedEvents, overviewRangeMeta.endMs, overviewRangeMeta.startMs]);

  const overviewRangeDelta = overviewScopedEvents.length - overviewPreviousScopedCount;
  const upcomingCoveragePct = overviewScopedEvents.length
    ? Math.round((overviewUpcomingEvents.length / overviewScopedEvents.length) * 100)
    : 0;

  const nextEventCountdownLabel = useMemo(() => {
    if (!nextUpcomingEvent) {
      return "No event in the selected range.";
    }

    const diffMs = new Date(nextUpcomingEvent.startTime).getTime() - overviewRangeMeta.nowMs;
    if (diffMs <= 0) {
      return "Event is in progress now.";
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 60) {
      return `Starts in ${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Starts in ${hours}h ${minutes % 60}m`;
    }

    const days = Math.floor(hours / 24);
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }, [nextUpcomingEvent, overviewRangeMeta.nowMs]);

  const overviewBars = useMemo(() => {
    const rows = [
      { label: overviewRangeMeta.label, value: overviewScopedEvents.length },
      { label: "Upcoming", value: overviewUpcomingEvents.length },
      { label: "Drafts", value: stats.drafts },
      { label: "Coverage", value: upcomingCoveragePct },
    ];
    const max = Math.max(...rows.map((row) => row.value), 1);
    return rows.map((row) => ({
      ...row,
      heightPct: Math.max(16, Math.round((row.value / max) * 100)),
    }));
  }, [overviewRangeMeta.label, overviewScopedEvents.length, overviewUpcomingEvents.length, stats.drafts, upcomingCoveragePct]);

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!eventForm.title.trim()) {
        throw new Error("Please enter an event title.");
      }
      if (!eventForm.location.trim()) {
        throw new Error("Please enter a location.");
      }
      if (!eventForm.startTime) {
        throw new Error("Please choose a valid start date/time.");
      }
      if (!Number.isFinite(eventForm.capacity) || eventForm.capacity < 1) {
        throw new Error("Capacity must be at least 1.");
      }

      return apiFetch<EventItem>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          ...eventForm,
          startTime: new Date(eventForm.startTime).toISOString(),
          waitlistEnabled: true,
        }),
      });
    },
    onSuccess: (created) => {
      setNotice({
        tone: "success",
        text: `Draft event "${created.title}" created. You can now publish it directly from My Event Studio.`,
      });
      setEventForm({ title: "", location: "", startTime: "", capacity: 100 });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  const publishEvent = useMutation({
    mutationFn: (eventId: string) => apiFetch<EventItem>(`/api/events/${eventId}/publish`, { method: "POST" }),
    onSuccess: (published) => {
      setNotice({ tone: "success", text: `Event "${published.title}" is now published and visible in the public board.` });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => setNotice({ tone: "error", text: err.message }),
  });

  const register = useMutation({
    mutationFn: (eventId: string) =>
      apiFetch<{ registration: { status: "CONFIRMED" | "WAITLISTED" }; ticket: { id: string } | null }>(
        `/api/events/${eventId}/register`,
        { method: "POST" },
      ),
    onSuccess: (payload) => {
      if (payload.registration.status === "WAITLISTED") {
        setNotice({ tone: "info", text: "Event is full. You have been added to the waitlist." });
      } else {
        setNotice({ tone: "success", text: "Registered successfully. Your ticket is now available in My Tickets." });
      }
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => setNotice({ tone: "error", text: err.message }),
  });

  const assignStaff = useMutation({
    mutationFn: async () => {
      if (!selectedEventId) {
        throw new Error("Please select one of your published events first.");
      }
      if (!staffEmail.trim()) {
        throw new Error("Please enter a staff email.");
      }

      return apiFetch(`/api/events/${selectedEventId}/staff`, {
        method: "POST",
        body: JSON.stringify({ email: staffEmail.trim() }),
      });
    },
    onSuccess: () => {
      setNotice({ tone: "success", text: "Staff assigned successfully." });
      setStaffEmail("");
      queryClient.invalidateQueries({ queryKey: ["event-staff", selectedEventId] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  const removeStaff = useMutation({
    mutationFn: (userId: string) => {
      if (!selectedEventId) {
        throw new Error("Please select an event first.");
      }
      return apiFetch(`/api/events/${selectedEventId}/staff/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      setNotice({ tone: "success", text: "Staff removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["event-staff", selectedEventId] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  const importCsv = useMutation({
    mutationFn: async () => {
  if (!selectedEventId) {
    throw new Error("Please select one of your published events first.");
  }
  if (!csvFile) {
    throw new Error("Please choose a CSV file first.");
  }
  if (csvFile.size === 0) {
    throw new Error("CSV file is empty.");
  }

  const presign = await apiFetch<PresignUploadResponse>("/api/files/presign-upload", {
    method: "POST",
    body: JSON.stringify({
      fileName: csvFile.name,
      mimeType: csvFile.type || "text/csv",
      size: csvFile.size,
      kind: "attendee-import",
    }),
  });

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: presign.method,
    headers: {
      "Content-Type": csvFile.type || "text/csv",
    },
    body: csvFile,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload CSV file to cloud storage.");
  }

  return apiFetch<CsvImportResponse>(`/api/events/${selectedEventId}/import-attendees-csv`, {
    method: "POST",
    body: JSON.stringify({
      fileId: presign.file.id,
    }),
  });
},
    
    onSuccess: (payload) => {
      setCsvImportResult(payload);
      setNotice({
        tone: "success",
        text: `CSV import completed. Imported ${payload.summary.importedRows} row(s), ${payload.summary.duplicateRows} duplicate row(s), ${payload.summary.invalidRows} invalid row(s).`,
      });
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-import-jobs", selectedEventId] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  const uploadEventCover = useMutation({
    mutationFn: async (eventId: string) => {
      const file = coverFilesByEvent[eventId];
      if (!file) {
        throw new Error("Please choose an image file first.");
      }
      if (!file.type.toLowerCase().startsWith("image/")) {
        throw new Error("Cover file must be an image.");
      }

      const presign = await apiFetch<PresignUploadResponse>("/api/files/presign-upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          size: file.size,
          kind: "event-cover",
        }),
      });

      const uploadResponse = await fetch(presign.uploadUrl, {
        method: presign.method,
        headers: {
          "Content-Type": file.type || "image/jpeg",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload cover image to cloud storage.");
      }

      const updatedEvent = await apiFetch<EventItem>(`/api/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({
          coverFileId: presign.file.id,
        }),
      });

      const download = await apiFetch<FileDownloadResponse>(`/api/files/${presign.file.id}/download`);

      return {
        eventId,
        eventTitle: updatedEvent.title,
        coverUrl: download.downloadUrl,
      };
    },
    onSuccess: ({ eventId, eventTitle, coverUrl }) => {
      setCoverFilesByEvent((prev) => ({
        ...prev,
        [eventId]: null,
      }));
      setCoverPreviewUrlsByEvent((prev) => ({
        ...prev,
        [eventId]: coverUrl,
      }));
      setNotice({
        tone: "success",
        text: `Cover image updated for event "${eventTitle}".`,
      });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
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
      setChangePasswordMessage(payload.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice({ tone: "success", text: "Password updated successfully." });
    },
    onError: (err: Error) => {
      setChangePasswordMessage(err.message);
      setNotice({ tone: "error", text: err.message });
    },
  });

  const viewMode: PanelView = location.pathname === "/panel/organizer"
    ? "organizer"
    : location.pathname === "/panel/staff"
      ? "staff"
      : location.pathname === "/panel/events"
        ? "events"
        : "overview";

  const viewLabel =
    viewMode === "organizer"
      ? "Organizer Studio"
      : viewMode === "staff"
        ? "Staff Console"
        : viewMode === "events"
          ? "Published Event Board"
          : "Overview";

  const moduleDescription =
    viewMode === "organizer"
      ? "Build and publish events, assign staff, and handle CSV attendee imports."
      : viewMode === "staff"
        ? "Operate check-in workflows and monitor event status in real time."
        : viewMode === "events"
          ? "Browse all published events and jump into dashboard/check-in operations."
          : "Use this overview to access your role-specific workflows quickly.";

  const isEventsMode = viewMode === "events";
  const showRoleWorkspace =
    viewMode === "overview" ||
    (currentUser?.role === "ORGANIZER" && viewMode === "organizer") ||
    ((currentUser?.role === "ORGANIZER" || currentUser?.role === "STAFF") && viewMode === "staff");
  const showFallbackModuleCard = !isEventsMode && !showRoleWorkspace;
  const mainGridClass = isEventsMode ? "mt-6 grid gap-5" : "mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]";
  const showAccountCard = !isEventsMode;
  const boardEvents = viewMode === "overview" ? overviewScopedEvents.slice(0, 4) : orderedPublishedEvents;
  const quickNavItems = getPanelNavEntries(currentUser?.role);
  const activePanelSection = panelSectionFromPath(location.pathname);

  const quickNavClass = (active: boolean) =>
    `rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
      active
        ? "border-brand-400 bg-brand-50 text-brand-700 shadow-soft"
        : "border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:text-brand-700"
    }`;
  const signOut = useMutation({
    mutationFn: () => apiFetch("/auth/sign-out", { method: "POST" }),
    onSuccess: () => {
      clearSessionToken();
      queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
      navigate("/auth", { replace: true });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  return (
    <main className="app-shell page-saas mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="hero-glow" />

      <section className="stagger-enter relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm md:p-8">
        <div
          className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-400/30 blur-3xl"
          style={{ pointerEvents: "none" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-orange-300/20 blur-3xl"
          style={{ pointerEvents: "none" }}
          aria-hidden
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Control Panel</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">Event Operations Workspace</h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as {currentUser?.name ?? "Unknown"} ({stats.role})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">Authenticated</Pill>
            <Button variant="ghost" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
              {signOut.isPending ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Published Events</p>
            <p className="mt-1 text-2xl font-bold">{stats.published}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Upcoming Events</p>
            <p className="mt-1 text-2xl font-bold">{stats.upcoming}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Role</p>
            <p className="mt-1 text-xl font-bold">{stats.role}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Personal Workspace</p>
            <p className="mt-1 text-xl font-bold">
              {currentUser?.role === "ORGANIZER"
                ? `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`
                : currentUser?.role === "ATTENDEE"
                  ? `${stats.activeTickets} active ticket${stats.activeTickets === 1 ? "" : "s"}`
                  : "Live access"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="panel-quick-nav">
        {quickNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={quickNavClass(activePanelSection === item.section)}
          >
            {item.label}
          </Link>
        ))}
      </section>

      <p className="mt-4 text-sm font-semibold text-slate-700">Current module: {viewLabel}</p>
      <p className="mt-1 text-sm text-slate-500">{moduleDescription}</p>

      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className={mainGridClass}>
        {!isEventsMode ? (
          <div className="space-y-5">
            {showFallbackModuleCard ? (
              <Card
                className="stagger-enter stagger-2"
                title="Module Access"
                subtitle="This module is optimized for a different role."
                headerRight={<Pill tone="warm">Switch Module</Pill>}
              >
                <p className="text-sm text-slate-700">
                  Your current role is <span className="font-semibold">{currentUser?.role ?? "UNKNOWN"}</span>. Use the quick links below to open modules available to your account.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/panel"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Back to Overview
                  </Link>
                  <Link
                    to="/panel/events"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                  >
                    Open Event Board
                  </Link>
                </div>
              </Card>
                        ) : viewMode === "overview" ? (
              <OverviewPanel
                currentUserRole={currentUser?.role}
                overviewRange={overviewRange}
                onChangeRange={setOverviewRange}
                overviewRangeMeta={overviewRangeMeta}
                overviewScopedEvents={overviewScopedEvents}
                overviewUpcomingEvents={overviewUpcomingEvents}
                overviewRangeDelta={overviewRangeDelta}
                upcomingCoveragePct={upcomingCoveragePct}
                nextUpcomingEvent={nextUpcomingEvent}
                nextEventCountdownLabel={nextEventCountdownLabel}
                overviewBars={overviewBars}
                stats={stats}
              />
                        ) : currentUser?.role === "ORGANIZER" && viewMode === "organizer" ? (
              <OrganizerPanel
                eventForm={eventForm}
                onEventFormChange={(patch) => setEventForm((prev) => ({ ...prev, ...patch }))}
                createEventState={{
                  isPending: createEvent.isPending,
                  onCreate: () => createEvent.mutate(),
                }}
                myEventsState={{
                  isLoading: myEventsQuery.isLoading,
                  isError: myEventsQuery.isError,
                  errorMessage: myEventsQuery.error instanceof Error ? myEventsQuery.error.message : "Failed to load events.",
                }}
                draftEvents={draftEvents}
                myPublishedEvents={myPublishedEvents}
                coverFilesByEvent={coverFilesByEvent}
                coverPreviewUrlsByEvent={coverPreviewUrlsByEvent}
                onCoverFileChange={(eventId, file) => {
                  setCoverFilesByEvent((prev) => ({
                    ...prev,
                    [eventId]: file,
                  }));
                }}
                uploadEventCoverState={{
                  isPending: uploadEventCover.isPending,
                  variables: uploadEventCover.variables,
                  onUpload: (eventId) => uploadEventCover.mutate(eventId),
                }}
                publishEventState={{
                  isPending: publishEvent.isPending,
                  variables: publishEvent.variables,
                  onPublish: (eventId) => publishEvent.mutate(eventId),
                }}
                selectedEventId={selectedEventId}
                onSelectEventId={setSelectedEventId}
                staffEmail={staffEmail}
                onStaffEmailChange={setStaffEmail}
                assignStaffState={{
                  isPending: assignStaff.isPending,
                  onAssign: () => assignStaff.mutate(),
                }}
                staffAssignmentsState={{
                  isLoading: staffAssignmentsQuery.isLoading,
                  isError: staffAssignmentsQuery.isError,
                  isFetching: staffAssignmentsQuery.isFetching,
                  items: staffAssignmentsQuery.data?.items ?? [],
                  onRefresh: () => {
                    void staffAssignmentsQuery.refetch();
                  },
                }}
                removeStaffState={{
                  isPending: removeStaff.isPending,
                  onRemove: (userId) => removeStaff.mutate(userId),
                }}
                csvState={{
                  file: csvFile,
                  result: csvImportResult,
                  onFileChange: setCsvFile,
                  onClear: () => {
                    setCsvFile(null);
                    setCsvImportResult(null);
                  },
                  onClearResult: () => setCsvImportResult(null),
                }}
                importCsvState={{
                  isPending: importCsv.isPending,
                  onImport: () => importCsv.mutate(),
                }}
                importHistoryState={{
                  isLoading: importHistoryQuery.isLoading,
                  isError: importHistoryQuery.isError,
                  isFetching: importHistoryQuery.isFetching,
                  items: importHistoryQuery.data?.items ?? [],
                  onRefresh: () => {
                    void importHistoryQuery.refetch();
                  },
                }}
              />
            ) : (
              <StaffPanel currentUserRole={currentUser?.role} stats={stats} />
            )} 
          </div>
        ) : null}

        <div className={showAccountCard ? "space-y-5" : "space-y-0"}>
          {showAccountCard ? (
            <Card
          className="stagger-enter stagger-6"
          title="Change Password"
          subtitle="Update your account password after signing in."
          headerRight={<Pill tone="brand">Account</Pill>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Current Password</FieldLabel>
              <Input
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel>New Password</FieldLabel>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Confirm New Password</FieldLabel>
              <Input
                type="password"
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Change Password"}
            </Button>
            {changePasswordMessage ? <p className="text-sm text-slate-600">{changePasswordMessage}</p> : null}
          </div>
        </Card>
          ) : null}

        <div className={showAccountCard ? "mt-5" : ""}>
        <EventBoardPanel
          eventsLoading={eventsQuery.isLoading}
          eventsError={eventsQuery.isError}
          boardEvents={boardEvents}
          coverPreviewUrlsByEvent={coverPreviewUrlsByEvent}
          currentUserRole={currentUser?.role}
          registerState={{
            isPending: register.isPending,
            variables: register.variables,
            mutate: (eventId: string) => register.mutate(eventId),
          }}
          isOverviewMode={viewMode === "overview"}
          overviewRangeLabel={overviewRangeMeta.label}
          showViewAll={viewMode === "overview" && orderedPublishedEvents.length > boardEvents.length}
        />
        </div>
        </div>
      </section>
      {showWeatherCard && (viewMode === "overview" || viewMode === "events") ? (
        <div className="fixed bottom-5 right-5 z-50 w-[280px] animate-[fadeIn_0.4s_ease-out] rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Live Weather</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Toronto</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowWeatherCard(false)}
              className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              x
            </button>
          </div>

          <div className="mt-3">
            {weatherQuery.isLoading ? (
              <p className="text-sm text-slate-600">Loading weather...</p>
            ) : weatherQuery.isError ? (
              <p className="text-sm text-rose-600">Unable to load weather.</p>
            ) : weatherQuery.data ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">Wx</div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{weatherQuery.data.temperature} C</p>
                    <p className="text-sm text-slate-600">{weatherQuery.data.weather}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Real-time weather from external API integration.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">No weather data available.</p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}




















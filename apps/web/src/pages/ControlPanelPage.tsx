import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Card, Pill } from "../components/ui";
import { apiFetch } from "../lib/api";
import { useSessionQuery } from "../lib/session";
import { getPanelNavEntries, panelSectionFromPath } from "../lib/panelNav";
import { EventBoardPanel } from "../components/panel/EventBoardPanel";
import { OrganizerPanel } from "../components/panel/OrganizerPanel";
import { OverviewPanel } from "../components/panel/OverviewPanel";
import { StaffPanel } from "../components/panel/StaffPanel";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { dismissWeatherCard, setNotice, setOverviewRange, setSelectedOrganizerEventId, type OverviewRange } from "../store/slices/panelSlice";

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

function withOverviewRangeParam(search: string, range: OverviewRange): URLSearchParams {
  const nextParams = new URLSearchParams(search);
  nextParams.set("range", range.toLowerCase());
  return nextParams;
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
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const notice = useAppSelector((state) => state.panel.notice as Notice | null);

  const sessionQuery = useSessionQuery(true);
  const currentUser = sessionQuery.data;

  const [eventForm, setEventForm] = useState({
    title: "",
    location: "",
    startTime: "",
    capacity: 100,
  });

  const selectedEventId = useAppSelector((state) => state.panel.selectedOrganizerEventId);
  const [staffEmail, setStaffEmail] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResponse | null>(null);
  const [coverFilesByEvent, setCoverFilesByEvent] = useState<Record<string, File | null>>({});
  const [coverPreviewUrlsByEvent, setCoverPreviewUrlsByEvent] = useState<Record<string, string>>({});
  const overviewRange = useAppSelector((state) => state.panel.overviewRange);
  const showWeatherCard = useAppSelector((state) => state.panel.showWeatherCard);
  const queryOverviewRange = useMemo(
    () => parseOverviewRange(new URLSearchParams(location.search).get("range")),
    [location.search],
  );
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
      dispatch(setSelectedOrganizerEventId(""));
      return;
    }

    if (!myPublishedEvents.length) {
      dispatch(setSelectedOrganizerEventId(""));
      return;
    }

    if (selectedEventId && myPublishedEvents.some((event) => event.id === selectedEventId)) {
      return;
    }

    dispatch(setSelectedOrganizerEventId(myPublishedEvents[0]?.id ?? ""));
  }, [currentUser?.role, dispatch, myPublishedEvents, selectedEventId]);

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

    if (queryOverviewRange) {
      dispatch(setOverviewRange(queryOverviewRange));
    }
  }, [dispatch, location.pathname, queryOverviewRange]);

  useEffect(() => {
    if (location.pathname !== "/panel") {
      return;
    }

    if (queryOverviewRange === overviewRange) {
      return;
    }

    const nextParams = withOverviewRangeParam(location.search, overviewRange);
    setSearchParams(nextParams, { replace: true });
  }, [location.pathname, location.search, overviewRange, queryOverviewRange, setSearchParams]);
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
      dispatch(setNotice({
        tone: "success",
        text: `Draft event "${created.title}" created. You can now publish it directly from My Event Studio.`,
      }));
      setEventForm({ title: "", location: "", startTime: "", capacity: 100 });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => {
      dispatch(setNotice({ tone: "error", text: err.message }));
    },
  });

  const publishEvent = useMutation({
    mutationFn: (eventId: string) => apiFetch<EventItem>(`/api/events/${eventId}/publish`, { method: "POST" }),
    onSuccess: (published) => {
      dispatch(setNotice({ tone: "success", text: `Event "${published.title}" is now published and visible in the public board.` }));
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => dispatch(setNotice({ tone: "error", text: err.message })),
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
      dispatch(setNotice({ tone: "success", text: "Staff assigned successfully." }));
      setStaffEmail("");
      queryClient.invalidateQueries({ queryKey: ["event-staff", selectedEventId] });
    },
    onError: (err: Error) => {
      dispatch(setNotice({ tone: "error", text: err.message }));
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
      dispatch(setNotice({ tone: "success", text: "Staff removed successfully." }));
      queryClient.invalidateQueries({ queryKey: ["event-staff", selectedEventId] });
    },
    onError: (err: Error) => {
      dispatch(setNotice({ tone: "error", text: err.message }));
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
      dispatch(setNotice({
        tone: "success",
        text: `CSV import completed. Imported ${payload.summary.importedRows} row(s), ${payload.summary.duplicateRows} duplicate row(s), ${payload.summary.invalidRows} invalid row(s).`,
      }));
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-import-jobs", selectedEventId] });
    },
    onError: (err: Error) => {
      dispatch(setNotice({ tone: "error", text: err.message }));
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
      dispatch(setNotice({
        tone: "success",
        text: `Cover image updated for event "${eventTitle}".`,
      }));
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => {
      dispatch(setNotice({ tone: "error", text: err.message }));
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
          ? "Event Board"
          : "Overview";

  const moduleDescription =
    viewMode === "organizer"
      ? "Create events, publish them, import attendees, and manage staff."
      : viewMode === "staff"
        ? "Open the event board, then go to check-in or the dashboard."
        : viewMode === "events"
          ? "View published events and open the page you need."
          : "View key data for your account.";

  const heroTitle =
    viewMode === "overview"
      ? "Overview"
      : viewLabel;

  const heroEyebrow =
    viewMode === "overview"
      ? "Panel"
      : "Current Module";

  const canOpenOrganizerModule = currentUser?.role === "ORGANIZER";
  const canOpenStaffModule = currentUser?.role === "ORGANIZER" || currentUser?.role === "STAFF";
  const showFallbackModuleCard =
    (viewMode === "organizer" && !canOpenOrganizerModule) ||
    (viewMode === "staff" && !canOpenStaffModule);
  const quickNavItems = getPanelNavEntries(currentUser?.role);
  const activePanelSection = panelSectionFromPath(location.pathname);

  const quickNavClass = (active: boolean) =>
    `rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
      active
        ? "border-brand-400 bg-brand-50 text-brand-700 shadow-soft"
        : "border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:text-brand-700"
    }`;

  function handleOverviewRangeChange(range: OverviewRange) {
    dispatch(setOverviewRange(range));

    if (location.pathname !== "/panel") {
      return;
    }

    setSearchParams(withOverviewRangeParam(location.search, range), { replace: true });
  }

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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">{heroEyebrow}</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">{heroTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{moduleDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{stats.role}</Pill>
            <Pill tone="slate">{viewLabel}</Pill>
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
            <p className="text-xs text-slate-600">My Status</p>
            <p className="mt-1 text-xl font-bold">
              {currentUser?.role === "ORGANIZER"
                ? `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`
                : currentUser?.role === "ATTENDEE"
                  ? `${stats.activeTickets} active ticket${stats.activeTickets === 1 ? "" : "s"}`
                  : "Event access"}
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

      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className="mt-6 space-y-5">
        {showFallbackModuleCard ? (
          <Card
            className="stagger-enter stagger-2"
            title="Access"
            subtitle="This page is not available for your role."
            headerRight={<Pill tone="warm">Restricted</Pill>}
          >
            <p className="text-sm text-slate-700">
              You are signed in as <span className="font-semibold">{currentUser?.role ?? "UNKNOWN"}</span>. Open a page available to this account.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/panel"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
              >
                Overview
              </Link>
              <Link
                to="/panel/events"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                Event Board
              </Link>
            </div>
          </Card>
        ) : viewMode === "overview" ? (
          <OverviewPanel
            currentUserRole={currentUser?.role}
            overviewRange={overviewRange}
            onChangeRange={handleOverviewRangeChange}
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
        ) : viewMode === "organizer" ? (
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
            onSelectEventId={(eventId) => dispatch(setSelectedOrganizerEventId(eventId))}
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
        ) : viewMode === "staff" ? (
          <StaffPanel currentUserRole={currentUser?.role} stats={stats} />
        ) : (
          <EventBoardPanel
            eventsLoading={eventsQuery.isLoading}
            eventsError={eventsQuery.isError}
            boardEvents={orderedPublishedEvents}
            coverPreviewUrlsByEvent={coverPreviewUrlsByEvent}
            currentUserRole={currentUser?.role}
            isOverviewMode={false}
            overviewRangeLabel={overviewRangeMeta.label}
            showViewAll={false}
          />
        )}
      </section>
      {showWeatherCard && (viewMode === "overview" || viewMode === "events") ? (
        <div className="fixed bottom-5 right-5 z-50 w-[280px] animate-[fadeIn_0.4s_ease-out] rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Weather</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Toronto</h3>
            </div>
            <button
              type="button"
              onClick={() => dispatch(dismissWeatherCard())}
              className="rounded-full px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              x
            </button>
          </div>

          <div className="mt-3">
            {weatherQuery.isLoading ? (
              <p className="text-sm text-slate-600">Loading weather...</p>
            ) : weatherQuery.isError ? (
              <p className="text-sm text-rose-600">Weather is unavailable.</p>
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
                  Data from OpenWeather.
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















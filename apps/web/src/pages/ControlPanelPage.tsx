import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill, Select } from "../components/ui";
import { apiFetch, clearSessionToken } from "../lib/api";
import { SESSION_QUERY_KEY, useSessionQuery } from "../lib/session";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  capacity: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
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

  const staffAssignmentsQuery = useQuery({
    queryKey: ["event-staff", selectedEventId],
    enabled: Boolean(selectedEventId && currentUser?.role === "ORGANIZER"),
    queryFn: () => apiFetch<{ items: StaffAssignmentItem[] }>(`/api/events/${selectedEventId}/staff`),
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
    <main className="app-shell mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="hero-glow" />

      <section className="stagger-enter relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white md:p-8">
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Control Panel</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">Event Operations Workspace</h1>
            <p className="mt-2 text-sm text-slate-200">
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
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Published Events</p>
            <p className="mt-1 text-2xl font-bold">{stats.published}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Upcoming Events</p>
            <p className="mt-1 text-2xl font-bold">{stats.upcoming}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Role</p>
            <p className="mt-1 text-xl font-bold">{stats.role}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Personal Workspace</p>
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

      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          {currentUser?.role === "ORGANIZER" ? (
            <>
              <Card
                className="stagger-enter stagger-2"
                title="Create Event"
                subtitle="Organizer creates a draft event first, then publishes it from My Event Studio."
                headerRight={<Pill tone="warm">Organizer Studio</Pill>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Event Title</FieldLabel>
                    <Input
                      placeholder="ECE1724 Demo Day"
                      value={eventForm.title}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>Location</FieldLabel>
                    <Input
                      placeholder="Bahen Centre Room 1130"
                      value={eventForm.location}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>Start Time</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>Capacity</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      value={String(eventForm.capacity)}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={() => createEvent.mutate()} disabled={createEvent.isPending}>
                    {createEvent.isPending ? "Creating..." : "Create Draft Event"}
                  </Button>
                  <p className="text-xs text-slate-600">Drafts appear below immediately and can be published without leaving the UI.</p>
                </div>
              </Card>

              <Card
                className="stagger-enter stagger-3"
                title="My Event Studio"
                subtitle="Review your draft events, publish them, or jump into the live dashboard."
                headerRight={<Pill tone="brand">Publish in UI</Pill>}
              >
                {myEventsQuery.isLoading ? (
                  <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading your events...</p>
                ) : null}

                {myEventsQuery.isError ? (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{(myEventsQuery.error as Error).message}</p>
                ) : null}

                <div className="space-y-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-heading text-lg font-semibold text-slate-900">Draft Events</h3>
                      <Pill tone="warm">{draftEvents.length}</Pill>
                    </div>
                    {draftEvents.length ? (
                      <div className="space-y-3">
                        {draftEvents.map((event) => (
                          <article key={event.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-900">{event.title}</h4>
                                <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {new Date(event.startTime).toLocaleString()} | capacity {event.capacity}
                                </p>
                              </div>
                              <Pill tone="warm">{event.status}</Pill>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                onClick={() => publishEvent.mutate(event.id)}
                                disabled={publishEvent.isPending && publishEvent.variables === event.id}
                              >
                                {publishEvent.isPending && publishEvent.variables === event.id ? "Publishing..." : "Publish Event"}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm text-slate-600">
                        No drafts yet. Create an event above to start your organizer workflow.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-heading text-lg font-semibold text-slate-900">Published by You</h3>
                      <Pill tone="slate">{myPublishedEvents.length}</Pill>
                    </div>
                    {myPublishedEvents.length ? (
                      <div className="space-y-3">
                        {myPublishedEvents.map((event) => (
                          <article key={event.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-900">{event.title}</h4>
                                <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {new Date(event.startTime).toLocaleString()} | capacity {event.capacity}
                                </p>
                              </div>
                              <Pill tone="brand">{event.status}</Pill>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Link
                                to={`/panel/events/${event.id}/dashboard`}
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/70 px-4 text-sm font-semibold text-slate-800 transition hover:bg-white"
                              >
                                Open Dashboard
                              </Link>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm text-slate-600">
                        Publish a draft to make it appear in the shared board.
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card
                className="stagger-enter stagger-4"
                title="Staff Assignment"
                subtitle="Assign staff accounts to one of your published events by email."
                headerRight={<Pill tone="brand">P0-5</Pill>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Select Published Event</FieldLabel>
                    <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                      <option value="">Choose one of your published events</option>
                      {myPublishedEvents.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} ({event.status})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <FieldLabel>Staff Email</FieldLabel>
                    <Input placeholder="staff@test.com" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={() => assignStaff.mutate()} disabled={assignStaff.isPending || !selectedEventId}>
                    {assignStaff.isPending ? "Assigning..." : "Assign Staff"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => staffAssignmentsQuery.refetch()}
                    disabled={!selectedEventId || staffAssignmentsQuery.isFetching}
                  >
                    {staffAssignmentsQuery.isFetching ? "Refreshing..." : "Refresh Staff List"}
                  </Button>
                </div>

                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Assigned Staff</p>

                  {!selectedEventId ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      Publish one of your events first, then select it here to manage staff assignments.
                    </div>
                  ) : staffAssignmentsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-100/80 px-4 py-5 text-sm text-slate-600">Loading staff...</div>
                  ) : staffAssignmentsQuery.isError ? (
                    <div className="rounded-2xl bg-rose-50 px-4 py-5 text-sm text-rose-700">Failed to load staff assignments.</div>
                  ) : staffAssignmentsQuery.data?.items.length ? (
                    <div className="space-y-3">
                      {staffAssignmentsQuery.data.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.user?.name ?? "Unknown Staff"}</p>
                            <p className="text-xs text-slate-600">{item.user?.email ?? "unknown@example.com"}</p>
                          </div>
                          <Button variant="danger" onClick={() => removeStaff.mutate(item.userId)} disabled={removeStaff.isPending}>
                            {removeStaff.isPending ? "Removing..." : "Remove"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      No staff assigned to this event yet.
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : currentUser?.role === "ATTENDEE" ? (
            <>
              <Card
                className="stagger-enter stagger-2"
                title="My Ticket Wallet"
                subtitle="Open your QR ticket page anytime after a confirmed registration."
                headerRight={<Pill tone="brand">Attendee</Pill>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Active Tickets</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.activeTickets}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Checked In</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.checkedInTickets}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/panel/tickets"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                  >
                    Open My Tickets
                  </Link>
                  <p className="self-center text-xs text-slate-600">Your QR code page is now available directly in the frontend.</p>
                </div>
              </Card>

              <Card className="stagger-enter stagger-3" title="Project Workflow" subtitle="Recommended attendee flow for your team demo.">
                <ol className="space-y-2 text-sm text-slate-700">
                  <li>1. Sign in as attendee and open the published event board.</li>
                  <li>2. Register for an event.</li>
                  <li>3. Open My Tickets and show the QR code to staff.</li>
                  <li>4. Refresh dashboard from organizer or staff account to confirm the live update.</li>
                </ol>
              </Card>
            </>
          ) : (
            <>
              <Card
                className="stagger-enter stagger-2"
                title="Staff Operations"
                subtitle="Staff users can monitor published events and open dashboards they are assigned to."
                headerRight={<Pill tone="slate">Staff</Pill>}
              >
                <p className="text-sm text-slate-700">
                  Staff accounts cannot create events, but they can open dashboards for assigned events and support check-in operations.
                </p>
              </Card>

              <Card className="stagger-enter stagger-3" title="Project Workflow" subtitle="Recommended staff flow for your team demo.">
                <ol className="space-y-2 text-sm text-slate-700">
                  <li>1. Sign in as staff.</li>
                  <li>2. Open the dashboard for an assigned event.</li>
                  <li>3. Perform manual or QR check-ins using the API or future staff page.</li>
                  <li>4. Use the dashboard refresh button to confirm live attendance changes.</li>
                </ol>
              </Card>
            </>
          )}
        </div>

        <Card
          className="stagger-enter stagger-5"
          title="Published Event Board"
          subtitle="Browse public events, register as attendee, or open dashboards for operations roles."
          headerRight={<Pill tone="slate">Live Feed</Pill>}
        >
          {eventsQuery.isLoading ? (
            <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading events...</p>
          ) : null}

          {eventsQuery.isError ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load events.</p>
          ) : null}

          <div className="space-y-3">
            {publishedEvents.length ? (
              publishedEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-panel"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-slate-900">{event.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(event.startTime).toLocaleString()} | capacity {event.capacity}
                      </p>
                    </div>
                    <Pill tone="brand">{event.status}</Pill>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {currentUser?.role === "ATTENDEE" ? (
                      <Button onClick={() => register.mutate(event.id)} disabled={register.isPending}>
                        {register.isPending && register.variables === event.id ? "Submitting..." : "Register"}
                      </Button>
                    ) : null}

                    {(currentUser?.role === "ORGANIZER" || currentUser?.role === "STAFF") && (
                      <Link
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                        to={`/panel/events/${event.id}/dashboard`}
                      >
                        Open Dashboard
                      </Link>
                    )}

                    {currentUser?.role === "ATTENDEE" ? (
                      <Link
                        to="/panel/tickets"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        My Tickets
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center text-sm text-slate-600">
                No published events yet. Publish one and it will appear here.
              </div>
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}

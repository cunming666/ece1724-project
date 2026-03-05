import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill } from "../components/ui";
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

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

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

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ items: EventItem[] }>("/api/events"),
  });

  const publishedEvents = eventsQuery.data?.items ?? [];

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = publishedEvents.filter((item) => new Date(item.startTime).getTime() > now).length;
    return {
      published: publishedEvents.length,
      upcoming,
      role: currentUser?.role ?? "UNKNOWN",
    };
  }, [currentUser?.role, publishedEvents]);

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!eventForm.startTime) {
        throw new Error("Please choose a valid start date/time.");
      }

      return apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({
          ...eventForm,
          startTime: new Date(eventForm.startTime).toISOString(),
          waitlistEnabled: true,
        }),
      });
    },
    onSuccess: () => {
      setNotice({ tone: "success", text: "Event created as draft. Publish it via API endpoint when ready." });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => {
      setNotice({ tone: "error", text: err.message });
    },
  });

  const register = useMutation({
    mutationFn: (eventId: string) => apiFetch(`/api/events/${eventId}/register`, { method: "POST" }),
    onSuccess: () => setNotice({ tone: "success", text: "Registered successfully." }),
    onError: (err: Error) => setNotice({ tone: "error", text: err.message }),
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

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
        </div>
      </section>

      {notice ? (
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
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <Card
            className="stagger-enter stagger-2"
            title="Create Event"
            subtitle="Organizer creates a draft event first, then publishes it when ready."
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
              <p className="text-xs text-slate-600">
                Publish endpoint: <code className="rounded bg-slate-100 px-1">POST /api/events/:eventId/publish</code>
              </p>
            </div>
          </Card>

          <Card
            className="stagger-enter stagger-3"
            title="Project Workflow"
            subtitle="Recommended UI flow for your team demo."
          >
            <ol className="space-y-2 text-sm text-slate-700">
              <li>1. Login from auth page (or use quick demo button).</li>
              <li>2. Create/publish event and register attendees.</li>
              <li>3. Open event dashboard to show live check-ins.</li>
              <li>4. Demonstrate duplicate check-in and waitlist promotion.</li>
            </ol>
          </Card>
        </div>

        <Card
          className="stagger-enter stagger-4"
          title="Published Event Board"
          subtitle="Open dashboard per event, or register as attendee."
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
                    <Button onClick={() => register.mutate(event.id)} disabled={register.isPending}>
                      {register.isPending ? "Submitting..." : "Register"}
                    </Button>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                      to={`/panel/events/${event.id}/dashboard`}
                    >
                      Open Dashboard
                    </Link>
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

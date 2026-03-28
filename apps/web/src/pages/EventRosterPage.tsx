import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill, Select } from "../components/ui";
import { apiFetch } from "../lib/api";
import { useSessionQuery } from "../lib/session";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  capacity: number;
};

type RosterItem = {
  id: string;
  attendeeId: string;
  status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  waitlistPosition: number | null;
  registeredAt: string;
  attendee: {
    id: string;
    name: string;
    email: string;
  } | null;
  ticket: {
    id: string;
    issuedAt: string;
    revokedAt: string | null;
  } | null | undefined;
  checkin: {
    checkedIn: boolean;
    checkedInAt: string | null;
    duplicateCount: number;
  } | undefined;
};

type FilterValue = "ALL" | "CONFIRMED" | "WAITLISTED" | "CHECKED_IN" | "NOT_CHECKED_IN";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function EventRosterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery(true);
  const currentUser = sessionQuery.data;
  const canOpenRoster = currentUser?.role === "ORGANIZER" || currentUser?.role === "STAFF";
  const canManageRoster = currentUser?.role === "ORGANIZER";

  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [localMessage, setLocalMessage] = useState("");

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiFetch<EventItem>(`/api/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const rosterQuery = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => apiFetch<{ items: RosterItem[] }>(`/api/events/${eventId}/attendees`),
    enabled: Boolean(eventId && canOpenRoster),
  });

  const addAttendee = useMutation({
    mutationFn: async () => {
      if (!eventId) {
        throw new Error("Event not found.");
      }
      if (!attendeeName.trim()) {
        throw new Error("Please enter the attendee name.");
      }
      if (!attendeeEmail.trim()) {
        throw new Error("Please enter the attendee email.");
      }

      return apiFetch<{
        registration: { status: "CONFIRMED" | "WAITLISTED" };
        ticket: { id: string } | null;
        createdAccount: boolean;
        defaultPassword: string | null;
      }>(`/api/events/${eventId}/attendees`, {
        method: "POST",
        body: JSON.stringify({
          name: attendeeName.trim(),
          email: attendeeEmail.trim().toLowerCase(),
        }),
      });
    },
    onSuccess: (payload) => {
      const accountMessage = payload.createdAccount && payload.defaultPassword
        ? ` Account created with default password ${payload.defaultPassword}.`
        : "";
      setLocalMessage(`Attendee added as ${payload.registration.status.toLowerCase()}.${accountMessage}`.trim());
      setAttendeeName("");
      setAttendeeEmail("");
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
    },
    onError: (error: Error) => {
      setLocalMessage(error.message);
    },
  });

  const removeAttendee = useMutation({
    mutationFn: async (attendeeId: string) => {
      if (!eventId) {
        throw new Error("Event not found.");
      }
      await apiFetch<void>(`/api/events/${eventId}/attendees/${attendeeId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      setLocalMessage("Attendee removed.");
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
    },
    onError: (error: Error) => {
      setLocalMessage(error.message);
    },
  });

  const rosterItems = useMemo(
    () =>
      (rosterQuery.data?.items ?? []).map((item) => ({
        ...item,
        ticket: item.ticket ?? null,
        checkin: item.checkin ?? {
          checkedIn: false,
          checkedInAt: null,
          duplicateCount: 0,
        },
      })),
    [rosterQuery.data?.items],
  );
  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return rosterItems.filter((item) => {
      const matchesSearch =
        !keyword ||
        (item.attendee?.name ?? "").toLowerCase().includes(keyword) ||
        (item.attendee?.email ?? "").toLowerCase().includes(keyword) ||
        (item.ticket?.id ?? "").toLowerCase().includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      if (filter === "CONFIRMED") {
        return item.status === "CONFIRMED";
      }
      if (filter === "WAITLISTED") {
        return item.status === "WAITLISTED";
      }
      if (filter === "CHECKED_IN") {
        return item.checkin.checkedIn;
      }
      if (filter === "NOT_CHECKED_IN") {
        return !item.checkin.checkedIn;
      }

      return true;
    });
  }, [filter, rosterItems, searchText]);

  const stats = useMemo(() => {
    const confirmed = rosterItems.filter((item) => item.status === "CONFIRMED").length;
    const waitlisted = rosterItems.filter((item) => item.status === "WAITLISTED").length;
    const checkedIn = rosterItems.filter((item) => item.checkin.checkedIn).length;
    const activeTickets = rosterItems.filter((item) => item.ticket && !item.ticket.revokedAt).length;

    return {
      total: rosterItems.length,
      confirmed,
      waitlisted,
      checkedIn,
      activeTickets,
    };
  }, [rosterItems]);

  if (sessionQuery.isLoading) {
    return (
      <main className="app-shell mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <p className="rounded-2xl bg-slate-100/80 px-4 py-3 text-sm text-slate-600">Loading session...</p>
      </main>
    );
  }

  if (!canOpenRoster) {
    return (
      <main className="app-shell mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <Card title="Roster" subtitle="Only organizer and staff accounts can open this page." headerRight={<Pill tone="warm">Restricted</Pill>}>
          <p className="text-sm text-slate-700">Sign in with an organizer or staff account to view the event roster.</p>
          <div className="mt-4">
            <Link
              to="/panel"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/70 px-4 text-sm font-semibold text-slate-800 transition hover:bg-white"
            >
              Back to Panel
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell page-saas mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <section className="stagger-enter rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Event</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Roster</h1>
            <p className="mt-2 text-sm text-slate-600">
              {eventQuery.data ? `${eventQuery.data.title} - ${eventQuery.data.location}` : `Event ID: ${eventId}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/panel/events"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
            >
              Event Board
            </Link>
            {eventId ? (
              <>
                <Link
                  to={`/panel/events/${eventId}/dashboard`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Dashboard
                </Link>
                <Link
                  to={`/panel/events/${eventId}/checkin`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Check-in
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Total</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Confirmed</p>
            <p className="mt-1 text-2xl font-bold">{stats.confirmed}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Waitlist</p>
            <p className="mt-1 text-2xl font-bold">{stats.waitlisted}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Checked In</p>
            <p className="mt-1 text-2xl font-bold">{stats.checkedIn}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Active Tickets</p>
            <p className="mt-1 text-2xl font-bold">{stats.activeTickets}</p>
          </div>
        </div>
      </section>

      {localMessage ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{localMessage}</div>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          {canManageRoster ? (
            <Card title="Add Attendee" subtitle="Add one attendee to this event." headerRight={<Pill tone="brand">Organizer</Pill>}>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <Input value={attendeeName} onChange={(event) => setAttendeeName(event.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <Input value={attendeeEmail} onChange={(event) => setAttendeeEmail(event.target.value)} placeholder="name@utoronto.ca" />
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                  New attendee accounts use the default password <span className="font-semibold">pass1234</span>.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => addAttendee.mutate()} disabled={addAttendee.isPending}>
                    {addAttendee.isPending ? "Adding..." : "Add Attendee"}
                  </Button>
                  <Link
                    to="/panel/organizer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Open Organizer Studio
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          <Card title="Filter" subtitle="Search the full attendee list.">
            <div className="space-y-3">
              <div>
                <FieldLabel>Search</FieldLabel>
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Name, email, or ticket ID"
                />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <Select value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)}>
                  <option value="ALL">All</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="WAITLISTED">Waitlist</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="NOT_CHECKED_IN">Not Checked In</option>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Attendees" subtitle="Full event roster." headerRight={<Pill tone="slate">{filteredItems.length}</Pill>}>
          {rosterQuery.isLoading ? (
            <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading roster...</p>
          ) : null}

          {rosterQuery.isError ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{(rosterQuery.error as Error).message}</p>
          ) : null}

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.attendee?.name ?? "Unknown attendee"}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.attendee?.email ?? "unknown@example.com"}</p>
                    <p className="mt-1 text-xs text-slate-500">Registered {formatDateTime(item.registeredAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={item.status === "WAITLISTED" ? "warm" : "brand"}>
                      {item.status === "WAITLISTED" && item.waitlistPosition ? `Waitlist #${item.waitlistPosition}` : item.status}
                    </Pill>
                    <Pill tone={item.checkin.checkedIn ? "slate" : "brand"}>
                      {item.checkin.checkedIn ? "Checked In" : "Not Checked In"}
                    </Pill>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Ticket</p>
                    <p className="mt-2">Ticket ID: {item.ticket?.id ?? "-"}</p>
                    <p className="mt-1">Issued: {formatDateTime(item.ticket?.issuedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Check-in</p>
                    <p className="mt-2">Status: {item.checkin.checkedIn ? "Checked In" : "Pending"}</p>
                    <p className="mt-1">Time: {formatDateTime(item.checkin.checkedInAt)}</p>
                  </div>
                </div>

                {canManageRoster ? (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="danger"
                      onClick={() => removeAttendee.mutate(item.attendeeId)}
                      disabled={removeAttendee.isPending}
                    >
                      {removeAttendee.isPending ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}

            {!rosterQuery.isLoading && !filteredItems.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                No attendees found.
              </div>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}

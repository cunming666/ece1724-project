import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Pill } from "../components/ui";
import { apiFetch, apiFetchText } from "../lib/api";
import { useSessionQuery } from "../lib/session";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearCopyMessage, setCopyMessage, setSelectedTicketId } from "../store/slices/ticketsSlice";

type TicketItem = {
  id: string;
  issuedAt: string;
  revokedAt: string | null;
  event: {
    id: string;
    title: string;
    location: string;
    startTime: string;
    status: "DRAFT" | "PUBLISHED" | "CLOSED";
  };
  registration: {
    id: string;
    status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
    registeredAt: string;
  } | null;
  checkin: {
    checkedIn: boolean;
    checkedInAt: string | null;
    duplicateCount: number;
  };
};

type TicketListResponse = {
  items: TicketItem[];
};

function ticketStatusTone(ticket: TicketItem): "brand" | "warm" | "slate" {
  if (ticket.revokedAt) return "warm";
  if (ticket.checkin.checkedIn) return "slate";
  return "brand";
}

function ticketStatusText(ticket: TicketItem): string {
  if (ticket.revokedAt) return "Revoked";
  if (ticket.checkin.checkedIn) return "Checked In";
  return "Active";
}

export function AttendeeTicketsPage() {
  const dispatch = useAppDispatch();
  const sessionQuery = useSessionQuery(true);
  const currentUser = sessionQuery.data;
  const selectedTicketId = useAppSelector((state) => state.tickets.selectedTicketId);
  const copyMessage = useAppSelector((state) => state.tickets.copyMessage);

  const ticketsQuery = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => apiFetch<TicketListResponse>("/api/me/tickets"),
    enabled: currentUser?.role === "ATTENDEE",
  });

  const tickets = ticketsQuery.data?.items ?? [];

  useEffect(() => {
    if (!tickets.length) {
      dispatch(setSelectedTicketId(null));
      return;
    }

    if (selectedTicketId && tickets.some((ticket) => ticket.id === selectedTicketId)) {
      return;
    }

    const firstActive = tickets.find((ticket) => !ticket.revokedAt);
    dispatch(setSelectedTicketId((firstActive ?? tickets[0])?.id ?? null));
  }, [dispatch, selectedTicketId, tickets]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  const qrQuery = useQuery({
    queryKey: ["ticket-qr", selectedTicketId],
    queryFn: () => apiFetchText(`/api/tickets/${selectedTicketId}/qr`),
    enabled: currentUser?.role === "ATTENDEE" && Boolean(selectedTicketId && selectedTicket && !selectedTicket.revokedAt),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const active = tickets.filter((ticket) => !ticket.revokedAt).length;
    const checkedIn = tickets.filter((ticket) => ticket.checkin.checkedIn).length;
    const revoked = tickets.filter((ticket) => Boolean(ticket.revokedAt)).length;
    return { total: tickets.length, active, checkedIn, revoked };
  }, [tickets]);

  async function handleCopyTicketId(ticketId: string) {
    try {
      await navigator.clipboard.writeText(ticketId);
      dispatch(setCopyMessage("Ticket ID copied."));
      window.setTimeout(() => dispatch(clearCopyMessage()), 2000);
    } catch {
      dispatch(setCopyMessage("Clipboard is unavailable in this browser."));
      window.setTimeout(() => dispatch(clearCopyMessage()), 2500);
    }
  }

  if (sessionQuery.isLoading) {
    return (
      <main className="app-shell mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <p className="rounded-2xl bg-slate-100/80 px-4 py-3 text-sm text-slate-600">Loading session...</p>
      </main>
    );
  }

  if (currentUser?.role !== "ATTENDEE") {
    return (
      <main className="app-shell mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <Card
          title="My Tickets"
          subtitle="Only attendee accounts can open this page."
          headerRight={<Pill tone="warm">Restricted</Pill>}
        >
          <p className="text-sm text-slate-700">
            Sign in with an attendee account to view tickets and QR codes.
          </p>
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
    <main className="app-shell page-attendee mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="hero-glow" />

      <section className="stagger-enter rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 p-6 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Tickets</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">My Tickets</h1>
            <p className="mt-2 text-sm text-slate-200">
              View your tickets and QR codes for check-in.
            </p>
          </div>
          <Link
            to="/panel"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Back to Panel
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Total Tickets</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Active</p>
            <p className="mt-1 text-2xl font-bold">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Checked In</p>
            <p className="mt-1 text-2xl font-bold">{stats.checkedIn}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Revoked</p>
            <p className="mt-1 text-2xl font-bold">{stats.revoked}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card
          className="stagger-enter stagger-1"
          title="Tickets"
          subtitle="Select a ticket."
          headerRight={<Pill tone="slate">{currentUser.name}</Pill>}
        >
          {ticketsQuery.isLoading ? (
            <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading tickets...</p>
          ) : null}

          {ticketsQuery.isError ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{(ticketsQuery.error as Error).message}</p>
          ) : null}

          <div className="space-y-3">
            {tickets.length ? (
              tickets.map((ticket) => {
                const selected = ticket.id === selectedTicketId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => dispatch(setSelectedTicketId(ticket.id))}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-brand-400 bg-brand-50/80 shadow-soft"
                        : "border-slate-200/80 bg-white/70 hover:-translate-y-0.5 hover:shadow-panel"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{ticket.event.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{ticket.event.location}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(ticket.event.startTime).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Pill tone={ticketStatusTone(ticket)}>{ticketStatusText(ticket)}</Pill>
                        {ticket.checkin.duplicateCount > 0 ? <Pill tone="warm">Duplicate +{ticket.checkin.duplicateCount}</Pill> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                No tickets yet.
              </div>
            )}
          </div>
        </Card>

        <Card
          className="stagger-enter stagger-2"
          title="Details"
          subtitle="Show this QR code at check-in."
          headerRight={
            selectedTicket ? <Pill tone={ticketStatusTone(selectedTicket)}>{ticketStatusText(selectedTicket)}</Pill> : null
          }
        >
          {selectedTicket ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{selectedTicket.event.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedTicket.event.location}</p>
                  <p className="mt-1 text-sm text-slate-600">{new Date(selectedTicket.event.startTime).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket</p>
                  <p className="mt-2 text-sm text-slate-700">Ticket ID: {selectedTicket.id}</p>
                  <p className="mt-1 text-sm text-slate-700">Issued: {new Date(selectedTicket.issuedAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Check-in: {selectedTicket.checkin.checkedIn && selectedTicket.checkin.checkedInAt ? new Date(selectedTicket.checkin.checkedInAt).toLocaleString() : "Not checked in yet"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleCopyTicketId(selectedTicket.id)} variant="ghost">
                  Copy Ticket ID
                </Button>
                <Button onClick={() => qrQuery.refetch()} disabled={qrQuery.isFetching || Boolean(selectedTicket.revokedAt)} variant="secondary">
                  {qrQuery.isFetching ? "Refreshing QR..." : "Refresh QR"}
                </Button>
              </div>

              {copyMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{copyMessage}</p>
              ) : null}

              {selectedTicket.revokedAt ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-700">
                  This ticket was revoked on {new Date(selectedTicket.revokedAt).toLocaleString()} and can no longer be used for entry.
                </div>
              ) : qrQuery.isError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {(qrQuery.error as Error).message}
                </div>
              ) : qrQuery.isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
                  Loading QR code...
                </div>
              ) : qrQuery.data ? (
                <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft">
                    <div
                      className="mx-auto flex max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-4"
                      dangerouslySetInnerHTML={{ __html: qrQuery.data }}
                    />
                  </div>
                  <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-5">
                    <p className="text-sm text-slate-700">
                      Show this QR code at the entrance. If scanning is unavailable, staff can use the ticket ID.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill tone="brand">{selectedTicket.registration?.status ?? "CONFIRMED"}</Pill>
                      <Pill tone="slate">{selectedTicket.event.status}</Pill>
                      {selectedTicket.checkin.checkedIn ? <Pill tone="slate">Already Checked In</Pill> : <Pill tone="brand">Ready to Scan</Pill>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                  Select a ticket to view the QR code.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
              Select a ticket.
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}


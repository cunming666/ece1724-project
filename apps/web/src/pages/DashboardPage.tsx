import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { socket } from "../lib/socket";
import { Button, Card, FieldLabel, Input, Pill } from "../components/ui";

type DashboardAttendeeItem = {
  id: string;
  attendeeId: string;
  registeredAt: string;
  attendee: {
    id: string;
    name: string;
    email: string;
  };
};

type DashboardWaitlistedItem = {
  id: string;
  attendeeId: string;
  waitlistPosition: number | null;
  registeredAt: string;
  attendee: {
    id: string;
    name: string;
    email: string;
  };
};

type DashboardData = {
  eventId: string;
  confirmed: number;
  waitlisted: number;
  checkedIn: number;
  confirmedAttendees: DashboardAttendeeItem[];
  waitlistedAttendees: DashboardWaitlistedItem[];
  recentCheckins: Array<{
    id: string;
    method: string;
    checkedInAt: string;
    isDuplicate: boolean;
    ticket: {
      attendee: {
        name: string;
        email: string;
      };
    };
  }>;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function DashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [ticketId, setTicketId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  async function loadDashboard() {
    if (!eventId) return;
    setIsLoading(true);
    setMessage("");
    try {
      const payload = await apiFetch<DashboardData>(`/api/events/${eventId}/dashboard`);
      setData(payload);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function manualCheckIn() {
    if (!ticketId.trim()) {
      setNotice({ tone: "error", text: "Please enter a ticket ID." });
      return;
    }

    setIsCheckingIn(true);
    setNotice(null);

    try {
      const payload = await apiFetch<{
        id: string;
        isDuplicate: boolean;
      }>("/api/checkins/manual", {
        method: "POST",
        body: JSON.stringify({
          ticketId: ticketId.trim(),
        }),
      });

      setNotice({
        tone: payload.isDuplicate ? "error" : "success",
        text: payload.isDuplicate ? "Duplicate check-in recorded." : "Manual check-in successful.",
      });

      setTicketId("");
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
    } finally {
      setIsCheckingIn(false);
    }
  }

  useEffect(() => {
    if (!eventId) return;

    socket.connect();
    socket.emit("join:event", eventId);

    const onAttendance = () => {
      loadDashboard();
    };

    socket.on("checkin:created", onAttendance);
    socket.on("attendance:updated", onAttendance);
    socket.on("waitlist:promoted", onAttendance);

    loadDashboard();

    return () => {
      socket.emit("leave:event", eventId);
      socket.off("checkin:created", onAttendance);
      socket.off("attendance:updated", onAttendance);
      socket.off("waitlist:promoted", onAttendance);
      socket.disconnect();
    };
  }, [eventId]);

  const confirmed = data?.confirmed ?? 0;
  const waitlisted = data?.waitlisted ?? 0;
  const checkedIn = data?.checkedIn ?? 0;
  const pendingCheckin = Math.max(confirmed - checkedIn, 0);
  const checkinRate = confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0;
  const totalFlow = confirmed + waitlisted;

  const distribution = useMemo(() => {
    const rows = [
      { label: "Checked In", value: checkedIn, tone: "bg-emerald-500" },
      { label: "Pending Check-in", value: pendingCheckin, tone: "bg-sky-500" },
      { label: "Waitlist", value: waitlisted, tone: "bg-amber-500" },
    ];
    const maxValue = Math.max(...rows.map((item) => item.value), 1);
    return rows.map((item) => ({
      ...item,
      widthPct: Math.max(8, Math.round((item.value / maxValue) * 100)),
    }));
  }, [checkedIn, pendingCheckin, waitlisted]);

  const trendBars = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0];
    const latest = (data?.recentCheckins ?? []).slice(0, 12).reverse();
    if (!latest.length) {
      return buckets.map(() => 12);
    }

    latest.forEach((item, index) => {
      const bucketIndex = Math.min(5, Math.floor((index / Math.max(latest.length, 1)) * 6));
      const current = buckets[bucketIndex] ?? 0;
      buckets[bucketIndex] = current + (item.isDuplicate ? 0.5 : 1);
    });

    const max = Math.max(...buckets, 1);
    return buckets.map((value) => Math.max(12, Math.round((value / max) * 100)));
  }, [data?.recentCheckins]);

  return (
    <main className="app-shell page-saas mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <section className="stagger-enter rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Event</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Event Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Event ID: {eventId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={loadDashboard} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
            {eventId ? (
              <Link
                to={`/panel/events/${eventId}/attendees`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
              >
                View Roster
              </Link>
            ) : null}
            <Link
              to="/panel"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
            >
              Back to Panel
            </Link>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Pill tone="brand">Live</Pill>
          <Pill tone="slate">Auto Refresh</Pill>
        </div>
      </section>

      {message ? (
        <p className="stagger-enter mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {message}
        </p>
      ) : null}

      {notice ? (
        <div
          className={`stagger-enter mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="stagger-enter stagger-1" title="Confirmed" subtitle="Registered attendees">
          <p className="font-heading text-4xl font-bold text-slate-900">{confirmed}</p>
        </Card>
        <Card className="stagger-enter stagger-2" title="Checked In" subtitle="Completed entries">
          <p className="font-heading text-4xl font-bold text-slate-900">{checkedIn}</p>
        </Card>
        <Card className="stagger-enter stagger-3" title="Pending" subtitle="Not checked in">
          <p className="font-heading text-4xl font-bold text-slate-900">{pendingCheckin}</p>
        </Card>
        <Card className="stagger-enter stagger-4" title="Check-in Rate" subtitle="Checked in / confirmed">
          <p className="font-heading text-4xl font-bold text-slate-900">{checkinRate}%</p>
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Card className="stagger-enter stagger-2" title="Attendance" subtitle="Current breakdown">
            <div className="space-y-4">
              {distribution.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{item.label}</span>
                    <span className="text-slate-600">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className={`${item.tone} h-full rounded-full`} style={{ width: `${item.widthPct}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">Total tracked: {totalFlow}</p>
            </div>
          </Card>

          <Card className="stagger-enter stagger-3" title="Check-in Trend" subtitle="Based on recent check-ins">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-44 items-end gap-3">
                {trendBars.map((height, index) => (
                  <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t-md bg-brand-500/85" style={{ height: `${height}%` }} />
                    <span className="text-[11px] font-semibold text-slate-500">T{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card
          className="stagger-enter stagger-4"
          title="Recent Check-ins"
          subtitle="Latest entries"
          headerRight={<Pill tone="slate">{data?.recentCheckins?.length ?? 0}</Pill>}
        >
          <div className="space-y-3">
            {data?.recentCheckins?.length ? (
              data.recentCheckins.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.ticket.attendee.name}</p>
                      <p className="text-sm text-slate-600">{item.ticket.attendee.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.checkedInAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={item.isDuplicate ? "warm" : "brand"}>{item.isDuplicate ? "Duplicate" : "Valid"}</Pill>
                      <Pill tone="slate">{item.method}</Pill>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                No activity yet.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="stagger-enter stagger-5" title="Manual Check-in" subtitle="Enter a ticket ID.">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <FieldLabel>Ticket ID</FieldLabel>
              <Input
                placeholder="Paste ticket ID here"
                value={ticketId}
                onChange={(event) => setTicketId(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={manualCheckIn} disabled={isCheckingIn}>
                {isCheckingIn ? "Checking in..." : "Manual Check-in"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="stagger-enter stagger-6" title="Roster" subtitle="Confirmed and waitlisted attendees">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed</p>
              <div className="mt-3 space-y-2">
                {data?.confirmedAttendees?.slice(0, 5).map((item) => (
                  <div key={item.id} className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{item.attendee.name}</span> - {item.attendee.email}
                  </div>
                ))}
                {!data?.confirmedAttendees?.length ? <p className="text-sm text-slate-600">No confirmed attendees.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waitlist</p>
              <div className="mt-3 space-y-2">
                {data?.waitlistedAttendees?.slice(0, 5).map((item) => (
                  <div key={item.id} className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{item.attendee.name}</span>
                    {" "}- #{item.waitlistPosition ?? "-"}
                  </div>
                ))}
                {!data?.waitlistedAttendees?.length ? <p className="text-sm text-slate-600">No waitlisted attendees.</p> : null}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

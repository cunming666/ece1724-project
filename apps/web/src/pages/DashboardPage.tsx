import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { socket } from "../lib/socket";
import { Button, Card, FieldLabel, Input, Pill } from "../components/ui";

type DashboardData = {
  eventId: string;
  confirmed: number;
  waitlisted: number;
  checkedIn: number;
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

  return (
    <main className="app-shell mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="hero-glow" />

      <section className="stagger-enter rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 p-6 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Live Operations</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Real-time Attendance Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-200">Event ID: {eventId}</p>
          </div>
          <Link
            to="/panel"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Back to Panel
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Pill tone="brand">Socket.IO Connected</Pill>
          <Pill tone="slate">Auto Refresh on Check-in</Pill>
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

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="stagger-enter stagger-1" title="Confirmed Attendees" subtitle="Eligible for check-in">
          <p className="font-heading text-5xl font-bold text-slate-900">{data?.confirmed ?? 0}</p>
        </Card>
        <Card className="stagger-enter stagger-2" title="Waitlisted" subtitle="Pending promotion if slots free">
          <p className="font-heading text-5xl font-bold text-slate-900">{data?.waitlisted ?? 0}</p>
        </Card>
        <Card className="stagger-enter stagger-3" title="Checked In" subtitle="Successful non-duplicate scans">
          <p className="font-heading text-5xl font-bold text-slate-900">{data?.checkedIn ?? 0}</p>
        </Card>
      </section>

      <Card
        className="stagger-enter stagger-4 mt-5"
        title="Manual Check-in"
        subtitle="Enter a ticket ID to perform a manual check-in."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <FieldLabel>Ticket ID</FieldLabel>
            <Input
              placeholder="Paste ticket ID here"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={manualCheckIn} disabled={isCheckingIn}>
              {isCheckingIn ? "Checking in..." : "Manual Check-in"}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        className="stagger-enter stagger-5 mt-5"
        title="Recent Check-ins"
        subtitle="Latest 10 records ordered by check-in time"
        headerRight={
          <Button onClick={loadDashboard} disabled={isLoading} variant="ghost">
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      >
        <div className="space-y-3">
          {data?.recentCheckins?.length ? (
            data.recentCheckins.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.ticket.attendee.name}</p>
                    <p className="text-sm text-slate-600">{item.ticket.attendee.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={item.isDuplicate ? "warm" : "brand"}>
                      {item.isDuplicate ? "Duplicate" : "Valid"}
                    </Pill>
                    <Pill tone="slate">{item.method}</Pill>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{new Date(item.checkedInAt).toLocaleString()}</p>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
              No check-ins yet.
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
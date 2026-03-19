import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill } from "../components/ui";
import { apiFetch } from "../lib/api";
import { useSessionQuery } from "../lib/session";
import type { Html5Qrcode } from "html5-qrcode";

type EventItem = {
  id: string;
  title: string;
  location: string;
  description?: string | null;
  startTime: string;
  capacity: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
};

type DashboardResponse = {
  eventId: string;
  capacity: number;
  confirmed: number;
  waitlisted: number;
  checkedIn: number;
  checkedInPct: number;
  confirmedAttendees: Array<{
    id: string;
    attendeeId: string;
    registeredAt: string;
    attendee: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  waitlistedAttendees: Array<{
    id: string;
    attendeeId: string;
    waitlistPosition: number | null;
    registeredAt: string;
    attendee: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  recentCheckins: Array<{
    id: string;
    ticketId: string;
    method: "QR" | "MANUAL";
    isDuplicate: boolean;
    checkedInAt: string;
    ticket: {
      attendee: {
        id: string;
        name: string;
        email: string;
      };
    };
  }>;
};

type CheckinResponse = {
  id: string;
  eventId: string;
  ticketId: string;
  staffId: string;
  method: "QR" | "MANUAL";
  isDuplicate: boolean;
  checkedInAt: string;
};

type CheckinResult = {
  mode: "QR" | "MANUAL";
  ticketId: string;
  isDuplicate: boolean;
  checkedInAt: string;
  note: string;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatCheckinNote(result: CheckinResult) {
  return result.isDuplicate
    ? `Duplicate ${result.mode.toLowerCase()} check-in recorded for ticket ${result.ticketId}.`
    : `${result.mode === "QR" ? "QR" : "Manual"} check-in succeeded for ticket ${result.ticketId}.`;
}

async function loadHtml5QrModule() {
  return import("html5-qrcode");
}

export function StaffCheckinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery(true);
  const currentUser = sessionQuery.data;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanBusyRef = useRef(false);

  const [manualTicketId, setManualTicketId] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);

  const scannerRegionId = useMemo(() => {
    const normalized = (eventId ?? "event").replace(/[^a-zA-Z0-9_-]/g, "");
    return `checkin-reader-${normalized || "event"}`;
  }, [eventId]);

  const canUseCheckinPage = currentUser?.role === "ORGANIZER" || currentUser?.role === "STAFF";

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiFetch<EventItem>(`/api/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", eventId],
    queryFn: () => apiFetch<DashboardResponse>(`/api/events/${eventId}/dashboard`),
    enabled: Boolean(eventId && canUseCheckinPage),
    refetchInterval: isScannerActive ? 10_000 : false,
  });

  const refreshOperationalData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", eventId] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["my-events"] }),
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] }),
    ]);
  };

  const manualCheckin = useMutation({
    mutationFn: async (ticketId: string) =>
      apiFetch<CheckinResponse>("/api/checkins/manual", {
        method: "POST",
        body: JSON.stringify({ ticketId }),
      }),
    onSuccess: async (payload, ticketId) => {
      const result: CheckinResult = {
        mode: "MANUAL",
        ticketId,
        isDuplicate: payload.isDuplicate,
        checkedInAt: payload.checkedInAt,
        note: "",
      };
      result.note = formatCheckinNote(result);
      setLastResult(result);
      setManualTicketId("");
      setScannerError("");
      setScannerMessage(result.note);
      await refreshOperationalData();
    },
    onError: (error: Error) => {
      setScannerError(error.message);
      setScannerMessage("");
    },
  });

  const scanCheckin = useMutation({
    mutationFn: async (qrPayload: string) =>
      apiFetch<CheckinResponse>("/api/checkins/scan", {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      }),
    onSuccess: async (payload, qrPayload) => {
      let ticketId = payload.ticketId;
      try {
        const parsed = JSON.parse(qrPayload) as { ticketId?: string };
        if (parsed.ticketId) {
          ticketId = parsed.ticketId;
        }
      } catch {
        // keep fallback from API response
      }

      const result: CheckinResult = {
        mode: "QR",
        ticketId,
        isDuplicate: payload.isDuplicate,
        checkedInAt: payload.checkedInAt,
        note: "",
      };
      result.note = formatCheckinNote(result);
      setLastResult(result);
      setScannerError("");
      setScannerMessage(result.note);
      await refreshOperationalData();
    },
    onError: (error: Error) => {
      setScannerError(error.message);
      setScannerMessage("");
    },
    onSettled: () => {
      scanBusyRef.current = false;
    },
  });

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScannerActive(false);
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // noop: scanner may already be stopped
    }

    try {
      await scanner.clear();
    } catch {
      // noop
    }

    scannerRef.current = null;
    setIsScannerActive(false);
  }

  async function startScanner() {
    if (isScannerActive || scanCheckin.isPending) {
      return;
    }

    setScannerError("");
    setScannerMessage("Opening camera...");

    try {
      // const { Html5Qrcode } = await loadHtml5QrModule();
      // const scanner = new Html5Qrcode(scannerRegionId);
      // scannerRef.current = scanner;

      // await scanner.start(
      //   { facingMode: "environment" },
      //   { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
      //   async (decodedText) => {
      //     if (scanBusyRef.current) {
      //       return;
      //     }
      //     scanBusyRef.current = true;
      //     await stopScanner();
      //     await scanCheckin.mutateAsync(decodedText);
      //   },
      //   () => {
      //     // ignore frame-level decode noise
      //   },
      // );

      const { Html5Qrcode } = await loadHtml5QrModule();
      const scanner = new Html5Qrcode(scannerRegionId);
      scannerRef.current = scanner;

      // const cameras = await Html5Qrcode.getCameras();
      // if (!cameras || cameras.length === 0) {
      //   throw new Error("No camera devices were found.");
      // }

      // // 优先找后置/环境摄像头；找不到就退回第一个可用摄像头
      // const preferredCamera =
      //   cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ?? cameras[0];

      // await scanner.start(
      //   preferredCamera.id,
      //   {
      //     fps: 10,
      //     qrbox: { width: 220, height: 220 },
      //   },
      //   async (decodedText) => {
      //     if (scanBusyRef.current) return;
      //     scanBusyRef.current = true;
      //     await stopScanner();
      //     await scanCheckin.mutateAsync(decodedText);
      //   },
      //   () => {
      //     // ignore frame-level decode noise
      //   },
      // );

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error("No camera devices were found.");
      }

      const fallbackCamera = cameras[0];
      if (!fallbackCamera) {
        throw new Error("No camera devices were found.");
      }

      // 优先找后置/环境摄像头；找不到就退回第一个可用摄像头
      const preferredCamera =
        cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ?? fallbackCamera;

      await scanner.start(
        preferredCamera.id,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText) => {
          if (scanBusyRef.current) return;
          scanBusyRef.current = true;
          await stopScanner();
          await scanCheckin.mutateAsync(decodedText);
        },
        () => {
          // ignore frame-level decode noise
        },
      );


      setIsScannerActive(true);
      setScannerMessage("Camera is active. Point the QR code at the scan area.");
    } catch (error) {
      scannerRef.current = null;
      setIsScannerActive(false);
      setScannerMessage("");
      setScannerError(error instanceof Error ? error.message : "Unable to start the camera scanner.");
    }
  }

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const event = eventQuery.data;
  const dashboard = dashboardQuery.data;
  const remainingConfirmed = Math.max((dashboard?.confirmed ?? 0) - (dashboard?.checkedIn ?? 0), 0);
  const recentCheckins = dashboard?.recentCheckins ?? [];
  const confirmedAttendees = dashboard?.confirmedAttendees ?? [];
  const waitlistedAttendees = dashboard?.waitlistedAttendees ?? [];

  if (sessionQuery.isLoading) {
    return (
      <main className="app-shell mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <p className="rounded-2xl bg-slate-100/80 px-4 py-3 text-sm text-slate-600">Loading session...</p>
      </main>
    );
  }

  if (!canUseCheckinPage) {
    return (
      <main className="app-shell mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <Card
          title="Check-in Workstation"
          subtitle="Only organizer and staff accounts can run event check-ins."
          headerRight={<Pill tone="warm">Access Limited</Pill>}
        >
          <p className="text-sm text-slate-700">
            Switch to an organizer or staff account to access live QR scanning and manual check-in tools.
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
    <main className="app-shell mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="hero-glow" />

      <section className="stagger-enter rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 p-6 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Check-in Workstation</p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">Live Staff Check-in Console</h1>
            <p className="mt-2 text-sm text-slate-200">
              Scan attendee QR codes with the camera, or enter a ticket ID manually when a fallback is needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/panel"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Back to Panel
            </Link>
            {eventId ? (
              <Link
                to={`/panel/events/${eventId}/dashboard`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Open Dashboard
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Confirmed</p>
            <p className="mt-1 text-2xl font-bold">{dashboard?.confirmed ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Checked In</p>
            <p className="mt-1 text-2xl font-bold">{dashboard?.checkedIn ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Waiting</p>
            <p className="mt-1 text-2xl font-bold">{remainingConfirmed}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs text-slate-200">Waitlist</p>
            <p className="mt-1 text-2xl font-bold">{dashboard?.waitlisted ?? 0}</p>
          </div>
        </div>
      </section>

      {dashboardQuery.isError ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(dashboardQuery.error as Error).message}
        </div>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <Card
            className="stagger-enter stagger-1"
            title="QR Camera Scan"
            subtitle="Use the attendee QR wallet for the fastest on-site check-in flow."
            headerRight={<Pill tone={isScannerActive ? "brand" : "slate"}>{isScannerActive ? "Camera Live" : "Ready"}</Pill>}
          >
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {/* <div
                  id={scannerRegionId}
                  className="mx-auto flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500"
                >
                  {!isScannerActive ? "Camera preview will appear here after you start scanning." : null}
                </div> */}
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {!isScannerActive ? (
                    <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                      Camera preview will appear here after you start scanning.
                    </div>
                  ) : null}

                  <div
                    id={scannerRegionId}
                    className="mx-auto min-h-[260px] overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-black
                      [&>div]:w-full
                      [&_video]:block
                      [&_video]:h-[320px]
                      [&_video]:w-full
                      [&_video]:object-cover"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void startScanner()} disabled={isScannerActive || scanCheckin.isPending || !eventId}>
                  {scanCheckin.isPending ? "Submitting scan..." : isScannerActive ? "Scanner Running" : "Start Camera Scan"}
                </Button>
                <Button variant="ghost" onClick={() => void stopScanner()} disabled={!isScannerActive}>
                  Stop Camera
                </Button>
                <Button variant="secondary" onClick={() => dashboardQuery.refetch()} disabled={dashboardQuery.isFetching || !eventId}>
                  {dashboardQuery.isFetching ? "Refreshing..." : "Refresh Check-in Feed"}
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Camera tips</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>• Let the browser access your camera when prompted.</li>
                  <li>• Ask the attendee to open the QR code from the ticket wallet page.</li>
                  <li>• After one successful scan, the camera stops automatically to avoid duplicate reads.</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card
            className="stagger-enter stagger-2"
            title="Manual Ticket Fallback"
            subtitle="Use this when the attendee QR code cannot be scanned clearly."
            headerRight={<Pill tone="warm">Fallback</Pill>}
          >
            <div className="space-y-4">
              <div>
                <FieldLabel>Ticket ID</FieldLabel>
                <Input
                  placeholder="Paste or type the attendee ticket ID"
                  value={manualTicketId}
                  onChange={(event) => setManualTicketId(event.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  The attendee can copy the ticket ID directly from the ticket wallet page if QR scanning is unavailable.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => manualCheckin.mutate(manualTicketId.trim())}
                  disabled={!manualTicketId.trim() || manualCheckin.isPending}
                >
                  {manualCheckin.isPending ? "Submitting manual check-in..." : "Submit Manual Check-in"}
                </Button>
                <Button variant="ghost" onClick={() => setManualTicketId("")} disabled={!manualTicketId}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          <Card
            className="stagger-enter stagger-3"
            title="Latest Action"
            subtitle="Review the most recent check-in response before moving to the next attendee."
            headerRight={lastResult ? <Pill tone={lastResult.isDuplicate ? "warm" : "brand"}>{lastResult.isDuplicate ? "Duplicate" : "Accepted"}</Pill> : null}
          >
            {scannerMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{scannerMessage}</div>
            ) : null}
            {scannerError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{scannerError}</div>
            ) : null}

            {lastResult ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{lastResult.ticketId}</p>
                  <p className="mt-2 text-sm text-slate-600">Mode: {lastResult.mode}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded At</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{formatDateTime(lastResult.checkedInAt)}</p>
                  <p className="mt-2 text-sm text-slate-600">{lastResult.note}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                No check-in action has been submitted yet.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            className="stagger-enter stagger-4"
            title="Event Context"
            subtitle="Use the event summary below to confirm you are checking attendees into the correct session."
            headerRight={event ? <Pill tone="brand">{event.status}</Pill> : null}
          >
            {eventQuery.isLoading ? (
              <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading event...</p>
            ) : eventQuery.isError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{(eventQuery.error as Error).message}</p>
            ) : event ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{event.location}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateTime(event.startTime)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance Snapshot</p>
                  <p className="mt-2 text-sm text-slate-700">Capacity: {dashboard?.capacity ?? event.capacity}</p>
                  <p className="mt-1 text-sm text-slate-700">Confirmed: {dashboard?.confirmed ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-700">Checked In: {dashboard?.checkedIn ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-700">Completion: {dashboard?.checkedInPct ?? 0}%</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                Event context is unavailable.
              </div>
            )}
          </Card>

          <Card
            className="stagger-enter stagger-5"
            title="Recent Check-ins"
            subtitle="The newest scans and manual entries appear here after each refresh."
            headerRight={<Pill tone="slate">{recentCheckins.length}</Pill>}
          >
            <div className="space-y-3">
              {recentCheckins.length ? (
                recentCheckins.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.ticket.attendee.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.ticket.attendee.email}</p>
                        <p className="mt-1 text-xs text-slate-500">Ticket ID: {item.ticketId}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Pill tone={item.isDuplicate ? "warm" : "brand"}>{item.isDuplicate ? "Duplicate" : item.method}</Pill>
                        <p className="text-xs text-slate-500">{formatDateTime(item.checkedInAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                  No check-ins recorded for this event yet.
                </div>
              )}
            </div>
          </Card>

          <Card
            className="stagger-enter stagger-6"
            title="Attendee Snapshot"
            subtitle="Use this quick list to confirm who should still be waiting to enter."
            headerRight={<Pill tone="slate">{confirmedAttendees.length} confirmed</Pill>}
          >
            <div className="space-y-3">
              {confirmedAttendees.length ? (
                confirmedAttendees.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.attendee.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.attendee.email}</p>
                      </div>
                      <p className="text-xs text-slate-500">Registered {formatDateTime(item.registeredAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
                  No confirmed attendees are currently listed.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Waitlist Preview</p>
                <Pill tone="warm">{waitlistedAttendees.length}</Pill>
              </div>
              {waitlistedAttendees.length ? (
                <div className="mt-3 space-y-2">
                  {waitlistedAttendees.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {item.attendee.name} — position {item.waitlistPosition ?? "-"}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No attendees are currently waitlisted.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

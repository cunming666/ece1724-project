import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, Pill } from "../ui";

type StaffPanelProps = {
  currentUserRole?: string;
  stats: {
    activeTickets: number;
    checkedInTickets: number;
  };
};

export const StaffPanel = memo(function StaffPanel({ currentUserRole, stats }: StaffPanelProps) {
  if (currentUserRole === "ATTENDEE") {
    return (
      <>
        <Card
          className="stagger-enter stagger-2"
          title="My Tickets"
          subtitle="View your tickets and QR code."
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
            <p className="self-center text-xs text-slate-600">Open your ticket page to view the QR code.</p>
          </div>
        </Card>

        <Card className="stagger-enter stagger-3" title="How to Use" subtitle="Basic attendee flow.">
          <ol className="space-y-2 text-sm text-slate-700">
            <li>1. Organizer adds you to an event.</li>
            <li>2. Open My Tickets.</li>
            <li>3. Show the QR code to staff.</li>
            <li>4. Staff scans the code or enters the ticket ID.</li>
          </ol>
        </Card>
      </>
    );
  }

  return (
    <>
      <Card
        className="stagger-enter stagger-2"
        title="Staff"
        subtitle="Open an event, then start check-in or view the dashboard."
        headerRight={<Pill tone="slate">{currentUserRole === "ORGANIZER" ? "Organizer" : "Staff"}</Pill>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Open Event Board</p>
            <p className="mt-2 text-sm text-slate-600">Choose an event.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Open Check-in</p>
            <p className="mt-2 text-sm text-slate-600">Scan the QR code or enter the ticket ID.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Check Status</p>
            <p className="mt-2 text-sm text-slate-600">Open the dashboard to confirm the update.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/panel/events"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Event Board
          </Link>
          <Link
            to="/panel"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
          >
            Overview
          </Link>
        </div>
      </Card>

      <Card className="stagger-enter stagger-3" title="Check-in Steps" subtitle="Standard staff flow.">
        <ol className="space-y-2 text-sm text-slate-700">
          <li>1. Open the Event Board.</li>
          <li>2. Choose an event and open Check-in.</li>
          <li>3. Scan the QR code or enter a ticket ID manually.</li>
          <li>4. Open the dashboard to confirm the result.</li>
        </ol>
      </Card>

      <Card className="stagger-enter stagger-4" title="Manual Entry" subtitle="Use this when the QR code cannot be scanned.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">When to use it</p>
            <p className="mt-2 text-sm text-slate-600">When camera access fails or the QR code is unclear.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Required</p>
            <p className="mt-2 text-sm text-slate-600">The ticket ID from the My Tickets page.</p>
          </div>
        </div>
      </Card>
    </>
  );
});


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
    );
  }

  return (
    <>
      <Card
        className="stagger-enter stagger-2"
        title="Staff Operations"
        subtitle="Staff users can launch the live check-in workstation or open dashboards for events they support."
        headerRight={<Pill tone="slate">Staff</Pill>}
      >
        <p className="text-sm text-slate-700">
          Staff accounts cannot create events, but they can open assigned event dashboards and use the new check-in workstation for QR or manual entry.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Use the <span className="font-semibold text-slate-900">Open Check-in</span> button in the published event board to launch the staff workstation for a live event.
        </div>
      </Card>

      <Card className="stagger-enter stagger-3" title="Project Workflow" subtitle="Recommended staff flow for your team demo.">
        <ol className="space-y-2 text-sm text-slate-700">
          <li>1. Sign in as staff.</li>
          <li>2. Open the dashboard for an assigned event.</li>
          <li>3. Open the Check-in page for the target event and scan attendee QR codes or type ticket IDs manually.</li>
          <li>4. Use the dashboard refresh button to confirm live attendance changes.</li>
        </ol>
      </Card>
    </>
  );
});


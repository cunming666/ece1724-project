import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Pill } from "../ui";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
};

type OverviewRange = "TODAY" | "WEEK";

type OverviewStats = {
  drafts: number;
  activeTickets: number;
  checkedInTickets: number;
  role: string;
};

type OverviewRangeMeta = {
  label: string;
};

type OverviewBar = {
  label: string;
  heightPct: number;
};

type OverviewPanelProps = {
  currentUserRole?: string;
  overviewRange: OverviewRange;
  onChangeRange: (range: OverviewRange) => void;
  overviewRangeMeta: OverviewRangeMeta;
  overviewScopedEvents: EventItem[];
  overviewUpcomingEvents: EventItem[];
  overviewRangeDelta: number;
  upcomingCoveragePct: number;
  nextUpcomingEvent: EventItem | null;
  nextEventCountdownLabel: string;
  overviewBars: OverviewBar[];
  stats: OverviewStats;
};

export const OverviewPanel = memo(function OverviewPanel({
  currentUserRole,
  overviewRange,
  onChangeRange,
  overviewRangeMeta,
  overviewScopedEvents,
  overviewUpcomingEvents,
  overviewRangeDelta,
  upcomingCoveragePct,
  nextUpcomingEvent,
  nextEventCountdownLabel,
  overviewBars,
  stats,
}: OverviewPanelProps) {
  const [isRangeSwitching, setIsRangeSwitching] = useState(false);

  useEffect(() => {
    setIsRangeSwitching(true);
    const timer = window.setTimeout(() => setIsRangeSwitching(false), 180);
    return () => window.clearTimeout(timer);
  }, [overviewRange]);

  const statCards = useMemo(
    () => [
      {
        key: "range",
        label: overviewRangeMeta.label,
        value: overviewScopedEvents.length,
        helper: (
          <span
            className={`rounded-full px-2 py-1 ${
              overviewRangeDelta > 0
                ? "bg-emerald-100 text-emerald-700"
                : overviewRangeDelta < 0
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {overviewRangeDelta > 0 ? `+${overviewRangeDelta}` : overviewRangeDelta} vs previous {overviewRange === "TODAY" ? "day" : "week"}
          </span>
        ),
      },
      {
        key: "upcoming",
        label: "Upcoming",
        value: overviewUpcomingEvents.length,
        helper: <span className="text-xs text-slate-600">{upcomingCoveragePct}% of scheduled events are upcoming.</span>,
      },
      {
        key: "drafts",
        label: "Drafts",
        value: stats.drafts,
        helper: <span className="text-xs text-slate-600">Ready to publish from Organizer Studio.</span>,
      },
      {
        key: "tickets",
        label: "Active Tickets",
        value: stats.activeTickets,
        helper: <span className="text-xs text-slate-600">{stats.checkedInTickets} already checked in.</span>,
      },
    ],
    [
      overviewRange,
      overviewRangeDelta,
      overviewRangeMeta.label,
      overviewScopedEvents.length,
      overviewUpcomingEvents.length,
      upcomingCoveragePct,
      stats.drafts,
      stats.activeTickets,
      stats.checkedInTickets,
    ],
  );

  return (
    <>
      <Card
        className="stagger-enter stagger-2"
        title="Overview Snapshot"
        subtitle="Key numbers first, then drill into role modules."
        headerRight={
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => onChangeRange("TODAY")}
              data-testid="overview-range-today"
              aria-pressed={overviewRange === "TODAY"}
              className={`overview-range-btn rounded-lg px-3 py-1 text-xs font-semibold transition ${
                overviewRange === "TODAY" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onChangeRange("WEEK")}
              data-testid="overview-range-week"
              aria-pressed={overviewRange === "WEEK"}
              className={`overview-range-btn rounded-lg px-3 py-1 text-xs font-semibold transition ${
                overviewRange === "WEEK" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Week
            </button>
          </div>
        }
      >
        {isRangeSwitching ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="overview-skeleton">
            <p data-testid="overview-range-count" className="sr-only">{overviewScopedEvents.length}</p>
            <p data-testid="overview-upcoming-count" className="sr-only">{overviewUpcomingEvents.length}</p>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-8 w-14 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-28 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-200">
            {statCards.map((card) => (
              <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
                <p data-testid={card.key === "range" ? "overview-range-count" : undefined} className="mt-2 text-3xl font-bold text-slate-900">
                  {card.value}
                </p>
                <div className="mt-2 text-xs font-semibold">{card.helper}</div>
                {card.key === "upcoming" ? (
                  <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${upcomingCoveragePct}%` }} />
                    </div>
                    <p data-testid="overview-upcoming-count" className="sr-only">
                      {overviewUpcomingEvents.length}
                    </p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Next Event ({overviewRangeMeta.label})</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {nextUpcomingEvent ? nextUpcomingEvent.title : `No upcoming events in ${overviewRangeMeta.label.toLowerCase()}`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {nextUpcomingEvent
                  ? `${nextUpcomingEvent.location} - ${new Date(nextUpcomingEvent.startTime).toLocaleString()}`
                  : "Switch range or publish an event to populate this panel."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="slate">{stats.role}</Pill>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">{nextEventCountdownLabel}</span>
            </div>
          </div>

          <div className="mt-4 flex h-24 items-end gap-2" aria-live="polite">
            {overviewBars.map((item, index) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-500"
                  style={{ height: `${item.heightPct}%`, transitionDelay: `${index * 35}ms` }}
                  role="img"
                  aria-label={`${item.label} value ${item.heightPct} percent`}
                />
                <span className="text-[11px] font-semibold text-slate-500">{item.label}</span>
                <span className="sr-only">{`${item.label} ${item.heightPct} percent`}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="stagger-enter stagger-3" title="Quick Actions" subtitle="Jump to the module you need without searching.">
        <div className="grid gap-2 sm:grid-cols-2">
          {currentUserRole === "ORGANIZER" ? (
            <Link
              to="/panel/organizer"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Open Organizer Studio
            </Link>
          ) : null}
          {(currentUserRole === "ORGANIZER" || currentUserRole === "STAFF") ? (
            <Link
              to="/panel/staff"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
            >
              Open Staff Console
            </Link>
          ) : null}
          {currentUserRole === "ATTENDEE" ? (
            <Link
              to="/panel/tickets"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
            >
              Open My Tickets
            </Link>
          ) : null}
          <Link
            to="/panel/events"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
          >
            Open Event Board
          </Link>
        </div>
      </Card>

      <Card
        className="stagger-enter stagger-4"
        title="Upcoming Timeline"
        subtitle={`Sorted by nearest schedule for ${overviewRangeMeta.label.toLowerCase()}.`}
        headerRight={<Pill tone="slate">{overviewScopedEvents.length}</Pill>}
      >
        <div className="space-y-3">
          {overviewScopedEvents.slice(0, 5).map((event) => (
            <article key={event.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(event.startTime).toLocaleString()}</p>
                </div>
                <Pill tone={event.status === "PUBLISHED" ? "brand" : "slate"}>{event.status}</Pill>
              </div>
            </article>
          ))}
          {!overviewScopedEvents.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No events scheduled for {overviewRangeMeta.label.toLowerCase()}.
            </div>
          ) : null}
        </div>
      </Card>
    </>
  );
});


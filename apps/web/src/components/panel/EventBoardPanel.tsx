import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, Pill } from "../ui";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  capacity: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  coverFileId: string | null;
};

type EventBoardPanelProps = {
  eventsLoading: boolean;
  eventsError: boolean;
  boardEvents: EventItem[];
  coverPreviewUrlsByEvent: Record<string, string>;
  currentUserRole?: string;
  isOverviewMode: boolean;
  overviewRangeLabel: string;
  showViewAll: boolean;
};

export const EventBoardPanel = memo(function EventBoardPanel({
  eventsLoading,
  eventsError,
  boardEvents,
  coverPreviewUrlsByEvent,
  currentUserRole,
  isOverviewMode,
  overviewRangeLabel,
  showViewAll,
}: EventBoardPanelProps) {
  return (
    <Card
      className="stagger-enter stagger-6"
      title="Event Board"
      subtitle="Published events."
      headerRight={<Pill tone="slate">Published</Pill>}
    >
      {eventsLoading ? <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading events...</p> : null}

      {eventsError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load events.</p> : null}

      <div className="space-y-3">
        {boardEvents.length ? (
          boardEvents.map((event) => (
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

              {coverPreviewUrlsByEvent[event.id] ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <img src={coverPreviewUrlsByEvent[event.id]} alt={`${event.title} cover`} className="h-36 w-full object-cover" />
                </div>
              ) : event.coverFileId ? (
                <p className="mt-3 text-xs text-slate-500">Cover available.</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(currentUserRole === "ORGANIZER" || currentUserRole === "STAFF") && (
                  <>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                      to={`/panel/events/${event.id}/attendees`}
                    >
                      View Roster
                    </Link>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
                      to={`/panel/events/${event.id}/dashboard`}
                    >
                      Open Dashboard
                    </Link>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                      to={`/panel/events/${event.id}/checkin`}
                    >
                      Open Check-in
                    </Link>
                  </>
                )}

                {currentUserRole === "ATTENDEE" ? (
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
            {isOverviewMode ? `No events in ${overviewRangeLabel.toLowerCase()}.` : "No published events."}
          </div>
        )}
      </div>
      {showViewAll ? (
        <div className="mt-4">
          <Link
            to="/panel/events"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
          >
            View All Events
          </Link>
        </div>
      ) : null}
    </Card>
  );
});


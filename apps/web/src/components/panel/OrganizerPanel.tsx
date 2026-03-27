import { Link } from "react-router-dom";
import { Button, Card, FieldLabel, Input, Pill, Select } from "../ui";

type EventItem = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  capacity: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  coverFileId: string | null;
};

type StaffAssignmentItem = {
  id: string;
  userId: string;
  user: {
    name: string;
    email: string;
  } | null;
};

type CsvImportIssue = {
  rowNumber: number;
  reason: string;
};

type CsvImportSummary = {
  totalRows: number;
  importedRows: number;
  invalidRows: number;
  duplicateRows: number;
  confirmedRows: number;
  waitlistedRows: number;
};

type CsvImportResponse = {
  summary: CsvImportSummary;
  issues: CsvImportIssue[];
};

type CsvImportHistoryItem = {
  id: string;
  fileId: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  summary: CsvImportSummary | null;
};

type OrganizerPanelProps = {
  eventForm: {
    title: string;
    location: string;
    startTime: string;
    capacity: number;
  };
  onEventFormChange: (patch: Partial<{ title: string; location: string; startTime: string; capacity: number }>) => void;
  createEventState: {
    isPending: boolean;
    onCreate: () => void;
  };
  myEventsState: {
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
  };
  draftEvents: EventItem[];
  myPublishedEvents: EventItem[];
  coverFilesByEvent: Record<string, File | null>;
  coverPreviewUrlsByEvent: Record<string, string>;
  onCoverFileChange: (eventId: string, file: File | null) => void;
  uploadEventCoverState: {
    isPending: boolean;
    variables?: string;
    onUpload: (eventId: string) => void;
  };
  publishEventState: {
    isPending: boolean;
    variables?: string;
    onPublish: (eventId: string) => void;
  };
  selectedEventId: string;
  onSelectEventId: (eventId: string) => void;
  staffEmail: string;
  onStaffEmailChange: (email: string) => void;
  assignStaffState: {
    isPending: boolean;
    onAssign: () => void;
  };
  staffAssignmentsState: {
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    items: StaffAssignmentItem[];
    onRefresh: () => void;
  };
  removeStaffState: {
    isPending: boolean;
    onRemove: (userId: string) => void;
  };
  csvState: {
    file: File | null;
    result: CsvImportResponse | null;
    onFileChange: (file: File | null) => void;
    onClear: () => void;
    onClearResult: () => void;
  };
  importCsvState: {
    isPending: boolean;
    onImport: () => void;
  };
  importHistoryState: {
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    items: CsvImportHistoryItem[];
    onRefresh: () => void;
  };
};

export function OrganizerPanel({
  eventForm,
  onEventFormChange,
  createEventState,
  myEventsState,
  draftEvents,
  myPublishedEvents,
  coverFilesByEvent,
  coverPreviewUrlsByEvent,
  onCoverFileChange,
  uploadEventCoverState,
  publishEventState,
  selectedEventId,
  onSelectEventId,
  staffEmail,
  onStaffEmailChange,
  assignStaffState,
  staffAssignmentsState,
  removeStaffState,
  csvState,
  importCsvState,
  importHistoryState,
}: OrganizerPanelProps) {
  return (
    <div className="space-y-5">
      <Card
        className="stagger-enter stagger-2"
        title="Create Event"
        subtitle="Organizer creates a draft event first, then publishes it from My Event Studio."
        headerRight={<Pill tone="warm">Organizer Studio</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Event Title</FieldLabel>
            <Input placeholder="ECE1724 Demo Day" value={eventForm.title} onChange={(e) => onEventFormChange({ title: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <Input placeholder="Bahen Centre Room 1130" value={eventForm.location} onChange={(e) => onEventFormChange({ location: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Start Time</FieldLabel>
            <Input type="datetime-local" value={eventForm.startTime} onChange={(e) => onEventFormChange({ startTime: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Capacity</FieldLabel>
            <Input type="number" min={1} value={String(eventForm.capacity)} onChange={(e) => onEventFormChange({ capacity: Number(e.target.value) })} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={createEventState.onCreate} disabled={createEventState.isPending}>
            {createEventState.isPending ? "Creating..." : "Create Draft Event"}
          </Button>
          <p className="text-xs text-slate-600">Drafts appear below immediately and can be published without leaving the UI.</p>
        </div>
      </Card>

      <Card
        className="stagger-enter stagger-3"
        title="My Event Studio"
        subtitle="Review your draft events, publish them, launch live dashboards, or open the check-in workstation."
        headerRight={<Pill tone="brand">Publish in UI</Pill>}
      >
        {myEventsState.isLoading ? <p className="rounded-xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600">Loading your events...</p> : null}

        {myEventsState.isError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{myEventsState.errorMessage}</p> : null}

        <div className="space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-heading text-lg font-semibold text-slate-900">Draft Events</h3>
              <Pill tone="warm">{draftEvents.length}</Pill>
            </div>
            {draftEvents.length ? (
              <div className="space-y-3">
                {draftEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(event.startTime).toLocaleString()} | capacity {event.capacity}
                        </p>
                      </div>
                      <Pill tone="warm">{event.status}</Pill>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <FieldLabel>Event Cover</FieldLabel>
                      <Input type="file" accept="image/*" onChange={(e) => onCoverFileChange(event.id, e.target.files?.[0] ?? null)} />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => uploadEventCoverState.onUpload(event.id)}
                          disabled={!coverFilesByEvent[event.id] || (uploadEventCoverState.isPending && uploadEventCoverState.variables === event.id)}
                        >
                          {uploadEventCoverState.isPending && uploadEventCoverState.variables === event.id ? "Uploading..." : "Upload Cover"}
                        </Button>
                        <span className="text-xs text-slate-600">{event.coverFileId ? "Cover attached" : "No cover uploaded yet"}</span>
                      </div>
                      {coverPreviewUrlsByEvent[event.id] ? (
                        <img src={coverPreviewUrlsByEvent[event.id]} alt={`${event.title} cover`} className="mt-3 h-28 w-full rounded-xl object-cover" />
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => publishEventState.onPublish(event.id)}
                        disabled={publishEventState.isPending && publishEventState.variables === event.id}
                      >
                        {publishEventState.isPending && publishEventState.variables === event.id ? "Publishing..." : "Publish Event"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm text-slate-600">
                No drafts yet. Create an event above to start your organizer workflow.
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-heading text-lg font-semibold text-slate-900">Published by You</h3>
              <Pill tone="slate">{myPublishedEvents.length}</Pill>
            </div>
            {myPublishedEvents.length ? (
              <div className="space-y-3">
                {myPublishedEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        <p className="mt-1 text-sm text-slate-600">{event.location}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(event.startTime).toLocaleString()} | capacity {event.capacity}
                        </p>
                      </div>
                      <Pill tone="brand">{event.status}</Pill>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <FieldLabel>Event Cover</FieldLabel>
                      <Input type="file" accept="image/*" onChange={(e) => onCoverFileChange(event.id, e.target.files?.[0] ?? null)} />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => uploadEventCoverState.onUpload(event.id)}
                          disabled={!coverFilesByEvent[event.id] || (uploadEventCoverState.isPending && uploadEventCoverState.variables === event.id)}
                        >
                          {uploadEventCoverState.isPending && uploadEventCoverState.variables === event.id ? "Uploading..." : "Upload Cover"}
                        </Button>
                        <span className="text-xs text-slate-600">{event.coverFileId ? "Cover attached" : "No cover uploaded yet"}</span>
                      </div>
                      {coverPreviewUrlsByEvent[event.id] ? (
                        <img src={coverPreviewUrlsByEvent[event.id]} alt={`${event.title} cover`} className="mt-3 h-28 w-full rounded-xl object-cover" />
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/panel/events/${event.id}/dashboard`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/70 px-4 text-sm font-semibold text-slate-800 transition hover:bg-white"
                      >
                        Open Dashboard
                      </Link>
                      <Link
                        to={`/panel/events/${event.id}/checkin`}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                      >
                        Open Check-in
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm text-slate-600">
                Publish a draft to make it appear in the shared board.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        className="stagger-enter stagger-4"
        title="Staff Assignment"
        subtitle="Assign staff accounts to one of your published events by email."
        headerRight={<Pill tone="brand">P0-5</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Select Published Event</FieldLabel>
            <Select value={selectedEventId} onChange={(e) => onSelectEventId(e.target.value)}>
              <option value="">Choose one of your published events</option>
              {myPublishedEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.status})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel>Staff Email</FieldLabel>
            <Input placeholder="staff@test.com" value={staffEmail} onChange={(e) => onStaffEmailChange(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={assignStaffState.onAssign} disabled={assignStaffState.isPending || !selectedEventId}>
            {assignStaffState.isPending ? "Assigning..." : "Assign Staff"}
          </Button>
          <Button variant="secondary" onClick={staffAssignmentsState.onRefresh} disabled={!selectedEventId || staffAssignmentsState.isFetching}>
            {staffAssignmentsState.isFetching ? "Refreshing..." : "Refresh Staff List"}
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Assigned Staff</p>

          {!selectedEventId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Publish one of your events first, then select it here to manage staff assignments.
            </div>
          ) : staffAssignmentsState.isLoading ? (
            <div className="rounded-2xl bg-slate-100/80 px-4 py-5 text-sm text-slate-600">Loading staff...</div>
          ) : staffAssignmentsState.isError ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-5 text-sm text-rose-700">Failed to load staff assignments.</div>
          ) : staffAssignmentsState.items.length ? (
            <div className="space-y-3">
              {staffAssignmentsState.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.user?.name ?? "Unknown Staff"}</p>
                    <p className="text-xs text-slate-600">{item.user?.email ?? "unknown@example.com"}</p>
                  </div>
                  <Button variant="danger" onClick={() => removeStaffState.onRemove(item.userId)} disabled={removeStaffState.isPending}>
                    {removeStaffState.isPending ? "Removing..." : "Remove"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No staff assigned to this event yet.
            </div>
          )}
        </div>
      </Card>

      <Card
        className="stagger-enter stagger-5"
        title="CSV Attendee Import"
        subtitle="Upload a simple CSV file with name,email rows for one of your published events."
        headerRight={<Pill tone="brand">CSV Import</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Select Published Event</FieldLabel>
            <Select
              value={selectedEventId}
              onChange={(e) => {
                onSelectEventId(e.target.value);
                csvState.onClearResult();
              }}
            >
              <option value="">Choose one of your published events</option>
              {myPublishedEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.status})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel>CSV File</FieldLabel>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => csvState.onFileChange(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Expected format:</span>
            <a
              href="/sample-attendees.csv"
              download
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Download Sample CSV
            </a>
          </div>
          <div className="mt-2 whitespace-pre-wrap rounded-xl bg-white px-3 py-3 font-mono text-xs text-slate-700">
            {"name,email\nAlice,alice@example.com\nBob,bob@example.com"}
          </div>
          <p className="mt-3 text-xs text-amber-700">
            Imported new users will be created with the default password <span className="font-semibold">pass1234</span>.
            Please remind new users to sign in and change their password as soon as possible.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={importCsvState.onImport} disabled={importCsvState.isPending || !selectedEventId || !csvState.file}>
            {importCsvState.isPending ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="secondary" onClick={csvState.onClear} disabled={importCsvState.isPending}>
            Clear
          </Button>
          <p className="text-xs text-slate-600">{csvState.file ? `Selected: ${csvState.file.name}` : "No file selected yet."}</p>
        </div>

        {csvState.result ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Total Rows</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.totalRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Imported</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.importedRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Invalid</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.invalidRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Duplicates</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.duplicateRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Confirmed</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.confirmedRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Waitlisted</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{csvState.result.summary.waitlistedRows}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Import finished: {csvState.result.summary.importedRows} row(s) imported, {csvState.result.summary.duplicateRows} duplicate row(s), {" "}
              {csvState.result.summary.invalidRows} invalid row(s).
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Import Issues</p>
              {csvState.result.issues.length ? (
                <div className="mt-3 space-y-2">
                  {csvState.result.issues.map((issue, index) => (
                    <div key={`${issue.rowNumber}-${issue.reason}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Row {issue.rowNumber}: {issue.reason}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  No issues found in this CSV import.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Recent Import Jobs</p>
            <Button variant="secondary" onClick={importHistoryState.onRefresh} disabled={!selectedEventId || importHistoryState.isFetching}>
              {importHistoryState.isFetching ? "Refreshing..." : "Refresh History"}
            </Button>
          </div>

          {!selectedEventId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Select a published event to view CSV import history.
            </div>
          ) : importHistoryState.isLoading ? (
            <div className="rounded-2xl bg-slate-100/80 px-4 py-4 text-sm text-slate-600">Loading import history...</div>
          ) : importHistoryState.isError ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-700">Failed to load import history.</div>
          ) : importHistoryState.items.length ? (
            <div className="space-y-3">
              {importHistoryState.items.map((job) => (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{new Date(job.createdAt).toLocaleString()}</p>
                    <Pill tone="slate">{job.status}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">File: {job.fileId}</p>
                  <p className="mt-1 text-xs text-slate-500">Finished: {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "In progress"}</p>
                  {job.summary ? (
                    <p className="mt-2 text-xs text-slate-700">
                      Total {job.summary.totalRows} | Imported {job.summary.importedRows} | Invalid {job.summary.invalidRows} | Duplicates {" "}
                      {job.summary.duplicateRows} | Confirmed {job.summary.confirmedRows} | Waitlisted {job.summary.waitlistedRows}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Summary unavailable for this job.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No import jobs yet for this event.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

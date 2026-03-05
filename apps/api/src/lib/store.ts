import type { CheckinMethod, EventStatus, RegistrationStatus, UserRole } from "../types.js";
import { randomToken } from "./security.js";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  location: string;
  startTime: string;
  capacity: number;
  waitlistEnabled: boolean;
  status: EventStatus;
  createdAt: string;
}

export interface StaffAssignmentRecord {
  id: string;
  eventId: string;
  userId: string;
}

export interface RegistrationRecord {
  id: string;
  eventId: string;
  attendeeId: string;
  status: RegistrationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
}

export interface TicketRecord {
  id: string;
  eventId: string;
  attendeeId: string;
  tokenHash: string;
  qrPayload: string;
  issuedAt: string;
  revokedAt: string | null;
}

export interface CheckinLogRecord {
  id: string;
  eventId: string;
  ticketId: string;
  staffId: string;
  method: CheckinMethod;
  checkedInAt: string;
  isDuplicate: boolean;
}

export interface FileObjectRecord {
  id: string;
  ownerId: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  size: number;
  kind: string;
  createdAt: string;
}

export interface ImportJobRecord {
  id: string;
  eventId: string;
  fileId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  summary?: string;
  createdAt: string;
  finishedAt: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${randomToken(8)}`;
}

export const store = {
  users: [] as UserRecord[],
  sessions: [] as SessionRecord[],
  events: [] as EventRecord[],
  staffAssignments: [] as StaffAssignmentRecord[],
  registrations: [] as RegistrationRecord[],
  tickets: [] as TicketRecord[],
  checkins: [] as CheckinLogRecord[],
  files: [] as FileObjectRecord[],
  importJobs: [] as ImportJobRecord[],

  nowIso,
  createId,
};

export function resetStore(): void {
  store.users = [];
  store.sessions = [];
  store.events = [];
  store.staffAssignments = [];
  store.registrations = [];
  store.tickets = [];
  store.checkins = [];
  store.files = [];
  store.importJobs = [];
}

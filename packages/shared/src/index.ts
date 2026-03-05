export type UserRole = "ORGANIZER" | "STAFF" | "ATTENDEE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type RegistrationStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED";
export type CheckinMethod = "QR" | "MANUAL";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type UserRole = "ORGANIZER" | "STAFF" | "ATTENDEE";
export type PanelSection = "overview" | "organizer" | "staff" | "events" | "tickets";

export type PanelNavEntry = {
  label: string;
  to: string;
  section: PanelSection;
  roles: UserRole[];
};

export const PANEL_NAV_ENTRIES: PanelNavEntry[] = [
  { label: "Overview", to: "/panel", section: "overview", roles: ["ORGANIZER", "STAFF", "ATTENDEE"] },
  { label: "Organizer Studio", to: "/panel/organizer", section: "organizer", roles: ["ORGANIZER"] },
  { label: "Staff Console", to: "/panel/staff", section: "staff", roles: ["ORGANIZER", "STAFF"] },
  { label: "Event Board", to: "/panel/events", section: "events", roles: ["ORGANIZER", "STAFF", "ATTENDEE"] },
  { label: "My Tickets", to: "/panel/tickets", section: "tickets", roles: ["ATTENDEE"] },
];

export function isUserRole(role?: string): role is UserRole {
  return role === "ORGANIZER" || role === "STAFF" || role === "ATTENDEE";
}

export function getPanelNavEntries(role?: string): PanelNavEntry[] {
  if (!isUserRole(role)) {
    return [];
  }
  return PANEL_NAV_ENTRIES.filter((item) => item.roles.includes(role));
}

export function panelSectionFromPath(pathname: string): PanelSection {
  if (pathname === "/panel/tickets") {
    return "tickets";
  }
  if (pathname === "/panel/organizer") {
    return "organizer";
  }
  if (pathname === "/panel/staff" || pathname.endsWith("/checkin")) {
    return "staff";
  }
  if (pathname === "/panel/events" || pathname.endsWith("/dashboard") || pathname.endsWith("/attendees")) {
    return "events";
  }
  return "overview";
}

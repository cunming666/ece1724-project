import type { CheckinMethod, EventStatus, RegistrationStatus, UserRole } from "../types.js";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import QRCode from "qrcode";
import { requireAuth } from "../lib/auth.js";
import { hashToken, randomToken } from "../lib/security.js";
import { resetStore, store } from "../lib/store.js";

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().min(1),
  startTime: z.string().datetime(),
  capacity: z.number().int().positive(),
  waitlistEnabled: z.boolean().optional(),
});

const updateEventSchema = createEventSchema.partial();

function assertEventAccess(role: UserRole, userId: string, eventId: string) {
  const event = store.events.find((item) => item.id === eventId);
  if (!event) return { ok: false as const, code: 404, error: "Event not found" };

  if (role === "ORGANIZER") {
    if (event.organizerId !== userId) {
      return { ok: false as const, code: 403, error: "Forbidden" };
    }
    return { ok: true as const, event };
  }

  if (role === "STAFF") {
    const assignment = store.staffAssignments.find((item) => item.eventId === eventId && item.userId === userId);
    if (!assignment) {
      return { ok: false as const, code: 403, error: "Staff not assigned to this event" };
    }
    return { ok: true as const, event };
  }

  return { ok: false as const, code: 403, error: "Forbidden" };
}

function getAttendance(eventId: string) {
  const confirmed = store.registrations.filter((item) => item.eventId === eventId && item.status === "CONFIRMED").length;
  const waitlisted = store.registrations.filter((item) => item.eventId === eventId && item.status === "WAITLISTED").length;
  const checkedIn = store.checkins.filter((item) => item.eventId === eventId && !item.isDuplicate).length;
  return { confirmed, waitlisted, checkedIn };
}

function emitAttendance(io: Server, eventId: string): void {
  io.to(eventId).emit("attendance:updated", {
    eventId,
    ...getAttendance(eventId),
  });
}

function createTicket(eventId: string, attendeeId: string) {
  const token = randomToken();
  const ticketId = store.createId("tkt");
  const qrPayload = JSON.stringify({ ticketId, token });

  const ticket = {
    id: ticketId,
    eventId,
    attendeeId,
    tokenHash: hashToken(token),
    qrPayload,
    issuedAt: store.nowIso(),
    revokedAt: null,
  };

  store.tickets.push(ticket);
  return ticket;
}

function writeCheckin(io: Server, args: { eventId: string; ticketId: string; staffId: string; method: CheckinMethod }) {
  const hasValid = store.checkins.some(
    (item) => item.eventId === args.eventId && item.ticketId === args.ticketId && !item.isDuplicate,
  );

  const checkin = {
    id: store.createId("chk"),
    eventId: args.eventId,
    ticketId: args.ticketId,
    staffId: args.staffId,
    method: args.method,
    checkedInAt: store.nowIso(),
    isDuplicate: hasValid,
  };

  store.checkins.push(checkin);

  io.to(args.eventId).emit("checkin:created", {
    eventId: args.eventId,
    ticketId: args.ticketId,
    method: args.method,
    isDuplicate: checkin.isDuplicate,
    checkedInAt: checkin.checkedInAt,
  });

  emitAttendance(io, args.eventId);
  return checkin;
}

export function createApiRouter(io: Server) {
  const router = Router();

  router.post("/demo/bootstrap", (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Demo bootstrap is disabled in production" });
    }

    resetStore();

    const demoPassword = "pass1234";

    const organizer = {
      id: store.createId("usr"),
      email: "organizer.demo@utoronto.ca",
      name: "Demo Organizer",
      passwordHash: demoPassword,
      role: "ORGANIZER" as const,
      createdAt: store.nowIso(),
    };

    const staff = {
      id: store.createId("usr"),
      email: "staff.demo@utoronto.ca",
      name: "Demo Staff",
      passwordHash: demoPassword,
      role: "STAFF" as const,
      createdAt: store.nowIso(),
    };

    const attendeeA = {
      id: store.createId("usr"),
      email: "attendee1.demo@utoronto.ca",
      name: "Demo Attendee 1",
      passwordHash: demoPassword,
      role: "ATTENDEE" as const,
      createdAt: store.nowIso(),
    };

    const attendeeB = {
      id: store.createId("usr"),
      email: "attendee2.demo@utoronto.ca",
      name: "Demo Attendee 2",
      passwordHash: demoPassword,
      role: "ATTENDEE" as const,
      createdAt: store.nowIso(),
    };

    const attendeeC = {
      id: store.createId("usr"),
      email: "attendee3.demo@utoronto.ca",
      name: "Demo Attendee 3",
      passwordHash: demoPassword,
      role: "ATTENDEE" as const,
      createdAt: store.nowIso(),
    };

    store.users.push(organizer, staff, attendeeA, attendeeB, attendeeC);

    const event = {
      id: store.createId("evt"),
      organizerId: organizer.id,
      title: "ECE1724 Demo Day (Seeded)",
      description: "Pre-seeded event for presentation and testing",
      location: "Bahen Centre 1130",
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      capacity: 2,
      waitlistEnabled: true,
      status: "PUBLISHED" as EventStatus,
      createdAt: store.nowIso(),
    };
    store.events.push(event);

    store.staffAssignments.push({
      id: store.createId("asg"),
      eventId: event.id,
      userId: staff.id,
    });

    const registerAttendee = (attendeeId: string) => {
      const confirmedCount = store.registrations.filter(
        (item) => item.eventId === event.id && item.status === "CONFIRMED",
      ).length;

      let status: RegistrationStatus = "CONFIRMED";
      let waitlistPosition: number | null = null;
      if (confirmedCount >= event.capacity) {
        status = "WAITLISTED";
        waitlistPosition =
          store.registrations.filter((item) => item.eventId === event.id && item.status === "WAITLISTED").length + 1;
      }

      const registration = {
        id: store.createId("reg"),
        eventId: event.id,
        attendeeId,
        status,
        waitlistPosition,
        registeredAt: store.nowIso(),
      };
      store.registrations.push(registration);

      let ticket: ReturnType<typeof createTicket> | null = null;
      if (status === "CONFIRMED") {
        ticket = createTicket(event.id, attendeeId);
      }

      return { registration, ticket };
    };

    const regA = registerAttendee(attendeeA.id);
    const regB = registerAttendee(attendeeB.id);
    const regC = registerAttendee(attendeeC.id);

    if (regA.ticket) {
      writeCheckin(io, {
        eventId: event.id,
        ticketId: regA.ticket.id,
        staffId: staff.id,
        method: "MANUAL",
      });
    }

    const createSessionToken = (userId: string) => {
      const token = randomToken();
      store.sessions.push({
        id: store.createId("ses"),
        userId,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        createdAt: store.nowIso(),
      });
      return token;
    };

    const organizerToken = createSessionToken(organizer.id);
    const staffToken = createSessionToken(staff.id);
    const attendeeAToken = createSessionToken(attendeeA.id);
    const attendeeBToken = createSessionToken(attendeeB.id);
    const attendeeCToken = createSessionToken(attendeeC.id);

    return res.status(201).json({
      message: "Demo data ready",
      event: {
        id: event.id,
        title: event.title,
        location: event.location,
        startTime: event.startTime,
        capacity: event.capacity,
        status: event.status,
      },
      accounts: [
        {
          role: "ORGANIZER",
          email: organizer.email,
          password: demoPassword,
          token: organizerToken,
        },
        {
          role: "STAFF",
          email: staff.email,
          password: demoPassword,
          token: staffToken,
        },
        {
          role: "ATTENDEE",
          email: attendeeA.email,
          password: demoPassword,
          token: attendeeAToken,
        },
        {
          role: "ATTENDEE",
          email: attendeeB.email,
          password: demoPassword,
          token: attendeeBToken,
        },
        {
          role: "ATTENDEE",
          email: attendeeC.email,
          password: demoPassword,
          token: attendeeCToken,
        },
      ],
      seededState: {
        confirmedRegistrations: [regA.registration.id, regB.registration.id],
        waitlistedRegistrations: [regC.registration.id],
        firstTicketId: regA.ticket?.id ?? null,
      },
      demoScenarios: [
        "Use STAFF account to call POST /api/checkins/manual again with firstTicketId -> duplicate check-in",
        "Use ATTENDEE 1 account to call DELETE /api/events/:eventId/register -> ATTENDEE 3 promoted from waitlist",
        "Use ORGANIZER or STAFF account to open GET /api/events/:eventId/dashboard",
      ],
    });
  });

  router.get("/events", (_req, res) => {
    const events = store.events.filter((item) => item.status === "PUBLISHED");
    res.json({ items: events });
  });

  router.post("/events", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const parsed = createEventSchema.parse(req.body);
      const created = {
        id: store.createId("evt"),
        organizerId: res.locals.auth.user.id,
        title: parsed.title,
        description: parsed.description,
        location: parsed.location,
        startTime: parsed.startTime,
        capacity: parsed.capacity,
        waitlistEnabled: parsed.waitlistEnabled ?? true,
        status: "DRAFT" as EventStatus,
        createdAt: store.nowIso(),
      };

      store.events.push(created);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId", (req, res) => {
    const event = store.events.find((item) => item.id === req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  });

  router.patch("/events/:eventId", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const parsed = updateEventSchema.parse(req.body);
      const event = access.event;

      if (parsed.title) event.title = parsed.title;
      if (parsed.description !== undefined) event.description = parsed.description;
      if (parsed.location) event.location = parsed.location;
      if (parsed.startTime) event.startTime = parsed.startTime;
      if (parsed.capacity) event.capacity = parsed.capacity;
      if (parsed.waitlistEnabled !== undefined) event.waitlistEnabled = parsed.waitlistEnabled;

      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/:eventId/publish", requireAuth(["ORGANIZER"]), (req, res) => {
    const access = assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
    if (!access.ok) {
      return res.status(access.code).json({ error: access.error });
    }

    access.event.status = "PUBLISHED";
    io.to(req.params.eventId).emit("event:status_changed", {
      eventId: req.params.eventId,
      status: "PUBLISHED",
    });

    res.json(access.event);
  });

  router.post("/events/:eventId/register", requireAuth(["ATTENDEE"]), (req, res) => {
    const event = store.events.find((item) => item.id === req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (event.status !== "PUBLISHED") {
      return res.status(409).json({ error: "Event is not open for registration" });
    }

    const attendeeId = res.locals.auth.user.id;
    const exists = store.registrations.some((item) => item.eventId === event.id && item.attendeeId === attendeeId);
    if (exists) {
      return res.status(409).json({ error: "Already registered" });
    }

    const confirmedCount = store.registrations.filter(
      (item) => item.eventId === event.id && item.status === "CONFIRMED",
    ).length;

    let status: RegistrationStatus = "CONFIRMED";
    let waitlistPosition: number | null = null;

    if (confirmedCount >= event.capacity) {
      if (!event.waitlistEnabled) {
        return res.status(409).json({ error: "Event is full" });
      }
      status = "WAITLISTED";
      waitlistPosition =
        store.registrations.filter((item) => item.eventId === event.id && item.status === "WAITLISTED").length + 1;
    }

    const registration = {
      id: store.createId("reg"),
      eventId: event.id,
      attendeeId,
      status,
      waitlistPosition,
      registeredAt: store.nowIso(),
    };

    store.registrations.push(registration);

    let ticket: ReturnType<typeof createTicket> | null = null;
    if (status === "CONFIRMED") {
      ticket = createTicket(event.id, attendeeId);
    }

    emitAttendance(io, event.id);
    res.status(201).json({ registration, ticket });
  });

  router.delete("/events/:eventId/register", requireAuth(["ATTENDEE"]), (req, res) => {
    const attendeeId = res.locals.auth.user.id;
    const eventId = req.params.eventId;

    const registration = store.registrations.find((item) => item.eventId === eventId && item.attendeeId === attendeeId);
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    store.registrations = store.registrations.filter((item) => item.id !== registration.id);

    store.tickets = store.tickets.map((item) => {
      if (item.eventId === eventId && item.attendeeId === attendeeId && !item.revokedAt) {
        return { ...item, revokedAt: store.nowIso() };
      }
      return item;
    });

    if (registration.status === "CONFIRMED") {
      const promoted = store.registrations
        .filter((item) => item.eventId === eventId && item.status === "WAITLISTED")
        .sort((a, b) => (a.waitlistPosition ?? 99999) - (b.waitlistPosition ?? 99999))[0];

      if (promoted) {
        promoted.status = "CONFIRMED";
        promoted.waitlistPosition = null;
        createTicket(eventId, promoted.attendeeId);

        io.to(eventId).emit("waitlist:promoted", {
          eventId,
          attendeeId: promoted.attendeeId,
        });
      }
    }

    emitAttendance(io, eventId);
    res.status(204).send();
  });

  router.get("/events/:eventId/attendees", requireAuth(["ORGANIZER", "STAFF"]), (req, res) => {
    const access = assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, req.params.eventId);
    if (!access.ok) {
      return res.status(access.code).json({ error: access.error });
    }

    const attendees = store.registrations
      .filter((item) => item.eventId === req.params.eventId)
      .map((registration) => ({
        ...registration,
        attendee: store.users.find((u) => u.id === registration.attendeeId),
      }));

    res.json({ items: attendees });
  });

  router.get("/events/:eventId/dashboard", requireAuth(["ORGANIZER", "STAFF"]), (req, res) => {
    const access = assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, req.params.eventId);
    if (!access.ok) {
      return res.status(access.code).json({ error: access.error });
    }

    const stats = getAttendance(req.params.eventId);
    const recentCheckins = store.checkins
      .filter((item) => item.eventId === req.params.eventId)
      .slice()
      .sort((a, b) => (a.checkedInAt > b.checkedInAt ? -1 : 1))
      .slice(0, 10)
      .map((item) => {
        const ticket = store.tickets.find((t) => t.id === item.ticketId);
        const attendee = ticket ? store.users.find((u) => u.id === ticket.attendeeId) : undefined;
        return {
          ...item,
          ticket: {
            attendee: attendee
              ? {
                  id: attendee.id,
                  name: attendee.name,
                  email: attendee.email,
                }
              : { id: "unknown", name: "Unknown", email: "unknown@example.com" },
          },
        };
      });

    res.json({
      eventId: req.params.eventId,
      ...stats,
      recentCheckins,
    });
  });

  router.get("/tickets/:ticketId/qr", requireAuth(), async (req, res, next) => {
    try {
      const ticket = store.tickets.find((item) => item.id === req.params.ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }

      const event = store.events.find((item) => item.id === ticket.eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const auth = res.locals.auth;
      if (auth.user.role === "ATTENDEE" && ticket.attendeeId !== auth.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (auth.user.role === "ORGANIZER" && event.organizerId !== auth.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const svg = await QRCode.toString(ticket.qrPayload, { type: "svg" });
      res.type("image/svg+xml").send(svg);
    } catch (error) {
      next(error);
    }
  });

  router.post("/checkins/scan", requireAuth(["ORGANIZER", "STAFF"]), (req, res, next) => {
    try {
      const payload = z.object({ qrPayload: z.string().min(1) }).parse(req.body);
      const parsed = z.object({ ticketId: z.string(), token: z.string() }).parse(JSON.parse(payload.qrPayload));

      const ticket = store.tickets.find((item) => item.id === parsed.ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }
      if (ticket.tokenHash !== hashToken(parsed.token)) {
        return res.status(400).json({ error: "Invalid QR token" });
      }

      const access = assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, ticket.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const checkin = writeCheckin(io, {
        eventId: ticket.eventId,
        ticketId: ticket.id,
        staffId: res.locals.auth.user.id,
        method: "QR",
      });

      res.status(201).json(checkin);
    } catch (error) {
      next(error);
    }
  });

  router.post("/checkins/manual", requireAuth(["ORGANIZER", "STAFF"]), (req, res, next) => {
    try {
      const payload = z.object({ ticketId: z.string().min(1) }).parse(req.body);
      const ticket = store.tickets.find((item) => item.id === payload.ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }

      const access = assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, ticket.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const checkin = writeCheckin(io, {
        eventId: ticket.eventId,
        ticketId: ticket.id,
        staffId: res.locals.auth.user.id,
        method: "MANUAL",
      });

      res.status(201).json(checkin);
    } catch (error) {
      next(error);
    }
  });

  router.post("/files/presign-upload", requireAuth(["ORGANIZER", "STAFF"]), (req, res, next) => {
    try {
      const parsed = z
        .object({
          fileName: z.string().min(1),
          mimeType: z.string().min(1),
          size: z.number().int().nonnegative(),
          kind: z.string().default("asset"),
        })
        .parse(req.body);

      const bucket = process.env.STORAGE_BUCKET ?? "local-dev";
      const objectKey = `${Date.now()}-${parsed.fileName}`;

      const file = {
        id: store.createId("fil"),
        ownerId: res.locals.auth.user.id,
        bucket,
        objectKey,
        mimeType: parsed.mimeType,
        size: parsed.size,
        kind: parsed.kind,
        createdAt: store.nowIso(),
      };

      store.files.push(file);

      res.status(201).json({
        file,
        uploadUrl: `https://example.invalid/upload/${bucket}/${objectKey}`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/files/:fileId/download", requireAuth(), (req, res) => {
    const file = store.files.find((item) => item.id === req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({
      file,
      downloadUrl: `https://example.invalid/download/${file.bucket}/${file.objectKey}`,
    });
  });

  router.post("/events/:eventId/import-attendees-csv", requireAuth(["ORGANIZER"]), (req, res) => {
    const access = assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
    if (!access.ok) {
      return res.status(access.code).json({ error: access.error });
    }

    const body = z.object({ fileId: z.string().optional() }).parse(req.body ?? {});

    const job = {
      id: store.createId("imp"),
      eventId: req.params.eventId,
      fileId: body.fileId ?? "placeholder-file-id",
      status: "COMPLETED" as const,
      summary: "CSV import skeleton completed 0 rows",
      createdAt: store.nowIso(),
      finishedAt: store.nowIso(),
    };

    store.importJobs.push(job);
    res.status(201).json(job);
  });

  return router;
}

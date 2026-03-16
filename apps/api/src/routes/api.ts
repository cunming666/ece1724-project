import type { CheckinMethod, EventStatus, RegistrationStatus, UserRole } from "../types.js";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import QRCode from "qrcode";
import { requireAuth } from "../lib/auth.js";
import { hashToken, randomToken } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().min(1),
  startTime: z.string().datetime(),
  capacity: z.number().int().positive(),
  waitlistEnabled: z.boolean().optional(),
});

const updateEventSchema = createEventSchema.partial();

async function assertEventAccess(role: UserRole, userId: string, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return { ok: false as const, code: 404, error: "Event not found" };
  }

  if (role === "ORGANIZER") {
    if (event.organizerId !== userId) {
      return { ok: false as const, code: 403, error: "Forbidden" };
    }
    return { ok: true as const, event };
  }

  if (role === "STAFF") {
    const assignment = await prisma.staffAssignment.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!assignment) {
      return { ok: false as const, code: 403, error: "Staff not assigned to this event" };
    }

    return { ok: true as const, event };
  }

  return { ok: false as const, code: 403, error: "Forbidden" };
}

async function getAttendance(eventId: string) {
  const confirmed = await prisma.registration.count({
    where: { eventId, status: "CONFIRMED" },
  });

  const waitlisted = await prisma.registration.count({
    where: { eventId, status: "WAITLISTED" },
  });

  const checkedIn = await prisma.checkinLog.count({
    where: { eventId, isDuplicate: false },
  });

  return { confirmed, waitlisted, checkedIn };
}

async function emitAttendance(io: Server, eventId: string): Promise<void> {
  io.to(eventId).emit("attendance:updated", {
    eventId,
    ...(await getAttendance(eventId)),
  });
}

async function getTicketCheckinSummary(ticketId: string) {
  const validCheckin = await prisma.checkinLog.findFirst({
    where: {
      ticketId,
      isDuplicate: false,
    },
    orderBy: { checkedInAt: "desc" },
  });

  const duplicateCount = await prisma.checkinLog.count({
    where: {
      ticketId,
      isDuplicate: true,
    },
  });

  return {
    checkedIn: Boolean(validCheckin),
    checkedInAt: validCheckin?.checkedInAt ?? null,
    duplicateCount,
  };
}

async function createTicket(eventId: string, attendeeId: string) {
  const token = randomToken();

  const created = await prisma.ticket.create({
    data: {
      eventId,
      attendeeId,
      tokenHash: hashToken(token),
      qrPayload: "PENDING",
    },
  });

  const qrPayload = JSON.stringify({ ticketId: created.id, token });

  const ticket = await prisma.ticket.update({
    where: { id: created.id },
    data: { qrPayload },
  });

  return ticket;
}

async function writeCheckin(
  io: Server,
  args: { eventId: string; ticketId: string; staffId: string; method: CheckinMethod },
) {
  const hasValid = await prisma.checkinLog.findFirst({
    where: {
      eventId: args.eventId,
      ticketId: args.ticketId,
      isDuplicate: false,
    },
  });

  const checkin = await prisma.checkinLog.create({
    data: {
      eventId: args.eventId,
      ticketId: args.ticketId,
      staffId: args.staffId,
      method: args.method,
      isDuplicate: Boolean(hasValid),
    },
  });

  io.to(args.eventId).emit("checkin:created", {
    eventId: args.eventId,
    ticketId: args.ticketId,
    method: args.method,
    isDuplicate: checkin.isDuplicate,
    checkedInAt: checkin.checkedInAt,
  });

  await emitAttendance(io, args.eventId);
  return checkin;
}

export function createApiRouter(io: Server) {
  const router = Router();

  router.post("/demo/bootstrap", async (_req, res, next) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Demo bootstrap is disabled in production" });
      }

      await prisma.checkinLog.deleteMany();
      await prisma.ticket.deleteMany();
      await prisma.registration.deleteMany();
      await prisma.staffAssignment.deleteMany();
      await prisma.importJob.deleteMany();
      await prisma.fileObject.deleteMany();
      await prisma.session.deleteMany();
      await prisma.event.deleteMany();
      await prisma.user.deleteMany();

      const demoPassword = "pass1234";

      const organizer = await prisma.user.create({
        data: {
          email: "organizer.demo@utoronto.ca",
          name: "Demo Organizer",
          passwordHash: demoPassword,
          role: "ORGANIZER",
        },
      });

      const staff = await prisma.user.create({
        data: {
          email: "staff.demo@utoronto.ca",
          name: "Demo Staff",
          passwordHash: demoPassword,
          role: "STAFF",
        },
      });

      const attendeeA = await prisma.user.create({
        data: {
          email: "attendee1.demo@utoronto.ca",
          name: "Demo Attendee 1",
          passwordHash: demoPassword,
          role: "ATTENDEE",
        },
      });

      const attendeeB = await prisma.user.create({
        data: {
          email: "attendee2.demo@utoronto.ca",
          name: "Demo Attendee 2",
          passwordHash: demoPassword,
          role: "ATTENDEE",
        },
      });

      const attendeeC = await prisma.user.create({
        data: {
          email: "attendee3.demo@utoronto.ca",
          name: "Demo Attendee 3",
          passwordHash: demoPassword,
          role: "ATTENDEE",
        },
      });

      const event = await prisma.event.create({
        data: {
          organizerId: organizer.id,
          title: "ECE1724 Demo Day (Seeded)",
          description: "Pre-seeded event for presentation and testing",
          location: "Bahen Centre 1130",
          startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          capacity: 2,
          waitlistEnabled: true,
          status: "PUBLISHED" as EventStatus,
        },
      });

      await prisma.staffAssignment.create({
        data: {
          eventId: event.id,
          userId: staff.id,
        },
      });

      const registerAttendee = async (attendeeId: string) => {
        const confirmedCount = await prisma.registration.count({
          where: {
            eventId: event.id,
            status: "CONFIRMED",
          },
        });

        let status: RegistrationStatus = "CONFIRMED";
        let waitlistPosition: number | null = null;

        if (confirmedCount >= event.capacity) {
          status = "WAITLISTED";
          waitlistPosition =
            (await prisma.registration.count({
              where: {
                eventId: event.id,
                status: "WAITLISTED",
              },
            })) + 1;
        }

        const registration = await prisma.registration.create({
          data: {
            eventId: event.id,
            attendeeId,
            status,
            waitlistPosition,
          },
        });

        let ticket: Awaited<ReturnType<typeof createTicket>> | null = null;
        if (status === "CONFIRMED") {
          ticket = await createTicket(event.id, attendeeId);
        }

        return { registration, ticket };
      };

      const regA = await registerAttendee(attendeeA.id);
      const regB = await registerAttendee(attendeeB.id);
      const regC = await registerAttendee(attendeeC.id);

      if (regA.ticket) {
        await writeCheckin(io, {
          eventId: event.id,
          ticketId: regA.ticket.id,
          staffId: staff.id,
          method: "MANUAL",
        });
      }

      const createSessionToken = async (userId: string) => {
        const token = randomToken();
        await prisma.session.create({
          data: {
            userId,
            token,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          },
        });
        return token;
      };

      const organizerToken = await createSessionToken(organizer.id);
      const staffToken = await createSessionToken(staff.id);
      const attendeeAToken = await createSessionToken(attendeeA.id);
      const attendeeBToken = await createSessionToken(attendeeB.id);
      const attendeeCToken = await createSessionToken(attendeeC.id);

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
    } catch (error) {
      next(error);
    }
  });

  router.get("/events", async (_req, res, next) => {
    try {
      const events = await prisma.event.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { startTime: "asc" },
      });
      res.json({ items: events });
    } catch (error) {
      next(error);
    }
  });

  router.get("/my/events", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const items = await prisma.event.findMany({
        where: { organizerId: res.locals.auth.user.id },
        orderBy: [{ createdAt: "desc" }, { startTime: "asc" }],
      });

      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me/tickets", requireAuth(["ATTENDEE"]), async (req, res, next) => {
    try {
      const attendeeId = res.locals.auth.user.id;
      const tickets = await prisma.ticket.findMany({
        where: { attendeeId },
        include: {
          event: true,
        },
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      });

      const registrations = await prisma.registration.findMany({
        where: { attendeeId },
      });
      const registrationMap = new Map(registrations.map((item) => [item.eventId, item]));

      const items = await Promise.all(
        tickets.map(async (ticket) => ({
          id: ticket.id,
          issuedAt: ticket.issuedAt,
          revokedAt: ticket.revokedAt,
          event: {
            id: ticket.event.id,
            title: ticket.event.title,
            location: ticket.event.location,
            startTime: ticket.event.startTime,
            status: ticket.event.status,
          },
          registration: (() => {
            const registration = registrationMap.get(ticket.eventId);
            if (!registration) {
              return null;
            }
            return {
              id: registration.id,
              status: registration.status,
              registeredAt: registration.registeredAt,
            };
          })(),
          checkin: await getTicketCheckinSummary(ticket.id),
        })),
      );

      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/events", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const parsed = createEventSchema.parse(req.body);

      const created = await prisma.event.create({
        data: {
          organizerId: res.locals.auth.user.id,
          title: parsed.title,
          description: parsed.description,
          location: parsed.location,
          startTime: parsed.startTime,
          capacity: parsed.capacity,
          waitlistEnabled: parsed.waitlistEnabled ?? true,
          status: "DRAFT",
        },
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId", async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: req.params.eventId },
      });

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/events/:eventId", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const parsed = updateEventSchema.parse(req.body);

      const updated = await prisma.event.update({
        where: { id: req.params.eventId },
        data: {
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.location !== undefined ? { location: parsed.location } : {}),
          ...(parsed.startTime !== undefined ? { startTime: parsed.startTime } : {}),
          ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
          ...(parsed.waitlistEnabled !== undefined ? { waitlistEnabled: parsed.waitlistEnabled } : {}),
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/:eventId/publish", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const updated = await prisma.event.update({
        where: { id: req.params.eventId },
        data: { status: "PUBLISHED" },
      });

      io.to(req.params.eventId).emit("event:status_changed", {
        eventId: req.params.eventId,
        status: "PUBLISHED",
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/:eventId/register", requireAuth(["ATTENDEE"]), async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: req.params.eventId },
      });

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      if (event.status !== "PUBLISHED") {
        return res.status(409).json({ error: "Event is not open for registration" });
      }

      const attendeeId = res.locals.auth.user.id;

      const exists = await prisma.registration.findFirst({
        where: {
          eventId: event.id,
          attendeeId,
        },
      });

      if (exists) {
        return res.status(409).json({ error: "Already registered" });
      }

      const confirmedCount = await prisma.registration.count({
        where: {
          eventId: event.id,
          status: "CONFIRMED",
        },
      });

      let status: RegistrationStatus = "CONFIRMED";
      let waitlistPosition: number | null = null;

      if (confirmedCount >= event.capacity) {
        if (!event.waitlistEnabled) {
          return res.status(409).json({ error: "Event is full" });
        }
        status = "WAITLISTED";
        waitlistPosition =
          (await prisma.registration.count({
            where: {
              eventId: event.id,
              status: "WAITLISTED",
            },
          })) + 1;
      }

      const registration = await prisma.registration.create({
        data: {
          eventId: event.id,
          attendeeId,
          status,
          waitlistPosition,
        },
      });

      let ticket: Awaited<ReturnType<typeof createTicket>> | null = null;
      if (status === "CONFIRMED") {
        ticket = await createTicket(event.id, attendeeId);
      }

      await emitAttendance(io, event.id);
      res.status(201).json({ registration, ticket });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/events/:eventId/register", requireAuth(["ATTENDEE"]), async (req, res, next) => {
    try {
      const attendeeId = res.locals.auth.user.id;
      const eventId = req.params.eventId;

      const registration = await prisma.registration.findFirst({
        where: {
          eventId,
          attendeeId,
        },
      });

      if (!registration) {
        return res.status(404).json({ error: "Registration not found" });
      }

      await prisma.registration.delete({
        where: { id: registration.id },
      });

      await prisma.ticket.updateMany({
        where: {
          eventId,
          attendeeId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (registration.status === "CONFIRMED") {
        const promoted = await prisma.registration.findFirst({
          where: {
            eventId,
            status: "WAITLISTED",
          },
          orderBy: { waitlistPosition: "asc" },
        });

        if (promoted) {
          await prisma.registration.update({
            where: { id: promoted.id },
            data: {
              status: "CONFIRMED",
              waitlistPosition: null,
            },
          });

          await createTicket(eventId, promoted.attendeeId);

          io.to(eventId).emit("waitlist:promoted", {
            eventId,
            attendeeId: promoted.attendeeId,
          });
        }
      }

      await emitAttendance(io, eventId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId/staff", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const assignments = await prisma.staffAssignment.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { id: "asc" },
      });

      const userIds = assignments.map((item) => item.userId);
      const users = userIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds },
            },
          })
        : [];

      const userMap = new Map(users.map((user) => [user.id, user]));

      const items = assignments.map((assignment) => ({
        ...assignment,
        user: userMap.get(assignment.userId) ?? null,
      }));

      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/:eventId/staff", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const body = z.object({ email: z.string().email() }).parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.role !== "STAFF") {
        return res.status(409).json({ error: "User is not a staff account" });
      }

      const existing = await prisma.staffAssignment.findUnique({
        where: {
          eventId_userId: {
            eventId: req.params.eventId,
            userId: user.id,
          },
        },
      });

      if (existing) {
        return res.status(409).json({ error: "Staff already assigned" });
      }

      const assignment = await prisma.staffAssignment.create({
        data: {
          eventId: req.params.eventId,
          userId: user.id,
        },
      });

      res.status(201).json({
        ...assignment,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/events/:eventId/staff/:userId", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const existing = await prisma.staffAssignment.findUnique({
        where: {
          eventId_userId: {
            eventId: req.params.eventId,
            userId: req.params.userId,
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: "Staff assignment not found" });
      }

      await prisma.staffAssignment.delete({
        where: {
          eventId_userId: {
            eventId: req.params.eventId,
            userId: req.params.userId,
          },
        },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId/attendees", requireAuth(["ORGANIZER", "STAFF"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const registrations = await prisma.registration.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { registeredAt: "asc" },
      });

      const userIds = registrations.map((item) => item.attendeeId);
      const users = userIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds },
            },
          })
        : [];

      const userMap = new Map(users.map((user) => [user.id, user]));

      const attendees = registrations.map((registration) => ({
        ...registration,
        attendee: userMap.get(registration.attendeeId) ?? null,
      }));

      res.json({ items: attendees });
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId/dashboard", requireAuth(["ORGANIZER", "STAFF"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const stats = await getAttendance(req.params.eventId);

      const checkins = await prisma.checkinLog.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { checkedInAt: "desc" },
        take: 10,
      });

      const ticketIds = checkins.map((item) => item.ticketId);
      const tickets = ticketIds.length
        ? await prisma.ticket.findMany({
            where: {
              id: { in: ticketIds },
            },
          })
        : [];

      const attendeeIds = tickets.map((item) => item.attendeeId);
      const attendees = attendeeIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: attendeeIds },
            },
          })
        : [];

      const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));
      const attendeeMap = new Map(attendees.map((attendee) => [attendee.id, attendee]));

      const recentCheckins = checkins.map((item) => {
        const ticket = ticketMap.get(item.ticketId);
        const attendee = ticket ? attendeeMap.get(ticket.attendeeId) : undefined;

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
    } catch (error) {
      next(error);
    }
  });

  router.get("/tickets/:ticketId/qr", requireAuth(), async (req, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.ticketId },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }

      const event = await prisma.event.findUnique({
        where: { id: ticket.eventId },
      });

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
      if (auth.user.role === "STAFF") {
        const assignment = await prisma.staffAssignment.findUnique({
          where: {
            eventId_userId: {
              eventId: ticket.eventId,
              userId: auth.user.id,
            },
          },
        });

        if (!assignment) {
          return res.status(403).json({ error: "Staff not assigned to this event" });
        }
      }

      const svg = await QRCode.toString(ticket.qrPayload, { type: "svg" });
      res.type("image/svg+xml").send(svg);
    } catch (error) {
      next(error);
    }
  });

  router.post("/checkins/scan", requireAuth(["ORGANIZER", "STAFF"]), async (req, res, next) => {
    try {
      const payload = z.object({ qrPayload: z.string().min(1) }).parse(req.body);
      const parsed = z.object({ ticketId: z.string(), token: z.string() }).parse(JSON.parse(payload.qrPayload));

      const ticket = await prisma.ticket.findUnique({
        where: { id: parsed.ticketId },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }
      if (ticket.tokenHash !== hashToken(parsed.token)) {
        return res.status(400).json({ error: "Invalid QR token" });
      }

      const access = await assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, ticket.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const checkin = await writeCheckin(io, {
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

  router.post("/checkins/manual", requireAuth(["ORGANIZER", "STAFF"]), async (req, res, next) => {
    try {
      const payload = z.object({ ticketId: z.string().min(1) }).parse(req.body);

      const ticket = await prisma.ticket.findUnique({
        where: { id: payload.ticketId },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.revokedAt) {
        return res.status(409).json({ error: "Ticket revoked" });
      }

      const access = await assertEventAccess(res.locals.auth.user.role, res.locals.auth.user.id, ticket.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const checkin = await writeCheckin(io, {
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

  router.post("/files/presign-upload", requireAuth(["ORGANIZER", "STAFF"]), async (req, res, next) => {
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

      const file = await prisma.fileObject.create({
        data: {
          ownerId: res.locals.auth.user.id,
          bucket,
          objectKey,
          mimeType: parsed.mimeType,
          size: parsed.size,
          kind: parsed.kind,
        },
      });

      res.status(201).json({
        file,
        uploadUrl: `https://example.invalid/upload/${bucket}/${objectKey}`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/files/:fileId/download", requireAuth(), async (req, res, next) => {
    try {
      const file = await prisma.fileObject.findUnique({
        where: { id: req.params.fileId },
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json({
        file,
        downloadUrl: `https://example.invalid/download/${file.bucket}/${file.objectKey}`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/:eventId/import-attendees-csv", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const body = z.object({ fileId: z.string().optional() }).parse(req.body ?? {});

      const job = await prisma.importJob.create({
        data: {
          eventId: req.params.eventId,
          fileId: body.fileId ?? "placeholder-file-id",
          status: "COMPLETED",
          summary: "CSV import skeleton completed 0 rows",
          finishedAt: new Date(),
        },
      });

      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
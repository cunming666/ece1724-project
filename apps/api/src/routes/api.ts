import type { CheckinLog, FileObject, Prisma, Registration, StaffAssignment, Ticket, User } from "@prisma/client";
import type { CheckinMethod, EventStatus, RegistrationStatus, UserRole } from "../types.js";
import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth.js";
import { hashToken, randomToken } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSpacesClient, getSpacesConfig } from "../lib/spaces.js";

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().min(1),
  startTime: z.string().datetime(),
  capacity: z.number().int().positive(),
  waitlistEnabled: z.boolean().optional(),
});

const updateEventSchema = createEventSchema.partial().extend({
  coverFileId: z.string().min(1).nullable().optional(),
});

const importAttendeesCsvSchema = z
  .object({
    csvText: z.string().optional(),
    fileId: z.string().optional(),
  })
  .refine((value) => Boolean(value.csvText?.trim() || value.fileId), {
    message: "Either csvText or fileId is required",
  });

const csvEmailSchema = z.string().email();
const importSummarySchema = z.object({
  totalRows: z.number().int().nonnegative(),
  importedRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  duplicateRows: z.number().int().nonnegative(),
  confirmedRows: z.number().int().nonnegative(),
  waitlistedRows: z.number().int().nonnegative(),
});

type CsvParsedRow = {
  rowNumber: number;
  name: string;
  email: string;
};

type CsvIssue = {
  rowNumber: number;
  reason: string;
};

type ImportSummary = z.infer<typeof importSummarySchema>;

function parseImportSummary(summary: string | null): ImportSummary | null {
  if (!summary) {
    return null;
  }

  try {
    const parsed = JSON.parse(summary) as unknown;
    const validated = importSummarySchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function parseAttendeeCsv(csvText: string): { rows: CsvParsedRow[]; issues: CsvIssue[] } {
  const normalizedText = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rawLines = normalizedText.split("\n");
  const nonEmptyLines = rawLines
    .map((line, index) => ({
      rowNumber: index + 1,
      line: line.trim(),
    }))
    .filter((item) => item.line.length > 0);

  if (!nonEmptyLines.length) {
    return { rows: [], issues: [] };
  }

  let dataStartIndex = 0;
  let columnOrder: "name-email" | "email-name" = "name-email";

  const firstCells = nonEmptyLines[0].line.split(",").map((cell) => cell.trim().toLowerCase());

  if (firstCells.length >= 2 && firstCells[0] === "name" && firstCells[1] === "email") {
    dataStartIndex = 1;
    columnOrder = "name-email";
  } else if (firstCells.length >= 2 && firstCells[0] === "email" && firstCells[1] === "name") {
    dataStartIndex = 1;
    columnOrder = "email-name";
  }

  const rows: CsvParsedRow[] = [];
  const issues: CsvIssue[] = [];

  for (let i = dataStartIndex; i < nonEmptyLines.length; i += 1) {
    const item = nonEmptyLines[i];
    const cells = item.line.split(",").map((cell) => cell.trim());

    if (cells.length !== 2) {
      issues.push({
        rowNumber: item.rowNumber,
        reason: "Each row must contain exactly 2 columns",
      });
      continue;
    }

    const name = columnOrder === "name-email" ? cells[0] : cells[1];
    const email = (columnOrder === "name-email" ? cells[1] : cells[0]).toLowerCase();

    if (!name) {
      issues.push({
        rowNumber: item.rowNumber,
        reason: "Name is required",
      });
      continue;
    }

    if (!csvEmailSchema.safeParse(email).success) {
      issues.push({
        rowNumber: item.rowNumber,
        reason: "Invalid email format",
      });
      continue;
    }

    rows.push({
      rowNumber: item.rowNumber,
      name,
      email,
    });
  }

  return { rows, issues };
}

async function readCsvTextFromSpaces(fileId: string): Promise<string> {
  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new Error("File not found");
  }

  const getCommand = new GetObjectCommand({
    Bucket: file.bucket,
    Key: file.objectKey,
  });

  const spacesClient = getSpacesClient();
  const response = await spacesClient.send(getCommand);
  const body = response.Body;

  if (!body || typeof body.transformToString !== "function") {
    throw new Error("Failed to read CSV file from storage");
  }

  return body.transformToString();
}

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

async function canDownloadFile(auth: { id: string; role: UserRole }, file: FileObject): Promise<boolean> {
  if (file.ownerId === auth.id) {
    return true;
  }

  if (file.kind === "event-cover") {
    const event = await prisma.event.findFirst({
      where: { coverFileId: file.id },
    });

    if (!event) {
      return false;
    }

    if (event.status === "PUBLISHED") {
      return true;
    }

    if (auth.role === "ORGANIZER") {
      return event.organizerId === auth.id;
    }

    if (auth.role === "STAFF") {
      const assignment = await prisma.staffAssignment.findUnique({
        where: {
          eventId_userId: {
            eventId: event.id,
            userId: auth.id,
          },
        },
      });
      return Boolean(assignment);
    }

    return false;
  }

  if (file.kind === "attendee-import") {
    const job = await prisma.importJob.findFirst({
      where: { fileId: file.id },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      return false;
    }

    if (auth.role === "ORGANIZER") {
      const event = await prisma.event.findUnique({ where: { id: job.eventId } });
      return event?.organizerId === auth.id;
    }

    if (auth.role === "STAFF") {
      const assignment = await prisma.staffAssignment.findUnique({
        where: {
          eventId_userId: {
            eventId: job.eventId,
            userId: auth.id,
          },
        },
      });
      return Boolean(assignment);
    }

    return false;
  }

  return false;
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

      const demoPlainPassword = "pass1234";
      const demoPassword = await bcrypt.hash(demoPlainPassword, 10);

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
            password: demoPlainPassword,
            token: organizerToken,
          },
          {
            role: "STAFF",
            email: staff.email,
            password: demoPlainPassword,
            token: staffToken,
          },
          {
            role: "ATTENDEE",
            email: attendeeA.email,
            password: demoPlainPassword,
            token: attendeeAToken,
          },
          {
            role: "ATTENDEE",
            email: attendeeB.email,
            password: demoPlainPassword,
            token: attendeeBToken,
          },
          {
            role: "ATTENDEE",
            email: attendeeC.email,
            password: demoPlainPassword,
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

  router.get("/my/events", requireAuth(["ORGANIZER"]), async (_req, res, next) => {
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

  router.get("/me/tickets", requireAuth(["ATTENDEE"]), async (_req, res, next) => {
    try {
      const attendeeId = res.locals.auth.user.id;
      const tickets = await prisma.ticket.findMany({
        where: { attendeeId },
        include: {
          event: true,
        },
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      });

      const registrations: Registration[] = await prisma.registration.findMany({
        where: { attendeeId },
      });
      const registrationMap = new Map<string, Registration>(registrations.map((item) => [item.eventId, item]));

      const items = await Promise.all(
        (tickets as Prisma.TicketGetPayload<{ include: { event: true } }>[])
          .map(async (ticket) => ({
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

      let normalizedCoverFileId: string | null | undefined = undefined;
      if (parsed.coverFileId !== undefined) {
        if (parsed.coverFileId === null) {
          normalizedCoverFileId = null;
        } else {
          const file = await prisma.fileObject.findUnique({ where: { id: parsed.coverFileId } });
          if (!file) {
            return res.status(404).json({ error: "Cover file not found" });
          }
          if (file.ownerId !== res.locals.auth.user.id) {
            return res.status(403).json({ error: "You can only attach files you uploaded" });
          }
          if (!file.mimeType.toLowerCase().startsWith("image/")) {
            return res.status(400).json({ error: "Cover file must be an image" });
          }
          normalizedCoverFileId = file.id;
        }
      }


      const updated = await prisma.event.update({
        where: { id: req.params.eventId },
        data: {
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.location !== undefined ? { location: parsed.location } : {}),
          ...(parsed.startTime !== undefined ? { startTime: parsed.startTime } : {}),
          ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
          ...(parsed.waitlistEnabled !== undefined ? { waitlistEnabled: parsed.waitlistEnabled } : {}),
          ...(normalizedCoverFileId !== undefined ? { coverFileId: normalizedCoverFileId } : {}),
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

      const assignments: StaffAssignment[] = await prisma.staffAssignment.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { id: "asc" },
      });

      const userIds = assignments.map((item) => item.userId);
      const users: User[] = userIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds },
            },
          })
        : [];

      const userMap = new Map<string, User>(users.map((user) => [user.id, user]));

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

      const registrations: Registration[] = await prisma.registration.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { registeredAt: "asc" },
      });

      const userIds = registrations.map((item) => item.attendeeId);
      const users: User[] = userIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: userIds },
            },
          })
        : [];

      const userMap = new Map<string, User>(users.map((user) => [user.id, user]));

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

      const checkins: CheckinLog[] = await prisma.checkinLog.findMany({
        where: { eventId: req.params.eventId },
        orderBy: { checkedInAt: "desc" },
        take: 10,
      });

      const ticketIds = checkins.map((item) => item.ticketId);
      const tickets: Ticket[] = ticketIds.length
        ? await prisma.ticket.findMany({
            where: {
              id: { in: ticketIds },
            },
          })
        : [];

      const attendeeIds = tickets.map((item) => item.attendeeId);
      const attendees: User[] = attendeeIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: attendeeIds },
            },
          })
        : [];

      const ticketMap = new Map<string, Ticket>(tickets.map((ticket) => [ticket.id, ticket]));
      const attendeeMap = new Map<string, User>(attendees.map((attendee) => [attendee.id, attendee]));

      const registrations: Registration[] = await prisma.registration.findMany({
        where: { eventId: req.params.eventId },
        orderBy: [{ status: "asc" }, { registeredAt: "asc" }],
      });

      const registrationAttendeeIds = registrations.map((item) => item.attendeeId);
      const registrationUsers: User[] = registrationAttendeeIds.length
        ? await prisma.user.findMany({
            where: {
              id: { in: registrationAttendeeIds },
            },
          })
        : [];

      const registrationUserMap = new Map<string, User>(registrationUsers.map((user) => [user.id, user]));

      const confirmedAttendees = registrations
        .filter((item) => item.status === "CONFIRMED")
        .map((item) => ({
          id: item.id,
          attendeeId: item.attendeeId,
          registeredAt: item.registeredAt,
          attendee: (() => {
            const attendee = registrationUserMap.get(item.attendeeId);
            return attendee
              ? {
                  id: attendee.id,
                  name: attendee.name,
                  email: attendee.email,
                }
              : {
                  id: "unknown",
                  name: "Unknown",
                  email: "unknown@example.com",
                };
          })(),
        }));

      const waitlistedAttendees = registrations
        .filter((item) => item.status === "WAITLISTED")
        .map((item) => ({
          id: item.id,
          attendeeId: item.attendeeId,
          waitlistPosition: item.waitlistPosition,
          registeredAt: item.registeredAt,
          attendee: (() => {
            const attendee = registrationUserMap.get(item.attendeeId);
            return attendee
              ? {
                  id: attendee.id,
                  name: attendee.name,
                  email: attendee.email,
                }
              : {
                  id: "unknown",
                  name: "Unknown",
                  email: "unknown@example.com",
                };
          })(),
        }));

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
        confirmedAttendees,
        waitlistedAttendees,
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

      const spacesConfig = getSpacesConfig();
      const spacesClient = getSpacesClient();
      const bucket = spacesConfig.bucket;
      const objectKey = `${Date.now()}-${parsed.fileName}`;

      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: parsed.mimeType,
      });

      const uploadUrl = await getSignedUrl(spacesClient, putCommand, {
        expiresIn: 60 * 10,
      });

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
        uploadUrl,
        method: "PUT",
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

      const authUser = res.locals.auth.user as { id: string; role: UserRole };
      const allowed = await canDownloadFile({ id: authUser.id, role: authUser.role }, file);
      if (!allowed) {
        return res.status(403).json({ error: "Forbidden" });
      }


      const spacesClient = getSpacesClient();
      const getCommand = new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
      });

      const downloadUrl = await getSignedUrl(spacesClient, getCommand, {
        expiresIn: 60 * 10,
      });

      res.json({
        file,
        downloadUrl,
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

      const body = importAttendeesCsvSchema.parse(req.body ?? {});

      let csvText = body.csvText?.trim() ?? "";
      if (!csvText && body.fileId) {
        try {
          csvText = (await readCsvTextFromSpaces(body.fileId)).trim();
        } catch (error) {
          return res.status(404).json({ error: (error as Error).message });
        }
      }

      if (!csvText) {
        return res.status(400).json({ error: "CSV contains no attendee rows" });
      }

      const parsedCsv = parseAttendeeCsv(csvText);
      const totalRows = parsedCsv.rows.length + parsedCsv.issues.length;

      if (totalRows === 0) {
        return res.status(400).json({ error: "CSV contains no attendee rows" });
      }

      const issues: CsvIssue[] = [...parsedCsv.issues];
      let invalidRows = parsedCsv.issues.length;
      let duplicateRows = 0;
      let importedRows = 0;
      let confirmedRows = 0;
      let waitlistedRows = 0;

      let confirmedCount = await prisma.registration.count({
        where: {
          eventId: req.params.eventId,
          status: "CONFIRMED",
        },
      });

      let nextWaitlistPosition =
        (await prisma.registration.count({
          where: {
            eventId: req.params.eventId,
            status: "WAITLISTED",
          },
        })) + 1;

      const seenEmailsInCsv = new Set<string>();
      const importedUserDefaultPassword = await bcrypt.hash("pass1234", 10);

      for (const row of parsedCsv.rows) {
        if (seenEmailsInCsv.has(row.email)) {
          duplicateRows += 1;
          issues.push({
            rowNumber: row.rowNumber,
            reason: "Duplicate email inside CSV file",
          });
          continue;
        }

        seenEmailsInCsv.add(row.email);

        let attendee = await prisma.user.findUnique({
          where: { email: row.email },
        });

        if (!attendee) {
          attendee = await prisma.user.create({
            data: {
              email: row.email,
              name: row.name,
              passwordHash: importedUserDefaultPassword,
              role: "ATTENDEE",
            },
          });
        }

        const existingRegistration = await prisma.registration.findFirst({
          where: {
            eventId: req.params.eventId,
            attendeeId: attendee.id,
          },
        });

        if (existingRegistration) {
          duplicateRows += 1;
          issues.push({
            rowNumber: row.rowNumber,
            reason: "Attendee already registered for this event",
          });
          continue;
        }

        let status: RegistrationStatus = "CONFIRMED";
        let waitlistPosition: number | null = null;

        if (confirmedCount >= access.event.capacity) {
          if (!access.event.waitlistEnabled) {
            invalidRows += 1;
            issues.push({
              rowNumber: row.rowNumber,
              reason: "Event is full and waitlist is disabled",
            });
            continue;
          }

          status = "WAITLISTED";
          waitlistPosition = nextWaitlistPosition;
          nextWaitlistPosition += 1;
        }

        await prisma.registration.create({
          data: {
            eventId: req.params.eventId,
            attendeeId: attendee.id,
            status,
            waitlistPosition,
          },
        });

        if (status === "CONFIRMED") {
          await createTicket(req.params.eventId, attendee.id);
          confirmedCount += 1;
          confirmedRows += 1;
        } else {
          waitlistedRows += 1;
        }

        importedRows += 1;
      }

      const summaryPayload = {
        totalRows,
        importedRows,
        invalidRows,
        duplicateRows,
        confirmedRows,
        waitlistedRows,
      };

      const summaryText = JSON.stringify(summaryPayload);

      const job = await prisma.importJob.create({
        data: {
          eventId: req.params.eventId,
          fileId: body.fileId ?? `inline-csv-${Date.now()}`,
          status: "COMPLETED",
          summary: summaryText,
          finishedAt: new Date(),
        },
      });

      await emitAttendance(io, req.params.eventId);

      res.status(201).json({
        job,
        summary: summaryPayload,
        issues,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get("/events/:eventId/import-jobs", requireAuth(["ORGANIZER"]), async (req, res, next) => {
    try {
      const access = await assertEventAccess("ORGANIZER", res.locals.auth.user.id, req.params.eventId);
      if (!access.ok) {
        return res.status(access.code).json({ error: access.error });
      }

      const jobs = await prisma.importJob.findMany({
        where: { eventId: req.params.eventId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      });

      const items = jobs.map((job) => ({
        id: job.id,
        eventId: job.eventId,
        fileId: job.fileId,
        status: job.status,
        summary: parseImportSummary(job.summary),
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
      }));

      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

// =======================
// Weather API (Advanced Feature #5)
// =======================
router.get("/weather", async (req, res, next) => {
  try {
    const city = String(req.query.city || "Toronto");

    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Weather API key not configured" });
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );

    if (!response.ok) {
      return res.status(400).json({ error: "Failed to fetch weather data" });
    }

    const data = await response.json();

    return res.json({
      city: data.name,
      temperature: data.main.temp,
      weather: data.weather[0].main,
    });
  } catch (error) {
    next(error);
  }
});
  return router;
}

import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const { app, io } = createApp();
const api = request(app);

async function signUpAndSignIn(input: {
  email: string;
  name: string;
  role: "ORGANIZER" | "STAFF" | "ATTENDEE";
}) {
  await api.post("/auth/sign-up").send({
    email: input.email,
    name: input.name,
    password: "pass1234",
    role: input.role,
  });

  const signIn = await api.post("/auth/sign-in").send({
    email: input.email,
    password: "pass1234",
  });

  return {
    token: signIn.body.token as string,
    user: signIn.body.user as { id: string; email: string; name: string; role: string },
  };
}

beforeEach(async () => {
  await prisma.checkinLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.staffAssignment.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.fileObject.deleteMany();
  await prisma.session.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  io.close();
  await prisma.$disconnect();
});

describe("Auth API", () => {
  test("supports sign-up/sign-in/session/sign-out flow", async () => {
    await api.get("/auth/session").expect(401);

    await api
      .post("/auth/sign-up")
      .send({
        email: "organizer@utoronto.ca",
        name: "Organizer",
        password: "pass1234",
        role: "ORGANIZER",
      })
      .expect(201);

    await api
      .post("/auth/sign-up")
      .send({
        email: "organizer@utoronto.ca",
        name: "Duplicate",
        password: "pass1234",
        role: "ORGANIZER",
      })
      .expect(409);

    const signIn = await api
      .post("/auth/sign-in")
      .send({
        email: "organizer@utoronto.ca",
        password: "pass1234",
      })
      .expect(200);

    const token = signIn.body.token as string;
    expect(token).toBeTruthy();

    const session = await api.get("/auth/session").set("Authorization", `Bearer ${token}`).expect(200);

    expect(session.body.email).toBe("organizer@utoronto.ca");
    expect(session.body.role).toBe("ORGANIZER");

    await api.post("/auth/sign-out").set("Authorization", `Bearer ${token}`).expect(204);

    await api.get("/auth/session").set("Authorization", `Bearer ${token}`).expect(401);
  });
});

describe("Demo bootstrap", () => {
  test("returns ready accounts and seeded event", async () => {
    const response = await api.post("/api/demo/bootstrap").expect(201);
    expect(response.body.message).toBe("Demo data ready");
    expect(response.body.accounts).toHaveLength(5);
    expect(response.body.event.status).toBe("PUBLISHED");
    expect(response.body.seededState.firstTicketId).toBeTruthy();
  });
});

describe("Event registration and waitlist", () => {
  test("supports publish, registration, waitlist, and promotion", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+wait@utoronto.ca",
      name: "Org Waitlist",
      role: "ORGANIZER",
    });
    const attendeeA = await signUpAndSignIn({
      email: "a1@utoronto.ca",
      name: "Attendee A",
      role: "ATTENDEE",
    });
    const attendeeB = await signUpAndSignIn({
      email: "a2@utoronto.ca",
      name: "Attendee B",
      role: "ATTENDEE",
    });

    const createdEvent = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Capacity 1 Event",
        description: "Waitlist test",
        location: "BA 1130",
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 1,
        waitlistEnabled: true,
      })
      .expect(201);

    const eventId = createdEvent.body.id as string;
    expect(eventId).toBeTruthy();

    await api.post(`/api/events/${eventId}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    const list = await api.get("/api/events").expect(200);
    expect(list.body.items).toHaveLength(1);

    const regA = await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendeeA.token}`).expect(201);
    expect(regA.body.registration.status).toBe("CONFIRMED");
    expect(regA.body.ticket).toBeTruthy();

    const regB = await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendeeB.token}`).expect(201);
    expect(regB.body.registration.status).toBe("WAITLISTED");
    expect(regB.body.ticket).toBeNull();

    await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendeeB.token}`).expect(409);

    await api.get(`/api/events/${eventId}/attendees`).set("Authorization", `Bearer ${attendeeA.token}`).expect(403);

    await api.delete(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendeeA.token}`).expect(204);

    const attendees = await api.get(`/api/events/${eventId}/attendees`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    const promoted = attendees.body.items.find((item: { attendeeId: string }) => item.attendeeId === attendeeB.user.id);
    expect(promoted?.status).toBe("CONFIRMED");
  });
});

describe("Organizer and attendee workspace APIs", () => {
  test("returns organizer-owned drafts and published events via /api/my/events", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+mine@utoronto.ca",
      name: "Org Mine",
      role: "ORGANIZER",
    });
    const otherOrganizer = await signUpAndSignIn({
      email: "org+other@utoronto.ca",
      name: "Org Other",
      role: "ORGANIZER",
    });

    const draft = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Draft Event",
        description: "draft",
        location: "BA 1130",
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 10,
        waitlistEnabled: true,
      })
      .expect(201);

    const published = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Published Event",
        description: "published",
        location: "BA 1131",
        startTime: new Date(Date.now() + 7200_000).toISOString(),
        capacity: 20,
        waitlistEnabled: true,
      })
      .expect(201);

    await api.post(`/api/events/${published.body.id}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    await api
      .post("/api/events")
      .set("Authorization", `Bearer ${otherOrganizer.token}`)
      .send({
        title: "Other Organizer Event",
        description: "other",
        location: "BA 1132",
        startTime: new Date(Date.now() + 10800_000).toISOString(),
        capacity: 30,
        waitlistEnabled: true,
      })
      .expect(201);

    const myEvents = await api.get("/api/my/events").set("Authorization", `Bearer ${organizer.token}`).expect(200);

    expect(myEvents.body.items).toHaveLength(2);
    expect(myEvents.body.items.some((item: { id: string; status: string }) => item.id === draft.body.id && item.status === "DRAFT")).toBe(true);
    expect(myEvents.body.items.some((item: { id: string; status: string }) => item.id === published.body.id && item.status === "PUBLISHED")).toBe(true);
  });

  test("returns attendee tickets and qr access via /api/me/tickets", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+tickets@utoronto.ca",
      name: "Org Tickets",
      role: "ORGANIZER",
    });
    const attendee = await signUpAndSignIn({
      email: "attendee+tickets@utoronto.ca",
      name: "Ticket Holder",
      role: "ATTENDEE",
    });

    const createdEvent = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Ticket Event",
        description: "ticket page",
        location: "Myhal",
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 5,
        waitlistEnabled: true,
      })
      .expect(201);

    const eventId = createdEvent.body.id as string;

    await api.post(`/api/events/${eventId}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    const registration = await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendee.token}`).expect(201);

    const ticketId = registration.body.ticket.id as string;

    const myTickets = await api.get("/api/me/tickets").set("Authorization", `Bearer ${attendee.token}`).expect(200);

    expect(myTickets.body.items).toHaveLength(1);
    expect(myTickets.body.items[0].id).toBe(ticketId);
    expect(myTickets.body.items[0].event.id).toBe(eventId);
    expect(myTickets.body.items[0].checkin.checkedIn).toBe(false);

    const qrResponse = await api.get(`/api/tickets/${ticketId}/qr`).set("Authorization", `Bearer ${attendee.token}`).expect(200);

    const qrContent =
      typeof qrResponse.text === "string" && qrResponse.text.length > 0
        ? qrResponse.text
        : Buffer.isBuffer(qrResponse.body)
          ? qrResponse.body.toString("utf8")
          : String(qrResponse.body ?? "");

    expect(qrContent).toContain("<svg");
  });
});

describe("Check-in idempotency and RBAC", () => {
  test("marks second check-in as duplicate and enforces role restrictions", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+checkin@utoronto.ca",
      name: "Org Checkin",
      role: "ORGANIZER",
    });
    const staff = await signUpAndSignIn({
      email: "staff@utoronto.ca",
      name: "Staff 1",
      role: "STAFF",
    });
    const attendee = await signUpAndSignIn({
      email: "attendee@utoronto.ca",
      name: "Attendee 1",
      role: "ATTENDEE",
    });

    const createdEvent = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Check-in Event",
        description: "Idempotency test",
        location: "Myhal",
        startTime: new Date(Date.now() + 7200_000).toISOString(),
        capacity: 10,
        waitlistEnabled: true,
      })
      .expect(201);

    const eventId = createdEvent.body.id as string;

    await api.post(`/api/events/${eventId}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    await api
      .post(`/api/events/${eventId}/staff`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ email: staff.user.email })
      .expect(201);

    const registration = await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${attendee.token}`).expect(201);

    const ticketId = registration.body.ticket.id as string;
    expect(ticketId).toBeTruthy();

    const first = await api
      .post("/api/checkins/manual")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ ticketId })
      .expect(201);
    expect(first.body.isDuplicate).toBe(false);

    const second = await api
      .post("/api/checkins/manual")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ ticketId })
      .expect(201);
    expect(second.body.isDuplicate).toBe(true);

    const ticketQr = await api.get(`/api/tickets/${ticketId}/qr`).set("Authorization", `Bearer ${attendee.token}`).expect(200);
    const qrContent =
      typeof ticketQr.text === "string" && ticketQr.text.length > 0
        ? ticketQr.text
        : Buffer.isBuffer(ticketQr.body)
          ? ticketQr.body.toString("utf8")
          : String(ticketQr.body ?? "");
    expect(qrContent).toContain("<svg");

    const rawTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(rawTicket?.qrPayload).toBeTruthy();

    const qrCheckin = await api
      .post("/api/checkins/scan")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ qrPayload: rawTicket?.qrPayload })
      .expect(201);
    expect(qrCheckin.body.isDuplicate).toBe(true);
    expect(qrCheckin.body.method).toBe("QR");

    await api.post("/api/checkins/manual").set("Authorization", `Bearer ${attendee.token}`).send({ ticketId }).expect(403);

    const dashboard = await api.get(`/api/events/${eventId}/dashboard`).set("Authorization", `Bearer ${staff.token}`).expect(200);

    expect(dashboard.body.checkedIn).toBe(1);
    expect(dashboard.body.recentCheckins).toHaveLength(3);
  });
});

describe("CSV attendee import", () => {
  test("imports valid rows, creates tickets, and reports duplicates/invalid rows", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+csv@utoronto.ca",
      name: "Org Csv",
      role: "ORGANIZER",
    });

    const existingAttendee = await signUpAndSignIn({
      email: "existing@utoronto.ca",
      name: "Existing Attendee",
      role: "ATTENDEE",
    });

    const createdEvent = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "CSV Import Event",
        description: "csv import",
        location: "BA 1130",
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 2,
        waitlistEnabled: true,
      })
      .expect(201);

    const eventId = createdEvent.body.id as string;

    await api.post(`/api/events/${eventId}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    await api.post(`/api/events/${eventId}/register`).set("Authorization", `Bearer ${existingAttendee.token}`).expect(201);

    const csvText = [
      "name,email",
      "Alice,alice@utoronto.ca",
      "Bob,bob@utoronto.ca",
      "NoEmail,not-an-email",
      "Existing Attendee,existing@utoronto.ca",
      "Alice Again,alice@utoronto.ca",
    ].join("\n");

    const response = await api
      .post(`/api/events/${eventId}/import-attendees-csv`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ csvText })
      .expect(201);

    expect(response.body.summary.totalRows).toBe(5);
    expect(response.body.summary.importedRows).toBe(2);
    expect(response.body.summary.invalidRows).toBe(1);
    expect(response.body.summary.duplicateRows).toBe(2);
    expect(response.body.summary.confirmedRows).toBe(1);
    expect(response.body.summary.waitlistedRows).toBe(1);

    expect(response.body.issues).toHaveLength(3);

    const attendees = await api.get(`/api/events/${eventId}/attendees`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    expect(attendees.body.items).toHaveLength(3);

    const importedAlice = attendees.body.items.find((item: { attendee: { email: string } | null }) => item.attendee?.email === "alice@utoronto.ca");
    const importedBob = attendees.body.items.find((item: { attendee: { email: string } | null }) => item.attendee?.email === "bob@utoronto.ca");

    expect(importedAlice?.status).toBe("CONFIRMED");
    expect(importedBob?.status).toBe("WAITLISTED");

    const aliceUser = await prisma.user.findUnique({
      where: { email: "alice@utoronto.ca" },
    });
    expect(aliceUser).toBeTruthy();
    expect(aliceUser?.role).toBe("ATTENDEE");

    const aliceTicket = aliceUser
      ? await prisma.ticket.findUnique({
          where: {
            eventId_attendeeId: {
              eventId,
              attendeeId: aliceUser.id,
            },
          },
        })
      : null;

    expect(aliceTicket).toBeTruthy();

    const importJobs = await prisma.importJob.findMany({
      where: { eventId },
    });

    expect(importJobs).toHaveLength(1);
    expect(importJobs[0]?.status).toBe("COMPLETED");
    expect(importJobs[0]?.summary).toContain('"importedRows":2');
  });

  test("rejects empty csv imports", async () => {
    const organizer = await signUpAndSignIn({
      email: "org+csv-empty@utoronto.ca",
      name: "Org Csv Empty",
      role: "ORGANIZER",
    });

    const createdEvent = await api
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "CSV Empty Event",
        description: "csv empty",
        location: "BA 1130",
        startTime: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 5,
        waitlistEnabled: true,
      })
      .expect(201);

    const eventId = createdEvent.body.id as string;

    await api.post(`/api/events/${eventId}/publish`).set("Authorization", `Bearer ${organizer.token}`).expect(200);

    await api
      .post(`/api/events/${eventId}/import-attendees-csv`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ csvText: "name,email\n" })
      .expect(400);
  });
});
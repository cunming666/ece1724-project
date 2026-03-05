import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { resetStore, store } from "../src/lib/store.js";

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

beforeEach(() => {
  resetStore();
});

afterAll(() => {
  io.close();
});

describe("Auth API", () => {
  test("supports sign-up/sign-in/session/sign-out flow", async () => {
    await api.get("/auth/session").expect(401);

    await api.post("/auth/sign-up").send({
      email: "organizer@utoronto.ca",
      name: "Organizer",
      password: "pass1234",
      role: "ORGANIZER",
    }).expect(201);

    await api.post("/auth/sign-up").send({
      email: "organizer@utoronto.ca",
      name: "Duplicate",
      password: "pass1234",
      role: "ORGANIZER",
    }).expect(409);

    const signIn = await api.post("/auth/sign-in").send({
      email: "organizer@utoronto.ca",
      password: "pass1234",
    }).expect(200);

    const token = signIn.body.token as string;
    expect(token).toBeTruthy();

    const session = await api.get("/auth/session")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(session.body.email).toBe("organizer@utoronto.ca");
    expect(session.body.role).toBe("ORGANIZER");

    await api.post("/auth/sign-out")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await api.get("/auth/session")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
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

    const createdEvent = await api.post("/api/events")
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

    await api.post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .expect(200);

    const list = await api.get("/api/events").expect(200);
    expect(list.body.items).toHaveLength(1);

    const regA = await api.post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${attendeeA.token}`)
      .expect(201);
    expect(regA.body.registration.status).toBe("CONFIRMED");
    expect(regA.body.ticket).toBeTruthy();

    const regB = await api.post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${attendeeB.token}`)
      .expect(201);
    expect(regB.body.registration.status).toBe("WAITLISTED");
    expect(regB.body.ticket).toBeNull();

    await api.post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${attendeeB.token}`)
      .expect(409);

    await api.get(`/api/events/${eventId}/attendees`)
      .set("Authorization", `Bearer ${attendeeA.token}`)
      .expect(403);

    await api.delete(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${attendeeA.token}`)
      .expect(204);

    const attendees = await api.get(`/api/events/${eventId}/attendees`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .expect(200);

    const promoted = attendees.body.items.find((item: { attendeeId: string }) => item.attendeeId === attendeeB.user.id);
    expect(promoted?.status).toBe("CONFIRMED");
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

    const createdEvent = await api.post("/api/events")
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

    await api.post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .expect(200);

    store.staffAssignments.push({
      id: store.createId("asg"),
      eventId,
      userId: staff.user.id,
    });

    const registration = await api.post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(201);

    const ticketId = registration.body.ticket.id as string;
    expect(ticketId).toBeTruthy();

    const first = await api.post("/api/checkins/manual")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ ticketId })
      .expect(201);
    expect(first.body.isDuplicate).toBe(false);

    const second = await api.post("/api/checkins/manual")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ ticketId })
      .expect(201);
    expect(second.body.isDuplicate).toBe(true);

    await api.post("/api/checkins/manual")
      .set("Authorization", `Bearer ${attendee.token}`)
      .send({ ticketId })
      .expect(403);

    const dashboard = await api.get(`/api/events/${eventId}/dashboard`)
      .set("Authorization", `Bearer ${staff.token}`)
      .expect(200);

    expect(dashboard.body.checkedIn).toBe(1);
    expect(dashboard.body.recentCheckins).toHaveLength(2);
  });
});

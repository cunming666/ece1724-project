import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type BootstrapResponse = {
  event: { id: string; title: string };
  accounts: Array<{
    role: "ORGANIZER" | "STAFF" | "ATTENDEE";
    email: string;
    password: string;
    token: string;
  }>;
};

type EventResponse = {
  id: string;
  title: string;
};

type SignInResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "ORGANIZER" | "STAFF" | "ATTENDEE";
  };
};

type AddAttendeeResponse = {
  registration: {
    status: "CONFIRMED" | "WAITLISTED";
  };
  ticket: { id: string } | null;
  createdAccount: boolean;
  defaultPassword: string | null;
};

const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";
const PASSWORD = "pass1234";

async function bootstrapDemo(request: APIRequestContext): Promise<BootstrapResponse> {
  const response = await request.post(`${API_BASE_URL}/api/demo/bootstrap`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as BootstrapResponse;
}

async function createAndPublishEvent(request: APIRequestContext, organizerToken: string, title: string): Promise<EventResponse> {
  const createResponse = await request.post(`${API_BASE_URL}/api/events`, {
    headers: {
      Authorization: `Bearer ${organizerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title,
      description: "E2E created event",
      location: "Bahen Centre",
      startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capacity: 20,
      waitlistEnabled: true,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = (await createResponse.json()) as EventResponse;

  const publishResponse = await request.post(`${API_BASE_URL}/api/events/${created.id}/publish`, {
    headers: {
      Authorization: `Bearer ${organizerToken}`,
    },
  });
  expect(publishResponse.ok()).toBeTruthy();

  return created;
}
async function signUpAndSignIn(
  request: APIRequestContext,
  input: { email: string; name: string; role: "ORGANIZER" | "STAFF" | "ATTENDEE" },
): Promise<SignInResponse> {
  const signUpResponse = await request.post(`${API_BASE_URL}/auth/sign-up`, {
    data: {
      email: input.email,
      name: input.name,
      password: PASSWORD,
      role: input.role,
    },
  });
  expect(signUpResponse.ok()).toBeTruthy();

  const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in`, {
    data: {
      email: input.email,
      password: PASSWORD,
    },
  });
  expect(signInResponse.ok()).toBeTruthy();
  return (await signInResponse.json()) as SignInResponse;
}

async function addAttendeeToEvent(
  request: APIRequestContext,
  input: { organizerToken: string; eventId: string; name: string; email: string },
): Promise<AddAttendeeResponse> {
  const response = await request.post(`${API_BASE_URL}/api/events/${input.eventId}/attendees`, {
    headers: {
      Authorization: `Bearer ${input.organizerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      name: input.name,
      email: input.email,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AddAttendeeResponse;
}

async function createAndPublishEventAt(
  request: APIRequestContext,
  organizerToken: string,
  title: string,
  startTimeIso: string,
): Promise<EventResponse> {
  const createResponse = await request.post(`${API_BASE_URL}/api/events`, {
    headers: {
      Authorization: `Bearer ${organizerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title,
      description: "E2E ranged event",
      location: "Bahen Centre",
      startTime: startTimeIso,
      capacity: 20,
      waitlistEnabled: true,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const created = (await createResponse.json()) as EventResponse;

  const publishResponse = await request.post(`${API_BASE_URL}/api/events/${created.id}/publish`, {
    headers: {
      Authorization: `Bearer ${organizerToken}`,
    },
  });
  expect(publishResponse.ok()).toBeTruthy();

  return created;
}

async function openWithSession(page: Page, token: string, path = "/panel"): Promise<void> {
  await page.addInitScript((sessionToken) => {
    window.localStorage.setItem("sessionToken", sessionToken);
  }, token);

  await page.goto(path);
}

async function signInFromAuthPage(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/auth");
  await page.getByPlaceholder("name@mail.utoronto.ca").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/panel(?:\?range=(?:today|week))?$/);
  await expect(page.getByRole("heading", { name: "Control Panel" })).toBeVisible();
}

test("root path redirects to auth page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Event Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("auth flow: sign up, sign in, quick demo entry", async ({ page }) => {
  const email = `e2e.auth.${Date.now()}@utoronto.ca`;

  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Event Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

  await page.getByRole("button", { name: "Register" }).first().click();
  const signUpEmailInput = page.getByPlaceholder("name@mail.utoronto.ca");
  await signUpEmailInput.fill(email);
  await page.getByPlaceholder("Full name").fill("E2E Auth User");
  await page.getByPlaceholder("At least 6 characters").fill(PASSWORD);
  await page.locator("select").selectOption("ATTENDEE");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByText("Registration successful. Please sign in with your new account.")).toBeVisible();

  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/panel(?:\?range=(?:today|week))?$/);
  await expect(page.getByRole("heading", { name: "Control Panel" })).toBeVisible();
  await expect(page.getByText("E2E Auth User").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.getByRole("button", { name: "Load Demo (Organizer)" }).click();
  await expect(page).toHaveURL(/\/panel(?:\?range=(?:today|week))?$/);
  await expect(page.getByText("Demo Organizer").first()).toBeVisible();
  await expect(page.getByText("ORGANIZER").first()).toBeVisible();
});


test("navigation order is consistent between sidebar and quick nav", async ({ page, request }) => {
  const bootstrap = await bootstrapDemo(request);
  const organizer = bootstrap.accounts.find((account) => account.role === "ORGANIZER");
  expect(organizer).toBeTruthy();

  await openWithSession(page, organizer!.token);
  await expect(page).toHaveURL(/\/panel(?:\?range=(?:today|week))?$/);
  await expect(page.getByRole("heading", { name: "Control Panel" })).toBeVisible();

  const sidebarLabels = (await page.locator('[data-testid="panel-sidebar-nav"] a').allTextContents())
    .map((value) => value.trim())
    .filter(Boolean);
  const quickLabels = (await page.locator('[data-testid="panel-quick-nav"] a').allTextContents())
    .map((value) => value.trim())
    .filter(Boolean);

  expect(quickLabels).toEqual(sidebarLabels);

  await page.locator('[data-testid="panel-quick-nav"] a').filter({ hasText: "Event Board" }).click();
  await expect(page).toHaveURL(/\/panel\/events$/);
  await expect(page.getByRole("heading", { name: "Event Board" }).first()).toBeVisible();
});

test("overview Today/Week switch updates scoped metrics", async ({ page, request }) => {
  const bootstrap = await bootstrapDemo(request);
  const organizer = bootstrap.accounts.find((account) => account.role === "ORGANIZER");
  expect(organizer).toBeTruthy();

  await createAndPublishEventAt(
    request,
    organizer!.token,
    `E2E Range Today ${Date.now()}`,
    new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  );
  await createAndPublishEventAt(
    request,
    organizer!.token,
    `E2E Range Week ${Date.now()}`,
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  );

  const eventsResponse = await request.get(`${API_BASE_URL}/api/events`);
  expect(eventsResponse.ok()).toBeTruthy();
  const eventsPayload = (await eventsResponse.json()) as { items: Array<{ startTime: string }> };

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(rangeStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(rangeStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayExpected = eventsPayload.items.filter((event) => {
    const time = new Date(event.startTime).getTime();
    return time >= rangeStart.getTime() && time < todayEnd.getTime();
  }).length;
  const weekExpected = eventsPayload.items.filter((event) => {
    const time = new Date(event.startTime).getTime();
    return time >= rangeStart.getTime() && time < weekEnd.getTime();
  }).length;

  await openWithSession(page, organizer!.token);
  await expect(page).toHaveURL(/\/panel(?:\?range=(?:today|week))?$/);
  await expect(page.getByTestId("overview-range-week")).toBeVisible();

  await page.getByTestId("overview-range-today").click();
  const todayCount = Number.parseInt((await page.getByTestId("overview-range-count").innerText()).trim(), 10);
  expect(todayCount).toBe(todayExpected);

  await page.getByTestId("overview-range-week").click();
  const weekCount = Number.parseInt((await page.getByTestId("overview-range-count").innerText()).trim(), 10);
  expect(weekCount).toBe(weekExpected);
  expect(weekCount).toBeGreaterThanOrEqual(todayCount);
});

test("organizer roster add flow gives attendee a ticket", async ({ browser, request }) => {
  const bootstrap = await bootstrapDemo(request);
  const organizer = bootstrap.accounts.find((account) => account.role === "ORGANIZER");
  expect(organizer).toBeTruthy();

  const attendeeEmail = `e2e.attendee.${Date.now()}@utoronto.ca`;
  const attendeeName = "E2E Attendee";
  const attendee = await signUpAndSignIn(request, {
    email: attendeeEmail,
    name: attendeeName,
    role: "ATTENDEE",
  });
  const eventTitle = `E2E Ticket Event ${Date.now()}`;
  const event = await createAndPublishEvent(request, organizer!.token, eventTitle);

  const organizerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  await organizerContext.addInitScript((token) => {
    window.localStorage.setItem("sessionToken", token);
  }, organizer!.token);
  const organizerPage = await organizerContext.newPage();

  await organizerPage.goto(`/panel/events/${event.id}/attendees`);
  await expect(organizerPage.getByRole("heading", { name: "Roster" }).first()).toBeVisible();
  await organizerPage.getByPlaceholder("Full name").fill(attendeeName);
  await organizerPage.getByPlaceholder("name@utoronto.ca").fill(attendeeEmail);
  await organizerPage.getByRole("button", { name: "Add Attendee" }).click();
  await expect(organizerPage.getByText("Attendee added as confirmed.")).toBeVisible();
  await expect(organizerPage.getByText(attendeeEmail).first()).toBeVisible();

  const attendeeContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  await attendeeContext.addInitScript((token) => {
    window.localStorage.setItem("sessionToken", token);
  }, attendee.token);
  const attendeePage = await attendeeContext.newPage();

  await attendeePage.goto("/panel/events");
  await expect(attendeePage).toHaveURL(/\/panel\/events$/);

  const eventCard = attendeePage.locator("article").filter({ hasText: eventTitle }).first();
  await expect(eventCard).toBeVisible();
  await expect(eventCard.getByRole("button", { name: "Register" })).toHaveCount(0);

  await eventCard.getByRole("link", { name: "My Tickets" }).click();

  await expect(attendeePage).toHaveURL(/\/panel\/tickets$/);
  await expect(attendeePage.getByRole("heading", { name: "My Tickets" }).first()).toBeVisible();
  await expect(attendeePage.getByText(eventTitle).first()).toBeVisible();
  await expect(attendeePage.getByRole("button", { name: "Copy Ticket ID" })).toBeVisible();

  await attendeeContext.close();
  await organizerContext.close();
});

test("staff check-in updates organizer dashboard in real time", async ({ browser, request }) => {
  const bootstrap = await bootstrapDemo(request);
  const organizer = bootstrap.accounts.find((account) => account.role === "ORGANIZER");
  const staff = bootstrap.accounts.find((account) => account.role === "STAFF");
  expect(organizer).toBeTruthy();
  expect(staff).toBeTruthy();

  const event = await createAndPublishEvent(request, organizer!.token, `E2E Realtime Event ${Date.now()}`);

  const attendeeEmail = `e2e.realtime.${Date.now()}@utoronto.ca`;
  const attendeeName = "E2E Realtime Attendee";

  await signUpAndSignIn(request, {
    email: attendeeEmail,
    name: attendeeName,
    role: "ATTENDEE",
  });

  const assignStaffResponse = await request.post(`${API_BASE_URL}/api/events/${event.id}/staff`, {
    headers: {
      Authorization: `Bearer ${organizer!.token}`,
      "Content-Type": "application/json",
    },
    data: {
      email: staff!.email,
    },
  });
  expect(assignStaffResponse.ok()).toBeTruthy();

  const addAttendeePayload = await addAttendeeToEvent(request, {
    organizerToken: organizer!.token,
    eventId: event.id,
    name: attendeeName,
    email: attendeeEmail,
  });
  expect(addAttendeePayload.ticket).toBeTruthy();
  const ticketId = addAttendeePayload.ticket!.id;

  const organizerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  await organizerContext.addInitScript((token) => {
    window.localStorage.setItem("sessionToken", token);
  }, organizer!.token);

  const organizerPage = await organizerContext.newPage();
  await organizerPage.goto(`/panel/events/${event.id}/dashboard`);
  await expect(organizerPage.getByRole("heading", { name: "Event Dashboard" }).first()).toBeVisible();

  const staffContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  await staffContext.addInitScript((token) => {
    window.localStorage.setItem("sessionToken", token);
  }, staff!.token);

  const staffPage = await staffContext.newPage();
  await staffPage.goto(`/panel/events/${event.id}/checkin`);
  await expect(staffPage.getByRole("heading", { name: "Check-in" }).first()).toBeVisible();

  await staffPage.getByPlaceholder("Paste or type the attendee ticket ID").fill(ticketId);
  await staffPage.getByRole("button", { name: "Check In" }).click();
  await expect(staffPage.getByText(`Check-in complete for ticket ${ticketId}.`).first()).toBeVisible();

  const refreshButton = organizerPage.getByRole("button", { name: /^Refresh/ });

  await expect
    .poll(async () => {
      await refreshButton.click();
      return organizerPage.getByText(attendeeEmail).first().isVisible();
    }, {
      timeout: 16_000,
      intervals: [700, 1200, 1800],
    })
    .toBe(true);

  await staffContext.close();
  await organizerContext.close();
});














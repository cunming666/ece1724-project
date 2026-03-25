import { PrismaClient } from "@prisma/client";

function assertPostgresUrl(url) {
  const normalized = (url || "").trim().toLowerCase();
  if (!normalized.startsWith("postgresql://") && !normalized.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string (postgresql://...).");
  }
}

const databaseUrl = process.env.DATABASE_URL;
assertPostgresUrl(databaseUrl);

const prisma = new PrismaClient();

async function main() {
  const suffix = Date.now().toString(36);
  const organizerEmail = `pg.organizer.${suffix}@example.com`;
  const attendeeEmail = `pg.attendee.${suffix}@example.com`;

  const organizer = await prisma.user.create({
    data: {
      email: organizerEmail,
      name: "PG Organizer",
      passwordHash: "postgres-smoke",
      role: "ORGANIZER",
    },
  });

  const attendee = await prisma.user.create({
    data: {
      email: attendeeEmail,
      name: "PG Attendee",
      passwordHash: "postgres-smoke",
      role: "ATTENDEE",
    },
  });

  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: `PG Smoke Event ${suffix}`,
      description: "PostgreSQL smoke verification",
      location: "Postgres Lab",
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      capacity: 1,
      waitlistEnabled: true,
      status: "PUBLISHED",
    },
  });

  await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee.id,
      status: "CONFIRMED",
      waitlistPosition: null,
    },
  });

  const confirmedCount = await prisma.registration.count({
    where: { eventId: event.id, status: "CONFIRMED" },
  });

  if (confirmedCount !== 1) {
    throw new Error(`PostgreSQL smoke check failed: expected confirmedCount=1, got ${confirmedCount}`);
  }

  await prisma.event.delete({ where: { id: event.id } });
  await prisma.user.deleteMany({
    where: {
      id: { in: [organizer.id, attendee.id] },
    },
  });

  console.log("PostgreSQL smoke check passed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

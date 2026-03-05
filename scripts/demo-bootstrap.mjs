const baseUrl = process.env.API_URL ?? "http://localhost:4000";

async function main() {
  const response = await fetch(`${baseUrl}/api/demo/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bootstrap failed: ${response.status} ${text}`);
  }

  const payload = await response.json();

  console.log("Demo bootstrap completed.");
  console.log(`Event: ${payload.event.title} (${payload.event.id})`);
  console.log("");
  console.log("Test Accounts:");
  for (const account of payload.accounts) {
    console.log(
      `- ${account.role.padEnd(9)} | ${account.email} | password=${account.password} | token=${account.token}`,
    );
  }
  console.log("");
  console.log("Seeded state:");
  console.log(JSON.stringify(payload.seededState, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

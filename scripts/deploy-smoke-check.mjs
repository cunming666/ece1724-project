function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function getOrigin(url) {
  return new URL(url).origin;
}

async function assertJson(url, description) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${description} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function assertWeb(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Web root check failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  if (!html.includes("<div id=\"root\"></div>") && !html.includes("<div id=\"root\">")) {
    throw new Error("Web root check failed: missing React root node.");
  }
}

async function assertCors(apiBase, webOrigin) {
  const response = await fetch(`${apiBase}/auth/session`, {
    method: "OPTIONS",
    headers: {
      Origin: webOrigin,
      "Access-Control-Request-Method": "GET",
    },
  });

  if (!response.ok) {
    throw new Error(`CORS preflight failed: ${response.status} ${response.statusText}`);
  }

  const allowOrigin = response.headers.get("access-control-allow-origin");
  if (allowOrigin !== webOrigin) {
    throw new Error(`CORS origin mismatch: expected ${webOrigin}, got ${allowOrigin ?? "<empty>"}`);
  }
}

async function main() {
  const apiBaseRaw = process.env.API_DEPLOY_URL;
  if (!apiBaseRaw) {
    throw new Error("Missing API_DEPLOY_URL. Example: API_DEPLOY_URL=https://your-api.onrender.com npm run smoke:deploy");
  }

  const apiBase = normalizeBaseUrl(apiBaseRaw);
  const webUrlRaw = process.env.WEB_DEPLOY_URL;
  const webUrl = webUrlRaw ? normalizeBaseUrl(webUrlRaw) : null;
  const webOrigin = webUrl ? getOrigin(webUrl) : null;

  const health = await assertJson(`${apiBase}/health`, "API health check");
  if (!health.ok) {
    throw new Error("API health check failed: `ok` is not true.");
  }

  const events = await assertJson(`${apiBase}/api/events`, "Public events endpoint check");
  if (!Array.isArray(events.items)) {
    throw new Error("Public events endpoint check failed: `items` is not an array.");
  }

  if (webUrl && webOrigin) {
    await assertWeb(webUrl);
    await assertCors(apiBase, webOrigin);
  }

  console.log("Deployment smoke check passed.");
  console.log(`API: ${apiBase}`);
  if (webUrl) {
    console.log(`WEB: ${webUrl}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

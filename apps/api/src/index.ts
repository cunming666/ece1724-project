import { getEnv } from "./lib/env.js";
import { createApp } from "./app.js";

const env = getEnv();
const { httpServer } = createApp();
const port = Number(env.PORT ?? env.API_PORT ?? 4000);

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

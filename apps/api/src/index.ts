import { createApp } from "./app.js";

const { httpServer } = createApp();
const port = Number(process.env.API_PORT ?? 4000);
httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

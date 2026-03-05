import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ZodError } from "zod";
import { createApiRouter } from "./routes/api.js";
import { createAuthRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

  const io = new Server(httpServer, {
    cors: {
      origin: webOrigin,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join:event", (eventId: string) => {
      socket.join(eventId);
    });

    socket.on("leave:event", (eventId: string) => {
      socket.leave(eventId);
    });
  });

  app.use(
    cors({
      origin: webOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser() as any);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", ts: new Date().toISOString() });
  });

  app.use("/auth", createAuthRouter());
  app.use("/api", createApiRouter(io));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.flatten(),
      });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return { app, httpServer, io };
}

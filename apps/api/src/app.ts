import "dotenv/config";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ZodError } from "zod";
import { getEnv } from "./lib/env.js";
import { createApiRouter } from "./routes/api.js";
import { createAuthRouter } from "./routes/auth.js";

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function parseAllowedOrigins(raw: string): string[] {
  const origins = raw
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter((item) => item.length > 0);

  return Array.from(new Set(origins));
}

function defaultErrorCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_FAILED";
}

export function createApp() {
  const env = getEnv();
  const app = express();
  const httpServer = createServer(app);

  const allowedOrigins = parseAllowedOrigins(env.WEB_ORIGIN);

  const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  };

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
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

  app.use((req, res, next) => {
    const requestIdHeader = req.headers["x-request-id"];
    const requestId = typeof requestIdHeader === "string" && requestIdHeader.trim() ? requestIdHeader.trim() : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const requestId = String(res.locals.requestId ?? "unknown");
      console.info(
        JSON.stringify({
          level: "info",
          ts: new Date().toISOString(),
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs,
        }),
      );
    });

    next();
  });

  app.use((req, res, next) => {
    const json = res.json.bind(res);

    res.json = ((body: unknown) => {
      if (res.statusCode >= 400) {
        const requestId = String(res.locals.requestId ?? "unknown");

        if (typeof body === "object" && body !== null && "error" in body) {
          const typedBody = body as { error: unknown; code?: unknown; details?: unknown };

          if (typeof typedBody.error === "string") {
            return json({
              error: {
                code: typeof typedBody.code === "string" ? typedBody.code : defaultErrorCode(res.statusCode),
                message: typedBody.error,
              },
              ...(typedBody.details ? { details: typedBody.details } : {}),
              requestId,
            });
          }

          if (
            typeof typedBody.error === "object" &&
            typedBody.error !== null &&
            "code" in typedBody.error &&
            "message" in typedBody.error
          ) {
            return json({
              ...(typedBody as Record<string, unknown>),
              requestId,
            });
          }
        }

        return json({
          error: {
            code: defaultErrorCode(res.statusCode),
            message: "Request failed",
          },
          requestId,
        });
      }

      return json(body);
    }) as typeof res.json;

    next();
  });

  app.use(
    cors({
      origin: corsOrigin,
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
    const requestId = String(res.locals.requestId ?? "unknown");

    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors).flat().find((item) => typeof item === "string" && item.trim().length > 0);
      const firstFormError = flattened.formErrors.find((item) => typeof item === "string" && item.trim().length > 0);

      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: firstFieldError ?? firstFormError ?? "Please check the submitted fields.",
        },
        details: flattened,
        requestId,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(
      JSON.stringify({
        level: "error",
        ts: new Date().toISOString(),
        requestId,
        message,
        stack,
      }),
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
      requestId,
    });
  });

  return { app, httpServer, io };
}

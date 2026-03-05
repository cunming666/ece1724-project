import { Router } from "express";
import { z } from "zod";
import { randomToken } from "../lib/security.js";
import { requireAuth, resolveSession } from "../lib/auth.js";
import { store } from "../lib/store.js";

const signUpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["ORGANIZER", "STAFF", "ATTENDEE"]).default("ATTENDEE"),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export function createAuthRouter() {
  const router = Router();

  router.post("/sign-up", async (req, res, next) => {
    try {
      const parsed = signUpSchema.parse(req.body);
      const existing = store.users.find((item) => item.email === parsed.email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const user = {
        id: store.createId("usr"),
        email: parsed.email,
        name: parsed.name,
        passwordHash: parsed.password,
        role: parsed.role,
        createdAt: store.nowIso(),
      };

      store.users.push(user);
      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sign-in", async (req, res, next) => {
    try {
      const parsed = signInSchema.parse(req.body);
      const user = store.users.find((item) => item.email === parsed.email);
      if (!user || user.passwordHash !== parsed.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = randomToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const session = {
        id: store.createId("ses"),
        userId: user.id,
        token,
        expiresAt,
        createdAt: store.nowIso(),
      };

      store.sessions.push(session);

      res.cookie("session_token", token, {
        httpOnly: false,
        sameSite: "lax",
        secure: false,
        expires: new Date(expiresAt),
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sign-out", requireAuth(), async (req, res, next) => {
    try {
      const token =
        req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
        req.cookies?.session_token ||
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);

      if (token) {
        store.sessions = store.sessions.filter((item) => item.token !== token);
      }

      res.clearCookie("session_token");
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/session", async (req, res, next) => {
    try {
      const session = await resolveSession(req);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      res.json(session.user);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

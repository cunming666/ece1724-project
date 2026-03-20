import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomToken } from "../lib/security.js";
import { requireAuth, resolveSession } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export function createAuthRouter() {
  const router = Router();

  router.post("/sign-up", async (req, res, next) => {
    try {
      const parsed = signUpSchema.parse(req.body);

      const existing = await prisma.user.findUnique({
        where: { email: parsed.email },
      });

      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const user = await prisma.user.create({
        data: {
          email: parsed.email,
          name: parsed.name,
          passwordHash: await bcrypt.hash(parsed.password, 10),
          role: parsed.role,
        },
      });

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

      const user = await prisma.user.findUnique({
        where: { email: parsed.email },
      });

      if (!user || !(await bcrypt.compare(parsed.password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = randomToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      res.cookie("session_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        expires: expiresAt,
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

  router.post("/change-password", requireAuth(), async (req, res, next) => {
    try {
      const parsed = changePasswordSchema.parse(req.body);

      const userId = res.locals.auth.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!(await bcrypt.compare(parsed.currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await bcrypt.hash(parsed.newPassword, 10),
        },
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sign-out", requireAuth(), async (req, res, next) => {
    try {
      const token =
        req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
        req.cookies?.session_token ||
        (typeof req.headers["x-session-token"] === "string"
          ? req.headers["x-session-token"]
          : undefined);

      if (token) {
        await prisma.session.deleteMany({
          where: { token },
        });
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

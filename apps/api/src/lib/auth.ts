import type { UserRole } from "../types.js";
import type { NextFunction, Request, Response } from "express";
import { store } from "./store.js";

export interface AuthSession {
  sessionId: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const headerToken = req.headers["x-session-token"];
  if (typeof headerToken === "string" && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  const cookieToken = req.cookies?.session_token;
  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

export async function resolveSession(req: Request): Promise<AuthSession | null> {
  const token = extractToken(req);
  if (!token) {
    return null;
  }

  const session = store.sessions.find((item) => item.token === token);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const user = store.users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }

  return {
    sessionId: session.id,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export function requireAuth(roles?: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = await resolveSession(req);
      if (!auth) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (roles && !roles.includes(auth.user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.locals.auth = auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}

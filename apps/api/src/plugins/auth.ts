import type { Role } from "@fwp/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sessions, users } from "../db/schema";
import { forbidden, unauthorized } from "../lib/errors";
import { generateToken, hashToken } from "../lib/tokens";
import type { SessionUser } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sessions are extended (sliding expiry) at most once per this interval to limit writes. */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function sessionCookieName(secure: boolean) {
  // The __Host- prefix pins the cookie to this exact host over HTTPS.
  return secure ? "__Host-fwp_session" : "fwp_session";
}

export function registerAuth(app: FastifyInstance) {
  const cookieName = sessionCookieName(app.config.COOKIE_SECURE);
  const ttlMs = app.config.SESSION_TTL_DAYS * DAY_MS;

  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request, reply) => {
    const token = request.cookies[cookieName];
    if (!token) return;

    const sessionId = hashToken(token);
    const [row] = await app.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()), isNull(users.disabledAt)))
      .limit(1);

    if (!row) {
      clearSessionCookie(app, reply);
      return;
    }

    request.user = { id: row.id, email: row.email, role: row.role, fullName: row.fullName, sessionId };

    if (Date.now() - row.lastSeenAt.getTime() > REFRESH_INTERVAL_MS) {
      const expiresAt = new Date(Date.now() + ttlMs);
      await app.db
        .update(sessions)
        .set({ lastSeenAt: new Date(), expiresAt })
        .where(eq(sessions.id, sessionId));
      setSessionCookie(app, reply, token, expiresAt);
    }
  });
}

function setSessionCookie(app: FastifyInstance, reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(sessionCookieName(app.config.COOKIE_SECURE), token, {
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(app: FastifyInstance, reply: FastifyReply) {
  reply.clearCookie(sessionCookieName(app.config.COOKIE_SECURE), {
    path: "/",
    secure: app.config.COOKIE_SECURE,
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function startSession(request: FastifyRequest, reply: FastifyReply, userId: string) {
  const app = request.server;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + app.config.SESSION_TTL_DAYS * DAY_MS);
  await app.db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: request.headers["user-agent"]?.slice(0, 400) ?? null,
    ip: request.ip,
  });
  setSessionCookie(app, reply, token, expiresAt);
}

export async function endSession(request: FastifyRequest, reply: FastifyReply) {
  if (request.user) {
    await request.server.db.delete(sessions).where(eq(sessions.id, request.user.sessionId));
  }
  clearSessionCookie(request.server, reply);
}

export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

export function requireRole(request: FastifyRequest, ...roles: Role[]): SessionUser {
  const user = requireUser(request);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}
